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

  constructor() {
    const sync = () => this.isFullscreen.set(this.currentFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    // The browser drops the wake lock when the tab is hidden: take it again.
    const onVisible = () => {
      if (this.wantWakeLock && document.visibilityState === 'visible') void this.acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      document.removeEventListener('visibilitychange', onVisible);
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

  /** Keep the screen on (no dimming / lock) while performing. */
  async keepAwake(): Promise<void> {
    this.wantWakeLock = true;
    await this.acquire();
  }

  async allowSleep(): Promise<void> {
    this.wantWakeLock = false;
    await this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private async acquire(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null; // e.g. battery saver: nothing to do
    }
  }
}
