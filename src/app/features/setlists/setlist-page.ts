import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { collapseRepeats, mapSheetChords, parseChordPro } from '../../core/chordpro';
import { shareBuiltFile } from '../../core/export';
import { SetlistItem, Song, preferSharpsFor } from '../../core/models';
import { effectiveTranspose, formatSetlistDate, moveItem, setlistFileName } from '../../core/setlists';
import { numberLabel } from '../../core/song-meta';
import { clampTranspose, keyView } from '../../core/transpose';
import { IT } from '../../i18n/it';
import { ScreenService } from '../../services/screen.service';
import { SetlistService } from '../../services/setlist.service';
import { LibraryService } from '../../services/library.service';
import { SettingsService } from '../../services/settings.service';
import { SongPrefsService } from '../../services/song-prefs.service';
import { ToastService, UNDO_MS } from '../../services/toast.service';
import { sectionLabel } from '../song/section-label';
import { SwipeAction } from '../../ui/swipe-action';
import { ActionSheet } from '../../ui/action-sheet';
import { Icon } from '../../ui/icon';
import { SidebarToggle } from '../../ui/sidebar-toggle';
import { AddSongsSheet } from './add-songs-sheet';
import { ShareSetlistSheet } from './share-setlist-sheet';

interface Row {
  item: SetlistItem;
  song: Song | null;
  transpose: number;
  overridden: boolean;
  key: string | null;
  /** Position among the playable rows (songs that still exist). */
  playIndex: number;
}

/**
 * One setlist. Layout (both phone and computer): name, date · count, then
 * "Suona" and "Aggiungi canti" at the top, where you look first. Each song is
 * one compact row; tapping it opens its options (key, note, play from here,
 * open, move, remove), so the list itself stays calm. On computers the row
 * also shows the key stepper and "Suona da qui" for quick edits.
 */
