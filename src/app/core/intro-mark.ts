// The intro mark: lines of the song that are also its intro ("the last two
// lines of the chorus") carry `{x_intro}` on the line before them. It lives in
// the song text, so it is always shared with the song (Benji, 2026-11-10),
// and the song view draws those lines with a green bracket and "INTRO".
import { lineText } from './anchoring';
import { INTRO_DIRECTIVE, SheetLine, parseChordPro } from './chordpro';
import { normalize } from './search';

const MARK = `{${INTRO_DIRECTIVE}}`;
/** Directives that belong to the line right after them. */
const LINE_DIRECTIVE = /^\s*\{\s*(x_intro|x_gap|x_glue)\s*\}\s*$/i;
const INTRO_LINE = /^\s*\{\s*x_intro\s*\}\s*$/i;

const isMarkable = (line: SheetLine) => line.kind === 'lyrics' || line.kind === 'chords';
const key = (line: SheetLine) => normalize(lineText(line));

/**
 * Switches the intro mark of sheet line `lineIndex` (as numbered by
 * parseChordPro). Only that one spot of the text changes: `{x_intro}` is
 * added before the line (ahead of a `{x_gap}`) or removed. Null when the line
 * can't be marked (a note) or isn't found.
 */
export function toggleIntroMark(chordpro: string, lineIndex: number): string | null {
  const lines = parseChordPro(chordpro).sections.flatMap((s) => s.lines);
  const target = lines.find((l) => l.index === lineIndex);
  if (!target || !isMarkable(target)) return null;
  // The same text can appear more than once (a chorus written twice): find
  // which occurrence this is, then the same occurrence in the source.
  const wanted = key(target);
  const occurrence = lines.filter((l) => l.index < lineIndex && isMarkable(l) && key(l) === wanted).length;

  const source = chordpro.split('\n');
  let seen = 0;
  for (let i = 0; i < source.length; i++) {
    const raw = source[i];
    if (!raw.trim() || /^\s*\{/.test(raw) || /^\s*#/.test(raw)) continue;
    // Each source line read on its own gives the same line the song view shows.
    const own = parseChordPro(raw).sections.flatMap((s) => s.lines).find(isMarkable);
    if (!own || key(own) !== wanted) continue;
    if (seen++ < occurrence) continue;
    // The directives right above the line belong to it.
    let first = i;
    while (first > 0 && LINE_DIRECTIVE.test(source[first - 1])) first--;
    const existing = source.slice(first, i).findIndex((l) => INTRO_LINE.test(l));
    if (existing >= 0) source.splice(first + existing, 1);
    else source.splice(first, 0, MARK);
    return source.join('\n');
  }
  return null;
}
