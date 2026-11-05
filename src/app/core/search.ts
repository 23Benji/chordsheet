// Instant library search: accent- and case-insensitive, across number
// ("12", "123b"), title and lyrics. Entries are pre-normalised once so each
// keystroke only does cheap `includes` checks (SPEC §7: < 50 ms for 200 songs).
//
// It also forgives the way people actually type, in two steps:
// 1. spelling variants, always: j/y = i, k = c, silent h, double letters
//    ("alleluja" → Alleluia, "osanna" → Hosanna, "galilea" → Gallilea);
// 2. real typos (a letter missing, extra, wrong or two swapped: "signroe"),
//    only when nothing else matched — so they never clutter good results.
import { numberLabel } from './song-meta';

export interface SearchEntry {
  id: string;
  label: string; // "123c"
  title: string; // normalised
  lyrics: string; // normalised
  /** The same, spelled loosely (see `loose`). */
  looseTitle: string;
  looseLyrics: string;
  /** Distinct loose words, for the typo pass. */
  titleWords: string[];
  lyricsWords: string[];
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

/**
 * Spelling that doesn't matter: j and y read as i, k as c, h is silent, and
 * double letters count once ("Alleluja" = "alleluia" = "aleluia").
 */
export function loose(normalised: string): string {
  return normalised
    .replace(/[jy]/g, 'i')
    .replace(/k/g, 'c')
    .replace(/h/g, '')
    .replace(/([a-z])\1+/g, '$1');
}

const wordsOf = (text: string) => [...new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length >= 3))];

export function buildSearchEntry(song: {
  id: string;
  number: number | null;
  suffix: string;
  title: string;
  chordpro: string;
}): SearchEntry {
  const title = normalize(song.title);
  const lyrics = normalize(extractLyrics(song.chordpro));
  const looseTitle = loose(title);
  const looseLyrics = loose(lyrics);
  return {
    id: song.id,
    label: numberLabel(song).toLowerCase(),
    title,
    lyrics,
    looseTitle,
    looseLyrics,
    titleWords: wordsOf(looseTitle),
    lyricsWords: wordsOf(looseLyrics),
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

  const lq = loose(q);
  const looseWords = lq.split(' ');
  const ranked: { id: string; rank: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    const rank = rankEntry(entry, q, words, isNumber, digits) ?? rankLoose(entry, lq, looseWords);
    if (rank !== null) ranked.push({ id: entry.id, rank, order });
  });
  // Nothing at all: maybe a typo. Each word may be one or two letters off.
  if (!ranked.length && !isNumber) {
    entries.forEach((entry, order) => {
      const rank = rankTypo(entry, looseWords);
      if (rank !== null) ranked.push({ id: entry.id, rank, order });
    });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return ranked.map((r) => r.id);
}

/** Ranks 7–9: the query matches once spelling variants are ignored. */
function rankLoose(entry: SearchEntry, lq: string, words: string[]): number | null {
  if (!lq) return null;
  if (entry.looseTitle.includes(lq)) return 7;
  if (entry.looseLyrics.includes(lq)) return 8;
  if (words.length > 1 && words.every((w) => entry.looseTitle.includes(w) || entry.looseLyrics.includes(w))) return 9;
  return null;
}

/** Ranks 10–11: every word matches a word of the song with a small typo (title first). */
function rankTypo(entry: SearchEntry, words: string[]): number | null {
  let inTitle = true;
  for (const [i, w] of words.entries()) {
    // The last word may still be being typed: compare it with word beginnings too.
    const typing = i === words.length - 1;
    if (entry.looseTitle.includes(w) || entry.titleWords.some((t) => closeWord(w, t, typing))) continue;
    inTitle = false;
    if (!(entry.looseLyrics.includes(w) || entry.lyricsWords.some((t) => closeWord(w, t, typing)))) return null;
  }
  return inTitle ? 10 : 11;
}

/**
 * A typed word close enough to a song word: words of 4+ letters may be one
 * letter off, 7+ letters two (shorter words are too easy to confuse:
 * "mare" / "male" / "sale").
 */
export function closeWord(typed: string, word: string, prefix = false): boolean {
  if (typed.length < 4) return false;
  const max = typed.length >= 7 ? 2 : 1;
  if (Math.abs(typed.length - word.length) > max && !(prefix && word.length > typed.length)) return false;
  if (editDistance(typed, word, max) <= max) return true;
  // While typing: "signo" against the start of "signore".
  return prefix && word.length > typed.length && editDistance(typed, word.slice(0, typed.length), max) <= max;
}

/**
 * Letters to add, remove, change or swap (neighbours) to turn a into b —
 * "Damerau-Levenshtein" (optimal string alignment). Stops early once every
 * path is already over `max`, which keeps the typo pass fast.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prevPrev[j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return prev[b.length];
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
