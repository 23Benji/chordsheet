import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Song } from '../../core/models';
import { numberLabel } from '../../core/song-meta';
import { IT } from '../../i18n/it';
import { LayoutService } from '../../services/layout.service';
import { LibraryService } from '../../services/library.service';
import { RecentService } from '../../services/recent.service';
import { SidebarToggle } from '../../ui/sidebar-toggle';

/** A piece of text, maybe with a chord above it. */
interface SheetPart {
  chord?: string;
  text: string;
}

/** How many recent songs fit under the title without crowding it. */
const HOME_RECENT_MAX = 4;

/** The drawing's staves: each line of a stave is the same curve, moved a little. */
const STAVE_CURVES = ['M-40 150 C 240 40 560 40 760 190 S 960 600 1000 860', 'M-40 790 C 140 730 320 700 520 760 S 760 860 860 900'];
const STAVE_LINES = [0, 11, 22, 33, 44].map((step) => `translate(${step} ${-step})`);
/** The logo's chord pills, sitting on the staves like notes: x, y, angle. */
const PILLS = [
  [210, 48, -14],
  [470, 44, 8],
  [690, 112, 30],
  [838, 330, 68],
  [902, 560, 74],
  [190, 690, -14],
  [470, 716, 12],
].map(([x, y, angle]) => ({ x, y, rotate: `rotate(${angle} ${x + 22} ${y + 10})` }));

