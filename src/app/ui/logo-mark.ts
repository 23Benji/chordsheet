import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The app's symbol (two cream lines of text, two amber chords) drawn with four
 * HTML bars instead of an image, so each piece can move on its own:
 * - still: the logo as on the icon
 * - loading: the chords slide back and forth along their lines (waiting for something)
 * - done: the chords give a small "pop" (it worked)
 *
 * Size: set `--logo-size` (the width) on the element; the height follows.
 * Positions are percentages of the icon's symbol box (312 × 240 units, see scripts/icon/icon.svg).
 */
export type LogoState = 'still' | 'loading' | 'done';

@Component({
  selector: 'app-logo-mark',
  template: `
    <span class="bar chord c1"></span>
    <span class="bar line l1"></span>
    <span class="bar chord c2"></span>
    <span class="bar line l2"></span>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: var(--logo-size, 160px);
      aspect-ratio: 312 / 240;
    }
    .bar {
      position: absolute;
      border-radius: 999px;
    }
    .chord {
      width: 17.63%;
      height: 11.46%;
      background: linear-gradient(var(--logo-amber-top), var(--logo-amber-mid) 60%, var(--logo-amber-bottom));
      box-shadow: 0 0 calc(var(--logo-size, 160px) * 0.07) var(--logo-glow);
    }
    .line {
      left: 4.73%;
      height: 7.29%;
      background: linear-gradient(var(--logo-cream-top), var(--logo-cream-bottom));
    }
    .c1 { left: 7.53%; top: 10%; }
    .l1 { top: 34.48%; width: 90.54%; }
    .c2 { left: 64.42%; top: 62.08%; }
    .l2 { top: 86.56%; width: 73.72%; }

    :host(.loading) .c1 { animation: slide-right 1.4s ease-in-out infinite; }
    :host(.loading) .c2 { animation: slide-left 1.4s ease-in-out infinite; }
    :host(.done) .chord { animation: pop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1); }

    @keyframes slide-right { 50% { transform: translateX(330%); } }
    @keyframes slide-left { 50% { transform: translateX(-330%); } }
    @keyframes pop { 40% { transform: scale(1.35); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class]': 'state()' },
})
export class LogoMark {
  readonly state = input<LogoState>('still');
}
