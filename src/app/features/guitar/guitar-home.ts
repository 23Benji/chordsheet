import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IT } from '../../i18n/it';
import { SidebarToggle } from '../../ui/sidebar-toggle';

/**
 * "Chitarra": the home of the guitar tools (Benji's pick "A2", 2026-11-13).
 * Three cards, each with a small drawing of what the tool does: the tuner's
 * sliding scale, a chord on the neck, a few bars of tab. The drawings are
 * plain inline SVG in the theme's colours (no images to download).
 */
@Component({
  selector: 'app-guitar-home',
  imports: [RouterLink, SidebarToggle],
  template: `
    <div class="page">
      <div class="title">
        <app-sidebar-toggle /><h1 class="large-title">{{ t.title }}</h1>
      </div>

      <nav class="cards" [attr.aria-label]="t.tools">
        <a class="card" routerLink="/chitarra/accordatore">
          <span class="text"><b>{{ t.tuner }}</b><small>{{ t.tunerHint }}</small></span>
          <span class="preview" aria-hidden="true">
            <svg viewBox="0 0 120 88">
              <text x="60" y="34" class="big ok">A</text>
              <rect x="8" y="46" width="104" height="30" rx="8" class="box" />
              @for (x of strip; track x) {
                <line [attr.x1]="x" [attr.x2]="x" [attr.y1]="(x - 60) % 20 === 0 ? 52 : 57" y2="68" class="tick" />
              }
              <rect x="58" y="48" width="4" height="26" rx="2" class="mark ok" />
            </svg>
          </span>
        </a>

        <a class="card" routerLink="/chitarra/accordi">
          <span class="text"><b>{{ t.finder }}</b><small>{{ t.finderHint }}</small></span>
          <span class="preview" aria-hidden="true">
            <svg viewBox="0 0 120 88">
              <rect x="16" y="12" width="96" height="58" rx="3" class="board" />
              @for (y of strings; track y) {
                <line x1="12" x2="112" [attr.y1]="y" [attr.y2]="y" class="string" />
              }
              @for (x of wires; track x) {
                <line [attr.x1]="x" [attr.x2]="x" y1="12" y2="70" [class]="x === 16 ? 'nut' : 'wire'" />
              }
              <circle cx="28" cy="25.5" r="5.5" class="dot" />
              <circle cx="52" cy="36" r="5.5" class="dot" />
              <circle cx="52" cy="46.5" r="5.5" class="dot" />
              <text x="64" y="85" class="name">Am</text>
            </svg>
          </span>
        </a>

        <a class="card" routerLink="/chitarra/assolo">
          <span class="text"><b>{{ t.solo }}</b><small>{{ t.soloHint }}</small></span>
          <span class="preview tab" aria-hidden="true"><pre>{{ sampleTab }}</pre></span>
        </a>
      </nav>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
    .page {
      max-width: 1000px;
      margin: 0 auto;
      padding: calc(max(var(--space-5), env(safe-area-inset-top)) + var(--top-gap)) var(--page-x) var(--space-12);
    }
    .title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }
    .card {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--text);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.12s ease;

      &:active {
        transform: scale(0.98);
      }
      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      @media (hover: hover) {
        &:hover {
          border-color: var(--text-muted);
        }
      }
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;

      b {
        font-family: var(--font-heading);
        font-size: 21px;
      }
      small {
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.3;
      }
    }
    .preview {
      display: grid;
      flex: none;
      place-items: center;
      width: 120px;
      height: 88px;
      overflow: hidden;
      border-radius: var(--radius-m);
      background: var(--surface);

      svg {
        width: 100%;
        height: 100%;
      }
      pre {
        margin: 0;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 10px;
        line-height: 1.25;
      }
    }
    .big {
      fill: var(--text);
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 700;
      text-anchor: middle;
    }
    .name {
      fill: var(--accent);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 700;
      text-anchor: middle;
    }
    .ok {
      fill: var(--sage);
    }
    .box {
      fill: var(--bg-elev-1);
    }
    .tick {
      stroke: var(--text-muted);
      stroke-width: 1.2;
    }
    .board {
      fill: var(--bg-elev-1);
    }
    .string {
      stroke: var(--text-muted);
      stroke-width: 1;
    }
    .wire {
      stroke: var(--border);
      stroke-width: 2;
    }
    .nut {
      stroke: var(--text-muted);
      stroke-width: 4;
    }
    .dot {
      fill: var(--accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuitarHome {
  protected readonly t = IT.guitar;
  /** The tuner card's scale: a tick every 5 px, longer every 20. */
  protected readonly strip = Array.from({ length: 21 }, (_, i) => 10 + i * 5);
  /** Six strings, high e on top (an Am: B at the 1st fret, G and D at the 2nd). */
  protected readonly strings = Array.from({ length: 6 }, (_, i) => 15 + i * 10.5);
  protected readonly wires = [16, 40, 64, 88, 112];
  protected readonly sampleTab = ['e|----0-2-3-|', 'B|--1-------|', 'G|2---------|', 'D|----------|', 'A|----------|', 'E|----------|'].join('\n');
}
