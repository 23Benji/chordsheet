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
 * On iPad/iPhone the share sheet can send the file (AirDrop, WhatsApp, Mail…);
 * elsewhere the file is downloaded.
 */
export async function shareOrDownload(fileName: string, text: string, type = 'application/json'): Promise<void> {
  const file = new File([text], fileName, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // the user closed the share sheet
    }
  }
  downloadText(fileName, text);
}
