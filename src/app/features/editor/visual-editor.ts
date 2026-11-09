import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDragPreview, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  EditorKind,
  EditorLine,
  EditorLyricsLine,
  EditorSection,
  EditorSong,
  addSection,
  chordPalette,
  cleanNote,
  convertOldChordLine,
  duplicateSection,
  emptyLyrics,
  emptyNote,
  isOldChordLine,
  mergeLines,
  moveLineTo,
  moveSection,
  moveSectionTo,
  removeSection,
  splitLine,
  updateSection,
} from '../../core/editor-model';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';
import { FocusRequest, LineChange, LineEditor } from './line-editor';

export interface SongChange {
  song: EditorSong;
  coalesce?: string;
}

const KINDS: EditorKind[] = ['auto', 'chorus', 'bridge', 'intro', 'interlude', 'outro'];

/** The section cards. Stateless: every edit is emitted as a new EditorSong. */
@Component({
  selector: 'app-visual-editor',
  imports: [LineEditor, Icon, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPreview, CdkDragPlaceholder],
  templateUrl: './visual-editor.html',
  styleUrl: './visual-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualEditor {
  readonly song = input.required<EditorSong>();
  readonly changed = output<SongChange>();

  protected readonly t = IT.editor;
  /** Touch screens: "tocca" and no keyboard shortcut in the hint. */
  protected readonly help = window.matchMedia?.('(pointer: coarse)').matches ? IT.editor.helpTouch : IT.editor.help;
  protected readonly kinds = KINDS;
  protected readonly isOldChordLine = isOldChordLine;
  protected readonly palette = computed(() => chordPalette(this.song()));
  protected readonly focusRequest = signal<FocusRequest | null>(null);

  private readonly injector = inject(Injector);
  private readonly sectionList = viewChild.required<ElementRef<HTMLElement>>('sectionList');

  private emit(song: EditorSong, coalesce?: string): void {
    this.changed.emit({ song, coalesce });
  }

  private setLines(section: EditorSection, lines: EditorLine[], coalesce?: string): void {
    this.emit(updateSection(this.song(), section.id, (s) => ({ ...s, lines })), coalesce);
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  protected setKind(section: EditorSection, kind: string): void {
    this.emit(updateSection(this.song(), section.id, (s) => ({ ...s, kind: kind as EditorKind })));
  }

  protected setLabel(section: EditorSection, label: string): void {
    this.emit(updateSection(this.song(), section.id, (s) => ({ ...s, label })), `label:${section.id}`);
  }

  // ── Moving sections and lines ──────────────────────────────────────────────
  // After a move the screen follows: the moved section (or line) is scrolled
  // back to where it was on screen, and the others move around it.

  /** Name on the chip that follows the finger: the section's own label, or its kind. */
  protected sectionName(section: EditorSection): string {
    return section.label.trim() || this.t.kinds[section.kind];
  }

  /**
   * A section is picked up: every card shrinks to its header so the whole
   * song fits on screen. This runs synchronously inside CDK's drag start,
   * after it has swapped the card for the placeholder line and before it
   * measures the other cards — so it measures the small ones. The class is
   * set on the element directly (not through a signal) for that reason:
   * Angular would only re-render later.
   */
  protected onSectionDragStart(event: CdkDragStart): void {
    const list = this.sectionList().nativeElement;
    list.classList.add('collapsed');
    // The cards above just got shorter: scroll so the drop line is under the finger.
    const y = pointerY(event.event);
    const scroller = scrollParent(list);
    if (scroller && y !== null) {
      scroller.scrollTop += event.source.getPlaceholderElement().getBoundingClientRect().top - y;
    }
  }

  protected dropSection(event: CdkDragDrop<unknown, unknown, EditorSection>): void {
    const id = event.item.data.id;
    const song = moveSectionTo(this.song(), id, event.currentIndex);
    if (song === this.song()) {
      this.expandSections(id, event.dropPoint.y);
      return;
    }
    this.emit(song);
    afterNextRender({ write: () => this.expandSections(id, event.dropPoint.y) }, { injector: this.injector });
  }

  /** Cards back to full size, with the dropped one's header where the finger let go. */
  private expandSections(id: string, y: number): void {
    const list = this.sectionList().nativeElement;
    list.classList.remove('collapsed');
    this.keepOnScreen(`[data-section="${id}"]`, y - 24);
  }

  /** ↑ / ↓ on a focused handle: one place up or down, and the handle keeps the focus. */
  protected onSectionKey(event: KeyboardEvent, section: EditorSection): void {
    const delta = arrowDelta(event);
    if (!delta) return;
    event.preventDefault();
    const song = moveSection(this.song(), section.id, delta);
    if (song !== this.song()) this.moveAndFollow(song, `[data-section="${section.id}"]`, '.grip');
  }

  protected dropLine(event: CdkDragDrop<EditorSection, unknown, EditorLine>): void {
    const section = event.container.data;
    const moved = moveLineTo(section, event.item.data.id, event.currentIndex);
    if (moved !== section) this.setLines(section, moved.lines);
  }

  protected onLineKey(event: KeyboardEvent, section: EditorSection, line: EditorLine): void {
    const delta = arrowDelta(event);
    if (!delta) return;
    event.preventDefault();
    const moved = moveLineTo(section, line.id, section.lines.indexOf(line) + delta);
    if (moved === section) return;
    this.moveAndFollow(updateSection(this.song(), section.id, () => moved), `[data-line="${line.id}"]`, '.line-grip');
  }

  /** Emits the move, then puts the moved element back at the same height on screen and the focus on its handle. */
  private moveAndFollow(song: EditorSong, selector: string, handle: string): void {
    const before = this.sectionList().nativeElement.querySelector(selector)?.getBoundingClientRect().top;
    this.emit(song);
    afterNextRender(
      {
        write: () => {
          const el = this.sectionList().nativeElement.querySelector<HTMLElement>(selector);
          if (before !== undefined) this.keepOnScreen(selector, before);
          el?.querySelector<HTMLElement>(handle)?.focus({ preventScroll: true });
        },
      },
      { injector: this.injector },
    );
  }

  /** Scrolls the editor so the element's top is at `top` (px from the top of the window). */
  private keepOnScreen(selector: string, top: number): void {
    const list = this.sectionList().nativeElement;
    const el = list.querySelector<HTMLElement>(selector);
    const scroller = scrollParent(list);
    if (el && scroller) scroller.scrollTop += el.getBoundingClientRect().top - top;
  }

  protected duplicate(section: EditorSection): void {
    this.emit(duplicateSection(this.song(), section.id));
  }

  protected remove(section: EditorSection): void {
    this.emit(removeSection(this.song(), section.id));
  }

  protected add(kind: EditorKind): void {
    const song = addSection(this.song(), kind);
    this.emit(song);
    const line = song.sections[song.sections.length - 1].lines[0];
    this.focusRequest.set({ lineId: line.id, caret: 0 });
  }

  // ── Lines ────────────────────────────────────────────────────────────────

  protected onLineChange(section: EditorSection, change: LineChange): void {
    this.setLines(
      section,
      section.lines.map((l) => (l.id === change.line.id ? change.line : l)),
      change.coalesce,
    );
  }

  protected setNote(section: EditorSection, line: EditorLine, text: string): void {
    this.setLines(
      section,
      section.lines.map((l) => (l.id === line.id ? { ...l, text: cleanNote(text) } : l)),
      `note:${line.id}`,
    );
  }

  protected insertBelow(section: EditorSection, index: number, kind: 'lyrics' | 'comment'): void {
    const line = kind === 'lyrics' ? emptyLyrics() : emptyNote();
    const lines = [...section.lines];
    lines.splice(index + 1, 0, line);
    this.setLines(section, lines);
    if (kind === 'lyrics') this.focusRequest.set({ lineId: line.id, caret: 0 });
  }

  protected removeLine(section: EditorSection, line: EditorLine): void {
    this.setLines(
      section,
      section.lines.filter((l) => l.id !== line.id),
    );
  }

  protected onSplit(section: EditorSection, line: EditorLyricsLine, caret: number): void {
    const [first, second] = splitLine(line, caret);
    const lines = section.lines.flatMap((l) => (l.id === line.id ? [first, second] : [l]));
    this.setLines(section, lines);
    this.focusRequest.set({ lineId: second.id, caret: 0 });
  }

  protected onMergePrevious(section: EditorSection, index: number): void {
    const previous = section.lines[index - 1];
    const line = section.lines[index] as EditorLyricsLine;
    if (previous?.kind !== 'lyrics') return;
    const merged = mergeLines(previous, line);
    const lines = [...section.lines];
    lines.splice(index - 1, 2, merged);
    this.setLines(section, lines);
    this.focusRequest.set({ lineId: merged.id, caret: previous.text.length });
  }

  /** ↑ / ↓ across all lyric lines of the song, keeping the caret column. */
  protected onNavigate(line: EditorLyricsLine, delta: -1 | 1, caret: number): void {
    const all = this.song().sections.flatMap((s) => s.lines.filter((l) => l.kind === 'lyrics'));
    const target = all[all.findIndex((l) => l.id === line.id) + delta];
    if (target) this.focusRequest.set({ lineId: target.id, caret: Math.min(caret, target.text.length) });
  }

  protected convert(section: EditorSection, index: number): void {
    this.emit(updateSection(this.song(), section.id, (s) => convertOldChordLine(s, index)));
  }

  protected asLyrics(line: EditorLine): EditorLyricsLine {
    return line as EditorLyricsLine;
  }
}

/** Arrow up / down → -1 / +1; anything else 0. */
function arrowDelta(event: KeyboardEvent): -1 | 0 | 1 {
  return event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
}

function pointerY(event: MouseEvent | TouchEvent): number | null {
  if ('touches' in event) return event.touches[0]?.clientY ?? event.changedTouches[0]?.clientY ?? null;
  return event.clientY;
}

/** The nearest ancestor that scrolls (the editor pane; on some layouts the page). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement | null;
}
