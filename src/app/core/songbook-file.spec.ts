import { createBackup } from './backup';
import { songFromChordPro } from './song-import';
import { classifyFiles, createSongbookFile, nextFreeSuffix, SONGBOOK_FORMAT, songbookFileName } from './songbook-file';

describe('songbook file', () => {
  it('contains only the songs’ text, with file names', () => {
    const song = songFromChordPro('{title: Io lodo Te}\n{meta: numero 1}\n[C]x', '', 'bundled');
    expect(createSongbookFile([song])).toEqual({
      format: SONGBOOK_FORMAT,
      version: 1,
      songs: [{ file: '001 - Io lodo Te.cho', chordpro: song.chordpro }],
    });
  });

  it('names the file after the day, and the folder when sharing one', () => {
    const day = new Date('2026-11-04T10:00:00Z');
    expect(songbookFileName(day)).toBe('chordsheet-canti-2026-11-04.json');
    expect(songbookFileName(day, 'Natale & Avvento è')).toBe('chordsheet-canti-natale-avvento-e-2026-11-04.json');
  });

  it('sorts chosen files into songs, backups and rejects', () => {
    const songbook = JSON.stringify(createSongbookFile([songFromChordPro('{title: A}\n[C]x', 'a.cho', 'created')]));
    const backup = JSON.stringify(createBackup({ songs: [], songPrefs: [], annotations: [], setlists: [], folders: [], settings: null }));
    const result = classifyFiles([
      { name: '001 - Io lodo Te.cho', text: '{title: Io lodo Te}' },
      { name: 'canto.chopro', text: '[G]la' },
      { name: 'innario.json', text: songbook },
      { name: 'backup.json', text: backup },
      { name: 'foto.jpg', text: '' },
      { name: 'vuoto.cho', text: '  ' },
      { name: 'altro.json', text: '{"x":1}' },
    ]);
    expect(result.songs.map((s) => s.file)).toEqual(['001 - Io lodo Te.cho', 'canto.chopro', 'A.cho']);
    expect(result.backups.length).toBe(1);
    expect(result.rejected).toEqual(['foto.jpg', 'vuoto.cho', 'altro.json']);
  });

  it('finds the next free version letter', () => {
    expect(nextFreeSuffix(new Set(['']))).toBe('b');
    expect(nextFreeSuffix(new Set(['', 'b', 'c']))).toBe('d');
  });
});
