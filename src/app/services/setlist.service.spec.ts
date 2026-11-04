import { TestBed } from '@angular/core/testing';
import { Setlist } from '../core/models';
import { DB } from '../data/db';
import { SetlistService } from './setlist.service';

describe('SetlistService', () => {
  it('creates, adds songs, duplicates and deletes (persisted)', async () => {
    const rows = new Map<string, Setlist>();
    const db = {
      setlists: {
        toArray: async () => [...rows.values()],
        put: async (s: Setlist) => void rows.set(s.id, s),
        delete: async (id: string) => void rows.delete(id),
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
    const service = TestBed.inject(SetlistService);

    const list = await service.create('Domenica', '2026-11-08');
    const withSong = await service.addSong(list, 'song-1');
    expect(rows.get(list.id)?.items.map((i) => i.songId)).toEqual(['song-1']);
    // Several at once (library selection): appended in the given order.
    const more = await service.addSongs(withSong, ['song-3', 'song-2']);
    expect(rows.get(list.id)?.items.map((i) => i.songId)).toEqual(['song-1', 'song-3', 'song-2']);
    expect(new Set(more.items.map((i) => i.id)).size).toBe(3);

    const copy = await service.duplicate(withSong);
    expect(service.setlists().map((s) => s.name).sort()).toEqual(['Domenica', 'Domenica (copia)']);

    await service.remove(list.id);
    expect(service.setlists().map((s) => s.id)).toEqual([copy.id]);
    expect(rows.size).toBe(1);
  });
});
