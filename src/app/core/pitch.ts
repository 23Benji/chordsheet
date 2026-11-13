// "Accordatore": which note the microphone hears, and how far it is from the
// nearest guitar string. Pure functions, unit-tested (the page is
// features/guitar/tuner-page).

import { GUITAR_TUNING } from './chord-finder';

export interface Pitch {
  /** Hertz. */
  frequency: number;
  /** 0…1: how clearly periodic the sound is (noise and talking score low). */
  clarity: number;
}

/** Lowest / highest frequencies looked for: below a drop-D low string, above the high e's 5th fret. */
const MIN_HZ = 60;
const MAX_HZ = 700;
/** Under this loudness (RMS) the room is just quiet: no note. */
export const SILENCE_RMS = 0.01;

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * The pitch of a short piece of sound (McLeod's "normalised square
 * difference"): compare the sound with itself shifted by every possible
 * period; the first shift where it lines up almost perfectly is the period.
 * Taking the first good peak (not the highest) avoids reading a note an
 * octave too low, the usual mistake of simple tuners.
 */
export function detectPitch(samples: Float32Array, sampleRate: number): Pitch | null {
  if (rms(samples) < SILENCE_RMS) return null;
  const n = samples.length;
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), Math.floor(n / 2));
  if (maxLag <= minLag + 2) return null;

  const nsdf = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let acf = 0;
    let energy = 0;
    for (let i = 0; i < n - lag; i++) {
      const a = samples[i];
      const b = samples[i + lag];
      acf += a * b;
      energy += a * a + b * b;
    }
    nsdf[lag] = energy > 0 ? (2 * acf) / energy : 0;
  }

  // Peaks between zero crossings, after the first time the curve goes below zero.
  // The highest point of each positive hump is a candidate period.
  const peaks: number[] = [];
  let lag = 1;
  while (lag <= maxLag && nsdf[lag] > 0) lag++;
  let peak = -1;
  for (; lag <= maxLag; lag++) {
    if (nsdf[lag] > 0) {
      if (peak < 0 || nsdf[lag] > nsdf[peak]) peak = lag;
    } else if (peak >= 0) {
      peaks.push(peak);
      peak = -1;
    }
  }
  if (peak >= 0) peaks.push(peak);
  const candidates = peaks.filter((p) => p >= minLag);
  if (!candidates.length) return null;
  const best = Math.max(...candidates.map((p) => nsdf[p]));
  const chosen = candidates.find((p) => nsdf[p] >= 0.9 * best)!;

  // Parabola through the peak and its neighbours: a period between two samples.
  const [l, c, r] = [nsdf[chosen - 1], nsdf[chosen], nsdf[chosen + 1]];
  const denom = l - 2 * c + r;
  const shift = denom === 0 ? 0 : (0.5 * (l - r)) / denom;
  const period = chosen + Math.max(-0.5, Math.min(0.5, shift));
  const frequency = sampleRate / period;
  if (frequency < MIN_HZ || frequency > MAX_HZ) return null;
  return { frequency, clarity: Math.max(0, Math.min(1, c)) };
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

export interface StringReading {
  /** 0 = low E … 5 = high e. */
  string: number;
  /** How far from the string's note: negative = too low (tighten), positive = too high (loosen). */
  cents: number;
}

/** The standard-tuning string nearest to what's heard, and how far off it is. */
export function nearestString(frequency: number, tuning: readonly number[] = GUITAR_TUNING): StringReading {
  const midi = hzToMidi(frequency);
  let string = 0;
  for (let s = 1; s < tuning.length; s++) if (Math.abs(midi - tuning[s]) < Math.abs(midi - tuning[string])) string = s;
  return { string, cents: (midi - tuning[string]) * 100 };
}

/** Within this many cents a string counts as in tune (the ear hears about ±5). */
export const IN_TUNE_CENTS = 5;
