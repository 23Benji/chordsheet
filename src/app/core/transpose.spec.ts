import {
  detectKey,
  keyOf,
  keyUsesFlats,
  keyView,
  parseChord,
  transposeChord,
  transposeKey,
} from './transpose';

describe('transpose', () => {
  it('parses chords with suffix and slash bass', () => {
    expect(parseChord('F#m7')).toEqual({ root: 6, suffix: 'm7', bass: null });
    expect(parseChord('D/F#')).toEqual({ root: 2, suffix: '', bass: 6 });
    expect(parseChord('Bbmaj7')).toEqual({ root: 10, suffix: 'maj7', bass: null });
    expect(parseChord('x2')).toBeNull();
  });

  it('transposes chords with the requested spelling', () => {
    expect(transposeChord('C', 2, false)).toBe('D');
    expect(transposeChord('F#m', -1, false)).toBe('Fm');
    expect(transposeChord('Bb', 2, false)).toBe('C');
    expect(transposeChord('A', 1, true)).toBe('Bb');
    expect(transposeChord('A', 1, false)).toBe('A#');
    expect(transposeChord('C#7sus4', 1, false)).toBe('D7sus4');
    expect(transposeChord('G', -3, false)).toBe('E');
  });

  it('transposes slash chords (root and bass)', () => {
    expect(transposeChord('D/F#', 3, true)).toBe('F/A');
    expect(transposeChord('G/B', 2, false)).toBe('A/C#');
    expect(transposeChord('Cadd9/E', -2, true)).toBe('Bbadd9/D');
  });

  it('leaves non-chords untouched', () => {
    expect(transposeChord('N.C.', 3, false)).toBe('N.C.');
  });

  it('names and transposes keys', () => {
    expect(keyOf('Am7')).toBe('Am');
    expect(keyOf('Cmaj7')).toBe('C');
    expect(transposeKey('E', 3)).toBe('G');
    expect(transposeKey('C', 1)).toBe('Db');
    expect(transposeKey('Bm', 1)).toBe('Cm');
    expect(keyUsesFlats('F')).toBe(true);
    expect(keyUsesFlats('Dm')).toBe(true);
    expect(keyUsesFlats('D')).toBe(false);
  });

  it('detects the key from the first chord', () => {
    expect(detectKey('{title: x}\n[F#m]SI APRONO [D]I CIELI')).toBe('F#m');
    expect(detectKey('no chords')).toBeNull();
  });

  it('song 1 (C) transposed to D shows correct chords', () => {
    const view = keyView('C', 2, 0);
    expect(view.soundingKey).toBe('D');
    expect(['C', 'F', 'G', 'Am', 'C7'].map(view.mapChord)).toEqual(['D', 'G', 'A', 'Bm', 'D7']);
  });

  it('chooses flats when the target key is a flat key', () => {
    const view = keyView('C', 5, 0); // → F
    expect(view.soundingKey).toBe('F');
    expect(view.mapChord('F')).toBe('Bb');
    expect(view.mapChord('G7')).toBe('C7');
  });

  it('respects an explicit accidental preference', () => {
    const view = keyView('C', 5, 0, true);
    expect(view.mapChord('F')).toBe('A#');
  });

  it('capo shows shapes = sounding chords transposed down', () => {
    // Original A, capo 2 → play G shapes, sounds in A.
    const view = keyView('A', 0, 2);
    expect(view.soundingKey).toBe('A');
    expect(view.shapeKey).toBe('G');
    expect(['A', 'D', 'E', 'F#m'].map(view.mapChord)).toEqual(['G', 'C', 'D', 'Em']);
  });

  it('keeps chords exactly as written when nothing changes', () => {
    const view = keyView('Bb', 0, 0);
    expect(view.mapChord('A#')).toBe('A#');
  });
});
