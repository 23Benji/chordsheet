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

const pointer = (type: string, x: number, y = 10) =>
  Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, pointerId: 1 });

describe('SwipeAction', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.row') as HTMLElement;
    Object.defineProperty(row, 'offsetWidth', { value: 300 });
    const swipe = (from: number, to: number, target: Element = row.querySelector('.content')!) => {
      target.dispatchEvent(pointer('pointerdown', from));
      target.dispatchEvent(pointer('pointermove', (from + to) / 2));
      target.dispatchEvent(pointer('pointermove', to));
      target.dispatchEvent(pointer('pointerup', to));
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

  it('a tiny move snaps back; a vertical move is scrolling; the drag handle is left alone', () => {
    const { row, log, swipe, x } = setup();
    swipe(250, 230);
    expect(x()).toBe('0px');
    const content = row.querySelector('.content')!;
    content.dispatchEvent(pointer('pointerdown', 250, 10));
    content.dispatchEvent(pointer('pointermove', 245, 60));
    content.dispatchEvent(pointer('pointermove', 100, 120));
    content.dispatchEvent(pointer('pointerup', 100, 120));
    swipe(280, 100, row.querySelector('.handle')!);
    expect(log).toEqual([]);
  });
});
