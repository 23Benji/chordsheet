import { anchorFor } from './anchoring';
import { createBackup, mergeBackup, parseBackup } from './backup';
import { parseChordPro } from './chordpro';
import { newFolder } from './folders';
import { Annotation, Setlist } from './models';
import { songFromChordPro } from './song-import';

const sheet = parseChordPro('[C]uno');
const note = (id: string, songId: string, updatedAt: number): Annotation => ({
  id, songId, type: 'note', text: id, anchor: anchorFor(sheet, 0), createdAt: 0, updatedAt,
});

describe('backup', () => {
  it('round-trips through JSON', () => {
    const data = {
      songs: [songFromChordPro('{title: A}\n{meta: numero 1}', '', 'bundled')],
      songPrefs: [],
      annotations: [],
      setlists: [],
      folders: [newFolder('Natale', ['x'])],
      settings: null,
    };
    expect(parseBackup(JSON.stringify(createBackup(data)))).toEqual(data);
    expect(() => parseBackup('{"format":"x"}')).toThrow('not-a-backup');
    expect(() => parseBackup('nope')).toThrow('not-json');
    // Backups made before folders existed still open.
    const old = JSON.stringify({ format: 'innario-backup', version: 1, data: { songs: [] } });
    expect(parseBackup(old).folders).toEqual([]);
  });

  it('merges another device’s data: same songs by number, ids re-pointed, newer wins', () => {
    const laptopSong = { ...songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n[C]x', '', 'bundled'), updatedAt: 10 };
    const ipadSong = { ...songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n[D]x', '', 'bundled'), updatedAt: 20 };
    const ipadOnly = songFromChordPro('{title: Nuovo}', '', 'created');
    const setlist: Setlist = {
      id: 'sl', name: 'Domenica', createdAt: 0, updatedAt: 5,
      items: [{ id: 'i1', songId: ipadSong.id }, { id: 'i2', songId: ipadOnly.id }],
    };
    const merged = mergeBackup(
      { songs: [laptopSong], songPrefs: [{ songId: laptopSong.id, transpose: 0, capo: 0, memo: 'mio' }], annotations: [note('n1', laptopSong.id, 1)], setlists: [], folders: [], settings: null },
      {
        songs: [ipadSong, ipadOnly],
        songPrefs: [{ songId: ipadSong.id, transpose: 2, capo: 0 }],
        annotations: [note('n2', ipadSong.id, 1), note('n1', laptopSong.id, 3)],
        setlists: [setlist],
        folders: [{ ...newFolder('Lode', [ipadSong.id, ipadOnly.id]), id: 'f1' }],
        settings: null,
      },
    );
    // One "Io lodo Te" (local id), with the newer text from the iPad.
    const one = merged.songs.filter((s) => s.number === 1);
    expect(one.length).toBe(1);
    expect(one[0].id).toBe(laptopSong.id);
    expect(one[0].chordpro).toContain('[D]');
    expect(merged.songs.length).toBe(2);
    // Prefs merged onto the local id (memo kept, transpose from the backup).
    expect(merged.songPrefs).toEqual([{ songId: laptopSong.id, transpose: 2, capo: 0, memo: 'mio' }]);
    // Notes re-pointed; the same note id takes the newer copy.
    expect(merged.annotations.map((a) => [a.id, a.songId, a.updatedAt])).toEqual([
      ['n1', laptopSong.id, 3],
      ['n2', laptopSong.id, 1],
    ]);
    expect(merged.setlists[0].items.map((i) => i.songId)).toEqual([laptopSong.id, ipadOnly.id]);
    // Folder contents point to this device's songs too.
    expect(merged.folders.map((f) => [f.id, f.songIds])).toEqual([['f1', [laptopSong.id, ipadOnly.id]]]);
  });
});
