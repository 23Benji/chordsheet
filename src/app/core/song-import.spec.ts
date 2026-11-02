import { songFromChordPro, withChordPro } from './song-import';

describe('songFromChordPro', () => {
  it('reads number, title and detected key', () => {
    const file = '123c - Canto di prova.cho';
    const song = songFromChordPro('{title: Canto di prova}\n{meta: numero 123c}\n\n[F#m]la la [D]la', file, 'bundled', 1);
    expect(song).toMatchObject({
      number: 123,
      suffix: 'c',
      title: 'Canto di prova',
      key: 'F#m',
      source: 'bundled',
      createdAt: 1,
    });
    expect(song.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('prefers {key} and reads {tempo}', () => {
    const song = songFromChordPro('{title: X}\n{key: D}\n{tempo: 108}\n[G]la', 'x.cho', 'imported');
    expect(song.key).toBe('D');
    expect(song.tempo).toBe(108);
    expect(song.number).toBeNull();
  });

  it('falls back to the file name for number and title', () => {
    const song = songFromChordPro('[C]la la', '200b - O holy night.cho', 'imported');
    expect(song).toMatchObject({ number: 200, suffix: 'b', title: 'O holy night', tags: ['natale'] });
  });
});

describe('withChordPro', () => {
  it('refreshes number, title and key, keeping id, source and createdAt', () => {
    const song = songFromChordPro('{title: A}\n{meta: numero 4}\n[C]x', '004 - A.cho', 'bundled', 1);
    const edited = withChordPro(song, '{title: B}\n{meta: numero 4b}\n[G]y', 2);
    expect(edited).toMatchObject({ id: song.id, source: 'bundled', createdAt: 1, updatedAt: 2 });
    expect(edited).toMatchObject({ title: 'B', number: 4, suffix: 'b', key: 'G' });
  });

  it('a song without {meta: numero} has no number', () => {
    const song = songFromChordPro('{title: A}\n{meta: numero 4}', '004 - A.cho', 'bundled', 1);
    expect(withChordPro(song, '{title: A}').number).toBeNull();
  });
});
