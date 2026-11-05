import { DestroyRef, Directive, inject, output } from '@angular/core';

/** How long a finger must stay down, ms (iOS uses about half a second). */
export const LONG_PRESS_MS = 500;
/** Moving more than this is scrolling, not pressing. */
const MOVE_TOLERANCE = 10;

/**
 * `(longPress)`: a finger held on the element (touch), or a right-click /
 * the system's long-press menu event (mouse, Android) — the "context menu"
 * gesture of native apps. The click that follows a long press is swallowed,
 * so the row doesn't also open. The host gets `-webkit-touch-callout: none`
 * (no iOS link preview) and no text selection on hold.
 */
@Directive({
  selector: '[appLongPress]',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(contextmenu)': 'onContextMenu($event)',
    '[style.-webkit-touch-callout]': '"none"',
    '[style.-webkit-user-select]': '"none"',
    '[style.user-select]': '"none"',
  },
})
export class LongPress {
  readonly longPress = output<void>();

  private timer: ReturnType<typeof setTimeout> | undefined;
  private start: { x: number; y: number } | null = null;
  /** When the last long press fired: a duplicate contextmenu right after it is ignored. */
  private firedAt = -Infinity;
  /** The finger that opened the menu is still down. */
  private held = false;
  /** That finger was just lifted: the click it makes (if any) is swallowed until then. */
  private swallowUntil = -Infinity;

  constructor() {
    // The click that follows a long press must be swallowed: lifting the
    // finger "clicks" whatever is under it by then — the row (which would
    // open the song) or the menu's backdrop that just appeared (which would
    // close the menu again). A capture listener on the window runs before
    // every other click handler on the page, so it can stop it in time.
    const onClick = (event: Event) => {
      if (performance.now() < this.swallowUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.swallowUntil = -Infinity; // just that one click
      }
    };
    window.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('click', onClick, { capture: true }));
  }

  protected onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    this.cancel();
    this.start = { x: event.clientX, y: event.clientY };
    this.timer = setTimeout(() => {
      this.held = true;
      this.fire();
    }, LONG_PRESS_MS);
  }

  protected onUp(): void {
    // A touch keeps sending its events to where it started (implicit
    // capture), so this arrives even if the menu now covers the row. The
    // click follows within a few ms; iOS may send none — then nothing waits.
    if (this.held) this.swallowUntil = performance.now() + 400;
    this.held = false;
    this.cancel();
  }

  protected onMove(event: PointerEvent): void {
    if (this.start && Math.hypot(event.clientX - this.start.x, event.clientY - this.start.y) > MOVE_TOLERANCE) this.cancel();
  }

  protected cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.start = null;
  }

  protected onContextMenu(event: Event): void {
    event.preventDefault();
    // Android sends contextmenu after our own timer already fired: once is enough.
    if (performance.now() - this.firedAt > 800) this.fire();
  }

  private fire(): void {
    this.cancel();
    this.firedAt = performance.now();
    this.longPress.emit();
  }
}
