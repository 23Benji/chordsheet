import { Directive, ElementRef, afterRenderEffect, computed, effect, inject, input, signal } from '@angular/core';
import {
  HALF_PAGE_RATIO,
  VERTICAL_PAGE_RATIO,
  columnHalfCount,
  columnHalfOffset,
  columnPageCount,
  columnPageOffset,
  verticalPageAt,
  verticalPageCount,
  verticalPageOffset,
} from '../core/paging';

export type PagerMode = 'columns' | 'vertical';

/**
 * Turns a scroll container into pages (see core/paging.ts):
 * - 'columns': the element is a fixed-height multi-column box; overflow
 *   becomes more columns to the right, reached by scrolling horizontally
 *   from code (the element has overflow: hidden).
 * - 'vertical': normal vertical scrolling, one page = one screen.
 *
 * Usage: `<article [appPager]="'columns'" [pagerWatch]="something" #pager="pager">`
 * then `pager.next()`, `pager.page()`, `pager.pageCount()`.
 */
@Directive({
  selector: '[appPager]',
  exportAs: 'pager',
  host: { '(scroll)': 'onScroll()' },
})
export class Pager {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly mode = input<PagerMode>('columns', { alias: 'appPager' });
  /** Any value whose change means "the content changed, measure again". */
  readonly watch = input<unknown>(null, { alias: 'pagerWatch' });
  /** Half-page turns: one column, or half a screen, per turn (see core/paging.ts). */
  readonly half = input(false, { alias: 'pagerHalf' });

  readonly page = signal(0);
  readonly pageCount = signal(1);
  readonly atEnd = computed(() => this.page() >= this.pageCount() - 1);

  constructor() {
    // afterRenderEffect runs after the DOM is updated, so the new layout can
    // be measured. Reading watch()/mode() makes it re-run when they change.
    afterRenderEffect(() => {
      this.watch();
      this.mode();
      this.half();
      this.measure();
    });
    effect((onCleanup) => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.el);
      onCleanup(() => observer.disconnect());
    });
  }

  private gap(): number {
    return parseFloat(getComputedStyle(this.el).columnGap) || 0;
  }

  private get ratio(): number {
    return this.half() ? HALF_PAGE_RATIO : VERTICAL_PAGE_RATIO;
  }

  /** Columns: where page (or half-page step) `page` starts. */
  private columnOffset(page: number): number {
    const { clientWidth } = this.el;
    return this.half() ? columnHalfOffset(page, clientWidth, this.gap()) : columnPageOffset(page, clientWidth, this.gap());
  }

  measure(): void {
    const el = this.el;
    const count =
      this.mode() === 'columns'
        ? this.half()
          ? columnHalfCount(el.scrollWidth, el.clientWidth, this.gap())
          : columnPageCount(el.scrollWidth, el.clientWidth, this.gap())
        : verticalPageCount(el.scrollHeight, el.clientHeight, this.ratio);
    this.pageCount.set(count);
    if (this.page() >= count) this.page.set(count - 1);
    if (this.mode() === 'columns') this.el.scrollTo({ left: this.columnOffset(this.page()) });
  }

  goTo(page: number, smooth = true): void {
    const target = Math.min(Math.max(page, 0), this.pageCount() - 1);
    this.page.set(target);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth && !reduceMotion ? 'smooth' : 'auto';
    if (behavior === 'smooth') this.animatingUntil = performance.now() + 800;
    const el = this.el;
    if (this.mode() === 'columns') {
      el.scrollTo({ left: this.columnOffset(target), behavior });
    } else {
      el.scrollTo({ top: verticalPageOffset(target, el.scrollHeight, el.clientHeight, this.ratio), behavior });
    }
  }

  /** Next page; false if already on the last one (e.g. go to the next song). */
  next(): boolean {
    if (this.atEnd()) return false;
    this.goTo(this.page() + 1);
    return true;
  }

  /** Previous page; false if already on the first one. */
  prev(): boolean {
    if (this.page() === 0) return false;
    this.goTo(this.page() - 1);
    return true;
  }

  reset(): void {
    this.page.set(0);
    this.el.scrollTo({ left: 0, top: 0 });
  }

  /** Visible height in px (one vertical screen). */
  get height(): number {
    return this.el.clientHeight;
  }

  /** Exact (fractional) auto-scroll position: browsers round scrollTop. */
  private exactTop = 0;

  /** Auto-scroll step (vertical): move by `px`; true while there is more to scroll. */
  scrollBy(px: number): boolean {
    const el = this.el;
    // The user scrolled by hand meanwhile: continue from there.
    if (Math.abs(el.scrollTop - this.exactTop) > 2) this.exactTop = el.scrollTop;
    this.exactTop += px;
    el.scrollTop = this.exactTop;
    return el.scrollTop < el.scrollHeight - el.clientHeight - 1;
  }

  private animatingUntil = 0;

  /**
   * Vertical: a manual (touch/wheel) scroll keeps the page number right.
   * Columns: the browser sometimes scrolls the box by itself (e.g. to show a
   * focused line); snap back to the current page.
   */
  protected onScroll(): void {
    if (this.mode() === 'columns') {
      if (performance.now() < this.animatingUntil) return; // our own smooth page turn
      const expected = this.columnOffset(this.page());
      if (Math.abs(this.el.scrollLeft - expected) > 1) this.el.scrollTo({ left: expected });
      return;
    }
    const el = this.el;
    this.page.set(verticalPageAt(el.scrollTop, el.scrollHeight, el.clientHeight, this.ratio));
  }
}
