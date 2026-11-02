import { Injectable, signal } from '@angular/core';

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

  /** A toast with an action stays until it's used or dismissed. */
  show(message: string, ms = 4000, action?: ToastAction): void {
    clearTimeout(this.timer);
    this.toast.set({ message, action });
    this.message.set(message);
    if (!action) this.timer = setTimeout(() => this.dismiss(), ms);
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
