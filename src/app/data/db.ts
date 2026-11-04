// IndexedDB schema via Dexie (SPEC §4). All user data lives here, on device.
import { InjectionToken } from '@angular/core';
import Dexie, { type EntityTable } from 'dexie';
import { Annotation, Folder, Setlist, Settings, Song, SongPrefs } from '../core/models';

export type StoredSettings = Settings & { id: 'settings' };

export class AppDb extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  songPrefs!: EntityTable<SongPrefs, 'songId'>;
  annotations!: EntityTable<Annotation, 'id'>;
  setlists!: EntityTable<Setlist, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  settings!: EntityTable<StoredSettings, 'id'>;
  /** Small device-only values (last backup date, auto-backup file handle). Not in backups. */
  kv!: EntityTable<{ key: string; value: unknown }, 'key'>;

  constructor() {
    // The IndexedDB name keeps the app's original name: renaming it would lose existing data.
    super('innario');
    // Only indexed fields are listed; every other field is stored anyway.
    this.version(1).stores({
      songs: 'id, [number+suffix], title',
      songPrefs: 'songId',
      annotations: 'id, songId',
      setlists: 'id',
      settings: 'id',
    });
    // Version 2 adds the key-value table (Dexie keeps the tables of version 1).
    this.version(2).stores({ kv: 'key' });
    // Version 3 adds folders ("cartelle"). Existing data is untouched.
    this.version(3).stores({ folders: 'id' });
  }
}

/**
 * The database is provided through an InjectionToken (instead of a global
 * `new AppDb()`) so tests can swap in a fake.
 */
export const DB = new InjectionToken<AppDb>('AppDb', {
  providedIn: 'root',
  factory: () => new AppDb(),
});
