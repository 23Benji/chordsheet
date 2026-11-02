import { detectSwipe } from './gestures';
import { isIos, isIosSafari, shouldShowInstallHint } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('gestures', () => {
  it('detects quick horizontal swipes only', () => {
    expect(detectSwipe(-120, 10, 200)).toBe('left');
    expect(detectSwipe(90, -20, 300)).toBe('right');
    expect(detectSwipe(-30, 0, 100)).toBeNull(); // too short
    expect(detectSwipe(-80, 90, 200)).toBeNull(); // mostly vertical = scrolling
    expect(detectSwipe(-200, 0, 1500)).toBeNull(); // too slow = dragging
  });
});

describe('platform', () => {
  it('recognises iPhone and iPad Safari (iPadOS reports a Mac)', () => {
    expect(isIos({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(true);
    expect(isIos({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5, standalone: false })).toBe(true);
    expect(isIos({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 0, standalone: false })).toBe(false); // a real Mac
    expect(isIosSafari({ userAgent: CHROME_IOS, maxTouchPoints: 5, standalone: false })).toBe(false);
  });

  it('shows the install hint only in Safari on iOS when not installed', () => {
    expect(shouldShowInstallHint({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(true);
    expect(shouldShowInstallHint({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe(false);
    expect(shouldShowInstallHint({ userAgent: CHROME_MAC, maxTouchPoints: 0, standalone: false })).toBe(false);
  });
});
