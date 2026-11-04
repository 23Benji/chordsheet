import { TestBed } from '@angular/core/testing';
import { Folder } from '../core/models';
import { DB } from '../data/db';
import { FolderService } from './folder.service';

function setup() {
  const rows = new Map<string, Folder>();
  const db = {
    folders: {
      toArray: async () => [...rows.values()],
      bulkPut: async (list: Folder[]) => list.forEach((f) => rows.set(f.id, f)),
      delete: async (id: string) => void rows.delete(id),
    },
  };
  TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
  return { folders: TestBed.inject(FolderService), rows };
}

describe('FolderService', () => {
  it('creates folders (alphabetical), adds, moves and removes songs, and saves them', async () => {
    const { folders, rows } = setup();
    const natale = await folders.create('Natale', ['a', 'b']);
    const lode = await folders.create('Lode');
    expect(folders.folders().map((f) => f.name)).toEqual(['Lode', 'Natale']);

    await folders.moveSongs(natale.id, lode.id, ['a']);
    expect(folders.byId().get(natale.id)!.songIds).toEqual(['b']);
    expect(folders.byId().get(lode.id)!.songIds).toEqual(['a']);

    await folders.addSongs([natale.id, lode.id], ['c']);
    await folders.removeSongs([lode.id], ['a']);
    expect(rows.get(lode.id)!.songIds).toEqual(['c']);
    expect(rows.get(natale.id)!.songIds).toEqual(['b', 'c']);
  });

  it('a deleted song leaves every folder; deleting a folder keeps the songs and resets the view', async () => {
    const { folders, rows } = setup();
    const one = await folders.create('Uno', ['x', 'y']);
    const two = await folders.create('Due', ['x']);
    await folders.forgetSong('x');
    expect(rows.get(one.id)!.songIds).toEqual(['y']);
    expect(rows.get(two.id)!.songIds).toEqual([]);

    folders.current.set(one.id);
    await folders.remove(one.id);
    expect(folders.current()).toBeNull();
    expect(rows.has(one.id)).toBe(false);
  });
});
