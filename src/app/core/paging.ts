// Page maths for reading without scrolling by hand.
//
// Columns: the sheet is a CSS multi-column box of fixed height; text that
// doesn't fit makes more columns to the right. One page = the visible width
// plus one column gap. Vertical: one page = most of the visible height (a
// little overlap keeps the last line of the previous screen visible).

/** Fraction of the screen height one vertical page advances. */
export const VERTICAL_PAGE_RATIO = 0.85;

export function columnPageCount(scrollWidth: number, clientWidth: number, gap: number): number {
  const stride = clientWidth + gap;
  if (stride <= 0) return 1;
  // −0.01: rounding noise must not create an empty extra page.
  return Math.max(1, Math.ceil((scrollWidth + gap) / stride - 0.01));
}

export function columnPageOffset(page: number, clientWidth: number, gap: number): number {
  return page * (clientWidth + gap);
}

export function verticalPageCount(scrollHeight: number, clientHeight: number): number {
  const overflow = scrollHeight - clientHeight;
  const stride = clientHeight * VERTICAL_PAGE_RATIO;
  if (overflow <= 1 || stride <= 0) return 1;
  return 1 + Math.ceil(overflow / stride - 0.01);
}

export function verticalPageOffset(page: number, scrollHeight: number, clientHeight: number): number {
  return Math.min(page * clientHeight * VERTICAL_PAGE_RATIO, Math.max(0, scrollHeight - clientHeight));
}

/** Which vertical page a manual scroll position belongs to. */
export function verticalPageAt(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const count = verticalPageCount(scrollHeight, clientHeight);
  if (scrollTop >= scrollHeight - clientHeight - 1) return count - 1;
  return Math.min(count - 1, Math.round(scrollTop / (clientHeight * VERTICAL_PAGE_RATIO)));
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
