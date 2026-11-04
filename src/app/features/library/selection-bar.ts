import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';

/**
 * Bottom bar while selecting songs in the library: "Aggiungi a…", and inside
 * a folder also "Sposta in…" and "Togli". The library does the work.
 */
@Component({
  selector: 'app-selection-bar',
  imports: [Icon],
  template: `
    <div class="bar" role="toolbar" [attr.aria-label]="t.selected(count())">
      <button type="button" class="btn btn-secondary" (click)="add.emit()">
        <app-icon name="folderPlus" /> {{ t.addTo }}
      </button>
      @if (folderName(); as here) {
        <button type="button" class="btn btn-secondary" (click)="move.emit()">
          <app-icon name="folderInput" /> {{ t.moveTo }}
        </button>
        <button type="button" class="btn btn-secondary" (click)="remove.emit()" [title]="t.removeHereHint(here)">
          <app-icon name="folderMinus" /> {{ t.removeHere }}
        </button>
      }
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      gap: 6px;
      padding: 10px 12px max(10px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--border);
      background: var(--bg-elev-1);
    }
    /* Three buttons must fit the 340px library column too. */
    .btn {
      flex: 1 1 auto;
      gap: 6px;
      min-width: 0;
      padding-inline: 8px;
      font-size: 14px;
      white-space: nowrap;
    }
    @media (max-width: 600px) {
      .bar {
        padding-bottom: 10px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionBar {
  protected readonly t = IT.folders;
  readonly count = input.required<number>();
  /** The folder being shown, if any (enables Sposta / Togli). */
  readonly folderName = input<string | null>(null);
  readonly add = output<void>();
  readonly move = output<void>();
  readonly remove = output<void>();
}
