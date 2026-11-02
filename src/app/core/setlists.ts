// Setlists ("scalette"): pure helpers and the share format.
import { Setlist, SetlistItem, Song } from './models';
import { normalize } from './search';
import { numberLabel, parseSongNumber } from './song-meta';

export function newSetlist(name: string, date?: string, now = Date.now()): Setlist {
  return { id: crypto.randomUUID(), name: name.trim(), date: date || undefined, items: [], createdAt: now, updatedAt: now };
}

export function newItem(songId: string, extra: Partial<SetlistItem> = {}): SetlistItem {
  return { id: crypto.randomUUID(), songId, ...extra };
}

/** A copy with new ids and "(copia)" in the name. */
export function duplicateSetlist(setlist: Setlist, copySuffix: string, now = Date.now()): Setlist {
  return {
    ...setlist,
    id: crypto.randomUUID(),
    name: `${setlist.name} ${copySuffix}`,
    items: setlist.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Moves the item at `from` to `to` (drag & drop). */
export function moveItem(items: readonly SetlistItem[], from: number, to: number): SetlistItem[] {
  const result = [...items];
  if (from < 0 || from >= result.length) return result;
  const [moved] = result.splice(from, 1);
  result.splice(Math.min(Math.max(to, 0), result.length), 0, moved);
  return result;
}

/** The item's own transposition if set, otherwise the song's personal one. */
export function effectiveTranspose(item: SetlistItem, songTranspose: number): number {
  return item.transpose ?? songTranspose;
}

// ── Sharing ────────────────────────────────────────────────────────────────

export const SETLIST_FORMAT = 'innario-setlist';

/**
 * A shared setlist refers to songs by number + suffix (same on every device
 * with the church songbook), with the title as a fallback for songs without
 * a number.
 */
export interface SharedSetlist {
  format: typeof SETLIST_FORMAT;
  version: 1;
  name: string;
  date?: string;
  items: { number: string; title: string; transpose?: number; note?: string }[];
}

export function exportSetlist(setlist: Setlist, songs: ReadonlyMap<string, Song>): SharedSetlist {
  return {
    format: SETLIST_FORMAT,
    version: 1,
    name: setlist.name,
    date: setlist.date,
    items: setlist.items.flatMap((item) => {
      const song = songs.get(item.songId);
      if (!song) return [];
      return [{ number: numberLabel(song), title: song.title, transpose: item.transpose, note: item.note }];
    }),
  };
}

export function setlistFileName(setlist: Setlist): string {
  const name = setlist.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'scaletta';
  return `scaletta - ${name}${setlist.date ? ` - ${setlist.date}` : ''}.json`;
}

export interface ImportResult {
  setlist: Setlist;
  /** Titles of shared songs that are not in this library. */
  missing: string[];
}

/** Reads a shared setlist file; throws on anything that isn't one. */
export function importSetlist(json: string, songs: readonly Song[], now = Date.now()): ImportResult {
  let data: SharedSetlist;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('not-json');
  }
  if (data?.format !== SETLIST_FORMAT || !Array.isArray(data.items)) throw new Error('not-a-setlist');

  const setlist = newSetlist(String(data.name || 'Scaletta'), data.date, now);
  const missing: string[] = [];
  for (const shared of data.items) {
    const { number, suffix } = parseSongNumber(shared.number);
    const song =
      (number !== null && songs.find((s) => s.number === number && s.suffix === suffix)) ||
      songs.find((s) => normalize(s.title) === normalize(shared.title ?? ''));
    if (!song) {
      missing.push(shared.number ? `${shared.number} ${shared.title}` : shared.title);
      continue;
    }
    const transpose = Number.isInteger(shared.transpose) ? shared.transpose : undefined;
    setlist.items.push(newItem(song.id, { transpose, note: shared.note || undefined }));
  }
  return { setlist, missing };
}

/** "domenica 9 novembre 2026" from "2026-11-09" (dates are stored as ISO days). */
export function formatSetlistDate(date: string | undefined): string {
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
