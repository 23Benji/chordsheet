// Metronome maths (the sound itself is in ui/metronome.ts, with Web Audio).

export const BPM_MIN = 30;
export const BPM_MAX = 260;
export const BPM_DEFAULT = 90;
/** Taps further apart than this start a new measurement. */
const TAP_RESET_MS = 2000;
const TAP_KEEP = 5;

export function clampBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

/**
 * Tap tempo: give the previous tap times and the new one; returns the taps
 * to keep and the tempo (average of the last intervals), null until 2 taps.
 */
export function tapTempo(previous: readonly number[], now: number): { taps: number[]; bpm: number | null } {
  const last = previous[previous.length - 1];
  const taps = last !== undefined && now - last < TAP_RESET_MS ? [...previous, now].slice(-TAP_KEEP) : [now];
  if (taps.length < 2) return { taps, bpm: null };
  const average = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  return { taps, bpm: clampBpm(60000 / average) };
}

/** Seconds between two beats. */
export function beatInterval(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/**
 * Look-ahead scheduling: the beats to schedule from `next` (time of the next
 * beat) up to `until`. Scheduling slightly ahead on the audio clock keeps the
 * click precise even if the JavaScript timer is late.
 */
export function beatsUntil(next: number, until: number, bpm: number): number[] {
  const step = beatInterval(bpm);
  const beats: number[] = [];
  for (let t = next; t < until; t += step) beats.push(t);
  return beats;
}

/** Time signatures offered: beats per bar (6 = 6/8, felt in two). */
export const METERS = [2, 3, 4, 6] as const;
export type Meter = (typeof METERS)[number];

/**
 * How strong beat `beat` (0-based) of a bar is: 'strong' on the first beat,
 * 'medium' on the second half of 6/8 (beat 4 of 6), 'weak' otherwise.
 */
export function beatAccent(beat: number, meter: Meter): 'strong' | 'medium' | 'weak' {
  if (beat === 0) return 'strong';
  if (meter === 6 && beat === 3) return 'medium';
  return 'weak';
}

/**
 * The Italian tempo marking for a BPM (Largo … Prestissimo), from a table of
 * `{ upTo, name }` sorted by `upTo` (the names live in i18n/it.ts).
 */
export function tempoMarking(bpm: number, table: readonly { upTo: number; name: string }[]): string {
  return (table.find((m) => bpm < m.upTo) ?? table[table.length - 1]).name;
}
