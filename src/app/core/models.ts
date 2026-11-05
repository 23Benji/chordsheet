// Data model stored in IndexedDB (SPEC §4).

export interface Song {
  id: string; // uuid
  number: number | null; // from {meta: numero}
  suffix: string; // 'b', 'c' … for alternative versions, '' otherwise
  title: string;
  chordpro: string; // the full source text — edits change this
  key?: string; // from {key} or detected (first chord) — display only
  capo?: number;
  tempo?: number;
  tags: string[];
  source: 'bundled' | 'imported' | 'created';
  createdAt: number;
  updatedAt: number;
}

export interface SongPrefs {
  songId: string;
  transpose: number; // semitones, -11..+11
  capo: number; // 0..11 (display shape chords: sounding = shape + capo)
  preferSharps?: boolean;
  fontScale?: number;
  columns?: 1 | 2;
  autoscrollSpeed?: number;
  /** "Promemoria": free song-level note shown at the top of the song. */
  memo?: string;
  /** How the guitarist starts the song (shown at the top as "Intro"). */
  intro?: SongIntro;
}

export interface SongIntro {
  /** Which part is played as the intro, e.g. "Ritornello" or "ultime due righe del ritornello". */
  part?: string;
  /** Chords in the song's original key, e.g. "G D Em C" (displayed transposed). */
  chords?: string;
  /** Strumming / rhythm, e.g. "↓ ↓↑ ↑↓↑" or "arpeggio". */
  rhythm?: string;
  note?: string;
}

export type AnnotationType = 'note' | 'highlight' | 'tab' | 'chord';

export interface LineAnchor {
  sectionIndex: number;
  lineIndex: number;
  textHash: string;
  snippet: string;
  occurrence: number;
}

export type AnnotationColor = 'amber' | 'coral' | 'sage' | 'sky';

export interface Annotation {
  id: string;
  songId: string;
  anchor: LineAnchor;
  type: AnnotationType;
  /** Note text, tab block (monospace), or the personal chord ("Cadd9"). */
  text: string;
  color?: AnnotationColor;
  /** Tab/solo heading, e.g. "Assolo intro". */
  title?: string;
  /** Personal chord: which chord of the line it replaces (0 = first). */
  chordIndex?: number;
  /** Set when re-anchoring found no matching line ("da ricollegare"). */
  orphaned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SetlistItem {
  /** Stable id of the entry (the same song can appear twice). */
  id: string;
  songId: string;
  transpose?: number;
  note?: string;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: number;
}

/**
 * A folder ("cartella") groups songs, e.g. "Natale" or "Lode". A song can be in
 * several folders. Membership is stored on the folder (like a setlist's items),
 * so the song itself — its text — never changes when it is filed.
 */
export interface Folder {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  fontScale: number;
  chordStyle: 'above' | 'inline';
  showChordDiagrams: boolean;
  keyboardMap: Record<string, string>;
  /** "Mostra le mie note": show the personal layer in the song view. */
  showNotes: boolean;
  /** Default spelling after transposing (a song's own preferSharps wins). */
  accidentals?: 'auto' | 'sharps' | 'flats';
  /** "Parti ripetute": identical sections in a row shown once with "×2" (default: all written out). */
  collapseRepeats?: boolean;
}

/** preferSharps for keyView(): the song's own choice, else the global setting. */
export function preferSharpsFor(song: boolean | undefined, global: Settings['accidentals']): boolean | undefined {
  if (song !== undefined) return song;
  return global === 'sharps' ? true : global === 'flats' ? false : undefined;
}
