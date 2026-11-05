import { GUITAR_STRINGS, PitchSmoother, detectPitch, nearestString, noteFromFrequency } from './pitch';

const RATE = 48000;
const SIZE = 4096;
const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const cents = (measured: number, expected: number) => 1200 * Math.log2(measured / expected);

/** A steady tone with the given overtone amplitudes (1st = fundamental). */
function tone(freq: number, harmonics: number[], length = SIZE, noise = 0, seed = 1): Float32Array {
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / RATE + h)));
    out[i] = 0.3 * v + noise * random();
  }
  return out;
}

/**
 * A plucked string (Karplus-Strong): a burst of noise looping through a
 * delay line with a gentle low-pass, like a real string losing its overtones.
 * Each new sample averages the values from N and N − 1 samples ago, a delay
 * of N − 0.5 samples: the pitch is RATE / (N − 0.5).
 */
function pluck(freq: number, seed = 7): { sound: Float32Array; pitch: number } {
  const n = Math.round(RATE / freq + 0.5);
  let s = seed;
  const line = Float32Array.from({ length: n }, () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1);
  const total = Math.round(RATE * 0.4);
  const out = new Float32Array(total);
  for (let i = 0, p = 0; i < total; i++, p = (p + 1) % n) {
    out[i] = 0.5 * line[p];
    line[p] = 0.996 * 0.5 * (line[p] + line[(p + 1) % n]);
  }
  // Analyse after the noisy attack, like the tuner does while the note rings.
  return { sound: out.slice(RATE * 0.1, RATE * 0.1 + SIZE), pitch: RATE / (n - 0.5) };
}

describe('pitch detection (YIN)', () => {
  it('finds each open guitar string within 1 cent (pure tones)', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const hz = midiHz(midi);
      const pitch = detectPitch(tone(hz, [1]), RATE)!;
      expect(Math.abs(cents(pitch.frequency, hz)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('is not fooled by strong overtones (weak fundamental, like a low E string)', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const hz = midiHz(midi);
      const pitch = detectPitch(tone(hz, [0.3, 1, 0.8, 0.5, 0.3, 0.2]), RATE)!;
      expect(Math.abs(cents(pitch.frequency, hz)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('plucked strings (Karplus-Strong) within 1 cent', () => {
    for (const { midi } of GUITAR_STRINGS) {
      const { sound, pitch } = pluck(midiHz(midi));
      const found = detectPitch(sound, RATE)!;
      expect(found, `midi ${midi}`).not.toBeNull();
      expect(Math.abs(cents(found.frequency, pitch)), `midi ${midi}`).toBeLessThan(1);
    }
  });

  it('copes with background noise, and a slightly detuned string', () => {
    const hz = midiHz(45) * 2 ** (12 / 1200); // A2, 12 cents sharp
    const found = detectPitch(tone(hz, [0.6, 1, 0.5], SIZE, 0.05), RATE)!;
    expect(Math.abs(cents(found.frequency, hz))).toBeLessThan(2);
    expect(Math.round(noteFromFrequency(found.frequency).cents)).toBeGreaterThanOrEqual(10);
  });

  it('silence and pure noise give no note', () => {
    expect(detectPitch(new Float32Array(SIZE), RATE)).toBeNull();
    expect(detectPitch(tone(110, [1]).map((v) => v * 0.01), RATE)).toBeNull(); // too quiet
    expect(detectPitch(tone(1, [0], SIZE, 0.5), RATE)).toBeNull();
  });
});

describe('notes and strings', () => {
  it('names the note and the cents', () => {
    expect(noteFromFrequency(440)).toEqual({ name: 'A', octave: 4, midi: 69, cents: 0 });
    expect(noteFromFrequency(82.41)).toMatchObject({ name: 'E', octave: 2, midi: 40 });
    const sharp = noteFromFrequency(440 * 2 ** (20 / 1200));
    expect(sharp.name).toBe('A');
    expect(sharp.cents).toBeCloseTo(20, 5);
    expect(noteFromFrequency(466.16).name).toBe('A#');
    expect(noteFromFrequency(442, 442).cents).toBeCloseTo(0, 5); // A = 442 Hz
  });

  it('finds the nearest open string', () => {
    expect(nearestString(82.41)).toMatchObject({ string: 6 });
    expect(nearestString(246.94)).toMatchObject({ string: 2 });
    expect(nearestString(100)?.string).toBe(5); // a flat A string
    expect(nearestString(1000)).toBeNull();
  });

  it('smoother: median of recent readings, starts over on a new note or a pause', () => {
    const s = new PitchSmoother(5, 600);
    expect(s.push(110, 0)).toBe(110);
    s.push(111, 50);
    s.push(150, 100); // jump to another note: starts over
    expect(s.push(150.2, 150)).toBeCloseTo(150.2);
    expect(s.push(110, 2000)).toBe(110); // after a pause
  });
});
