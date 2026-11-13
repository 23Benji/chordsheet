// "Trova accordo": from the frets pressed on each guitar string to the
// chord's name. Pure functions, unit-tested (the page is features/guitar).
import { Quality } from './chord-diagrams';
import { INTERVALS } from './chord-notes';
import { mod12 } from './transpose';

/** Standard tuning as MIDI notes, low E (6th string) → high e (1st): E2 A2 D3 G3 B3 E4. */
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64];
/** Frets drawn on the neck (the 12th = the octave). */
export const FINDER_FRETS = 12;

/** Per string, low E → high e: the fret pressed (0 = open), or null when the string isn't played. */
export type FretChoice = number | null;

export interface FoundChord {
  /** As guitarists write it: "Am7", "D/F#", "Bbmaj7". */
  name: string;
  root: number;
  quality: Quality;
  /** The lowest note, when it isn't the root ("C/E"). */
  bass: number | null;
  /** All chord tones are played (false: the fifth is left out, as often happens in 7th chords). */
  complete: boolean;
}

/** Roots spelled the way chord charts usually write them (Eb, not D#; F#, not Gb). */
const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pitchName = (pc: number): string => ROOT_NAMES[mod12(pc)];

/** Which chord types to prefer when one shape has several names (Am7 before C6/A). */
const PREFERENCE: Quality[] = [
  '', 'm', '7', 'm7', 'maj7', '5', 'sus4', 'sus2', '6', 'm6', 'add9', '9', '7sus4', 'dim', 'm7b5', 'dim7', 'aug',
];

/** The MIDI notes that sound, low to high (muted strings left out). */
export function soundingNotes(frets: readonly FretChoice[]): number[] {
  return frets.flatMap((fret, string) => (fret === null ? [] : [GUITAR_TUNING[string] + fret]));
}

/**
 * Every name that fits the notes played, best first. A name fits when all
 * the notes played belong to the chord and every chord tone is played,
 * except that the fifth may be missing from a four-note chord, and the bass
 * may be a note outside the chord ("D/C"). The root in the bass and the
 * simpler chord type win; an empty list means no chord we know (or fewer
 * than two different notes).
 */
export function findChords(frets: readonly FretChoice[]): FoundChord[] {
  const notes = soundingNotes(frets);
  const played = new Set(notes.map(mod12));
  if (played.size < 2) return [];
  const bass = mod12(Math.min(...notes));

  const found: { chord: FoundChord; score: number }[] = [];
  for (const root of played) {
    PREFERENCE.forEach((quality, rank) => {
      const tones = new Set(INTERVALS[quality].map((i) => mod12(root + i)));
      const extra = [...played].filter((pc) => !tones.has(pc));
      const missing = [...tones].filter((pc) => !played.has(pc));
      let penalty: number;
      if (!extra.length && !missing.length) penalty = 0;
      else if (!extra.length && missing.length === 1 && missing[0] === mod12(root + 7) && tones.size >= 4) penalty = 1;
      else if (extra.length === 1 && extra[0] === bass && !missing.length) penalty = 2;
      else return;
      const slash = bass !== root;
      const name = pitchName(root) + quality + (slash ? `/${pitchName(bass)}` : '');
      found.push({
        chord: { name, root, quality, bass: slash ? bass : null, complete: penalty !== 1 },
        score: (penalty + (slash ? 1.5 : 0)) * 100 + rank,
      });
    });
  }
  return found.sort((a, b) => a.score - b.score).map((f) => f.chord);
}
