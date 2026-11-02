// IndexedDB schema via Dexie (SPEC §4). All user data lives here, on device.
import { InjectionToken } from '@angular/core';
import Dexie, { type EntityTable } from 'dexie';
import { Annotation, Setlist, Settings, Song, SongPrefs } from '../core/models';

export type StoredSettings = Settings & { id: 'settings' };

export class InnarioDb extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  songPrefs!: EntityTable<SongPrefs, 'songId'>;
  annotations!: EntityTable<Annotation, 'id'>;
  setlists!: EntityTable<Setlist, 'id'>;
  settings!: EntityTable<StoredSettings, 'id'>;

  constructor() {
    super('innario');
    // Only indexed fields are listed; every other field is stored anyway.
    this.version(1).stores({
      songs: 'id, [number+suffix], title',
      songPrefs: 'songId',
      annotations: 'id, songId',
      setlists: 'id',
      settings: 'id',
    });
  }
}

/**
 * The database is provided through an InjectionToken (instead of a global
 * `new InnarioDb()`) so tests can swap in a fake.
 */
export const DB = new InjectionToken<InnarioDb>('InnarioDb', {
  providedIn: 'root',
  factory: () => new InnarioDb(),
});
