// Guitar fingerings for chord diagrams. Instead of a huge table, chords are
// built from a few shapes:
//   - open shapes for the classic first-position chords (C, D, G families…)
//   - the movable "E shape" (root on the 6th string) and "A shape" (root on
//     the 5th string) barre chords, which work for every root
// and the shape with the lowest frets wins.
import { mod12, parseChord } from './transpose';

export type Quality =
  | '' | 'm' | '7' | 'm7' | 'maj7' | 'sus2' | 'sus4' | '7sus4' | 'add9'
  | '6' | 'm6' | '9' | 'dim' | 'dim7' | 'm7b5' | 'aug' | '5';

const QUALITIES: Record<string, Quality> = {
  '': '', maj: '', M: '',
  m: 'm', min: 'm', '-': 'm',
  '7': '7', dom7: '7',
  m7: 'm7', min7: 'm7', '-7': 'm7',
  maj7: 'maj7', M7: 'maj7', '7M': 'maj7', 'Δ': 'maj7',
  sus4: 'sus4', sus: 'sus4', '4': 'sus4',
  sus2: 'sus2', '2': 'sus2',
  '7sus4': '7sus4', '7sus': '7sus4',
  add9: 'add9', add2: 'add9',
  '6': '6', m6: 'm6', '9': '9',
  dim: 'dim', '°': 'dim', o: 'dim', dim7: 'dim7', '°7': 'dim7',
  m7b5: 'm7b5', 'ø': 'm7b5', aug: 'aug', '+': 'aug', '5': '5',
};

// Frets from the low E string (6th) to the high e (1st); -1 = not played.
// Offsets relative to the barre fret.
const E_SHAPE: Partial<Record<Quality, number[]>> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0], sus4: [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0], add9: [0, 2, 2, 1, 0, 2],
  '6': [0, 2, 2, 1, 2, 0], m6: [0, 2, 2, 0, 2, 0], '9': [0, 2, 0, 1, 0, 2], aug: [0, 3, 2, 1, 1, 0],
  '5': [0, 2, 2, -1, -1, -1],
};
const A_SHAPE: Partial<Record<Quality, number[]>> = {
  '': [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0],
  maj7: [-1, 0, 2, 1, 2, 0], sus4: [-1, 0, 2, 2, 3, 0], sus2: [-1, 0, 2, 2, 0, 0], '7sus4': [-1, 0, 2, 0, 3, 0],
  add9: [-1, 0, 2, 4, 2, 0], '6': [-1, 0, 2, 2, 2, 2], m6: [-1, 0, 2, 2, 1, 2], '9': [-1, 0, 2, 4, 2, 3],
  dim: [-1, 0, 1, 2, 1, -1], dim7: [-1, 0, 1, 2, 1, 2], m7b5: [-1, 0, 1, 0, 1, -1], aug: [-1, 0, 3, 2, 2, 1],
  '5': [-1, 0, 2, 2, -1, -1],
};
/** Root on the 4th string (open D shape moved up). */
const D_SHAPE: Partial<Record<Quality, number[]>> = {
  '': [-1, -1, 0, 2, 3, 2], m: [-1, -1, 0, 2, 3, 1], '7': [-1, -1, 0, 2, 1, 2], m7: [-1, -1, 0, 2, 1, 1],
  maj7: [-1, -1, 0, 2, 2, 2], sus4: [-1, -1, 0, 2, 3, 3], sus2: [-1, -1, 0, 2, 3, 0], '6': [-1, -1, 0, 2, 0, 2],
};
/** Root on the 5th string, open C shape moved up (barre on strings 3–1). */
const C_SHAPE: Partial<Record<Quality, number[]>> = {
  '': [-1, 3, 2, 0, 1, 0], '7': [-1, 3, 2, 3, 1, 0], maj7: [-1, 3, 2, 0, 0, 0], add9: [-1, 3, 2, 0, 3, 0],
};
const MAX_FRET = 15;

