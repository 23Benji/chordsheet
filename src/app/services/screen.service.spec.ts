import { TestBed } from '@angular/core/testing';
import { ScreenService } from './screen.service';

/** A fake Wake Lock: refuses the first request (no tap yet, like Safari), then grants. */
function fakeWakeLock(refuseFirst = true) {
  const sentinels: (EventTarget & { release: () => Promise<void>; released: boolean })[] = [];
  let calls = 0;
  const request = vi.fn(async () => {
    calls++;
    if (refuseFirst && calls === 1) throw new DOMException('no transient activation', 'NotAllowedError');
    const sentinel = Object.assign(new EventTarget(), {
      released: false,
      release: async () => {
        sentinel.released = true;
        sentinel.dispatchEvent(new Event('release'));
      },
    });
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinels };
}

const flush = () => new Promise((r) => setTimeout(r));

describe('ScreenService: keep the screen on', () => {
  it('refused without a tap → taken at the next tap; dropped by iOS → taken again at the next tap', async () => {
    const { request, sentinels } = fakeWakeLock();
    const screen = TestBed.inject(ScreenService);
    await screen.keepAwake();
    expect(screen.awake).toBe(false); // Safari said no (not inside a tap)
    document.dispatchEvent(new Event('pointerup')); // the next tap / page turn
    await flush();
    expect(screen.awake).toBe(true);
    await sentinels[0].release(); // iOS dropped it (another app, a call)
    expect(screen.awake).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); // a pedal press
    await flush();
    expect(screen.awake).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('leaving and coming back within a moment (next song of a setlist) keeps the same lock', async () => {
    vi.useFakeTimers();
    const { request, sentinels } = fakeWakeLock(false);
    const screen = TestBed.inject(ScreenService);
    await screen.keepAwake();
    screen.allowSleep(); // the page of the old song closes…
    await screen.keepAwake(); // …the new one opens
    vi.advanceTimersByTime(3000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(sentinels[0].released).toBe(false);
    screen.allowSleep(); // really leaving performance mode
    vi.advanceTimersByTime(3000);
    expect(sentinels[0].released).toBe(true);
    vi.useRealTimers();
  });
});
