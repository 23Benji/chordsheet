import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { currentPlatform, isIos } from '../../core/platform';
import { decodeSetlistLink } from '../../core/setlist-link';
import { formatSetlistDate, importSharedSetlist, SharedSetlist } from '../../core/setlists';
import { numberLabel } from '../../core/song-meta';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { SetlistService } from '../../services/setlist.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';

/**
 * A setlist received as a link / QR code (`/scaletta-condivisa#1.…`): shows
 * what it contains and which songs this library has, then adds it to the
 * setlists with one tap. Nothing is saved until "Aggiungi".
 */
@Component({
  selector: 'app-shared-setlist-page',
  imports: [RouterLink, Icon],
  template: `
    <div class="page">
      <nav class="top">
        <a class="back" routerLink="/scalette"><app-icon name="chevronLeft" /> {{ IT.setlists.title }}</a>
      </nav>
      @if (shared(); as shared) {
        <p class="eyebrow">{{ t.received }}</p>
        <h1>{{ shared.name }}</h1>
        <p class="meta">
          @if (shared.date) {
            {{ formatDate(shared.date) }} ·
          }
          {{ IT.setlists.count(shared.items.length) }}
        </p>

        <ol class="items">
          @for (row of preview(); track $index) {
            <li class="item" [class.missing]="!row.found">
              <span class="pos">{{ $index + 1 }}</span>
              @if (row.label) {
                <span class="pill" [class.pill-secondary]="!row.found">{{ row.label }}</span>
              }
              <span class="title">{{ row.title }}</span>
              @if (!row.found) {
                <span class="not-found">{{ t.notInLibrary }}</span>
              } @else if (row.transpose) {
                <span class="transpose">{{ row.transpose }}</span>
              }
            </li>
          }
        </ol>
        @if (inSafari) {
          <div class="app-hint">
            <p>{{ t.safariHint }}</p>
            <button type="button" class="btn btn-secondary" (click)="copyLink()"><app-icon name="copy" /> {{ t.copyLink }}</button>
          </div>
        }
        @if (missingCount() > 0) {
          <p class="warning">{{ t.missing(missingCount()) }}</p>
        }
        <div class="actions">
          <button type="button" class="btn btn-primary" [disabled]="missingCount() === shared.items.length" (click)="add(shared)">
            <app-icon name="plus" /> {{ t.add }}
          </button>
          <a class="btn btn-secondary" routerLink="/scalette">{{ IT.setlists.cancel }}</a>
        </div>
      } @else if (error()) {
        <div class="empty-state">
          <h1>{{ t.invalidTitle }}</h1>
          <p>{{ t.invalid }}</p>
          <a class="btn btn-secondary" routerLink="/scalette">{{ IT.setlists.title }}</a>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
    .page {
      max-width: 640px;
      margin: 0 auto;
      padding: calc(max(var(--space-4), env(safe-area-inset-top)) + var(--top-gap)) var(--page-x) var(--space-12);
    }
    .top {
      display: flex;
      min-height: var(--tap);
      align-items: center;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--text-muted);
      text-decoration: none;
    }
    .eyebrow {
      margin: var(--space-4) 0 var(--space-1);
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h1 {
      font-size: 28px;
      overflow-wrap: anywhere;
    }
    .meta {
      margin: var(--space-1) 0 var(--space-5);
      color: var(--text-muted);

      &::first-letter {
        text-transform: uppercase;
      }
    }
    .items {
      margin: 0;
      padding: 0;
      overflow: hidden;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      list-style: none;
    }
    .item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 52px;
      padding: var(--space-2) var(--space-4);

      & + & {
        box-shadow: 0 -1px 0 var(--border);
      }
      .pill {
        flex: none;
        font-size: 13px;
      }
      &.missing .title {
        color: var(--text-muted);
      }
    }
    .pos {
      width: 1.5em;
      color: var(--text-muted);
      text-align: right;
    }
    .title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .not-found {
      color: var(--coral);
      font-size: 13px;
    }
    .transpose {
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
    }
    .app-hint {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-m);
      background: var(--surface);
      font-size: 14px;

      p {
        margin: 0;
        color: var(--text-muted);
      }
    }
    .warning {
      margin: var(--space-3) 0 0;
      color: var(--text-muted);
      font-size: 14px;
    }
    .actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-5);

      .btn {
        flex: 1;
        min-height: 48px;
      }
    }
    .empty-state {
      padding: var(--space-10) 0;
      text-align: center;

      p {
        color: var(--text-muted);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedSetlistPage {
  private readonly library = inject(LibraryService);
  private readonly setlists = inject(SetlistService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly IT = IT;
  protected readonly t = IT.shareSetlist;
  protected readonly formatDate = formatSetlistDate;

  protected readonly shared = signal<SharedSetlist | null>(null);
  protected readonly error = signal(false);

  /** Each shared song as it will be added: found in this library or not. */
  protected readonly preview = computed(() => {
    const shared = this.shared();
    if (!shared) return [];
    const songs = this.library.songs();
    return shared.items.map((item) => {
      const one = importSharedSetlist({ ...shared, items: [item] }, songs);
      const song = one.setlist.items[0] ? this.library.byId().get(one.setlist.items[0].songId) : undefined;
      const t = item.transpose;
      return {
        found: !!song,
        label: song ? numberLabel(song) : item.number,
        title: song?.title ?? (item.title || this.t.unknownSong),
        transpose: t ? (t > 0 ? `+${t}` : `−${-t}`) : '',
      };
    });
  });
  protected readonly missingCount = computed(() => this.preview().filter((r) => !r.found).length);

  /**
   * iPhone/iPad, in Safari: links never open the home-screen app, and the
   * two keep separate data. Offer to copy the link and paste it in the app.
   */
  protected readonly inSafari = (() => {
    const p = currentPlatform();
    return isIos(p) && !p.standalone;
  })();

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(location.href);
      this.toast.show(this.t.copiedForApp, 6000);
    } catch {
      this.toast.show(this.t.copyFailed);
    }
  }

  constructor() {
    // The router knows the part after "#" (also when we arrive from "Incolla un link").
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    decodeSetlistLink(fragment ?? location.hash).then(
      (shared) => this.shared.set(shared),
      () => this.error.set(true),
    );
  }

  protected async add(shared: SharedSetlist): Promise<void> {
    const { setlist } = importSharedSetlist(shared, this.library.songs());
    await this.setlists.add(setlist);
    this.toast.show(IT.setlists.importDone(setlist.name));
    // Replace the link page in the history: Back from the new setlist goes to Scalette.
    void this.router.navigate(['/scalette', setlist.id], { replaceUrl: true });
  }
}
