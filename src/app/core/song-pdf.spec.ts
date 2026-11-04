import { parseChordPro } from './chordpro';
import { PAGE, PdfOptions, PdfText, layoutSongPdf, pdfSafe, wrapWords } from './song-pdf';

// Fake font metrics: every character is 2 mm wide (chords 1.6 mm).
const measure = (text: string, role: string) => text.length * (role === 'chord' ? 1.6 : 2);

const options = (mode: 'chords' | 'lyrics'): PdfOptions => ({
  mode,
  title: 'Io lodo Te',
  meta: ['N. 1', 'Tonalità C'],
  label: (s) => (s.type === 'chorus' ? 'Ritornello' : s.type === 'instrumental' ? 'Intro' : s.number ? `Strofa ${s.number}` : null),
  repeat: '(ripeti)',
});

const SONG = `{title: Io lodo Te}
{start_of_verse}
[C]QUANDO GUARDO LA TUA SAN[F]TITÀ
{end_of_verse}

{start_of_chorus}
[G]IO LODO [F]TE SI[G]GNOR
{end_of_chorus}
`;

const texts = (mode: 'chords' | 'lyrics', source = SONG) =>
  layoutSongPdf(parseChordPro(source), options(mode), measure).ops.filter((o): o is PdfText => o.kind === 'text');

describe('song PDF layout', () => {
  it('puts the title, the info line and chords above their syllables', () => {
    const ops = texts('chords');
    expect(ops[0]).toMatchObject({ text: 'Io lodo Te', font: 'title', x: PAGE.left });
    expect(ops[1].text).toContain('Tonalità C');
    const f = ops.find((o) => o.text === 'F' && o.font === 'chord')!;
    // The lyric is one run of text: the chord sits where "TITÀ" starts inside it.
    const run = ops.find((o) => o.font === 'lyric' && o.text.includes('SANTITÀ'))!;
    expect(run.text).toBe('QUANDO GUARDO LA TUA SANTITÀ');
    const syllableX = run.x + measure(run.text.slice(0, run.text.indexOf('TITÀ')), 'lyric');
    expect(f.x).toBeCloseTo(syllableX); // the chord starts where its syllable starts
    expect(f.y).toBeLessThan(run.y); // … above it
  });

  it('indents the chorus and draws a rule beside it', () => {
    const layout = layoutSongPdf(parseChordPro(SONG), options('chords'), measure);
    const chorusLyric = layout.ops.find((o): o is PdfText => o.kind === 'text' && o.text.startsWith('IO'))!;
    expect(chorusLyric.x).toBeGreaterThan(PAGE.left);
    const rules = layout.ops.filter((o) => o.kind === 'line' && o.x1 === o.x2);
    expect(rules).toHaveLength(1);
  });

  it('words only (choir): no chords, no instrumental sections, whole lines of text', () => {
    const ops = texts('lyrics', `{title: X}\n{start_of_verse: Intro}\n[C] [G]\n{end_of_verse}\n\n[C]UNA RI[G]GA\n`);
    expect(ops.some((o) => o.font === 'chord')).toBe(false);
    expect(ops.find((o) => o.font === 'lyric')!.text).toBe('UNA RIGA');
  });

  it('keeps a section whole on the next page and numbers the pages', () => {
    const verse = (n: number) => `{start_of_verse}\n${Array.from({ length: 6 }, () => `[C]RIGA${n}`).join('\n')}\n{end_of_verse}\n`;
    const source = `{title: Lungo}\n${Array.from({ length: 12 }, (_, i) => verse(i + 1)).join('\n')}`;
    const layout = layoutSongPdf(parseChordPro(source), options('chords'), measure);
    expect(layout.pages).toBeGreaterThan(1);
    for (let n = 1; n <= 12; n++) {
      const pages = new Set(layout.ops.filter((o) => o.kind === 'text' && o.text.trim() === `RIGA${n}`).map((o) => o.page));
      expect(pages.size).toBe(1); // never split across pages
    }
    const footers = layout.ops.filter((o): o is PdfText => o.kind === 'text' && o.font === 'footer');
    expect(footers.map((o) => o.text)).toEqual(Array.from({ length: layout.pages }, (_, i) => `${i + 1} / ${layout.pages}`));
    const lowest = Math.max(...layout.ops.filter((o): o is PdfText => o.kind === 'text' && o.font !== 'footer').map((o) => o.y));
    expect(lowest).toBeLessThanOrEqual(PAGE.height - PAGE.bottom);
  });

  it('wraps long lines inside the margins', () => {
    const long = `{title: X}\n${'[C]PAROLA '.repeat(30)}\n`;
    const ops = texts('chords', long).filter((o) => o.font === 'lyric');
    const right = Math.max(...ops.map((o) => o.x + measure(o.text, 'lyric')));
    expect(right).toBeLessThanOrEqual(PAGE.width - PAGE.right + 0.01);
    expect(new Set(ops.map((o) => o.y)).size).toBeGreaterThan(1);
  });

  it('wraps greedily and keeps only characters the PDF fonts have', () => {
    expect(wrapWords([3, 3, 3, 9], (n) => n, 7)).toEqual([[3, 3], [3], [9]]);
    expect(pdfSafe('F♯ – B♭ “È” 🎵')).toBe('F# – Bb “È” ');
  });
});
