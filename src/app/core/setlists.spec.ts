import { songFromChordPro } from './song-import';
import {
  duplicateSetlist,
  effectiveTranspose,
  exportSetlist,
  formatSetlistDate,
  importSetlist,
  moveItem,
  newItem,
  newSetlist,
  setlistFileName,
} from './setlists';

const song = (n: string, title: string) => songFromChordPro(`{title: ${title}}\n{meta: numero ${n}}\n[C]x`, '', 'bundled');
const songs = [song('1', 'Io lodo Te'), song('123c', 'La terra canta'), songFromChordPro('{title: Gesù è qui}\n[G]y', '', 'created')];

describe('setlists', () => {
  it('creates, duplicates and reorders', () => {
    const list = newSetlist(' Domenica ', '2026-11-09', 1);
    list.items.push(newItem('a'), newItem('b'), newItem('c'));
    expect(list.name).toBe('Domenica');
    const copy = duplicateSetlist(list, '(copia)', 2);
    expect(copy.name).toBe('Domenica (copia)');
    expect(copy.id).not.toBe(list.id);
    expect(copy.items.map((i) => i.songId)).toEqual(['a', 'b', 'c']);
    expect(copy.items[0].id).not.toBe(list.items[0].id);
    expect(moveItem(list.items, 2, 0).map((i) => i.songId)).toEqual(['c', 'a', 'b']);
    expect(moveItem(list.items, 0, 9).map((i) => i.songId)).toEqual(['b', 'c', 'a']);
  });

  it('item transposition overrides the song’s own', () => {
    expect(effectiveTranspose(newItem('a'), 3)).toBe(3);
    expect(effectiveTranspose(newItem('a', { transpose: -2 }), 3)).toBe(-2);
    expect(effectiveTranspose(newItem('a', { transpose: 0 }), 3)).toBe(0);
  });

  it('shares by number + title and imports on another device', () => {
    const list = newSetlist('Natale', '2026-12-24');
    list.items.push(
      newItem(songs[1].id, { transpose: 2, note: 'solo chitarra' }),
      newItem(songs[2].id),
      newItem('deleted-song'),
    );
    const shared = exportSetlist(list, new Map(songs.map((s) => [s.id, s])));
    expect(shared.items).toEqual([
      { number: '123c', title: 'La terra canta', transpose: 2, note: 'solo chitarra' },
      { number: '', title: 'Gesù è qui', transpose: undefined, note: undefined },
    ]);

    // The other device has the same songs under other ids, and lacks one.
    const other = [song('123c', 'La terra canta'), songFromChordPro('{title: Gesu e qui}', '', 'created')];
    const json = JSON.stringify({ ...shared, items: [...shared.items, { number: '99', title: 'Sconosciuto' }] });
    const { setlist, missing } = importSetlist(json, other);
    expect(setlist.name).toBe('Natale');
    expect(setlist.items.map((i) => [i.songId, i.transpose, i.note])).toEqual([
      [other[0].id, 2, 'solo chitarra'],
      [other[1].id, undefined, undefined],
    ]);
    expect(missing).toEqual(['99 Sconosciuto']);
  });

  it('rejects files that are not setlists', () => {
    expect(() => importSetlist('nope', songs)).toThrow('not-json');
    expect(() => importSetlist('{"format":"x"}', songs)).toThrow('not-a-setlist');
  });

  it('names files and formats dates in Italian', () => {
    expect(setlistFileName(newSetlist('Domenica: mattina', '2026-11-09'))).toBe('scaletta - Domenica mattina - 2026-11-09.json');
    expect(formatSetlistDate('2026-11-09')).toBe('lunedì 9 novembre 2026');
    expect(formatSetlistDate(undefined)).toBe('');
  });
});
