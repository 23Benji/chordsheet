// "Scrivi assolo": a solo as a list of columns, turned into the six lines of
// guitar tablature that the song view shows in a Tab/Assolo block. Pure
// functions, unit-tested (the page is features/guitar/solo-writer-page).

/** Strings low E (0) → high e (5), as in GUITAR_TUNING. */
export const STRINGS = 6;
/** Names as tablature writes them: the high e in lower case, printed on top. */
export const TAB_STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const TAB_FRETS = 12;

/** Hammer-on, pull-off, slide, bend: written between two notes ("5h7"). */
export type TabTechnique = 'h' | 'p' | '/' | 'b';

export type TabItem =
  /** One column: per string (low E → high e) the fret played, or null. Several frets = played together. */
  | { kind: 'note'; frets: (number | null)[] }
  /** A technique mark on one string, between the notes around it. */
  | { kind: 'tech'; mark: TabTechnique; string: number }
  /** Bar line "|". */
  | { kind: 'bar' };

/** Past this many characters a row of tab continues on a new one, at the next bar line. */
export const TAB_ROW_WIDTH = 40;

const emptyColumn = (): (number | null)[] => Array<number | null>(STRINGS).fill(null);

export function isEmptyNote(item: TabItem): boolean {
  return item.kind === 'note' && item.frets.every((f) => f === null);
}

/**
 * A tap on the neck. Normally a new column; with `together` the fret joins the
 * last column (two notes at once), and tapping the same fret again takes it out.
 */
export function addNote(items: readonly TabItem[], string: number, fret: number, together = false): TabItem[] {
  const last = items[items.length - 1];
  if (together && last?.kind === 'note') {
    const frets = [...last.frets];
    frets[string] = frets[string] === fret ? null : fret;
    const next = items.slice(0, -1);
    return isEmptyNote({ kind: 'note', frets }) ? next : [...next, { kind: 'note', frets }];
  }
  const frets = emptyColumn();
  frets[string] = fret;
  return [...items, { kind: 'note', frets }];
}

/** The string a technique goes on: the highest string of the last column (a melody is usually on top). */
export function lastNoteString(items: readonly TabItem[]): number | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === 'note') {
      for (let s = STRINGS - 1; s >= 0; s--) if (item.frets[s] !== null) return s;
    }
  }
  return null;
}

/** h / p / slide / bend after the last note; nothing when there's no note yet or one is already there. */
export function addTechnique(items: readonly TabItem[], mark: TabTechnique): TabItem[] {
  const last = items[items.length - 1];
  const string = lastNoteString(items);
  if (string === null || last?.kind !== 'note') return [...items];
  return [...items, { kind: 'tech', mark, string }];
}

/** A bar line; never two in a row, never at the very start. */
export function addBar(items: readonly TabItem[]): TabItem[] {
  const last = items[items.length - 1];
  if (!last || last.kind === 'bar') return [...items];
  return [...items, { kind: 'bar' }];
}

/**
 * The grid: write (or clear, with null) one cell. `column` = items.length
 * starts a new column at the end. Clearing the last fret of a column removes it.
 */
export function setCell(items: readonly TabItem[], column: number, string: number, fret: number | null): TabItem[] {
  const next = [...items];
  if (column >= next.length) {
    if (fret === null) return next;
    next.push({ kind: 'note', frets: emptyColumn() });
    column = next.length - 1;
  }
  const item = next[column];
  if (item.kind !== 'note') return next;
  const frets = [...item.frets];
  frets[string] = fret;
  const updated: TabItem = { kind: 'note', frets };
  if (isEmptyNote(updated)) {
    next.splice(column, 1);
    // A technique mark left without its note before it goes too.
    if (next[column - 1]?.kind === 'tech' && next[column]?.kind !== 'note') next.splice(column - 1, 1);
  } else next[column] = updated;
  return next;
}

/** How many characters one item takes in a row (a column is as wide as its widest fret). */
function width(item: TabItem): number {
  if (item.kind !== 'note') return 1;
  return Math.max(1, ...item.frets.map((f) => (f === null ? 1 : String(f).length)));
}

/** One cell of the row of `string`: "12", "-", "h". */
function cell(item: TabItem, string: number): string {
  const w = width(item);
  if (item.kind === 'bar') return '|';
  if (item.kind === 'tech') return item.string === string ? item.mark : '-';
  const fret = item.frets[string];
  return fret === null ? '-'.repeat(w) : String(fret).padEnd(w, '-');
}

/**
 * Splits the items into rows of tab no wider than about `rowWidth`, breaking
 * only after a bar line (a long solo stays readable on a phone).
 */
export function tabRows(items: readonly TabItem[], rowWidth = TAB_ROW_WIDTH): TabItem[][] {
  const rows: TabItem[][] = [];
  let row: TabItem[] = [];
  let used = 0;
  for (const item of items) {
    row.push(item);
    used += width(item) + (item.kind === 'tech' ? 0 : 1);
    if (item.kind === 'bar' && used >= rowWidth) {
      rows.push(row.slice(0, -1));
      row = [];
      used = 0;
    }
  }
  if (row.length || !rows.length) rows.push(row);
  return rows;
}

/**
 * The six lines of one row, high e first: "e|-0-2h3-|". A dash after every
 * column, none around a technique mark (so "5h7", not "5-h-7").
 */
export function tabRowLines(items: readonly TabItem[]): string[] {
  const lines: string[] = [];
  for (let s = STRINGS - 1; s >= 0; s--) {
    let line = `${TAB_STRING_NAMES[s]}|-`;
    items.forEach((item, i) => {
      line += cell(item, s);
      const next = items[i + 1];
      if (item.kind !== 'tech' && next?.kind !== 'tech' && !(item.kind === 'bar' && !next)) line += '-';
    });
    // Ending on a bar line: that bar closes the row ("…-2-|", not "…-2-|-|").
    lines.push(items[items.length - 1]?.kind === 'bar' ? line : line + '|');
  }
  return lines;
}

/** The whole solo as text, rows separated by an empty line: what Copia copies and a song stores. */
export function tabText(items: readonly TabItem[], rowWidth = TAB_ROW_WIDTH): string {
  if (!items.some((i) => i.kind === 'note')) return '';
  return tabRows(items, rowWidth)
    .map((row) => tabRowLines(row).join('\n'))
    .join('\n\n');
}

/** Saved drafts come back from localStorage: keep only well-formed items. */
export function sanitizeItems(value: unknown): TabItem[] {
  if (!Array.isArray(value)) return [];
  const okFret = (f: unknown) => f === null || (Number.isInteger(f) && (f as number) >= 0 && (f as number) <= 24);
  return value.filter((item): item is TabItem => {
    if (!item || typeof item !== 'object') return false;
    const i = item as Record<string, unknown>;
    if (i['kind'] === 'bar') return true;
    if (i['kind'] === 'tech') return ['h', 'p', '/', 'b'].includes(i['mark'] as string) && Number.isInteger(i['string']);
    return i['kind'] === 'note' && Array.isArray(i['frets']) && i['frets'].length === STRINGS && i['frets'].every(okFret);
  });
}
