// Tuner maths: which note is being played, and how far off it is. Pure
// logic (no Web Audio here), so it can be tested with synthetic sounds.
//
// Pitch detection uses YIN (de Cheveigné & Kawahara, 2002), the classic
// method for voices and plucked strings. A guitar note repeats itself every
// "period" (1/frequency seconds); YIN slides the sound against a copy of
// itself and finds the smallest shift (tau, in samples) at which the two
// match. frequency = sampleRate / tau. It is far less fooled by the strong
// overtones of a guitar string than an FFT peak (which often jumps an octave).

import { noteName } from './transpose';

export interface Pitch {
  /** Hz. */
  frequency: number;
  /** 0…1: how periodic the sound is (1 = a pure, steady note). */
  clarity: number;
}

export interface PitchOptions {
  minFrequency?: number;
  maxFrequency?: number;
  /** Below this loudness (RMS) the sound counts as silence. */
  minRms?: number;
  /** YIN threshold: lower = stricter about what counts as a period. */
  threshold?: number;
}

/**
 * The pitch of a short piece of sound (≥ 2 periods of the lowest note:
 * 4096 samples at 48 kHz cover a low D at 73 Hz). Null when it is silence
 * or not a clear note.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number, options: PitchOptions = {}): Pitch | null {
  // minRms is low on purpose: with the phone's automatic volume off, a low
  // string arrives quiet (phone microphones hear little below ~100 Hz).
  // Loudness doesn't change the maths (YIN compares the sound with itself),
  // and room noise isn't periodic, so it still comes out as "no note".
  const { minFrequency = 60, maxFrequency = 1200, minRms = 0.002, threshold = 0.12 } = options;

  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  if (Math.sqrt(sum / buffer.length) < minRms) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const tauMax = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(buffer.length / 2));
  const width = buffer.length - tauMax;

  // Steps 1–3: difference function, then "cumulative mean normalised" so
  // that tau = 0 isn't the trivial best match.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let d = 0;
    for (let j = 0; j < width; j++) {
      const diff = buffer[j] - buffer[j + tau];
      d += diff * diff;
    }
    running += d;
    cmnd[tau] = running === 0 ? 1 : (d * tau) / running;
  }

  // Step 4: the first dip under the threshold (the fundamental, not a
  // multiple of it), followed down to its lowest point.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  // No dip under the threshold (a real string is never perfectly periodic):
  // take the best match anyway; its low clarity lets the caller decide.
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] >= 0.5) return null;
    tau = best;
  }

  // Step 5: parabolic interpolation between samples, for sub-cent precision.
  let exact = tau;
  if (tau > 1 && tau < tauMax) {
    const [a, b, c] = [cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]];
    const shift = (a - c) / (2 * (a - 2 * b + c));
    if (Number.isFinite(shift) && Math.abs(shift) < 1) exact = tau + shift;
  }
  return { frequency: sampleRate / exact, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])) };
}

export interface NoteReading {
  /** "A", "C#" … (sharps: the usual way to name strings). */
  name: string;
  octave: number;
  /** MIDI number of the nearest note (A4 = 69). */
  midi: number;
  /** −50…+50: how far the sound is from that note (100 cents = 1 semitone). */
  cents: number;
}

/** The nearest note to a frequency, with A4 = `a4` Hz (440 by default). */
export function noteFromFrequency(frequency: number, a4 = 440): NoteReading {
  const exact = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(exact);
  return { name: noteName(midi, false), octave: Math.floor(midi / 12) - 1, midi, cents: (exact - midi) * 100 };
}

export type TunerInstrument = 'guitar' | 'bass';

export interface TunerString {
  /** Number as players count them: 1 = the thinnest. */
  string: number;
  midi: number;
}

/** Standard tuning, low to high: E2 A2 D3 G3 B3 E4. */
export const GUITAR_STRINGS: readonly TunerString[] = [
  { string: 6, midi: 40 },
  { string: 5, midi: 45 },
  { string: 4, midi: 50 },
  { string: 3, midi: 55 },
  { string: 2, midi: 59 },
  { string: 1, midi: 64 },
];

/** 4-string bass, an octave below the guitar's lowest four: E1 A1 D2 G2. */
export const BASS_STRINGS: readonly TunerString[] = [
  { string: 4, midi: 28 },
  { string: 3, midi: 33 },
  { string: 2, midi: 38 },
  { string: 1, midi: 43 },
];

export const TUNINGS: Record<TunerInstrument, { strings: readonly TunerString[]; minFrequency: number; window: number }> = {
  // window: samples analysed at once, ≥ 2 periods of the lowest note at 48 kHz.
  guitar: { strings: GUITAR_STRINGS, minFrequency: 60, window: 4096 },
  // Low E of a bass is 41 Hz (a period of 24 ms): it needs a longer window.
  bass: { strings: BASS_STRINGS, minFrequency: 35, window: 8192 },
};

export const midiToHz = (midi: number, a4 = 440): number => a4 * 2 ** ((midi - 69) / 12);

/** Which open string this sound is closest to (within a few semitones), or null. */
export function nearestString(
  frequency: number,
  strings: readonly TunerString[] = GUITAR_STRINGS,
  a4 = 440,
): { string: number; midi: number; cents: number } | null {
  const exact = 69 + 12 * Math.log2(frequency / a4);
  let best: { string: number; midi: number; cents: number } | null = null;
  for (const s of strings) {
    const cents = (exact - s.midi) * 100;
    if (Math.abs(cents) <= 250 && (!best || Math.abs(cents) < Math.abs(best.cents))) best = { ...s, cents };
  }
  return best;
}

/**
 * Corrects the classic mistake on the lowest strings: a phone microphone
 * barely hears their fundamental, so the second harmonic (one octave up)
 * can win and a low E reads as E3 (which then looks like a sharp D string).
 * If the sound is not near any string but one octave down is near one of
 * the two lowest strings, it is that string.
 */
export function foldOctave(frequency: number, strings: readonly TunerString[] = GUITAR_STRINGS, a4 = 440): number {
  const near = (f: number, list: readonly TunerString[]) => {
    const s = nearestString(f, list, a4);
    return s !== null && Math.abs(s.cents) <= 100;
  };
  if (near(frequency, strings)) return frequency;
  return near(frequency / 2, strings.slice(0, 2)) ? frequency / 2 : frequency;
}

/** Detection range when tuning one chosen string: up to 7 semitones either side (never an octave). */
export function stringRange(midi: number, a4 = 440): { minFrequency: number; maxFrequency: number } {
  const hz = midiToHz(midi, a4);
  return { minFrequency: hz / 2 ** (7 / 12), maxFrequency: hz * 2 ** (7 / 12) };
}

/** Within this many cents the note counts as in tune (green). */
export const IN_TUNE_CENTS = 5;

/**
 * Steadies the reading: the median of the last few frequencies (a pluck
 * starts sharp and noisy). A jump to another note, or a pause, starts over,
 * so the needle follows a new string at once.
 */
export class PitchSmoother {
  private readings: number[] = [];
  private lastTime = 0;

  constructor(
    private readonly size = 5,
    private readonly resetAfterMs = 600,
  ) {}

  push(frequency: number, time: number): number {
    const last = this.readings.at(-1);
    const jump = last !== undefined && Math.abs(12 * Math.log2(frequency / last)) > 0.7;
    if (jump || time - this.lastTime > this.resetAfterMs) this.readings = [];
    this.lastTime = time;
    this.readings.push(frequency);
    if (this.readings.length > this.size) this.readings.shift();
    const sorted = [...this.readings].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  reset(): void {
    this.readings = [];
  }
}
