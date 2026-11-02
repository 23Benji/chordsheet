// Single-song .cho export "with my notes": the personal layer is written into
// the ChordPro text as {comment: …} lines (and {start_of_tab} blocks for tabs),
// each right after the line it belongs to. Highlights have no text form.
import { resolveAll } from './anchoring';
import { SheetLine, parseChordPro } from './chordpro';
import { Annotation, SongIntro } from './models';
import { normalize } from './search';

export interface ExportLabels {
  note: string; // "Nota"
  personalChord: (personal: string, original: string) => string;
  memo: string; // "Promemoria"
  intro: string;
  part: string;
  chords: string;
  rhythm: string;
  unlinked: string; // heading for notes whose line wasn't found
}

const DIRECTIVE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const HEADER = new Set(['title', 't', 'subtitle', 'st', 'meta', 'key', 'capo', 'tempo', 'artist', 'composer']);
const COMMENT = new Set(['comment', 'c', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight']);

const clean = (text: string) => text.replace(/[{}]/g, '').replace(/\s*\n\s*/g, ' / ');
const comment = (text: string) => `{comment: ${clean(text)}}`;

interface SourceLine {
  kind: 'blank' | 'comment' | 'directive' | 'lyrics';
  /** Text without chords (or the comment's value), normalised. */
  plain: string;
  hasChords: boolean;
}

function classify(line: string): SourceLine {
  if (!line.trim()) return { kind: 'blank', plain: '', hasChords: false };
  const d = DIRECTIVE.exec(line);
  if (d) return { kind: COMMENT.has(d[1].toLowerCase()) ? 'comment' : 'directive', plain: normalize(d[2] ?? ''), hasChords: false };
  if (/^\s*#/.test(line)) return { kind: 'directive', plain: '', hasChords: false };
  return { kind: 'lyrics', plain: normalize(line.replace(/\[[^\]]*\]/g, '')), hasChords: /\[[^\]]*\]/.test(line) };
}

function matches(sheetLine: SheetLine, src: SourceLine): boolean {
  if (src.kind === 'blank' || src.kind === 'directive') return false;
  switch (sheetLine.kind) {
    case 'lyrics': {
      const key = normalize(sheetLine.text);
      if (!key) return src.kind === 'lyrics' && src.hasChords && src.plain === '';
      return src.kind === 'lyrics' && src.plain.startsWith(key);
    }
    case 'chords':
      return src.kind === 'lyrics' && src.plain !== '';
    case 'comment':
      return src.plain.includes(normalize(sheetLine.text));
  }
}

/**
 * Maps every sheet line to its source line. The parser keeps the source
 * order, so a forward-only search finds each line after the previous one.
 */
function mapLines(source: string[], sheetLines: SheetLine[]): Map<number, number> {
  const classified = source.map(classify);
  const map = new Map<number, number>();
  let from = 0;
  for (const line of sheetLines) {
    for (let j = from; j < Math.min(source.length, from + 40); j++) {
      if (matches(line, classified[j])) {
        map.set(line.index, j);
        from = j + 1;
        break;
      }
    }
  }
  return map;
}

function annotationLines(a: Annotation, line: SheetLine | undefined, labels: ExportLabels): string[] {
  switch (a.type) {
    case 'note':
      return [comment(`${labels.note}: ${a.text}`)];
    case 'chord': {
      const chords = line?.kind === 'lyrics' ? line.words.flatMap((w) => w.segments).flatMap((s) => (s.chord ? [s.chord] : [])) : [];
      return [comment(labels.personalChord(a.text, chords[a.chordIndex ?? 0] ?? ''))];
    }
    case 'tab':
      return [a.title ? `{start_of_tab: ${clean(a.title)}}` : '{start_of_tab}', ...a.text.split('\n'), '{end_of_tab}'];
    case 'highlight':
      return [];
  }
}

export function chordproWithNotes(
  source: string,
  annotations: readonly Annotation[],
  extras: { memo?: string; intro?: SongIntro },
  labels: ExportLabels,
): string {
  const lines = source.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const sheet = parseChordPro(source);
  const sheetLines = sheet.sections.flatMap((s) => s.lines).sort((a, b) => a.index - b.index);
  const byIndex = new Map(sheetLines.map((l) => [l.index, l]));
  const resolved = resolveAll(annotations, sheet);
  const lineMap = mapLines(lines, sheetLines);

  const after = new Map<number, string[]>();
  const unlinked: string[] = [];
  for (const [lineIndex, list] of resolved.byLine) {
    const out = list.flatMap((a) => annotationLines(a, byIndex.get(lineIndex), labels));
    const target = lineMap.get(lineIndex);
    if (target === undefined) unlinked.push(...out);
    else after.set(target, [...(after.get(target) ?? []), ...out]);
  }
  unlinked.push(...resolved.orphans.flatMap((a) => annotationLines(a, undefined, labels)));

  // Promemoria and Intro go right after the header directives.
  const top: string[] = [];
  if (extras.memo?.trim()) top.push(...extras.memo.trim().split('\n').map((l, i) => comment(i === 0 ? `${labels.memo}: ${l}` : l)));
  const intro = extras.intro;
  if (intro) {
    const parts = [
      intro.part && `${labels.part}: ${intro.part}`,
      intro.chords && `${labels.chords}: ${intro.chords}`,
      intro.rhythm && `${labels.rhythm}: ${intro.rhythm}`,
      intro.note,
    ].filter(Boolean);
    if (parts.length) top.push(comment(`${labels.intro} — ${parts.join(' · ')}`));
  }
  let headerEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const d = DIRECTIVE.exec(lines[i]);
    if (d && HEADER.has(d[1].toLowerCase())) headerEnd = i;
    else if (lines[i].trim()) break;
  }

  const out: string[] = [];
  if (headerEnd === -1) out.push(...top);
  lines.forEach((line, i) => {
    out.push(line, ...(after.get(i) ?? []));
    if (i === headerEnd) out.push(...top);
  });
  if (unlinked.length) out.push('', comment(labels.unlinked), ...unlinked);
  return out.join('\n') + '\n';
}
