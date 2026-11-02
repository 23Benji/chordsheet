import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { shareOrDownload } from '../../core/export';
import { SetlistItem, Song } from '../../core/models';
import { searchSongs } from '../../core/search';
import { effectiveTranspose, exportSetlist, moveItem, setlistFileName } from '../../core/setlists';
import { compareByNumber, numberLabel } from '../../core/song-meta';
import { clampTranspose, keyView } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icon';

interface Row {
  item: SetlistItem;
  song: Song | null;
  transpose: number;
  overridden: boolean;
  key: string | null;
  /** Position among the playable rows (songs that still exist). */
  playIndex: number;
}

/** One setlist: reorder (drag & drop), per-song transpose and note, add songs, play. */
@Component({
  selector: 'app-setlist-page',
  imports: [RouterLink, Icon, ConfirmDialog, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './setlist-page.html',
  styleUrl: './setlist-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistPage {
  private readonly service = inject(SetlistService);
  private readonly library = inject(LibraryService);
  private readonly prefs = inject(SongPrefsService);
  private readonly router = inject(Router);
  private readonly dialog = viewChild.required(ConfirmDialog);
  protected readonly t = IT.setlists;
  protected readonly numberLabel = numberLabel;

  readonly id = input.required<string>();
  protected readonly setlist = computed(() => this.service.byId().get(this.id()) ?? null);

  protected readonly rows = computed<Row[]>(() => {
    const songs = this.library.byId();
    let playIndex = 0;
    return (this.setlist()?.items ?? []).map((item) => {
      const song = songs.get(item.songId) ?? null;
      const transpose = effectiveTranspose(item, this.prefs.get(item.songId).transpose);
      const key = song?.key ? keyView(song.key, transpose, 0).soundingKey : null;
      return { item, song, transpose, overridden: item.transpose !== undefined, key, playIndex: song ? playIndex++ : -1 };
    });
  });

  // ── Adding songs ──────────────────────────────────────────────────────────

  protected readonly query = signal('');
  protected readonly results = computed(() => {
    if (!this.query().trim()) return [];
    const songs = [...this.library.songs()].sort(compareByNumber);
    const entries = new Map(this.library.searchEntries().map((e) => [e.id, e]));
    const byId = this.library.byId();
    return searchSongs(songs.map((s) => entries.get(s.id)!), this.query())
      .slice(0, 8)
      .map((id) => byId.get(id)!);
  });

  protected add(song: Song, input?: HTMLInputElement): void {
    const setlist = this.setlist();
    if (!setlist) return;
    void this.service.addSong(setlist, song.id);
    if (input) {
      input.value = '';
      this.query.set('');
      input.focus();
    }
  }

  protected onSearchEnter(input: HTMLInputElement): void {
    const first = this.results()[0];
    if (first) this.add(first, input);
  }

  // ── Editing ───────────────────────────────────────────────────────────────

  private setItems(items: SetlistItem[]): void {
    const setlist = this.setlist();
    if (setlist) void this.service.updateItems(setlist, items);
  }

  private patchItem(item: SetlistItem, patch: Partial<SetlistItem>): void {
    this.setItems((this.setlist()?.items ?? []).map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
  }

  protected rename(name: string): void {
    const setlist = this.setlist();
    if (setlist && name.trim() && name.trim() !== setlist.name) void this.service.update(setlist, { name: name.trim() });
  }

  protected setDate(date: string): void {
    const setlist = this.setlist();
    if (setlist) void this.service.update(setlist, { date: date || undefined });
  }

  /** CDK drag & drop gives the old and new position of the dragged item. */
  protected drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex !== event.currentIndex) {
      this.setItems(moveItem(this.setlist()?.items ?? [], event.previousIndex, event.currentIndex));
    }
  }

  protected move(index: number, delta: number): void {
    this.setItems(moveItem(this.setlist()?.items ?? [], index, index + delta));
  }

  protected remove(item: SetlistItem): void {
    this.setItems((this.setlist()?.items ?? []).filter((i) => i.id !== item.id));
  }

  protected transpose(row: Row, delta: number): void {
    // Read the current value (not the one from the last render): two quick clicks = two steps.
    const item = this.setlist()?.items.find((i) => i.id === row.item.id) ?? row.item;
    const current = effectiveTranspose(item, this.prefs.get(item.songId).transpose);
    this.patchItem(item, { transpose: clampTranspose(current + delta) });
  }

  protected resetTranspose(row: Row): void {
    this.patchItem(row.item, { transpose: undefined });
  }

  protected setNote(item: SetlistItem, note: string): void {
    this.patchItem(item, { note: note.trim() || undefined });
  }

  protected transposeLabel(n: number): string {
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected play(row?: Row): void {
    const rows = this.rows().filter((r) => r.song);
    const start = row ?? rows[0];
    if (!start?.song) return;
    void this.router.navigate(['/canto', start.song.id, 'esibizione'], {
      queryParams: { scaletta: this.id(), pos: start.playIndex },
    });
  }

  protected readonly canPlay = computed(() => this.rows().some((r) => r.song));

  protected async duplicate(): Promise<void> {
    const setlist = this.setlist();
    if (!setlist) return;
    const copy = await this.service.duplicate(setlist);
    void this.router.navigate(['/scalette', copy.id]);
  }

  protected share(): void {
    const setlist = this.setlist();
    if (!setlist) return;
    const json = JSON.stringify(exportSetlist(setlist, this.library.byId()), null, 2);
    void shareOrDownload(setlistFileName(setlist), json);
  }

  protected async deleteSetlist(): Promise<void> {
    const setlist = this.setlist();
    if (!setlist || !(await this.dialog().ask({ ...this.t.confirmDelete, danger: true }))) return;
    await this.service.remove(setlist.id);
    void this.router.navigate(['/scalette']);
  }
}
