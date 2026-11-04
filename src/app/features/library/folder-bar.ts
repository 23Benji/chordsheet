import { ChangeDetectionStrategy, Component, computed, inject, output, viewChild } from '@angular/core';
import { folderEntries } from '../../core/folders';
import { IT } from '../../i18n/it';
import { FolderService } from '../../services/folder.service';
import { LibraryService } from '../../services/library.service';
import { FolderNameDialog } from '../../ui/folder-name-dialog';
import { Icon } from '../../ui/icon';

/**
 * The library's folder filter: "Tutti i canti", one chip per folder (with how
 * many songs it holds) and "+" for a new folder. One row that scrolls
 * sideways when there are many folders — the page itself never gets wider.
 */
@Component({
  selector: 'app-folder-bar',
  imports: [Icon, FolderNameDialog],
  template: `
    <div class="folders" role="radiogroup" [attr.aria-label]="t.title">
      <button type="button" class="chip" role="radio" [class.on]="!current()" [attr.aria-checked]="!current()" (click)="show(null)">
        {{ t.all }}
      </button>
      @for (f of folders.folders(); track f.id) {
        @let on = current() === f.id;
        <button type="button" class="chip" role="radio" [class.on]="on" [attr.aria-checked]="on" (click)="show(f.id)">
          <app-icon name="folder" />
          <span class="name">{{ f.name }}</span>
          <span class="count">{{ counts().get(f.id) }}</span>
        </button>
      }
      <button type="button" class="chip add" (click)="create()" [attr.aria-label]="t.new" [title]="t.new">
        <app-icon name="folderPlus" />
        @if (!folders.folders().length) {
          {{ t.new }}
        }
      </button>
    </div>
    <app-folder-name-dialog />
  `,
  styles: `
    .folders {
      display: flex;
      gap: 8px;
      padding: 0 16px 2px;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }
    .folders::-webkit-scrollbar {
      display: none;
    }
    .name {
      max-width: 14em;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .count {
      color: var(--text-muted);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    .on .count,
    .add,
    .add app-icon {
      color: var(--accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderBar {
  protected readonly folders = inject(FolderService);
  private readonly library = inject(LibraryService);
  private readonly nameDialog = viewChild.required(FolderNameDialog);
  protected readonly t = IT.folders;
  protected readonly current = this.folders.current;

  /** Emitted when another folder is shown. */
  readonly changed = output<void>();

  /** Library entries (one per song, versions together) in each folder. */
  protected readonly counts = computed(() => {
    const byId = this.library.byId();
    return new Map(this.folders.folders().map((f) => [f.id, folderEntries(f, byId).size]));
  });

  protected show(id: string | null): void {
    this.current.set(id);
    this.changed.emit();
  }

  protected async create(): Promise<void> {
    const folder = await this.nameDialog().create();
    if (folder) this.show(folder.id);
  }
}