/** First-position shapes guitarists actually play, by root pitch class + quality. */
const OPEN: Record<string, number[]> = {
  '0:': [-1, 3, 2, 0, 1, 0], '0:7': [-1, 3, 2, 3, 1, 0], '0:maj7': [-1, 3, 2, 0, 0, 0], '0:add9': [-1, 3, 2, 0, 3, 0],
  '0:sus4': [-1, 3, 3, 0, 1, 1], '0:sus2': [-1, 3, 0, 0, 1, 3], '0:6': [-1, 3, 2, 2, 1, 0],
  '2:': [-1, -1, 0, 2, 3, 2], '2:m': [-1, -1, 0, 2, 3, 1], '2:7': [-1, -1, 0, 2, 1, 2], '2:m7': [-1, -1, 0, 2, 1, 1],
  '2:maj7': [-1, -1, 0, 2, 2, 2], '2:sus4': [-1, -1, 0, 2, 3, 3], '2:sus2': [-1, -1, 0, 2, 3, 0], '2:6': [-1, -1, 0, 2, 0, 2],
  '2:add9': [-1, -1, 0, 2, 3, 0], '2:7sus4': [-1, -1, 0, 2, 1, 3],
  '7:': [3, 2, 0, 0, 0, 3], '7:7': [3, 2, 0, 0, 0, 1], '7:maj7': [3, 2, 0, 0, 0, 2], '7:6': [3, 2, 0, 0, 0, 0],
  '7:sus4': [3, 3, 0, 0, 1, 3], '7:add9': [3, 0, 0, 2, 0, 3], '7:sus2': [3, 0, 0, 2, 3, 3],
  '11:7': [-1, 2, 1, 2, 0, 2], '5:maj7': [-1, -1, 3, 2, 1, 0], '4:sus2': [0, 2, 4, 4, 0, 0],
};

/** "m", "min", "-" → 'm' …; undefined for chord types we don't know (e.g. "13#11"). */
export function chordQuality(suffix: string): Quality | undefined {
  return QUALITIES[suffix];
}

export interface ChordShape {
  name: string;
  /** Fret per string, low E → high e; -1 not played, 0 open. */
  frets: number[];
  /** First fret drawn at the top of the diagram (1 = next to the nut). */
  baseFret: number;
  /** Index finger across several strings (barre chords). */
  barre: { fret: number; fromString: number; toString: number } | null;
  /** Slash chords ("D/F#"): the bass note to play. */
  bass: string | null;
}

interface Candidate {
  frets: number[];
  barre: ChordShape['barre'];
  open: boolean;
}

/** A movable shape played `fret` frets higher; the index finger covers the strings at offset 0. */
function movable(offsets: number[], fret: number, barreFrom: number, barreTo: number): Candidate {
  const frets = offsets.map((o) => (o < 0 ? -1 : o + fret));
  return { frets, barre: fret > 0 && barreTo > barreFrom ? { fret, fromString: barreFrom, toString: barreTo } : null, open: false };
}

function toShape(name: string, c: Candidate, bass: string | null): ChordShape {
  const played = c.frets.filter((f) => f > 0);
  const top = Math.max(0, ...played);
  const baseFret = top <= 4 ? 1 : Math.min(...played);
  return { name, frets: c.frets, baseFret, barre: c.barre, bass };
}

/**
 * Every fingering we know for a chord, easiest first: open shapes, then the
 * movable shapes (E, A, D, C) from the lowest position. E.g. E → 022100,
 * x79997 (A shape), xx2454 (D shape), x76454 (C-shape family when available).
 */
export function chordShapes(name: string): ChordShape[] {
  const parsed = parseChord(name);
  if (!parsed) return [];
  const quality = QUALITIES[parsed.suffix];
  if (quality === undefined) return [];
  const root = parsed.root;
  const bass = name.includes('/') ? name.slice(name.indexOf('/') + 1) : null;

  const candidates: Candidate[] = [];
  const open = OPEN[`${root}:${quality}`];
  if (open) candidates.push({ frets: open, barre: null, open: true });
  const e = E_SHAPE[quality];
  const a = A_SHAPE[quality];
  const d = D_SHAPE[quality];
  const c = C_SHAPE[quality];
  if (e) candidates.push(movable(e, mod12(root - 4), 0, 5));
  if (a) candidates.push(movable(a, mod12(root - 9), 1, 5));
  if (d) candidates.push(movable(d, mod12(root - 2), 2, 2));
  if (c) candidates.push(movable(c, mod12(root - 0), 3, 5));
  // The same shapes one octave up are useful when the low one is open (E → 12th fret is too high, A → x 12 …).
  if (e && mod12(root - 4) === 0) candidates.push(movable(e, 12, 0, 5));

  // Easiest first: open shapes, then by highest fret used.
  const score = (x: Candidate) => Math.max(...x.frets) - (x.open ? 3 : 0);
  const seen = new Set<string>();
  return candidates
    .filter((x) => Math.max(...x.frets) <= MAX_FRET && x.frets.some((f) => f >= 0))
    .sort((x, y) => score(x) - score(y))
    .filter((x) => {
      const key = x.frets.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((x) => toShape(name, x, bass));
}

/** The easiest fingering for a chord name, or null for chords we don't know (e.g. "C13#11"). */
export function chordShape(name: string): ChordShape | null {
  return chordShapes(name)[0] ?? null;
}
