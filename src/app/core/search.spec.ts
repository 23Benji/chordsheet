import { buildSearchEntry, closeWord, editDistance, extractLyrics, loose, normalize, searchSongs } from './search';

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
  song('h', 7, '', 'Alleluia', '[G]Osanna al Signore'),
  song('i', 8, '', 'Hosanna nell’alto dei cieli'),
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

  it('forgives spelling variants: j/y = i, silent h, double letters', () => {
    expect(loose('alleluja hosanna')).toBe('aleluia osana');
    expect(searchSongs(entries, 'alleluja')).toEqual(['h']);
    expect(searchSongs(entries, 'aleluia')).toEqual(['h']);
    expect(searchSongs(entries, 'hosanna')).toEqual(['i', 'h']); // title, then lyrics
    expect(searchSongs(entries, 'osana')).toEqual(['i', 'h']);
  });

  it('exact matches still come first, then spelling variants', () => {
    expect(searchSongs(entries, 'osanna')).toEqual(['i', 'h']); // inside the title "Hosanna", then h's lyrics
    expect(searchSongs(entries, 'grazia tua')).toEqual(['e', 'g']); // exact words beat the typo pass
  });

  it('forgives a typo when nothing else matches', () => {
    expect(searchSongs(entries, 'signroe')).toEqual(['h']); // swapped letters, in the lyrics
    expect(searchSongs(entries, 'stupnda')).toEqual(['f']); // a missing letter, in the title
    expect(searchSongs(entries, 'grazai tua')).toEqual(['e', 'g']); // title first, then g's lyrics "tua grazia"
    expect(searchSongs(entries, 'canto lodr')).toEqual(['g']);
    expect(searchSongs(entries, 'signo')).toEqual(['h']); // still typing "signore"
  });

  it('typos are not guessed on short words or when there are real results', () => {
    expect(searchSongs(entries, 'lpde')).toEqual(['g']); // 4 letters: one off is fine
    expect(searchSongs(entries, 'xyz')).toEqual([]);
    expect(searchSongs(entries, 'qiu')).toEqual([]); // 3 letters: no guessing
    expect(searchSongs(entries, 'terra')).toEqual(['d']); // exact: no typo extras like "tera…"
  });

  it('edit distance counts adds, removals, changes and swaps', () => {
    expect(editDistance('signore', 'signore')).toBe(0);
    expect(editDistance('signroe', 'signore')).toBe(1);
    expect(editDistance('sigore', 'signore')).toBe(1);
    expect(editDistance('abc', 'xyz')).toBe(3);
    expect(editDistance('abcdefgh', 'zzzzzzzz', 2)).toBe(3); // stops early above the limit
    expect(closeWord('grazai', 'grazia')).toBe(true);
    expect(closeWord('mare', 'male')).toBe(true);
    expect(closeWord('mre', 'mare')).toBe(false);
  });

  it('returns everything for an empty query', () => {
    expect(searchSongs(entries, '  ').length).toBe(entries.length);
  });
});
