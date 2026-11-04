import {
  cleanFolderName,
  entryKey,
  folderEntries,
  folderNameTaken,
  newFolder,
  sortFolders,
  withSongs,
  withoutSongs,
} from './folders';

const song = (id: string, number: number | null, suffix = '') => ({ id, number, suffix });

describe('folders', () => {
  it('creates folders with a clean name and no duplicate songs', () => {
    const folder = newFolder('  Natale   e Avvento ', ['a', 'b', 'a'], 5);
    expect(folder.name).toBe('Natale e Avvento');
    expect(folder.songIds).toEqual(['a', 'b']);
    expect(folder.createdAt).toBe(5);
    expect(cleanFolderName(' x ')).toBe('x');
  });

  it('detects names already used, ignoring case and accents', () => {
    const folders = [newFolder('Lodi'), newFolder('Perdono')];
    expect(folderNameTaken(folders, 'lodi')).toBe(true);
    expect(folderNameTaken(folders, 'perdonò ')).toBe(true);
    expect(folderNameTaken(folders, 'Lodi', folders[0].id)).toBe(false); // renaming to itself
    expect(folderNameTaken(folders, 'Pasqua')).toBe(false);
  });

  it('sorts alphabetically, numbers in natural order', () => {
    const names = sortFolders([newFolder('pasqua'), newFolder('Avvento'), newFolder('Lista 10'), newFolder('Lista 2')]).map(
      (f) => f.name,
    );
    expect(names).toEqual(['Avvento', 'Lista 2', 'Lista 10', 'pasqua']);
  });

  it('adds and removes songs, keeping the same object when nothing changes', () => {
    const folder = newFolder('A', ['x'], 1);
    const added = withSongs(folder, ['x', 'y'], 2);
    expect(added.songIds).toEqual(['x', 'y']);
    expect(added.updatedAt).toBe(2);
    expect(withSongs(added, ['y'], 3)).toBe(added);
    const removed = withoutSongs(added, ['x', 'z'], 4);
    expect(removed.songIds).toEqual(['y']);
    expect(withoutSongs(removed, ['z'], 5)).toBe(removed);
  });

  it('counts library entries: versions share one entry, missing songs are ignored', () => {
    const songs = [song('a', 12), song('b', 12, 'b'), song('c', null), song('d', 13)];
    const byId = new Map(songs.map((s) => [s.id, s]));
    const entries = folderEntries(newFolder('A', ['a', 'b', 'c', 'gone']), byId);
    expect(entries.size).toBe(2);
    expect(entries.has(entryKey(song('other-version', 12, 'c')))).toBe(true);
    expect(entries.has(entryKey(songs[2]))).toBe(true);
    expect(entries.has(entryKey(songs[3]))).toBe(false);
  });
});
