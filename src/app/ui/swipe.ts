import { Directive, output } from '@angular/core';
import { detectSwipe } from '../core/gestures';

/**
 * Horizontal swipes on touch screens: `(swipeLeft)` / `(swipeRight)`.
 * Mouse is ignored (keyboard and buttons cover the desktop). Give the element
 * `touch-action: pan-y` so vertical scrolling still works and horizontal
 * movement reaches us.
 */
@Directive({
  selector: '[appSwipe]',
  exportAs: 'swipe',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onCancel($event)',
  },
})
export class Swipe {
  readonly swipeLeft = output<void>();
  readonly swipeRight = output<void>();

  protected start: { x: number; y: number; time: number; id: number } | null = null;
  private lastSwipe = 0;
  /** Fingers on the screen; with two (a pinch) there is no swipe until all lift. */
  private readonly down = new Set<number>();
  private multiTouch = false;

  /** True right after a swipe: the click that may follow it should be ignored. */
  get justSwiped(): boolean {
    return performance.now() - this.lastSwipe < 400;
  }

  protected onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return;
    this.down.add(event.pointerId);
    if (this.down.size > 1) {
      this.multiTouch = true;
      this.start = null;
      return;
    }
    this.start = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  }

  protected onCancel(event: PointerEvent): void {
    this.down.delete(event.pointerId);
    if (this.down.size === 0) this.multiTouch = false;
    this.start = null;
  }

  protected onUp(event: PointerEvent): void {
    this.down.delete(event.pointerId);
    const start = this.start;
    this.start = null;
    if (this.multiTouch) {
      if (this.down.size === 0) this.multiTouch = false;
      // The click that follows a pinch shouldn't turn the page either.
      this.lastSwipe = performance.now();
      return;
    }
    if (!start || start.id !== event.pointerId) return;
    const swipe = detectSwipe(event.clientX - start.x, event.clientY - start.y, performance.now() - start.time);
    if (!swipe) return;
    this.lastSwipe = performance.now();
    if (swipe === 'left') this.swipeLeft.emit();
    else this.swipeRight.emit();
  }
}
