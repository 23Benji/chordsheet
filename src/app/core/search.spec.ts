import { buildSearchEntry, extractLyrics, normalize, searchSongs } from './search';

const song = (id: string, number: number | null, suffix: string, title: string, chordpro = '') => ({
  id,
  number,
  suffix,
  title,
  chordpro,
});

const entries = [
  song('a', 4, '', 'Siam riuniti tutti qui', '[C]SIAM RIUNITI'),
  song('b', 4, 'b', 'Siam riuniti tutti qui'),
  song('c', 12, '', 'Siamo qui, sì in Gesù io credo'),
  song('d', 123, 'c', 'La terra canta'),
  song('e', 126, '', 'Questa è la grazia Tua', '[D]QUESTA È LA GRA[A]ZIA TUA'),
  song('f', 59, '', 'Stupenda grazia'),
  song('g', 120, '', 'Canto di lode', '[C]Per la Tua grazia io canto'),
].map(buildSearchEntry);

describe('search', () => {
  it('normalises accents, case and apostrophes', () => {
    expect(normalize("L'Iddio d'AMOR è")).toBe('l iddio d amor e');
  });

  it('finds an exact number with suffix first', () => {
    expect(searchSongs(entries, '123c')[0]).toBe('d');
  });

  it('ranks the exact number, then its versions, then prefixes', () => {
    expect(searchSongs(entries, '4')).toEqual(['a', 'b']);
    expect(searchSongs(entries, '12')).toEqual(['c', 'd', 'e', 'g']);
  });

  it('matches titles before lyrics, accent-insensitively', () => {
    expect(searchSongs(entries, 'grazia')).toEqual(['e', 'f', 'g']);
    expect(searchSongs(entries, 'gesu')).toEqual(['c']);
    expect(searchSongs(entries, 'QUESTA E')).toEqual(['e']);
  });

  it('matches multi-word queries in any order', () => {
    expect(searchSongs(entries, 'canto grazia')).toEqual(['g']);
  });

  it('extracts plain lyrics', () => {
    expect(extractLyrics('{title: T}\n[C]Ama[G]zing grace')).toBe('Amazing grace');
  });

  it('returns everything for an empty query', () => {
    expect(searchSongs(entries, '  ').length).toBe(entries.length);
  });
});
