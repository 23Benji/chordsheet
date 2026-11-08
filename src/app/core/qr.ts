export interface Qr {
  size: number;
  /** One SVG path with a 1×1 square per dark module. */
  path: string;
}

/**
 * The QR code as one SVG path. The library ('qrcode-generator') is loaded
 * only now, the first time a QR is shown, so it never slows down start-up.
 * Error correction "M": still readable with ~15 % of the code damaged
 * (glare on the screen, a finger on the corner).
 */
export async function makeQr(text: string): Promise<Qr> {
  const { default: qrcode } = await import('qrcode-generator');
  const code = qrcode(0, 'M');
  code.addData(text, 'Byte');
  code.make();
  const size = code.getModuleCount();
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (code.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
  }
  return { size, path };
}
