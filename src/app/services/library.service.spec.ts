import { TestBed } from '@angular/core/testing';
import { Annotation, Folder, Song, SongPrefs, TrashEntry } from '../core/models';
import { DB } from '../data/db';
import { AnnotationService } from './annotation.service';
import { FolderService } from './folder.service';
import { LibraryService } from './library.service';
import { SongPrefsService } from './song-prefs.service';
import { TrashService } from './trash.service';

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
  /** A tiny in-memory database with just what deleting / restoring uses. */
  function memoryDb() {
    const song = (id: string, number: number): Song =>
      ({ id, number, suffix: '', title: id, chordpro: `{title: ${id}}` }) as Song;
    const table = <T>(key: (row: T) => string, initial: T[] = []) => {
      const rows = new Map(initial.map((r) => [key(r), r]));
      return {
        rows,
        toArray: async () => [...rows.values()],
        bulkGet: async (ids: string[]) => ids.map((id) => rows.get(id)),
        bulkPut: async (list: T[]) => void list.forEach((r) => rows.set(key(r), r)),
        bulkDelete: async (ids: string[]) => void ids.forEach((id) => rows.delete(id)),
      };
    };
    const songs = table<Song>((s) => s.id, [song('a', 1), song('b', 2), song('c', 3)]);
    const songPrefs = table<SongPrefs>((p) => p.songId, [{ songId: 'a', transpose: 2, capo: 1 }]);
    const notes = table<Annotation>((n) => n.id, [{ id: 'n1', songId: 'c', text: 'piano' } as Annotation]);
    const folders = table<Folder>((f) => f.id, [{ id: 'f', name: 'Natale', songIds: ['a', 'b'], createdAt: 0, updatedAt: 0 }]);
    const annotations = {
      ...notes,
      where: () => ({
        anyOf: (ids: string[]) => ({
          toArray: async () => [...notes.rows.values()].filter((n) => ids.includes(n.songId)),
          delete: async () => [...notes.rows.values()].filter((n) => ids.includes(n.songId)).forEach((n) => notes.rows.delete(n.id)),
        }),
      }),
    };
    const trash = table<TrashEntry>((e) => e.songId);
    const db = { songs, songPrefs, annotations, folders, trash, transaction: async (_m: string, _t: unknown, work: () => Promise<void>) => work() };
    return { db, songs, songPrefs, notes, folders, trash };
  }

  async function setupMemory() {
    const mem = memoryDb();
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: mem.db }] });
    const library = TestBed.inject(LibraryService);
    await Promise.all([library.load(), TestBed.inject(FolderService).load(), TestBed.inject(SongPrefsService).load(), TestBed.inject(AnnotationService).load()]);
    return { library, ...mem };
  }

  it('deletes several songs, their prefs and notes in one transaction, and leaves folders', async () => {
    const { library, songs, songPrefs, notes, folders } = await setupMemory();
    const deleted = await library.deleteSongs(['a', 'c']);
    expect(library.songs().map((s) => s.id)).toEqual(['b']);
    expect([...songs.rows.keys()]).toEqual(['b']);
    expect(songPrefs.rows.size).toBe(0);
    expect(notes.rows.size).toBe(0);
    expect(folders.rows.get('f')!.songIds).toEqual(['b']);
    // What was removed, for "Annulla".
    expect(deleted.songs.map((s) => s.id)).toEqual(['a', 'c']);
    expect(deleted.prefs).toEqual([{ songId: 'a', transpose: 2, capo: 1 }]);
    expect(deleted.annotations.map((n) => n.id)).toEqual(['n1']);
    expect(deleted.folders.map((f) => f.songIds)).toEqual([['a', 'b']]);
  });

  it('"Annulla" brings the songs back with their prefs, notes and folders', async () => {
    const { library, songs, songPrefs, notes, folders } = await setupMemory();
    await library.restoreSongs(await library.deleteSongs(['a', 'c']));
    expect(library.songs().map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect([...songs.rows.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(TestBed.inject(SongPrefsService).get('a').transpose).toBe(2);
    expect(songPrefs.rows.get('a')?.capo).toBe(1);
    expect(TestBed.inject(AnnotationService).forSong('c').map((n) => n.text)).toEqual(['piano']);
    expect(notes.rows.has('n1')).toBe(true);
    expect(folders.rows.get('f')!.songIds).toEqual(['a', 'b']);
    expect(TestBed.inject(FolderService).byId().get('f')!.songIds).toEqual(['a', 'b']);
  });

  it('deleted songs go to the Cestino with their prefs, notes and folders; "Annulla" takes them out again', async () => {
    const { library, trash } = await setupMemory();
    const deleted = await library.deleteSongs(['a', 'c']);
    const bin = TestBed.inject(TrashService);
    expect(bin.count()).toBe(2);
    expect(trash.rows.get('a')).toMatchObject({ prefs: { transpose: 2 }, folderIds: ['f'], annotations: [] });
    expect(trash.rows.get('c')!.annotations.map((n) => n.id)).toEqual(['n1']);
    await library.restoreSongs(deleted);
    expect(bin.count()).toBe(0);
    expect(trash.rows.size).toBe(0);
  });

  it('"Ripristina" from the Cestino: back with prefs and notes, into folders that still exist, keeping their later changes', async () => {
    const { library, songPrefs, notes, folders, trash } = await setupMemory();
    await library.deleteSongs(['a', 'c']);
    // Meanwhile a song is added to the folder.
    await TestBed.inject(FolderService).addSongs(['f'], ['x']);
    expect(await library.restoreFromTrash(['a'])).toBe(1);
    expect(library.songs().map((s) => s.id)).toEqual(['a', 'b']);
    expect(songPrefs.rows.get('a')?.transpose).toBe(2);
    expect(folders.rows.get('f')!.songIds.sort()).toEqual(['a', 'b', 'x']);
    expect([...trash.rows.keys()]).toEqual(['c']);
    await library.restoreFromTrash(['c']);
    expect(notes.rows.has('n1')).toBe(true);
    expect(TestBed.inject(TrashService).count()).toBe(0);
  });
});
