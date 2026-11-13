// Turns ChordPro text into our own render model (sections → lines → words →
// segments). chordsheetjs does the parsing; we render the HTML ourselves so
// the styling is fully ours (SPEC §2).
import { ChordLyricsPair, ChordProParser, Comment, Song as CsSong, Tag } from 'chordsheetjs';
import { CHORD_SPACE_DIRECTIVES, ChordSpace, chordGaps } from './chord-gap';

/**
 * `{x_intro}` on the line before a line: that line is part of the intro.
 * ChordPro tells other apps to ignore "x_" directives, so the song stays
 * portable, and being in the song text the mark is always shared with it.
 */
export const INTRO_DIRECTIVE = 'x_intro';
import { ChordTextItem, parseChordLine, tokenizeChordText } from './chord-text';
import { REPEAT_DIRECTIVE, REPEAT_LINE_DIRECTIVE, noteTimes, readTimes, reminderTimes, upgradeRepeatSpans } from './repeat-marks';
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
  /**
   * Note on the right, written as a trailing "( … )" group without its
   * brackets: chords ("Am Em Am Em", the old second key) or a lowercase note
   * ("poi pace, poi amore", "due volte"). See `readSideNote`.
   */
  sideNote: string | null;
  /** `{x_gap}` / `{x_glue}` written before the line (see chord-gap.ts). */
  space?: ChordSpace;
  /** No chords, but keeps the chord row's space (see chord-gap.ts). */
  chordGap?: boolean;
  /** Part of the intro: `{x_intro}` written before the line (see intro-mark.ts). */
  intro?: boolean;
  /** Repeated line: `{x_repeat_line: N}` before it (see repeat-marks.ts). */
  times?: number;
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
  sideNote?: string | null;
  /** Part of the intro (`{x_intro}` before the line). */
  intro?: boolean;
  /** Repeated line (`{x_repeat_line: N}` before it). */
  times?: number;
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
  /**
   * The section is played this many times in a row (shown "×2"): written in
   * the song (`{x_repeat: 2}`, or an old "x2" note at its end), or counted by
   * collapseRepeats() from copies one after the other.
   */
  repeat?: number;
  /** "Tutto da capo" / "Da capo" written at the end of the section (see `attachDaCapo`). */
  daCapo?: string;
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

const SIDE_NOTE_RE = /\s*\(([^()]+)\)\s*$/;

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
  // Old "x2/ … /x2" spans become line marks first (see repeat-marks.ts).
  const song: CsSong = new ChordProParser().parse(protect(upgradeRepeatSpans(source)));
  const sections: SheetSection[] = [];
  let current: SheetSection | null = null;
  /** Kind of the {start_of_…} block we are in; null outside blocks. */
  let block: SectionKind | null = null;
  /** Kind for the next section opened outside blocks (set by a label line). */
  let pending: SectionKind | null = null;
  let lineIndex = 0;
  /** `{x_gap}` / `{x_glue}` waiting for the lyric line it belongs to. */
  let space: ChordSpace | null = null;
  /** `{x_intro}` waiting for the line it marks. */
  let intro = false;
  /** `{x_repeat_line: N}` waiting for the line it marks. */
  let lineTimes: number | null = null;
  /** `{x_repeat: N}` written before the section it belongs to was opened. */
  let sectionTimes: number | null = null;

  const close = () => {
    if (current && current.lines.length > 0) sections.push(current);
    current = null;
  };
  const open = (): SheetSection => {
    if (!current) {
      const kind = block ?? pending ?? { type: 'verse', role: null, label: null };
      current = { index: sections.length, number: null, lines: [], ...kind };
      if (sectionTimes) current.repeat = sectionTimes;
      pending = null;
      sectionTimes = null;
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
        } else if (item.name in CHORD_SPACE_DIRECTIVES) {
          space = CHORD_SPACE_DIRECTIVES[item.name];
        } else if (item.name === INTRO_DIRECTIVE) {
          intro = true;
        } else if (item.name === REPEAT_LINE_DIRECTIVE) {
          lineTimes = readTimes(restore(item.value ?? ''));
        } else if (item.name === REPEAT_DIRECTIVE) {
          const times = readTimes(restore(item.value ?? ''));
          // Inside a part already started it's that part's, otherwise the next one's.
          // (`as`: TypeScript can't see that close()/open() change `current`.)
          const started = current as SheetSection | null;
          if (started && started.lines.length > 0) started.repeat = times ?? undefined;
          else sectionTimes = times;
        } else if (BLOCK_ENDS.has(item.name)) {
          close();
          block = null;
        } else if (COMMENT_TAGS.has(item.name) && item.value) {
          const text = restore(item.value);
          const repeat = block ? null : CHORUS_REPEAT_RE.exec(text);
          if (repeat) {
            close();
            pending = { type: 'chorusRepeat', role: null, label: null };
            // "Ritornello: BENEDICI… x2" → the reminder ×2.
            const counted = reminderTimes(repeat[1]);
            if (counted) sectionTimes = counted.times;
            const rest = counted?.text ?? repeat[1];
            if (rest) comment(rest);
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
        // "x2/ Ritornello: DO A TE… /x2" (the span became a line mark) → the reminder ×2.
        if (isReminder && lineTimes) sectionTimes = lineTimes;
        lineTimes = null;
        intro = false;
        if (rest) {
          headingRest(rest);
          close();
        } else {
          open();
        }
        continue;
      }
      if (lyricLine) {
        if (space && lyricLine.kind === 'lyrics') lyricLine.space = space;
        if (intro) lyricLine.intro = true;
        if (lineTimes) lyricLine.times = lineTimes;
        space = null;
        intro = false;
        lineTimes = null;
        open().lines.push(lyricLine);
        lineIndex++;
        continue;
      }
    }
    if (line.items.length === 0) close(); // blank line = end of paragraph
  }
  close();
  attachRepeatNotes(sections);
  attachDaCapo(sections);
  classifySections(sections);
  for (const section of sections) markChordGaps(section);

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

