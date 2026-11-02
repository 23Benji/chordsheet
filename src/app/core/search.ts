// Instant library search: accent- and case-insensitive, across number
// ("12", "123b"), title and lyrics. Entries are pre-normalised once so each
// keystroke only does cheap `includes` checks (SPEC §7: < 50 ms for 200 songs).
import { numberLabel } from './song-meta';

export interface SearchEntry {
  id: string;
  label: string; // "123c"
  title: string; // normalised
  lyrics: string; // normalised
}

/** "Gesù è" → "gesu e"; apostrophes become spaces ("L'Iddio" → "l iddio"). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchEntry(song: {
  id: string;
  number: number | null;
  suffix: string;
  title: string;
  chordpro: string;
}): SearchEntry {
  return {
    id: song.id,
    label: numberLabel(song).toLowerCase(),
    title: normalize(song.title),
    lyrics: normalize(extractLyrics(song.chordpro)),
  };
}

const NUMBER_QUERY = /^\d+[a-z]?$/;

/**
 * Returns matching ids, best matches first. Within the same rank the input
 * order is kept, so callers decide the base sort (by number or title).
 */
export function searchSongs(entries: readonly SearchEntry[], query: string): string[] {
  const q = normalize(query);
  if (!q) return entries.map((e) => e.id);
  const words = q.split(' ');
  const isNumber = NUMBER_QUERY.test(q);
  const digits = q.replace(/[a-z]$/, '');

  const ranked: { id: string; rank: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    const rank = rankEntry(entry, q, words, isNumber, digits);
    if (rank !== null) ranked.push({ id: entry.id, rank, order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.map((r) => r.id);
}

function rankEntry(
  entry: SearchEntry,
  q: string,
  words: string[],
  isNumber: boolean,
  digits: string,
): number | null {
  if (isNumber && entry.label) {
    if (entry.label === q) return 0;
    if (entry.label.replace(/[a-z]$/, '') === digits && q === digits) return 1; // 4 → 4b
    if (entry.label.startsWith(q)) return 2; // 12 → 120…129
  }
  if (entry.title.startsWith(q)) return 3;
  if (entry.title.includes(q)) return 4;
  if (entry.lyrics.includes(q)) return 5;
  if (words.length > 1 && words.every((w) => entry.title.includes(w) || entry.lyrics.includes(w))) {
    return 6;
  }
  return null;
}

/** True when the query looks like a song number, e.g. "12" or "123c". */
export function isNumberQuery(query: string): boolean {
  return NUMBER_QUERY.test(normalize(query));
}

/**
 * Plain lyrics (chords and directives stripped), for full-text search.
 * Deliberately a regex, not chordsheetjs: the library stays out of the
 * initial bundle and is only loaded with the song view.
 */
export function extractLyrics(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*[{#]/.test(line))
    .map((line) => line.replace(/\[[^\]]*\]/g, ''))
    .join('\n');
}
