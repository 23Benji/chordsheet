import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IT } from '../i18n/it';
import { Icon } from './icon';

/**
 * iPhone floating "+" button (bottom right of the library): creates a new
 * song. "+" means "add" on iOS, so it does only that; Impostazioni is the
 * gear at the top right of Libreria and Scalette.
 */
@Component({
  selector: 'app-fab-menu',
  imports: [RouterLink, Icon],
  template: `
    <a class="btn icon-btn fab glass" routerLink="/nuovo" [attr.aria-label]="t.newSong" [title]="t.newSong">
      <app-icon name="plus" />
    </a>
  `,
  styleUrl: './fab-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabMenu {
  protected readonly t = IT.library;
}
