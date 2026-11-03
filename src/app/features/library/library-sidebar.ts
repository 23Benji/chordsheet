import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Song } from '../../core/models';
import { searchSongs } from '../../core/search';
import { compareByNumber, compareByTitle, numberLabel } from '../../core/song-meta';
import { collapseVersions, mainVersion } from '../../core/versions';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { HintBanner } from '../../ui/hint-banner';
import { FabMenu } from '../../ui/fab-menu';
import { Icon } from '../../ui/icon';

type LibraryFilter = 'all' | 'notes';
type LibrarySort = 'number' | 'title';

@Component({
  selector: 'app-library-sidebar',
  imports: [RouterLink, Icon, HintBanner, FabMenu],
  templateUrl: './library-sidebar.html',
  styleUrl: './library-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class LibrarySidebar {
  private readonly library = inject(LibraryService);
  private readonly annotations = inject(AnnotationService);
  private readonly prefs = inject(SongPrefsService);
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);
  protected readonly t = IT.library;
  protected readonly st = IT.setlists;
  protected readonly ss = IT.settings;
  protected readonly numberLabel = numberLabel;

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly query = signal('');
  protected readonly filter = signal<LibraryFilter>('all');
  protected readonly sort = signal<LibrarySort>('number');
  /** Row highlighted with the arrow keys while typing in the search box. */
  protected readonly activeIndex = signal(0);

  protected readonly filters: LibraryFilter[] = ['all', 'notes'];
  /** Notes, highlights, personal chords or a Promemoria. */
  protected readonly songsWithNotes = computed(
    () => new Set([...this.annotations.songsWithNotes(), ...this.prefs.songsWithMemo()]),
  );
  protected readonly songsWithTabs = this.annotations.songsWithTabs;

  /**
   * The router exposes navigation as an RxJS Observable; `toSignal` turns it
   * into a signal so it can be used inside `computed` like everything else.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly currentId = computed(
    () => /\/canto\/([^/?#]+)/.exec(this.url())?.[1] ?? null,
  );
  protected readonly onSetlists = computed(() => this.url().startsWith('/scalette'));
  /** Number of the open song: its row stays highlighted whichever version is open. */
  private readonly currentNumber = computed(() => {
    const id = this.currentId();
    return id ? (this.library.byId().get(id)?.number ?? null) : null;
  });

  /**
   * Filter → sort → search → one row per number. Recomputed only when one of
   * its inputs changes.
   */
  protected readonly results = computed<Song[]>(() => {
    const songs = this.library.songs().filter(this.matchesFilter(this.filter()));
    songs.sort(this.sort() === 'title' ? compareByTitle : compareByNumber);
    const entries = new Map(this.library.searchEntries().map((e) => [e.id, e]));
    const byId = this.library.byId();
    const ranked = searchSongs(
      songs.map((s) => entries.get(s.id)!),
      this.query(),
    ).map((id) => byId.get(id)!);
    // With a query the best-matching version represents the group ("123c" +
    // Enter opens 123c); without one, the main version does.
    const rows = collapseVersions(ranked);
    if (this.query().trim()) return rows;
    const groups = this.library.versionsByNumber();
    return rows.map((s) => (s.number === null ? s : mainVersion(groups.get(s.number)!)));
  });

  protected versionCount(song: Song): number {
    return this.library.versionsOf(song).length;
  }

  protected isCurrent(song: Song): boolean {
    return song.id === this.currentId() || (song.number !== null && song.number === this.currentNumber());
  }

  constructor() {
    // Another component (e.g. the "/" shortcut) can ask for search focus.
    effect(() => {
      if (this.layout.focusSearch() > 0) this.focusSearch();
    });
  }

  private matchesFilter(f: LibraryFilter): (song: Song) => boolean {
    switch (f) {
      case 'notes': {
        const ids = this.songsWithNotes();
        const tabs = this.songsWithTabs();
        return (s) => ids.has(s.id) || tabs.has(s.id);
      }
      default:
        return () => true;
    }
  }

  protected onQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((i) => Math.min(Math.max(i + step, 0), Math.max(count - 1, 0)));
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      const song = this.results()[this.activeIndex()];
      if (song) this.open(song);
    } else if (event.key === 'Escape') {
      this.onQuery('');
    }
  }

  protected open(song: Song): void {
    void this.router.navigate(['/canto', song.id]);
    this.closeOnNarrowScreen();
  }

  /** On narrow screens the sidebar covers the song: close it after choosing. */
  protected closeOnNarrowScreen(): void {
    if (window.matchMedia('(max-width: 899px)').matches) this.layout.sidebarOpen.set(false);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || isTyping(event.target)) return;
    event.preventDefault();
    this.layout.sidebarOpen.set(true);
    // Wait one frame so the sidebar is visible before focusing.
    requestAnimationFrame(() => this.focusSearch());
  }

  private focusSearch(): void {
    const input = this.searchInput().nativeElement;
    input.focus();
    input.select();
  }

  private scrollActiveIntoView(): void {
    requestAnimationFrame(() =>
      this.list()?.nativeElement.querySelector('.active')?.scrollIntoView({ block: 'nearest' }),
    );
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
