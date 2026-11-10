import { readdirSync, readFileSync } from 'node:fs';
import { parseChordPro, Sheet } from './chordpro';
import { HAS_SONGS } from '../../testing/bundled-songs';
import {
  EditorLyricsLine,
  EditorSong,
  addChord,
  chordPalette,
  convertOldChordLine,
  duplicateSection,
  layoutChips,
  lyricsToChordPro,
  mergeLines,
  moveChord,
  insertCopy,
  insertSection,
  moveLineTo,
  newSection,
  moveSection,
  moveSectionTo,
  newSongTemplate,
  parseEditorSong,
  parseLyricsLine,
  removeChord,
  serializeEditorSong,
  setLineText,
  splitLine,
  transposeSong,
  updateChord,
} from './editor-model';

const chordsOf = (line: EditorLyricsLine) => line.chords.map((c) => [c.chord, c.pos]);
const lyrics = (song: EditorSong, s: number, l: number) => song.sections[s].lines[l] as EditorLyricsLine;

/** What the song view shows, without ids/indexes: used to compare round trips. */
function rendered(sheet: Sheet) {
  return {
    title: sheet.title,
    key: sheet.key,
    tempo: sheet.tempo,
    capo: sheet.capo,
    sections: sheet.sections.map((s) => ({
      type: s.type,
      role: s.role,
      number: s.number,
      label: s.label,
      lines: s.lines.map((l) =>
        l.kind === 'lyrics'
          ? { text: l.text, second: l.sideNote, segs: l.words.flatMap((w) => w.segments) }
          : l.kind === 'chords'
            ? { chords: l.items, second: l.sideNote }
            : { comment: l.text },
      ),
    })),
  };
}

describe('editor model: parse and serialise', () => {
  it('splits lyric lines into text and chord positions', () => {
    const line = parseLyricsLine('[G]Dio è [D]grande, SI[Bm]GNOR [A]');
    expect(line.text).toBe('Dio è grande, SIGNOR ');
    expect(chordsOf(line)).toEqual([
      ['G', 0],
      ['D', 6],
      ['Bm', 16],
      ['A', 21],
    ]);
    expect(lyricsToChordPro(line)).toBe('[G]Dio è [D]grande, SI[Bm]GNOR [A]');
  });

  it('keeps chords-only lines exactly', () => {
    expect(lyricsToChordPro(parseLyricsLine('[Bm] [G] [D] [A]'))).toBe('[Bm] [G] [D] [A]');
    expect(lyricsToChordPro(parseLyricsLine('[Bm][G][D][A]Chi sarà'))).toBe('[Bm][G][D][A]Chi sarà');
  });

  it('reads meta, sections with kinds/labels, notes and raw lines', () => {
    const song = parseEditorSong(
      '{title: Dio è grande}\n{meta: numero 142}\n{subtitle: x}\n{key: Bm}\n\n[Bm]uno\n{comment: x2}\n\n' +
        '{start_of_chorus}\n[G]rit\n{end_of_chorus}\n\n{start_of_part: Intermezzo musicale: Assolo}\n[A] [D]\n{end_of_part}\n' +
        '{start_of_bridge: Special}\n[C]b\n{end_of_bridge}\n{new_page}',
    );
    expect(song.meta).toEqual({ title: 'Dio è grande', number: '142', key: 'Bm', tempo: '', capo: '' });
    expect(song.extraHeader).toEqual(['{subtitle: x}']);
    expect(song.sections.map((s) => [s.kind, s.label])).toEqual([
      ['auto', ''],
      ['chorus', ''],
      ['interlude', 'Assolo'],
      ['bridge', 'Special'],
      ['auto', ''],
    ]);
    expect(song.sections[0].lines.map((l) => l.kind)).toEqual(['lyrics', 'comment']);
    expect(song.sections[4].lines[0]).toMatchObject({ kind: 'raw', text: '{new_page}' });
  });

  it('writes kinds back as ChordPro directives the song view understands', () => {
    const song = parseEditorSong('[C]a\n\n[C]b\n\n[C]c\n\n[C]d\n\n[C]e');
    const kinds = ['auto', 'chorus', 'bridge', 'intro', 'outro'] as const;
    song.sections.forEach((s, i) => (s.kind = kinds[i]));
    song.sections[0].label = 'Strofa finale';
    const sheet = parseChordPro(serializeEditorSong(song));
    expect(sheet.sections.map((s) => [s.type, s.role, s.label])).toEqual([
      ['verse', null, 'Strofa finale'],
      ['chorus', null, null],
      ['bridge', null, null],
      ['instrumental', 'intro', null],
      ['instrumental', 'outro', null],
    ]);
  });

  describe.skipIf(!HAS_SONGS)('round trip on every bundled song', () => {
    const files = HAS_SONGS ? readdirSync('songs').filter((f) => f.endsWith('.cho')) : [];
    it.each(files)('%s renders the same after parse → serialise', (file) => {
      const source = readFileSync(`songs/${file}`, 'utf8');
      const again = serializeEditorSong(parseEditorSong(source));
      expect(rendered(parseChordPro(again))).toEqual(rendered(parseChordPro(source)));
      // Serialising is stable: a second pass changes nothing.
      expect(serializeEditorSong(parseEditorSong(again))).toBe(again);
    });
  });
});

