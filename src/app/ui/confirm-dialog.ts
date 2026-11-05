import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirm: string;
  cancel: string;
  danger?: boolean;
}

/**
 * Confirmation dialog built on the native <dialog> element: showModal() makes
 * the rest of the page inert, Esc closes it, focus is handled by the browser.
 * Usage: `if (await this.dialog().ask({...})) …`.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog #dialog (close)="settle(false)" (click)="onBackdrop($event)" aria-labelledby="confirm-title">
      @if (options(); as o) {
        <div class="body">
          <h2 id="confirm-title">{{ o.title }}</h2>
          <p>{{ o.message }}</p>
          <div class="actions">
            <button type="button" class="btn" (click)="settle(false)" autofocus>{{ o.cancel }}</button>
            <button type="button" class="btn btn-primary" [class.danger]="o.danger" (click)="settle(true)">
              {{ o.confirm }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog {
      max-width: min(440px, 92vw);
      padding: 0;
      border: none;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--text);
      box-shadow: var(--shadow);
    }
    .body {
      padding: var(--space-6);
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    h2 {
      font-size: 22px;
    }
    p {
      color: var(--text-muted);
      line-height: 1.45;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-5);
    }
    .danger {
      background: var(--coral);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly options = signal<ConfirmOptions | null>(null);
  private resolve: ((ok: boolean) => void) | null = null;

  ask(options: ConfirmOptions): Promise<boolean> {
    this.options.set(options);
    this.dialog().nativeElement.showModal();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  protected settle(ok: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
    resolve?.(ok);
  }

  /** A click on the dark area around the dialog counts as "cancel" (the content sits in .body). */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.settle(false);
  }
}
