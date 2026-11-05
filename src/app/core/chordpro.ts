// Turns ChordPro text into our own render model (sections → lines → words →
// segments). chordsheetjs does the parsing; we render the HTML ourselves so
// the styling is fully ours (SPEC §2).
import { ChordLyricsPair, ChordProParser, Comment, Song as CsSong, Tag } from 'chordsheetjs';
import { ChordTextItem, parseChordLine, tokenizeChordText } from './chord-text';
import { parseChord } from './transpose';

/** One chord with the lyric under it. `chord` is null when there is none. */
export interface Segment {
  chord: string | null;
  lyric: string;
}

/**
 * Segments that must stay on the same row when a long line wraps
 * (e.g. "SI" + "[Bm]GNOR" form one word: a chord never leaves its syllable).
 */
export interface Word {
  segments: Segment[];
}

export interface LyricLine {
  kind: 'lyrics';
  index: number; // flattened line index within the song
  words: Word[];
  hasChords: boolean;
  /** Lyric text without chords (used for search and annotation anchoring). */
  text: string;
  /** Trailing "(Am Em Am Em)" group = chords in the second key (SPEC §3). */
  secondKey: string | null;
}

export interface CommentLine {
  kind: 'comment';
  index: number;
  text: string;
}

/** A line of chords written as plain text (old notation), e.g. "B- G D A". */
export interface ChordsLine {
  kind: 'chords';
  index: number;
  items: ChordTextItem[];
  secondKey?: string | null;
}

export type SheetLine = LyricLine | CommentLine | ChordsLine;

/**
 * - verse: a normal paragraph ("Strofa 1, 2, 3 …")
 * - chorus: {start_of_chorus} … ("Ritornello")
 * - chorusRepeat: a `{comment: Ritornello: IO CANTERÒ A TE…}` reminder to sing the chorus again
 * - bridge: {start_of_bridge}, or a "Bridge"/"Special" line
 * - instrumental: chords only, or an "Intro" / "Intermezzo" / "Finale" line
 */
export type SectionType = 'verse' | 'chorus' | 'chorusRepeat' | 'bridge' | 'instrumental';
export type InstrumentalRole = 'intro' | 'interlude' | 'outro';

export interface SheetSection {
  index: number;
  type: SectionType;
  /** Label written in the song ({start_of_verse: Strofa 2}); null = automatic label. */
  label: string | null;
  /** 1, 2, 3 … for verses (→ "Strofa 1"); null when the section isn't numbered. */
  number: number | null;
  /** Where an instrumental section sits: before, between or after the sung parts. */
  role: InstrumentalRole | null;
  lines: SheetLine[];
  /** Set by collapseRepeats(): the section is played this many times in a row (shown "×2"). */
  repeat?: number;
}

export interface Sheet {
  title: string | null;
  subtitle: string | null;
  key: string | null;
  capo: number | null;
  tempo: number | null;
  sections: SheetSection[];
}

const COMMENT_TAGS = new Set(['comment', 'comment_italic', 'comment_box', 'highlight']);
// Unicode private-use characters: never in real text.
const BACKSLASH = '\uE000';
const SHARP = '\uE001';
const restore = (text: string): string => text.replaceAll(BACKSLASH, '\\').replaceAll(SHARP, '#');

/**
 * chordsheetjs' grammar treats `\` as an escape character and `#` anywhere in
 * a line as the start of a comment — so "B- F#- G A GRIDANDO…" would lose
 * everything after the "#". Both are swapped for placeholders before parsing
 * and put back in every piece of text we read (see `restore`). Lines that
 * *start* with `#` stay real ChordPro comments.
 */