describe('editor model: editing lines', () => {
  const line = () => parseLyricsLine('[C]QUANDO GUARDO LA TUA SANTI[F]TÀ');

  it('chords follow their syllable when text is inserted or deleted before them', () => {
    // "OH " typed before QUANDO: the C stays on QUANDO, the F on TÀ.
    expect(chordsOf(setLineText(line(), 'OH QUANDO GUARDO LA TUA SANTITÀ'))).toEqual([
      ['C', 3],
      ['F', 29],
    ]);
    expect(chordsOf(setLineText(line(), 'QUANDO LA TUA SANTITÀ'))).toEqual([
      ['C', 0],
      ['F', 19],
    ]);
  });

  it('typing at a chord position pushes the chord along with its syllable', () => {
    const edited = setLineText(parseLyricsLine('SI[Bm]GNOR'), 'SIXGNOR');
    expect(chordsOf(edited)).toEqual([['Bm', 3]]);
  });

  it('a chord inside deleted text moves to the edit point', () => {
    const edited = setLineText(parseLyricsLine('ab[G]cdef'), 'abf');
    expect(chordsOf(edited)).toEqual([['G', 2]]);
  });

  it('turns typed brackets into parentheses', () => {
    expect(setLineText(line(), '[x]').text).toBe('(x)');
  });

  it('adds, changes, moves and removes chords', () => {
    let l = addChord(line(), 7, 'Am');
    const id = l.chords[2].id;
    l = updateChord(l, id, ' Am7 ');
    l = moveChord(l, id, 9.6);
    expect(chordsOf(l)).toContainEqual(['Am7', 10]);
    l = removeChord(l, id);
    expect(l.chords.length).toBe(2);
  });

  it('splits and merges lines keeping chords on their syllables', () => {
    const [a, b] = splitLine(line(), 14); // "QUANDO GUARDO " | "LA TUA SANTITÀ"
    expect([a.text, b.text]).toEqual(['QUANDO GUARDO ', 'LA TUA SANTITÀ']);
    expect(chordsOf(a)).toEqual([['C', 0]]);
    expect(chordsOf(b)).toEqual([['F', 12]]);
    expect(lyricsToChordPro(mergeLines(a, b))).toBe('[C]QUANDO GUARDO LA TUA SANTI[F]TÀ');
  });

  it('keeps a trailing chord on the first line when splitting at the end', () => {
    const [a, b] = splitLine(parseLyricsLine('TE, [Am]'), 4);
    expect(chordsOf(a)).toEqual([['Am', 4]]);
    expect(b.chords).toEqual([]);
  });

  it('lays out overlapping chords side by side', () => {
    const chips = layoutChips(parseLyricsLine('[Bm][G][D]Chi').chords);
    expect(chips.map((c) => c.left)).toEqual([0, 3, 5]);
  });
});

