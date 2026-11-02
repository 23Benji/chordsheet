import { collapseVersions, groupVersions, mainVersion } from './versions';

const s = (id: string, number: number | null, suffix = '') => ({ id, number, suffix });

describe('versions', () => {
  const songs = [s('123c', 123, 'c'), s('1', 1), s('123', 123), s('x', null), s('123b', 123, 'b'), s('y', null)];

  it('groups by number, sorted by suffix, ignoring songs without number', () => {
    const groups = groupVersions(songs);
    expect(groups.get(123)!.map((v) => v.id)).toEqual(['123', '123b', '123c']);
    expect(groups.get(1)!.map((v) => v.id)).toEqual(['1']);
    expect(groups.size).toBe(2);
  });

  it('collapses to the first occurrence per number, keeping order', () => {
    expect(collapseVersions(songs).map((v) => v.id)).toEqual(['123c', '1', 'x', 'y']);
  });

  it('picks the version without suffix as main', () => {
    expect(mainVersion([s('b', 4, 'b'), s('a', 4)]).id).toBe('a');
    expect(mainVersion([s('c', 5, 'c'), s('b', 5, 'b')]).id).toBe('c');
  });
});
