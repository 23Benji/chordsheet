import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { entryKey, folderEntries } from '../../core/folders';
import { SelectionBar } from './selection-bar';
import { Song } from '../../core/models';
import { searchSongs } from '../../core/search';
import { compareByNumber, compareByTitle, numberLabel } from '../../core/song-meta';
import { collapseVersions, mainVersion } from '../../core/versions';
import { IT } from '../../i18n/it';
import { TrashService } from '../../services/trash.service';
import { AnnotationService } from '../../services/annotation.service';
import { FolderService } from '../../services/folder.service';
import { ToastService, UNDO_MS } from '../../services/toast.service';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { RecentService } from '../../services/recent.service';
import { SetlistService } from '../../services/setlist.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { HintBanner } from '../../ui/hint-banner';
import { FabMenu } from '../../ui/fab-menu';
import { FolderNameDialog } from '../../ui/folder-name-dialog';
import { Icon } from '../../ui/icon';
import { LongPress } from '../../ui/long-press';
import { SwipeAction } from '../../ui/swipe-action';
import { ActionSheet, SheetAction } from '../../ui/action-sheet';

type LibraryFilter = 'all' | 'notes';
type LibrarySort = 'number' | 'title';

@Component({
  selector: 'app-library-sidebar',
  imports: [RouterLink, NgTemplateOutlet, SelectionBar, Icon, HintBanner, FabMenu, FolderNameDialog, ActionSheet, LongPress, SwipeAction],
  templateUrl: './library-sidebar.html',
  styleUrl: './library-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
    '[class.selecting]': 'selecting()',
  },
})
export class LibrarySidebar {
  private readonly library = inject(LibraryService);
  private readonly annotations = inject(AnnotationService);
  private readonly prefs = inject(SongPrefsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly setlists = inject(SetlistService);
  private readonly trash = inject(TrashService);
  protected readonly folderService = inject(FolderService);
  protected readonly layout = inject(LayoutService);
  protected readonly t = IT.library;
  protected readonly ft = IT.folders;
  protected readonly st = IT.setlists;
  protected readonly ss = IT.settings;
  protected readonly numberLabel = numberLabel;

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  /** iPhone: the element that scrolls (title, search and list together). */
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly nameDialog = viewChild.required(FolderNameDialog);
  private readonly sheet = viewChild.required(ActionSheet);

  protected readonly query = signal('');
  /** The search box has the focus: with no query, "Recenti" shows above the list. */
  protected readonly searchFocused = signal(false);
  private readonly recent = inject(RecentService);
  /** Last songs opened (that still exist), except the one open right now. */
  protected readonly recentSongs = computed(() => {
    const byId = this.library.byId();
    return this.recent
      .ids()
      .map((id) => byId.get(id))
      .filter((song): song is Song => song !== undefined && !this.isCurrent(song));
  });
  protected readonly showRecent = computed(
    () => this.searchFocused() && !this.query().trim() && !this.selecting() && this.recentSongs().length > 0,
  );
  protected readonly filter = signal<LibraryFilter>('all');
  protected readonly sort = signal<LibrarySort>('number');
  /** Row highlighted with the arrow keys while typing in the search box. */
  protected readonly activeIndex = signal(0);

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

  /** The folder shown (null = all songs); lives in FolderService so other screens can use it as default. */
  protected readonly folder = this.folderService.currentFolder;

  /**
   * Filter → folder → sort → search → one row per number. Recomputed only
   * when one of its inputs changes.
   */
  protected readonly results = computed<Song[]>(() => {
    const folder = this.folder();
    const inFolder = folder ? folderEntries(folder, this.library.byId()) : null;
    const songs = this.library
      .songs()
      .filter(this.matchesFilter(this.filter()))
      .filter((s) => !inFolder || inFolder.has(entryKey(s)));
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

  // ── iPhone: "which songs" pull-down and sort button ───────────────────────

  /** Label of the pull-down next to the search: the folder, "Con le mie note" or "Tutti i canti". */
  protected readonly scopeLabel = computed(
    () => this.folder()?.name ?? (this.filter() === 'notes' ? this.t.withNotes : this.t.allSongs),
  );
  /** Highlighted when it narrows the list (anything but "Tutti i canti"). */
  protected readonly scopeActive = computed(() => !!this.folder() || this.filter() === 'notes');

  /** Library entries (one per song, versions together) — what the counts show. */
  private entries(songs: readonly Song[]): number {
    return new Set(songs.map(entryKey)).size;
  }

  /**
   * One sheet for "which songs": all, with my notes, each folder (with counts),
   * then the open folder's options and "Nuova cartella…". On iPhone it
   * replaces the chips and the switch, so it stays one line with many folders.
   */
  protected async chooseScope(): Promise<void> {
    const songs = this.library.songs();
    const byId = this.library.byId();
    const folder = this.folder();
    const notes = this.filter() === 'notes';
    const folders = this.folderService.folders();
    const actions: SheetAction[] = [
      { id: 'all', label: this.t.allSongs, icon: 'library', hint: `${this.entries(songs)}`, checked: !folder && !notes },
      {
        id: 'notes',
        label: this.t.withNotes,
        icon: 'note',
        hint: `${this.entries(songs.filter(this.matchesFilter('notes')))}`,
        checked: !folder && notes,
      },
      ...folders.map(
        (f, i): SheetAction => ({
          id: `folder:${f.id}`,
          label: f.name,
          icon: 'folder',
          hint: `${folderEntries(f, byId).size}`,
          checked: folder?.id === f.id,
          divider: i === 0,
        }),
      ),
      { id: 'new', label: this.ft.newEllipsis, icon: 'folderPlus', divider: true },
      // Cestino: only when something is in it (like "Eliminati di recente" in Notes).
      ...(this.trash.count()
        ? ([{ id: 'trash', label: IT.trash.menu, icon: 'trash', hint: `${this.trash.count()}` }] satisfies SheetAction[])
        : []),
      // The open folder's own actions, spelled out (one step, no sub-menu).
      ...(folder
        ? ([
            { id: 'rename', label: this.t.folderRename(folder.name), icon: 'edit', divider: true },
            { id: 'share', label: this.t.folderShare(folder.name), icon: 'share' },
            { id: 'delete', label: this.t.folderDelete(folder.name), icon: 'trash', danger: true },
          ] satisfies SheetAction[])
        : []),
    ];
    const choice = await this.sheet().choose(this.t.showTitle, actions, this.ft.cancel);
    if (!choice) return;
    if (choice === 'trash') {
      void this.router.navigate(['/cestino'], { state: { canGoBack: true } });
      return;
    }
    if (choice === 'rename') return this.renameFolder();
    if (choice === 'share') return this.shareFolder();
    if (choice === 'delete') return this.deleteFolder();
    if (choice === 'new') {
      const created = await this.nameDialog().create();
      if (created) this.showScope(created.id, 'all');
      return;
    }
    if (choice === 'all' || choice === 'notes') this.showScope(null, choice);
    else this.showScope(choice.slice('folder:'.length), 'all');
  }

  private showScope(folderId: string | null, filter: LibraryFilter): void {
    this.folderService.current.set(folderId);
    this.filter.set(filter);
    this.activeIndex.set(0);
    this.jumpToTop();
  }

  /** A new list (folder, filter, sort) starts at the top, without animation. */
  private jumpToTop(): void {
    (this.layout.phone() ? this.scroller() : this.list())?.nativeElement.scrollTo({ top: 0 });
  }

  protected async chooseSort(): Promise<void> {
    const choice = await this.sheet().choose(
      this.t.sortTitle,
      [
        { id: 'number', label: this.t.sort.number, icon: 'hash', checked: this.sort() === 'number' },
        { id: 'title', label: this.t.sort.title, icon: 'type', checked: this.sort() === 'title' },
      ],
      this.ft.cancel,
    );
    if (choice === 'number' || choice === 'title') {
      this.sort.set(choice);
      this.jumpToTop();
    }
  }

  // ── Selecting songs (folders, setlists, share, delete several at once) ────

  protected readonly selecting = signal(false);
  // Tell the shell, which hides the iPhone tab bar meanwhile (as in Photos or Mail).
  private readonly shareSelecting = effect(() => this.layout.selecting.set(this.selecting()));
  /** Selected library entries: entry key → the row's song (all its versions are filed). */
  protected readonly selected = signal<ReadonlyMap<string, Song>>(new Map());
  protected readonly allSelected = computed(
    () => this.results().length > 0 && this.results().every((s) => this.selected().has(entryKey(s))),
  );

  protected isSelected(song: Song): boolean {
    return this.selected().has(entryKey(song));
  }

  protected startSelecting(): void {
    this.selected.set(new Map());
    this.selecting.set(true);
  }

  protected stopSelecting(): void {
    this.selecting.set(false);
    this.selected.set(new Map());
  }

  protected toggleSelected(song: Song): void {
    const next = new Map(this.selected());
    const key = entryKey(song);
    if (next.has(key)) next.delete(key);
    else next.set(key, song);
    this.selected.set(next);
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? new Map() : new Map(this.results().map((s) => [entryKey(s), s])));
  }

  /**
   * Long-press (or right-click) on a song: the quick actions of the selection
   * bar for just this song, like an iOS context menu. It reuses the selection
   * code by selecting only this song for the moment.
   */
  protected async songMenu(song: Song): Promise<void> {
    const here = this.folder();
    const choice = await this.sheet().choose(
      song.title,
      [
        { id: 'setlist', label: this.ft.menuSetlist, icon: 'listAdd' },
        { id: 'folder', label: here ? this.ft.menuFolderHere : this.ft.menuFolder, icon: 'folderPlus' },
        { id: 'share', label: this.ft.menuShare, icon: 'share' },
        { id: 'select', label: this.ft.menuSelect, icon: 'circleCheck' },
        { id: 'delete', label: this.ft.menuDelete, icon: 'trash', danger: true, divider: true },
      ],
      this.ft.cancel,
    );
    if (!choice) return;
    if (choice === 'select') {
      this.startSelecting();
      this.toggleSelected(song);
      return;
    }
    this.selected.set(new Map([[entryKey(song), song]]));
    try {
      if (choice === 'setlist') await this.addSelectedToSetlist();
      else if (choice === 'folder') await this.folderSelected();
      else if (choice === 'share') await this.shareSelected();
      else if (choice === 'delete') await this.deleteSelected();
    } finally {
      // Not selecting: don't leave this song ticked for the next time.
      if (!this.selecting()) this.selected.set(new Map());
    }
  }

  /** Swiped to the left and "Elimina" (or a full swipe): deleted, with Annulla. */
  protected async swipeDelete(song: Song): Promise<void> {
    this.selected.set(new Map([[entryKey(song), song]]));
    await this.deleteSelected();
  }

  /** Ids of the selected songs and all their versions. */
  private selectedIds(): string[] {
    return [...this.selected().values()].flatMap((s) => this.library.versionsOf(s).map((v) => v.id));
  }

  /**
   * Asks which folder (all except `exceptId`, plus "Nuova cartella…").
   * Resolves to a folder id, 'new', or null when cancelled.
   */
  private pickFolder(title: string, exceptId?: string): Promise<string | null> {
    const actions: SheetAction[] = [
      ...this.folderService
        .folders()
        .filter((f) => f.id !== exceptId)
        .map((f): SheetAction => ({ id: f.id, label: f.name, icon: 'folder' })),
      { id: 'new', label: this.ft.newEllipsis, icon: 'folderPlus' },
    ];
    return this.sheet().choose(title, actions, this.ft.cancel);
  }

  /**
   * "Cartella": outside a folder it asks straight away where to add; inside
   * one it first asks what to do (add elsewhere, move, take out).
   */
  protected async folderSelected(): Promise<void> {
    const here = this.folder();
    if (!here) return this.addSelected();
    const choice = await this.sheet().choose(
      this.ft.selected(this.selected().size),
      [
        { id: 'add', label: this.ft.addTo, icon: 'folderPlus' },
        { id: 'move', label: this.ft.moveTo, icon: 'folderInput' },
        { id: 'remove', label: this.ft.removeFrom(here.name), icon: 'folderMinus' },
      ],
      this.ft.cancel,
    );
    if (choice === 'add') await this.addSelected();
    else if (choice === 'move') await this.moveSelected();
    else if (choice === 'remove') await this.removeSelectedHere();
  }

  private async addSelected(): Promise<void> {
    const choice = await this.pickFolder(this.ft.addToTitle, this.folder()?.id);
    if (choice) await this.addSelectedTo(choice === 'new' ? null : choice);
  }

  private async moveSelected(): Promise<void> {
    const choice = await this.pickFolder(this.ft.moveToTitle, this.folder()?.id);
    if (choice) await this.moveSelectedTo(choice === 'new' ? null : choice);
  }

  private async addSelectedTo(folderId: string | null): Promise<void> {
    const ids = this.selectedIds();
    const count = this.selected().size;
    // null = "Nuova cartella…": create it with the songs already inside.
    const folder = folderId ? this.folderService.byId().get(folderId) : await this.nameDialog().create(ids);
    if (!folder) return;
    if (folderId) await this.folderService.addSongs([folder.id], ids);
    this.stopSelecting();
    this.toast.show(this.ft.songsAdded(count, folder.name));
  }

  private async moveSelectedTo(folderId: string | null): Promise<void> {
    const from = this.folder();
    if (!from) return;
    const ids = this.selectedIds();
    const count = this.selected().size;
    const target = folderId ? this.folderService.byId().get(folderId) : await this.nameDialog().create();
    if (!target) return;
    // moveSongs looks the folders up by id: a just-created one is already in the service.
    await this.folderService.moveSongs(from.id, target.id, ids);
    this.stopSelecting();
    this.toast.show(this.ft.songsMoved(count, target.name));
  }

  private async removeSelectedHere(): Promise<void> {
    const from = this.folder();
    if (!from) return;
    const count = this.selected().size;
    await this.folderService.removeSongs([from.id], this.selectedIds());
    this.stopSelecting();
    this.toast.show(this.ft.songsRemoved(count, from.name));
  }

  /**
   * "Scaletta": appends the ticked songs to a setlist (or a new one), in the
   * order they were ticked — so you can build a setlist by tapping songs in
   * order. One item per row (the version shown), not every version.
   */
  protected async addSelectedToSetlist(): Promise<void> {
    const choice = await this.sheet().choose(
      this.ft.addToSetlistTitle,
      [
        ...this.setlists.setlists().map((s): SheetAction => ({ id: s.id, label: s.name, icon: 'list' })),
        { id: 'new', label: this.ft.newSetlistEllipsis, icon: 'plus' },
      ],
      this.ft.cancel,
    );
    if (!choice) return;
    const setlist =
      choice === 'new'
        ? await this.setlists.create(this.st.defaultName, new Date().toISOString().slice(0, 10))
        : this.setlists.byId().get(choice);
    if (!setlist) return;
    const songs = [...this.selected().values()];
    await this.setlists.addSongs(setlist, songs.map((s) => s.id));
    this.stopSelecting();
    this.toast.show(this.ft.songsAddedToSetlist(songs.length, setlist.name));
  }

  /** "Condividi": a songbook file with the ticked songs (all versions, no personal data). */
  protected async shareSelected(): Promise<void> {
    const ids = new Set(this.selectedIds());
    const songs = this.library.songs().filter((s) => ids.has(s.id));
    // The selection stays: sharing can be cancelled, as in Photos.
    await this.shareSongs(songs);
  }

  /**
   * "Elimina": deletes the ticked songs and all their versions at once, with
   * "Annulla" in the message for a few seconds (instead of "Sei sicuro?"
   * first: quicker, and a mistake can still be undone).
   */
  protected async deleteSelected(): Promise<void> {
    const count = this.selected().size;
    const ids = this.selectedIds();
    const openId = this.currentId();
    const deleted = await this.library.deleteSongs(ids);
    this.stopSelecting();
    // The open song is gone: go back to the start page instead of "not found".
    if (openId && ids.includes(openId)) void this.router.navigate(['/']);
    this.toast.show(this.ft.songsDeleted(count), UNDO_MS, { label: IT.shell.undo, run: () => void this.library.restoreSongs(deleted) });
  }

  // ── Folders ───────────────────────────────────────────────────────────────

  private async renameFolder(): Promise<void> {
    const folder = this.folder();
    if (folder) await this.nameDialog().rename(folder);
  }

  private async deleteFolder(): Promise<void> {
    const folder = this.folder();
    if (!folder) return;
    const removed = await this.folderService.remove(folder.id);
    if (!removed) return;
    this.toast.show(this.ft.folderDeleted(folder.name), UNDO_MS, {
      label: IT.shell.undo,
      run: () => {
        void this.folderService.restore(removed);
        this.folderService.current.set(removed.id);
      },
    });
  }

  /** "Condividi i canti" for just this folder (songbook file, no personal data). */
  private async shareFolder(): Promise<void> {
    const folder = this.folder();
    if (!folder) return;
    const ids = new Set(folder.songIds);
    await this.shareSongs(this.library.songs().filter((s) => ids.has(s.id)), folder.name);
  }

  private async shareSongs(songs: Song[], name?: string): Promise<void> {
    // Loaded on demand: the library is part of the start-up bundle.
    const [{ shareOrDownload }, { createSongbookFile, songbookFileName }] = await Promise.all([
      import('../../core/export'),
      import('../../core/songbook-file'),
    ]);
    await shareOrDownload(songbookFileName(new Date(), name), JSON.stringify(createSongbookFile(songs)));
  }

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
    // Bottom bar: tapping "Libreria" while already on it goes back to the top (iOS).
    effect(() => {
      if (this.layout.libraryToTop() > 0) untracked(() => this.scrollToTop());
    });
  }

  // ── iPhone: large title that scrolls away (like the system apps) ──────────

  /**
   * Hands the scroll position to CSS as `--scroll` (a plain number of px).
   * The stylesheet derives the large title's fade, the small title and the
   * bar's background from it — all follow the finger 1:1, nothing animates
   * on its own and no height changes, so the list never jumps.
   * Written straight to the element's style: a signal would re-render the
   * template on every scrolled frame for nothing.
   */
  protected onScroll(): void {
    if (!this.layout.phone()) return;
    const top = Math.max(0, this.scroller().nativeElement.scrollTop);
    this.host.nativeElement.style.setProperty('--scroll', `${Math.min(top, 200)}`);
  }

  /** Small title in the bar, or "Libreria" in the bottom bar again: back to the top. */
  protected scrollToTop(): void {
    const target = this.layout.phone() ? this.scroller() : this.list();
    target?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
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

  protected onSearchBlur(): void {
    // A moment's delay: tapping a recent song blurs the search first, and the
    // tap must still land on the row before it disappears.
    setTimeout(() => this.searchFocused.set(false), 250);
  }

  protected openRecent(input: HTMLInputElement): void {
    input.blur();
    this.closeOnNarrowScreen();
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
    if (this.selecting()) return this.toggleSelected(song);
    void this.router.navigate(['/canto', song.id]);
    this.closeOnNarrowScreen();
  }

  /** On narrow screens the sidebar covers the song: close it after choosing. */
  protected closeOnNarrowScreen(): void {
    if (window.matchMedia('(max-width: 899px)').matches) this.layout.sidebarOpen.set(false);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.selecting() && !isTyping(event.target)) return this.stopSelecting();
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
