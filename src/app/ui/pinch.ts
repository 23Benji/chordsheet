import { Directive, input, output } from '@angular/core';
import { fingerDistance } from '../core/gestures';

/**
 * Two-finger pinch to zoom the song text (touch screens).
 *
 * While the fingers move, the target element is only *scaled* with a CSS
 * transform (cheap: no re-layout, so it follows the fingers smoothly); when
 * they lift, `(pinched)` gives the final ratio and the page sets the real
 * text size, which re-flows the lines once. The browser's own page zoom
 * (which would also enlarge buttons and bars) is blocked while pinching here.
 *
 * Plain DOM events, no signals: a pinch fires ~60 events a second and none
 * of them needs Angular to re-render anything.
 */
@Directive({
  selector: '[appPinch]',
  host: {
    '(touchstart)': 'onStart($event)',
    '(touchmove)': 'onMove($event)',
    '(touchend)': 'onEnd($event)',
    '(touchcancel)': 'onEnd($event)',
    // Safari's own pinch events: cancelling them stops the page zoom.
    '(gesturestart)': '$event.preventDefault()',
    '(gesturechange)': '$event.preventDefault()',
  },
})
export class Pinch {
  /** The element that grows while pinching (the song text). */
  readonly appPinch = input.required<HTMLElement | undefined>();
  /** Limits of the ratio, so the preview stops where the real size will. */
  readonly pinchMin = input(0.3);
  readonly pinchMax = input(3);
  readonly pinched = output<number>();

  private startDistance = 0;
  private ratio = 1;

  protected onStart(event: TouchEvent): void {
    if (event.touches.length !== 2) return;
    const target = this.appPinch();
    if (!target) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    this.startDistance = fingerDistance(a, b);
    this.ratio = 1;
    // Grow around the point between the fingers, like zooming a photo.
    const rect = target.getBoundingClientRect();
    target.style.transformOrigin = `${(a.clientX + b.clientX) / 2 - rect.left}px ${(a.clientY + b.clientY) / 2 - rect.top}px`;
    target.style.willChange = 'transform';
  }

  protected onMove(event: TouchEvent): void {
    if (!this.startDistance || event.touches.length !== 2) return;
    event.preventDefault(); // no page scroll / page zoom while pinching
    const distance = fingerDistance(event.touches[0], event.touches[1]);
    this.ratio = Math.min(this.pinchMax(), Math.max(this.pinchMin(), distance / this.startDistance));
    const target = this.appPinch();
    if (target) target.style.transform = `scale(${this.ratio})`;
  }

  protected onEnd(event: TouchEvent): void {
    if (!this.startDistance || event.touches.length >= 2) return;
    this.startDistance = 0;
    const target = this.appPinch();
    if (target) {
      target.style.transform = '';
      target.style.transformOrigin = '';
      target.style.willChange = '';
    }
    // Ignore a tiny wobble: two fingers resting on the screen aren't a zoom.
    if (Math.abs(this.ratio - 1) > 0.04) this.pinched.emit(this.ratio);
  }
}
