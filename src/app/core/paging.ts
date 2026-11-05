// Page maths for reading without scrolling by hand.
//
// Columns: the sheet is a CSS multi-column box of fixed height; text that
// doesn't fit makes more columns to the right. One page = the visible width
// plus one column gap. Vertical: one page = most of the visible height (a
// little overlap keeps the last line of the previous screen visible).

/** Fraction of the screen height one vertical page advances. */
export const VERTICAL_PAGE_RATIO = 0.85;
/**
 * Half-page turn (forScore's "half page"): you always keep seeing where you
 * are. Vertical: a turn moves half a screen (the bottom half comes up).
 * Columns: a turn moves one column (the right column, the one you are
 * reading, moves to the left and the next one appears on the right).
 */
export const HALF_PAGE_RATIO = 0.5;
/** Columns on screen in the paged layouts (CSS column-count: 2). */
export const COLUMNS_PER_VIEW = 2;

export function columnPageCount(scrollWidth: number, clientWidth: number, gap: number): number {
  const stride = clientWidth + gap;
  if (stride <= 0) return 1;
  // −0.01: rounding noise must not create an empty extra page.
  return Math.max(1, Math.ceil((scrollWidth + gap) / stride - 0.01));
}

export function columnPageOffset(page: number, clientWidth: number, gap: number): number {
  return page * (clientWidth + gap);
}

/** Half-page turns over columns: positions from "columns 1–2" to "the last two columns". */
export function columnHalfCount(scrollWidth: number, clientWidth: number, gap: number, perView = COLUMNS_PER_VIEW): number {
  const stride = (clientWidth + gap) / perView;
  if (stride <= 0) return 1;
  const columns = Math.max(1, Math.round((scrollWidth + gap) / stride));
  return Math.max(1, columns - perView + 1);
}

export function columnHalfOffset(step: number, clientWidth: number, gap: number, perView = COLUMNS_PER_VIEW): number {
  return (step * (clientWidth + gap)) / perView;
}

export function verticalPageCount(scrollHeight: number, clientHeight: number, ratio = VERTICAL_PAGE_RATIO): number {
  const overflow = scrollHeight - clientHeight;
  const stride = clientHeight * ratio;
  if (overflow <= 1 || stride <= 0) return 1;
  return 1 + Math.ceil(overflow / stride - 0.01);
}

export function verticalPageOffset(page: number, scrollHeight: number, clientHeight: number, ratio = VERTICAL_PAGE_RATIO): number {
  return Math.min(page * clientHeight * ratio, Math.max(0, scrollHeight - clientHeight));
}

/** Which vertical page a manual scroll position belongs to. */
export function verticalPageAt(scrollTop: number, scrollHeight: number, clientHeight: number, ratio = VERTICAL_PAGE_RATIO): number {
  const count = verticalPageCount(scrollHeight, clientHeight, ratio);
  if (scrollTop >= scrollHeight - clientHeight - 1) return count - 1;
  return Math.min(count - 1, Math.round(scrollTop / (clientHeight * ratio)));
}

// ── Auto-scroll ──────────────────────────────────────────────────────────

/** Auto-scroll speed is stored as seconds per screen: it means the same in both layouts. */
export const AUTOSCROLL_DEFAULT = 30;
export const AUTOSCROLL_MIN = 5;
export const AUTOSCROLL_MAX = 180;
export const AUTOSCROLL_STEP = 3;

export function clampAutoscroll(seconds: number): number {
  return Math.min(AUTOSCROLL_MAX, Math.max(AUTOSCROLL_MIN, Math.round(seconds)));
}

/**
 * Rough speed from the tempo: assume one screen ≈ 16 bars of 4/4
 * (64 beats). A starting point the user then adjusts with [ and ].
 */
export function secondsPerScreenFromTempo(bpm: number): number {
  return clampAutoscroll((64 * 60) / bpm);
}
