// Swipe detection for touch page turning.

export type Swipe = 'left' | 'right' | null;

const MIN_DISTANCE = 50; // px
const MAX_TIME = 700; // ms
/** Horizontal movement must clearly dominate (vertical = scrolling). */
const RATIO = 1.5;

export function detectSwipe(dx: number, dy: number, ms: number): Swipe {
  if (ms > MAX_TIME || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * RATIO) return null;
  return dx < 0 ? 'left' : 'right';
}
