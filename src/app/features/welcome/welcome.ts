import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { LogoMark, LogoState } from '../../ui/logo-mark';

/** How long "142 canti arrivati" stays before the library comes in. */
export const WELCOME_DONE_MS = 1400;

/**
 * First-run screen (empty library): the logo in the middle, and below it the
 * ways to get songs — a file, the user's Google Drive, or writing one.
 *
 * While songs arrive (import or the first Google sync) the logo itself is the
 * progress indicator; when they're in, the screen says how many arrived, waits
 * a moment and hands over to the library (LayoutService.holdWelcome keeps it
 * on screen meanwhile, because the app would otherwise switch at once).
 */
@Component({
  selector: 'app-welcome',
  imports: [Icon, LogoMark],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Always the dark tokens: the text sits on the dark light-rays picture.
  host: { 'data-theme': 'dark' },
})
export class Welcome implements OnInit, OnDestroy {
  private readonly library = inject(LibraryService);
  private readonly importer = inject(ImportService);
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly sync = inject(SyncService);
  protected readonly t = IT.welcome;
  protected readonly accept = songImportAccept(currentPlatform(), IT.importFiles.accept);
  protected readonly appName = IT.appName;
  protected readonly sharedSetlist = location.pathname.endsWith(`/${SHARED_SETLIST_PATH}`);

  /** Songs shipped with this build (none in the public version). */
  protected readonly bundled = signal(false);
  /** Songs are being imported: what to say under the logo. */
  protected readonly working = signal<string | null>(null);
  /** Songs are in: the message shown before the library opens. */
  protected readonly done = signal<string | null>(null);
  protected readonly error = signal(false);

  protected readonly syncing = computed(() => this.sync.state() === 'syncing' && this.sync.available);
  protected readonly logoState = computed<LogoState>(() =>
    this.done() ? 'done' : this.working() || this.syncing() ? 'loading' : 'still',
  );

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The first sync on a new device: hold this screen while it runs, then
    // say how many songs came from Google Drive.
    effect(() => {
      const state = this.sync.state();
      untracked(() => {
        if (state === 'syncing') this.layout.holdWelcome.set(true);
        else if (this.layout.holdWelcome() && !this.working() && !this.done()) {
          const count = this.library.songs().length;
          if (count > 0) this.finish(this.t.arrived(count));
          else this.layout.holdWelcome.set(false); // nothing in the Drive, or offline: stay here
        }
      });
    });
  }

  ngOnInit(): void {
    void this.library.bundledAvailable().then((available) => this.bundled.set(available));
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  protected async importBundled(): Promise<void> {
    this.error.set(false);
    this.layout.holdWelcome.set(true);
    this.working.set(this.t.importing(0, 0));
    try {
      await this.library.importBundled((done, total) => this.working.set(this.t.importing(done, total)));
      this.finish(this.t.imported(this.library.songs().length));
    } catch (e) {
      console.error(e);
      this.error.set(true);
      this.working.set(null);
      this.layout.holdWelcome.set(false);
    }
  }

  protected async importFiles(input: HTMLInputElement): Promise<void> {
    const files = input.files;
    if (!files?.length) return;
    this.error.set(false);
    this.layout.holdWelcome.set(true);
    this.working.set(this.t.importingFiles);
    try {
      const chosen = await this.importer.read(files);
      const message = await this.importer.apply(chosen, 'skip');
      if (this.library.songs().length > 0) this.finish(message);
      else {
        // Nothing usable in those files: stay here and say so.
        this.working.set(null);
        this.layout.holdWelcome.set(false);
        this.toast.show(message, 6000);
      }
    } catch (e) {
      console.error(e);
      this.error.set(true);
      this.working.set(null);
      this.layout.holdWelcome.set(false);
    } finally {
      input.value = '';
    }
  }

  /** Start from an empty library with the editor. */
  protected writeFirstSong(): void {
    this.layout.forceShell.set(true);
    void this.router.navigate(['/nuovo']);
  }

  /** Show the result for a moment, then let the library in. */
  private finish(message: string): void {
    this.working.set(null);
    this.done.set(message);
    this.timer = setTimeout(() => {
      this.layout.fromWelcome.set(true);
      this.layout.holdWelcome.set(false);
    }, WELCOME_DONE_MS);
  }
}
