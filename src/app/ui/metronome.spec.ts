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

  it('saves a change for the song once, after the player stops changing', () => {
    vi.useFakeTimers();
    const saved: unknown[] = [];
    const fixture = TestBed.createComponent(Metronome);
    fixture.componentRef.setInput('songId', 's1');
    fixture.componentRef.setInput('save', (c: unknown) => saved.push(c));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chip-value')).toBeNull(); // no tempo yet: just "BPM"
    el.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    const faster = document.querySelector<HTMLButtonElement>('[aria-label="Più veloce"]')!;
    faster.click();
    faster.click();
    vi.advanceTimersByTime(300);
    expect(saved).toEqual([]);
    document.querySelector<HTMLButtonElement>('[role="radio"]:nth-child(2)')!.click(); // 3/4
    vi.advanceTimersByTime(600);
    expect(saved).toEqual([{ songId: 's1', bpm: 92, meter: 3 }]);
    fixture.detectChanges();
    expect(document.querySelector('.saved')?.textContent).toContain('Salvato per questo canto');

    // Leaving the song right after a change still saves it, for that song.
    faster.click();
    fixture.componentRef.setInput('songId', 's2');
    fixture.detectChanges();
    expect(saved[1]).toEqual({ songId: 's1', bpm: 93, meter: 3 });
    vi.useRealTimers();
  });
});
