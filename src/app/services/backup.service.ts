import { Injectable, inject } from '@angular/core';
import { BackupData, backupFileName, createBackup, mergeBackup, parseBackup } from '../core/backup';
import { shareOrDownload } from '../core/export';
import { DB } from '../data/db';
import { AnnotationService } from './annotation.service';
import { LibraryService } from './library.service';
import { SetlistService } from './setlist.service';
import { SettingsService } from './settings.service';
import { SongPrefsService } from './song-prefs.service';

export type RestoreMode = 'merge' | 'replace';

/** Backup of everything (songs, prefs, notes, setlists, settings) and restore. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(DB);
  private readonly library = inject(LibraryService);
  private readonly prefs = inject(SongPrefsService);
  private readonly annotations = inject(AnnotationService);
  private readonly setlists = inject(SetlistService);
  private readonly settings = inject(SettingsService);

  private async readAll(): Promise<BackupData> {
    const stored = await this.db.settings.get('settings');
    const settings = stored ? (({ id: _id, ...rest }) => rest)(stored) : null;
    return {
      songs: await this.db.songs.toArray(),
      songPrefs: await this.db.songPrefs.toArray(),
      annotations: await this.db.annotations.toArray(),
      setlists: await this.db.setlists.toArray(),
      settings,
    };
  }

  async export(): Promise<void> {
    const json = JSON.stringify(createBackup(await this.readAll()));
    await shareOrDownload(backupFileName(), json);
  }

  /**
   * Restores a backup file. "merge" adds/updates without losing local data;
   * "replace" makes this device an exact copy of the backup.
   * Throws on files that aren't backups (nothing is changed then).
   */
  async restore(json: string, mode: RestoreMode): Promise<BackupData> {
    const incoming = parseBackup(json);
    const result =
      mode === 'merge' ? mergeBackup(await this.readAll(), incoming) : { ...incoming, settings: incoming.settings };
    const db = this.db;
    // One transaction: if anything fails, the old data stays as it was.
    await db.transaction('rw', [db.songs, db.songPrefs, db.annotations, db.setlists, db.settings], async () => {
      await Promise.all([db.songs.clear(), db.songPrefs.clear(), db.annotations.clear(), db.setlists.clear()]);
      await db.songs.bulkPut(result.songs);
      await db.songPrefs.bulkPut(result.songPrefs);
      await db.annotations.bulkPut(result.annotations);
      await db.setlists.bulkPut(result.setlists);
      if (result.settings) await db.settings.put({ ...result.settings, id: 'settings' });
    });
    await Promise.all([
      this.library.load(),
      this.prefs.load(),
      this.annotations.load(),
      this.setlists.load(),
      this.settings.load(),
    ]);
    return result;
  }
}
