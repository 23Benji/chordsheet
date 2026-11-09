import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { daysAgo } from '../../core/backup-reminder';
import { shareOrDownload } from '../../core/export';
import { Settings, THEMES, isDarkTheme } from '../../core/models';
import { createSongbookFile, songbookFileName } from '../../core/songbook-file';
import { RouterLink } from '@angular/router';
import { IT } from '../../i18n/it';
import { BackupService } from '../../services/backup.service';
import { LibraryService } from '../../services/library.service';
import { SettingsService } from '../../services/settings.service';
import { SyncService } from '../../services/sync.service';
import { EraseService } from '../../services/erase.service';
import { ToastService } from '../../services/toast.service';
import { ActionSheet } from '../../ui/action-sheet';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icon';
import { ImportFlow } from '../../ui/import-flow';
import { KeymapDialog } from '../../ui/keymap-dialog';
import { ShareAppSheet } from '../../ui/share-app-sheet';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { Switch } from '../../ui/switch';
import { APP_VERSION } from '../../version';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN, stepTextSize } from '../../core/text-size';


/** Settings as grouped rows: icon · what it does · control on the right. */
@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, Icon, ConfirmDialog, KeymapDialog, Switch, SidebarToggle, ActionSheet, ShareAppSheet, ImportFlow],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly backup = inject(BackupService);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);
  private readonly eraser = inject(EraseService);
  protected readonly sync = inject(SyncService);
  /** Signed in to Google on this device: Drive keeps a copy, so backup reminders/options step back. */
  protected readonly synced = computed(() => this.sync.state() !== 'off');
  protected readonly lastSync = computed(() => {
    const at = this.sync.lastSyncAt();
    return at ? daysAgo(at, Date.now()) : null;
  });
  protected readonly ft = IT.folders;
  private readonly dialog = viewChild.required(ConfirmDialog);
  private readonly sheet = viewChild.required(ActionSheet);
  private readonly keymap = viewChild.required(KeymapDialog);
  protected readonly shareApp = viewChild.required(ShareAppSheet);
  protected readonly importFlow = viewChild.required(ImportFlow);
  protected readonly sa = IT.shareApp;
  protected readonly t = IT.settings;
  /** Where "‹" goes: the tab whose gear opened this page (passed as router state), else Libreria. */
  protected readonly back =
    history.state?.from === 'scalette' ? { link: '/scalette', label: IT.shell.setlists } : { link: '/', label: IT.shell.library };
  protected readonly version = APP_VERSION;
  protected readonly accidentalOptions = ['auto', 'sharps', 'flats'] as const;
  protected readonly instruments = ['guitar', 'piano', 'bass'] as const;
  protected readonly themes = THEMES;
  protected readonly fontMin = TEXT_SIZE_MIN;
  protected readonly fontMax = TEXT_SIZE_MAX;

  protected readonly settings = this.settingsService.settings;
  protected readonly darkTheme = computed(() => isDarkTheme(this.settingsService.theme()));
  protected readonly fontPercent = computed(() => Math.round((this.settings().textSize ?? 1) * 100));
  protected readonly appName = IT.appName;
  protected readonly autoStatus = this.backup.autoStatus;
  protected readonly autoFileName = this.backup.autoFileName;
  protected readonly lastBackup = computed(() => {
    const at = this.backup.lastBackupAt();
    return at ? daysAgo(at, Date.now()) : null;
  });
  /** "Canti inclusi" only makes sense when this build ships songs. */
  protected readonly bundled = signal(false);
  protected readonly storage = signal<{ usedMb: string; persisted: boolean } | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    void this.refreshStorage();
    void this.library.bundledAvailable().then((available) => this.bundled.set(available));
  }

  private async shareSongs(): Promise<void> {
    const json = JSON.stringify(createSongbookFile(this.library.songs()));
    await shareOrDownload(songbookFileName(), json);
  }

  protected set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    void this.settingsService.update({ [key]: value } as Partial<Settings>);
  }

  protected changeFont(delta: number): void {
    this.set('textSize', stepTextSize(this.settings().textSize ?? 1, delta));
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

  /** "Elimina tutti i dati": after a confirmation, wipe this device and start the app again from zero. */
  protected async eraseAll(): Promise<void> {
    if (!(await this.dialog().ask({ ...this.t.confirmErase(this.synced(), this.lastBackup() !== null), danger: true }))) return;
    this.busy.set(true);
    this.toast.show(this.t.erasing, 0);
    try {
      await this.eraser.eraseAll();
      // A fresh start at the app's first page: intro, then the start screen.
      location.replace(document.baseURI);
    } catch (e) {
      console.error(e);
      this.busy.set(false);
      this.toast.show(this.t.eraseFailed, 8000);
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

  protected async refreshStorage(): Promise<void> {
    try {
      const estimate = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (estimate) this.storage.set({ usedMb: ((estimate.usage ?? 0) / 1024 / 1024).toFixed(1), persisted });
    } catch {
      this.storage.set(null);
    }
  }
}
