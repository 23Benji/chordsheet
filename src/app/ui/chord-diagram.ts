import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { chordShapes } from '../core/chord-diagrams';
import { IT } from '../i18n/it';
import { DiagramVoicings } from './diagram-voicings';

const STRINGS = 6;
const FRETS = 4;
const W = 100;
const H = 120;
const LEFT = 18;
const TOP = 28;
const GAP_X = (W - LEFT - 12) / (STRINGS - 1);
const GAP_Y = (H - TOP - 14) / FRETS;

/** Guitar chord diagram (SVG): strings vertical, frets horizontal, dots for fingers. */
@Component({
  selector: 'app-chord-diagram',
  imports: [DiagramVoicings],
  template: `
    @if (shape(); as s) {
      <figure>
        <figcaption>{{ s.name }}</figcaption>
        <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="t.diagramAria(s.name)">
          <!-- nut (thick) when the diagram starts at the first fret, otherwise the fret number -->
          @if (s.baseFret === 1) {
            <rect [attr.x]="left" [attr.y]="top - 3" [attr.width]="gapX * 5" height="3" class="ink" />
          } @else {
            <text [attr.x]="left - 6" [attr.y]="top + gapY / 2 + 4" class="fret-no">{{ s.baseFret }}</text>
          }
          @for (i of fretLines; track i) {
            <line [attr.x1]="left" [attr.x2]="left + gapX * 5" [attr.y1]="top + i * gapY" [attr.y2]="top + i * gapY" class="line" />
          }
          @for (i of stringLines; track i) {
            <line [attr.x1]="left + i * gapX" [attr.x2]="left + i * gapX" [attr.y1]="top" [attr.y2]="top + gapY * 4" class="line" />
          }
          @if (s.barre; as b) {
            <rect
              [attr.x]="left + b.fromString * gapX - 5"
              [attr.y]="top + (b.fret - s.baseFret + 0.5) * gapY - 5"
              [attr.width]="(b.toString - b.fromString) * gapX + 10"
              height="10"
              rx="5"
              class="dot"
            />
          }
          @for (fret of s.frets; track $index; let i = $index) {
            @if (fret < 0) {
              <text [attr.x]="left + i * gapX" [attr.y]="top - 9" class="mark">×</text>
            } @else if (fret === 0) {
              <circle [attr.cx]="left + i * gapX" [attr.cy]="top - 12" r="3.5" class="open" />
            } @else {
              <circle [attr.cx]="left + i * gapX" [attr.cy]="top + (fret - s.baseFret + 0.5) * gapY" r="5" class="dot" />
            }
          }
        </svg>
        @if (s.bass) {
          <p class="bass">{{ t.bass(s.bass) }}</p>
        }
        @if (shapes().length > 1) {
          <app-diagram-voicings [index]="index()" [count]="shapes().length" (step)="step($event)" />
        }
      </figure>
    } @else {
      <p class="unknown">{{ t.unknown(chord()) }}</p>
    }
  `,
  styles: `
    figure {
      margin: 0;
      text-align: center;
    }
    figcaption {
      color: var(--accent);
      font-weight: 700;
      font-size: 18px;
    }
    svg {
      display: block;
      width: 110px;
      height: auto;
    }
    .line {
      stroke: var(--text-muted);
      stroke-width: 1;
    }
    .ink,
    .dot {
      fill: var(--text);
    }
    .open {
      fill: none;
      stroke: var(--text);
      stroke-width: 1.5;
    }
    .mark,
    .fret-no {
      fill: var(--text-muted);
      font-size: 11px;
      text-anchor: middle;
    }
    .bass,
    .unknown {
      margin: 2px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChordDiagram {
  readonly chord = input.required<string>();
  /** All fingerings, easiest first; ‹ › browse them. */
  protected readonly shapes = computed(() => chordShapes(this.chord()));
  /** linkedSignal: back to the first fingering whenever the chord changes. */
  protected readonly index = linkedSignal(() => {
    this.chord();
    return 0;
  });
  protected readonly shape = computed(() => this.shapes()[this.index()] ?? null);

  protected step(delta: number): void {
    const count = this.shapes().length;
    this.index.update((i) => (i + delta + count) % count);
  }
  protected readonly t = IT.diagrams;
  protected readonly w = W;
  protected readonly h = H;
  protected readonly left = LEFT;
  protected readonly top = TOP;
  protected readonly gapX = GAP_X;
  protected readonly gapY = GAP_Y;
  protected readonly fretLines = [0, 1, 2, 3, 4];
  protected readonly stringLines = [0, 1, 2, 3, 4, 5];
}
