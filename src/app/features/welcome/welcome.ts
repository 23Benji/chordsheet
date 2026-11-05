import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { currentPlatform, songImportAccept } from '../../core/platform';
import { SHARED_SETLIST_PATH } from '../../core/setlist-link';
import { IT } from '../../i18n/it';
import { ImportService } from '../../services/import.service';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { SyncService } from '../../services/sync.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';

/** First-run screen (empty library): import songs from a file, or start writing. */
@Component({
  selector: 'app-welcome',
  imports: [Icon],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Always the dark tokens: the text sits on the dark light-rays picture.
  host: { 'data-theme': 'dark' },
})
export class Welcome implements OnInit {
  private readonly library = inject(LibraryService);
  private readonly importer = inject(ImportService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly sync = inject(SyncService);
  protected readonly t = IT.welcome;
  protected readonly accept = songImportAccept(currentPlatform(), IT.importFiles.accept);
  protected readonly appName = IT.appName;
  protected readonly sharedSetlist = location.pathname.endsWith(`/${SHARED_SETLIST_PATH}`);

  /** Songs shipped with this build (none in the public version). */
  protected readonly bundled = signal(false);
  protected readonly progress = signal<{ done: number; total: number } | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  ngOnInit(): void {
    void this.library.bundledAvailable().then((available) => this.bundled.set(available));
  }

  protected async importBundled(): Promise<void> {
    this.error.set(false);
    this.progress.set({ done: 0, total: 0 });
    try {
      await this.library.importBundled((done, total) => this.progress.set({ done, total }));
    } catch (e) {
      console.error(e);
      this.error.set(true);
      this.progress.set(null);
    }
  }

  protected async importFiles(input: HTMLInputElement): Promise<void> {
    const files = input.files;
    if (!files?.length) return;
    this.busy.set(true);
    try {
      const chosen = await this.importer.read(files);
      this.toast.show(await this.importer.apply(chosen, 'skip'), 6000);
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }

  /** Start from an empty library with the editor. */
  protected writeFirstSong(): void {
    this.layout.forceShell.set(true);
    void this.router.navigate(['/nuovo']);
  }
}
