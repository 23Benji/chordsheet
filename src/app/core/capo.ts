// "Capo consigliato": which capo position lets a guitarist play the song with
// the easiest shapes, without changing how it sounds. Pure logic.
//
// Idea: every chord gets a difficulty score for the *shape* the left hand
// makes (open G, C, D, Em, Am = easy; F, Bm, Bb… = barre = hard). With the
// capo on fret n each shape is n semitones lower than the sound. We try
// n = 0…7 and add up the scores of all chords of the song (a chord that comes
// back often counts more). The lowest total wins; on a tie, the lower fret.

import { Sheet } from './chordpro';
import { mod12, noteName, parseChord } from './transpose';

/** Highest capo we suggest: beyond the 7th fret the neck gets cramped. */
export const MAX_CAPO = 7;

type Quality = 'major' | 'minor' | 'seventh' | 'other';

// Difficulty by root (pitch class 0 = C … 11 = B) and quality:
// 0 = open and easy, 1.5 = the common small barres (F, Bm) every player
// learns early, 3 = full barre.
const MAJOR = [0, 3, 0, 3, 0, 1.5, 3, 0, 3, 0, 3, 3]; // C D E G A open · F small barre
const MINOR = [3, 3, 0, 3, 0, 3, 3, 3, 3, 0, 3, 1.5]; // Dm Em Am open · Bm small barre
const SEVENTH = [0, 3, 0, 3, 0, 2, 3, 0, 3, 0, 3, 0]; // C7 D7 E7 G7 A7 B7 open

function quality(suffix: string): Quality {
  const s = suffix.replace(/^\(|\)$/g, '');
  if (/^(dim|°|aug|\+)/.test(s)) return 'other';
  if (/^(m(?!aj)|min|-)/.test(s)) return 'minor';
  if (/^7/.test(s)) return 'seventh';
  return 'major'; // "", maj7, sus2/4, add9, 6 … use the major shape's hand position
}

/** How hard the shape of one chord is (unknown text → 0, it isn't a chord). */
export function shapeDifficulty(chord: string): number {
  const parsed = parseChord(chord);
  if (!parsed) return 0;
  const q = quality(parsed.suffix);
  const base = q === 'minor' ? MINOR[parsed.root] : q === 'seventh' ? SEVENTH[parsed.root] : q === 'major' ? MAJOR[parsed.root] : 3;
  // A slash bass (D/F#, G/B …) asks a little more of the hand.
  return base + (parsed.bass !== null && parsed.bass !== parsed.root ? 0.5 : 0);
}

/** All chords of a song as written (main chords only, not the second key), with repeats. */
export function sheetChords(sheet: Sheet): string[] {
  const chords: string[] = [];
  for (const section of sheet.sections) {
    for (const line of section.lines) {
      if (line.kind === 'chords') {
        for (const item of line.items) if ('chord' in item) chords.push(item.chord);
      } else if (line.kind === 'lyrics') {
        for (const word of line.words) for (const s of word.segments) if (s.chord) chords.push(s.chord);
      }
    }
  }
  return chords;
}

export interface CapoOption {
  capo: number;
  /** Average difficulty per chord (0 = all open chords), plus a little per fret. */
  score: number;
}

/** Each fret up the neck costs a bit: cramped frets, more retuning by ear. */
const FRET_COST = 0.1;

/**
 * Average shape difficulty of the song for each capo 0…MAX_CAPO.
 * `chords` are the chords as they *sound* (after transposing).
 */
export function capoOptions(chords: readonly string[]): CapoOption[] {
  const parsed = chords.map(parseChord).filter((c) => c !== null);
  const options: CapoOption[] = [];
  for (let capo = 0; capo <= MAX_CAPO; capo++) {
    if (!parsed.length) {
      options.push({ capo, score: 0 });
      continue;
    }
    let total = 0;
    for (const c of parsed) {
      const shape = noteName(c.root - capo, false) + c.suffix + (c.bass === null ? '' : '/' + noteName(mod12(c.bass - capo), false));
      total += shapeDifficulty(shape);
    }
    options.push({ capo, score: total / parsed.length + capo * FRET_COST });
  }
  return options;
}

export interface CapoSuggestion {
  capo: number;
  /** Shapes are played as if the song were in this key (e.g. "G"). */
  shapeKey: string | null;
}

/**
 * Suggest only when the song is really uncomfortable as it is (on average
 * more than one barre-ish chord in three) and the capo makes it clearly
 * easier — a song in C with one F is fine without capo.
 */
const HARD = 1;
const MIN_GAIN = 0.6;

/**
 * The capo to suggest, or null when the current one is already (about) the
 * easiest. `soundingKey` is the key the song sounds in, to name the shapes.
 */
export function suggestCapo(chords: readonly string[], currentCapo: number, soundingKey: string | null): CapoSuggestion | null {
  const options = capoOptions(chords);
  if (!chords.length) return null;
  const best = options.reduce((a, b) => (b.score < a.score - 1e-9 ? b : a));
  const current = options.find((o) => o.capo === currentCapo)?.score ?? Infinity;
  if (best.capo === currentCapo || current < HARD || current - best.score < MIN_GAIN) return null;
  return { capo: best.capo, shapeKey: shapeKeyFor(soundingKey, best.capo) };
}

/** "Bb" with capo 3 → "G"; minor keys stay minor ("Bm" capo 2 → "Am"). */
export function shapeKeyFor(soundingKey: string | null, capo: number): string | null {
  const parsed = soundingKey ? parseChord(soundingKey) : null;
  if (!parsed) return null;
  const minor = quality(parsed.suffix) === 'minor';
  // Shapes are named with sharps/naturals: guitarists say "forme in G", "in Am".
  return noteName(parsed.root - capo, false) + (minor ? 'm' : '');
}
