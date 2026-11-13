// The intro mark: lines of the song that are also its intro ("the last two
// lines of the chorus") carry `{x_intro}` on the line before them. It lives in
// the song text, so it is always shared with the song (Benji, 2026-11-10),
// and the song view draws those lines with a green bracket and "INTRO".
import { lineText } from './anchoring';
import { INTRO_DIRECTIVE, SheetLine, parseChordPro, sectionKey } from './chordpro';
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
  return switchOne(chordpro, lineIndex);
}

/**
 * The intro switch of a line in the song view. With "Parti ripetute" on
 * (`linked`), a part played twice shows once with "×2": the switch then
 * changes the same line in every copy, so the mark never gets stuck on (one
 * copy still marked) and both copies stay the same part.
 */
export function switchIntroMark(chordpro: string, lineIndex: number, linked: boolean): string | null {
  if (!linked) return switchOne(chordpro, lineIndex);
  const sections = parseChordPro(chordpro).sections;
  const at = sections.findIndex((s) => s.lines.some((l) => l.index === lineIndex));
  if (at < 0) return null;
  const position = sections[at].lines.findIndex((l) => l.index === lineIndex);
  // The run of identical sections (one after the other) this line is part of.
  const key = sectionKey(sections[at]);
  let first = at;
  while (first > 0 && sectionKey(sections[first - 1]) === key) first--;
  let last = at;
  while (last < sections.length - 1 && sectionKey(sections[last + 1]) === key) last++;
  const copies = sections.slice(first, last + 1).map((s) => s.lines[position]);
  if (!copies.every(isMarkable)) return null;
  const on = !copies.some((l) => l.intro); // all lyrics or chord lines (isMarkable)
  let text = chordpro;
  for (const copy of copies) {
    if (!!copy.intro === on) continue;
    // Line indexes don't change: the mark is a directive, not a sheet line.
    const next = switchOne(text, copy.index);
    if (next === null) return null;
    text = next;
  }
  return text;
}

function switchOne(chordpro: string, lineIndex: number): string | null {
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
