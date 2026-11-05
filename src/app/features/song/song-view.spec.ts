import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Song } from '../../core/models';
import { songFromChordPro } from '../../core/song-import';
import { groupVersions } from '../../core/versions';
import { DB } from '../../data/db';
import { LibraryService } from '../../services/library.service';
import { SongView } from './song-view';

/** In-memory stand-in for the Dexie tables the song view touches. */
const fakeDb = {
  songPrefs: { toArray: async () => [], put: async () => undefined },
  settings: { get: async () => undefined, put: async () => undefined },
  annotations: { toArray: async () => [], put: async () => undefined, delete: async () => undefined },
};

/** jsdom has no matchMedia: pretend to be a wide (laptop) or narrow screen. */
function mockScreen(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width') ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

/** An invented song (the real songbook isn't part of the repository). */
const SONG_TEXT = `{title: Canto di prova}
{meta: numero 1}

[C]PRIMA RIGA DEL CAN[F]TO
SECONDA [C]RIGA CHE [Am]SEGUE
TERZA [C]RIGA E POI AN[F]CORA [G]

{start_of_chorus}
[G]RITORNELLO DI [F]PROVA [G]QUI [C] [Am]
FINE DEL RITOR[F]NELLO [G]ORA [C] [C7]
{end_of_chorus}`;
const version = (suffix: string) =>
  songFromChordPro(`{title: Versioni}\n{meta: numero 123${suffix}}\n\n[C]la`, '', 'bundled');

function setup(song: Song, library: Song[] = [song], wide = false) {
  mockScreen(wide);
  const groups = groupVersions(library);
  TestBed.configureTestingModule({
    imports: [SongView],
    providers: [
      provideRouter([]),
      { provide: DB, useValue: fakeDb },
      {
        provide: LibraryService,
        useValue: {
          byId: signal(new Map(library.map((s) => [s.id, s]))),
          versionsOf: (s: Song) => (s.number === null ? [s] : (groups.get(s.number) ?? [s])),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SongView);
  fixture.componentRef.setInput('id', song.id);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  /**
   * Clicks a control by its label. Controls inside a popover (key, text …)
   * live in the CDK overlay attached to <body>, so the whole document is
   * searched, and the popover is opened first when needed.
   */
  const PANELS: Record<string, string> = {
    'Alza di un semitono': 'Tonalità e capo',
    'Abbassa di un semitono': 'Tonalità e capo',
    'Tonalità originale': 'Tonalità e capo',
    'Capo su': 'Tonalità e capo',
    'Capo giù': 'Tonalità e capo',
    'Una colonna (scorri)': 'Testo',
    'Due colonne (pagine)': 'Testo',
  };
  const click = (label: string) => {
    const find = () => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!find() && PANELS[label]) {
      el.querySelector<HTMLButtonElement>(`button[aria-label="${PANELS[label]}"]`)!.click();
      fixture.detectChanges();
    }
    find()!.click();
    fixture.detectChanges();
  };
  const chords = () =>
    Array.from(el.querySelectorAll('.chord'))
      .map((c) => c.textContent)
      .filter(Boolean);
  return { el, click, chords, fixture };
}

describe('SongView', () => {
  const song = songFromChordPro(SONG_TEXT, '', 'bundled');

  it('shows song 1 in C, and in D after transposing up twice', () => {
    const { el, click, chords } = setup(song);
    expect(el.querySelector('h1')?.textContent).toBe('Canto di prova');
    expect(el.querySelector('.key-line')?.textContent).toContain('Tonalità C');
    expect(chords().slice(0, 3)).toEqual(['C', 'F', 'C']);

    click('Alza di un semitono');
    click('Alza di un semitono');

    expect(el.querySelector('.key-line')?.textContent).toContain('Tonalità D');
    expect(el.querySelector('.key-line')?.textContent).toContain('originale C');
    expect(chords().slice(0, 4)).toEqual(['D', 'G', 'D', 'Bm']);
  });

  it('capo shows shapes and the sounding key', () => {
    const { el, click, chords } = setup(song);
    click('Capo su');
    click('Capo su');
    expect(el.querySelector('.key-line')?.textContent).toContain('Capo 2');
    expect(el.querySelector('.key-line')?.textContent).toContain('suona in C');
    expect(chords()[0]).toBe('Bb'); // shapes in Bb (a flat key)
  });

  it('Capo consigliato: "Usa" sets it; going back to no capo does not bring the tip back', () => {
    const bb = songFromChordPro('{title: In Bb}\n{meta: numero 9}\n[Bb]uno [Eb]due [F]tre [Gm]quattro [Bb]cinque', '', 'bundled');
    const { el, click, chords, fixture } = setup(bb);
    el.querySelector<HTMLButtonElement>('button[aria-label="Tonalità e capo"]')!.click();
    fixture.detectChanges();
    const tip = () => document.querySelector('app-capo-tip');
    expect(tip()?.textContent).toContain('Capo 3 · forme in G');

    Array.from(document.querySelectorAll<HTMLButtonElement>('app-capo-tip button')).find((b) => b.textContent?.trim() === 'Usa')!.click();
    fixture.detectChanges();
    expect(chords()[0]).toBe('G');
    expect(tip()).toBeNull();

    for (let i = 0; i < 3; i++) click('Capo giù');
    expect(chords()[0]).toBe('Bb');
    expect(tip()).toBeNull(); // snoozed for this song
  });

  it('shows a version switcher only for songs with several versions', () => {
    const versions = ['', 'b', 'c', 'd'].map(version);
    const { el, fixture } = setup(versions[2], [song, ...versions]);
    el.querySelector<HTMLButtonElement>('button[aria-label="Versione"]')!.click();
    fixture.detectChanges();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.popover-panel .menu-item'));
    expect(links.map((a) => a.querySelector('.pill')?.textContent?.trim())).toEqual(['123', '123b', '123c', '123d']);
    expect(links[2].getAttribute('aria-checked')).toBe('true');
    TestBed.resetTestingModule();

    expect(setup(song, [song, ...versions]).el.querySelector('button[aria-label="Versione"]')).toBeNull();
  });

  it('uses two-column pages on wide screens, with a toggle back to scrolling', () => {
    const { el, click } = setup(song, [song], true);
    expect(el.querySelector('.pager')).not.toBeNull();
    expect(el.querySelector('.page-label')?.textContent).toContain('Pagina 1 / 1');

    click('Una colonna (scorri)');
    expect(el.querySelector('.pager')).toBeNull();
    expect(el.querySelector('.scroll .sheet')).not.toBeNull();
  });

  it('scrolls (no pages, no toggle) on narrow screens', () => {
    const { el, fixture } = setup(song, [song], false);
    expect(el.querySelector('.pager')).toBeNull();
    el.querySelector<HTMLButtonElement>('button[aria-label="Testo"]')!.click();
    fixture.detectChanges();
    expect(document.querySelector('[aria-label="Due colonne (pagine)"]')).toBeNull();
  });

  it('select a line → add a note, a highlight and a personal chord (transposed)', async () => {
    const { el, click, fixture } = setup(song);
    click('Alza di un semitono'); // C → C#/Db: personal chords follow the display
    const row = () => el.querySelectorAll<HTMLElement>('app-song-sheet .row')[0];
    row().click();
    fixture.detectChanges();
    const panel = () => el.querySelector('app-annotation-panel')!;
    expect(panel().textContent).toContain('Riga: «PRIMA RIGA DEL CANTO»');

    const button = (text: string) =>
      Array.from(panel().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text))!;

    button('Nota').click();
    fixture.detectChanges();
    panel().querySelector<HTMLTextAreaElement>('textarea')!.value = 'attacco piano';
    button('Salva').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row().querySelector('.note')?.textContent).toBe('attacco piano');

    panel().querySelector<HTMLButtonElement>('[aria-label="Azzurro"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row().classList).toContain('hl-sky');

    button('Accordo personale').click();
    fixture.detectChanges();
    panel().querySelector<HTMLInputElement>('.chord-input')!.value = 'Dbmaj7';
    button('Salva').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(row().querySelector('.chord.personal')?.textContent).toBe('Dbmaj7');

    // Hiding notes hides the whole personal layer.
    el.querySelector<HTMLButtonElement>('button[aria-label="Le mie note"]')!.click();
    fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Mostra le mie note"]')!.click();
    fixture.detectChanges();
    expect(row().querySelector('.note, .chord.personal')).toBeNull();
    expect(el.querySelector('app-annotation-panel')).toBeNull();
  });

  it('Intro card: part, chords (typed in the displayed key), rhythm', async () => {
    const { el, click, fixture } = setup(song);
    click('Alza di un semitono');
    click('Alza di un semitono'); // C → D
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Intro')!.click();
    fixture.detectChanges();
    const panel = el.querySelector('app-intro-panel')!;
    // Quick pick from the song's sections.
    Array.from(panel.querySelectorAll<HTMLButtonElement>('.chip')).find((b) => b.textContent?.trim() === 'Ritornello')!.click();
    const inputs = panel.querySelectorAll<HTMLInputElement>('input');
    inputs[1].value = 'D G A';
    panel.querySelector<HTMLButtonElement>('[aria-label="Giù"]')!.click();
    panel.querySelector<HTMLButtonElement>('[aria-label="Su"]')!.click();
    Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Salva')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const card = el.querySelector('app-song-sheet .my-intro')!;
    expect(card.querySelector('.tag')?.textContent).toBe('Intro');
    expect(card.textContent).toContain('Ritornello');
    expect(Array.from(card.querySelectorAll('.chord')).map((c) => c.textContent)).toEqual(['D', 'G', 'A']);
    expect(card.querySelector('.rhythm')?.textContent).toBe('↓↑');

    // Back to the original key: the intro chords follow.
    click('Tonalità originale');
    expect(Array.from(el.querySelectorAll('app-song-sheet .my-intro .chord')).map((c) => c.textContent)).toEqual(['C', 'F', 'G']);
  });
});
