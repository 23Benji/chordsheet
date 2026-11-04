// Single-song export as a .cho file.

/** "123c - La terra canta.cho" — same pattern as the bundled files. */
export function choFileName(song: { number: number | null; suffix: string; title: string }): string {
  const title = (song.title.trim() || 'canto').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
  const number = song.number === null ? '' : `${String(song.number).padStart(3, '0')}${song.suffix} - `;
  return `${number}${title}.cho`;
}

/** Lets the browser save `text` as a file (no network involved). */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shares a ready-made file (e.g. a PDF) through the share sheet; where that
 * isn't possible, downloads it. Resolves false if the user closed the sheet.
 */
export async function shareOrDownloadFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/**
 * On iPad/iPhone the share sheet can send the file (AirDrop, WhatsApp, Mail…);
 * elsewhere the file is downloaded.
 */
export async function shareOrDownload(fileName: string, text: string, type = 'application/json'): Promise<boolean> {
  const file = new File([text], fileName, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false; // the user closed the share sheet
    }
  }
  downloadText(fileName, text);
  return true;
}
