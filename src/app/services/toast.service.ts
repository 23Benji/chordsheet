import { Injectable, signal } from '@angular/core';

/** How long "Annulla" stays after a delete. */
export const UNDO_MS = 8000;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  message: string;
  action?: ToastAction;
}

/** Short messages at the bottom of the screen ("Salvato", "Nuova versione disponibile — Aggiorna"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toast = signal<Toast | null>(null);
  /** Kept for simple reads in templates/tests. */
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Hides after `ms`; `ms = 0` keeps it until it's used or dismissed (for an
   * action that must not be missed, like "Aggiorna"). An "Annulla" toast
   * passes a time: undo is only offered for a few seconds.
   */
  show(message: string, ms = 4000, action?: ToastAction): void {
    clearTimeout(this.timer);
    this.toast.set({ message, action });
    this.message.set(message);
    if (ms > 0) this.timer = setTimeout(() => this.dismiss(), ms);
  }

  runAction(): void {
    const action = this.toast()?.action;
    this.dismiss();
    action?.run();
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.toast.set(null);
    this.message.set(null);
  }
}
