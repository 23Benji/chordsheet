// "Statistiche": what the setlists say about the songs actually sung.
// Pure logic (no Angular), so it can be tested with plain objects.
//
// Counting rules:
// - a song counts once per setlist ("cantato in 5 scalette"), even if it
//   appears twice in the same one;
// - the versions of a number (4, 4b) are one song: they are the same hymn;
// - a setlist's day is its date, or the day it was created if it has none;
// - rows of deleted songs are skipped (there is nothing to name them by).

import { Setlist, Song } from './models';

export type StatsSong = Pick<Song, 'id' | 'number' | 'suffix' | 'title'>;

export interface SongCount {
  /** The song shown for the group (the version without a letter, if there is one). */
  song: StatsSong;
  /** In how many setlists it was sung. */
  count: number;
  /** The most recent day it was sung (YYYY-MM-DD). */
  last: string;
}

export interface NumberRange {
  /** Song numbers from…to, e.g. 1–25. */
  from: number;
  to: number;
  /** Times songs of this range were sung. */
  plays: number;
  /** Different songs of this range sung at least once … */
  sung: number;
  /** … out of the songs of this range in the library. */
  total: number;
}

export interface SetlistStats {
  setlists: number;
  /** All the times any song was sung (one per song per setlist). */
  plays: number;
  /** Different songs sung. */
  distinct: number;
  /** Most sung first. */
  songs: SongCount[];
  /** The songbook in parts by number, for "which part do we sing". */
  ranges: NumberRange[];
  /** Times songs without a number were sung. */
  unnumberedPlays: number;
  /** Songs of the library never sung in these setlists (one per number), by number. */
  neverSung: StatsSong[];
  /** First and last day counted. */
  from: string | null;
  to: string | null;
}

/** A setlist's day: its date, else the day it was created. */
export function setlistDay(setlist: Pick<Setlist, 'date' | 'createdAt'>): string {
  return setlist.date || new Date(setlist.createdAt).toISOString().slice(0, 10);
}

/** The group a song belongs to: its number (all versions together), or itself. */
const groupKey = (song: StatsSong) => (song.number !== null ? `n${song.number}` : song.id);

/**
 * Statistics over the setlists from `since` (YYYY-MM-DD, inclusive; all when
 * omitted). `rangeSize`: how many numbers per part of the songbook.
 */
export function setlistStats(
  setlists: readonly Setlist[],
  library: readonly StatsSong[],
  since?: string,
  rangeSize = 25,
): SetlistStats {
  const byId = new Map(library.map((s) => [s.id, s]));
  // One song per group to show: the version without a letter wins.
  const shown = new Map<string, StatsSong>();
  for (const song of library) {
    const key = groupKey(song);
    const current = shown.get(key);
    if (!current || (current.suffix && !song.suffix)) shown.set(key, song);
  }

  const counted = setlists.filter((s) => !since || setlistDay(s) >= since);
  const counts = new Map<string, { count: number; last: string }>();
  let plays = 0;
  let from: string | null = null;
  let to: string | null = null;
  for (const setlist of counted) {
    const day = setlistDay(setlist);
    if (!from || day < from) from = day;
    if (!to || day > to) to = day;
    const keys = new Set(
      setlist.items.map((item) => byId.get(item.songId)).filter((s): s is StatsSong => !!s).map(groupKey),
    );
    for (const key of keys) {
      const entry = counts.get(key) ?? { count: 0, last: day };
      entry.count++;
      if (day > entry.last) entry.last = day;
      counts.set(key, entry);
      plays++;
    }
  }

  const songs: SongCount[] = [...counts.entries()]
    .map(([key, { count, last }]) => ({ song: shown.get(key)!, count, last }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.last.localeCompare(a.last) ||
        (a.song.number ?? Infinity) - (b.song.number ?? Infinity) ||
        a.song.title.localeCompare(b.song.title, 'it'),
    );

  const maxNumber = Math.max(0, ...library.map((s) => s.number ?? 0));
  const ranges: NumberRange[] = [];
  for (let start = 1; start <= maxNumber; start += rangeSize) {
    ranges.push({ from: start, to: Math.min(start + rangeSize - 1, maxNumber), plays: 0, sung: 0, total: 0 });
  }
  let unnumberedPlays = 0;
  for (const [key, song] of shown) {
    const count = counts.get(key)?.count ?? 0;
    if (song.number === null) {
      unnumberedPlays += count;
      continue;
    }
    const range = ranges[Math.floor((song.number - 1) / rangeSize)];
    if (!range) continue;
    range.total++;
    range.plays += count;
    if (count) range.sung++;
  }

  // Gaps in the numbering (no song from 151 to 200, say) are not parts of the songbook.
  const parts = ranges.filter((r) => r.total > 0);

  const neverSung = [...shown.entries()]
    .filter(([key]) => !counts.has(key))
    .map(([, song]) => song)
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.title.localeCompare(b.title, 'it'));

  return { setlists: counted.length, plays, distinct: counts.size, songs, ranges: parts, unnumberedPlays, neverSung, from, to };
}

/** The first day of the period "last N months" before `today` (YYYY-MM-DD). */
export function monthsAgo(months: number, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
