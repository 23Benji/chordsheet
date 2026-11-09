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

// Pinch to zoom the song text.

import { TEXT_SIZE_MAX, TEXT_SIZE_MIN } from './text-size';

/** Distance between two fingers, px. */
export function fingerDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * The text size after a pinch: the current scale times how much the fingers
 * spread (ratio), kept within the limits and rounded to 5 % steps (so the
 * A−/A+ buttons, which move by 10 %, stay on round numbers).
 */
export function pinchFontScale(current: number, ratio: number, min = TEXT_SIZE_MIN, max = TEXT_SIZE_MAX): number {
  const next = Math.round(current * ratio * 20) / 20;
  return Math.min(max, Math.max(min, next));
}
