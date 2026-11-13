// Repeats, written once in the song so everyone sees the same thing (Benji,
// 2026-11-13): "this part ×4", "these two lines ×2".
//
//   {x_repeat: 4}        at the top of a part → the whole part is played 4 times
//   {x_repeat_line: 2}   before a line        → that line is repeated; lines
//                                                next to each other with the same
//                                                count are one group ("these two lines ×2")
//
// "x_" directives are ignored by other ChordPro apps, so songs stay portable.
// Older songs say it in words; only the clear cases are read (Benji's pick),
// everything else stays as written:
//   "x2/ … /x2" around one or more lines   → those lines ×2
//   a note "x2" / "x 3 volte" ending a part → the part ×N
//   "Ritornello: … x2" reminders            → ×2

export const REPEAT_DIRECTIVE = 'x_repeat';
export const REPEAT_LINE_DIRECTIVE = 'x_repeat_line';

/** Counts the app offers and reads: 2× … 12×. */
export const MIN_TIMES = 2;
export const MAX_TIMES = 12;

/** "4" → 4; anything else (or 1) → null. */
export function readTimes(value: string | null | undefined): number | null {
  const n = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(n) && n >= MIN_TIMES && n <= MAX_TIMES ? n : null;
}

const TIMES = String.raw`[x×]\s?(\d{1,2})`;
/** A whole note that only says how many times: "x2", "X 3", "×4", "x2 volte". */
const NOTE_RE = new RegExp(String.raw`^\s*${TIMES}\s*(?:volte)?\s*[.!]?\s*$`, 'i');
/** "X2/ BENEDICI IL SIGNOR… /X2" (the whole text wrapped). */
const WRAPPED_RE = new RegExp(String.raw`^\s*${TIMES}\s*\/\s*(.*?)\s*\/\s*[x×]\s?(\d{1,2})\s*$`, 'i');
/** "… x 2", "… X2 volte" at the end of a chorus reminder. */
const TRAILING_RE = new RegExp(String.raw`^(.*?)[\s,;]+${TIMES}\s*(?:volte)?\s*$`, 'i');
/** "x2/ " at the start of a line, "/x2" at its end. */
const SPAN_START_RE = new RegExp(String.raw`^(\s*)${TIMES}\s*\/\s?`, 'i');
const SPAN_END_RE = new RegExp(String.raw`\s?\/\s*${TIMES}\s*$`, 'i');

/** `{comment: x2}` → 2: a note that is only a repeat count. */
export function noteTimes(text: string): number | null {
  const match = NOTE_RE.exec(text);
  return match ? readTimes(match[1]) : null;
}

/** "X2/ BENEDICI… /X2" or "BENEDICI… x 2" → the count and the text without it. */
export function reminderTimes(text: string): { times: number; text: string } | null {
  const wrapped = WRAPPED_RE.exec(text);
  if (wrapped && wrapped[1] === wrapped[3]) {
    const times = readTimes(wrapped[1]);
    return times ? { times, text: wrapped[2] } : null;
  }
  const trailing = TRAILING_RE.exec(text);
  const times = trailing ? readTimes(trailing[2]) : null;
  return times && trailing![1].trim() ? { times, text: trailing![1].trim() } : null;
}

const DIRECTIVE_LINE = /^\s*\{.*\}\s*$/;
/** Directives that belong to the line after them (they may sit inside a span). */
const LINE_DIRECTIVE = /^\s*\{\s*(x_intro|x_gap|x_glue|x_repeat_line)\b[^}]*\}\s*$/i;

/**
 * "x2/ [G]TUTTO SEI PER ME … /x2" → `{x_repeat_line: 2}` before each line of
 * the span and the markers taken out. Text in, text out, and no sheet line is
 * added or removed (directives aren't lines), so line numbers — which personal
 * notes are attached to — stay the same. A span must start and end inside one
 * paragraph (no empty line or section in between) with the same count;
 * anything else is left as written.
 */
export function upgradeRepeatSpans(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = isText(lines[i]) ? SPAN_START_RE.exec(lines[i]) : null;
    const end = start ? findSpanEnd(lines, i, start[2]) : -1;
    if (!start || end < 0) {
      out.push(lines[i]);
      continue;
    }
    const times = readTimes(start[2])!;
    for (let j = i; j <= end; j++) {
      let line = lines[j];
      if (!isText(line)) {
        out.push(line);
        continue;
      }
      if (j === i) line = line.replace(SPAN_START_RE, '$1');
      if (j === end) line = line.replace(SPAN_END_RE, '');
      out.push(`{${REPEAT_LINE_DIRECTIVE}: ${times}}`, line);
    }
    i = end;
  }
  return out.join('\n');
}

const isText = (line: string) => line.trim() !== '' && !DIRECTIVE_LINE.test(line) && !/^\s*#/.test(line);

function findSpanEnd(lines: string[], from: number, count: string): number {
  if (!readTimes(count)) return -1;
  for (let j = from; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === '' || (DIRECTIVE_LINE.test(line) && !LINE_DIRECTIVE.test(line))) return -1;
    if (!isText(line)) continue;
    // On the first line, "/x2" must come after the start marker ("x2/ text /x2").
    const text = j === from ? line.replace(SPAN_START_RE, '') : line;
    const end = SPAN_END_RE.exec(text);
    if (end) return end[1] === count ? j : -1;
  }
  return -1;
}