describe('editor model: old notation, sections, song-wide', () => {
  it('spreads an old-notation chord line over the lyric line below', () => {
    const song = parseEditorSong('F#- D A-E\nSI APRONO I CIELI SI ASCOLTA UN SUONO');
    const section = convertOldChordLine(song.sections[0], 0);
    expect(section.lines.length).toBe(1);
    const l = section.lines[0] as EditorLyricsLine;
    expect(l.text).toBe('SI APRONO I CIELI SI ASCOLTA UN SUONO');
    expect(l.chords.map((c) => c.chord)).toEqual(['F#m', 'D', 'A', 'E']);
    // Every chord lands on a word start, in order.
    const positions = l.chords.map((c) => c.pos);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    positions.forEach((p) => expect(p === 0 || l.text[p - 1] === ' ').toBe(true));
  });

  it('converts a standalone old-notation line into a chords-only line', () => {
    const song = parseEditorSong('B- G D A — D');
    const section = convertOldChordLine(song.sections[0], 0);
    // Chords keep their columns from the original line.
    expect(lyricsToChordPro(section.lines[0] as EditorLyricsLine)).toBe('[Bm]   [G]  [D]  [A]    [D]');
  });

  it('moves and duplicates sections', () => {
    const song = parseEditorSong('[C]a\n\n[C]b');
    const moved = moveSection(song, song.sections[1].id, -1);
    expect(moved.sections.map((s) => (s.lines[0] as EditorLyricsLine).text)).toEqual(['b', 'a']);
    const dup = duplicateSection(song, song.sections[0].id);
    expect(dup.sections.length).toBe(3);
    expect(dup.sections[1].id).not.toBe(dup.sections[0].id);
    expect(serializeEditorSong(dup)).toBe('[C]a\n\n[C]a\n\n[C]b\n');
  });

  it('keeps the chord gap markers on their line', () => {
    const src = '[G]uno\n{x_glue}\ndue\n{x_gap}\ntre\n';
    const song = parseEditorSong(src);
    const lines = song.sections[0].lines as EditorLyricsLine[];
    expect(lines.map((l) => [l.text, l.space])).toEqual([['uno', undefined], ['due', 'glue'], ['tre', 'gap']]);
    expect(serializeEditorSong(song)).toBe(src);
    // a chord added later: the marker is no longer written
    const chorded = { ...song, sections: [{ ...song.sections[0], lines: [lines[0], { ...lines[1], chords: [{ id: 'c', pos: 0, chord: 'D' }] }] }] };
    expect(serializeEditorSong(chorded)).toBe('[G]uno\n[D]due\n');
  });

  it('drags sections and lines to a new place', () => {
    const song = parseEditorSong('a\n\nb\n\nc');
    const text = (x: typeof song) => x.sections.map((s) => (s.lines[0] as EditorLyricsLine).text);
    expect(text(moveSectionTo(song, song.sections[0].id, 2))).toEqual(['b', 'c', 'a']);
    expect(text(moveSectionTo(song, song.sections[2].id, 0))).toEqual(['c', 'a', 'b']);
    expect(moveSectionTo(song, song.sections[1].id, 1)).toBe(song); // dropped where it was
    expect(moveSection(song, song.sections[0].id, -1)).toBe(song); // already first

    const section = parseEditorSong('uno\ndue\ntre').sections[0];
    const lines = (s: typeof section) => s.lines.map((l) => (l as EditorLyricsLine).text);
    expect(lines(moveLineTo(section, section.lines[2].id, 0))).toEqual(['tre', 'uno', 'due']);
    expect(moveLineTo(section, section.lines[0].id, 5)).toBe(section);
  });

  it('inserts a section or a copy of one at a given place', () => {
    const song = parseEditorSong('a\n\n{start_of_chorus}\n[G]rit\n{end_of_chorus}\n\nb');
    const kinds = (x: typeof song) => x.sections.map((s) => s.kind);
    const withBridge = insertSection(song, 1, newSection('bridge'));
    expect(kinds(withBridge)).toEqual(['auto', 'bridge', 'chorus', 'auto']);
    expect(kinds(insertSection(song, 99, newSection('outro'))).at(-1)).toBe('outro');

    const copied = insertCopy(song, song.sections[1].id, 3);
    expect(kinds(copied)).toEqual(['auto', 'chorus', 'auto', 'chorus']);
    expect(copied.sections[3].id).not.toBe(song.sections[1].id);
    expect(lyricsToChordPro(copied.sections[3].lines[0] as EditorLyricsLine)).toBe('[G]rit');
    expect(insertCopy(song, 'missing', 0)).toBe(song);
  });

  it('transposes permanently, spelling for the new key', () => {
    const song = transposeSong(parseEditorSong('{key: C}\n[C]a [F]b [G7]c [D/F#]d'), 5);
    expect(song.meta.key).toBe('F');
    expect(chordsOf(lyrics(song, 0, 0)).map((c) => c[0])).toEqual(['F', 'Bb', 'C7', 'G/B']);
  });

  it('builds the chord palette by frequency', () => {
    expect(chordPalette(parseEditorSong('[G]a [D]b [G]c\n[Em]d [G]e'))).toEqual(['G', 'D', 'Em']);
  });

  it('new song template has a verse and a chorus', () => {
    expect(newSongTemplate().sections.map((s) => s.kind)).toEqual(['auto', 'chorus']);
  });

  it('keeps the intro mark ({x_intro}) on its line, ahead of a chord gap', () => {
    const source = '{start_of_chorus}\n[A]SIGNORE NOI\n{x_intro}\nPER[D]CHÉ SOLTANTO TU\n{x_intro}\n{x_gap}\nREGNI IN TERRA\n{end_of_chorus}\n';
    const song = parseEditorSong(source);
    const lines = song.sections[0].lines.map((l) => (l.kind === 'lyrics' ? [l.text, !!l.intro, l.space ?? null] : null));
    expect(lines).toEqual([
      ['SIGNORE NOI', false, null],
      ['PERCHÉ SOLTANTO TU', true, null],
      ['REGNI IN TERRA', true, 'gap'],
    ]);
    expect(serializeEditorSong(song)).toBe(source);
  });
});
