// Backup of everything on this device in one JSON file, and restore — the
// way to move data between laptop and iPad (SPEC §5.2).
import { Annotation, Folder, Setlist, Settings, Song, SongPrefs } from './models';
import { normalize } from './search';

export interface BackupData {
  songs: Song[];
  songPrefs: SongPrefs[];
  annotations: Annotation[];
  setlists: Setlist[];
  /** Since 1.8; older backup files have none. */
  folders: Folder[];
  settings: Settings | null;
}

// Format ids keep the app's original name so files made earlier still import.
export const BACKUP_FORMAT = 'innario-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  data: BackupData;
}

export function createBackup(data: BackupData, now = new Date()): BackupFile {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), data };
}

export function backupFileName(now = new Date()): string {
  return `chordsheet-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Reads a backup file; throws on anything else. */
export function parseBackup(json: string): BackupData {
  let file: BackupFile;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('not-json');
  }
  const d = file?.data;
  if (file?.format !== BACKUP_FORMAT || !d || !Array.isArray(d.songs)) throw new Error('not-a-backup');
  return {
    songs: d.songs,
    songPrefs: d.songPrefs ?? [],
    annotations: d.annotations ?? [],
    setlists: d.setlists ?? [],
    folders: d.folders ?? [],
    settings: d.settings ?? null,
  };
}

/**
 * Merges a backup into the local data. Each device imported the songbook
 * with its own ids, so songs are matched by id, then by number + suffix,
 * then (songs without number) by title. Matched songs keep the local id;
 * the newer text wins. Prefs, notes, setlist entries and folder contents of
 * the backup are re-pointed to the local ids. Local settings are kept.
 */
export function mergeBackup(local: BackupData, incoming: BackupData): BackupData {
  const songs = new Map(local.songs.map((s) => [s.id, s]));
  const byNumber = new Map(local.songs.filter((s) => s.number !== null).map((s) => [`${s.number}${s.suffix}`, s]));
  const byTitle = new Map(local.songs.filter((s) => s.number === null).map((s) => [normalize(s.title), s]));
  const idMap = new Map<string, string>();

  for (const song of incoming.songs) {
    const match =
      songs.get(song.id) ??
      (song.number !== null ? byNumber.get(`${song.number}${song.suffix}`) : byTitle.get(normalize(song.title)));
    if (!match) {
      songs.set(song.id, song);
      idMap.set(song.id, song.id);
      continue;
    }
    idMap.set(song.id, match.id);
    if (song.updatedAt > match.updatedAt) songs.set(match.id, { ...song, id: match.id, createdAt: match.createdAt });
  }
  const songId = (id: string) => idMap.get(id) ?? id;

  const prefs = new Map(local.songPrefs.map((p) => [p.songId, p]));
  for (const p of incoming.songPrefs) {
    const id = songId(p.songId);
    prefs.set(id, { ...prefs.get(id), ...p, songId: id });
  }

  const newer = <T extends { id: string; updatedAt: number }>(target: Map<string, T>, item: T) => {
    const existing = target.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) target.set(item.id, item);
  };
  const annotations = new Map(local.annotations.map((a) => [a.id, a]));
  for (const a of incoming.annotations) newer(annotations, { ...a, songId: songId(a.songId) });
  const setlists = new Map(local.setlists.map((s) => [s.id, s]));
  for (const s of incoming.setlists) {
    newer(setlists, { ...s, items: s.items.map((i) => ({ ...i, songId: songId(i.songId) })) });
  }

  const folders = new Map(local.folders.map((f) => [f.id, f]));
  for (const f of incoming.folders) newer(folders, { ...f, songIds: [...new Set(f.songIds.map(songId))] });

  return {
    songs: [...songs.values()],
    songPrefs: [...prefs.values()],
    annotations: [...annotations.values()],
    setlists: [...setlists.values()],
    folders: [...folders.values()],
    settings: local.settings ?? incoming.settings,
  };
}
