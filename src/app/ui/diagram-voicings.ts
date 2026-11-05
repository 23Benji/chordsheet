import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IT } from '../i18n/it';

/** "‹ 1 / 3 ›" under a chord diagram: browse the other positions / inversions. */
@Component({
  selector: 'app-diagram-voicings',
  template: `
    <div class="voicings" role="group" [attr.aria-label]="label() ?? t.voicings">
      <button type="button" (click)="step.emit(-1)" [attr.aria-label]="t.previous">‹</button>
      <span>{{ t.voicing(index() + 1, count()) }}</span>
      <button type="button" (click)="step.emit(1)" [attr.aria-label]="t.next">›</button>
    </div>
  `,
  styles: `
    .voicings {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      margin-top: var(--space-1);
      color: var(--text-muted);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    button {
      min-width: var(--tap-small);
      min-height: var(--tap-small);
      border: none;
      border-radius: var(--radius-s);
      background: var(--surface);
      color: var(--text);
      font-size: 18px;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramVoicings {
  readonly index = input.required<number>();
  readonly count = input.required<number>();
  readonly label = input<string | null>(null);
  readonly step = output<number>();
  protected readonly t = IT.diagrams;
}
