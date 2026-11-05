import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { isHarmless, isStaleVersion } from '../core/errors';
import { IT } from '../i18n/it';
import { ToastService } from './toast.service';

/** Don't repeat the message more often than this (one fault can fire many errors). */
const QUIET_MS = 30_000;

/**
 * Replaces Angular's default ErrorHandler (which only logs): when something
 * unexpected breaks, the user sees "Qualcosa non ha funzionato" with
 * "Ricarica" instead of an app that silently stops responding. Harmless
 * browser events (closing the share sheet …) are only logged. The data is in
 * IndexedDB, so reloading loses nothing.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  // The toast is looked up when needed: the ErrorHandler is created before most services.
  private readonly injector = inject(Injector);
  private lastShown = -Infinity;

  handleError(error: unknown): void {
    console.error(error);
    if (isHarmless(error)) return;
    const now = performance.now();
    if (now - this.lastShown < QUIET_MS) return;
    this.lastShown = now;
    try {
      const message = isStaleVersion(error) ? IT.errors.newVersion : IT.errors.generic;
      this.injector.get(ToastService).show(message, 0, { label: IT.errors.reload, run: () => location.reload() });
    } catch {
      // Showing the message failed too: the log above is all we can do.
    }
  }
}
