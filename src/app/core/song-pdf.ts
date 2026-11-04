// Song sheet → PDF page layout (A4, mm). Pure: it only needs a `measure`
// function for text widths, so it can be unit-tested without a PDF library.
// The drawing itself (jsPDF, loaded on demand) is in song-pdf-render.ts.
//
// Used where the browser can't print: the iPhone/iPad home-screen app. The
// look follows the print stylesheet (.print-sheet in styles.scss): title,
// info line, rule; sections kept whole; chorus/bridge indented with a rule.

import { Sheet, SheetLine, SheetSection, Word } from './chordpro';

export type PdfMode = 'chords' | 'lyrics';
export type FontRole = 'title' | 'meta' | 'tag' | 'lyric' | 'chord' | 'comment' | 'muted' | 'footer';

export interface FontSpec {
  family: 'helvetica' | 'times';
  style: 'normal' | 'bold' | 'italic';
  /** Size in pt. */
  size: number;
  /** Grey level 0 (black) … 255. */
  gray: number;
}

export interface PdfText {
  kind: 'text';
  page: number;
  x: number;
  /** Baseline. */
  y: number;
  text: string;
  font: FontRole;
  /** Extra space between letters (mm), for the spaced-out section tags. */
  charSpace?: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfLine {
  kind: 'line';
  page: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stroke width in mm. */
  width: number;
}

export type PdfOp = PdfText | PdfLine;

export interface PdfLayout {
  pages: number;
  ops: PdfOp[];
}

/** Width of `text` in mm, set in the font of `role`. */
export type Measure = (text: string, role: FontRole) => number;

export interface PdfOptions {
  mode: PdfMode;
  title: string;
  /** "N. 4", "Tonalità C", "Capo 2" … (already filtered for the mode). */
  meta: string[];
  /** "Strofa 1", "Ritornello" … or null. */
  label: (section: SheetSection) => string | null;
  /** "(ripeti)" after a chorus reminder. */
  repeat: string;
}

/** A4 portrait, same margins as the print stylesheet. */
export const PAGE = { width: 210, height: 297, left: 18, right: 18, top: 18, bottom: 20 } as const;

const PT = 25.4 / 72; // 1 pt in mm

export function fonts(mode: PdfMode): Record<FontRole, FontSpec> {
  const lyric = mode === 'lyrics' ? 13.5 : 12.5;
  return {
    title: { family: 'times', style: 'bold', size: 22, gray: 0 },
    meta: { family: 'helvetica', style: 'normal', size: 10, gray: 70 },
    tag: { family: 'helvetica', style: 'bold', size: 8, gray: 90 },
    lyric: { family: 'helvetica', style: 'normal', size: lyric, gray: 0 },
    chord: { family: 'helvetica', style: 'bold', size: lyric * 0.8, gray: 0 },
    comment: { family: 'helvetica', style: 'italic', size: lyric * 0.85, gray: 70 },
    muted: { family: 'helvetica', style: 'normal', size: lyric * 0.75, gray: 90 },
    footer: { family: 'helvetica', style: 'normal', size: 9, gray: 120 },
  };
}

/** One visual row of a section: its height and what to draw (relative to its top). */
interface Row {
  height: number;
  draw: (top: number, page: number, out: PdfOp[]) => void;
}

const INDENT = 5; // chorus / bridge indent (mm)
const SECTION_GAP = 6;

export function layoutSongPdf(sheet: Sheet, options: PdfOptions, measure: Measure): PdfLayout {
  const f = fonts(options.mode);
  const lh = (role: FontRole, factor: number) => f[role].size * PT * factor;
  const lyricLH = lh('lyric', options.mode === 'lyrics' ? 1.45 : 1.3);
  const chordLH = lh('chord', 1.15);
  const contentWidth = PAGE.width - PAGE.left - PAGE.right;
  const bottom = PAGE.height - PAGE.bottom;
  const ops: PdfOp[] = [];
  let page = 1;
  let y = PAGE.top;

  // ── Header: title, info line, rule ──────────────────────────────────────
  y += lh('title', 0.9);
  ops.push({ kind: 'text', page, x: PAGE.left, y, text: options.title, font: 'title' });
  if (options.meta.length) {
    y += lh('meta', 1.6);
    ops.push({ kind: 'text', page, x: PAGE.left, y, text: options.meta.join('     '), font: 'meta' });
  }
  y += 3;
  ops.push({ kind: 'line', page, x1: PAGE.left, y1: y, x2: PAGE.width - PAGE.right, y2: y, width: 0.26 });
  y += 7;

  // ── Sections ────────────────────────────────────────────────────────────
  for (const section of sheet.sections) {
    if (options.mode === 'lyrics' && section.type === 'instrumental') continue;
    const indented = section.type === 'chorus' || section.type === 'bridge';
    const left = PAGE.left + (indented ? INDENT : 0);
    const width = contentWidth - (indented ? INDENT : 0);
    const rows: Row[] = [];

    const name = options.label(section);
    if (name) {
      const tag = name.toUpperCase();
      const extra = section.type === 'chorusRepeat' ? ` ${options.repeat}` : '';
      rows.push({
        height: lh('tag', 1.9),
        draw: (top, p, out) => {
          const base = top + lh('tag', 1.1);
          out.push({ kind: 'text', page: p, x: left, y: base, text: tag, font: 'tag', charSpace: 0.35 });
          if (extra) {
            const tagWidth = measure(tag, 'tag') + tag.length * 0.35;
            out.push({ kind: 'text', page: p, x: left + tagWidth + 1.5, y: base, text: extra.trim(), font: 'comment' });
          }
        },
      });
    }

    for (const line of section.lines) rows.push(...lineRows(line, left, width));
    if (!rows.length || (name && rows.length === 1)) continue; // nothing left to show in this mode

    // Keep the section on one page when it fits on one; otherwise break between rows.
    const height = rows.reduce((sum, r) => sum + r.height, 0);
    const pageHeight = bottom - PAGE.top;
    if (y + height > bottom && height <= pageHeight) {
      page++;
      y = PAGE.top;
    }
    let ruleTop = y;
    const rule = (from: number, to: number, p: number) => {
      if (indented) ops.push({ kind: 'line', page: p, x1: PAGE.left, y1: from, x2: PAGE.left, y2: to, width: 0.35 });
    };
    for (const row of rows) {
      if (y + row.height > bottom) {
        rule(ruleTop, y, page);
        page++;
        y = PAGE.top;
        ruleTop = y;
      }
      row.draw(y, page, ops);
      y += row.height;
    }
    rule(ruleTop, y, page);
    y += SECTION_GAP;
  }

  // ── Page numbers ("1 / 2") when there's more than one page ──────────────
  if (page > 1) {
    for (let p = 1; p <= page; p++) {
      ops.push({ kind: 'text', page: p, x: PAGE.width / 2, y: PAGE.height - 10, text: `${p} / ${page}`, font: 'footer', align: 'center' });
    }
  }
  return { pages: page, ops };

  // ── Rows of one line (wrapped to the width) ─────────────────────────────

  function lineRows(line: SheetLine, left: number, width: number): Row[] {
    if (line.kind === 'comment') return textRows(line.text, 'comment', left, width, lh('comment', 1.35));
    if (line.kind === 'chords') {
      if (options.mode === 'lyrics') return [];
      return [chordItemsRow(line.items, line.secondKey ?? null, left, width)];
    }
    if (options.mode === 'lyrics') {
      const words = line.words.map((w) => w.segments.map((s) => s.lyric).join(''));
      if (!words.join('').trim()) return []; // a row of chords only
      return wrapWords(words, (w) => measure(w, 'lyric'), width).map((group) => ({
        height: lyricLH,
        draw: (top, p, out) => {
          out.push({ kind: 'text', page: p, x: left, y: top + lyricLH * 0.75, text: group.join('').trimEnd(), font: 'lyric' });
        },
      }));
    }
    return chordLyricRows(line.words, line.hasChords, line.secondKey, left, width);
  }

  /** Chords above lyrics: each segment is as wide as the wider of its chord and syllable. */
  function chordLyricRows(words: Word[], hasChords: boolean, secondKey: string | null, left: number, width: number): Row[] {
    const pad = f.lyric.size * PT * 0.3; // space after a chord (0.3em, as on screen)
    const advance = (lyric: string, chord: string | null) =>
      Math.max(measure(lyric, 'lyric'), chord ? measure(chord, 'chord') + pad : 0);
    const wordWidth = (w: Word) => w.segments.reduce((sum, s) => sum + advance(s.lyric, s.chord), 0);
    const keyWidth = secondKey ? measure(secondKey, 'muted') + 4 : 0;
    const groups = wrapWords(words, wordWidth, width - keyWidth);
    const height = (hasChords ? chordLH : 0) + lyricLH;
    return groups.map((group, i) => ({
      height,
      draw: (top, p, out) => {
        const chordBase = top + chordLH * 0.8;
        const lyricBase = top + (hasChords ? chordLH : 0) + lyricLH * 0.75;
        // Lyrics go out as continuous runs, split only where a chord wider than
        // its syllable leaves a gap: a viewer with slightly different font
        // metrics can then never swallow the spaces between words, and copied
        // text comes out as whole words.
        let x = left;
        let run = '';
        let runX = left;
        const flush = () => {
          if (run.trim()) out.push({ kind: 'text', page: p, x: runX, y: lyricBase, text: run, font: 'lyric' });
          run = '';
        };
        for (const word of group) {
          for (const seg of word.segments) {
            if (seg.chord) out.push({ kind: 'text', page: p, x, y: chordBase, text: seg.chord, font: 'chord' });
            if (run && Math.abs(runX + measure(run, 'lyric') - x) > 0.01) flush();
            if (!run) runX = x;
            run += seg.lyric;
            x += advance(seg.lyric, seg.chord);
          }
        }
        flush();
        if (secondKey && i === groups.length - 1) {
          out.push({ kind: 'text', page: p, x: left + width, y: lyricBase, text: secondKey, font: 'muted', align: 'right' });
        }
      },
    }));
  }

  /** "B- G D A": chords written as text, in one row. */
  function chordItemsRow(items: { chord?: string; text?: string }[], secondKey: string | null, left: number, width: number): Row {
    const gap = f.lyric.size * PT * 0.9;
    const height = chordLH + 1.5;
    return {
      height,
      draw: (top, p, out) => {
        const base = top + chordLH * 0.85;
        let x = left;
        for (const item of items) {
          const isChord = 'chord' in item && item.chord;
          const text = (isChord ? item.chord : item.text) ?? '';
          const role: FontRole = isChord ? 'chord' : 'comment';
          if (x + measure(text, role) > left + width) break; // never draw past the margin
          out.push({ kind: 'text', page: p, x, y: base, text, font: role });
          x += measure(text, role) + gap;
        }
        if (secondKey) out.push({ kind: 'text', page: p, x: left + width, y: base, text: secondKey, font: 'muted', align: 'right' });
      },
    };
  }

  /** Plain text (comments) wrapped at spaces. */
  function textRows(text: string, role: FontRole, left: number, width: number, height: number): Row[] {
    const words = text.split(/(?<= )/);
    return wrapWords(words, (w) => measure(w, role), width).map((group) => ({
      height,
      draw: (top, p, out) => {
        out.push({ kind: 'text', page: p, x: left, y: top + height * 0.75, text: group.join('').trimEnd(), font: role });
      },
    }));
  }
}

/**
 * Greedy line breaking: as many items per row as fit in `width` (an item
 * wider than the row gets a row of its own). Never returns an empty list.
 */
export function wrapWords<T>(items: readonly T[], width: (item: T) => number, max: number): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const item of items) {
    const w = width(item);
    if (row.length && used + w > max) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(item);
    used += w;
  }
  rows.push(row);
  return rows;
}

/**
 * The PDF standard fonts only have Latin-1 (+ a few) characters: map what we
 * can (♯ ♭, typographic quotes are fine) and drop the rest instead of
 * printing garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .normalize('NFC')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[^ -~ -ÿ‘’“”–—…•€]/g, '');
}
