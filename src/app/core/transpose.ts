// Chord transposition, capo maths and accidental spelling.
//
// We parse chords ourselves instead of using chordsheetjs' Chord.transpose():
// chordsheetjs keeps the original accidental direction and produces spellings
// like "E#m" or "B#" — unreadable on stage. Here every note is spelled from
// a sharp or flat table chosen from the *target* key (see DECISIONS.md).

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Conventional key names (the spelling a musician would write). */
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
/** Keys whose signature uses flats: chords in them are spelled with flats. */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

const CHORD_RE = /^([A-G])([#b]?)([^/]*?)(?:\/([A-G])([#b]?))?$/;

export interface ParsedChord {
  root: number; // pitch class 0..11
  suffix: string; // "m7", "sus4", "" …
  bass: number | null; // pitch class of a slash bass note
}

export function parseChord(chord: string): ParsedChord | null {
  const match = CHORD_RE.exec(chord.trim());
  if (!match) return null;
  return {
    root: pitchClass(match[1], match[2]),
    suffix: match[3],
    bass: match[4] ? pitchClass(match[4], match[5]) : null,
  };
}

function pitchClass(letter: string, accidental: string): number {
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return mod12(NATURAL_PC[letter] + shift);
}

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function noteName(pc: number, useFlats: boolean): string {
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

/**
 * Transposes one chord by `semitones`. Non-chords (e.g. "N.C.", "x2") are
 * returned unchanged. Slash chords transpose both root and bass.
 */
export function transposeChord(chord: string, semitones: number, useFlats: boolean): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const root = noteName(parsed.root + semitones, useFlats);
  const bass = parsed.bass === null ? '' : '/' + noteName(parsed.bass + semitones, useFlats);
  return root + parsed.suffix + bass;
}

function isMinorSuffix(suffix: string): boolean {
  return /^(m|min|-)(?!aj)/.test(suffix);
}

/** Key name ("G", "F#m") for a chord or key string, or null if unparseable. */
export function keyOf(chordOrKey: string): string | null {
  const parsed = parseChord(chordOrKey);
  if (!parsed) return null;
  return (isMinorSuffix(parsed.suffix) ? MINOR_KEYS : MAJOR_KEYS)[parsed.root];
}

/** Transposes a key and returns its conventional spelling ("E" +3 → "G"). */
export function transposeKey(key: string, semitones: number): string | null {
  const parsed = parseChord(key);
  if (!parsed) return null;
  return (isMinorSuffix(parsed.suffix) ? MINOR_KEYS : MAJOR_KEYS)[mod12(parsed.root + semitones)];
}

export function keyUsesFlats(key: string | null | undefined): boolean {
  return key ? FLAT_KEYS.has(keyOf(key) ?? '') : false;
}

/** First chord in ChordPro source → key, used when there is no {key}. */
export function detectKey(chordpro: string): string | null {
  for (const match of chordpro.matchAll(/\[([^\]]+)\]/g)) {
    const key = keyOf(match[1]);
    if (key) return key;
  }
  return null;
}

export interface KeyView {
  /** Key as written / detected in the song. */
  originalKey: string | null;
  /** Key that actually sounds (original + transpose). */
  soundingKey: string | null;
  /** Key of the chord shapes displayed (sounding − capo). */
  shapeKey: string | null;
  /** Semitones applied to every displayed chord. */
  shift: number;
  /** Maps a chord as written in the source to the chord to display. */
  mapChord: (chord: string) => string;
}

/**
 * Builds everything the song view needs for a given transpose/capo setting.
 * Capo: the guitarist plays shapes `capo` semitones lower than what sounds.
 */
export function keyView(
  originalKey: string | null,
  transpose: number,
  capo: number,
  preferSharps?: boolean,
): KeyView {
  const shift = mod12(transpose - capo);
  const soundingKey = originalKey ? transposeKey(originalKey, transpose) : null;
  const shapeKey = originalKey ? transposeKey(originalKey, transpose - capo) : null;
  const useFlats = preferSharps === undefined ? keyUsesFlats(shapeKey) : !preferSharps;
  const untouched = shift === 0 && preferSharps === undefined;
  return {
    originalKey,
    soundingKey,
    shapeKey,
    shift,
    mapChord: untouched ? (chord) => chord : (chord) => transposeChord(chord, shift, useFlats),
  };
}

/** Clamps a transpose value into -11..+11. */
export function clampTranspose(value: number): number {
  return Math.max(-11, Math.min(11, value));
}
