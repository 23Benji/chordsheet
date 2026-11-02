// The personal "Intro" card of a song: which part, chords, rhythm.
import { ChordTextItem, replaceChords, tokenizeChordText } from './chord-text';
import { SongIntro } from './models';

/** Display form: chords split into items so they can be styled and transposed. */
export interface IntroView {
  part: string;
  chords: ChordTextItem[];
  rhythm: string;
  note: string;
}

export function isEmptyIntro(intro: SongIntro | undefined): boolean {
  return !intro || ![intro.part, intro.chords, intro.rhythm, intro.note].some((v) => v?.trim());
}

/** Rewrites every chord in a free text ("G D/F# Em x2") with `map`, keeping the rest. */
export function mapChordText(text: string, map: (chord: string) => string): string {
  return replaceChords(text, map);
}

export function introView(intro: SongIntro | undefined, mapChord: (chord: string) => string): IntroView | null {
  if (!intro || isEmptyIntro(intro)) return null;
  const chords = (tokenizeChordText(intro.chords ?? '', true) ?? []).map((i) =>
    'chord' in i ? { chord: mapChord(i.chord) } : i,
  );
  return { part: intro.part?.trim() ?? '', chords, rhythm: intro.rhythm?.trim() ?? '', note: intro.note?.trim() ?? '' };
}

/** Cleans what the user typed; undefined when everything is empty (= no intro). */
export function cleanIntro(intro: SongIntro): SongIntro | undefined {
  const clean: SongIntro = {};
  for (const key of ['part', 'chords', 'rhythm', 'note'] as const) {
    const value = intro[key]?.trim();
    if (value) clean[key] = value;
  }
  return isEmptyIntro(clean) ? undefined : clean;
}
