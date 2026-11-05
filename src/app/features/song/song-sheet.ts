import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Segment, Sheet, lyricsOnlySheet } from '../../core/chordpro';
import { IntroView } from '../../core/intro';
import { Annotation } from '../../core/models';
import { IT } from '../../i18n/it';
import { sectionLabel } from './section-label';

const NO_ANNOTATIONS: Annotation[] = [];

/**
 * Renders a parsed song: chords above lyrics, plus the personal layer
 * (highlights, notes, tabs, personal chords). Pure presentation — it receives
 * an already transposed `Sheet` and the annotations grouped by line.
 */
@Component({
  selector: 'app-song-sheet',
  templateUrl: './song-sheet.html',
  styleUrl: './song-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.inline-chords]': "chordStyle() === 'inline'",
    '(pointerdown)': 'onPointerDown($event)',
    '(mouseover)': 'onMouseOver($event)',
    '(mouseout)': 'onMouseOut($event)',
    '(click)': 'onClick($event)',
  },
})
export class SongSheet {
  readonly sheet = input.required<Sheet>();
  /** line index → annotations of that line (already resolved by the song view). */
  readonly annotations = input<ReadonlyMap<number, Annotation[]>>(new Map());
  /** When true, clicking a line selects it (to add personal notes). */
  readonly selectable = input(false);
  readonly selectedLine = input<number | null>(null);
  readonly lineSelect = output<number>();
  /** The personal Intro card (already transposed), shown before the first section. */
  readonly intro = input<IntroView | null>(null);
  /** Click on the Intro card (when selectable): edit it. */
  readonly introEdit = output<void>();
  /** Report chords under the pointer (hover) or tapped, to show their diagram. */
  readonly diagrams = input(false);
  readonly chordHover = output<{ chord: string; rect: DOMRect } | null>();
  /** 'inline': chords in square brackets inside the lyrics instead of above. */
  readonly chordStyle = input<'above' | 'inline'>('above');
  /**
   * "Solo testo" (for singers): no chords, no Intro card, no chord diagrams,
   * no personal chords or tabs — only words, text notes and highlights.
   */
  readonly lyricsOnly = input(false);

  /** What is drawn: the sheet as given, or its words only. */
  protected readonly shown = computed(() => (this.lyricsOnly() ? lyricsOnlySheet(this.sheet()) : this.sheet()));

  protected readonly t = IT.song;

  /**
   * Personal chords ("Cadd9 instead of C") by the segment they sit on. A
   * personal chord annotation says which chord of its line it replaces
   * (chordIndex), so we count the chords of the line to find the segment.
   */
  protected readonly personalChords = computed(() => {
    const map = new Map<Segment, string>();
    if (this.lyricsOnly()) return map;
    for (const section of this.sheet().sections) {
      for (const line of section.lines) {
        if (line.kind !== 'lyrics') continue;
        const chords = this.annotationsOf(line.index).filter((a) => a.type === 'chord');
        if (!chords.length) continue;
        const segments = line.words.flatMap((w) => w.segments).filter((s) => s.chord);
        for (const a of chords) {
          const segment = segments[Math.min(a.chordIndex ?? 0, segments.length - 1)];
          if (segment) map.set(segment, a.text);
        }
      }
    }
    return map;
  });

  protected annotationsOf(lineIndex: number): Annotation[] {
    return this.annotations().get(lineIndex) ?? NO_ANNOTATIONS;
  }

  protected highlightClass(notes: Annotation[]): string {
    const highlight = notes.find((a) => a.type === 'highlight');
    return highlight ? `hl hl-${highlight.color ?? 'amber'}` : '';
  }

  protected hasPersonalChord(notes: Annotation[]): boolean {
    return notes.some((a) => a.type === 'chord');
  }

  protected select(lineIndex: number, event?: Event): void {
    // A tap on a chord shows its diagram instead of selecting the line.
    if (this.diagrams() && this.touch && this.chordAt(event?.target ?? null)) return;
    if (this.selectable()) this.lineSelect.emit(lineIndex);
  }

  protected readonly label = sectionLabel;

  private touch = false;

  private chordAt(target: EventTarget | null): HTMLElement | null {
    return target instanceof Element ? (target.closest('.chord') as HTMLElement | null) : null;
  }

  protected onPointerDown(event: PointerEvent): void {
    this.touch = event.pointerType !== 'mouse';
  }

  protected onMouseOver(event: MouseEvent): void {
    if (!this.diagrams() || this.lyricsOnly() || this.touch) return;
    const chord = this.chordAt(event.target);
    if (chord) this.chordHover.emit({ chord: chord.textContent?.trim() ?? '', rect: chord.getBoundingClientRect() });
  }

  protected onMouseOut(event: MouseEvent): void {
    if (!this.diagrams() || this.touch) return;
    if (this.chordAt(event.target) && !this.chordAt(event.relatedTarget)) this.chordHover.emit(null);
  }

  /** On touch screens a tap on a chord shows its diagram (and doesn't select the line). */
  protected onClick(event: MouseEvent): void {
    if (!this.diagrams() || this.lyricsOnly() || !this.touch) return;
    const chord = this.chordAt(event.target);
    if (!chord) return;
    this.chordHover.emit({ chord: chord.textContent?.trim() ?? '', rect: chord.getBoundingClientRect() });
  }

  protected editIntro(): void {
    if (this.selectable()) this.introEdit.emit();
  }
}
