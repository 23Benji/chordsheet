import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Song } from '../../core/models';
import { searchSongs } from '../../core/search';
import { compareByNumber, numberLabel } from '../../core/song-meta';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { Icon } from '../../ui/icon';

/**
 * "Aggiungi canti": a native <dialog> with a search box at the top and the
 * library below. On the iPhone it is a tall sheet that starts under the
 * status bar (like iOS "page sheets"), so the search box stays visible above
 * the keyboard; on bigger screens a centred panel. It stays open, so several
 * songs can be added in a row; each tap shows a tick and the count.
 * With [single] it picks just one song (e.g. "In quale canto?" for a solo):
 * the parent closes it after (add).
 */
@Component({
  selector: 'app-add-songs-sheet',
  imports: [Icon],
  template: `
    <dialog #dialog class="sheet" (close)="onClose()" (click)="onBackdrop($event)" [attr.aria-label]="heading() ?? t.addSongs">
      <header class="bar">
        <h2>{{ heading() ?? t.addSongs }}</h2>
        <button type="button" class="btn done" (click)="close()">{{ single() ? cancel : t.done }}</button>
      </header>
      <div class="search">
        <app-icon name="search" class="search-icon" />
        <input
          #search
          type="search"
          autocomplete="off"
          enterkeyhint="done"
          [placeholder]="t.searchPlaceholder"
          [attr.aria-label]="t.searchPlaceholder"
          (input)="query.set(search.value)"
          (keydown.enter)="onEnter()"
        />
      </div>
      <ul class="results">
        @for (song of results(); track song.id) {
          @let count = counts().get(song.id) ?? 0;
          <li>
            <button type="button" class="result" [class.in]="count > 0" (click)="pick(song)" [attr.aria-label]="single() ? song.title : t.add(song.title)">
              @if (numberLabel(song); as label) {
                <span class="pill">{{ label }}</span>
              }
              <span class="result-title">{{ song.title }}</span>
              @if (count > 0) {
                <span class="in-setlist">
                  <app-icon name="check" />
                  @if (count > 1) {
                    ×{{ count }}
                  }
                </span>
              } @else if (single()) {
                <app-icon name="chevronRight" class="plus" />
              } @else {
                <app-icon name="plus" class="plus" />
              }
            </button>
          </li>
        } @empty {
          <li class="none">{{ t.noResults }}</li>
        }
      </ul>
    </dialog>
  `,
  styles: `
    .sheet {
      display: none;
      flex-direction: column;
      width: min(560px, calc(100vw - 32px));
      height: min(720px, 80dvh);
      padding: 0;
      border: none;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--text);
      box-shadow: var(--shadow);

      &[open] {
        display: flex;
      }
    }
    .sheet::backdrop {
      background: var(--scrim);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-2) var(--space-2) var(--space-5);

      h2 {
        font-size: 18px;
      }
    }
    .done {
      color: var(--accent);
    }
    .search {
      position: relative;
      margin: 0 var(--space-4) var(--space-2);

      input {
        width: 100%;
        height: 44px;
        padding: 0 var(--space-4) 0 var(--space-10);
        border: 1px solid transparent;
        border-radius: var(--radius-m);
        background: var(--surface);
        font-size: 16px; // 16 px: iOS doesn't zoom into the page on focus

        &:focus {
          outline: none;
          border-color: var(--accent);
        }
      }
    }
    .search-icon {
      position: absolute;
      top: 12px;
      left: 14px;
      color: var(--text-muted);
    }
    .results {
      flex: 1;
      margin: 0;
      padding: 0 var(--space-2) var(--space-4);
      overflow-y: auto;
      list-style: none;
      overscroll-behavior: contain;
    }
    .result {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: 48px;
      padding: var(--space-2) var(--space-3);
      border: none;
      border-radius: var(--radius-m);
      background: transparent;
      text-align: left;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: var(--surface);
      }

      .pill {
        flex: none;
        min-width: 3.1em;
        font-size: 14px;
      }
    }
    .result-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .plus,
    .in-setlist {
      flex: none;
      color: var(--accent);
    }
    .in-setlist {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: 13px;
      font-weight: 700;
    }
    .none {
      padding: var(--space-6) var(--space-4);
      color: var(--text-muted);
      text-align: center;
    }
    @media (max-width: 600px) {
      .sheet {
        width: 100vw;
        max-width: 100vw;
        height: auto;
        max-height: none;
        margin: calc(max(var(--space-3), env(safe-area-inset-top)) + var(--space-3)) 0 0;
        border-radius: var(--radius-l) var(--radius-l) 0 0;
        inset: 0;
      }
      .results {
        padding-bottom: max(var(--space-4), env(safe-area-inset-bottom));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddSongsSheet {
  private readonly library = inject(LibraryService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  protected readonly t = IT.setlists;
  protected readonly numberLabel = numberLabel;

  /** Song ids already in the setlist (a song can be there more than once). */
  readonly songIds = input<readonly string[]>([]);
  /** Title instead of "Aggiungi canti". */
  readonly heading = input<string>();
  /** One song only: "Annulla" instead of "Fine", a chevron instead of "+". */
  readonly single = input(false);
  readonly add = output<Song>();
  protected readonly cancel = IT.notes.cancel;

  protected readonly query = signal('');
  protected readonly counts = computed(() => {
    const counts = new Map<string, number>();
    for (const id of this.songIds()) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  });
  private readonly sorted = computed(() => [...this.library.songs()].sort(compareByNumber));
  /** With an empty search box: the whole library by number, to browse. */
  protected readonly results = computed(() => {
    const songs = this.sorted();
    if (!this.query().trim()) return songs;
    const entries = new Map(this.library.searchEntries().map((e) => [e.id, e]));
    const byId = this.library.byId();
    return searchSongs(songs.map((s) => entries.get(s.id)!), this.query()).map((id) => byId.get(id)!);
  });

  /** Called from a tap: focusing right away is what lets iOS open the keyboard. */
  open(): void {
    const input = this.searchInput().nativeElement;
    input.value = '';
    this.query.set('');
    this.dialog().nativeElement.showModal();
    input.focus();
  }

  close(): void {
    if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
  }

  protected pick(song: Song): void {
    this.add.emit(song);
  }

  /** Enter (or "Fine" on the iPhone keyboard): add the first match, clear the box for the next one. */
  protected onEnter(): void {
    if (!this.query().trim()) return;
    const first = this.results()[0];
    if (!first) return;
    this.add.emit(first);
    this.searchInput().nativeElement.value = '';
    this.query.set('');
  }

  protected onClose(): void {
    this.query.set('');
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
