import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, output } from '@angular/core';
import { IntroGeometry, introFinished, introFrame, introGeometry } from '../../core/intro-animation';
import { IT } from '../../i18n/it';
import { isSignInReturn } from '../../services/sync-config';

/**
 * Play the intro? Only when the app starts (this component exists only then),
 * not when coming back from Google's sign-in page (the user just saw it), and
 * not for people who asked their phone for less motion.
 */
export function shouldPlayIntro(): boolean {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return false;
  if (isSignInReturn(location.href)) return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The opening animation, over the app while it gets ready underneath (the
 * maths is in core/intro-animation.ts). A tap anywhere skips it.
 *
 * Drawn on an SVG, updated once per animation frame by setting attributes
 * directly: this app has no zone.js, so requestAnimationFrame doesn't make
 * Angular re-check the page 60 times a second.
 */
@Component({
  selector: 'app-intro',
  template: `
    <div class="stage" (pointerdown)="skip()">
      <div class="glow" [style.left.px]="g.centerX" [style.top.px]="g.centerY" [style.--glow-size.px]="g.size * 2"></div>
      <svg [attr.viewBox]="'0 0 ' + g.width + ' ' + g.height" aria-hidden="true">
        <defs>
          @for (line of g.lines; track $index) {
            <!-- userSpaceOnUse: a box-relative gradient can't paint a perfectly straight line (its box has no height). -->
            <linearGradient [attr.id]="'intro-line-' + $index" gradientUnits="userSpaceOnUse" x1="0" x2="0" [attr.y1]="line.y - g.stroke / 2" [attr.y2]="line.y + g.stroke / 2">
              <stop offset="0" style="stop-color: var(--logo-cream-top)" />
              <stop offset="1" style="stop-color: var(--logo-cream-bottom)" />
            </linearGradient>
          }
          <linearGradient id="intro-cream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color: var(--logo-cream-top)" />
            <stop offset="1" style="stop-color: var(--logo-cream-bottom)" />
          </linearGradient>
          <linearGradient id="intro-amber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color: var(--logo-amber-top)" />
            <stop offset="0.6" style="stop-color: var(--logo-amber-mid)" />
            <stop offset="1" style="stop-color: var(--logo-amber-bottom)" />
          </linearGradient>
          <filter id="intro-blur" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        @for (extra of g.extras; track $index) {
          <rect
            class="extra"
            opacity="0"
            [attr.y]="extra.y"
            [attr.width]="extra.chord ? g.chordWidth * 0.9 : extra.width"
            [attr.height]="(extra.chord ? g.chordHeight : g.stroke) * 0.9"
            [attr.rx]="((extra.chord ? g.chordHeight : g.stroke) * 0.9) / 2"
            [attr.fill]="extra.chord ? 'url(#intro-amber)' : 'url(#intro-cream)'"
          />
        }
        @for (line of g.lines; track $index) {
          <path class="line" fill="none" stroke-linecap="round" opacity="0" [attr.stroke]="'url(#intro-line-' + $index + ')'" [attr.stroke-width]="g.stroke" />
        }
        @for (chord of g.chords; track $index) {
          <g class="chord" opacity="0">
            <rect [attr.width]="g.chordWidth" [attr.height]="g.chordHeight" [attr.rx]="g.chordHeight / 2" fill="url(#intro-amber)" filter="url(#intro-blur)" opacity="0.7" />
            <rect [attr.width]="g.chordWidth" [attr.height]="g.chordHeight" [attr.rx]="g.chordHeight / 2" fill="url(#intro-amber)" />
          </g>
        }
      </svg>
      <p class="name" [style.top.px]="g.nameTop" [style.font-size.px]="g.size * 0.18">{{ appName }}</p>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
    }
    .stage {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: radial-gradient(120% 70% at 50% 42%, var(--intro-bg-center), var(--bg) 60%, var(--intro-bg-edge));
      color: var(--text);
      will-change: opacity, transform;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .glow {
      position: absolute;
      width: var(--glow-size);
      height: var(--glow-size);
      translate: -50% -50%;
      background: radial-gradient(closest-side, var(--intro-glow), var(--intro-glow-soft) 60%, transparent);
      opacity: 0;
    }
    .name {
      position: absolute;
      left: 0;
      right: 0;
      margin: 0;
      font-family: var(--font-heading);
      font-weight: 700;
      line-height: 1;
      text-align: center;
      opacity: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Always dark (like the launch screen): the app's theme comes after.
  host: { 'data-theme': 'dark' },
})
export class Intro {
  /** The animation is over (or was skipped): remove this component. */
  readonly finished = output<void>();

  protected readonly appName = IT.appName;
  protected readonly g: IntroGeometry = introGeometry(window.innerWidth, window.innerHeight);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private start = 0;
  private skipAt: number | null = null;
  private frameId = 0;
  private done = false;

  constructor() {
    afterNextRender(() => {
      const q = <T extends Element>(selector: string) => [...this.host.querySelectorAll<T>(selector)];
      const stage = this.host.querySelector<HTMLElement>('.stage')!;
      const glow = this.host.querySelector<HTMLElement>('.glow')!;
      const name = this.host.querySelector<HTMLElement>('.name')!;
      const lines = q<SVGPathElement>('.line');
      const chords = q<SVGGElement>('.chord');
      const extras = q<SVGRectElement>('.extra');

      const draw = (now: number) => {
        if (this.done) return;
        if (!this.start) this.start = now;
        const t = now - this.start;
        const f = introFrame(this.g, t, this.skipAt);
        f.lines.forEach((line, i) => {
          lines[i].setAttribute('d', line.d);
          lines[i].setAttribute('opacity', String(line.opacity));
        });
        f.chords.forEach((c, i) => {
          chords[i].setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
          chords[i].setAttribute('opacity', c.opacity.toFixed(3));
        });
        f.extras.forEach((e, i) => {
          extras[i].setAttribute('x', e.x.toFixed(1));
          extras[i].setAttribute('opacity', e.opacity.toFixed(3));
        });
        glow.style.opacity = String(f.glow);
        glow.style.scale = String(0.6 + 0.4 * f.glow);
        name.style.opacity = String(f.name);
        name.style.transform = `translateY(${(12 * (1 - f.name)).toFixed(1)}px)`;
        name.style.filter = f.name < 1 ? `blur(${(4 * (1 - f.name)).toFixed(1)}px)` : '';
        stage.style.opacity = String(1 - f.exit * f.exit);
        stage.style.transform = f.exit ? `scale(${1 + 0.06 * f.exit})` : '';
        if (introFinished(t, this.skipAt)) this.finish();
        else this.frameId = requestAnimationFrame(draw);
      };
      this.frameId = requestAnimationFrame(draw);
    });

    // Sent to the background meanwhile (iOS also stops animation frames): just end it.
    const hidden = () => document.visibilityState === 'hidden' && this.finish();
    document.addEventListener('visibilitychange', hidden);
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.frameId);
      document.removeEventListener('visibilitychange', hidden);
    });
  }

  protected skip(): void {
    if (this.skipAt === null && this.start) this.skipAt = performance.now() - this.start;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    cancelAnimationFrame(this.frameId);
    this.finished.emit();
  }
}
