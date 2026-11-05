import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  DEFAULT_KEYMAP,
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
      <!-- iOS-style sheet: title bar with "Fine", grouped rows that scroll underneath. -->
      <header class="bar">
        <h2 id="keymap-title">{{ t.title }}</h2>
        <button type="button" class="done" (click)="close()">{{ t.done }}</button>
      </header>
      <div class="content">
        <p class="help">{{ t.help }}</p>
        @for (group of groups; track group.title) {
          <h3 class="list-group-title">{{ group.title }}</h3>
          <div class="list-group">
            @for (action of group.actions; track action) {
              <div class="row" [class.listening]="listening() === action">
                <div class="text">
                  <span class="action">{{ t.actions[action] }}</span>
                  @if (listening() === action) {
                    <span class="prompt" role="status">{{ t.listening }}</span>
                  } @else {
                    <span class="keys">
                      @for (key of keysOf(action); track key) {
                        <span class="key">
                          <kbd>{{ label(key) }}</kbd>
                          <button type="button" class="remove" (click)="remove(key)" [attr.aria-label]="t.remove(label(key))">
                            <app-icon name="close" />
                          </button>
                        </span>
                      } @empty {
                        <span class="none">{{ t.none }}</span>
                      }
                    </span>
                  }
                </div>
                @if (listening() === action) {
                  <button type="button" class="btn small" (click)="listening.set(null)">{{ t.cancelListening }}</button>
                } @else {
                  <button type="button" class="add" (click)="listen(action)" [attr.aria-label]="t.add(t.actions[action])" [title]="t.add(t.actions[action])">
                    <app-icon name="plus" />
                  </button>
                }
              </div>
            }
          </div>
        }
        @if (warning()) {
          <p class="warning" role="alert">{{ warning() }}</p>
        }
        <div class="list-group reset-group">
          <button type="button" class="row reset" (click)="reset()">{{ t.reset }}</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      display: none;
      flex-direction: column;
      width: min(520px, 94vw);
      max-height: min(720px, 88dvh);
      padding: 0;
      overflow: hidden;
      border: none;
      border-radius: var(--radius-l);
      background: var(--bg);
      color: var(--text);
      box-shadow: var(--shadow);
    }
    dialog[open] {
      display: flex;
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    .bar {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-3) var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border);
      background: var(--bg-elev-1);
    }
    h2 {
      margin: 0;
      font-size: 20px;
    }
    .done {
      min-height: var(--tap);
      padding: 0 var(--space-3);
      border: none;
      border-radius: var(--radius-s);
      background: none;
      color: var(--accent);
      font: inherit;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
    }
    .content {
      flex: 1;
      min-height: 0;
      padding: var(--space-1) var(--space-4) var(--space-6);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .help {
      margin: var(--space-3) var(--space-1) 0;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.4;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: 60px;
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border: none;
      background: none;
      color: var(--text);
      font: inherit;
      text-align: left;

      & + .row {
        box-shadow: 0 -1px 0 var(--border);
      }
      &.listening {
        background: var(--highlight-amber);
      }
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
    }
    .action {
      font-size: 16px;
      font-weight: 700;
    }
    .prompt {
      color: var(--accent);
      font-size: 14px;
      font-weight: 700;
    }
    .keys {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    /* A key cap: rounded, a slightly thicker bottom edge. */
    .key {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border);
      border-bottom-width: 2px;
      border-radius: var(--radius-s);
      background: var(--surface);
      white-space: nowrap;
    }
    kbd {
      padding: var(--space-1) 2px var(--space-1) var(--space-3);
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 700;
    }
    .remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      --icon-size: var(--icon-s);

      &:hover {
        color: var(--coral);
      }
    }
    .none {
      color: var(--text-muted);
      font-size: 14px;
    }
    .add {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--tap);
      height: var(--tap);
      border: none;
      border-radius: 50%;
      background: var(--highlight-amber);
      color: var(--accent);
      cursor: pointer;
      --icon-size: var(--icon-m);
    }
    .small {
      flex: none;
      min-height: var(--tap-small);
      font-size: 14px;
    }
    .warning {
      margin: var(--space-3) var(--space-1) 0;
      color: var(--coral);
      font-size: 14px;
    }
    .reset-group {
      margin-top: var(--space-6);
    }
    .reset {
      justify-content: center;
      min-height: 52px;
      color: var(--coral);
      font-weight: 700;
      cursor: pointer;
    }

    /* iPhone: a full-screen page, like iOS settings sheets. */
    @media (max-width: 600px) {
      dialog {
        width: 100%;
        max-width: 100%;
        height: 100dvh;
        max-height: 100dvh;
        margin: 0;
        border-radius: 0;
      }
      .bar {
        padding-top: calc(var(--space-3) + env(safe-area-inset-top) + var(--top-gap));
      }
      .content {
        padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeymapDialog {
  private readonly settings = inject(SettingsService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly t = IT.keymap;
  /** Rows grouped like iOS settings: turning pages, then the auto-scroll. */
  protected readonly groups: { title: string; actions: KeyAction[] }[] = [
    { title: IT.keymap.groups.pages, actions: ['next', 'prev'] },
    { title: IT.keymap.groups.scroll, actions: ['autoscroll', 'slower', 'faster'] },
  ];
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

  protected listen(action: KeyAction): void {
    this.warning.set(null);
    this.listening.set(action);
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
