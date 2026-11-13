import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GUITAR_TUNING } from '../../core/chord-finder';
import { Song } from '../../core/models';
import {
  STRINGS,
  TAB_FRETS,
  TAB_STRING_NAMES,
  TabTechnique,
  addBar,
  addNote,
  addTechnique,
  lastNoteString,
  setCell,
} from '../../core/tab-writer';
import { IT } from '../../i18n/it';
import { SettingsService } from '../../services/settings.service';
import { SoloDraftService } from '../../services/solo-draft.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';
import { strum } from '../../ui/strum';
import { AddSongsSheet } from '../setlists/add-songs-sheet';

type InputMode = 'neck' | 'grid';
const MODE_KEY = 'chordsheet.soloInput';
/** Fret numbers printed under the neck, where guitars have their dots. */
const MARKERS = new Set([3, 5, 7, 9, 12]);

/**
 * "Scrivi assolo" (look "C1", Benji 2026-11-13): write a solo by tapping the
 * neck (each tap = the next note) or by filling a tab grid, and get the six
 * lines of tablature ready to go into a song: "Copia" for the clipboard,
 * "Aggiungi a un canto" to pick the song and the line it goes under.
 * The solo itself lives in SoloDraftService (kept on the device).
 */
@Component({
  selector: 'app-solo-writer-page',
  imports: [RouterLink, Icon, AddSongsSheet],
  templateUrl: './solo-writer-page.html',
  styleUrl: './solo-writer-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoloWriterPage {
  protected readonly t = IT.solo;
  protected readonly back = IT.chordFinder.back;
  protected readonly draft = inject(SoloDraftService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly songSheet = viewChild.required(AddSongsSheet);
  private readonly tabView = viewChild<ElementRef<HTMLElement>>('tabView');
  private readonly gridScroll = viewChild<ElementRef<HTMLElement>>('gridScroll');

  protected readonly names = TAB_STRING_NAMES;
  /** Rows top → bottom: the high e first, as in tablature. */
  protected readonly rows = Array.from({ length: STRINGS }, (_, i) => STRINGS - 1 - i);
  protected readonly frets = Array.from({ length: TAB_FRETS + 1 }, (_, i) => i);
  protected readonly markers = MARKERS;
  protected readonly padNumbers = Array.from({ length: TAB_FRETS + 1 }, (_, i) => i);
  protected readonly techniques: { mark: TabTechnique; label: string }[] = [
    { mark: 'h', label: IT.solo.hammer },
    { mark: 'p', label: IT.solo.pull },
    { mark: '/', label: IT.solo.slide },
    { mark: 'b', label: IT.solo.bend },
  ];

  protected readonly mode = signal<InputMode>(readMode());
  /** "Insieme": the next taps go in the same column (notes played together). */
  protected readonly together = signal(false);
  /** Grid: the cell being written. column = items.length is the empty column at the end. */
  protected readonly selected = signal({ column: 0, string: STRINGS - 1 });

  protected readonly items = this.draft.items;
  protected readonly text = this.draft.text;
  protected readonly hasNotes = computed(() => this.items().some((i) => i.kind === 'note'));
  /** The frets of the last column: shown on the neck, so you see where you are. */
  protected readonly lastColumn = computed(() => {
    const last = this.items()[this.items().length - 1];
    return last?.kind === 'note' ? last.frets : null;
  });

  constructor() {
    this.selected.set({ column: this.items().length, string: lastNoteString(this.items()) ?? STRINGS - 1 });
    // After each change the tab (and the grid) scroll to the end, where the new note is.
    afterRenderEffect(() => {
      this.text();
      this.mode();
      const tab = this.tabView()?.nativeElement;
      if (tab) tab.scrollTo({ top: tab.scrollHeight, left: tab.scrollWidth });
    });
    afterRenderEffect(() => {
      const { column } = this.selected();
      const grid = this.gridScroll()?.nativeElement;
      const cell = grid?.querySelector<HTMLElement>(`[data-column="${column}"]`);
      if (!grid || !cell) return;
      // Only the grid scrolls sideways (scrollIntoView would move the whole page too).
      const left = cell.offsetLeft; // .grid-scroll is position: relative, so this is inside it
      if (left < grid.scrollLeft) grid.scrollLeft = left - 24;
      else if (left + cell.offsetWidth > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = left + cell.offsetWidth - grid.clientWidth + 24;
    });
  }

  protected setMode(mode: InputMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // not saved: fine
    }
    if (mode === 'grid') this.selected.set({ column: this.items().length, string: lastNoteString(this.items()) ?? STRINGS - 1 });
  }

  // ── Neck ────────────────────────────────────────────────────────────────

  protected press(string: number, fret: number): void {
    this.draft.change(addNote(this.items(), string, fret, this.together()));
    this.play(string, fret);
  }

  protected isLast(string: number, fret: number): boolean {
    return this.lastColumn()?.[string] === fret;
  }

  // ── Grid ────────────────────────────────────────────────────────────────

  protected select(column: number, string: number): void {
    this.selected.set({ column, string });
  }

  /** A number on the pad: writes the selected cell. Writing in the empty end column moves on to the next one. */
  protected write(fret: number | null): void {
    const { column, string } = this.selected();
    const atEnd = column >= this.items().length;
    this.draft.change(setCell(this.items(), column, string, fret));
    if (fret !== null) this.play(string, fret);
    if (atEnd && fret !== null) this.selected.set({ column: this.items().length, string });
    else if (column > this.items().length) this.selected.set({ column: this.items().length, string });
  }

  // ── Tools ───────────────────────────────────────────────────────────────

  protected toggleTogether(): void {
    // The lit button says it's on; a message would cover the buttons below.
    this.together.update((on) => !on);
  }

  protected technique(mark: TabTechnique): void {
    this.together.set(false);
    this.draft.change(addTechnique(this.items(), mark));
    this.afterToolEdit();
  }

  protected bar(): void {
    this.together.set(false);
    this.draft.change(addBar(this.items()));
    this.afterToolEdit();
  }

  protected undo(): void {
    this.draft.undo();
    this.afterToolEdit();
  }

  private afterToolEdit(): void {
    if (this.mode() === 'grid') this.selected.update((s) => ({ ...s, column: this.items().length }));
  }

  protected clear(): void {
    const title = this.draft.title();
    this.draft.clear();
    this.together.set(false);
    this.selected.set({ column: 0, string: STRINGS - 1 });
    this.toast.show(this.t.cleared, 5000, {
      label: IT.shell.undo,
      run: () => {
        this.draft.undo();
        this.draft.setTitle(title);
      },
    });
  }

  // ── Into a song ─────────────────────────────────────────────────────────

  /** Inside the tap: the clipboard can only be written in answer to the user. */
  protected copy(): void {
    const text = this.text();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => this.toast.show(this.t.copied),
      () => this.toast.show(this.t.copyFailed),
    ) ?? this.toast.show(this.t.copyFailed);
  }

  protected chooseSong(): void {
    if (this.text()) this.songSheet().open();
  }

  /** The song opens and asks which line the solo goes under (notes must be on to tap a line). */
  protected placeIn(song: Song): void {
    this.songSheet().close();
    this.draft.pending.set({ title: this.draft.title().trim(), text: this.text() });
    if (!this.settings.settings().showNotes) void this.settings.update({ showNotes: true });
    void this.router.navigate(['/canto', song.id]);
  }

  private play(string: number, fret: number): void {
    strum([GUITAR_TUNING[string] + fret]);
  }
}

function readMode(): InputMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'grid' ? 'grid' : 'neck';
  } catch {
    return 'neck';
  }
}
