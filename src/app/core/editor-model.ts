// The visual editor works on this model instead of the raw ChordPro text:
// a song is a list of sections, each a list of lines; a lyric line is plain
// text plus chords at character positions ("[G]Dio è [D]grande" → text
// "Dio è grande", chords G@0, D@6). Every editing operation is a pure
// function returning a new object — easy to test, and new references are
// what Angular signals need to notice a change.
import { chordLinePositions } from './chord-text';
import { keyOf, keyUsesFlats, transposeChord, transposeKey } from './transpose';

export type EditorKind = 'auto' | 'chorus' | 'bridge' | 'intro' | 'interlude' | 'outro';

export interface EditorChord {
  id: string;
  pos: number; // character index in the lyric text the chord sits on
  chord: string;
}

export interface EditorLyricsLine {
  id: string;
  kind: 'lyrics';
  text: string;
  chords: EditorChord[];
}

/** `{comment: …}`: performance notes like "x2", "basso". */
export interface EditorNoteLine {
  id: string;
  kind: 'comment';
  text: string;
}

/** Any other directive or `# comment`: kept exactly as written, read-only. */
export interface EditorRawLine {
  id: string;
  kind: 'raw';
  text: string;
}

export type EditorLine = EditorLyricsLine | EditorNoteLine | EditorRawLine;

export interface EditorSection {
  id: string;
  /** 'auto' = no explicit kind: the song view labels it (Strofa N, Intro …). */
  kind: EditorKind;
  /** Free label ("Strofa finale", "Assolo"); '' = default name. */
  label: string;
  lines: EditorLine[];
}

export interface EditorMeta {
  title: string;
  number: string; // "123c", '' when none
  key: string;
  tempo: string;
  capo: string;
}

export interface EditorSong {
  meta: EditorMeta;
  /** Other header directives ({subtitle}, other {meta}), kept as written. */
  extraHeader: string[];
  sections: EditorSection[];
}

let counter = 0;
/** Ids only need to be unique while the editor is open (used by @for tracking). */
export const newId = (): string => `e${++counter}`;

// ── Parsing ────────────────────────────────────────────────────────────────

