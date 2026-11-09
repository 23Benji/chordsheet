// The notes of a chord, for the piano and bass diagrams (the guitar has its
// own fingerings in chord-diagrams.ts). Pure functions, unit-tested.
import { Quality, chordQuality } from './chord-diagrams';
import { mod12, noteName, parseChord } from './transpose';

/** Semitones above the root for each chord type (14 = the ninth, an octave + a tone). */
export const INTERVALS: Record<Quality, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], '5': [0, 7],
};

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/** How many letters above the root each interval is written (a third is always two letters up: C → E or Eb). */
const LETTER_STEP: Record<number, number> = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6, 14: 1 };

export interface ChordNotes {
  name: string;
  /** Pitch class of the root (C = 0 … B = 11). */
  root: number;
  /** Semitones above the root, lowest first. */
  intervals: number[];
  /** The notes spelled as musicians write them: Bb7 → Bb D F Ab (not A#). */
  notes: string[];
  /** Slash chords ("D/F#"): the bass note. */
  bass: { pc: number; name: string } | null;
}

function spell(letter: number, rootPc: number, interval: number): string {
  const l = (letter + (LETTER_STEP[interval] ?? 0)) % 7;
  const pc = mod12(rootPc + interval);
  let accidental = mod12(pc - LETTER_PC[l]);
  if (accidental > 6) accidental -= 12;
  if (Math.abs(accidental) > 1) return noteName(pc, accidental < 0); // never "Bbb" or "E##"
  return LETTERS[l] + (accidental === 1 ? '#' : accidental === -1 ? 'b' : '');
}

/** Notes of a chord name ("F#m7", "Bb/D"); null for chords we don't know. */
export function chordNotes(name: string): ChordNotes | null {
  const parsed = parseChord(name);
  if (!parsed) return null;
  const quality = chordQuality(parsed.suffix);
  if (quality === undefined) return null;
  const letter = LETTERS.indexOf(name.trim()[0]);
  const intervals = INTERVALS[quality];
  const slash = name.indexOf('/');
  return {
    name,
    root: parsed.root,
    intervals,
    notes: intervals.map((i) => spell(letter, parsed.root, i)),
    bass: parsed.bass === null ? null : { pc: parsed.bass, name: name.slice(slash + 1).trim() },
  };
}

// ── Piano ──────────────────────────────────────────────────────────────────

export interface PianoVoicing {
  /** Keys to press, in semitones from C of the lowest octave shown (0 = C, 13 = C# an octave up). */
  keys: number[];
  /** The note name of each key (same order). */
  names: string[];
  /** Which key is the root. */
  rootKey: number;
  /** 0 = root position, 1 = first inversion (third at the bottom) … */
  inversion: number;
}

/**
 * Root position first, then the inversions (the lowest note moves up an
 * octave each time). All voicings start in the lowest octave shown.
 */
export function pianoVoicings(chord: ChordNotes): PianoVoicing[] {
  const n = chord.intervals.length;
  const out: PianoVoicing[] = [];
  for (let inversion = 0; inversion < n; inversion++) {
    const order = [...chord.intervals.keys()].map((k) => (k + inversion) % n);
    let keys = order.map((k, i) => chord.root + chord.intervals[k] + (k < inversion && i >= n - inversion ? 12 : 0));
    const low = Math.min(...keys);
    if (low >= 12) keys = keys.map((k) => k - 12);
    out.push({ keys, names: order.map((k) => chord.notes[k]), rootKey: keys[order.indexOf(0)], inversion });
  }
  return out;
}

const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlackKey = (key: number) => BLACK.has(mod12(key));

/** The keys to draw around a voicing: from a white key at/below the lowest note, at least `minWhite` white keys. */
export function keyboardRange(keys: number[], minWhite = 8): { from: number; to: number } {
  let from = Math.min(...keys);
  while (isBlackKey(from)) from--;
  let to = Math.max(...keys);
  while (isBlackKey(to)) to++;
  const whites = () => Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((k) => !isBlackKey(k)).length;
  while (whites() < minWhite) {
    to++;
    while (isBlackKey(to)) to++;
  }
  return { from, to };
}

// ── Bass ───────────────────────────────────────────────────────────────────

/** Open strings of a 4-string bass, low to high: E A D G. */
export const BASS_STRINGS = [4, 9, 2, 7];

export interface BassDot {
  string: number; // 0 = low E … 3 = G
  fret: number;
  role: 'root' | 'fifth' | 'octave';
}

export interface BassPosition {
  dots: BassDot[];
  /** The note played as the root (the bass note of a slash chord). */
  note: string;
  baseFret: number;
}

/**
 * Where to play the chord's root on the bass, with the fifth and the octave
 * nearby (the classic root–fifth–octave pattern). One position per string the
 * root can start on (E, A, D), lowest first. Slash chords: the bass note,
 * with its octave.
 */
export function bassPositions(chord: ChordNotes): BassPosition[] {
  const rootPc = chord.bass?.pc ?? chord.root;
  const note = chord.bass?.name ?? chord.notes[0];
  const fifth = chord.bass ? null : (chord.intervals.find((i) => i >= 6 && i <= 8) ?? null);
  const out: BassPosition[] = [];
  for (let s = 0; s < 3; s++) {
    const fret = mod12(rootPc - BASS_STRINGS[s]);
    const dots: BassDot[] = [{ string: s, fret, role: 'root' }];
    // One string up is 5 semitones higher: the fifth (7) is 2 frets up, a b5 1 fret, a #5 3 frets.
    if (fifth !== null) dots.push({ string: s + 1, fret: fret + fifth - 5, role: 'fifth' });
    // Two strings up is 10 semitones higher: the octave is 2 frets up.
    if (s + 2 <= 3) dots.push({ string: s + 2, fret: fret + 2, role: 'octave' });
    const played = dots.map((d) => d.fret).filter((f) => f > 0);
    const top = Math.max(0, ...played);
    out.push({ dots, note, baseFret: top <= 4 ? 1 : Math.min(...played) });
  }
  return out.sort((a, b) => Math.max(...a.dots.map((d) => d.fret)) - Math.max(...b.dots.map((d) => d.fret)));
}
