import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  DEFAULT_KEYMAP,
  KEY_ACTIONS,
  KeyAction,
  assignKey,
  effectiveKeymap,
  isReservedKey,
  keyLabel,
  keysFor,
  unassignKey,
} from '../core/keymap';
import { IT } from '../i18n/it';
import { SettingsService } from '../services/settings.service';
import { Icon } from './icon';

/** Assign keyboard keys / pedal buttons to performance actions (saved in Settings). */
@Component({
  selector: 'app-keymap-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog aria-labelledby="keymap-title" (close)="listening.set(null)" (keydown)="onKeydown($event)">
      <div class="body">
        <h2 id="keymap-title">{{ t.title }}</h2>
        <p class="help">{{ t.help }}</p>
        <ul>
          @for (action of actions; track action) {
            <li>
              <span class="action">{{ t.actions[action] }}</span>
              <span class="keys">
                @for (key of keysOf(action); track key) {
                  <span class="key">
                    {{ label(key) }}
                    <button type="button" class="remove" (click)="remove(key)" [attr.aria-label]="t.remove(label(key))">
                      <app-icon name="close" />
                    </button>
                  </span>
                }
              </span>
              <button type="button" class="btn small" [class.listening]="listening() === action" (click)="listening.set(action)">
                {{ listening() === action ? t.listening : t.add }}
              </button>
            </li>
          }
        </ul>
        @if (warning()) {
          <p class="warning" role="alert">{{ warning() }}</p>
        }
        <div class="footer">
          <button type="button" class="btn" (click)="reset()">{{ t.reset }}</button>
          <button type="button" class="btn btn-primary" (click)="close()">{{ t.done }}</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(560px, 94vw);
      padding: 0;
      border: none;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--text);
      box-shadow: var(--shadow);
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    .body {
      padding: 24px;
    }
    h2 {
      font-size: 22px;
    }
    .help {
      color: var(--text-muted);
    }
    ul {
      margin: 16px 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .action {
      flex: 0 0 11em;
      font-weight: 700;
    }
    .keys {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: 6px;
    }
    .key {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 4px 2px 10px;
      border-radius: var(--radius-s);
      background: var(--surface);
      font-family: var(--font-mono);
    }
    .remove {
      display: inline-flex;
      padding: 4px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
    }
    .small {
      min-height: var(--tap-small);
      font-size: 14px;
    }
    .listening {
      background: var(--accent);
      color: var(--accent-ink);
    }
    .warning {
      color: var(--coral);
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeymapDialog {
  private readonly settings = inject(SettingsService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly t = IT.keymap;
  protected readonly actions = KEY_ACTIONS;
  protected readonly label = keyLabel;

  private readonly map = computed(() => effectiveKeymap(this.settings.settings().keyboardMap));
  /** Action waiting for the next key press. */
  protected readonly listening = signal<KeyAction | null>(null);
  protected readonly warning = signal<string | null>(null);

  open(): void {
    this.warning.set(null);
    this.dialog().nativeElement.showModal();
  }

  isOpen(): boolean {
    return this.dialog().nativeElement.open;
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected keysOf(action: KeyAction): string[] {
    return keysFor(this.map(), action);
  }

  private save(map: Record<string, string>): void {
    void this.settings.update({ keyboardMap: map });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const action = this.listening();
    if (!action || event.key === 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    if (isReservedKey(event.key)) {
      this.warning.set(this.t.reserved);
      return;
    }
    this.warning.set(null);
    this.save(assignKey(this.map(), event.key, action));
    this.listening.set(null);
  }

  protected remove(key: string): void {
    this.save(unassignKey(this.map(), key));
  }

  protected reset(): void {
    this.save({ ...DEFAULT_KEYMAP });
  }
}
