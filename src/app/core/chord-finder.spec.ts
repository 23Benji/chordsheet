import { describe, expect, it } from 'vitest';
import { chordShape } from './chord-diagrams';
import { FretChoice, findChords, soundingNotes } from './chord-finder';

/** "x32010" → frets low E → high e (x = not played). */
const shape = (s: string): FretChoice[] => [...s].map((c) => (c === 'x' ? null : parseInt(c, 16)));
const best = (s: string) => findChords(shape(s))[0]?.name;

describe('chord finder', () => {
  it('names the open chords', () => {
    expect(best('x32010')).toBe('C');
    expect(best('320003')).toBe('G');
    expect(best('xx0232')).toBe('D');
    expect(best('x02210')).toBe('Am');
    expect(best('022000')).toBe('Em');
    expect(best('xx0231')).toBe('Dm');
    expect(best('020100')).toBe('E7');
    expect(best('x02010')).toBe('Am7');
    expect(best('xx3210')).toBe('Fmaj7');
    expect(best('x02200')).toBe('Asus2');
    expect(best('x02220')).toBe('A');
    expect(best('x02230')).toBe('Asus4');
  });

  it('barre chords and positions up the neck', () => {
    expect(best('133211')).toBe('F');
    expect(best('x35553')).toBe('C');
    expect(best('x13331')).toBe('Bb');
    expect(best('x13321')).toBe('Bbm');
    expect(best('799877')).toBe('B');
  });

  it('a note other than the root in the bass is a slash chord', () => {
    expect(best('200232')).toBe('D/F#');
    expect(best('032010')).toBe('C/E');
    expect(best('x3201x')).toBe('C');
  });

  it('a 7th chord without its fifth is still found', () => {
    // G7 as x/2/0/0/0/1 … here: G B F (no D)
    const g7 = findChords(shape('3x340x'));
    expect(g7[0].name).toBe('G7');
    expect(g7[0].complete).toBe(false);
  });

  it('lists the other names of the same notes', () => {
    const names = findChords(shape('x02010')).map((c) => c.name);
    expect(names[0]).toBe('Am7');
    expect(names).toContain('C6/A');
  });

  it('nothing for one note or for notes that make no known chord', () => {
    expect(findChords(shape('xxxxxx'))).toEqual([]);
    expect(findChords(shape('x3xxxx'))).toEqual([]);
    expect(findChords(shape('x3355x'))).toEqual([]); // C, G, C, F: not a chord we know
  });

  it('agrees with the app’s own chord diagrams', () => {
    for (const name of ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em', 'Bm', 'F#m', 'C7', 'D7', 'G7', 'Cmaj7', 'Dsus4', 'Esus4', 'Bb', 'Eb', 'Ab', 'C#m']) {
      const frets = chordShape(name)!.frets.map((f) => (f < 0 ? null : f));
      const names = findChords(frets).map((c) => c.name);
      expect(names, name).toContain(name);
    }
  });

  it('sounding notes, low to high', () => {
    expect(soundingNotes(shape('x32010'))).toEqual([48, 52, 55, 60, 64]);
  });
});
