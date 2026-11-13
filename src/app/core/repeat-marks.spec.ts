import { LyricLine, collapseRepeats, parseChordPro } from './chordpro';
import { noteTimes, reminderTimes, upgradeRepeatSpans } from './repeat-marks';

const sections = (text: string) => parseChordPro(text).sections;
const times = (text: string) => sections(text).flatMap((s) => s.lines.map((l) => (l.kind === 'comment' ? null : (l.times ?? null))));

describe('repeat marks', () => {
  describe('written in the song', () => {
    it('{x_repeat: N} at the top of a part repeats the whole part', () => {
      const [first, second] = sections('{x_repeat: 4}\n[C]UNO\n[G]DUE\n\n[F]TRE');
      expect(first.repeat).toBe(4);
      expect(second.repeat).toBeUndefined();
    });

    it('works inside a chorus block and in the middle of a part', () => {
      expect(sections('{start_of_chorus}\n{x_repeat: 2}\n[C]RIT\n{end_of_chorus}')[0].repeat).toBe(2);
      expect(sections('[C]UNO\n{x_repeat: 3}\n[G]DUE')[0].repeat).toBe(3);
    });

    it('{x_repeat_line: N} marks the line after it', () => {
      expect(times('[C]UNO\n[G]DUE\n{x_repeat_line: 2}\n[F]TRE\n{x_repeat_line: 2}\n{x_intro}\n[C]QUATTRO')).toEqual([null, null, 2, 2]);
      const last = sections('{x_repeat_line: 2}\n{x_intro}\n[C]UNO')[0].lines[0] as LyricLine;
      expect(last.intro).toBe(true);
    });

    it('ignores counts that make no sense', () => {
      expect(sections('{x_repeat: 1}\n[C]UNO')[0].repeat).toBeUndefined();
      expect(times('{x_repeat_line: abc}\n[C]UNO')).toEqual([null]);
    });

    it('a part written ×2 and pasted again adds up ("Parti ripetute")', () => {
      const part = '{x_repeat: 2}\n[C]UNO';
      expect(collapseRepeats(parseChordPro(`${part}\n\n${part}`)).sections[0].repeat).toBe(4);
    });
  });

  describe('old songs (clear cases only)', () => {
    it('"x2/ … /x2" around lines → those lines ×2, markers gone', () => {
      const text = '[G]CIAO\nx2/ [G]TUTTO SEI PER ME\nIL MIO [C]CUORE /x2\n[G]';
      expect(times(text)).toEqual([null, 2, 2, null]);
      const line = sections(text)[0].lines[1] as LyricLine;
      expect(line.text).toBe('TUTTO SEI PER ME');
      expect((sections(text)[0].lines[2] as LyricLine).text).toBe('IL MIO CUORE');
    });

    it('a span on one line', () => {
      expect(upgradeRepeatSpans('x4/ OVUNQUE STARÒ /x4')).toBe('{x_repeat_line: 4}\nOVUNQUE STARÒ');
    });

    it('leaves spans that cross a paragraph or a section, or whose counts differ', () => {
      const across = 'x4/ [G]OVUNQUE\n{start_of_chorus}\nLA TUA LODE /x4\n{end_of_chorus}';
      expect(upgradeRepeatSpans(across)).toBe(across);
      expect(upgradeRepeatSpans('x2/ UNO\n\nDUE /x2')).toBe('x2/ UNO\n\nDUE /x2');
      expect(upgradeRepeatSpans('x2/ UNO\nDUE /x3')).toBe('x2/ UNO\nDUE /x3');
    });

    it('keeps the line numbers (personal notes stay on their lines)', () => {
      const old = sections('[G]CIAO\nx2/ [G]TUTTO\nIL MIO /x2\n[G]FINE');
      const plain = sections('[G]CIAO\n[G]TUTTO\nIL MIO\n[G]FINE');
      expect(old[0].lines.map((l) => l.index)).toEqual(plain[0].lines.map((l) => l.index));
    });

    it('a note "x2" ending a part → the part ×2', () => {
      const [part] = sections('[C]UNO\n[G]DUE\n{comment: x2}\n\n[F]TRE');
      expect(part.repeat).toBe(2);
      expect(part.lines.map((l) => l.kind)).toEqual(['lyrics', 'lyrics']);
    });

    it('a note "x 3 volte" on its own after a part → that part ×3', () => {
      const result = sections('[C]UNO\n[G]DUE\n\n{comment: x 3 volte}\n\n[F]TRE');
      expect(result.length).toBe(2);
      expect(result[0].repeat).toBe(3);
    });

    it('a note "x2" in the middle of a part stays a note', () => {
      const [part] = sections('[C]UNO\n{comment: x2}\n[G]DUE');
      expect(part.repeat).toBeUndefined();
      expect(part.lines[1]).toMatchObject({ kind: 'comment', text: 'x2' });
    });

    it('"x2" at the end of a sung line stays as written', () => {
      expect((sections('[C]SOFFIA FORTE | x2')[0].lines[0] as LyricLine).text).toBe('SOFFIA FORTE | x2');
    });

    it('chorus reminders with a count', () => {
      const wrapped = sections('{comment: Ritornello: X2/ BENEDICI IL SIGNOR… /X2}')[0];
      expect(wrapped).toMatchObject({ type: 'chorusRepeat', repeat: 2 });
      expect(wrapped.lines[0]).toMatchObject({ kind: 'comment', text: 'BENEDICI IL SIGNOR…' });
      const trailing = sections('{comment: Ritornello: Nella mia vita sei fedele… x 2}')[0];
      expect(trailing).toMatchObject({ type: 'chorusRepeat', repeat: 2 });
      expect(trailing.lines[0]).toMatchObject({ text: 'Nella mia vita sei fedele…' });
      const span = sections('x2/ Ritornello: DO A TE TUTTA LA LODE… /x2')[0];
      expect(span).toMatchObject({ type: 'chorusRepeat', repeat: 2 });
    });

    it('reads the counts', () => {
      expect([noteTimes('x2'), noteTimes(' X 3 '), noteTimes('×4'), noteTimes('x2 volte'), noteTimes('x2  S'), noteTimes('basso')]).toEqual([2, 3, 4, 2, null, null]);
      expect(reminderTimes('QUEL GIORNO VEDRAI… X2 volte')).toEqual({ times: 2, text: 'QUEL GIORNO VEDRAI…' });
      expect(reminderTimes('IO NON HO PAURA…')).toBeNull();
    });
  });
});
