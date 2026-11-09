import { describe, expect, it } from 'vitest';
import { isPhoneScreen, lyricsPx, stepTextSize } from './text-size';

describe('text size', () => {
  it('100 % is smaller on a phone than on a computer or iPad', () => {
    expect(lyricsPx(1, true)).toBe(14); // 22 × 0.65
    expect(lyricsPx(1, false)).toBe(19); // 22 × 0.85
    expect(lyricsPx(1.5, false, 1.25)).toBe(35); // performance mode
  });

  it('a phone stays a phone when turned sideways; an iPad is not one', () => {
    expect(isPhoneScreen(390, 844)).toBe(true);
    expect(isPhoneScreen(844, 390)).toBe(true);
    expect(isPhoneScreen(744, 1133)).toBe(false); // iPad mini
    expect(isPhoneScreen(1440, 900)).toBe(false);
  });

  it('A−/A+ move by 10 % between 50 % and 150 %', () => {
    expect(stepTextSize(1, 0.1)).toBe(1.1);
    expect(stepTextSize(1.5, 0.1)).toBe(1.5);
    expect(stepTextSize(0.5, -0.1)).toBe(0.5);
    expect(stepTextSize(0.7, -0.1)).toBe(0.6);
  });
});
