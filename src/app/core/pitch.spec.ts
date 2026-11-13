import { describe, expect, it } from 'vitest';
import { GUITAR_TUNING } from './chord-finder';
import { detectPitch, midiToHz, nearestString } from './pitch';

const RATE = 24000;

/** A plucked-string-like tone: a fundamental plus a few overtones (the 2nd louder, as on a guitar). */
function tone(hz: number, length = 2048, amplitude = 0.3): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    out[i] =
      amplitude *
      (0.6 * Math.sin(2 * Math.PI * hz * t) + 0.8 * Math.sin(2 * Math.PI * 2 * hz * t) + 0.3 * Math.sin(2 * Math.PI * 3 * hz * t));
  }
  return out;
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe('detectPitch', () => {
  it('finds each open string within a cent', () => {
    for (const midi of GUITAR_TUNING) {
      const hz = midiToHz(midi);
      const found = detectPitch(tone(hz), RATE);
      expect(found).not.toBeNull();
      expect(Math.abs(cents(found!.frequency, hz))).toBeLessThan(1);
      expect(found!.clarity).toBeGreaterThan(0.8);
    }
  });

  it('does not jump an octave down or up on a strong 2nd overtone', () => {
    const found = detectPitch(tone(110), RATE)!;
    expect(Math.round(found.frequency)).toBe(110);
  });

  it('hears a slightly flat string', () => {
    const hz = midiToHz(45) * 2 ** (-20 / 1200);
    const found = detectPitch(tone(hz), RATE)!;
    expect(Math.abs(cents(found.frequency, hz))).toBeLessThan(1);
  });

  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(2048), RATE)).toBeNull();
    expect(detectPitch(tone(110, 2048, 0.001), RATE)).toBeNull();
  });

  it('gives noise a low clarity', () => {
    const noise = new Float32Array(2048).map(() => Math.random() * 0.6 - 0.3);
    const found = detectPitch(noise, RATE);
    expect(found === null || found.clarity < 0.8).toBe(true);
  });
});

describe('nearestString', () => {
  it('picks the string and says how far off it is', () => {
    expect(nearestString(110)).toEqual({ string: 1, cents: 0 });
    const flatD = nearestString(midiToHz(50) * 2 ** (-30 / 1200));
    expect(flatD.string).toBe(2);
    expect(flatD.cents).toBeCloseTo(-30, 5);
    const sharpE = nearestString(midiToHz(64) * 2 ** (12 / 1200));
    expect(sharpE.string).toBe(5);
    expect(sharpE.cents).toBeCloseTo(12, 5);
  });

  it('takes the nearer string between two', () => {
    // Between G3 (55) and B3 (59): 56.5 is nearer G.
    expect(nearestString(midiToHz(56.5)).string).toBe(3);
    expect(nearestString(midiToHz(57.5)).string).toBe(4);
  });
});
