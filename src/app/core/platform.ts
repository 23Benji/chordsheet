// Browser/platform checks for the iPad/iPhone install hint.

export interface PlatformInfo {
  userAgent: string;
  maxTouchPoints: number;
  /** navigator.standalone (iOS) or display-mode: standalone. */
  standalone: boolean;
}

/** iPhone/iPad. iPadOS Safari pretends to be a Mac, but Macs have no touch screen. */
export function isIos(p: PlatformInfo): boolean {
  return /iPhone|iPad|iPod/.test(p.userAgent) || (/Macintosh/.test(p.userAgent) && p.maxTouchPoints > 1);
}

/** Safari on iOS (Chrome/Firefox/Edge on iOS add their own token). */
export function isIosSafari(p: PlatformInfo): boolean {
  return isIos(p) && /Safari/.test(p.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(p.userAgent);
}

/**
 * Show "Condividi → Aggiungi alla schermata Home": Safari on iOS, not yet
 * installed. (Safari may delete the data of sites that aren't installed.)
 */
export function shouldShowInstallHint(p: PlatformInfo): boolean {
  return isIosSafari(p) && !p.standalone;
}

export function currentPlatform(): PlatformInfo {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true,
  };
}

/**
 * `accept` for the "import songs" file pickers. iOS only lets you pick files
 * whose extension it knows: `.cho`/`.chopro` are unknown there, so with a
 * filter they show up greyed out. On iOS we drop the filter (null removes the
 * attribute); the importer rejects files it doesn't recognise anyway.
 */
export function songImportAccept(p: PlatformInfo, accept: string): string | null {
  return isIos(p) ? null : accept;
}
