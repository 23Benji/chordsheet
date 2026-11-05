import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Swipe } from './swipe';

@Component({
  imports: [Swipe],
  template: `<div appSwipe (swipeLeft)="log.push('left')" (swipeRight)="log.push('right')"></div>`,
})
class Host {
  log: string[] = [];
}

const pointer = (type: string, x: number, y: number, pointerType = 'touch', pointerId = 1) =>
  Object.assign(new Event(type), { clientX: x, clientY: y, pointerId, pointerType });

describe('Swipe directive', () => {
  it('emits left/right for touch swipes, ignores the mouse and vertical scrolls', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('div') as HTMLElement;
    const gesture = (x1: number, y1: number, x2: number, y2: number, type = 'touch') => {
      el.dispatchEvent(pointer('pointerdown', x1, y1, type));
      el.dispatchEvent(pointer('pointerup', x2, y2, type));
    };
    gesture(300, 100, 150, 110);
    gesture(100, 100, 260, 90);
    gesture(100, 100, 110, 400); // vertical scroll
    gesture(300, 100, 100, 100, 'mouse');
    expect(fixture.componentInstance.log).toEqual(['left', 'right']);
  });

  it('a two-finger pinch is never a swipe', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('div') as HTMLElement;
    el.dispatchEvent(pointer('pointerdown', 200, 300, 'touch', 1));
    el.dispatchEvent(pointer('pointerdown', 220, 400, 'touch', 2));
    el.dispatchEvent(pointer('pointerup', 50, 300, 'touch', 1)); // first finger moved far left
    el.dispatchEvent(pointer('pointerup', 360, 400, 'touch', 2));
    // A normal swipe afterwards works again.
    el.dispatchEvent(pointer('pointerdown', 300, 100, 'touch', 3));
    el.dispatchEvent(pointer('pointerup', 150, 110, 'touch', 3));
    expect(fixture.componentInstance.log).toEqual(['left']);
  });
});
