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
    expect(await library.importEntries([entry('1', 'Io lodo Te'), entry('2', 'Celebriam')], 'skip')).toEqual({
      added: 2,
      replaced: 0,
      skipped: 0,
    });
    expect(library.countConflicts([entry('1', 'Io lodo Te'), entry('3', 'Nuovo')])).toBe(1);

    expect(await library.importEntries([entry('1', 'Io lodo Te', '[D]y')], 'skip')).toMatchObject({ skipped: 1 });

    const id = library.songs().find((s) => s.number === 1)!.id;
    expect(await library.importEntries([entry('1', 'Io lodo Te', '[D]y')], 'replace')).toMatchObject({ replaced: 1 });
    const one = library.songs().find((s) => s.number === 1 && s.suffix === '')!;
    expect(one.id).toBe(id); // same song, new text
    expect(one.chordpro).toContain('[D]y');

    expect(await library.importEntries([entry('1', 'Io lodo Te (altra)')], 'keepBoth')).toMatchObject({ added: 1 });
    expect(library.songs().filter((s) => s.number === 1).map((s) => s.suffix)).toEqual(['', 'b']);
  });
});
