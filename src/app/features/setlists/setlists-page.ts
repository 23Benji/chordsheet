import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Setlist } from '../../core/models';
import { formatSetlistDate, importSetlist } from '../../core/setlists';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { ToastService, UNDO_MS } from '../../services/toast.service';
import { Icon } from '../../ui/icon';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { SwipeAction } from '../../ui/swipe-action';
import { ActionSheet } from '../../ui/action-sheet';
import { ShareSetlistSheet } from './share-setlist-sheet';
import { SHARED_SETLIST_PATH, linkFragment } from '../../core/setlist-link';

/** All setlists: create, import, and quick actions. */
@Component({
  selector: 'app-setlists-page',
  imports: [RouterLink, Icon, SidebarToggle, ShareSetlistSheet, ActionSheet, SwipeAction],
  templateUrl: './setlists-page.html',
  styleUrl: './setlists-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistsPage {
  protected readonly service = inject(SetlistService);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly shareSheet = viewChild.required(ShareSetlistSheet);
  private readonly menu = viewChild.required(ActionSheet);
  protected readonly t = IT.setlists;
  protected readonly settingsLabel = IT.settings.link;
  protected readonly formatDate = formatSetlistDate;
  protected readonly st = IT.stats;

  protected readonly creating = signal(false);
  protected readonly importError = signal<string | null>(null);
  protected readonly today = new Date().toISOString().slice(0, 10);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('name');

  constructor() {
    // The `autofocus` attribute only works on page load, not on elements that
    // @if adds later. viewChild() is a signal: it changes when the form
    // appears, so this effect runs then and puts the cursor in "Nome".
    effect(() => this.nameInput()?.nativeElement.focus());
  }

  protected async create(name: string, date: string): Promise<void> {
    const setlist = await this.service.create(name.trim() || this.t.defaultName, date || undefined);
    this.creating.set(false);
    void this.router.navigate(['/scalette', setlist.id]);
  }

  protected playable(setlist: Setlist): boolean {
    return setlist.items.some((i) => this.library.byId().has(i.songId));
  }

  protected play(setlist: Setlist): void {
    const first = setlist.items.find((i) => this.library.byId().has(i.songId));
    if (first) void this.router.navigate(['/canto', first.songId, 'esibizione'], {
        queryParams: { scaletta: setlist.id, pos: 0 },
        state: { canGoBack: true }, // X in performance mode comes back here
      });
  }

  protected duplicate(setlist: Setlist): void {
    void this.service.duplicate(setlist);
  }

  protected share(setlist: Setlist): void {
    void this.shareSheet().open(setlist);
  }

  protected async remove(setlist: Setlist): Promise<void> {
    const removed = await this.service.remove(setlist.id);
    if (removed) this.toast.show(this.t.deleted(removed.name), UNDO_MS, { label: IT.shell.undo, run: () => void this.service.restore(removed) });
  }

  /**
   * "Importa scaletta": a file, or a link copied from a message. (On the
   * iPhone a link opens in Safari, not in the home-screen app — so the link
   * is copied there and pasted here.)
   */
  protected async chooseImport(fileInput: HTMLInputElement): Promise<void> {
    const choice = await this.menu().choose(
      this.t.import,
      [
        { id: 'link', label: this.t.importLink, icon: 'paste' },
        { id: 'file', label: this.t.importFileOption, icon: 'fileUp' },
      ],
      this.t.cancel,
    );
    if (choice === 'file') fileInput.click();
    else if (choice === 'link') await this.pasteLink();
  }

  private async pasteLink(): Promise<void> {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // Permission refused or no clipboard access.
    }
    const fragment = linkFragment(text);
    if (!fragment) {
      this.toast.show(this.t.importLinkMissing, 6000);
      return;
    }
    void this.router.navigate(['/', SHARED_SETLIST_PATH], { fragment });
  }

  protected async importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = ''; // so the same file can be chosen again
    if (!file) return;
    this.importError.set(null);
    try {
      const { setlist, missing } = importSetlist(await file.text(), this.library.songs());
      await this.service.add(setlist);
      this.toast.show(
        missing.length ? this.t.importMissing(missing.length, missing.join(', ')) : this.t.importDone(setlist.name),
        missing.length ? 8000 : 4000,
      );
      void this.router.navigate(['/scalette', setlist.id]);
    } catch {
      this.importError.set(this.t.importError);
    }
  }
}
