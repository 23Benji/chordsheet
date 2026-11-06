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
  // jsdom has <dialog> but not showModal()/close().
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  const button = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text)!;

  it('adds songs from the "Aggiungi canti" sheet (number + Enter, or a tap)', async () => {
    const { setlist, rows } = setup([]);
    const { el, settle, titles } = await render(setlist);
    // An empty setlist has a single "Aggiungi canti", in its empty state.
    button(el.querySelector('.empty-state')!, 'Aggiungi canti').click();
    await settle();
    const sheet = el.querySelector<HTMLDialogElement>('app-add-songs-sheet dialog')!;
    expect(sheet.open).toBe(true);
    // Empty search: the whole library to browse.
    expect(sheet.querySelectorAll('.result').length).toBe(2);

    const search = sheet.querySelector<HTMLInputElement>('.search input')!;
    search.value = '2';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(titles()).toEqual(['2Celebriam il Signore']);
    expect(search.value).toBe('');

    sheet.querySelector<HTMLButtonElement>('[aria-label="Aggiungi Io lodo Te"]')!.click();
    await settle();
    expect(rows.get(setlist.id)?.items.map((i) => i.songId)).toEqual([two.id, one.id]);
    // Songs already in the setlist get a tick.
    expect(sheet.querySelectorAll('.result.in').length).toBe(2);
  });

  it('song options: transposition shows the resulting key, reorders and plays from a song', async () => {
    const { setlist, navigate } = setup([one.id, two.id]);
    const { el, settle, titles } = await render(setlist);
    const sheet = el.querySelector<HTMLDialogElement>('.item-sheet')!;

    el.querySelectorAll<HTMLButtonElement>('.item .row')[0].click();
    await settle();
    expect(sheet.open).toBe(true);
    sheet.querySelector<HTMLButtonElement>('[aria-label="Alza di un semitono"]')!.click();
    sheet.querySelector<HTMLButtonElement>('[aria-label="Alza di un semitono"]')!.click();
    await settle();
    expect(sheet.querySelector('.value.overridden')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('D +2');
    expect(el.querySelectorAll('.item')[0].querySelector('.key')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('D +2');

    button(sheet, 'Sposta giù').click();
    await settle();
    expect(titles()).toEqual(['2Celebriam il Signore', '1Io lodo Te']);

    button(sheet, 'Suona da qui').click();
    expect(navigate).toHaveBeenCalledWith(['/canto', one.id, 'esibizione'], {
      queryParams: { scaletta: setlist.id, pos: 1 },
      state: { canGoBack: true },
    });
    expect(sheet.open).toBe(false);
  });

  it('a long name is a wrapping text field; line breaks are dropped on rename', async () => {
    const { setlist, rows } = setup([]);
    const { el, settle } = await render(setlist);
    const name = el.querySelector<HTMLTextAreaElement>('textarea.name')!;
    name.value = 'Culto\nserale';
    name.dispatchEvent(new Event('change'));
    await settle();
    expect(rows.get(setlist.id)?.name).toBe('Culto serale');
  });
});
