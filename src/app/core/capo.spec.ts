import { capoOptions, shapeDifficulty, shapeKeyFor, sheetChords, suggestCapo } from './capo';
import { parseChordPro } from './chordpro';

describe('capo suggestion', () => {
  it('open shapes are easy, barre shapes hard', () => {
    for (const c of ['G', 'C', 'D', 'E', 'A', 'Em', 'Am', 'Dm', 'E7', 'B7', 'Cadd9', 'Dsus4', 'Gmaj7']) {
      expect(shapeDifficulty(c), c).toBe(0);
    }
    expect(shapeDifficulty('F')).toBe(1.5);
    expect(shapeDifficulty('Bm')).toBe(1.5);
    for (const c of ['Bb', 'F#m', 'C#m', 'Eb', 'Gm', 'Bdim']) expect(shapeDifficulty(c), c).toBe(3);
    expect(shapeDifficulty('D/F#')).toBe(0.5);
    expect(shapeDifficulty('B-')).toBe(1.5); // old notation for Bm
    expect(shapeDifficulty('x2')).toBe(0);
  });

  it('a song in Bb → capo 3, shapes in G', () => {
    const chords = ['Bb', 'Eb', 'F', 'Gm', 'Bb', 'F', 'Eb', 'Bb'];
    expect(suggestCapo(chords, 0, 'Bb')).toEqual({ capo: 3, shapeKey: 'G' });
  });

  it('a song in Eb → capo 1 (shapes in D) rather than capo 3 (shapes in C)', () => {
    // Eb Ab Bb Cm → D G A Bm (capo 1) or C F G Am (capo 3): D G A beats F.
    expect(suggestCapo(['Eb', 'Ab', 'Bb', 'Cm', 'Eb', 'Bb'], 0, 'Eb')).toEqual({ capo: 1, shapeKey: 'D' });
  });

  it('minor keys keep their name: Bm → capo 2, shapes in Am', () => {
    expect(suggestCapo(['Bm', 'F#m', 'D', 'F#', 'G', 'Bm', 'F#m'], 0, 'Bm')?.shapeKey).toBe('Am');
  });

  it('no suggestion when the song is already easy, or the current capo is the best', () => {
    expect(suggestCapo(['G', 'C', 'D', 'Em'], 0, 'G')).toBeNull();
    expect(suggestCapo(['Bb', 'Eb', 'F', 'Gm'], 3, 'Bb')).toBeNull();
    expect(suggestCapo([], 0, null)).toBeNull();
    // C with an F and a Bm now and then: fine without capo.
    expect(suggestCapo(['C', 'F', 'G', 'Am', 'C', 'F', 'G', 'Bm'], 0, 'C')).toBeNull();
  });

  it('a tie goes to the lower fret', () => {
    const options = capoOptions(['G', 'C', 'D']);
    expect(options[0]).toEqual({ capo: 0, score: 0 });
    expect(options).toHaveLength(8);
  });

  it('collects the chords of a song (repeats count), not the second key', () => {
    const sheet = parseChordPro('[G]uno [C]due [G]tre    (A D A)\nG D Em C');
    expect(sheetChords(sheet)).toEqual(['G', 'C', 'G', 'G', 'D', 'Em', 'C']);
  });

  it('names the shape key', () => {
    expect(shapeKeyFor('Bb', 3)).toBe('G');
    expect(shapeKeyFor('C#m', 4)).toBe('Am');
    expect(shapeKeyFor(null, 2)).toBeNull();
  });
});