@Component({
  selector: 'app-setlist-page',
  imports: [RouterLink, Icon, ActionSheet, CdkDropList, CdkDrag, CdkDragHandle, SidebarToggle, AddSongsSheet, ShareSetlistSheet, SwipeAction],
  templateUrl: './setlist-page.html',
  styleUrl: './setlist-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The page itself scrolls (overflow-y: auto on :host). Marking it as a CDK
  // "scrollable" lets drag & drop scroll it while a song is dragged to the
  // top or bottom edge — without it you can't drag past what's on screen.
  hostDirectives: [CdkScrollable],
})
export class SetlistPage {
  private readonly service = inject(SetlistService);
  private readonly library = inject(LibraryService);
  private readonly screen = inject(ScreenService);
  private readonly prefs = inject(SongPrefsService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly menu = viewChild.required(ActionSheet);
  private readonly addSheet = viewChild.required(AddSongsSheet);
  private readonly shareSheet = viewChild.required(ShareSetlistSheet);
  private readonly itemDialog = viewChild.required<ElementRef<HTMLDialogElement>>('itemDialog');
  private readonly nameField = viewChild<ElementRef<HTMLTextAreaElement>>('name');
  protected readonly t = IT.setlists;
  protected readonly IT = IT;
  protected readonly numberLabel = numberLabel;
  protected readonly formatDate = formatSetlistDate;

  readonly id = input.required<string>();
  protected readonly setlist = computed(() => this.service.byId().get(this.id()) ?? null);
  protected readonly songIds = computed(() => (this.setlist()?.items ?? []).map((i) => i.songId));

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

  protected readonly canPlay = computed(() => this.rows().some((r) => r.song));

  constructor() {
    // The name is a <textarea> so a long name wraps instead of running off
    // the screen. It grows with its text: after each render, height = content.
    afterRenderEffect(() => {
      this.setlist()?.name;
      const field = this.nameField()?.nativeElement;
      if (field) this.fitName(field);
    });
  }

  protected fitName(field: HTMLTextAreaElement): void {
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }

  // ── Name and date ─────────────────────────────────────────────────────────

  protected rename(field: HTMLTextAreaElement): void {
    const setlist = this.setlist();
    // A pasted name may contain line breaks: a name is one line.
    const name = field.value.replace(/\s+/g, ' ').trim();
    if (!setlist) return;
    if (!name) {
      field.value = setlist.name;
      this.fitName(field);
    } else if (name !== setlist.name) {
      void this.service.update(setlist, { name });
    }
  }

  /** The date chip opens the browser's own date picker (the real input is hidden behind it). */
  protected pickDate(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  protected setDate(date: string): void {
    const setlist = this.setlist();
    if (setlist && (date || undefined) !== setlist.date) void this.service.update(setlist, { date: date || undefined });
  }

  // ── Adding songs ──────────────────────────────────────────────────────────

  protected openAdd(): void {
    this.addSheet().open();
  }

  protected add(song: Song): void {
    const setlist = this.setlist();
    if (setlist) void this.service.addSong(setlist, song.id);
  }

  // ── Editing ───────────────────────────────────────────────────────────────

  private setItems(items: SetlistItem[]): void {
    const setlist = this.setlist();
    if (setlist) void this.service.updateItems(setlist, items);
  }

  private patchItem(item: SetlistItem, patch: Partial<SetlistItem>): void {
    this.setItems((this.setlist()?.items ?? []).map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
  }

  /** CDK drag & drop gives the old and new position of the dragged item. */
  protected drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex !== event.currentIndex) {
      this.setItems(moveItem(this.setlist()?.items ?? [], event.previousIndex, event.currentIndex));
    }
  }

  protected move(item: SetlistItem, delta: number): void {
    const items = this.setlist()?.items ?? [];
    const index = items.findIndex((i) => i.id === item.id);
    if (index >= 0) this.setItems(moveItem(items, index, index + delta));
  }

  /** Takes the song out of the setlist, with "Annulla" to put it back in the same place. */
  protected remove(item: SetlistItem): void {
    if (this.openId() === item.id) this.closeItem();
    const items = this.setlist()?.items ?? [];
    const index = items.findIndex((i) => i.id === item.id);
    this.setItems(items.filter((i) => i.id !== item.id));
    const title = this.library.byId().get(item.songId)?.title ?? this.t.missingSong;
    this.toast.show(this.t.removed(title), UNDO_MS, {
      label: IT.shell.undo,
      run: () => {
        const now = this.setlist()?.items ?? [];
        if (now.some((i) => i.id === item.id)) return;
        this.setItems([...now.slice(0, index), item, ...now.slice(index)]);
      },
    });
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
    const value = note.trim() || undefined;
    if (value !== item.note) this.patchItem(item, { note: value });
  }

  protected transposeLabel(n: number): string {
    return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
  }

  // ── Song options (tap on a row) ───────────────────────────────────────────

  /** Which entry's options are open; the row is looked up live so the sheet follows edits. */
  private readonly openId = signal<string | null>(null);
  protected readonly openRow = computed(() => {
    const id = this.openId();
    const rows = this.rows();
    const index = rows.findIndex((r) => r.item.id === id);
    return index < 0 ? null : { row: rows[index], index, first: index === 0, last: index === rows.length - 1 };
  });

  protected openItem(row: Row): void {
    this.openId.set(row.item.id);
    this.itemDialog().nativeElement.showModal();
  }

  protected closeItem(): void {
    const dialog = this.itemDialog().nativeElement;
    // Save a note being typed before the sheet goes away (its input fires "change" on blur).
    (document.activeElement as HTMLElement | null)?.blur();
    if (dialog.open) dialog.close();
  }

  protected onItemClosed(): void {
    this.openId.set(null);
  }

  protected onItemBackdrop(event: MouseEvent): void {
    if (event.target === this.itemDialog().nativeElement) this.closeItem();
  }

  protected openSong(row: Row): void {
    if (!row.song) return;
    this.closeItem();
    // `canGoBack`: the song's back arrow returns here instead of the library.
    void this.router.navigate(['/canto', row.song.id], { state: { canGoBack: true } });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected play(row?: Row): void {
    const rows = this.rows().filter((r) => r.song);
    const start = row ?? rows[0];
    if (!start?.song) return;
    this.closeItem();
    // `canGoBack`: closing performance mode (X) comes back to this page.
    // Inside the tap: Safari grants the "keep the screen on" lock only now.
    void this.screen.keepAwake();
    void this.router.navigate(['/canto', start.song.id, 'esibizione'], {
      queryParams: { scaletta: this.id(), pos: start.playIndex },
      state: { canGoBack: true },
    });
  }

  /** iPhone "⋯": the setlist-wide actions, which have their own buttons on bigger screens. */
  protected async openMenu(): Promise<void> {
    const choice = await this.menu().choose(
      this.setlist()?.name ?? '',
      [
        { id: 'pdf', label: this.t.pdf, icon: 'print' },
        { id: 'tuner', label: IT.tuner.menu, icon: 'guitar' },
        { id: 'duplicate', label: this.t.duplicate, icon: 'copy' },
        { id: 'share', label: this.t.share, icon: 'share' },
        { id: 'delete', label: this.t.delete, icon: 'trash', danger: true, divider: true },
      ],
      this.t.cancel,
    );
    if (choice === 'pdf') await this.printBooklet();
    else if (choice === 'tuner') this.openTuner();
    else if (choice === 'duplicate') await this.duplicate();
    else if (choice === 'share') this.share();
    else if (choice === 'delete') await this.deleteSetlist();
  }

  /** Tune before playing; the tuner's back arrow returns here. */
  protected openTuner(): void {
    void this.router.navigate(['/accordatore'], { state: { canGoBack: true } });
  }

  // ── Booklet (PDF of the whole setlist) ───────────────────────────────────

  /** "Stampa / PDF": with chords (for the band) or words only (for the singers). */
  protected async printBooklet(): Promise<void> {
    if (!this.canPlay()) return;
    const mode = await this.menu().choose(
      this.t.pdf,
      [
        { id: 'chords', label: this.t.pdfChords, icon: 'music' },
        { id: 'lyrics', label: this.t.pdfLyrics, icon: 'type' },
      ],
      this.t.cancel,
    );
    if (mode !== 'chords' && mode !== 'lyrics') return;
    const et = IT.exportMenu;
    try {
      const file = await this.buildBooklet(mode);
      if (!file) return;
      await shareBuiltFile(
        file,
        (share) => this.toast.show(et.pdfReady, 0, { label: et.pdfShare, run: share }),
        () => this.toast.show(et.pdfError),
      );
    } catch {
      this.toast.show(et.pdfError);
    }
  }

  /**
   * Every song as it will be played: the setlist's transposition, the song's
   * capo and spelling, "Parti ripetute" if on. The setlist note goes in the
   * song's info line.
   */
  private async buildBooklet(mode: 'chords' | 'lyrics'): Promise<File | null> {
    const setlist = this.setlist();
    if (!setlist) return null;
    const st = IT.song;
    const settings = this.settings.settings();
    const songs = [];
    const items: string[] = [];
    for (const row of this.rows()) {
      const song = row.song;
      if (!song) continue;
      const parsed = parseChordPro(song.chordpro);
      const prefs = this.prefs.get(song.id);
      const capo = this.prefs.has(song.id) ? prefs.capo : (song.capo ?? 0);
      const keys = keyView(song.key ?? parsed.key ?? null, row.transpose, capo, preferSharpsFor(prefs.preferSharps, settings.accidentals));
      let sheet = mapSheetChords(parsed, keys.mapChord);
      if (settings.collapseRepeats) sheet = collapseRepeats(sheet);
      const label = numberLabel(song);
      const meta = [label ? `N. ${label}` : '', sheet.subtitle ?? ''];
      if (mode === 'chords') meta.push(keys.shapeKey ? `${st.key} ${keys.shapeKey}` : '', capo > 0 ? st.capo(capo) : '');
      if (row.item.note) meta.push(row.item.note);
      songs.push({
        sheet,
        options: { mode, title: song.title, meta: meta.filter(Boolean), label: sectionLabel, repeat: `(${st.sections.repeat})`, times: st.sections.times },
      });
      const key = mode === 'chords' && keys.shapeKey ? `   (${keys.shapeKey})` : '';
      items.push(`${label ? `${label} · ` : ''}${song.title}${key}`);
    }
    const cover = { title: setlist.name, subtitle: [formatSetlistDate(setlist.date), this.t.count(items.length)].filter(Boolean).join(' · '), items };
    const base = setlistFileName(setlist).replace(/\.json$/, '');
    const fileName = `${base}${mode === 'lyrics' ? ` (${IT.exportMenu.pdfLyricsSuffix})` : ''}.pdf`;
    const { bookletPdfFile } = await import('../song/song-pdf-render');
    return bookletPdfFile(cover, songs, mode, fileName);
  }

  protected async duplicate(): Promise<void> {
    const setlist = this.setlist();
    if (!setlist) return;
    const copy = await this.service.duplicate(setlist);
    void this.router.navigate(['/scalette', copy.id]);
  }

  /** QR code + link (and the file as before). */
  protected share(): void {
    const setlist = this.setlist();
    if (setlist) void this.shareSheet().open(setlist);
  }

  protected async deleteSetlist(): Promise<void> {
    const setlist = this.setlist();
    if (!setlist) return;
    const removed = await this.service.remove(setlist.id);
    void this.router.navigate(['/scalette']);
    if (removed) this.toast.show(this.t.deleted(removed.name), UNDO_MS, { label: IT.shell.undo, run: () => void this.service.restore(removed) });
  }
}
