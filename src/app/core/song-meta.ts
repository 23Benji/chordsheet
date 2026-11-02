// Detecting a song's number, version suffix and title from its ChordPro text
// or from the bundled file-name pattern "NNN[x] - Title.cho".

export interface SongNumber {
  number: number | null;
  suffix: string;
}

const NUMBER_RE = /^\s*(\d+)\s*([a-z]?)\s*$/i;
const FILE_NAME_RE = /^(\d+)([a-z]?)\s*-\s*(.+?)(\.(cho|chopro|chordpro|txt))?$/i;

/** Parses "123c", "12", " 4 b " → { number, suffix }. */
export function parseSongNumber(value: string | null | undefined): SongNumber {
  const match = value ? NUMBER_RE.exec(value) : null;
  if (!match) return { number: null, suffix: '' };
  return { number: Number(match[1]), suffix: match[2].toLowerCase() };
}

/** "123c - La terra canta.cho" → { number: 123, suffix: 'c', title: 'La terra canta' }. */
export function parseFileName(fileName: string): SongNumber & { title: string | null } {
  const base = fileName.split('/').pop() ?? fileName;
  const match = FILE_NAME_RE.exec(base);
  if (!match) {
    return { number: null, suffix: '', title: base.replace(/\.[^.]+$/, '') || null };
  }
  return { number: Number(match[1]), suffix: match[2].toLowerCase(), title: match[3].trim() };
}

/** Reads the value of a single-value directive, e.g. directive(src, 'title'). */
export function readDirective(chordpro: string, name: string): string | null {
  const re = new RegExp(`^\\s*\\{\\s*${name}\\s*:\\s*(.*?)\\s*\\}\\s*$`, 'im');
  return re.exec(chordpro)?.[1] ?? null;
}

/** Reads {meta: numero 12b} (also accepts {numero: 12b}). */
export function readNumeroMeta(chordpro: string): string | null {
  const meta = /^\s*\{\s*meta\s*:\s*numero\s+(.*?)\s*\}\s*$/im.exec(chordpro);
  return meta?.[1] ?? readDirective(chordpro, 'numero');
}

/** Label shown in number pills and used for search: "12", "123c". */
export function numberLabel(song: { number: number | null; suffix: string }): string {
  return song.number === null ? '' : `${song.number}${song.suffix}`;
}

/** Sort comparator: by number then suffix; songs without number go last, by title. */
export function compareByNumber(
  a: { number: number | null; suffix: string; title: string },
  b: { number: number | null; suffix: string; title: string },
): number {
  if (a.number === null || b.number === null) {
    if (a.number !== b.number) return a.number === null ? 1 : -1;
    return compareByTitle(a, b);
  }
  return a.number - b.number || a.suffix.localeCompare(b.suffix);
}

export function compareByTitle(a: { title: string }, b: { title: string }): number {
  return a.title.localeCompare(b.title, 'it', { sensitivity: 'base' });
}
