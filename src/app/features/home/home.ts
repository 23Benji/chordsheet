import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IT } from '../../i18n/it';
import { LayoutService } from '../../services/layout.service';
import { SidebarToggle } from '../../ui/sidebar-toggle';

/** Main area when no song is open. */
@Component({
  selector: 'app-home',
  imports: [SidebarToggle],
  template: `
    <div class="home" style="background-image: url(assets/bg-dark.jpg)">
      <div class="corner"><app-sidebar-toggle /></div>
      <h1>{{ t.title }}</h1>
      <p>{{ layout.sidebarOpen() ? t.hint : t.hintClosed }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .corner {
      position: absolute;
      top: calc(max(14px, env(safe-area-inset-top)) + var(--top-gap));
      left: 14px;
    }
    .home {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: var(--space-8);
      background: var(--bg) center / cover no-repeat;
      text-align: center;
    }
    h1 {
      font-style: italic;
      font-weight: 400;
      font-size: 40px;
    }
    p {
      max-width: 420px;
      color: var(--text-muted);
      font-size: 18px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Always the dark tokens: the text sits on the dark background picture.
  host: { 'data-theme': 'dark' },
})
export class Home {
  protected readonly t = IT.home;
  protected readonly layout = inject(LayoutService);
}
