import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Safari (iPad) still uses the webkit-prefixed Fullscreen API. */
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/**
 * Full screen and Screen Wake Lock for performance mode. Both are browser
 * features that may be missing (e.g. no element full screen on iPhone):
 * every call fails silently.
 */
@Injectable({ providedIn: 'root' })
export class ScreenService {
  private readonly doc = document as WebkitDocument;
  readonly isFullscreen = signal(this.currentFullscreen());
  readonly canFullscreen =
    !!(document.documentElement.requestFullscreen || (document.documentElement as WebkitElement).webkitRequestFullscreen);

  private wakeLock: WakeLockSentinel | null = null;
  private wantWakeLock = false;
  private requesting = false;
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const sync = () => this.isFullscreen.set(this.currentFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    // The browser drops the wake lock when the app is hidden: take it again.
    // Safari grants it only during a tap ("transient activation"), so a
    // request from here may be refused there — hence also the next tap,
    // key or pedal press below: whenever we want the lock and don't hold
    // it, that gesture takes it.
    const retry = () => {
      if (this.wantWakeLock && !this.wakeLock && document.visibilityState === 'visible') void this.acquire();
    };
    document.addEventListener('visibilitychange', retry);
    document.addEventListener('pointerup', retry, { capture: true, passive: true });
    document.addEventListener('keydown', retry, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      document.removeEventListener('visibilitychange', retry);
      document.removeEventListener('pointerup', retry, { capture: true });
      document.removeEventListener('keydown', retry, { capture: true });
    });
  }

  private currentFullscreen(): boolean {
    return !!(document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement);
  }

  /** Must be called from a user gesture (click/key), or the browser refuses. */
  async enterFullscreen(): Promise<void> {
    const el = document.documentElement as WebkitElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else await el.webkitRequestFullscreen?.();
    } catch {
      // Refused or unsupported: performance mode still works, just not full screen.
    }
  }

  async exitFullscreen(): Promise<void> {
    if (!this.currentFullscreen()) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await this.doc.webkitExitFullscreen?.();
    } catch {
      // Already left.
    }
  }

  /**
   * Keep the screen on (no dimming / lock) while performing. Call it inside
   * the tap that opens performance mode: Safari only grants it then.
   */
  async keepAwake(): Promise<void> {
    this.wantWakeLock = true;
    clearTimeout(this.releaseTimer);
    if (!this.wakeLock) await this.acquire();
  }

  /**
   * Let the screen sleep again — a moment later, so going from one song of
   * a setlist to the next (the page is rebuilt) doesn't drop and re-ask
   * for the lock, which Safari would refuse outside a tap.
   */
  allowSleep(): void {
    this.wantWakeLock = false;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      if (this.wantWakeLock) return;
      void this.wakeLock?.release().catch(() => undefined);
      this.wakeLock = null;
    }, 1500);
  }

  /** True while the screen is being kept on. */
  get awake(): boolean {
    return !!this.wakeLock;
  }

  private async acquire(): Promise<void> {
    if (this.requesting || !navigator.wakeLock) return;
    this.requesting = true;
    try {
      // request() is called synchronously here, still inside the caller's tap.
      const sentinel = await navigator.wakeLock.request('screen');
      if (!this.wantWakeLock) {
        void sentinel.release().catch(() => undefined);
        return;
      }
      this.wakeLock = sentinel;
      // iOS / the browser may drop it (another app, a call): the next tap takes it again.
      sentinel.addEventListener('release', () => {
        if (this.wakeLock === sentinel) this.wakeLock = null;
      });
    } catch {
      this.wakeLock = null; // refused (no tap, low battery…): the next tap tries again
    } finally {
      this.requesting = false;
    }
  }
}