/** Sets `chordGap` on the lyric lines of a section (rule in chord-gap.ts). */
function markChordGaps(section: SheetSection): void {
  const gaps = chordGaps(
    section.lines.map((line) =>
      line.kind === 'lyrics'
        ? { lyrics: true, chorded: line.hasChords, blank: line.text === '', space: line.space }
        : { lyrics: false, chorded: false, blank: false },
    ),
  );
  section.lines.forEach((line, i) => {
    if (line.kind === 'lyrics' && gaps[i]?.on) line.chordGap = true;
  });
}

const isSung = (line: SheetLine) => line.kind === 'lyrics' && line.text !== '';
const isMusic = (line: SheetLine) => line.kind === 'lyrics' || line.kind === 'chords';

/** "(tutto da capo)", "…tutto da capo", "Da capo." — the whole line, any brackets/dots. */
const DA_CAPO_RE = /^[\s(.…—–-]*((?:tutto\s+)?da\s+capo)[\s).…!]*$/i;

function daCapoText(line: SheetLine): string | null {
  const text =
    line.kind === 'comment' ? line.text : line.kind === 'lyrics' && !line.hasChords ? line.text : null;
  const match = text === null ? null : DA_CAPO_RE.exec(text);
  if (!match) return null;
  const words = match[1].replace(/\s+/g, ' ').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
}

/**
 * An old "x2" note ending a part means the whole part twice (Benji: only at the
 * very end — in the middle of a part it stays a note, too unclear). Written as
 * its own paragraph right after a part it belongs to that part. Like the
 * "da capo" mark, line and section indexes are kept, so personal notes stay
 * anchored.
 */
function attachRepeatNotes(sections: SheetSection[]): void {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const last = section.lines[section.lines.length - 1];
    const times = last?.kind === 'comment' ? noteTimes(last.text) : null;
    if (!times) continue;
    const previous = sections[i - 1];
    if (section.lines.length === 1) {
      // Only the note: it's about the part before (if there is one to repeat).
      if (previous) {
        previous.repeat = times;
        sections.splice(i--, 1);
      }
      continue;
    }
    section.lines = section.lines.slice(0, -1);
    section.repeat = times;
  }
}

/**
 * "(tutto da capo)" is an instruction, not something to sing: it leaves the
 * lyrics and becomes the section's `daCapo` mark (shown at its bottom right).
 * Written on its own after a section (its own paragraph or {start_of_chorus}
 * block, as in song 48) it belongs to the section before. "(da capo)" at the
 * end of a line — a note on the right — becomes the mark too. Section
 * indexes are kept as they were, so personal notes stay anchored.
 */
function attachDaCapo(sections: SheetSection[]): void {
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    section.lines = section.lines.filter((line) => {
      const text = daCapoText(line);
      if (text) {
        section.daCapo = text;
        return false;
      }
      if (line.kind === 'lyrics' && line.sideNote && DA_CAPO_RE.test(line.sideNote)) {
        section.daCapo = daCapoText({ kind: 'comment', index: line.index, text: line.sideNote })!;
        line.sideNote = null;
      }
      return true;
    });
    const previous = sections[i - 1];
    if (section.lines.length === 0 && section.daCapo && previous) {
      previous.daCapo = section.daCapo;
      sections.splice(i--, 1);
    }
  }
}

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
  let sideNote: string | null = null;
  const match = SIDE_NOTE_RE.exec(fullText);
  // Position of "(" itself: a chord just before it ("REM[G] (tutti)") is not inside.
  if (match && isSideNote(match[1], segments, fullText.length - match[0].trimStart().length)) {
    sideNote = match[1].trim();
    segments = trimEnd(segments, match[0].length);
  }

  const hasChords = segments.some((s) => s.chord !== null);
  const text = segments.map((s) => s.lyric).join('').trim();
  if (!hasChords && text === '' && !sideNote) return null;
  if (!hasChords) {
    const items = parseChordLine(text);
    if (items) return { kind: 'chords', index, items, sideNote };
  }
  return { kind: 'lyrics', index, words: groupWords(segments), hasChords, text, sideNote };
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

