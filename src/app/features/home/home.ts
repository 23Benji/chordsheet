import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IT } from '../../i18n/it';

/** Main area when no song is open. */
@Component({
  selector: 'app-home',
  template: `
    <div class="home" style="background-image: url(assets/bg-dark.jpg)">
      <h1>{{ t.title }}</h1>
      <p>{{ t.hint }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .home {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 32px;
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
}
