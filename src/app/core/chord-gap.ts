// The "chord gap": a lyric line without chords normally sits right under the
// line above (no empty chord row). Inside a passage with chords that looks
// glued, so such a line keeps the chord row's space:
//   - automatically when it comes right after a line with chords (or after
//     other chordless lines that do) in the same section;
//   - or by choice, line by line, with `{x_gap}` / `{x_glue}` written on the
//     line before it. ChordPro tells other apps to ignore directives that
//     start with "x_", so the song stays portable.
// Shared by the song view (chordpro.ts) and the editor, so both agree.

export type ChordSpace = 'gap' | 'glue';

/** `{x_gap}` → 'gap', `{x_glue}` → 'glue' (directive names, lower-case). */
export const CHORD_SPACE_DIRECTIVES: Readonly<Record<string, ChordSpace>> = { x_gap: 'gap', x_glue: 'glue' };

/** What the rule needs to know about each line of a section. */
export interface GapLine {
  /** A sung line (not a note, a directive or a line of chords written as text). */
  lyrics: boolean;
  /** Has chords of its own. */
  chorded: boolean;
  /** No text at all. */
  blank: boolean;
  /** The choice written in the song, if any. */
  space?: ChordSpace;
}

export interface GapState {
  /** What the rule gives without a choice. */
  auto: boolean;
  /** What is shown: the choice if there is one, otherwise `auto`. */
  on: boolean;
}

/**
 * For each line of a section: null when the gap doesn't apply (a line with
 * chords, a note, or any line in a section without chords — verse 2, 3 …
 * written without chords stay compact), otherwise whether it gets the gap.
 */
export function chordGaps(lines: readonly GapLine[]): (GapState | null)[] {
  const sectionHasChords = lines.some((l) => l.lyrics && l.chorded);
  let afterChords = false;
  return lines.map((line) => {
    if (!line.lyrics) {
      afterChords = false; // a note or a chord line ends the run
      return null;
    }
    if (line.chorded) {
      afterChords = true;
      return null;
    }
    if (line.blank || !sectionHasChords) return null;
    const auto = afterChords;
    return { auto, on: line.space ? line.space === 'gap' : auto };
  });
}

/** The choice to store after the strip is tapped: none when it matches the rule again. */
export function toggledSpace(state: GapState): ChordSpace | undefined {
  const on = !state.on;
  return on === state.auto ? undefined : on ? 'gap' : 'glue';
}
