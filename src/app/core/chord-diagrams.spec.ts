import { chordShape, chordShapes } from './chord-diagrams';

const frets = (name: string) => chordShape(name)?.frets.map((f) => (f < 0 ? 'x' : f)).join('');

describe('chord diagrams', () => {
  it('uses the classic open shapes', () => {
    expect(frets('G')).toBe('320003');
    expect(frets('C')).toBe('x32010');
    expect(frets('D')).toBe('xx0232');
    expect(frets('Am')).toBe('x02210');
    expect(frets('Em')).toBe('022000');
    expect(frets('E7')).toBe('020100');
    expect(frets('B7')).toBe('x21202');
    expect(frets('Dsus4')).toBe('xx0233');
    expect(frets('Cadd9')).toBe('x32030');
  });

  it('builds barre chords for the other roots', () => {
    expect(chordShape('F')).toMatchObject({ frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: { fret: 1, fromString: 0 } });
    expect(frets('Bm')).toBe('x24432');
    expect(frets('Bb')).toBe('x13331');
    expect(chordShape('C#m')).toMatchObject({ frets: [-1, 4, 6, 6, 5, 4], baseFret: 4 });
    expect(frets('F#m7')).toBe('242222');
  });

  it('understands suffix spellings and slash chords', () => {
    expect(frets('Dmaj7')).toBe(frets('DM7'));
    expect(frets('A4')).toBe(frets('Asus4'));
    expect(chordShape('D/F#')).toMatchObject({ frets: [-1, -1, 0, 2, 3, 2], bass: 'F#' });
  });

  it('returns null for unknown chords', () => {
    expect(chordShape('C13#11')).toBeNull();
    expect(chordShape('x2')).toBeNull();
  });

  it('offers several fingerings per chord, easiest first and without duplicates', () => {
    const all = (name: string) => chordShapes(name).map((s) => s.frets.map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : f)).join(''));
    expect(all('E')).toEqual(['022100', 'xx2454', 'x76454', 'x79997', '(12)(14)(14)(13)(12)(12)']);
    expect(all('G').slice(0, 3)).toEqual(['320003', '355433', 'xx5787']);
    expect(all('Am')).toEqual(['x02210', '577555', 'xx79(10)8']);
    expect(all('D')).toContain('x57775');
    // Every voicing of a slash chord shows the bass note.
    expect(chordShapes('D/F#').every((s) => s.bass === 'F#')).toBe(true);
  });
});
