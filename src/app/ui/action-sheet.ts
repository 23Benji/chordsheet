import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { IconName } from './icons';
import { Icon } from './icon';

export interface SheetAction {
  id: string;
  label: string;
  icon: IconName;
  danger?: boolean;
}

/**
 * A list of choices in a native <dialog>: a bottom sheet on phones (like the
 * iOS action sheet), a small centred panel elsewhere. Lighter than the CDK
 * popover, so it can live in the library, which loads at start-up.
 * Usage: `const id = await this.sheet().choose('Sposta in', actions);` (null = cancelled).
 */
@Component({
  selector: 'app-action-sheet',
  imports: [Icon],
  template: `
    <dialog #dialog (close)="settle(null)" (click)="onBackdrop($event)" [attr.aria-label]="title()">
      <div class="sheet" role="menu">
        <p class="sheet-title">{{ title() }}</p>
        @for (action of actions(); track action.id) {
          <button type="button" class="menu-item" role="menuitem" [class.danger]="action.danger" (click)="settle(action.id)">
            <app-icon [name]="action.icon" />
            <span class="label">{{ action.label }}</span>
          </button>
        }
      </div>
      <button type="button" class="btn cancel" (click)="settle(null)">{{ cancel() }}</button>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(360px, calc(100vw - 32px));
      max-height: 80dvh;
      padding: 8px;
      border: none;
      border-radius: var(--radius-l);
      background: transparent;
      color: var(--text);
      overflow: visible;
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    .sheet {
      max-height: calc(80dvh - 80px);
      overflow-y: auto;
      padding: 6px;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      box-shadow: var(--shadow);
    }
    .sheet-title {
      margin: 6px 12px 8px;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      text-align: center;
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cancel {
      width: 100%;
      margin-top: 8px;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--accent);
      box-shadow: var(--shadow);
    }
    @media (max-width: 600px) {
      dialog {
        width: 100vw;
        max-width: 100vw;
        margin: auto 0 0;
        padding: 8px 8px max(8px, env(safe-area-inset-bottom));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionSheet {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly title = signal('');
  protected readonly actions = signal<readonly SheetAction[]>([]);
  protected readonly cancel = signal('');
  private resolve: ((id: string | null) => void) | null = null;

  choose(title: string, actions: readonly SheetAction[], cancel: string): Promise<string | null> {
    this.title.set(title);
    this.actions.set(actions);
    this.cancel.set(cancel);
    this.dialog().nativeElement.showModal();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  protected settle(id: string | null): void {
    const resolve = this.resolve;
    this.resolve = null;
    if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
    resolve?.(id);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.settle(null);
  }
}
