import { readdirSync, readFileSync } from 'node:fs';
import { ChordsLine, CommentLine, LyricLine, collapseRepeats, mapSheetChords, parseChordPro } from './chordpro';
import { numberLabel, parseFileName, parseSongNumber, readNumeroMeta } from './song-meta';
import { HAS_SONGS } from '../../testing/bundled-songs';

const lyricLines = (src: string): LyricLine[] =>
  parseChordPro(src)
    .sections.flatMap((s) => s.lines)
    .filter((l): l is LyricLine => l.kind === 'lyrics');

describe('parseChordPro', () => {
  it('builds chord/lyric segments and keeps chords with their syllable', () => {
    const [line] = lyricLines('[C]QUANDO GUARDO LA TUA SANTI[F]TÀ');
    expect(line.hasChords).toBe(true);
    expect(line.text).toBe('QUANDO GUARDO LA TUA SANTITÀ');
    const last = line.words[line.words.length - 1];
    expect(last.segments).toEqual([
      { chord: null, lyric: 'SANTI' },
      { chord: 'F', lyric: 'TÀ' },
    ]);
    expect(line.words[0].segments).toEqual([{ chord: 'C', lyric: 'QUANDO ' }]);
  });

  it('keeps a chord slot when there is no lyric under it', () => {
    const [line] = lyricLines('IO LODO [C]TE, [Am]');
    const segments = line.words.flatMap((w) => w.segments);
    expect(segments[segments.length - 1]).toEqual({ chord: 'Am', lyric: '' });
  });

  it('groups choruses and comments into sections', () => {
    const sheet = parseChordPro(
      '{title: T}\n{meta: numero 1}\n{comment: x2}\n[C]uno\n\n{start_of_chorus}\n[G]rit\n{end_of_chorus}\n\ndue',
    );
    expect(sheet.title).toBe('T');
    expect(sheet.sections.map((s) => s.type)).toEqual(['verse', 'chorus', 'verse']);
    expect((sheet.sections[0].lines[0] as CommentLine).text).toBe('x2');
    expect(sheet.sections.flatMap((s) => s.lines).map((l) => l.index)).toEqual([0, 1, 2, 3]);
  });

  it('detects second-key groups at the end of a line', () => {
    const [line] = lyricLines('[Bm]CANTA ALLE[D]LUIA AL SI[F#m]GNOR[F#].    (Am C Em E)');
    expect(line.secondKey).toBe('(Am C Em E)');
    expect(line.text).toBe('CANTA ALLELUIA AL SIGNOR.');
    const segments = line.words.flatMap((w) => w.segments);
    expect(segments[segments.length - 1].chord).toBe('F#');
  });

  it('does not treat ordinary parentheses as second key', () => {
    const [line] = lyricLines('[C]Lode a Te (bis)');
    expect(line.secondKey).toBeNull();
    expect(line.text).toBe('Lode a Te (bis)');
  });

  it('reads key, capo and tempo', () => {
    const sheet = parseChordPro('{title: T}\n{key: D}\n{tempo: 108}\n{capo: 2}\n[D]x');
    expect(sheet.key).toBe('D');
    expect(sheet.tempo).toBe(108);
    expect(sheet.capo).toBe(2);
  });

  it('maps chords without touching lyrics', () => {
    const sheet = mapSheetChords(parseChordPro('[C]uno [G]due'), (c) => c + '7');
    const line = sheet.sections[0].lines[0] as LyricLine;
    expect(line.words.flatMap((w) => w.segments.map((s) => s.chord))).toEqual(['C7', 'G7']);
  });
});

describe('song meta', () => {
  it('parses number + suffix', () => {
    expect(parseSongNumber('123c')).toEqual({ number: 123, suffix: 'c' });
    expect(parseSongNumber('12')).toEqual({ number: 12, suffix: '' });
    expect(parseSongNumber('abc')).toEqual({ number: null, suffix: '' });
  });

  it('parses the bundled file-name pattern', () => {
    expect(parseFileName('004b - Siam riuniti tutti qui.cho')).toEqual({
      number: 4,
      suffix: 'b',
      title: 'Siam riuniti tutti qui',
    });
    expect(parseFileName('My song.txt')).toEqual({ number: null, suffix: '', title: 'My song' });
  });

  it('reads {meta: numero …}', () => {
    expect(readNumeroMeta('{title: x}\n{meta: numero 123c}\n')).toBe('123c');
    expect(numberLabel({ number: 123, suffix: 'c' })).toBe('123c');
  });
});

