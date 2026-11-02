import { cleanIntro, introView, isEmptyIntro, mapChordText } from './intro';
import { transposeChord } from './transpose';

describe('intro', () => {
  const up2 = (c: string) => transposeChord(c, 2, false);

  it('shows the chords transposed with the song, keeping words like x2', () => {
    const view = introView({ part: 'Ritornello', chords: 'G D/F# Em C x2', rhythm: '↓ ↓↑' }, up2)!;
    expect(view.chords).toEqual([{ chord: 'A' }, { chord: 'E/G#' }, { chord: 'F#m' }, { chord: 'D' }, { text: 'x2' }]);
    expect(view.part).toBe('Ritornello');
  });

  it('stores chords typed in the displayed key back in the original key', () => {
    expect(mapChordText('A E/G# F#m', (c) => transposeChord(c, -2, false))).toBe('G D/F# Em');
    expect(mapChordText('B- G (2 volte)', (c) => c)).toBe('Bm G (2 volte)');
  });

  it('treats an all-empty intro as none', () => {
    expect(isEmptyIntro({ part: ' ', chords: '' })).toBe(true);
    expect(introView({ note: '  ' }, up2)).toBeNull();
    expect(cleanIntro({ part: ' ', rhythm: ' ↓↑ ' })).toEqual({ rhythm: '↓↑' });
    expect(cleanIntro({ part: '' })).toBeUndefined();
  });
});