/**
 * Main area when no song is open: a title set like a song (chords over the
 * words), the last songs opened, and music staves around them. Everything,
 * drawing included, takes its colours from the theme's tokens.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, SidebarToggle],
  template: `
    <div class="home">
      <!-- "slice": fills the area whatever its shape, always keeping the right edge, where the staves bend. -->
      <svg class="staves" viewBox="0 0 1000 800" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        @for (curve of curves; track curve) {
          @for (line of lines; track line) {
            <path class="stave-line" [attr.d]="curve" [attr.transform]="line" />
          }
        }
        @for (pill of pills; track pill.x) {
          <rect class="note" [attr.x]="pill.x" [attr.y]="pill.y" width="44" height="21" rx="10.5" [attr.transform]="pill.rotate" />
        }
      </svg>
      <div class="corner"><app-sidebar-toggle /></div>

      <div class="content" [class.play]="!layout.introPlaying()">
        <h1>@for (part of title; track $index) {<span class="part">@if (part.chord) {<b class="chord" aria-hidden="true">{{ part.chord }}</b>}{{ part.text }}</span>}</h1>

        @if (recentSongs().length) {
          <nav class="recents" [attr.aria-label]="recentTitle">
            <h2>{{ recentTitle }}</h2>
            @for (song of recentSongs(); track song.id) {
              <a class="recent" [routerLink]="['/canto', song.id]" (click)="closeOnNarrowScreen()">
                <span class="number">{{ numberLabel(song) }}</span>
                <span class="song-title">{{ song.title }}</span>
                @if (song.key) {
                  <b class="song-key">{{ song.key }}</b>
                }
              </a>
            }
          </nav>
        } @else {
          <p class="hint">@for (part of hint(); track $index) {<span class="part">@if (part.chord) {<b class="chord" aria-hidden="true">{{ part.chord }}</b>}{{ part.text }}</span>}</p>
        }
        <p class="key-hint"><kbd>/</kbd> {{ t.keyHint }}</p>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .home {
      position: relative;
      display: flex;
      height: 100%;
      overflow: hidden auto;
      background: var(--bg);
      color: var(--text);
    }
    .staves {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .stave-line {
      fill: none;
      stroke: color-mix(in srgb, var(--text) 17%, transparent);
      stroke-width: 1.5px;
      // Same thickness whatever the screen size.
      vector-effect: non-scaling-stroke;
    }
    .note {
      fill: var(--accent);
      opacity: 0.72;
    }
    .corner {
      position: absolute;
      z-index: 1;
      top: calc(max(14px, env(safe-area-inset-top)) + var(--top-gap));
      left: 14px;
    }
    .content {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
      width: 100%;
      max-width: calc(430px + 2 * var(--home-x));
      margin-block: auto;
      padding: var(--space-12) var(--home-x);
      --home-x: clamp(var(--space-12), 7vw, 96px);
    }

    // Chords over the words, built like the song sheet. An inline box keeps
    // the word in one piece: an inline-block would let it break in two.
    .part {
      position: relative;
    }
    .chord {
      position: absolute;
      bottom: 100%;
      left: 0;
      color: var(--accent);
      font-family: var(--font-body);
      font-style: normal;
      font-weight: 700;
      white-space: nowrap;
    }
    h1 {
      padding-top: 0.5em;
      font-size: clamp(40px, 6vw, 56px);
      font-style: italic;
      font-weight: 400;
      line-height: 1.12;
      white-space: nowrap;

      .chord {
        margin-bottom: var(--space-1);
        font-size: 24px;
      }
    }
    .hint {
      margin: 0;
      color: var(--text-muted);
      font-size: 22px;
      // Room for a chord over the second line if the text wraps.
      line-height: 2.2;

      .chord {
        bottom: 80%;
        font-size: 17px;
      }
    }
    .play .chord {
      animation: chord-in 0.55s cubic-bezier(0.3, 1.5, 0.5, 1) backwards;
    }
    .play .part:nth-child(3) .chord {
      animation-delay: 0.15s;
    }
    .play .hint .chord {
      animation-delay: 0.3s;
    }
    .play .hint .part:nth-child(3) .chord {
      animation-delay: 0.45s;
    }
    @keyframes chord-in {
      from {
        opacity: 0;
        translate: 0 -14px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .play .chord {
        animation: none;
      }
    }

    .recents {
      display: flex;
      flex-direction: column;

      h2 {
        margin-bottom: var(--space-1);
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 15px;
        font-weight: 700;
      }
    }
    .recent {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-height: 56px;
      border-top: 1px solid var(--border);
      color: var(--text);
      font-size: 20px;
      text-decoration: none;

      &:hover .song-title {
        color: var(--accent);
      }
    }
    .number {
      flex: none;
      min-width: 28px;
      color: var(--text-muted);
      font-size: 16px;
      font-variant-numeric: tabular-nums;
    }
    .song-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .song-key {
      flex: none;
      color: var(--accent);
      font-size: 16px;
    }

    // Only with a real keyboard: on a touch screen there is no "/" to press.
    .key-hint {
      display: none;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      color: var(--text-muted);
      font-size: 16px;
    }
    @media (hover: hover) and (pointer: fine) {
      .key-hint {
        display: flex;
      }
    }
    kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 26px;
      border: 1px solid var(--border);
      border-bottom-width: 2px;
      border-radius: 7px;
      background: var(--bg-elev-1);
      color: var(--text);
      font: 700 15px var(--font-body);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly library = inject(LibraryService);
  private readonly recent = inject(RecentService);
  protected readonly layout = inject(LayoutService);
  protected readonly t = IT.home;
  protected readonly title: readonly SheetPart[] = IT.home.title;
  protected readonly recentTitle = IT.library.recent;
  protected readonly numberLabel = numberLabel;
  protected readonly curves = STAVE_CURVES;
  protected readonly lines = STAVE_LINES;
  protected readonly pills = PILLS;

  protected readonly hint = computed<readonly SheetPart[]>(() => (this.layout.sidebarOpen() ? this.t.hint : this.t.hintClosed));

  /** The last songs opened that still exist. */
  protected readonly recentSongs = computed(() => {
    const byId = this.library.byId();
    return this.recent
      .ids()
      .map((id) => byId.get(id))
      .filter((song): song is Song => song !== undefined)
      .slice(0, HOME_RECENT_MAX);
  });

  /** On narrow screens the library covers the song: close it, as a tap in the library does. */
  protected closeOnNarrowScreen(): void {
    if (window.matchMedia('(max-width: 899px)').matches) this.layout.sidebarOpen.set(false);
  }
}
