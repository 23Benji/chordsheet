import { LyricLine, parseChordPro } from './chordpro';
import { toggleIntroMark } from './intro-mark';

const SONG = `{title: Grande è il Signore}

[A]GRANDE È IL SIGNORE

{start_of_chorus}
[A]SIGNORE NOI VOGLIAM LO[C#m]DARE TE,
PER[D]CHÉ SOLTANTO TU, ETERNO,
{x_gap}
REGNI IN TERRA E IN CIELO, SEI RE.
{end_of_chorus}
`;

const lines = (text: string) => parseChordPro(text).sections.flatMap((s) => s.lines) as LyricLine[];

describe('intro mark', () => {
  it('reads {x_intro} on the line before', () => {
    const marked = lines('[C]LODE\n{x_intro}\n[G]A TE\n');
    expect(marked.map((l) => !!l.intro)).toEqual([false, true]);
  });

  it('adds and removes the mark on one line, touching nothing else', () => {
    const index = lines(SONG).find((l) => l.text.startsWith('PERCHÉ'))!.index;
    const on = toggleIntroMark(SONG, index)!;
    expect(on).toBe(SONG.replace('PER[D]CHÉ', '{x_intro}\nPER[D]CHÉ'));
    expect(lines(on).find((l) => l.index === index)!.intro).toBe(true);
    expect(toggleIntroMark(on, index)).toBe(SONG);
  });

  it('puts the mark ahead of a {x_gap} and finds it there again', () => {
    const index = lines(SONG).find((l) => l.text.startsWith('REGNI'))!.index;
    const on = toggleIntroMark(SONG, index)!;
    expect(on).toContain('{x_intro}\n{x_gap}\nREGNI');
    const line = lines(on).find((l) => l.index === index)!;
    expect([line.intro, line.chordGap]).toEqual([true, true]);
    expect(toggleIntroMark(on, index)).toBe(SONG);
  });

  it('marks the right copy of a line written twice', () => {
    const song = '[C]LODE A TE\n\n[C]LODE A TE\n';
    const second = lines(song)[1].index;
    expect(toggleIntroMark(song, second)).toBe('[C]LODE A TE\n\n{x_intro}\n[C]LODE A TE\n');
  });

  it('also marks a line of chords written as text', () => {
    const song = 'A D E A\n[A]GRANDE\n';
    const on = toggleIntroMark(song, 0)!;
    expect(on).toBe('{x_intro}\nA D E A\n[A]GRANDE\n');
    expect(parseChordPro(on).sections[0].lines[0]).toMatchObject({ kind: 'chords', intro: true });
  });
});