describe.skipIf(!HAS_SONGS)('bundled songs (songs/*.cho)', () => {
  const files = HAS_SONGS ? readdirSync('songs').filter((f) => f.endsWith('.cho')) : [];

  it('has all 166 files', () => {
    expect(files.length).toBe(166);
  });

  it.each(files)('%s parses and keeps its number and title', (file) => {
    const source = readFileSync(`songs/${file}`, 'utf8');
    const fromName = parseFileName(file);
    const fromMeta = parseSongNumber(readNumeroMeta(source));
    expect(fromMeta).toEqual({ number: fromName.number, suffix: fromName.suffix });

    const sheet = parseChordPro(source);
    expect(sheet.title).toBeTruthy();
    expect(sheet.sections.length).toBeGreaterThan(0);
  });
});

describe('backslashes', () => {
  it('are kept as plain text', () => {
    const [line] = lyricLines('D\\ Degno è [C]Lui \\ musica');
    expect(line.text).toBe('D\\ Degno è Lui \\ musica');
  });
});

describe('section labels', () => {
  const kinds = (src: string) =>
    parseChordPro(src).sections.map((s) => ({
      type: s.type,
      number: s.number,
      role: s.role,
      label: s.label,
    }));

  it('numbers verses; choruses are not numbered', () => {
    const sections = kinds('[C]uno\n\n{start_of_chorus}\n[G]rit\n{end_of_chorus}\n\n[C]due\n\n[C]tre');
    expect(sections.map((s) => [s.type, s.number])).toEqual([
      ['verse', 1],
      ['chorus', null],
      ['verse', 2],
      ['verse', 3],
    ]);
  });

  it('turns chord-only paragraphs into intro / intermezzo / finale', () => {
    const sections = kinds('[A] [D] [E]\n\n[A]canto\n\n[D] [E]\n\n[A]canto ancora\n\n[A] [E] [A]');
    expect(sections.map((s) => s.role ?? s.number)).toEqual(['intro', 1, 'interlude', 2, 'outro']);
  });

  it('recognises plain-text headings like "Intro:" and keeps their chords visible', () => {
    const sheet = parseChordPro('Intro: A, D, A, E\n[A]prima strofa\n\nIntermezzo musicale E- D\n\nx finale A, D, A2');
    expect(sheet.sections.map((s) => [s.type, s.role ?? s.number])).toEqual([
      ['instrumental', 'intro'],
      ['verse', 1],
      ['instrumental', 'interlude'],
      ['instrumental', 'outro'],
    ]);
    expect((sheet.sections[0].lines[0] as ChordsLine).items).toEqual([
      { chord: 'A' },
      { chord: 'D' },
      { chord: 'A' },
      { chord: 'E' },
    ]);
  });

  it('reads old-notation chord lines as chords (song 142 ending) and transposes them', () => {
    const sheet = parseChordPro('[Bm]canto\n\nB- G D A — B- G D A — D');
    const last = sheet.sections[1];
    expect([last.type, last.role]).toEqual(['instrumental', 'outro']);
    const up = mapSheetChords(sheet, (c) => c + '!');
    expect((up.sections[1].lines[0] as ChordsLine).items.slice(0, 2)).toEqual([{ chord: 'Bm!' }, { chord: 'G!' }]);
  });

  it('handles "Rit:" headings', () => {
    // Inside a chorus the line is dropped (the label already says it).
    const inside = parseChordPro('{start_of_chorus}\nRit:\n[Bm]Dio è grande\n{end_of_chorus}');
    expect(inside.sections[0].lines.map((l) => l.kind)).toEqual(['lyrics']);
    // Outside, "Rit: <chords>" is the chorus progression, "Rit:" + text a reminder.
    const outside = parseChordPro('Rit: C G A-7 G F C\n\nRit: Chi Lui libera…\n\nRitmo uguale');
    expect(outside.sections.map((s) => s.type)).toEqual(['chorus', 'chorusRepeat', 'verse']);
  });

  it('does not mistake sung lyrics for headings', () => {
    const sections = kinds('[C]FINALE DI GLORIA\nSOLO GESÙ');
    expect(sections).toEqual([{ type: 'verse', number: 1, role: null, label: null }]);
  });

  it('turns "Ritornello" comments into chorus reminders', () => {
    const sheet = parseChordPro(
      '[C]uno\n\n{comment: Ritornello: IO CANTERÒ A TE…}\n\n[C]due\n\n{comment: Ritornello}\n',
    );
    expect(sheet.sections.map((s) => s.type)).toEqual(['verse', 'chorusRepeat', 'verse', 'chorusRepeat']);
    expect((sheet.sections[1].lines[0] as CommentLine).text).toBe('IO CANTERÒ A TE…');
    expect(sheet.sections[3].lines).toEqual([]);
  });

  it('supports section directives with labels (written by the editor)', () => {
    const sections = kinds(
      '{start_of_bridge}\n[C]ponte\n{end_of_bridge}\n{start_of_verse: Strofa finale}\n[G]x\n{end_of_verse}\n' +
        '{start_of_part: Intro}\n[A] [D]\n{end_of_part}\n{start_of_chorus: Ritornello 2}\n[C]y\n{end_of_chorus}',
    );
    expect(sections).toEqual([
      { type: 'bridge', number: null, role: null, label: null },
      { type: 'verse', number: null, role: null, label: 'Strofa finale' },
      { type: 'instrumental', number: null, role: 'intro', label: null },
      { type: 'chorus', number: null, role: null, label: 'Ritornello 2' },
    ]);
  });
});

