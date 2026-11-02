import { Injectable, inject, signal } from '@angular/core';
import { BackupData, backupFileName, createBackup, mergeBackup, parseBackup } from '../core/backup';
import { shareOrDownload } from '../core/export';
import { DB } from '../data/db';
import { AnnotationService } from './annotation.service';
import { LibraryService } from './library.service';
import { SetlistService } from './setlist.service';
import { SettingsService } from './settings.service';
import { SongPrefsService } from './song-prefs.service';

export type RestoreMode = 'merge' | 'replace';
export type AutoBackupStatus = 'unsupported' | 'off' | 'active' | 'paused';

const LAST_BACKUP = 'lastBackupAt';
const AUTO_HANDLE = 'autoBackupHandle';
/** Wait this long after the last change before rewriting the auto-backup file. */
const AUTO_DELAY_MS = 4000;

/**
 * Backup of everything (songs, prefs, notes, setlists, settings), restore,
 * and the automatic backup file: on Chrome/Edge on a computer the user picks
 * a file once (ideally in an iCloud / Google Drive / OneDrive folder) and the
 * app rewrites it a few seconds after every change. The data then also lives
 * outside the browser.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(DB);
  private readonly library = inject(LibraryService);
  private readonly prefs = inject(SongPrefsService);
  private readonly annotations = inject(AnnotationService);
  private readonly setlists = inject(SetlistService);
  private readonly settings = inject(SettingsService);

  /** When the last backup (manual or automatic) was made. */
  readonly lastBackupAt = signal<number | undefined>(undefined);
  readonly autoStatus = signal<AutoBackupStatus>(
    typeof window !== 'undefined' && 'showSaveFilePicker' in window ? 'off' : 'unsupported',
  );
  readonly autoFileName = signal<string | null>(null);

  private handle: FileSystemFileHandle | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Dexie hooks: any change to the user's data schedules an auto-backup.
    const db = this.db;
    for (const table of [db.songs, db.songPrefs, db.annotations, db.setlists, db.settings]) {
      if (typeof table?.hook !== 'function') continue; // test doubles
      const schedule = () => this.scheduleAutoBackup();
      table.hook('creating', schedule);
      table.hook('updating', schedule);
      table.hook('deleting', schedule);
    }
  }

  async load(): Promise<void> {
    if (!this.db.kv) return;
    this.lastBackupAt.set((await this.db.kv.get(LAST_BACKUP))?.value as number | undefined);
    const handle = (await this.db.kv.get(AUTO_HANDLE))?.value as FileSystemFileHandle | undefined;
    if (!handle || this.autoStatus() === 'unsupported') return;
    this.handle = handle;
    this.autoFileName.set(handle.name);
    // After a restart the browser may want the user to allow writing again.
    const permission = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState);
    this.autoStatus.set(permission === 'granted' ? 'active' : 'paused');
  }

  private async markBackedUp(): Promise<void> {
    const now = Date.now();
    this.lastBackupAt.set(now);
    await this.db.kv?.put({ key: LAST_BACKUP, value: now });
  }

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
    if (await shareOrDownload(backupFileName(), json)) await this.markBackedUp();
  }

  // ── Automatic backup file ──────────────────────────────────────────────────

  /** Must be called from a click: the browser shows the "save as" dialog. */
  async enableAuto(): Promise<boolean> {
    if (!window.showSaveFilePicker) return false;
    try {
      this.handle = await window.showSaveFilePicker({
        suggestedName: 'chordsheet-backup-automatico.json',
        types: [{ description: 'Backup Chordsheet', accept: { 'application/json': ['.json'] } }],
      });
    } catch {
      return false; // the user cancelled
    }
    await this.db.kv?.put({ key: AUTO_HANDLE, value: this.handle });
    this.autoFileName.set(this.handle.name);
    this.autoStatus.set('active');
    await this.writeAuto();
    return true;
  }

  async disableAuto(): Promise<void> {
    clearTimeout(this.timer);
    this.handle = null;
    this.autoFileName.set(null);
    this.autoStatus.set('off');
    await this.db.kv?.delete(AUTO_HANDLE);
  }

  /** "Riattiva": asks the browser again for permission to write the file (needs a click). */
  async resumeAuto(): Promise<boolean> {
    const permission = await this.handle?.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied' as const);
    if (permission !== 'granted') return false;
    this.autoStatus.set('active');
    await this.writeAuto();
    return true;
  }

  private scheduleAutoBackup(): void {
    if (this.autoStatus() !== 'active') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.writeAuto(), AUTO_DELAY_MS);
  }

  private async writeAuto(): Promise<void> {
    if (!this.handle) return;
    try {
      const writable = await this.handle.createWritable();
      await writable.write(JSON.stringify(createBackup(await this.readAll())));
      await writable.close();
      await this.markBackedUp();
    } catch {
      // Permission lost (or file moved): wait for "Riattiva".
      this.autoStatus.set('paused');
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────────

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
