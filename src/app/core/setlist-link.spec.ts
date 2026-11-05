import { decodeSetlistLink, encodeSetlistLink, linkFragment, setlistLinkUrl } from './setlist-link';
import { SETLIST_FORMAT, SharedSetlist, importSharedSetlist } from './setlists';
import { songFromChordPro } from './song-import';

const shared: SharedSetlist = {
  format: SETLIST_FORMAT,
  version: 1,
  name: 'Culto · domenica',
  date: '2026-11-08',
  items: [
    { number: '1', title: 'Io lodo Te' },
    { number: '4b', title: 'Siam riuniti tutti qui', transpose: 2, note: 'Inizio solo chitarra' },
    { number: '', title: 'Un canto senza numero', transpose: 0 },
    { number: '117', title: 'Mille ragioni', note: 'Finale lento ×2' },
  ],
};

describe('setlist link', () => {
  it('round-trips: name, date, numbers, transpositions (also an explicit 0) and notes', async () => {
    const encoded = await encodeSetlistLink(shared);
    const back = await decodeSetlistLink(`#${encoded}`);
    expect(back.name).toBe('Culto · domenica');
    expect(back.date).toBe('2026-11-08');
    expect(back.items).toEqual([
      { number: '1', title: '' },
      { number: '4b', title: '', transpose: 2, note: 'Inizio solo chitarra' },
      { number: '', title: 'Un canto senza numero', transpose: 0 },
      { number: '117', title: '', note: 'Finale lento ×2' },
    ]);
  });

  it('uses only URL-safe characters and stays short enough for a QR code', async () => {
    const long: SharedSetlist = {
      ...shared,
      items: Array.from({ length: 20 }, (_, i) => ({ number: String(100 + i), title: 'x', transpose: i % 3 ? 1 : undefined })),
    };
    const encoded = await encodeSetlistLink(long);
    expect(encoded).toMatch(/^[01]\.[A-Za-z0-9_-]+$/);
    expect(setlistLinkUrl('https://23benji.github.io/chordsheet/', encoded).length).toBeLessThan(600);
  });

  it('builds the address under the app base', () => {
    expect(setlistLinkUrl('https://23benji.github.io/chordsheet/', '1.abc')).toBe(
      'https://23benji.github.io/chordsheet/scaletta-condivisa#1.abc',
    );
  });

  it('rejects anything else', async () => {
    await expect(decodeSetlistLink('')).rejects.toThrow('not-a-setlist');
    await expect(decodeSetlistLink('#hello')).rejects.toThrow('not-a-setlist');
    await expect(decodeSetlistLink('#1.!!!')).rejects.toThrow('not-a-setlist');
    await expect(decodeSetlistLink(`#0.${btoa('{"a":1}')}`)).rejects.toThrow('not-a-setlist');
  });

  it('opens into this library by number (with the title for songs without one)', async () => {
    const songs = [
      songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n[C]x', '', 'bundled'),
      songFromChordPro('{title: Siam riuniti tutti qui}\n{meta: numero 4b}\n[E]x', '', 'bundled'),
      songFromChordPro('{title: Un canto senza numero}\n[G]x', '', 'created'),
    ];
    const { setlist, missing } = importSharedSetlist(await decodeSetlistLink(await encodeSetlistLink(shared)), songs);
    expect(setlist.name).toBe('Culto · domenica');
    expect(setlist.items.map((i) => [i.songId, i.transpose, i.note])).toEqual([
      [songs[0].id, undefined, undefined],
      [songs[1].id, 2, 'Inizio solo chitarra'],
      [songs[2].id, 0, undefined],
    ]);
    expect(missing).toEqual(['117 ']);
  });

  it('finds the link inside a pasted message', () => {
    const text = 'Ecco la scaletta 👉 https://23benji.github.io/chordsheet/scaletta-condivisa#1.AbC-d_9 a domenica!';
    expect(linkFragment(text)).toBe('1.AbC-d_9');
    expect(linkFragment('https://23benji.github.io/chordsheet/')).toBeNull();
    expect(linkFragment('')).toBeNull();
  });
});
