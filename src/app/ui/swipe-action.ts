import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/** Width of the revealed "Elimina" button, px. */
export const ACTION_WIDTH = 88;
/** Dragged further than this share of the row: deleted on release (a full swipe). */
const FULL_SWIPE = 0.5;
/** Horizontal movement before the row starts to follow the finger. */
const SLOP = 8;

/**
 * iOS "swipe to delete" on a list row (touch only; computers keep their
 * buttons). Swipe left a little: an "Elimina" button appears behind the row
 * and stays (tap it to delete, tap the row to close); swipe past half the
 * row: deleted at once. Vertical movement stays scrolling. Opening one row
 * closes the one open before.
 *
 * The host needs a child `.swipe-delete` button (the red action); the
 * offset is the CSS variable --swipe-x, styled in styles.scss.
 */
@Directive({
  selector: '[appSwipeAction]',
  host: {
    class: 'swipe-host',
    '[class.swiping]': 'dragging',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp()',
    '(pointercancel)': 'onCancel()',
  },
})
export class SwipeAction {
  /** Swipes starting on elements matching this (e.g. a drag handle) are left alone. */
  readonly swipeIgnore = input('');
  readonly swipeDelete = output<void>();

  private static open: SwipeAction | null = null;
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private start: { x: number; y: number; offset: number } | null = null;
  /** Moving horizontally: the row follows the finger (else the gesture is a scroll or a tap). */
  protected dragging = false;
  private offset = 0;
  /** A swipe just ended: its click must not also open the row. */
  private swallowUntil = -Infinity;

  constructor() {
    // Capture on the row: runs before the click handlers inside it.
    const onClick = (event: Event) => {
      const onAction = (event.target as Element).closest('.swipe-delete');
      if (performance.now() < this.swallowUntil && !onAction) return this.stop(event);
      if (onAction) {
        this.stop(event);
        this.close();
        this.swipeDelete.emit();
      } else if (this.offset !== 0) {
        this.stop(event); // a tap on an open row closes it
        this.close();
      }
    };
    this.el.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.el.removeEventListener('click', onClick, { capture: true });
      if (SwipeAction.open === this) SwipeAction.open = null;
    });
  }

  protected onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    const ignore = this.swipeIgnore();
    if (ignore && (event.target as Element).closest(ignore)) return;
    if ((event.target as Element).closest('.swipe-delete')) return;
    if (SwipeAction.open && SwipeAction.open !== this) SwipeAction.open.close();
    this.start = { x: event.clientX, y: event.clientY, offset: this.offset };
  }

  protected onMove(event: PointerEvent): void {
    if (!this.start) return;
    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    if (!this.dragging) {
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return void (this.start = null); // scrolling
      if (Math.abs(dx) < SLOP) return;
      this.dragging = true;
    }
    this.setOffset(Math.min(0, Math.max(-this.el.offsetWidth, this.start.offset + dx)));
  }

  protected onUp(): void {
    if (this.dragging) {
      this.swallowUntil = performance.now() + 400;
      if (-this.offset > this.el.offsetWidth * FULL_SWIPE) {
        this.close();
        this.swipeDelete.emit();
      } else if (-this.offset > ACTION_WIDTH / 2) {
        this.setOffset(-ACTION_WIDTH);
        SwipeAction.open = this;
      } else {
        this.close();
      }
    }
    this.start = null;
    this.dragging = false;
  }

  protected onCancel(): void {
    if (this.dragging) this.close();
    this.start = null;
    this.dragging = false;
  }

  close(): void {
    this.setOffset(0);
    if (SwipeAction.open === this) SwipeAction.open = null;
  }

  private setOffset(px: number): void {
    this.offset = px;
    this.el.style.setProperty('--swipe-x', `${px}px`);
  }

  private stop(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}
