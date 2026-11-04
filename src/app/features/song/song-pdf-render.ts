import { Sheet } from '../../core/chordpro';
import { FontRole, PdfOptions, fonts, layoutSongPdf, pdfSafe } from '../../core/song-pdf';

/**
 * Draws the song as an A4 PDF with jsPDF and returns it as a file.
 * This module is only ever loaded with `import()` (when the iPhone/iPad
 * home-screen app prints), so jsPDF never weighs on the app's start-up.
 */
export async function songPdfFile(sheet: Sheet, options: PdfOptions, fileName: string): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: options.title, creator: 'Chordsheet' });
  const spec = fonts(options.mode);

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

  const layout = layoutSongPdf(sheet, options, measure);
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