const DIRECTIVE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const HEADER = new Set([
  'title', 't', 'subtitle', 'st', 'meta', 'key', 'capo', 'tempo',
  'artist', 'composer', 'lyricist', 'album', 'year', 'copyright', 'time', 'duration',
]);
const COMMENT = new Set(['comment', 'c', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight']);
const STARTS: Record<string, 'chorus' | 'bridge' | 'verse' | 'part'> = {
  start_of_chorus: 'chorus', soc: 'chorus',
  start_of_bridge: 'bridge', sob: 'bridge',
  start_of_verse: 'verse', sov: 'verse',
  start_of_part: 'part', sop: 'part',
};
const ENDS = new Set([
  'end_of_chorus', 'eoc', 'end_of_bridge', 'eob', 'end_of_verse', 'eov', 'end_of_part', 'eop',
]);

/** Same words the song view recognises in section labels (see chordpro.ts). */
const PART_WORD =
  /^(intro|intermezzo(?:\s+musicale)?|strumentale|finale|outro|bridge|special|ritornello|rit)\b\.?\s*[:\-–—]?\s*(.*)$/i;

/** Names written into {start_of_part: …}; the song view maps them back. */
const PART_NAMES: Record<'intro' | 'interlude' | 'outro', string> = {
  intro: 'Intro',
  interlude: 'Intermezzo musicale',
  outro: 'Finale',
};

function partKind(label: string): { kind: EditorKind; label: string } {
  const match = PART_WORD.exec(label);
  if (!match) return { kind: 'auto', label };
  const word = match[1].toLowerCase();
  const rest = match[2];
  if (word === 'intro') return { kind: 'intro', label: rest };
  if (word === 'finale' || word === 'outro') return { kind: 'outro', label: rest };
  if (word === 'bridge') return { kind: 'bridge', label: rest };
  if (word === 'special') return { kind: 'bridge', label: rest || 'Special' };
  if (word === 'rit' || word === 'ritornello') return { kind: 'chorus', label: rest };
  return { kind: 'interlude', label: rest };
}

/** `{sov label="Special"}` and `{start_of_verse: Special}` both give "Special". */
function directiveLabel(value: string | undefined): string {
  if (!value) return '';
  return /^label\s*=\s*"(.*)"$/.exec(value)?.[1] ?? value;
}

export function parseLyricsLine(source: string): EditorLyricsLine {
  let text = '';
  const chords: EditorChord[] = [];
  let last = 0;
  for (const match of source.matchAll(/\[([^\]]*)\]/g)) {
    text += source.slice(last, match.index);
    last = match.index + match[0].length;
    if (match[1].trim()) chords.push({ id: newId(), pos: text.length, chord: match[1].trim() });
  }
  text += source.slice(last);
  return { id: newId(), kind: 'lyrics', text, chords };
}

export function parseEditorSong(source: string): EditorSong {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const meta: EditorMeta = { title: '', number: '', key: '', tempo: '', capo: '' };
  const extraHeader: string[] = [];

  let i = 0;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const d = DIRECTIVE.exec(lines[i]);
    if (!d || !HEADER.has(d[1].toLowerCase())) break;
    const name = d[1].toLowerCase();
    const value = d[2] ?? '';
    const numero = name === 'meta' ? /^numero\s+(.*)$/i.exec(value) : null;
    if (name === 'title' || name === 't') meta.title = value;
    else if (numero) meta.number = numero[1].trim();
    else if (name === 'key' || name === 'capo' || name === 'tempo') meta[name] = value;
    else extraHeader.push(lines[i].trim());
  }

  const sections: EditorSection[] = [];
  let current: EditorSection | null = null;
  let block: { kind: EditorKind; label: string } | null = null;

  const close = () => {
    if (current && current.lines.length > 0) sections.push(current);
    current = null;
  };
  const open = (): EditorSection => {
    if (!current) {
      current = { id: newId(), kind: block?.kind ?? 'auto', label: block?.label ?? '', lines: [] };
      // A label belongs to the first paragraph of its block only.
      if (block) block = { ...block, label: '' };
    }
    return current;
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      close();
      continue;
    }
    const d = DIRECTIVE.exec(line);
    const name = d?.[1].toLowerCase() ?? '';
    if (d && name in STARTS) {
      close();
      const label = directiveLabel(d[2]);
      const start = STARTS[name];
      block =
        start === 'part'
          ? partKind(label)
          : { kind: start === 'verse' ? 'auto' : start, label };
    } else if (d && ENDS.has(name)) {
      close();
      block = null;
    } else if (d && COMMENT.has(name)) {
      open().lines.push({ id: newId(), kind: 'comment', text: d[2] ?? '' });
    } else if (d || /^\s*#/.test(line)) {
      open().lines.push({ id: newId(), kind: 'raw', text: line });
    } else {
      open().lines.push(parseLyricsLine(line));
    }
  }
  close();
  return { meta, extraHeader, sections };
}

// ── Serialising ────────────────────────────────────────────────────────────

/** Text + chords → "[G]Dio è [D]grande". Pads with spaces for chords past the end. */
export function lyricsToChordPro(line: Pick<EditorLyricsLine, 'text' | 'chords'>): string {
  const sorted = [...line.chords].sort((a, b) => a.pos - b.pos);
  const end = Math.max(line.text.length, ...sorted.map((c) => c.pos));
  let out = line.text.padEnd(end);
  // Insert from the right so earlier positions stay valid; for equal
  // positions the later chord goes in first, keeping the original order.
  for (const c of sorted.reverse()) {
    const pos = Math.max(0, c.pos);
    out = `${out.slice(0, pos)}[${c.chord}]${out.slice(pos)}`;
  }
  return out;
}

