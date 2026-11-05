import { bassPositions, chordNotes, isBlackKey, keyboardRange, pianoVoicings } from './chord-notes';

describe('chordNotes', () => {
  it('spells the notes like musicians write them', () => {
    expect(chordNotes('C')!.notes).toEqual(['C', 'E', 'G']);
    expect(chordNotes('F#m')!.notes).toEqual(['F#', 'A', 'C#']);
    expect(chordNotes('Bb7')!.notes).toEqual(['Bb', 'D', 'F', 'Ab']);
    expect(chordNotes('Ebmaj7')!.notes).toEqual(['Eb', 'G', 'Bb', 'D']);
    expect(chordNotes('Dsus4')!.notes).toEqual(['D', 'G', 'A']);
    expect(chordNotes('Cadd9')!.notes).toEqual(['C', 'E', 'G', 'D']);
    expect(chordNotes('B-')!.notes).toEqual(['B', 'D', 'F#']); // Italian minus = minor
  });

  it('keeps the bass of slash chords; unknown chords give null', () => {
    expect(chordNotes('D/F#')!.bass).toEqual({ pc: 6, name: 'F#' });
    expect(chordNotes('C13#11')).toBeNull();
    expect(chordNotes('N.C.')).toBeNull();
  });
});

describe('pianoVoicings', () => {
  it('root position, then the inversions', () => {
    const [root, first, second] = pianoVoicings(chordNotes('C')!);
    expect(root).toMatchObject({ keys: [0, 4, 7], names: ['C', 'E', 'G'], rootKey: 0 });
    expect(first).toMatchObject({ keys: [4, 7, 12], names: ['E', 'G', 'C'], rootKey: 12 });
    expect(second).toMatchObject({ keys: [7, 12, 16], names: ['G', 'C', 'E'] });
  });

  it('starts in the lowest octave', () => {
    const [root] = pianoVoicings(chordNotes('A')!);
    expect(root.keys).toEqual([9, 13, 16]);
    const inversions = pianoVoicings(chordNotes('B7')!);
    expect(inversions.every((v) => Math.min(...v.keys) < 12)).toBe(true);
  });
});

describe('keyboardRange', () => {
  it('starts on a white key and shows at least 8 white keys', () => {
    expect(isBlackKey(1)).toBe(true);
    const range = keyboardRange([6, 9, 13]); // F#
    expect(range.from).toBe(5); // F
    const whites = Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i).filter((k) => !isBlackKey(k));
    expect(whites.length).toBeGreaterThanOrEqual(8);
    expect(isBlackKey(range.to)).toBe(false);
  });
});

describe('bassPositions', () => {
  it('root, fifth and octave from the lowest position', () => {
    const [first] = bassPositions(chordNotes('A')!);
    // A: open A string, fifth E on the D string fret 2, octave A on the G string fret 2.
    expect(first.dots).toEqual([
      { string: 1, fret: 0, role: 'root' },
      { string: 2, fret: 2, role: 'fifth' },
      { string: 3, fret: 2, role: 'octave' },
    ]);
    expect(first.note).toBe('A');
    expect(first.baseFret).toBe(1);
  });

  it('diminished chords use the flat fifth; slash chords play the bass note', () => {
    const dim = bassPositions(chordNotes('Bdim')!).find((p) => p.dots[0].string === 1)!;
    expect(dim.dots[1]).toEqual({ string: 2, fret: 3, role: 'fifth' }); // B on A string fret 2 → F on D string fret 3
    const slash = bassPositions(chordNotes('D/F#')!);
    expect(slash[0].note).toBe('F#');
    expect(slash[0].dots.some((d) => d.role === 'fifth')).toBe(false);
  });
});
