// Folders ("cartelle"): pure helpers. A folder stores song ids; the library
// treats all versions of a song (123, 123b …) as one entry, so a song counts
// as "in the folder" when any of its versions was filed there.
import { Folder } from './models';
import { normalize } from './search';
import { Versioned } from './versions';

export function cleanFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function newFolder(name: string, songIds: readonly string[] = [], now = Date.now()): Folder {
  return { id: crypto.randomUUID(), name: cleanFolderName(name), songIds: unique(songIds), createdAt: now, updatedAt: now };
}

/** Another folder (not `exceptId`) already has this name (ignoring case and accents). */
export function folderNameTaken(folders: readonly Folder[], name: string, exceptId?: string): boolean {
  const wanted = normalize(cleanFolderName(name));
  return folders.some((f) => f.id !== exceptId && normalize(f.name) === wanted);
}

/** Alphabetical, the way an Italian reader expects ("Natale" before "Pasqua", accents ignored). */
export function sortFolders(folders: readonly Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base', numeric: true }));
}

export function withSongs(folder: Folder, ids: readonly string[], now = Date.now()): Folder {
  const songIds = unique([...folder.songIds, ...ids]);
  return songIds.length === folder.songIds.length ? folder : { ...folder, songIds, updatedAt: now };
}

export function withoutSongs(folder: Folder, ids: readonly string[], now = Date.now()): Folder {
  const drop = new Set(ids);
  const songIds = folder.songIds.filter((id) => !drop.has(id));
  return songIds.length === folder.songIds.length ? folder : { ...folder, songIds, updatedAt: now };
}

/** One key per library entry: the number for numbered songs (all versions share it), else the id. */
export function entryKey(song: Versioned): string {
  return song.number !== null ? `n${song.number}` : `id:${song.id}`;
}

/**
 * The library entries in a folder, as entry keys. Ids of songs that no longer
 * exist are ignored (they may linger after a restore).
 */
export function folderEntries(folder: Folder, byId: ReadonlyMap<string, Versioned>): Set<string> {
  const keys = new Set<string>();
  for (const id of folder.songIds) {
    const song = byId.get(id);
    if (song) keys.add(entryKey(song));
  }
  return keys;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