/**
 * Which trailing "( … )" groups go to the right of the line:
 * - only chords: "(Am Em Am Em)" (the old second key, kept as it was);
 * - text with lowercase letters and no chord inside: "(poi pace, poi amore)",
 *   "(due volte)", "(donne)".
 * Sung echoes stay in the lyrics: the songbook writes them in capitals
 * ("GLORIA A DIO (GLORIA A DIO)") or repeating the words just before
 * ("SE CREDERAI… (se crederai)"). So does a group with a chord over it, and a
 * line that is only a text group ("(solo donne)").
 */
function isSideNote(content: string, segments: Segment[], open: number): boolean {
  if (isChordGroup(content)) return true;
  if (!/\p{Ll}/u.test(content)) return false;
  let at = 0;
  for (const segment of segments) {
    if (segment.chord && at > open) return false; // a chord inside the brackets
    at += segment.lyric.length;
  }
  const before = segments.map((s) => s.lyric).join('').slice(0, open);
  if (!/\S/.test(before) && !segments.some((s) => s.chord)) return false;
  const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const echo = words(content);
  return !(echo && words(before).endsWith(echo));
}

/** True when a side note is chords only (transposed, hidden in "Solo testo"). */
export function isChordNote(note: string | null | undefined): boolean {
  return !!note && isChordGroup(note);
}

function isChordGroup(content: string): boolean {
  const tokens = content.trim().split(/[\s,-]+/).filter(Boolean);
  // Strict check (chord-text.ts): "GLORIA" is not G + "LORIA", so a sung
  // echo "(GLORIA A DIO)" is never taken for chords.
  return tokens.length > 0 && tokens.every((t) => isStrictChord(t));
}

function isStrictChord(token: string): boolean {
  const items = tokenizeChordText(token);
  return items?.length === 1 && 'chord' in items[0] && parseChord(token) !== null;
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
              sideNote: line.sideNote && mapSideNote(line.sideNote, mapChord),
            };
          case 'lyrics':
            return {
              ...line,
              sideNote: mapSideNote(line.sideNote, mapChord),
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
 * "Am Em Am Em" → the same group with every chord mapped, keeping the
 * spaces/commas between them. The old second key moves together with the
 * song: transposing +2 turns its Am into Bm, just like the main chords.
 * A text note stays as written ("E" in "donne e uomini" is not a chord).
 */
export function mapSideNote(group: string | null, mapChord: (chord: string) => string): string | null {
  if (!group || !isChordGroup(group)) return group;
  return group.replace(/[^\s,()-]+/g, (token) => (parseChord(token) ? mapChord(token) : token));
}

/**
 * "Solo testo" (for singers): the same song without any chord. Chord-only
 * lines and the second key go, lyric lines lose their chords, and sections
 * left with nothing to sing (Intro, Intermezzo, chord-only parts) disappear.
 * Line indexes stay the same, so personal notes still find their lines.
 */
export function lyricsOnlySheet(sheet: Sheet): Sheet {
  const sections: SheetSection[] = [];
  for (const section of sheet.sections) {
    if (section.type === 'instrumental') continue;
    const lines: SheetLine[] = [];
    for (const line of section.lines) {
      if (line.kind === 'chords') continue;
      if (line.kind === 'comment') {
        lines.push(line);
        continue;
      }
      if (!line.text) continue; // only chords on this line
      lines.push({
        ...line,
        hasChords: false,
        sideNote: isChordNote(line.sideNote) ? null : line.sideNote,
        words: line.words.map((word) => ({ segments: word.segments.map((s) => (s.chord ? { ...s, chord: null } : s)) })),
      });
    }
    // A reminder like "Ritornello (ripeti)" has no lines of its own: keep it.
    if (lines.some((l) => l.kind === 'lyrics') || section.type === 'chorusRepeat') sections.push({ ...section, lines });
  }
  return { ...sheet, sections };
}

/**
 * What makes two sections "the same part played again". The intro mark is left
 * out: marking the intro in one copy must not split a "×2" in two (the merged
 * section shows the mark when any copy has it).
 */
export function sectionKey(section: SheetSection): string {
  const lines = section.lines.map(({ index: _index, ...line }) => ({ ...line, intro: undefined })); // undefined: left out by JSON
  return JSON.stringify([section.type, section.label, section.role, section.daCapo ?? null, lines]);
}

/** `kept` with each line also marked as intro where `copy`'s line is. */
function withIntroOf(kept: SheetSection, copy: SheetSection): SheetSection {
  if (!copy.lines.some((l) => l.kind !== 'comment' && l.intro)) return kept;
  return {
    ...kept,
    lines: kept.lines.map((line, i) => {
      const other = copy.lines[i];
      return line.kind !== 'comment' && !line.intro && other?.kind !== 'comment' && other?.intro ? { ...line, intro: true } : line;
    }),
  };
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
      sections[sections.length - 1] = { ...withIntroOf(previous, section), repeat: (previous.repeat ?? 1) + (section.repeat ?? 1) };
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
