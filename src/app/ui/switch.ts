import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** On/off switch (role="switch"), for settings that are simply on or off. */
@Component({
  selector: 'app-switch',
  template: `
    <button type="button" role="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()" (click)="toggled.emit(!checked())">
      <span class="thumb"></span>
    </button>
  `,
  styles: `
    button {
      position: relative;
      flex: none;
      width: 50px;
      height: 30px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: var(--border);
      cursor: pointer;
      transition: background-color 0.2s ease;

      &[aria-checked='true'] {
        background: var(--accent);
      }

      // The switch looks like iOS's (50 × 30) but answers to a 44 pt tall tap.
      &::before {
        content: '';
        position: absolute;
        inset: -7px -4px;
      }
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--text);
      box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
      transition: transform 0.2s ease;
    }
    [aria-checked='true'] .thumb {
      background: var(--accent-ink);
      transform: translateX(20px);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Switch {
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly toggled = output<boolean>();
}
