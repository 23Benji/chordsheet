import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Annotation, AnnotationColor, LineAnchor } from '../../core/models';
import { IT } from '../../i18n/it';
import { AnnotationService } from '../../services/annotation.service';
import { Icon } from '../../ui/icon';

type Mode = 'menu' | 'note' | 'tab' | 'chord';

/**
 * Bottom panel of the song view: the personal layer of the selected line
 * (add / edit / delete note, highlight, tab, personal chord), or the list of
 * orphaned notes to relink.
 */
@Component({
  selector: 'app-annotation-panel',
  imports: [Icon],
  templateUrl: './annotation-panel.html',
  styleUrl: './annotation-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationPanel {
  private readonly service = inject(AnnotationService);
  protected readonly t = IT.notes;

  readonly songId = input.required<string>();
  /** Anchor of the selected line; null when showing orphans. */
  readonly anchor = input<LineAnchor | null>(null);
  readonly lineText = input('');
  /** Chords of the selected line as displayed (after transposition). */
  readonly lineChords = input<string[]>([]);
  readonly annotations = input<Annotation[]>([]);
  readonly orphans = input<Annotation[]>([]);
  readonly showOrphans = input(false);
  /** Displayed chord ↔ chord as stored (original key): personal chords follow transposition. */
  readonly toDisplay = input<(chord: string) => string>((c) => c);
  readonly toOriginal = input<(chord: string) => string>((c) => c);

  /** Intro mark of the line: true/false, or null when the line can't be marked (a note). */
  readonly introMarked = input<boolean | null>(null);
  readonly introToggled = output<void>();
  readonly closed = output<void>();
  readonly relink = output<Annotation>();

  protected readonly colors: AnnotationColor[] = ['amber', 'coral', 'sage', 'sky'];
  protected readonly mode = signal<Mode>('menu');
  /** Annotation being edited; null = creating a new one. */
  protected readonly editing = signal<Annotation | null>(null);
  protected readonly color = signal<AnnotationColor>('amber');
  protected readonly chordIndex = signal(0);

  protected readonly highlight = computed(() => this.annotations().find((a) => a.type === 'highlight') ?? null);
  protected readonly snippet = computed(() => {
    const text = this.lineText().trim();
    return text.length > 48 ? text.slice(0, 47) + '…' : text;
  });

  protected summary(a: Annotation): string {
    const s = this.t.summary;
    switch (a.type) {
      case 'note':
        return s.note(a.text);
      case 'highlight':
        return s.highlight(this.t.colors[a.color ?? 'amber']);
      case 'tab':
        return s.tab(a.title ?? '');
      case 'chord':
        return s.chord(this.toDisplay()(a.text), this.lineChords()[a.chordIndex ?? 0] ?? '');
    }
  }

  protected open(mode: Mode, annotation: Annotation | null = null): void {
    this.mode.set(mode);
    this.editing.set(annotation);
    this.color.set(annotation?.color ?? 'amber');
    this.chordIndex.set(annotation?.chordIndex ?? 0);
  }

  protected back(): void {
    this.mode.set('menu');
    this.editing.set(null);
  }

  private async upsert(data: Partial<Annotation> & Pick<Annotation, 'type' | 'text'>): Promise<void> {
    const editing = this.editing();
    if (editing) await this.service.update(editing, data);
    else await this.service.add({ songId: this.songId(), anchor: this.anchor()!, ...data });
    this.back();
  }

  protected saveNote(text: string): Promise<void> | void {
    if (!text.trim()) return this.back();
    return this.upsert({ type: 'note', text: text.trim(), color: this.color() });
  }

  protected saveTab(title: string, text: string): Promise<void> | void {
    if (!text.trim()) return this.back();
    return this.upsert({ type: 'tab', title: title.trim() || undefined, text: text.replace(/\s+$/, '') });
  }

  protected saveChord(chord: string): Promise<void> | void {
    if (!chord.trim()) return this.back();
    return this.upsert({
      type: 'chord',
      text: this.toOriginal()(chord.trim()),
      chordIndex: this.chordIndex(),
    });
  }

  /** One highlight per line: choosing a colour sets it, "Nessuna" removes it. */
  protected async setHighlight(color: AnnotationColor | null): Promise<void> {
    const current = this.highlight();
    if (!color) {
      if (current) await this.service.remove(current.id);
    } else if (current) {
      await this.service.update(current, { color });
    } else {
      await this.service.add({ songId: this.songId(), anchor: this.anchor()!, type: 'highlight', text: '', color });
    }
  }

  protected remove(a: Annotation): Promise<void> {
    return this.service.remove(a.id);
  }
}
