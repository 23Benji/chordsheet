import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ACTION_WIDTH, SwipeAction } from './swipe-action';

@Component({
  imports: [SwipeAction],
  template: `
    <div class="row" appSwipeAction swipeIgnore=".handle" (swipeDelete)="log.push('delete')" style="width: 300px">
      <button class="swipe-delete">Elimina</button>
      <button class="content" (click)="log.push('open')">Canto</button>
      <span class="handle">≡</span>
    </div>
  `,
})
class Host {
  log: string[] = [];
}

/** A one-finger touch event (jsdom has no Touch constructor: plain objects do). */
const touch = (type: string, x: number, y = 10) => {
  const point = { clientX: x, clientY: y };
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    touches: type === 'touchend' ? [] : [point],
    changedTouches: [point],
  });
};

describe('SwipeAction', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.row') as HTMLElement;
    Object.defineProperty(row, 'offsetWidth', { value: 300 });
    const swipe = (from: number, to: number, target: Element = row.querySelector('.content')!) => {
      target.dispatchEvent(touch('touchstart', from));
      target.dispatchEvent(touch('touchmove', (from + to) / 2));
      target.dispatchEvent(touch('touchmove', to));
      target.dispatchEvent(touch('touchend', to));
    };
    return { row, log: fixture.componentInstance.log, swipe, x: () => row.style.getPropertyValue('--swipe-x') };
  }

  it('a short swipe reveals "Elimina"; tapping it deletes, tapping the row closes', () => {
    const { row, log, swipe, x } = setup();
    swipe(250, 180);
    expect(x()).toBe(`-${ACTION_WIDTH}px`);
    (row.querySelector('.content') as HTMLElement).click(); // the click made by the swipe itself: swallowed
    expect(log).toEqual([]);
    (row.querySelector('.swipe-delete') as HTMLElement).click();
    expect(log).toEqual(['delete']);
    expect(x()).toBe('0px');
  });

  it('a full swipe (past half the row) deletes at once', () => {
    const { log, swipe } = setup();
    swipe(280, 100);
    expect(log).toEqual(['delete']);
  });

  it('claims the horizontal move (no page scroll), leaves vertical moves to the page', () => {
    const { row } = setup();
    const content = row.querySelector('.content')!;
    content.dispatchEvent(touch('touchstart', 250));
    const sideways = touch('touchmove', 200);
    content.dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(true);
    content.dispatchEvent(touch('touchend', 200));
    content.dispatchEvent(touch('touchstart', 250, 10));
    const down = touch('touchmove', 248, 80);
    content.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
  });

  it('a tiny move snaps back; a vertical move is scrolling; the drag handle is left alone', () => {
    const { row, log, swipe, x } = setup();
    swipe(250, 230);
    expect(x()).toBe('0px');
    const content = row.querySelector('.content')!;
    content.dispatchEvent(touch('touchstart', 250, 10));
    content.dispatchEvent(touch('touchmove', 245, 60));
    content.dispatchEvent(touch('touchmove', 100, 120));
    content.dispatchEvent(touch('touchend', 100, 120));
    swipe(280, 100, row.querySelector('.handle')!);
    expect(log).toEqual([]);
  });
});