function sectionWrapper(section: EditorSection): [string, string] | null {
  const label = section.label.trim();
  switch (section.kind) {
    case 'auto':
      return label ? [`{start_of_verse: ${label}}`, '{end_of_verse}'] : null;
    case 'chorus':
      return [label ? `{start_of_chorus: ${label}}` : '{start_of_chorus}', '{end_of_chorus}'];
    case 'bridge':
      return [label ? `{start_of_bridge: ${label}}` : '{start_of_bridge}', '{end_of_bridge}'];
    default: {
      const name = PART_NAMES[section.kind];
      return [`{start_of_part: ${label ? `${name}: ${label}` : name}}`, '{end_of_part}'];
    }
  }
}

function lineToChordPro(line: EditorLine): string {
  switch (line.kind) {
    case 'lyrics':
      return lyricsToChordPro(line);
    case 'comment':
      return `{comment: ${line.text}}`;
    case 'raw':
      return line.text;
  }
}

export function serializeEditorSong(song: EditorSong): string {
  const { meta } = song;
  const header: string[] = [];
  if (meta.title.trim()) header.push(`{title: ${meta.title.trim()}}`);
  if (meta.number.trim()) header.push(`{meta: numero ${meta.number.trim()}}`);
  header.push(...song.extraHeader);
  for (const name of ['key', 'capo', 'tempo'] as const) {
    if (meta[name].trim()) header.push(`{${name}: ${meta[name].trim()}}`);
  }

  const blocks = song.sections
    .filter((s) => s.lines.length > 0)
    .map((section) => {
      const body = section.lines.map(lineToChordPro);
      const wrapper = sectionWrapper(section);
      return (wrapper ? [wrapper[0], ...body, wrapper[1]] : body).join('\n');
    });

  return [header.join('\n'), ...blocks].filter((b) => b !== '').join('\n\n') + '\n';
}

// ── Line operations ────────────────────────────────────────────────────────

/** "[" "]" in lyrics would become chords, "}" would close a directive. */
const cleanLyric = (text: string) => text.replace(/\[/g, '(').replace(/\]/g, ')');
export const cleanNote = (text: string) => text.replace(/[{}]/g, '');
export const cleanChord = (text: string) => text.replace(/[[\]{}\s]/g, '');

/**
 * New lyric text typed by the user. Chords keep following their syllable:
 * chords before the edit stay, chords after it shift by the length change,
 * chords inside deleted text move to where the edit happened.
 */
export function setLineText(line: EditorLyricsLine, raw: string): EditorLyricsLine {
  const text = cleanLyric(raw);
  const old = line.text;
  let start = 0;
  while (start < old.length && start < text.length && old[start] === text[start]) start++;
  let endOld = old.length;
  let endNew = text.length;
  while (endOld > start && endNew > start && old[endOld - 1] === text[endNew - 1]) {
    endOld--;
    endNew--;
  }
  const delta = endNew - endOld;
  const chords = line.chords.map((c) => {
    if (c.pos < start) return c;
    if (c.pos >= endOld) return { ...c, pos: c.pos + delta };
    return { ...c, pos: start };
  });
  return { ...line, text, chords };
}

export function addChord(line: EditorLyricsLine, pos: number, chord: string): EditorLyricsLine {
  return {
    ...line,
    chords: [...line.chords, { id: newId(), pos: Math.max(0, pos), chord: cleanChord(chord) }],
  };
}

export function updateChord(line: EditorLyricsLine, id: string, chord: string): EditorLyricsLine {
  return { ...line, chords: line.chords.map((c) => (c.id === id ? { ...c, chord: cleanChord(chord) } : c)) };
}

export function moveChord(line: EditorLyricsLine, id: string, pos: number): EditorLyricsLine {
  const max = line.text.length + 40;
  const clamped = Math.min(Math.max(0, Math.round(pos)), max);
  return { ...line, chords: line.chords.map((c) => (c.id === id ? { ...c, pos: clamped } : c)) };
}

export function removeChord(line: EditorLyricsLine, id: string): EditorLyricsLine {
  return { ...line, chords: line.chords.filter((c) => c.id !== id) };
}

