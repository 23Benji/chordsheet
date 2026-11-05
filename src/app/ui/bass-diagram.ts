import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { bassPositions, chordNotes } from '../core/chord-notes';
import { IT } from '../i18n/it';
import { DiagramVoicings } from './diagram-voicings';

const STRINGS = 4;
const FRETS = 4;
const W = 80;
const H = 120;
const LEFT = 16;
const TOP = 28;
const GAP_X = (W - LEFT - 12) / (STRINGS - 1);
const GAP_Y = (H - TOP - 14) / FRETS;

/**
 * Bass diagram (SVG), drawn like the guitar one: 4 strings (E A D G), the
 * root as a filled dot, the fifth and the octave as rings.
 */
@Component({
  selector: 'app-bass-diagram',
  imports: [DiagramVoicings],
  template: `
    @if (position(); as p) {
      <figure>
        <figcaption>{{ chord() }}</figcaption>
        <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="t.bassAria(chord(), p.note)">
          @if (p.baseFret === 1) {
            <rect [attr.x]="left" [attr.y]="top - 3" [attr.width]="gapX * 3" height="3" class="ink" />
          } @else {
            <text [attr.x]="left - 7" [attr.y]="top + gapY / 2 + 4" class="fret-no">{{ p.baseFret }}</text>
          }
          @for (i of fretLines; track i) {
            <line [attr.x1]="left" [attr.x2]="left + gapX * 3" [attr.y1]="top + i * gapY" [attr.y2]="top + i * gapY" class="line" />
          }
          @for (i of stringLines; track i) {
            <line [attr.x1]="left + i * gapX" [attr.x2]="left + i * gapX" [attr.y1]="top" [attr.y2]="top + gapY * 4" class="line string" />
          }
          @for (d of p.dots; track d.string) {
            @if (d.fret === 0) {
              <!-- Open string: a small mark above the nut (filled = the root, like the legend). -->
              <circle [attr.cx]="left + d.string * gapX" [attr.cy]="top - 12" r="4.5" [class]="d.role === 'root' ? 'dot' : 'open'" />
            } @else {
              <circle
                [attr.cx]="left + d.string * gapX"
                [attr.cy]="top + (d.fret - p.baseFret + 0.5) * gapY"
                [attr.r]="d.role === 'root' ? 6 : 5"
                [class]="d.role === 'root' ? 'dot' : 'ring'"
              />
            }
          }
        </svg>
        <p class="hint"><span class="key root">●</span> {{ t.bassRoot(p.note) }}</p>
        @if (hasOthers(p)) {
          <p class="hint"><span class="key">○</span> {{ t.bassOthers }}</p>
        }
        @if (positions().length > 1) {
          <app-diagram-voicings [index]="index()" [count]="positions().length" (step)="step($event)" />
        }
      </figure>
    } @else {
      <p class="hint">{{ t.unknown(chord()) }}</p>
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
      width: 92px;
      height: auto;
      margin: 0 auto;
    }
    .line {
      stroke: var(--text-muted);
      stroke-width: 1;
    }
    .string {
      stroke-width: 1.6;
    }
    .ink,
    .dot {
      fill: var(--accent);
    }
    .ring {
      fill: var(--bg-elev-1);
      stroke: var(--text);
      stroke-width: 1.6;
    }
    .open {
      fill: none;
      stroke: var(--text);
      stroke-width: 1.5;
    }
    .fret-no {
      fill: var(--text-muted);
      font-size: 11px;
      text-anchor: middle;
    }
    .hint {
      margin: 2px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }
    .key.root {
      color: var(--accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BassDiagram {
  readonly chord = input.required<string>();
  protected readonly positions = computed(() => {
    const notes = chordNotes(this.chord());
    return notes ? bassPositions(notes) : [];
  });
  /** linkedSignal: back to the first position whenever the chord changes. */
  protected readonly index = linkedSignal(() => {
    this.chord();
    return 0;
  });
  protected readonly position = computed(() => this.positions()[this.index()] ?? null);

  protected hasOthers(p: { dots: { role: string }[] }): boolean {
    return p.dots.some((d) => d.role !== 'root');
  }

  protected step(delta: number): void {
    const count = this.positions().length;
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
  protected readonly stringLines = [0, 1, 2, 3];
}
