import { ChangeDetectionStrategy, Component, Signal, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IT } from '../i18n/it';
// Only this import may name FabDial, or the @defer in the template stops working.
import { FabDial } from './fab-dial';
import { Icon, IconName } from './icon';

export interface FabOption {
  id: string;
  label: string;
  icon: IconName;
}

/**
 * iPhone floating "+" button (bottom right): adds something new. With one
 * thing to add it is a link or an action; with `options`, a tap opens them
 * (ui/fab-dial.ts). Impostazioni is the gear at the top right of both tabs,
 * so "+" only ever means "add".
 */
@Component({
  selector: 'app-fab-menu',
  imports: [RouterLink, Icon, FabDial],
  template: `
    @if (options().length) {
      <button
        #trigger
        type="button"
        class="btn icon-btn fab glass"
        [class.fixed]="fixed()"
        [class.covered]="dial()?.dialOpen()"
        [attr.aria-label]="label()"
        [title]="label()"
        aria-haspopup="dialog"
        (click)="dial()?.open(trigger)"
      >
        <app-icon name="plus" />
      </button>
      <!-- @defer: its code loads just after start-up, as only a tap on the "+" needs it. -->
      @defer (on idle) {
        <app-fab-dial #dial [options]="options()" [label]="label()" (chosen)="chosen.emit($event)" />
      }
    } @else if (link(); as to) {
      <a class="btn icon-btn fab glass" [class.fixed]="fixed()" [routerLink]="to" [attr.aria-label]="label()" [title]="label()">
        <app-icon name="plus" />
      </a>
    } @else {
      <button type="button" class="btn icon-btn fab glass" [class.fixed]="fixed()" [attr.aria-label]="label()" [title]="label()" (click)="pressed.emit()">
        <app-icon name="plus" />
      </button>
    }
  `,
  styleUrl: './fab-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabMenu {
  /** Where it goes (default: a new song); null = it emits `pressed` instead. */
  readonly link = input<string | null>('/nuovo');
  readonly label = input<string>(IT.library.newSong);
  /** On a page that scrolls as a whole: stay put above the tab bar. */
  readonly fixed = input(false);
  /** Choices to offer when tapped; empty = "+" does one thing (see `link`). */
  readonly options = input<readonly FabOption[]>([]);
  readonly pressed = output<void>();
  /** The choice tapped. Emitted inside the tap, so it can open a file picker. */
  readonly chosen = output<string>();

  /** By template name, not by class: naming the class here would undo the @defer. */
  protected readonly dial = viewChild<{ open(trigger: HTMLElement): void; dialOpen: Signal<boolean> }>('dial');
}
