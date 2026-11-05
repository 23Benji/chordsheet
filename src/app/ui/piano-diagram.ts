import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { chordNotes, isBlackKey, keyboardRange, pianoVoicings } from '../core/chord-notes';
import { IT } from '../i18n/it';
import { DiagramVoicings } from './diagram-voicings';

const WHITE_W = 16;
const WHITE_H = 62;
const BLACK_W = 10;
const BLACK_H = 38;
/** Note names: white keys on the first row, black keys on a second row (neighbours never overlap). */
const LABEL_ROW = 12;

interface Key {
  key: number;
  x: number;
  pressed: boolean;
  root: boolean;
  name: string | null;
}

/** Piano chord diagram (SVG): a short keyboard with the chord's keys lit, note names underneath. */
@Component({
  selector: 'app-piano-diagram',
  imports: [DiagramVoicings],
  template: `
    @if (layout(); as l) {
      <figure>
        <figcaption>{{ chord() }}</figcaption>
        <svg [attr.viewBox]="'0 0 ' + l.width + ' ' + l.height" [style.width.px]="l.width * 1.15" role="img" [attr.aria-label]="t.pianoAria(chord(), l.names)">
          @for (k of l.whites; track k.key) {
            <rect [attr.x]="k.x" y="0" [attr.width]="whiteW" [attr.height]="whiteH" rx="2" class="white" [class.pressed]="k.pressed" />
          }
          @for (k of l.blacks; track k.key) {
            <rect [attr.x]="k.x" y="0" [attr.width]="blackW" [attr.height]="blackH" rx="1.5" class="black" [class.pressed]="k.pressed" />
          }
          @for (k of l.labelled; track k.key) {
            <text [attr.x]="k.x" [attr.y]="whiteH + labelRow * (k.row + 1)" class="label" [class.root]="k.root">{{ k.name }}</text>
          }
        </svg>
        <p class="hint">{{ voicing()!.inversion === 0 ? t.rootPosition : t.inversion(voicing()!.inversion) }}</p>
        @if (notes()?.bass; as b) {
          <p class="hint">{{ t.leftHand(b.name) }}</p>
        }
        @if (voicings().length > 1) {
          <app-diagram-voicings [index]="index()" [count]="voicings().length" [label]="t.inversions" (step)="step($event)" />
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
      height: auto;
      margin: 4px auto 0;
    }
    .white {
      fill: var(--key-white);
      stroke: var(--key-black);
      stroke-width: 0.8;
    }
    .black {
      fill: var(--key-black);
    }
    .pressed {
      fill: var(--accent);
    }
    .label {
      fill: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      text-anchor: middle;
    }
    .label.root {
      fill: var(--accent);
    }
    .hint {
      margin: 2px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PianoDiagram {
  readonly chord = input.required<string>();
  protected readonly notes = computed(() => chordNotes(this.chord()));
  protected readonly voicings = computed(() => {
    const notes = this.notes();
    return notes ? pianoVoicings(notes) : [];
  });
  /** linkedSignal: back to root position whenever the chord changes. */
  protected readonly index = linkedSignal(() => {
    this.chord();
    return 0;
  });
  protected readonly voicing = computed(() => this.voicings()[this.index()] ?? null);

  /** Where every key of the visible range goes. Black keys sit on the line between two white keys. */
  protected readonly layout = computed(() => {
    const v = this.voicing();
    if (!v) return null;
    const { from, to } = keyboardRange(v.keys);
    const whites: Key[] = [];
    const blacks: Key[] = [];
    let white = 0;
    for (let key = from; key <= to; key++) {
      const i = v.keys.indexOf(key);
      const k = { key, pressed: i >= 0, root: key === v.rootKey, name: i >= 0 ? v.names[i] : null };
      if (isBlackKey(key)) blacks.push({ ...k, x: white * WHITE_W - BLACK_W / 2 });
      else whites.push({ ...k, x: white++ * WHITE_W });
    }
    const centre = (k: Key) => ({ ...k, x: k.x + (isBlackKey(k.key) ? BLACK_W : WHITE_W) / 2, row: isBlackKey(k.key) ? 1 : 0 });
    const blackPressed = blacks.some((k) => k.pressed);
    return {
      width: white * WHITE_W,
      height: WHITE_H + LABEL_ROW * (blackPressed ? 2 : 1) + 4,
      whites,
      blacks,
      labelled: [...whites, ...blacks].filter((k) => k.pressed).map(centre),
      names: v.names.join(' '),
    };
  });

  protected step(delta: number): void {
    const count = this.voicings().length;
    this.index.update((i) => (i + delta + count) % count);
  }

  protected readonly t = IT.diagrams;
  protected readonly whiteW = WHITE_W;
  protected readonly whiteH = WHITE_H;
  protected readonly blackW = BLACK_W;
  protected readonly blackH = BLACK_H;
  protected readonly labelRow = LABEL_ROW;
}
