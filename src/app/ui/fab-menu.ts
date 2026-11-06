import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IT } from '../i18n/it';
import { Icon } from './icon';

/**
 * iPhone floating "+" button (bottom right): adds something new — a song in
 * Libreria (a link to the editor), a setlist in Scalette (an action). "+"
 * means "add" on iOS, so it does only that; Impostazioni is the gear at the
 * top right of both tabs.
 */
@Component({
  selector: 'app-fab-menu',
  imports: [RouterLink, Icon],
  template: `
    @if (link(); as to) {
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
  readonly pressed = output<void>();
}
