import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Song } from '../../core/models';
import { songFromChordPro } from '../../core/song-import';
import { DB } from '../../data/db';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { SettingsService } from '../../services/settings.service';
import { Setlist } from '../../core/models';
import { PerformanceView } from './performance-view';

const a = songFromChordPro('{title: Primo}\n{meta: numero 1}\n{tempo: 120}\n[C]uno', '', 'bundled');
const b = songFromChordPro('{title: Secondo}\n{meta: numero 2}\n[G]due', '', 'bundled');
const c = songFromChordPro('{title: Terzo}\n{meta: numero 3}\n[D]tre', '', 'bundled');

const fakeDb = {
  songPrefs: { toArray: async () => [], put: async () => undefined },
  settings: { get: async () => undefined, put: async () => undefined },
  annotations: { toArray: async () => [] },
};

function setup(id: string, coda?: string, setlist?: Setlist, pos = 0) {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });

  const songs = new Map<string, Song>([a, b, c].map((s) => [s.id, s]));
  TestBed.configureTestingModule({
    imports: [PerformanceView],
    providers: [
      provideRouter([]),
      { provide: DB, useValue: fakeDb },
      { provide: LibraryService, useValue: { byId: signal(songs) } },
      ...(setlist ? [{ provide: SetlistService, useValue: { byId: signal(new Map([[setlist.id, setlist]])) } }] : []),
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PerformanceView);
  fixture.componentRef.setInput('id', id);
  if (coda) fixture.componentRef.setInput('coda', coda);
  if (setlist) {
    fixture.componentRef.setInput('scaletta', setlist.id);
    fixture.componentRef.setInput('pos', pos);
  }
  fixture.detectChanges();
  const press = (key: string) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  };
  return { fixture, el: fixture.nativeElement as HTMLElement, press, navigate, request };
}

describe('PerformanceView', () => {
  const coda = [a.id, b.id, c.id].join(',');

  it('shows the song large, keeps the screen awake and shows the queue position', () => {
    const { el, request } = setup(b.id, coda);
    expect(el.querySelector('.song-title')?.textContent).toContain('Secondo');
    expect(el.querySelector('.bar .meta')?.textContent).toContain('Canto 2 di 3');
    expect(el.querySelector('.up-next')?.textContent).toBe('Prossimo: Terzo');
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('next/prev at the end/start of a song move through the queue', () => {
    const { press, navigate } = setup(b.id, coda);
    press(' ');
    expect(navigate).toHaveBeenLastCalledWith(['/canto', c.id, 'esibizione'], { queryParams: { coda }, replaceUrl: true });
    press('PageUp');
    expect(navigate).toHaveBeenLastCalledWith(['/canto', a.id, 'esibizione'], { queryParams: { coda }, replaceUrl: true });
  });

  it('without a queue, the last page says "Fine" and next does nothing', () => {
    const { el, press, navigate } = setup(a.id);
    expect(el.querySelector('.indicator')?.textContent).toContain('Fine');
    press('ArrowRight');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('S starts/stops auto-scroll, ] and [ change the speed, "Da tempo" uses {tempo}', async () => {
    const { el, press, fixture } = setup(a.id);
    press('s');
    expect(el.querySelector('[aria-label^="Ferma scorrimento"]')).not.toBeNull();
    press('S');
    expect(el.querySelector('[aria-label^="Avvia scorrimento"]')).not.toBeNull();
    press(']');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.speed .wide-text')?.textContent).toBe('27 s/pagina');
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((x) => x.textContent?.includes('Da tempo'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.speed .wide-text')?.textContent).toBe('32 s/pagina');
  });

  it('uses the configured pedal keys', async () => {
    const { press, navigate, fixture } = setup(b.id, coda);
    await TestBed.inject(SettingsService).update({ keyboardMap: { q: 'next' } });
    fixture.detectChanges();
    press(' '); // no longer mapped
    expect(navigate).not.toHaveBeenCalled();
    press('q');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('Esc (not in full screen) leaves performance mode', () => {
    const { press, navigate } = setup(a.id);
    press('Escape');
    expect(navigate).toHaveBeenCalledWith(['/canto', a.id]);
  });

  it('plays a setlist: item transposition and note, next/prev by position (same song twice)', () => {
    const setlist: Setlist = {
      id: 'sl',
      name: 'Domenica',
      items: [
        { id: '1', songId: a.id, transpose: 2, note: 'solo chitarra' },
        { id: '2', songId: 'deleted' },
        { id: '3', songId: b.id },
        { id: '4', songId: a.id },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const { el, press, navigate } = setup(a.id, undefined, setlist, 0);
    expect(el.querySelector('.bar .meta')?.textContent).toContain('Canto 1 di 3');
    expect(el.querySelector('.bar .meta')?.textContent).toContain('Domenica');
    expect(el.querySelector('.item-note')?.textContent).toBe('solo chitarra');
    expect(el.querySelector('app-song-sheet .chord')?.textContent).toBe('D'); // C + 2
    press(' ');
    expect(navigate).toHaveBeenLastCalledWith(['/canto', b.id, 'esibizione'], {
      queryParams: { scaletta: 'sl', pos: 1 },
      replaceUrl: true,
    });
  });

  it('the last entry of a setlist (a repeat of the first song) knows where it is', () => {
    const setlist: Setlist = {
      id: 'sl',
      name: 'Domenica',
      items: [
        { id: '1', songId: a.id, transpose: 2 },
        { id: '2', songId: b.id },
        { id: '3', songId: a.id },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const { el, press, navigate } = setup(a.id, undefined, setlist, 2);
    expect(el.querySelector('.bar .meta')?.textContent).toContain('Canto 3 di 3');
    expect(el.querySelector('app-song-sheet .chord')?.textContent).toBe('C'); // no override on this entry
    press('ArrowLeft');
    expect(navigate).toHaveBeenLastCalledWith(['/canto', b.id, 'esibizione'], {
      queryParams: { scaletta: 'sl', pos: 1 },
      replaceUrl: true,
    });
  });

  it('a swipe to the left goes to the next song at the end of a song', () => {
    const { el, navigate } = setup(b.id, coda);
    const stage = el.querySelector<HTMLElement>('.stage')!;
    const pointer = (type: string, x: number) => Object.assign(new Event(type), { clientX: x, clientY: 100, pointerId: 1, pointerType: 'touch' });
    stage.dispatchEvent(pointer('pointerdown', 400));
    stage.dispatchEvent(pointer('pointerup', 200));
    expect(navigate).toHaveBeenLastCalledWith(['/canto', c.id, 'esibizione'], { queryParams: { coda }, replaceUrl: true });
  });
});
