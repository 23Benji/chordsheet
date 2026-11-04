import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs';
import { LibrarySidebar } from './features/library/library-sidebar';
import { Welcome } from './features/welcome/welcome';
import { IT } from './i18n/it';
import { LayoutService } from './services/layout.service';
import { LibraryService } from './services/library.service';
import { ToastService } from './services/toast.service';
import { Icon } from './ui/icon';

/** App shell: welcome screen while the library is empty, else sidebar + routed main area. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, LibrarySidebar, Welcome, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly library = inject(LibraryService);
  protected readonly layout = inject(LayoutService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly t = IT.shell;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /**
   * Is the library visible? On phones it follows the URL: "/" is the library
   * page. So iOS's swipe-back from a song (history back to "/") lands on the
   * list instead of the empty "Scegli un canto" page. Elsewhere: the drawer.
   */
  protected readonly libraryShown = computed(() =>
    this.layout.phone() ? this.url().split(/[?#]/)[0] === '/' : this.layout.sidebarOpen(),
  );
  /** Editor open: a full-screen task with its own Annulla/Salva, so no bottom bar. */
  protected readonly editing = computed(() => /^\/nuovo|\/modifica(\?|$)/.test(this.url()));
  /** Which bottom-bar tab is active. */
  protected readonly section = computed(() => {
    const url = this.url();
    if (url.startsWith('/scalette')) return 'setlists';
    if (url.startsWith('/impostazioni')) return 'settings';
    return 'library';
  });

  constructor() {
    // The service worker downloaded a new version: offer to reload into it.
    const updates = inject(SwUpdate);
    if (updates.isEnabled) {
      const subscription = updates.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() =>
          this.toast.show(IT.shell.updateReady, 0, { label: IT.shell.update, run: () => document.location.reload() }),
        );
      inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    }
  }

  /** "Libreria" on the iPhone bar: show the song list. */
  protected openLibrary(): void {
    if (this.layout.phone()) {
      if (this.section() === 'library' && this.router.url === '/') this.layout.libraryToTop.update((n) => n + 1);
      else void this.router.navigate(['/']);
      return;
    }
    if (this.section() !== 'library') void this.router.navigate(['/']);
    this.layout.sidebarOpen.set(true);
  }
}
