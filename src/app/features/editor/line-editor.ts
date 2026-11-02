import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ChordChip,
  EditorLyricsLine,
  addChord,
  layoutChips,
  moveChord,
  removeChord,
  setLineText,
  updateChord,
} from '../../core/editor-model';
import { IT } from '../../i18n/it';

export interface LineChange {
  line: EditorLyricsLine;
  /** Changes with the same key in a row are merged into one undo step (typing, dragging). */
  coalesce?: string;
}

export interface FocusRequest {
  lineId: string;
  caret: number;
}

interface Popover {
  chordId: string | null; // null = new chord
  pos: number;
  value: string;
  leftPx: number;
}

/**
 * One lyric line: an <input> with the text and, above it, a row with the
 * chords. Both use a monospace font, so character n is always at n × 1ch:
 * a chord at position 6 is drawn at `left: 6ch`, and a click at x pixels
 * means position floor(x / width-of-one-character).
 */
@Component({
  selector: 'app-line-editor',
  templateUrl: './line-editor.html',
  styleUrl: './line-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineEditor {
  readonly line = input.required<EditorLyricsLine>();
  readonly palette = input<string[]>([]);
  readonly focusRequest = input<FocusRequest | null>(null);

  readonly changed = output<LineChange>();
  /** Enter pressed with the caret at this position. */
  readonly split = output<number>();
  /** Backspace at the very start of the line. */
  readonly mergePrevious = output<void>();
  /** ↑ / ↓: go to the previous / next line, keeping the caret column. */
  readonly navigate = output<{ delta: -1 | 1; caret: number }>();

  protected readonly t = IT.editor;
  private readonly textInput = viewChild.required<ElementRef<HTMLInputElement>>('text');
  private readonly measure = viewChild.required<ElementRef<HTMLElement>>('measure');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly chordInput = viewChild<ElementRef<HTMLInputElement>>('chordInput');

  protected readonly chips = computed(() => layoutChips(this.line().chords));
  /** Width of the line in ch: text or last chord, plus room to add one more. */
  protected readonly widthCh = computed(() => {
    const chipsEnd = Math.max(0, ...this.chips().map((c) => c.left + c.chord.length));
    return Math.max(this.line().text.length, chipsEnd) + 6;
  });
  protected readonly popover = signal<Popover | null>(null);

  private drag: { chip: ChordChip; startX: number; moved: boolean } | null = null;

  constructor() {
    effect(() => {
      const request = this.focusRequest();
      if (request?.lineId !== this.line().id) return;
      const el = this.textInput().nativeElement;
      el.focus();
      el.setSelectionRange(request.caret, request.caret);
    });
    effect(() => {
      // Focus the chord field as soon as the popover opens.
      if (this.popover()) queueMicrotask(() => this.chordInput()?.nativeElement.select());
    });
  }

  /** Width of one character in px (measured on 10 characters for precision). */
  private chPx(): number {
    return this.measure().nativeElement.getBoundingClientRect().width / 10 || 10;
  }

  private emit(line: EditorLyricsLine, coalesce?: string): void {
    this.changed.emit({ line, coalesce });
  }

  // ── Text ────────────────────────────────────────────────────────────────

  protected onInput(value: string): void {
    this.emit(setLineText(this.line(), value), `type:${this.line().id}`);
  }

  protected onTextKeydown(event: KeyboardEvent): void {
    const el = event.target as HTMLInputElement;
    const caret = el.selectionStart ?? 0;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.split.emit(caret);
    } else if (event.key === 'Backspace' && caret === 0 && el.selectionEnd === 0) {
      event.preventDefault();
      this.mergePrevious.emit();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigate.emit({ delta: event.key === 'ArrowUp' ? -1 : 1, caret });
    } else if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.openPopover(null, caret, '');
    }
  }

  // ── Adding a chord by clicking the chord row ──────────────────────────────

  protected onRowPointerDown(event: PointerEvent): void {
    if (event.target !== event.currentTarget) return; // a click on a chip
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = Math.max(0, Math.floor((event.clientX - rect.left) / this.chPx()));
    event.preventDefault();
    this.openPopover(null, pos, '');
  }

  // ── Dragging / clicking a chip ────────────────────────────────────────────

  protected onChipPointerDown(event: PointerEvent, chip: ChordChip): void {
    if (event.button !== 0) return;
    event.preventDefault();
    // Pointer capture: we keep receiving pointermove even if the pointer
    // leaves the chip (works the same for mouse, pen and touch).
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { chip, startX: event.clientX, moved: false };
  }

  protected onChipPointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.startX;
    if (!this.drag.moved && Math.abs(dx) < 4) return;
    this.drag.moved = true;
    const pos = this.drag.chip.pos + Math.round(dx / this.chPx());
    this.emit(moveChord(this.line(), this.drag.chip.id, pos), `drag:${this.drag.chip.id}`);
  }

  protected onChipPointerUp(chip: ChordChip): void {
    const wasDrag = this.drag?.moved;
    this.drag = null;
    if (!wasDrag) this.openPopover(chip.id, chip.pos, chip.chord);
  }

  protected onChipKeydown(event: KeyboardEvent, chip: ChordChip): void {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = event.key === 'ArrowLeft' ? -1 : 1;
      this.emit(moveChord(this.line(), chip.id, chip.pos + step), `drag:${chip.id}`);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.emit(removeChord(this.line(), chip.id));
      this.focusText(chip.pos);
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'F2') {
      event.preventDefault();
      this.openPopover(chip.id, chip.pos, chip.chord);
    }
  }

  // ── Popover ───────────────────────────────────────────────────────────────

  private openPopover(chordId: string | null, pos: number, value: string): void {
    const leftPx = pos * this.chPx() - this.scroller().nativeElement.scrollLeft;
    this.popover.set({ chordId, pos, value, leftPx: Math.max(0, leftPx) });
  }

  protected confirmPopover(value: string): void {
    const p = this.popover();
    if (!p) return;
    const chord = value.trim();
    if (p.chordId && !chord) this.emit(removeChord(this.line(), p.chordId));
    else if (p.chordId) this.emit(updateChord(this.line(), p.chordId, chord));
    else if (chord) this.emit(addChord(this.line(), p.pos, chord));
    this.closePopover();
  }

  protected removeFromPopover(): void {
    const p = this.popover();
    if (p?.chordId) this.emit(removeChord(this.line(), p.chordId));
    this.closePopover();
  }

  protected closePopover(): void {
    const p = this.popover();
    this.popover.set(null);
    if (p) this.focusText(p.pos);
  }

  private focusText(pos: number): void {
    const el = this.textInput().nativeElement;
    el.focus();
    const caret = Math.min(pos, el.value.length);
    el.setSelectionRange(caret, caret);
  }
}
