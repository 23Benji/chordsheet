import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { shareOrDownload } from '../../core/export';
import { Setlist } from '../../core/models';
import { exportSetlist, formatSetlistDate, importSetlist, setlistFileName } from '../../core/setlists';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icon';
import { SidebarToggle } from '../../ui/sidebar-toggle';

/** All setlists: create, import, and quick actions. */
@Component({
  selector: 'app-setlists-page',
  imports: [RouterLink, Icon, ConfirmDialog, SidebarToggle],
  templateUrl: './setlists-page.html',
  styleUrl: './setlists-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistsPage {
  protected readonly service = inject(SetlistService);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild.required(ConfirmDialog);
  protected readonly t = IT.setlists;
  protected readonly settingsLabel = IT.settings.link;
  protected readonly formatDate = formatSetlistDate;

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
    if (first) void this.router.navigate(['/canto', first.songId, 'esibizione'], { queryParams: { scaletta: setlist.id, pos: 0 } });
  }

  protected duplicate(setlist: Setlist): void {
    void this.service.duplicate(setlist);
  }

  protected share(setlist: Setlist): void {
    const json = JSON.stringify(exportSetlist(setlist, this.library.byId()), null, 2);
    void shareOrDownload(setlistFileName(setlist), json);
  }

  protected async remove(setlist: Setlist): Promise<void> {
    if (await this.dialog().ask({ ...this.t.confirmDelete, danger: true })) await this.service.remove(setlist.id);
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
