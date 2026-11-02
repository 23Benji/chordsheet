import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Setlist } from '../../core/models';
import { buildSearchEntry } from '../../core/search';
import { newItem, newSetlist } from '../../core/setlists';
import { songFromChordPro } from '../../core/song-import';
import { DB } from '../../data/db';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { SetlistPage } from './setlist-page';

const one = songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n{key: C}\n[C]x', '', 'bundled');
const two = songFromChordPro('{title: Celebriam il Signore}\n{meta: numero 2}\n{key: G}\n[G]y', '', 'bundled');
const songs = [one, two];

function setup(items: string[]) {
  const rows = new Map<string, Setlist>();
  const setlist = newSetlist('Domenica', '2026-11-08');
  setlist.items = items.map((id) => newItem(id));
  rows.set(setlist.id, setlist);
  TestBed.configureTestingModule({
    imports: [SetlistPage],
    providers: [
      provideRouter([]),
      {
        provide: DB,
        useValue: {
          setlists: { toArray: async () => [...rows.values()], put: async (s: Setlist) => void rows.set(s.id, s) },
          songPrefs: { toArray: async () => [] },
        },
      },
      {
        provide: LibraryService,
        useValue: {
          songs: signal(songs),
          byId: signal(new Map(songs.map((s) => [s.id, s]))),
          searchEntries: signal(songs.map(buildSearchEntry)),
        },
      },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return { setlist, rows, navigate };
}

async function render(setlist: Setlist) {
  await TestBed.inject(SetlistService).load();
  const fixture = TestBed.createComponent(SetlistPage);
  fixture.componentRef.setInput('id', setlist.id);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const titles = () => Array.from(el.querySelectorAll('.item .title')).map((t) => t.textContent?.trim());
  return { fixture, el, settle, titles };
}

describe('SetlistPage', () => {
  it('adds songs from the search box (number + Enter)', async () => {
    const { setlist, rows } = setup([]);
    const { el, settle, titles } = await render(setlist);
    const search = el.querySelector<HTMLInputElement>('.search input')!;
    search.value = '2';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(titles()).toEqual(['2Celebriam il Signore']);
    expect(rows.get(setlist.id)?.items.map((i) => i.songId)).toEqual([two.id]);
  });

  it('per-song transposition shows the resulting key, reorders and plays from a song', async () => {
    const { setlist, navigate } = setup([one.id, two.id]);
    const { el, settle, titles } = await render(setlist);
    const item = () => el.querySelectorAll<HTMLElement>('.item')[0];

    item().querySelector<HTMLButtonElement>('[aria-label="Alza di un semitono"]')!.click();
    item().querySelector<HTMLButtonElement>('[aria-label="Alza di un semitono"]')!.click();
    await settle();
    expect(item().querySelector('.key')?.textContent).toBe('D');
    expect(item().querySelector('.value.overridden')?.textContent).toBe('+2');

    item().querySelector<HTMLButtonElement>('[aria-label="Sposta giù"]')!.click();
    await settle();
    expect(titles()).toEqual(['2Celebriam il Signore', '1Io lodo Te']);

    el.querySelectorAll<HTMLElement>('.item')[1].querySelector<HTMLButtonElement>('[aria-label="Suona da qui"]')!.click();
    expect(navigate).toHaveBeenCalledWith(['/canto', one.id, 'esibizione'], {
      queryParams: { scaletta: setlist.id, pos: 1 },
    });
  });
});
