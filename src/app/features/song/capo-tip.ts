import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CapoSuggestion } from '../../core/capo';
import { IT } from '../../i18n/it';
import { Icon } from '../../ui/icon';

/**
 * "Capo consigliato" line in the Tonalità panel: the capo position with the
 * easiest guitar shapes (see core/capo.ts) and a button to use it. Shown only
 * when it is clearly easier than what is set now.
 */
@Component({
  selector: 'app-capo-tip',
  imports: [Icon],
  template: `
    <app-icon name="sparkles" class="spark" />
    <span class="text">
      <strong>{{ t.title }}</strong>
      {{ t.text(tip().capo, tip().shapeKey) }}
    </span>
    <button type="button" class="btn btn-secondary use" (click)="use.emit(tip().capo)">{{ t.use }}</button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
      border-radius: var(--radius-m);
      background: var(--surface);
      font-size: 14px;
    }
    .spark {
      flex: none;
      color: var(--accent);
    }
    .text {
      flex: 1;
      min-width: 0;
      color: var(--text-muted);

      strong {
        display: block;
        color: var(--text);
      }
    }
    .use {
      flex: none;
      min-height: var(--tap-small);
      background: var(--bg-elev-1);
      color: var(--accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapoTip {
  protected readonly t = IT.song.capoTip;
  readonly tip = input.required<CapoSuggestion>();
  readonly use = output<number>();
}