function protect(source: string): string {
  return source
    .replaceAll('\\', BACKSLASH)
    .split('\n')
    .map((line) => (/^\s*#/.test(line) ? line : line.replaceAll('#', SHARP)))
    .join('\n');
}

const SECOND_KEY_RE = /\s*\(([^()]+)\)\s*$/;

/** `{comment: Ritornello}` / `{comment: Ritornello: IO CANTERÒ A TE…}`. */
const CHORUS_REPEAT_RE = /^ritornello\b\s*:?\s*(.*)$/i;

/**
 * Plain-text section headings found in the converted songs, e.g.
 * "Intro: A, D, A, E", "Intermezzo musicale E- D", "x finale A, D, A2".
 * Only checked on lines without [chords], so sung lyrics are not mistaken for them.
 */
const LABEL_LINE_RE =
  /^\s*(?:x\s+)?(intro|intermezzo(?:\s+musicale)?|strumentale|finale|outro|bridge|special|ritornello|rit)\b\.?\s*[:\-–—]?\s*(.*)$/i;

interface SectionKind {
  type: SectionType;
  role: InstrumentalRole | null;
  label: string | null;
}

function kindFromWord(word: string): SectionKind {
  const w = word.toLowerCase();
  if (w === 'intro') return { type: 'instrumental', role: 'intro', label: null };
  if (w === 'finale' || w === 'outro') return { type: 'instrumental', role: 'outro', label: null };
  if (w === 'bridge') return { type: 'bridge', role: null, label: null };
  if (w === 'special') return { type: 'bridge', role: null, label: 'Special' };
  if (w === 'rit' || w === 'ritornello') return { type: 'chorus', role: null, label: null };
  return { type: 'instrumental', role: 'interlude', label: null }; // intermezzo, strumentale
}

/**
 * {start_of_part: Intro} etc.: recognise known words, otherwise keep the label
 * as is. "Intermezzo musicale: Assolo" (written by the editor) → an intermezzo
 * labelled "Assolo".
 */
function kindFromLabel(label: string | null): SectionKind {
  const match = label ? LABEL_LINE_RE.exec(label) : null;
  if (match) {
    const kind = kindFromWord(match[1]);
    return match[2] ? { ...kind, label: match[2] } : kind;
  }
  return { type: 'verse', role: null, label: label || null };
}

const BLOCK_STARTS: Record<string, SectionType> = {
  start_of_chorus: 'chorus',
  start_of_verse: 'verse',
  start_of_bridge: 'bridge',
};
const BLOCK_ENDS = new Set(['end_of_chorus', 'end_of_verse', 'end_of_bridge', 'end_of_part']);

export function parseChordPro(source: string): Sheet {
  const song: CsSong = new ChordProParser().parse(protect(source));
  const sections: SheetSection[] = [];
  let current: SheetSection | null = null;
  /** Kind of the {start_of_…} block we are in; null outside blocks. */
  let block: SectionKind | null = null;
  /** Kind for the next section opened outside blocks (set by a label line). */
  let pending: SectionKind | null = null;
  let lineIndex = 0;

  const close = () => {
    if (current && current.lines.length > 0) sections.push(current);
    current = null;
  };
  const open = (): SheetSection => {
    if (!current) {
      const kind = block ?? pending ?? { type: 'verse', role: null, label: null };
      current = { index: sections.length, number: null, lines: [], ...kind };
      pending = null;
    }
    return current;
  };
  const comment = (text: string) => open().lines.push({ kind: 'comment', index: lineIndex++, text });
  /** Text after a heading: chords ("Intro: B- G D A") are shown as chords. */
  const headingRest = (text: string) => {
    const items = tokenizeChordText(text, true)!;
    if (items.some((i) => 'chord' in i)) open().lines.push({ kind: 'chords', index: lineIndex++, items });
    else comment(text);
  };

  for (const line of song.lines) {
    const pairs: ChordLyricsPair[] = [];
    for (const item of line.items) {
      if (item instanceof Tag) {
        if (item.name in BLOCK_STARTS) {
          close();
          block = { type: BLOCK_STARTS[item.name], role: null, label: restore(item.label) || null };
        } else if (item.name === 'start_of_part') {
          close();
          block = kindFromLabel(restore(item.label) || null);
        } else if (BLOCK_ENDS.has(item.name)) {
          close();
          block = null;
        } else if (COMMENT_TAGS.has(item.name) && item.value) {
          const text = restore(item.value);
          const repeat = block ? null : CHORUS_REPEAT_RE.exec(text);
          if (repeat) {
            close();
            pending = { type: 'chorusRepeat', role: null, label: null };
            if (repeat[1]) comment(repeat[1]);
            else open();
            sections.push(current!);
            current = null;
          } else {
            comment(text);
          }
        }
      } else if (item instanceof ChordLyricsPair) {
        pairs.push(item);
      } else if (item instanceof Comment) {
        // "# …" source comments are not shown.
      }
    }

    if (pairs.length > 0) {
      const lyricLine = buildLyricLine(pairs, lineIndex);
      const label =
        lyricLine?.kind === 'lyrics' && !lyricLine.hasChords ? LABEL_LINE_RE.exec(lyricLine.text) : null;
      const kind = label ? kindFromWord(label[1]) : null;
      if (label && kind && block?.type === 'chorus' && kind.type === 'chorus') {
        // "Rit:" inside a chorus repeats what the label already says.
        if (label[2]) headingRest(label[2]);
        continue;
      }
      if (label && kind && !block) {
        // "Intro: A, D, A, E" is a whole section on one line; a bare "Bridge"
        // or "Rit:" heading instead opens a section for the lines that follow.
        close();
        const rest = label[2];
        const isReminder = kind.type === 'chorus' && rest !== '' && !parseChordLine(rest);
        pending = isReminder ? { type: 'chorusRepeat', role: null, label: null } : kind;
        if (rest) {
          headingRest(rest);
          close();
        } else {
          open();
        }
        continue;
      }
      if (lyricLine) {
        open().lines.push(lyricLine);
        lineIndex++;
        continue;
      }
    }
    if (line.items.length === 0) close(); // blank line = end of paragraph
  }
  close();
  classifySections(sections);

  const meta = (name: string): string | null => {
    const value = song.getSingleMetadataValue(name);
    return value === null ? null : restore(value);
  };
  const metaNumber = (name: string): number | null => {
    const value = meta(name);
    const n = value === null ? NaN : parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  };

  return {
    title: song.title ? restore(song.title) : null,
    subtitle: song.subtitle ? restore(song.subtitle) : null,
    key: meta('key'),
    capo: metaNumber('capo'),
    tempo: metaNumber('tempo'),
    sections,
  };
}

const isSung = (line: SheetLine) => line.kind === 'lyrics' && line.text !== '';
const isMusic = (line: SheetLine) => line.kind === 'lyrics' || line.kind === 'chords';

/**
 * Fills in what can be derived from the whole song: chord-only paragraphs
 * become instrumental (intro before the first sung part, finale after the
 * last, intermezzo in between) and the remaining verses are numbered.
 */
function classifySections(sections: SheetSection[]): void {
  for (const section of sections) {
    const music = section.lines.filter(isMusic);
    if (section.type === 'verse' && !section.label && music.length > 0 && !music.some(isSung)) {
      section.type = 'instrumental';
    }
  }
  // A "Ritornello" reminder counts as sung: music before it is an intermezzo, not the finale.
  const sung = sections.filter(
    (s) => s.type === 'chorusRepeat' || (s.type !== 'instrumental' && s.lines.some(isSung)),
  );
  const first = sung[0]?.index ?? Infinity;
  const last = sung[sung.length - 1]?.index ?? -Infinity;
  let verse = 0;
  for (const section of sections) {
    if (section.type === 'instrumental' && !section.role) {
      section.role = section.index < first ? 'intro' : section.index > last ? 'outro' : 'interlude';
    } else if (section.type === 'verse' && !section.label && section.lines.some(isSung)) {
      section.number = ++verse;
    }
  }
}

function buildLyricLine(pairs: ChordLyricsPair[], index: number): LyricLine | ChordsLine | null {
  let segments: Segment[] = [];
  for (const pair of pairs) {
    const chord = restore(pair.chords ?? '').trim() || null;
    const pieces = splitWords(restore(pair.lyrics ?? ''));
    if (pieces.length === 0) {
      segments.push({ chord, lyric: '' });
      continue;
    }
    pieces.forEach((lyric, i) => segments.push({ chord: i === 0 ? chord : null, lyric }));
  }

  const fullText = segments.map((s) => s.lyric).join('');
  let secondKey: string | null = null;
  const match = SECOND_KEY_RE.exec(fullText);
  if (match && isChordGroup(match[1])) {
    secondKey = `(${match[1].trim()})`;
    segments = trimEnd(segments, match[0].length);
  }

  const hasChords = segments.some((s) => s.chord !== null);
  const text = segments.map((s) => s.lyric).join('').trim();
  if (!hasChords && text === '' && !secondKey) return null;
  if (!hasChords) {
    const items = parseChordLine(text);
    if (items) return { kind: 'chords', index, items, secondKey };
  }
  return { kind: 'lyrics', index, words: groupWords(segments), hasChords, text, secondKey };
}

/** "LUIA AL SI" → ["LUIA ", "AL ", "SI"] (whitespace stays attached). */
function splitWords(lyric: string): string[] {
  return lyric.match(/\S*\s+|\S+/g) ?? [];
}

function groupWords(segments: Segment[]): Word[] {
  const words: Word[] = [];
  let current: Segment[] = [];
  for (const segment of segments) {
    current.push(segment);
    if (/\s$/.test(segment.lyric)) {
      words.push({ segments: current });
      current = [];
    }
  }
  if (current.length > 0) words.push({ segments: current });
  return words;
}

/** Removes `count` characters from the end of the lyric text. */
function trimEnd(segments: Segment[], count: number): Segment[] {
  const result = segments.map((s) => ({ ...s }));
  let remaining = count;
  for (let i = result.length - 1; i >= 0 && remaining > 0; i--) {
    const take = Math.min(remaining, result[i].lyric.length);
    result[i].lyric = result[i].lyric.slice(0, result[i].lyric.length - take);
    remaining -= take;
  }
  // Drop now-empty segments without a chord at the end.
  while (result.length > 0 && result[result.length - 1].lyric === '' && !result[result.length - 1].chord) {
    result.pop();
  }
  return result;
}

function isChordGroup(content: string): boolean {
  const tokens = content.trim().split(/[\s,-]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => parseChord(t) !== null);
}

/** Returns a copy of the sheet with every chord passed through `mapChord`. */
export function mapSheetChords(sheet: Sheet, mapChord: (chord: string) => string): Sheet {
  return {
    ...sheet,
    sections: sheet.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line): SheetLine => {
        switch (line.kind) {
          case 'comment':
            return line;
          case 'chords':
            return {
              ...line,
              items: line.items.map((i) => ('chord' in i ? { chord: mapChord(i.chord) } : i)),
              secondKey: line.secondKey && mapSecondKey(line.secondKey, mapChord),
            };
          case 'lyrics':
            return {
              ...line,
              secondKey: mapSecondKey(line.secondKey, mapChord),
              words: line.words.map((word) => ({
                segments: word.segments.map((s) => (s.chord ? { ...s, chord: mapChord(s.chord) } : s)),
              })),
            };
        }
      }),
    })),
  };
}

