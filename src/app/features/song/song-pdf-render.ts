import { Sheet } from '../../core/chordpro';
import { BookletCover, FontRole, Measure, PdfLayout, PdfMode, PdfOptions, fonts, layoutBookletPdf, layoutSongPdf, pdfSafe } from '../../core/song-pdf';

/**
 * Draws a song (or a whole setlist) as an A4 PDF with jsPDF and returns it as
 * a file. This module is only ever loaded with `import()`, so jsPDF never
 * weighs on the app's start-up.
 */
export function songPdfFile(sheet: Sheet, options: PdfOptions, fileName: string): Promise<File> {
  return drawPdf(options.mode, options.title, fileName, (measure) => layoutSongPdf(sheet, options, measure));
}

/** A setlist booklet: cover page with the list, then one song after the other. */
export function bookletPdfFile(
  cover: BookletCover,
  songs: readonly { sheet: Sheet; options: PdfOptions }[],
  mode: PdfMode,
  fileName: string,
): Promise<File> {
  return drawPdf(mode, cover.title, fileName, (measure) => layoutBookletPdf(cover, songs, measure));
}

async function drawPdf(mode: PdfMode, title: string, fileName: string, layoutWith: (measure: Measure) => PdfLayout): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title, creator: 'Chordsheet' });
  const spec = fonts(mode);

  const use = (role: FontRole) => {
    const f = spec[role];
    doc.setFont(f.family, f.style);
    doc.setFontSize(f.size);
    doc.setTextColor(f.gray, f.gray, f.gray);
  };
  const measure = (text: string, role: FontRole) => {
    use(role);
    return doc.getTextWidth(pdfSafe(text));
  };

  const layout = layoutWith(measure);
  for (let p = 2; p <= layout.pages; p++) doc.addPage();

  for (const op of layout.ops) {
    doc.setPage(op.page);
    if (op.kind === 'line') {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(op.width);
      doc.line(op.x1, op.y1, op.x2, op.y2);
    } else {
      use(op.font);
      doc.text(pdfSafe(op.text), op.x, op.y, { align: op.align ?? 'left', charSpace: op.charSpace ?? 0 });
    }
  }

  const blob = doc.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
