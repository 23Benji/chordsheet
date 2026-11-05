import { Annotation, Song } from './models';
import { EMPTY_SYNC_DATA, SyncData, sameSyncData, stableStringify, syncMerge } from './sync';

const song = (id: string, number: number | null, title = `Canto ${number}`, updatedAt = 1): Song => ({
  id,
  number,
  suffix: '',
  title,
  chordpro: `{title: ${title}}`,
  tags: [],
  source: 'bundled',
  createdAt: 1,
  updatedAt,
});

const note = (id: string, songId: string, text: string, updatedAt = 1): Annotation => ({
  id,
  songId,
  anchor: { sectionIndex: 0, lineIndex: 0, textHash: 'h', snippet: 's', occurrence: 0 },
  type: 'note',
  text,
  createdAt: 1,
  updatedAt,
});

const data = (patch: Partial<SyncData>): SyncData => ({ ...EMPTY_SYNC_DATA, ...patch });

describe('syncMerge', () => {
  it('first sync: the same songbook on two devices gives no duplicates and shared ids', () => {
    const remote = data({ songs: [song('r1', 1), song('r2', 2)], annotations: [note('n1', 'r1', 'dal telefono')] });
    const local = data({ songs: [song('l1', 1), song('l2', 2), song('l3', 3)], annotations: [note('n2', 'l2', 'dal laptop')] });
    const { data: merged, renamed } = syncMerge(null, local, remote);
    expect(merged.songs.map((s) => s.id).sort()).toEqual(['l3', 'r1', 'r2']);
    expect(renamed).toEqual(new Map([['l1', 'r1'], ['l2', 'r2']]));
    expect(merged.annotations.map((a) => [a.songId, a.text]).sort()).toEqual([
      ['r1', 'dal telefono'],
      ['r2', 'dal laptop'],
    ]);
  });

  it('takes changes made on either side', () => {
    const base = data({ songs: [song('a', 1), song('b', 2)] });
    const local = data({ songs: [song('a', 1, 'Nuovo titolo', 5), song('b', 2)] });
    const remote = data({ songs: [song('a', 1), song('b', 2, 'Altro', 6)] });
    const titles = syncMerge(base, local, remote).data.songs.map((s) => s.title).sort();
    expect(titles).toEqual(['Altro', 'Nuovo titolo']);
  });

  it('a deletion on one device is not undone by the other', () => {
    const base = data({ songs: [song('a', 1)], annotations: [note('n1', 'a', 'x'), note('n2', 'a', 'y')] });
    const local = data({ songs: [song('a', 1)], annotations: [note('n2', 'a', 'y')] }); // n1 deleted here
    const remote = data({ songs: [song('a', 1)], annotations: [note('n1', 'a', 'x'), note('n2', 'a', 'y')] });
    expect(syncMerge(base, local, remote).data.annotations.map((a) => a.id)).toEqual(['n2']);
    // … and the other way round
    expect(syncMerge(base, remote, local).data.annotations.map((a) => a.id)).toEqual(['n2']);
  });

  it('both edited the same record: the newer edit wins; an edit beats a delete', () => {
    const base = data({ songs: [song('a', 1)], annotations: [note('n', 'a', 'v0')] });
    const local = data({ songs: [song('a', 1)], annotations: [note('n', 'a', 'laptop', 10)] });
    const remote = data({ songs: [song('a', 1)], annotations: [note('n', 'a', 'telefono', 20)] });
    expect(syncMerge(base, local, remote).data.annotations[0].text).toBe('telefono');
    const deleted = data({ songs: [song('a', 1)] });
    expect(syncMerge(base, local, deleted).data.annotations[0].text).toBe('laptop');
  });

  it('notes and preferences of a song deleted elsewhere go with it', () => {
    const base = data({ songs: [song('a', 1)], songPrefs: [{ songId: 'a', transpose: 2, capo: 0 }] });
    const remote = data({});
    const merged = syncMerge(base, base, remote).data;
    expect(merged.songs).toEqual([]);
    expect(merged.songPrefs).toEqual([]);
  });

  it('a new song with the same number as a synced one is kept (not merged into it)', () => {
    const base = data({ songs: [song('a', 1)] });
    const local = data({ songs: [song('a', 1)] });
    const remote = data({ songs: [song('a', 1), song('b', 1, 'Altra versione')] });
    expect(syncMerge(base, local, remote).data.songs.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});

describe('sync helpers', () => {
  it('stableStringify ignores key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('sameSyncData ignores record order', () => {
    const a = data({ songs: [song('a', 1), song('b', 2)] });
    const b = data({ songs: [song('b', 2), song('a', 1)] });
    expect(sameSyncData(a, b)).toBe(true);
    expect(sameSyncData(a, data({ songs: [song('a', 1)] }))).toBe(false);
  });
});

/** What SyncService does on one device: merge with the cloud file, keep the result. */
class Device {
  base: SyncData | null = null;
  constructor(public data: SyncData) {}
  sync(cloud: { data: SyncData }): void {
    const { data } = syncMerge(this.base, this.data, cloud.data);
    this.data = data;
    cloud.data = data;
    this.base = data;
  }
}

describe('sync between three devices', () => {
  it('laptop, iPad and iPhone end up with the same songs and notes, deletions included', () => {
    const songbook = (prefix: string) => [song(`${prefix}1`, 1), song(`${prefix}2`, 2)];
    const cloud = { data: EMPTY_SYNC_DATA };
    const laptop = new Device(data({ songs: songbook('L') }));
    const ipad = new Device(data({ songs: songbook('I') }));
    const phone = new Device(data({})); // fresh install: gets everything from the cloud

    laptop.sync(cloud);
    ipad.sync(cloud);
    phone.sync(cloud);
    expect(phone.data.songs.map((s) => s.id).sort()).toEqual(['L1', 'L2']);
    expect(ipad.data.songs.map((s) => s.id).sort()).toEqual(['L1', 'L2']); // no duplicates, shared ids

    // A note on the phone, another on the iPad; the laptop deletes song 2.
    phone.data = { ...phone.data, annotations: [note('p', 'L1', 'dal telefono', 5)] };
    ipad.data = { ...ipad.data, annotations: [note('i', 'L1', 'dall’iPad', 6)] };
    laptop.data = { ...laptop.data, songs: laptop.data.songs.filter((s) => s.id !== 'L2') };
    phone.sync(cloud);
    laptop.sync(cloud);
    ipad.sync(cloud);
    phone.sync(cloud);
    laptop.sync(cloud);

    for (const device of [laptop, ipad, phone]) {
      expect(device.data.songs.map((s) => s.id)).toEqual(['L1']);
      expect(device.data.annotations.map((a) => a.id).sort()).toEqual(['i', 'p']);
      expect(sameSyncData(device.data, cloud.data)).toBe(true);
    }
  });
});
