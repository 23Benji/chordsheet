import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { daysAgo, shouldRemindBackup, snoozeUntil } from '../core/backup-reminder';
import { currentPlatform, shouldShowInstallHint } from '../core/platform';
import { IT } from '../i18n/it';
import { BackupService } from '../services/backup.service';
import { SyncService } from '../services/sync.service';
import { LibraryService } from '../services/library.service';
import { ToastService } from '../services/toast.service';
import { Icon } from './icon';

const STORAGE_KEY = 'innario.dismissedHints';
const SNOOZE_KEY = 'innario.backupSnoozedUntil';
type Hint = 'install' | 'backup' | 'persist';

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
        <app-icon [name]="hint === 'install' ? 'share' : hint === 'backup' ? 'fileDown' : 'restore'" class="lead" />
        <p>{{ message(hint) }}</p>
        <button
          type="button"
          class="btn icon-btn close"
          (click)="dismiss(hint)"
          [attr.aria-label]="hint === 'backup' ? t.later : t.dismiss"
          [title]="hint === 'backup' ? t.later : t.dismiss"
        >
          <app-icon name="close" />
        </button>
        @if (hint === 'persist') {
          <button type="button" class="btn btn-primary small" (click)="protect()">{{ t.persistButton }}</button>
        }
        @if (hint === 'backup') {
          <button type="button" class="btn btn-primary small" (click)="backupNow()">{{ t.backupButton }}</button>
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
      gap: var(--space-2) var(--space-2);
      padding: var(--space-2) var(--space-1) var(--space-3) var(--space-3);
      border-radius: var(--radius-m);
      background: var(--highlight-amber);
    }
    p {
      margin: var(--space-2) 0 0;
      font-size: 13px;
      line-height: 1.35;
    }
    .lead {
      margin-top: var(--space-2);
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
  private readonly backup = inject(BackupService);
  private readonly sync = inject(SyncService);
  private readonly toast = inject(ToastService);
  protected readonly t = IT.hints;
  private readonly snoozedUntil = signal<number | undefined>(readSnooze());

  private readonly dismissed = signal<Hint[]>(readDismissed());
  private readonly installHint = shouldShowInstallHint(currentPlatform());
  private readonly persisted = signal(true);

  protected readonly hint = computed<Hint | null>(() => {
    if (this.library.isEmpty()) return null;
    if (this.installHint && !this.dismissed().includes('install')) return 'install';
    // Signed in to Google: Drive keeps a copy of everything, no need to nag about backups.
    if (this.sync.state() !== 'off') return null;
    if (this.backupDue()) return 'backup';
    if (!this.installHint && !this.persisted() && !this.dismissed().includes('persist')) return 'persist';
    return null;
  });

  /** Backup reminder (never while the automatic backup file is on). */
  private readonly backupDue = computed(() => {
    if (this.backup.autoStatus() === 'active') return false;
    const songs = this.library.songs();
    const dataSince = songs.length ? Math.min(...songs.map((s) => s.createdAt)) : undefined;
    return shouldRemindBackup({
      now: Date.now(),
      lastBackupAt: this.backup.lastBackupAt(),
      dataSince,
      snoozedUntil: this.snoozedUntil(),
    });
  });

  protected message(hint: Hint): string {
    if (hint === 'install') return this.t.install;
    if (hint === 'persist') return this.t.persist;
    const at = this.backup.lastBackupAt();
    return at ? this.t.backup(daysAgo(at, Date.now())) : this.t.backupNever;
  }

  protected backupNow(): Promise<void> {
    return this.backup.export();
  }

  ngOnInit(): void {
    void navigator.storage?.persisted?.().then((p) => this.persisted.set(p), () => undefined);
  }

  protected async protect(): Promise<void> {
    const granted = (await navigator.storage?.persist?.().catch(() => false)) ?? false;
    this.persisted.set(granted);
    if (!granted) {
      this.toast.show(IT.settings.persistRefused, 10000);
      this.dismiss('persist');
    }
  }

  protected dismiss(hint: Hint): void {
    if (hint === 'backup') {
      // "Più tardi": ask again in 14 days.
      const until = snoozeUntil(Date.now());
      this.snoozedUntil.set(until);
      try {
        localStorage.setItem(SNOOZE_KEY, String(until));
      } catch {
        // Private mode: just hide it for now.
      }
      return;
    }
    const next = [...this.dismissed(), hint];
    this.dismissed.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode: just hide it for now.
    }
  }
}

function readSnooze(): number | undefined {
  const value = Number(localStorage.getItem(SNOOZE_KEY));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function readDismissed(): Hint[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
