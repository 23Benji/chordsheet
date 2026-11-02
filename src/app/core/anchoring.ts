// Personal notes are attached to a line of a song through a LineAnchor
// (SPEC §4.1). When the song text changes, every anchor is searched again:
//   1. same text (hash) and same occurrence  — e.g. the 2nd "IO LODO TE"
//   2. same text, the occurrence nearest to where it was
//   3. similar text (normalised Levenshtein ≥ 0.8) — the line was edited
//   4. otherwise the note is "da ricollegare" (orphaned). Never deleted.
import { Sheet, SheetLine } from './chordpro';
import { Annotation, LineAnchor } from './models';
import { normalize } from './search';

const SNIPPET_LENGTH = 40;
const FUZZY_THRESHOLD = 0.8;

interface AnchorLine {
  sectionIndex: number;
  lineIndex: number;
  text: string; // normalised
  hash: string;
}

/** Text that identifies a line: lyrics, a note, or the chords of a chord line. */
function lineText(line: SheetLine): string {
  switch (line.kind) {
    case 'lyrics':
      return line.text;
    case 'comment':
      return line.text;
    case 'chords':
      return line.items.map((i) => ('chord' in i ? i.chord : i.text)).join(' ');
  }
}

/** FNV-1a 32-bit: a tiny, fast, stable string hash. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function anchorLines(sheet: Sheet): AnchorLine[] {
  return sheet.sections.flatMap((section) =>
    section.lines.map((line) => {
      const text = normalize(lineText(line));
      return { sectionIndex: section.index, lineIndex: line.index, text, hash: hashText(text) };
    }),
  );
}

/** The anchor for line `lineIndex` of `sheet`. */
export function anchorFor(sheet: Sheet, lineIndex: number): LineAnchor {
  const lines = anchorLines(sheet);
  const line = lines.find((l) => l.lineIndex === lineIndex);
  if (!line) throw new Error(`No line ${lineIndex}`);
  return {
    sectionIndex: line.sectionIndex,
    lineIndex,
    textHash: line.hash,
    snippet: line.text.slice(0, SNIPPET_LENGTH),
    occurrence: lines.filter((l) => l.hash === line.hash && l.lineIndex < lineIndex).length,
  };
}

/** Edit distance (insertions, deletions, substitutions) between two strings. */
export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** 1 = identical, 0 = completely different. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

/** Index of the line the anchor points to in `sheet`, or null if it can't be found. */
export function resolveAnchor(anchor: LineAnchor, sheet: Sheet): number | null {
  const lines = anchorLines(sheet);
  const sameText = lines.filter((l) => l.hash === anchor.textHash);
  if (sameText[anchor.occurrence]) return sameText[anchor.occurrence].lineIndex;
  if (sameText.length > 0) {
    return sameText.reduce((best, l) =>
      Math.abs(l.lineIndex - anchor.lineIndex) < Math.abs(best.lineIndex - anchor.lineIndex) ? l : best,
    ).lineIndex;
  }
  let best: { lineIndex: number; score: number } | null = null;
  for (const line of lines) {
    const score = similarity(anchor.snippet, line.text.slice(0, SNIPPET_LENGTH));
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) best = { lineIndex: line.lineIndex, score };
  }
  return best?.lineIndex ?? null;
}

/**
 * After the song text changed: points every annotation at its line in the
 * new sheet (with a fresh anchor), or marks it orphaned. Orphaned ones keep
 * their old anchor so a later edit can still find them.
 */
export function reanchorAll(annotations: readonly Annotation[], sheet: Sheet, now = Date.now()): Annotation[] {
  return annotations.map((a) => {
    const lineIndex = resolveAnchor(a.anchor, sheet);
    if (lineIndex === null) return a.orphaned ? a : { ...a, orphaned: true, updatedAt: now };
    const anchor = anchorFor(sheet, lineIndex);
    const unchanged = !a.orphaned && JSON.stringify(anchor) === JSON.stringify(a.anchor);
    return unchanged ? a : { ...a, anchor, orphaned: false, updatedAt: now };
  });
}

export interface ResolvedAnnotations {
  byLine: Map<number, Annotation[]>;
  orphans: Annotation[];
}

/** Groups a song's annotations by the line they belong to in `sheet`. */
export function resolveAll(annotations: readonly Annotation[], sheet: Sheet): ResolvedAnnotations {
  const byLine = new Map<number, Annotation[]>();
  const orphans: Annotation[] = [];
  for (const a of annotations) {
    const lineIndex = a.orphaned ? null : resolveAnchor(a.anchor, sheet);
    if (lineIndex === null) orphans.push(a);
    else byLine.set(lineIndex, [...(byLine.get(lineIndex) ?? []), a]);
  }
  return { byLine, orphans };
}