/** Enter at `at`: chords from there on go to the new line (a trailing chord stays). */
export function splitLine(line: EditorLyricsLine, at: number): [EditorLyricsLine, EditorLyricsLine] {
  const atEnd = at >= line.text.length;
  const stays = (c: EditorChord) => c.pos < at || (atEnd && c.pos === at);
  return [
    { ...line, text: line.text.slice(0, at), chords: line.chords.filter(stays) },
    {
      id: newId(),
      kind: 'lyrics',
      text: line.text.slice(at),
      chords: line.chords.filter((c) => !stays(c)).map((c) => ({ ...c, pos: c.pos - at })),
    },
  ];
}

/** Backspace at the start of `second`: append it to `first`. */
export function mergeLines(first: EditorLyricsLine, second: EditorLyricsLine): EditorLyricsLine {
  const offset = first.text.length;
  return {
    ...first,
    text: first.text + second.text,
    chords: [...first.chords, ...second.chords.map((c) => ({ ...c, pos: c.pos + offset }))],
  };
}

export const emptyLyrics = (): EditorLyricsLine => ({ id: newId(), kind: 'lyrics', text: '', chords: [] });
export const emptyNote = (): EditorNoteLine => ({ id: newId(), kind: 'comment', text: '' });

export interface ChordChip extends EditorChord {
  /** Where to draw it, in `ch` units: never on top of the previous chord. */
  left: number;
}

/** Chords at the same or close positions ("[Bm][G][D]") are drawn side by side. */
export function layoutChips(chords: readonly EditorChord[]): ChordChip[] {
  const sorted = [...chords].sort((a, b) => a.pos - b.pos);
  let nextFree = 0;
  return sorted.map((c) => {
    const left = Math.max(c.pos, nextFree);
    nextFree = left + c.chord.length + 1;
    return { ...c, left };
  });
}

// ── Old-notation chord lines ───────────────────────────────────────────────

/** A lyric line without [chords] that is only plain-text chords ("B- G D A"). */
export function isOldChordLine(line: EditorLine): boolean {
  return line.kind === 'lyrics' && line.chords.length === 0 && chordLinePositions(line.text) !== null;
}

function wordStarts(text: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ' && (i === 0 || text[i - 1] === ' ')) starts.push(i);
  }
  return starts;
}

/**
 * Converts the plain-text chord line at `index` into real chords. If a lyric
 * line without chords follows, the chords are spread over its words
 * (proportionally to their place in the chord line — positions in the old
 * notation are rough, the user then drags them where they belong) and the
 * chord line disappears. Otherwise the line becomes a chords-only line.
 */
export function convertOldChordLine(section: EditorSection, index: number): EditorSection {
  const line = section.lines[index];
  if (!isOldChordLine(line)) return section;
  const found = chordLinePositions((line as EditorLyricsLine).text)!;
  const next = section.lines[index + 1];
  const lines = [...section.lines];

  if (next && next.kind === 'lyrics' && next.chords.length === 0 && next.text.trim() && !isOldChordLine(next)) {
    const starts = wordStarts(next.text);
    const width = Math.max(1, (line as EditorLyricsLine).text.trimEnd().length);
    let previous = 0;
    const chords = found.map(({ chord, at }) => {
      const target = (at / width) * next.text.length;
      const nearest = starts.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), 0);
      previous = Math.max(previous, nearest);
      return { id: newId(), pos: previous, chord };
    });
    lines.splice(index, 2, { ...next, chords });
  } else {
    lines[index] = { ...(line as EditorLyricsLine), text: '', chords: found.map(({ chord, at }) => ({ id: newId(), pos: at, chord })) };
  }
  return { ...section, lines };
}

// ── Song-wide operations ───────────────────────────────────────────────────

export function mapLyricsLines(song: EditorSong, fn: (line: EditorLyricsLine) => EditorLyricsLine): EditorSong {
  return {
    ...song,
    sections: song.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.kind === 'lyrics' ? fn(l) : l)),
    })),
  };
}

