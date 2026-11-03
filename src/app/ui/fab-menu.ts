import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { IT } from '../i18n/it';
import { Icon } from './icon';

/**
 * iPhone floating "+" button (bottom right of the library). Tapping it shows
 * two actions, "Nuovo canto" and "Impostazioni" (so the bottom bar only needs
 * Libreria and Scalette). Hidden on bigger screens.
 */
@Component({
  selector: 'app-fab-menu',
  imports: [RouterLink, Icon],
  template: `
    <div class="fab-area" [class.open]="fabOpen()">
      @if (fabOpen()) {
        <div class="fab-scrim" (click)="fabOpen.set(false)" aria-hidden="true"></div>
        <div class="fab-menu" id="fab-menu">
          <a class="fab-option" routerLink="/impostazioni" (click)="fabOpen.set(false)">
            <span class="fab-label">{{ t.settings }}</span>
            <span class="fab-mini"><app-icon name="settings" /></span>
          </a>
          <a class="fab-option" routerLink="/nuovo" (click)="fabOpen.set(false)">
            <span class="fab-label">{{ t.newSong }}</span>
            <span class="fab-mini"><app-icon name="edit" /></span>
          </a>
        </div>
      }
      <button
        type="button"
        class="btn icon-btn fab glass"
        aria-controls="fab-menu"
        [attr.aria-expanded]="fabOpen()"
        [attr.aria-label]="fabOpen() ? t.fabClose : t.fabOpen"
        [title]="fabOpen() ? t.fabClose : t.fabOpen"
        (click)="fabOpen.set(!fabOpen())"
      >
        <app-icon name="plus" />
      </button>
    </div>
  `,
  styleUrl: './fab-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FabMenu {
  protected readonly t = IT.library;
  protected readonly fabOpen = signal(false);

  constructor() {
    // Any navigation (a menu item, a bottom-bar tab, swipe back) closes the menu.
    const navigations = toSignal(inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)));
    effect(() => {
      navigations();
      this.fabOpen.set(false);
    });
  }
}
