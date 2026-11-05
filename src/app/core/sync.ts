// Sync between the user's devices through one file in their own cloud storage
// (Google Drive's hidden app folder). Pure logic only: the network part is in
// services/sync.service.ts and services/google-drive.ts.
//
// The merge is a "three-way merge", like git: besides this device's data
// (local) and the cloud file (remote) we keep a copy of what both looked like
// after the last sync (base). Comparing each record with the base tells us who
// changed it, and also who *deleted* it — something a two-way merge can't see
// (it would bring deleted notes back).
import { BackupData } from './backup';
import { normalize } from './search';

/** What is synced: everything except the settings (font size, theme… stay per device). */
export type SyncData = Omit<BackupData, 'settings'>;

export const EMPTY_SYNC_DATA: SyncData = { songs: [], songPrefs: [], annotations: [], setlists: [], folders: [] };

export function toSyncData(data: BackupData): SyncData {
  const { settings: _settings, ...rest } = data;
  return rest;
}

/** JSON with sorted keys: the same record from two devices gives the same string. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
}

const same = (a: unknown, b: unknown) => (a === undefined || b === undefined ? a === b : stableStringify(a) === stableStringify(b));

/**
 * One record (undefined = doesn't exist / was deleted):
 * - nobody changed it, or both made the same change → keep it
 * - only one side changed it (or deleted it) → take that change
 * - both changed it → an edit beats a delete; otherwise the newer edit wins
 */
function pick<T extends object>(base: T | undefined, local: T | undefined, remote: T | undefined): T | undefined {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (!local) return remote;
  if (!remote) return local;
  const time = (x: T) => ('updatedAt' in x && typeof x.updatedAt === 'number' ? x.updatedAt : 0);
  return time(remote) > time(local) ? remote : local;
}

function mergeTable<T extends object>(key: (x: T) => string, base: T[], local: T[], remote: T[]): T[] {
  const b = new Map(base.map((x) => [key(x), x]));
  const l = new Map(local.map((x) => [key(x), x]));
  const r = new Map(remote.map((x) => [key(x), x]));
  const out: T[] = [];
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const kept = pick(b.get(id), l.get(id), r.get(id));
    if (kept) out.push(kept);
  }
  return out;
}

const songKey = (s: { number: number | null; suffix: string; title: string }) =>
  s.number !== null ? `#${s.number}${s.suffix}` : `t:${normalize(s.title)}`;

/**
 * Each device imported the songbook with its own random ids. Before merging,
 * a local song that has never been synced and matches a cloud song (same
 * number + suffix, or same title when it has no number) takes the cloud id,
 * everywhere it is referenced. From then on all devices share the same ids.
 */
export function adoptRemoteIds(local: SyncData, remote: SyncData, base: SyncData): { data: SyncData; renamed: Map<string, string> } {
  const remoteIds = new Set(remote.songs.map((s) => s.id));
  const localIds = new Set(local.songs.map((s) => s.id));
  const baseIds = new Set(base.songs.map((s) => s.id));
  const remoteByKey = new Map<string, string>();
  for (const s of remote.songs) if (!localIds.has(s.id) && !remoteByKey.has(songKey(s))) remoteByKey.set(songKey(s), s.id);

  const renamed = new Map<string, string>();
  for (const s of local.songs) {
    if (remoteIds.has(s.id) || baseIds.has(s.id)) continue;
    const target = remoteByKey.get(songKey(s));
    if (target) {
      renamed.set(s.id, target);
      remoteByKey.delete(songKey(s)); // one local song per cloud song
    }
  }
  if (!renamed.size) return { data: local, renamed };

  const id = (x: string) => renamed.get(x) ?? x;
  return {
    renamed,
    data: {
      songs: local.songs.map((s) => ({ ...s, id: id(s.id) })),
      songPrefs: local.songPrefs.map((p) => ({ ...p, songId: id(p.songId) })),
      annotations: local.annotations.map((a) => ({ ...a, songId: id(a.songId) })),
      setlists: local.setlists.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, songId: id(i.songId) })) })),
      folders: local.folders.map((f) => ({ ...f, songIds: [...new Set(f.songIds.map(id))] })),
    },
  };
}

export interface SyncResult {
  /** The new state: written to this device, uploaded, and kept as the next base. */
  data: SyncData;
  /** Local song ids that changed (old → new), e.g. to fix the URL of the open song. */
  renamed: Map<string, string>;
}

/** base = null: first sync of this device. */
export function syncMerge(base: SyncData | null, local: SyncData, remote: SyncData): SyncResult {
  const b = base ?? EMPTY_SYNC_DATA;
  const { data: l, renamed } = adoptRemoteIds(local, remote, b);
  const byId = (x: { id: string }) => x.id;
  const songs = mergeTable(byId, b.songs, l.songs, remote.songs);
  const songIds = new Set(songs.map((s) => s.id));
  // Notes and preferences of a song deleted on another device go with it.
  const ofExisting = <T extends { songId: string }>(list: T[]) => list.filter((x) => songIds.has(x.songId));
  return {
    renamed,
    data: {
      songs,
      songPrefs: ofExisting(mergeTable((p) => p.songId, b.songPrefs, l.songPrefs, remote.songPrefs)),
      annotations: ofExisting(mergeTable(byId, b.annotations, l.annotations, remote.annotations)),
      setlists: mergeTable(byId, b.setlists, l.setlists, remote.setlists),
      folders: mergeTable(byId, b.folders, l.folders, remote.folders),
    },
  };
}

/** True when two states hold the same records (order doesn't matter). */
export function sameSyncData(a: SyncData, b: SyncData): boolean {
  const sorted = (d: SyncData) =>
    (Object.keys(EMPTY_SYNC_DATA) as (keyof SyncData)[]).map((k) =>
      (d[k] as object[]).map((x) => stableStringify(x)).sort(),
    );
  return stableStringify(sorted(a)) === stableStringify(sorted(b));
}
