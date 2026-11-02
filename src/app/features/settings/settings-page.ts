import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { daysAgo } from '../../core/backup-reminder';
import { shareOrDownload } from '../../core/export';
import { Settings } from '../../core/models';
import { ImportedFiles, createSongbookFile, songbookFileName } from '../../core/songbook-file';
import { IT } from '../../i18n/it';
import { BackupService, RestoreMode } from '../../services/backup.service';
import { ConflictPolicy, ImportService } from '../../services/import.service';
import { LibraryService } from '../../services/library.service';
import { SettingsService } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icon';
import { KeymapDialog } from '../../ui/keymap-dialog';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { Switch } from '../../ui/switch';
import { APP_VERSION } from '../../version';

const FONT_MIN = 0.8;
const FONT_MAX = 1.6;

/** Settings as grouped rows: icon · what it does · control on the right. */
@Component({
  selector: 'app-settings-page',
  imports: [Icon, ConfirmDialog, KeymapDialog, Switch, SidebarToggle],
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
  private readonly importDialog = viewChild.required<ElementRef<HTMLDialogElement>>('importDialog');
  protected readonly it = IT.importFiles;
  private readonly dialog = viewChild.required(ConfirmDialog);
  private readonly keymap = viewChild.required(KeymapDialog);
  private readonly restoreDialog = viewChild.required<ElementRef<HTMLDialogElement>>('restoreDialog');
  protected readonly t = IT.settings;
  protected readonly version = APP_VERSION;
  protected readonly accidentalOptions = ['auto', 'sharps', 'flats'] as const;
  protected readonly fontMin = FONT_MIN;
  protected readonly fontMax = FONT_MAX;

  protected readonly settings = this.settingsService.settings;
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
  /** Files chosen in "Importa canti", waiting for a decision about songs that already exist. */
  protected readonly pendingImport = signal<{ files: ImportedFiles; conflicts: number } | null>(null);

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
    const files = await this.importer.read(list);
    input.value = '';
    const conflicts = this.importer.conflicts(files);
    if (conflicts) {
      this.pendingImport.set({ files, conflicts });
      this.importDialog().nativeElement.showModal();
    } else {
      await this.runImport(files, 'skip');
    }
  }

  protected async resolveImport(policy: ConflictPolicy | null): Promise<void> {
    const pending = this.pendingImport();
    this.importDialog().nativeElement.close();
    this.pendingImport.set(null);
    if (pending && policy) await this.runImport(pending.files, policy);
  }

  private async runImport(files: ImportedFiles, policy: ConflictPolicy): Promise<void> {
    this.busy.set(true);
    try {
      this.toast.show(await this.importer.apply(files, policy), 6000);
    } finally {
      this.busy.set(false);
      void this.refreshStorage();
    }
  }

  protected async shareSongs(): Promise<void> {
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

  protected openKeys(): void {
    this.keymap().open();
  }

  protected exportBackup(): Promise<void> {
    return this.backup.export();
  }

  protected async chooseBackup(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.restoreError.set(null);
    this.pendingRestore.set({ name: file.name, json: await file.text() });
    this.restoreDialog().nativeElement.showModal();
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