/** Chords used in the song, most frequent first: the palette for adding chords. */
export function chordPalette(song: EditorSong): string[] {
  const counts = new Map<string, number>();
  for (const s of song.sections) {
    for (const l of s.lines) {
      if (l.kind === 'lyrics') for (const c of l.chords) counts.set(c.chord, (counts.get(c.chord) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([chord]) => chord);
}

/** First chord of the song, for the key placeholder ("rilevata: Bm"). */
export function detectedKey(song: EditorSong): string | null {
  for (const s of song.sections) {
    for (const l of s.lines) {
      if (l.kind === 'lyrics' && l.chords.length) return keyOf(l.chords.slice().sort((a, b) => a.pos - b.pos)[0].chord);
    }
  }
  return null;
}

/** Rewrites every chord (and {key}) `semitones` up or down, spelled for the new key. */
export function transposeSong(song: EditorSong, semitones: number): EditorSong {
  const from = song.meta.key || detectedKey(song);
  const to = from ? transposeKey(from, semitones) : null;
  const flats = keyUsesFlats(to);
  const moved = mapLyricsLines(song, (line) => ({
    ...line,
    chords: line.chords.map((c) => ({ ...c, chord: transposeChord(c.chord, semitones, flats) })),
  }));
  return song.meta.key && to ? { ...moved, meta: { ...moved.meta, key: to } } : moved;
}

export function updateSection(song: EditorSong, id: string, fn: (s: EditorSection) => EditorSection): EditorSong {
  return { ...song, sections: song.sections.map((s) => (s.id === id ? fn(s) : s)) };
}

/** The list with the item at `from` moved to `to`; the same list when either is out of range or they match. */
function moveTo<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

/** ↑ / ↓ on a section's handle: one place up (-1) or down (+1). */
export function moveSection(song: EditorSong, id: string, delta: number): EditorSong {
  const from = song.sections.findIndex((s) => s.id === id);
  return moveSectionTo(song, id, from + delta);
}

/** Drag & drop: the section ends up at position `to`. */
export function moveSectionTo(song: EditorSong, id: string, to: number): EditorSong {
  const sections = moveTo(song.sections, song.sections.findIndex((s) => s.id === id), to);
  return sections === song.sections ? song : { ...song, sections: [...sections] };
}

/** A line dragged (or moved with ↑ / ↓) to position `to` inside its section. */
export function moveLineTo(section: EditorSection, id: string, to: number): EditorSection {
  const lines = moveTo(section.lines, section.lines.findIndex((l) => l.id === id), to);
  return lines === section.lines ? section : { ...section, lines: [...lines] };
}

/** A copy with fresh ids (e.g. to repeat a chorus). */
function cloneSection(section: EditorSection): EditorSection {
  return {
    ...section,
    id: newId(),
    lines: section.lines.map((l) =>
      l.kind === 'lyrics'
        ? { ...l, id: newId(), chords: l.chords.map((c) => ({ ...c, id: newId() })) }
        : { ...l, id: newId() },
    ),
  };
}

export function duplicateSection(song: EditorSong, id: string): EditorSong {
  const index = song.sections.findIndex((s) => s.id === id);
  if (index < 0) return song;
  const sections = [...song.sections];
  sections.splice(index + 1, 0, cloneSection(song.sections[index]));
  return { ...song, sections };
}

export function removeSection(song: EditorSong, id: string): EditorSong {
  return { ...song, sections: song.sections.filter((s) => s.id !== id) };
}

export function newSection(kind: EditorKind): EditorSection {
  return { id: newId(), kind, label: '', lines: [emptyLyrics()] };
}

/** Puts a section at position `index` (0 = first; past the end = last). */
export function insertSection(song: EditorSong, index: number, section: EditorSection): EditorSong {
  const sections = [...song.sections];
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, section);
  return { ...song, sections };
}

/** "Copia del ritornello": a full copy (fresh ids) of section `sourceId` at position `index`. */
export function insertCopy(song: EditorSong, sourceId: string, index: number): EditorSong {
  const source = song.sections.find((s) => s.id === sourceId);
  return source ? insertSection(song, index, cloneSection(source)) : song;
}

/** Template for "Nuovo canto": a verse and a chorus, each with one empty line. */
export function newSongTemplate(): EditorSong {
  return {
    meta: { title: '', number: '', key: '', tempo: '', capo: '' },
    extraHeader: [],
    sections: [newSection('auto'), newSection('chorus')],
  };
}
