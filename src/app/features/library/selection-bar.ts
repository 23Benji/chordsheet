import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';

/**
 * Bottom toolbar while selecting songs in the library, like the iOS system
 * apps: icon over a short label. Cartella (add / move / take out), Scaletta,
 * Condividi, Elimina. The library does the work; buttons are disabled until
 * at least one song is ticked.
 */
@Component({
  selector: 'app-selection-bar',
  imports: [Icon],
  template: `
    <div class="bar" role="toolbar" [attr.aria-label]="t.selected(count())">
      <button type="button" class="action" [disabled]="!count()" (click)="folder.emit()">
        <app-icon name="folderPlus" /> <span>{{ t.barFolder }}</span>
      </button>
      <button type="button" class="action" [disabled]="!count()" (click)="setlist.emit()">
        <app-icon name="listAdd" /> <span>{{ t.barSetlist }}</span>
      </button>
      <button type="button" class="action" [disabled]="!count()" (click)="share.emit()">
        <app-icon name="share" /> <span>{{ t.barShare }}</span>
      </button>
      <button type="button" class="action danger" [disabled]="!count()" (click)="delete.emit()">
        <app-icon name="trash" /> <span>{{ t.barDelete }}</span>
      </button>
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      padding: var(--space-2) var(--space-2) max(var(--space-2), env(safe-area-inset-bottom));
      border-top: 1px solid var(--border);
      background: var(--bg-elev-1);
    }
    /* Four equal columns: fits the 340px library column as well as a phone. */
    .action {
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      min-width: 0;
      min-height: 48px;
      padding: var(--space-2) 2px;
      border: none;
      border-radius: var(--radius-m);
      background: none;
      color: var(--accent);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      app-icon {
        font-size: 22px;
      }
      span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &:hover:not(:disabled) {
        background: var(--surface);
      }
      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      &:disabled {
        color: var(--text-muted);
        opacity: 0.5;
        cursor: default;
      }
    }
    .danger:not(:disabled) {
      color: var(--coral);
    }
    @media (max-width: 600px) {
      .bar {
        padding-bottom: var(--space-2);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionBar {
  protected readonly t = IT.folders;
  readonly count = input.required<number>();
  readonly folder = output<void>();
  readonly setlist = output<void>();
  readonly share = output<void>();
  readonly delete = output<void>();
}
