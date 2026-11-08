import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FabMenu } from './fab-menu';

describe('FabMenu', () => {
  it('with no options the "+" does one thing and opens no dial', () => {
    TestBed.configureTestingModule({ imports: [FabMenu], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(FabMenu);
    fixture.componentRef.setInput('link', null);
    let pressed = 0;
    fixture.componentInstance.pressed.subscribe(() => pressed++);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLElement>('.fab')!.click();
    expect(pressed).toBe(1);
    expect(el.querySelector('app-fab-dial')).toBeNull();
  });
});
