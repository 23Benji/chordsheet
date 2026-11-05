import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { daysAgo } from '../../core/backup-reminder';
import { shareOrDownload } from '../../core/export';
import { Settings, THEMES, isDarkTheme } from '../../core/models';
import { ImportedFiles, createSongbookFile, songbookFileName } from '../../core/songbook-file';
import { currentPlatform, songImportAccept } from '../../core/platform';
import { RouterLink } from '@angular/router';
import { IT } from '../../i18n/it';
import { BackupService, RestoreMode } from '../../services/backup.service';
import { FolderService } from '../../services/folder.service';
import { ConflictPolicy, ImportService } from '../../services/import.service';
import { LibraryService } from '../../services/library.service';
import { SettingsService } from '../../services/settings.service';
import { SyncService } from '../../services/sync.service';
import { ToastService } from '../../services/toast.service';
import { ActionSheet } from '../../ui/action-sheet';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FolderPicker } from '../../ui/folder-picker';
import { Icon } from '../../ui/icon';
import { Haptic } from '../../ui/haptic';
import { KeymapDialog } from '../../ui/keymap-dialog';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { Switch } from '../../ui/switch';
import { APP_VERSION } from '../../version';

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;

/** Settings as grouped rows: icon · what it does · control on the right. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, Icon, ConfirmDialog, KeymapDialog, Switch, SidebarToggle, FolderPicker, ActionSheet, Haptic],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly backup = inject(BackupService);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);
  private readonly importer = inject(ImportService);
  private readonly folders = inject(FolderService);
  protected readonly sync = inject(SyncService);
  /** Signed in to Google on this device: Drive keeps a copy, so backup reminders/options step back. */
  protected readonly synced = computed(() => this.sync.state() !== 'off');
  protected readonly lastSync = computed(() => {
    const at = this.sync.lastSyncAt();
    return at ? daysAgo(at, Date.now()) : null;
  });
  protected readonly ft = IT.folders;
  private readonly importDialog = viewChild.required<ElementRef<HTMLDialogElement>>('importDialog');
  protected readonly it = IT.importFiles;
  protected readonly songsAccept = songImportAccept(currentPlatform(), IT.importFiles.accept);
  private readonly dialog = viewChild.required(ConfirmDialog);
  private readonly sheet = viewChild.required(ActionSheet);
  private readonly keymap = viewChild.required(KeymapDialog);
  private readonly restoreDialog = viewChild.required<ElementRef<HTMLDialogElement>>('restoreDialog');
  protected readonly t = IT.settings;
  protected readonly tuner = IT.tuner;
  /** Phones and tablets: the "Vibrazione" row (computers don't vibrate). */
  protected readonly touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  protected readonly backLabel = IT.song.backToLibrary;
  protected readonly version = APP_VERSION;
  protected readonly accidentalOptions = ['auto', 'sharps', 'flats'] as const;
  protected readonly instruments = ['guitar', 'piano', 'bass'] as const;
  protected readonly themes = THEMES;
  protected readonly fontMin = FONT_MIN;
  protected readonly fontMax = FONT_MAX;

  protected readonly settings = this.settingsService.settings;
  protected readonly darkTheme = computed(() => isDarkTheme(this.settingsService.theme()));
  protected readonly fontPercent = computed(() => Math.round(this.settings().fontScale * 100));
  protected readonly appName = IT.appName;
  protected readonly autoStatus = this.backup.autoStatus;
  protected readonly autoFileName = this.backup.autoFileName;
  protected readonly lastBackup = computed(() => {
    const at = this.backup.lastBackupAt();
    return at ? daysAgo(at, Date.now()) : null;
  });
  /** "Canti inclusi" only makes sense when this build ships songs. */
  protected readonly bundled = signal(false);
  /** Files chosen in "Importa canti", waiting for the folder choice (and what to do with songs that already exist). */
  protected readonly pendingImport = signal<{ files: ImportedFiles; conflicts: number } | null>(null);
  /** Folders for the songs being imported; starts with the folder open in the library. */
  protected readonly importFolders = signal<string[]>([]);

  /** Backup file chosen, waiting for "Unisci" or "Sostituisci". */
  protected readonly pendingRestore = signal<{ name: string; json: string } | null>(null);
  protected readonly restoreError = signal<string | null>(null);
  protected readonly storage = signal<{ usedMb: string; persisted: boolean } | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    void this.refreshStorage();
    void this.library.bundledAvailable().then((available) => this.bundled.set(available));
  }

  protected async chooseSongs(input: HTMLInputElement): Promise<void> {
    const list = input.files;
    if (!list?.length) return;
    const name = list[0].name;
    const files = await this.importer.read(list);
    input.value = '';
    if (!files.songs.length && files.backups.length === 1) {
      // A backup: ask whether to add it to what is here or to replace everything.
      this.restoreError.set(null);
      this.pendingRestore.set({ name, json: files.backups[0] });
      this.restoreDialog().nativeElement.showModal();
      return;
    }
    if (!files.songs.length) {
      // Only backups (or unknown files): nothing to file in a folder.
      await this.runImport(files, 'skip');
      return;
    }
    const current = this.folders.current();
    this.importFolders.set(current ? [current] : []);
    this.pendingImport.set({ files, conflicts: this.importer.conflicts(files) });
    this.importDialog().nativeElement.showModal();
  }

  protected async resolveImport(policy: ConflictPolicy | null): Promise<void> {
    const pending = this.pendingImport();
    this.importDialog().nativeElement.close();
    this.pendingImport.set(null);
    if (pending && policy) await this.runImport(pending.files, policy, this.importFolders());
  }

  private async runImport(files: ImportedFiles, policy: ConflictPolicy, folderIds: string[] = []): Promise<void> {
    this.busy.set(true);
    try {
      this.toast.show(await this.importer.apply(files, policy, folderIds), 6000);
    } finally {
      this.busy.set(false);
      void this.refreshStorage();
    }
  }

  private async shareSongs(): Promise<void> {
    const json = JSON.stringify(createSongbookFile(this.library.songs()));
    await shareOrDownload(songbookFileName(), json);
  }

  protected set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    void this.settingsService.update({ [key]: value } as Partial<Settings>);
  }

  protected changeFont(delta: number): void {
    const next = Math.round((this.settings().fontScale + delta) * 10) / 10;
    this.set('fontScale', Math.min(FONT_MAX, Math.max(FONT_MIN, next)));
  }

  /** The Google Drive row: sign in, or (when connected) "Sincronizza ora" / "Esci". */
  protected async syncRow(): Promise<void> {
    const state = this.sync.state();
    if (state === 'off' || state === 'expired') return this.sync.signIn();
    const choice = await this.sheet().choose(
      this.t.syncAccount(this.sync.email()),
      [
        { id: 'now', label: this.t.syncNow, icon: 'refresh' },
        { id: 'out', label: this.t.syncOut, icon: 'logOut', danger: true, divider: true },
      ],
      this.t.cancel,
    );
    if (choice === 'now') await this.sync.sync();
    if (choice === 'out' && (await this.dialog().ask({ ...this.t.confirmSyncOut }))) await this.sync.signOut();
  }

  /** "Esporta": a full backup (to keep) or only the songs (to share, without personal notes). */
  protected async exportMenu(): Promise<void> {
    const choice = await this.sheet().choose(
      this.t.exportAll,
      [
        { id: 'backup', label: this.t.exportBackup, icon: 'fileDown' },
        { id: 'songs', label: this.t.exportSongs, icon: 'share' },
      ],
      this.t.cancel,
    );
    if (choice === 'backup') await this.backup.export();
    if (choice === 'songs') await this.shareSongs();
  }

  protected openKeys(): void {
    this.keymap().open();
  }

  protected closeRestore(): void {
    this.restoreDialog().nativeElement.close();
    this.pendingRestore.set(null);
  }

  protected async restore(mode: RestoreMode): Promise<void> {
    const pending = this.pendingRestore();
    if (!pending) return;
    if (mode === 'replace') {
      this.restoreDialog().nativeElement.close();
      if (!(await this.dialog().ask({ ...this.t.confirmReplace, danger: true }))) return this.pendingRestore.set(null);
    }
    this.busy.set(true);
    try {
      const data = await this.backup.restore(pending.json, mode);
      this.toast.show(this.t.restored(data.songs.length, data.setlists.length));
    } catch {
      this.restoreError.set(this.t.restoreError);
      this.toast.show(this.t.restoreError);
    } finally {
      this.busy.set(false);
      this.closeRestore();
      void this.refreshStorage();
    }
  }

  protected async restoreBundled(): Promise<void> {
    if (!(await this.dialog().ask({ ...this.t.confirmBundled }))) return;
    this.busy.set(true);
    try {
      const added = await this.library.importBundled();
      this.toast.show(added ? this.t.bundledAdded(added) : this.t.bundledNone);
    } finally {
      this.busy.set(false);
    }
  }

  protected async requestPersist(): Promise<void> {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    if (!granted) this.toast.show(this.t.persistRefused, 10000);
    void this.refreshStorage();
  }

  protected async toggleAuto(on: boolean): Promise<void> {
    if (on) await this.backup.enableAuto();
    else await this.backup.disableAuto();
  }

  protected resumeAuto(): Promise<boolean> {
    return this.backup.resumeAuto();
  }

  private async refreshStorage(): Promise<void> {
    try {
      const estimate = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (estimate) this.storage.set({ usedMb: ((estimate.usage ?? 0) / 1024 / 1024).toFixed(1), persisted });
    } catch {
      this.storage.set(null);
    }
  }
}
