import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LONG_PRESS_MS, LongPress } from './long-press';

@Component({
  imports: [LongPress],
  template: `<a href="#" appLongPress (longPress)="log.push('menu')" (click)="log.push('open'); $event.preventDefault()">row</a>`,
})
class Host {
  log: string[] = [];
}

const pointer = (type: string, x = 10, y = 10, pointerType = 'touch') =>
  Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerType, isPrimary: true, pointerId: 1 });

describe('LongPress', () => {
  function setup() {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { el: fixture.nativeElement.querySelector('a') as HTMLElement, log: fixture.componentInstance.log };
  }
  afterEach(() => vi.useRealTimers());

  it('a held finger opens the menu, and the click after it does not open the row', () => {
    const { el, log } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    el.dispatchEvent(pointer('pointerup'));
    el.click();
    expect(log).toEqual(['menu']);
  });

  it('a quick tap opens the row; moving (scrolling) cancels the press', () => {
    const { el, log } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(150);
    el.dispatchEvent(pointer('pointerup'));
    el.click();
    el.dispatchEvent(pointer('pointerdown', 10, 10));
    el.dispatchEvent(pointer('pointermove', 10, 40));
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    expect(log).toEqual(['open']);
  });

  it('after a long press without a click (iOS), the next real tap still works', () => {
    const { el, log } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    el.dispatchEvent(pointer('pointerup'));
    vi.advanceTimersByTime(1000); // no click came; the user taps again later
    el.click();
    expect(log).toEqual(['menu', 'open']);
  });

  it('right-click opens the menu (and only once on Android, where both events come)', () => {
    const { el, log } = setup();
    el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
    expect(log).toEqual(['menu']);
    vi.advanceTimersByTime(2000);
    el.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true }));
    expect(log).toEqual(['menu', 'menu']);
  });
});
