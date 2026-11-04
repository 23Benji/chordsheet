import { TestBed } from '@angular/core/testing';
import { Song } from '../core/models';
import { DB } from '../data/db';
import { LibraryService } from './library.service';

function setup(initial: Song[] = []) {
  const rows = new Map(initial.map((s) => [s.id, s]));
  const db = {
    songs: {
      toArray: async () => [...rows.values()],
      bulkPut: async (list: Song[]) => list.forEach((s) => rows.set(s.id, s)),
    },
    annotations: { toArray: async () => [], bulkPut: async () => undefined },
  };
  TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
  return { library: TestBed.inject(LibraryService), rows };
}

const entry = (n: string, title: string, chords = '[C]x') => ({
  file: `${n} - ${title}.cho`,
  chordpro: `{title: ${title}}\n{meta: numero ${n}}\n${chords}`,
});

describe('LibraryService.importEntries', () => {
  it('adds new songs and handles existing numbers by policy', async () => {
    const { library } = setup();
    await library.load();
    const first = await library.importEntries([entry('1', 'Io lodo Te'), entry('2', 'Celebriam')], 'skip');
    expect(first).toMatchObject({ added: 2, replaced: 0, skipped: 0 });
    // Ids of the imported songs, so the caller can file them in a folder.
    expect(first.songIds.sort()).toEqual(library.songs().map((s) => s.id).sort());
    expect(library.countConflicts([entry('1', 'Io lodo Te'), entry('3', 'Nuovo')])).toBe(1);

    const skipped = await library.importEntries([entry('1', 'Io lodo Te', '[D]y')], 'skip');
    expect(skipped).toMatchObject({ skipped: 1 });
    // A skipped song is still reported: it can be filed in the chosen folder.
    expect(skipped.songIds).toEqual([library.songs().find((s) => s.number === 1)!.id]);

    const id = library.songs().find((s) => s.number === 1)!.id;
    expect(await library.importEntries([entry('1', 'Io lodo Te', '[D]y')], 'replace')).toMatchObject({ replaced: 1 });
    const one = library.songs().find((s) => s.number === 1 && s.suffix === '')!;
    expect(one.id).toBe(id); // same song, new text
    expect(one.chordpro).toContain('[D]y');

    expect(await library.importEntries([entry('1', 'Io lodo Te (altra)')], 'keepBoth')).toMatchObject({ added: 1 });
    expect(library.songs().filter((s) => s.number === 1).map((s) => s.suffix)).toEqual(['', 'b']);
  });
});

describe('LibraryService.deleteSongs', () => {
  it('deletes several songs, their prefs and notes in one transaction, and leaves folders', async () => {
    const song = (id: string, number: number): Song =>
      ({ id, number, suffix: '', title: id, chordpro: `{title: ${id}}` }) as Song;
    const rows = new Map([song('a', 1), song('b', 2), song('c', 3)].map((s) => [s.id, s]));
    const deleted: Record<string, string[]> = { songs: [], prefs: [], notes: [] };
    const db = {
      songs: {
        toArray: async () => [...rows.values()],
        bulkDelete: async (ids: string[]) => ids.forEach((id) => rows.delete(id) && deleted['songs'].push(id)),
      },
      songPrefs: { bulkDelete: async (ids: string[]) => void deleted['prefs'].push(...ids) },
      annotations: {
        toArray: async () => [],
        where: () => ({ anyOf: (ids: string[]) => ({ delete: async () => void deleted['notes'].push(...ids) }) }),
      },
      folders: { toArray: async () => [], bulkPut: async () => undefined },
      transaction: async (_mode: string, _tables: unknown, work: () => Promise<void>) => work(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
    const library = TestBed.inject(LibraryService);
    await library.load();

    await library.deleteSongs(['a', 'c']);
    expect(library.songs().map((s) => s.id)).toEqual(['b']);
    expect(deleted).toEqual({ songs: ['a', 'c'], prefs: ['a', 'c'], notes: ['a', 'c'] });
  });
});
