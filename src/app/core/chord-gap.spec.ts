import { describe, expect, it } from 'vitest';
import { GapLine, chordGaps, toggledSpace } from './chord-gap';
import { parseChordPro } from './chordpro';

const C: GapLine = { lyrics: true, chorded: true, blank: false };
const P: GapLine = { lyrics: true, chorded: false, blank: false };
const NOTE: GapLine = { lyrics: false, chorded: false, blank: false };

describe('chord gap', () => {
  it('a plain line after a line with chords keeps the gap', () => {
    expect(chordGaps([C, P, C])).toEqual([null, { auto: true, on: true }, null]);
    // two in a row: both, so they look alike
    expect(chordGaps([C, P, P]).map((g) => g?.on)).toEqual([undefined, true, true]);
  });

  it('before the first chords, or after a note, it stays glued (but can be switched)', () => {
    expect(chordGaps([P, C])[0]).toEqual({ auto: false, on: false });
    expect(chordGaps([C, NOTE, P])[2]).toEqual({ auto: false, on: false });
  });

  it('sections without chords are left alone', () => {
    expect(chordGaps([P, P, P])).toEqual([null, null, null]);
  });

  it('the choice written in the song wins', () => {
    expect(chordGaps([C, { ...P, space: 'glue' }])[1]).toEqual({ auto: true, on: false });
    expect(chordGaps([{ ...P, space: 'gap' }, C])[0]).toEqual({ auto: false, on: true });
  });

  it('tapping stores a choice only when it differs from the rule', () => {
    expect(toggledSpace({ auto: true, on: true })).toBe('glue');
    expect(toggledSpace({ auto: true, on: false })).toBeUndefined();
    expect(toggledSpace({ auto: false, on: false })).toBe('gap');
    expect(toggledSpace({ auto: false, on: true })).toBeUndefined();
  });
});

describe('chord gap in the song view', () => {
  const lyric = (src: string, n: number) => {
    const lines = parseChordPro(src).sections.flatMap((s) => s.lines);
    return lines[n] as { text: string; chordGap?: boolean };
  };

  it('marks a plain line after a chord line, and reads {x_gap} / {x_glue}', () => {
    const song = '[G]uno due\ntre quattro\n[C]cinque\n\nsei\nsette';
    expect(lyric(song, 1).chordGap).toBe(true);
    expect(lyric(song, 3).chordGap).toBeFalsy(); // a verse without chords
    const glued = '[G]uno due\n{x_glue}\ntre quattro\n[C]cinque';
    expect(lyric(glued, 1).text).toBe('tre quattro');
    expect(lyric(glued, 1).chordGap).toBeFalsy();
    const forced = '{x_gap}\nuno due\n[C]cinque';
    expect(lyric(forced, 0).chordGap).toBe(true);
  });

  it('the markers are not lines: annotation indexes stay the same', () => {
    const a = parseChordPro('[G]uno\ndue\n[C]tre').sections[0].lines.map((l) => l.index);
    const b = parseChordPro('[G]uno\n{x_glue}\ndue\n[C]tre').sections[0].lines.map((l) => l.index);
    expect(b).toEqual(a);
  });
});
