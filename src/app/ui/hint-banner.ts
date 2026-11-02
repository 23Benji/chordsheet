import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { currentPlatform, shouldShowInstallHint } from '../core/platform';
import { IT } from '../i18n/it';
import { LibraryService } from '../services/library.service';
import { Icon } from './icon';

const STORAGE_KEY = 'innario.dismissedHints';
type Hint = 'install' | 'persist';

/**
 * One discreet hint at a time:
 * - Safari on iPhone/iPad, not installed: "Condividi → Aggiungi alla schermata Home"
 *   (Safari may delete the data of sites that aren't on the Home Screen);
 * - otherwise, if the browser hasn't granted persistent storage: offer to protect the data.
 * Dismissed hints are remembered (localStorage).
 */
@Component({
  selector: 'app-hint-banner',
  imports: [Icon],
  template: `
    @if (hint(); as hint) {
      <aside class="hint" role="status">
        <app-icon [name]="hint === 'install' ? 'share' : 'restore'" class="lead" />
        <p>{{ hint === 'install' ? t.install : t.persist }}</p>
        <button type="button" class="btn icon-btn close" (click)="dismiss(hint)" [attr.aria-label]="t.dismiss" [title]="t.dismiss">
          <app-icon name="close" />
        </button>
        @if (hint === 'persist') {
          <button type="button" class="btn btn-primary small" (click)="protect()">{{ t.persistButton }}</button>
        }
      </aside>
    }
  `,
  styles: `
    /* icon · text · close on the first row, the action button under the text */
    .hint {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 6px 10px;
      padding: 8px 4px 10px 12px;
      border-radius: var(--radius-m);
      background: var(--highlight-amber);
    }
    p {
      margin: 6px 0 0;
      font-size: 13px;
      line-height: 1.35;
    }
    .lead {
      margin-top: 6px;
    }
    .small {
      grid-column: 2;
      justify-self: start;
    }
    .close {
      min-width: 32px;
      min-height: 32px;
    }
    .lead {
      color: var(--accent);
    }
    .small {
      min-height: var(--tap-small);
      font-size: 14px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HintBanner implements OnInit {
  private readonly library = inject(LibraryService);
  protected readonly t = IT.hints;

  private readonly dismissed = signal<Hint[]>(readDismissed());
  private readonly installHint = shouldShowInstallHint(currentPlatform());
  private readonly persisted = signal(true);

  protected readonly hint = computed<Hint | null>(() => {
    if (this.library.isEmpty()) return null;
    if (this.installHint && !this.dismissed().includes('install')) return 'install';
    if (!this.installHint && !this.persisted() && !this.dismissed().includes('persist')) return 'persist';
    return null;
  });

  ngOnInit(): void {
    void navigator.storage?.persisted?.().then((p) => this.persisted.set(p), () => undefined);
  }

  protected async protect(): Promise<void> {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    this.persisted.set(granted);
    if (!granted) this.dismiss('persist');
  }

  protected dismiss(hint: Hint): void {
    const next = [...this.dismissed(), hint];
    this.dismissed.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode: just hide it for now.
    }
  }
}

function readDismissed(): Hint[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
