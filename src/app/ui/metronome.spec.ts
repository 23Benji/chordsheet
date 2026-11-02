import { TestBed } from '@angular/core/testing';
import { Metronome } from './metronome';

describe('Metronome', () => {
  it('starts from the song tempo, adjusts with −/+ and tap tempo', () => {
    const fixture = TestBed.createComponent(Metronome);
    fixture.componentRef.setInput('tempo', 108);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('button')!.click(); // the chip opens the panel (in the overlay)
    fixture.detectChanges();
    const bpm = () => document.querySelector<HTMLInputElement>('.bpm input')!.value;
    expect(bpm()).toBe('108');
    document.querySelector<HTMLButtonElement>('[aria-label="Più veloce"]')!.click();
    fixture.detectChanges();
    expect(bpm()).toBe('109');

    const now = vi.spyOn(performance, 'now');
    const tap = document.querySelector<HTMLButtonElement>('.tap')!;
    [0, 600, 1200].forEach((t) => {
      now.mockReturnValue(t);
      tap.click();
    });
    fixture.detectChanges();
    expect(bpm()).toBe('100');
    now.mockRestore();
  });
});