describe('# in song text', () => {
  it('keeps text after a "#" (chordsheetjs would treat it as a comment)', () => {
    const [line] = lyricLines('[F#m]ciao # tutto, D# e C#');
    expect(line.text).toBe('ciao # tutto, D# e C#');
    expect(line.words[0].segments[0].chord).toBe('F#m');
  });

  it('reads old-notation lines with sharps', () => {
    const sheet = parseChordPro('A B C#- ..A');
    expect((sheet.sections[0].lines[0] as ChordsLine).items).toEqual([
      { chord: 'A' },
      { chord: 'B' },
      { chord: 'C#m' },
      { chord: 'A' },
    ]);
  });

  it('keeps a second-key group on a chord line (song 069)', () => {
    const line = parseChordPro('G7 C F#,F#7,B(E)').sections[0].lines[0] as ChordsLine;
    expect(line.items.map((i) => ('chord' in i ? i.chord : i.text))).toEqual(['G7', 'C', 'F#', 'F#7', 'B']);
    expect(line.secondKey).toBe('(E)');
  });

  it('still ignores real ChordPro comment lines and reads {key: F#}', () => {
    const sheet = parseChordPro('{key: F#}\n# nota privata\n[A]la');
    expect(sheet.key).toBe('F#');
    expect(sheet.sections.flatMap((s) => s.lines).length).toBe(1);
  });
});

describe('collapseRepeats', () => {
  const chorus = '{start_of_chorus}\n[G]rit\n{end_of_chorus}';
  const intermezzo = 'Intermezzo musicale: A D E';

  it('shows identical sections in a row once, with a count', () => {
    const sheet = collapseRepeats(parseChordPro(`${intermezzo}\n\n${intermezzo}\n\n[C]uno\n\n${chorus}\n\n${chorus}\n\n${chorus}`));
    expect(sheet.sections.map((s) => [s.type, s.repeat ?? 1])).toEqual([
      ['instrumental', 2],
      ['verse', 1],
      ['chorus', 3],
    ]);
  });

  it('keeps sections that differ or are not next to each other', () => {
    const parsed = parseChordPro(`${chorus}\n\n[C]uno\n\n${chorus}\n\n{start_of_chorus}\n[G]altro\n{end_of_chorus}`);
    expect(collapseRepeats(parsed)).toBe(parsed);
  });

  it('renumbers verses after a repeated one', () => {
    const sheet = collapseRepeats(parseChordPro('[C]uno\n\n[C]uno\n\n[C]due'));
    expect(sheet.sections.map((s) => [s.number, s.repeat ?? 1])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('leaves a copy with personal notes on its own', () => {
    const parsed = parseChordPro(`${chorus}\n\n${chorus}\n\n${chorus}`);
    const noted = parsed.sections[1].lines[0].index;
    const sheet = collapseRepeats(parsed, (line) => line === noted);
    expect(sheet.sections.map((s) => s.repeat ?? 1)).toEqual([1, 2]);
    expect(sheet.sections[1].lines[0].index).toBe(noted);
  });
});

describe.skipIf(!HAS_SONGS)('collapseRepeats on the bundled songs', () => {
  it('shows the verse of "È il Signor" once, ×2', () => {
    const sheet = collapseRepeats(parseChordPro(readFileSync('songs/088 - E il Signor.cho', 'utf8')));
    expect(sheet.sections.map((s) => [s.type, s.number, s.repeat])).toEqual([['verse', 1, 2]]);
  });
});
