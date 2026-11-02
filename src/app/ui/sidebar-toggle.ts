import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IT } from '../i18n/it';
import { LayoutService } from '../services/layout.service';
import { Icon } from './icon';

/**
 * "Mostra libreria": shown only while the library sidebar is closed, so every
 * page has a way to bring it back. (On phones the bottom bar does this.)
 */
@Component({
  selector: 'app-sidebar-toggle',
  imports: [Icon],
  template: `
    @if (!layout.sidebarOpen()) {
      <button type="button" class="btn icon-btn" (click)="layout.sidebarOpen.set(true)" [attr.aria-label]="t.expand" [title]="t.expand">
        <app-icon name="sidebar" />
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    @media (max-width: 600px) {
      button {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarToggle {
  protected readonly layout = inject(LayoutService);
  protected readonly t = IT.library;
}