/**
 * "(Am Em Am Em)" → the same group with every chord mapped, keeping the
 * spaces/commas between them. The second key moves together with the song:
 * transposing +2 turns the alternative key's Am into Bm, just like the main
 * chords (SPEC §3: "nice-to-have later: parse and transpose it too").
 */
export function mapSecondKey(group: string | null, mapChord: (chord: string) => string): string | null {
  if (!group) return group;
  return group.replace(/[^\s,()-]+/g, (token) => (parseChord(token) ? mapChord(token) : token));
}

/** What a section looks like on the page, without its line indexes. */
function sectionKey(section: SheetSection): string {
  const lines = section.lines.map(({ index: _index, ...line }) => line);
  return JSON.stringify([section.type, section.label, section.role, lines]);
}

/**
 * Setting "Parti ripetute": identical sections one after the other (same kind,
 * label and lines — e.g. an intermezzo played twice) are shown once with a
 * "×2" count. A copy that carries personal notes (`keep(lineIndex)` true for
 * one of its lines) is left on its own, so no note ever disappears. Verses
 * are renumbered afterwards (Strofa 1 ×2, then Strofa 2).
 */
export function collapseRepeats(sheet: Sheet, keep: (lineIndex: number) => boolean = () => false): Sheet {
  const sections: SheetSection[] = [];
  let lastKey: string | null = null;
  for (const section of sheet.sections) {
    const key = sectionKey(section);
    const previous = sections[sections.length - 1];
    if (previous && key === lastKey && !section.lines.some((l) => keep(l.index))) {
      sections[sections.length - 1] = { ...previous, repeat: (previous.repeat ?? 1) + 1 };
      continue;
    }
    sections.push(section);
    lastKey = key;
  }
  if (sections.length === sheet.sections.length) return sheet;
  let verse = 0;
  return {
    ...sheet,
    sections: sections.map((s) => (s.number === null ? s : { ...s, number: ++verse })),
  };
}
