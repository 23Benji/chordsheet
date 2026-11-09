// Song text size. The user sees a percentage (100 % = the standard size,
// from 50 % to 150 %); underneath, 100 % is smaller on an iPhone than on a
// computer or iPad, so a whole verse fits on the small screen.

export const TEXT_SIZE_MIN = 0.5;
export const TEXT_SIZE_MAX = 1.5;
/** Lyrics at 100 % before the device base is applied, px. */
export const BASE_LYRICS_PX = 22;
/** 100 % on a phone: what used to be 65 %. */
export const PHONE_TEXT_BASE = 0.65;
/** 100 % on a computer or iPad: what used to be 85 %. */
export const WIDE_TEXT_BASE = 0.85;

/**
 * A phone, judged by the screen's short side so it stays a phone when turned
 * sideways (iPhones are ≤ 440 pt, the smallest iPad is 744 pt).
 */
export function isPhoneScreen(width: number, height: number): boolean {
  return Math.min(width, height) < 600;
}

/** The A−/A+ buttons: 10 % steps, kept within the limits. */
export function stepTextSize(current: number, delta: number): number {
  const next = Math.round((current + delta) * 10) / 10;
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, next));
}

/** Lyrics size in px for a text size (1 = 100 %) on this device; `stage` enlarges it for performance mode. */
export function lyricsPx(size: number, phone: boolean, stage = 1): number {
  return Math.round(BASE_LYRICS_PX * (phone ? PHONE_TEXT_BASE : WIDE_TEXT_BASE) * stage * size);
}
