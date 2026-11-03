import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
  moveSection,
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
  imports: [LineEditor, Icon],
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

  protected move(section: EditorSection, delta: number): void {
    this.emit(moveSection(this.song(), section.id, delta));
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
