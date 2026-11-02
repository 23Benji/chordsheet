import { chordsOverWordsToChordPro } from './chords-over-words';

describe('chordsOverWordsToChordPro', () => {
  it('merges chord lines into the lyric line below by column', () => {
    const text = 'G             D\nDio è grande, Dio è forte\n   Em\nben al di sopra';
    expect(chordsOverWordsToChordPro(text)).toBe('[G]Dio è grande, [D]Dio è forte\nben[Em] al di sopra');
  });

  it('keeps chords past the end of the lyric and chord-only lines', () => {
    expect(chordsOverWordsToChordPro('C        G\nciao\n\nAm  F')).toBe('[C]ciao     [G]\n\n[Am]    [F]');
  });

  it('understands the old notation and website section headers', () => {
    expect(chordsOverWordsToChordPro('[Chorus]\nB-   G\nsanto santo')).toBe('{comment: Chorus}\n[Bm]santo[G] santo');
  });

  it('leaves plain lyrics and directives alone', () => {
    expect(chordsOverWordsToChordPro('{title: X}\nE LA SUA BENIGNITÀ')).toBe('{title: X}\nE LA SUA BENIGNITÀ');
  });
});
