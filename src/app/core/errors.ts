// Which unexpected errors are worth telling the user about.
//
// Some "errors" are normal life in a browser app: closing the share sheet
// (AbortError), a share/clipboard call that came too late after the tap
// (NotAllowedError), the browser's ResizeObserver note. Those are only logged.
// Anything else means something really went wrong: the app says so and
// offers to reload (the songs live in IndexedDB, a reload loses nothing).

const HARMLESS_NAMES = new Set(['AbortError', 'NotAllowedError']);
const HARMLESS_MESSAGES = [/ResizeObserver loop/i];

/** The Error behind what Angular / the browser reports (a rejection carries it in `reason`). */
export function unwrapError(error: unknown): unknown {
  if (error && typeof error === 'object' && 'reason' in error) return (error as { reason: unknown }).reason;
  if (error && typeof error === 'object' && 'rejection' in error) return (error as { rejection: unknown }).rejection;
  return error;
}

export function isHarmless(error: unknown): boolean {
  const e = unwrapError(error);
  if (e && typeof e === 'object') {
    const { name, message } = e as { name?: unknown; message?: unknown };
    if (typeof name === 'string' && HARMLESS_NAMES.has(name)) return true;
    if (typeof message === 'string' && HARMLESS_MESSAGES.some((re) => re.test(message))) return true;
  }
  return typeof e === 'string' && HARMLESS_MESSAGES.some((re) => re.test(e));
}

/** After a new version is published, an old page may ask for a file that no longer exists. */
export function isStaleVersion(error: unknown): boolean {
  const e = unwrapError(error);
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
}
