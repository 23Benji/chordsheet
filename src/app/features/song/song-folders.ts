import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Song } from '../../core/models';
import { IT } from '../../i18n/it';
import { FolderService } from '../../services/folder.service';
import { LibraryService } from '../../services/library.service';
import { ToastService } from '../../services/toast.service';
import { FolderNameDialog } from '../../ui/folder-name-dialog';
import { Icon } from '../../ui/icon';
import { Popover } from '../../ui/popover';

/**
 * "Cartelle" on the song page: tick the folders the song belongs to. All
 * versions of the song (12, 12b …) are filed together. The panel stays open,
 * so several folders can be ticked in a row. On iPhone the button is hidden
 * (no room next to the title): "Cartelle…" in the ⋯ menu calls openSheet(),
 * which shows the same list as a bottom sheet.
 */
@Component({
  selector: 'app-song-folders',
  imports: [Icon, Popover, FolderNameDialog, NgTemplateOutlet],
  template: `
    <app-popover [label]="t.songMenu">
      <app-icon trigger [name]="memberOf().size ? 'folder' : 'folderPlus'" />
      <p class="panel-title">{{ t.songMenu }}</p>
      <ng-container *ngTemplateOutlet="list" />
    </app-popover>

    <dialog #sheet class="sheet" (click)="$event.target === sheet && sheet.close()" [attr.aria-label]="t.songMenu">
      <div class="sheet-panel">
        <p class="panel-title">{{ t.songMenu }}</p>
        <ng-container *ngTemplateOutlet="list" />
      </div>
      <button type="button" class="btn done" (click)="sheet.close()">{{ t.done }}</button>
    </dialog>

    <ng-template #list>
      @for (folder of folders.folders(); track folder.id) {
        @let on = memberOf().has(folder.id);
        <button type="button" class="menu-item" role="menuitemcheckbox" [attr.aria-checked]="on" (click)="toggle(folder.id, on)">
          <app-icon [name]="on ? 'circleCheck' : 'circle'" [class.on]="on" />
          <span class="name">{{ folder.name }}</span>
        </button>
      } @empty {
        <p class="empty">{{ t.noFolders }}</p>
      }
      <div class="menu-separator"></div>
      <button type="button" class="menu-item" (click)="createFolder()">
        <app-icon name="folderPlus" /> {{ t.newEllipsis }}
      </button>
    </ng-template>
    <app-folder-name-dialog />
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .on {
      color: var(--accent) !important;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty {
      max-width: 260px;
      margin: 0 6px 6px;
      color: var(--text-muted);
      font-size: 14px;
    }
    .sheet {
      width: 100vw;
      max-width: 100vw;
      margin: auto 0 0;
      padding: 8px 8px max(8px, env(safe-area-inset-bottom));
      border: none;
      background: transparent;
      color: var(--text);
    }
    .sheet::backdrop {
      background: var(--scrim);
    }
    .sheet-panel {
      max-height: 60dvh;
      overflow-y: auto;
      padding: 14px 6px 6px;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
    }
    .sheet-panel .panel-title {
      margin: 0 12px 8px;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .done {
      width: 100%;
      margin-top: 8px;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--accent);
    }
    @media (max-width: 600px) {
      app-popover {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongFolders {
  protected readonly folders = inject(FolderService);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);
  private readonly popover = viewChild.required(Popover);
  private readonly nameDialog = viewChild.required(FolderNameDialog);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  protected readonly t = IT.folders;

  readonly song = input.required<Song>();

  private readonly versionIds = computed(() => this.library.versionsOf(this.song()).map((s) => s.id));
  /** Folders holding this song or another version of it. */
  protected readonly memberOf = computed(() => {
    const ids = new Set(this.versionIds());
    return new Set(this.folders.folders().filter((f) => f.songIds.some((id) => ids.has(id))).map((f) => f.id));
  });

  protected async toggle(folderId: string, on: boolean): Promise<void> {
    const name = this.folders.byId().get(folderId)?.name ?? '';
    if (on) {
      await this.folders.removeSongs([folderId], this.versionIds());
      this.toast.show(this.t.removedFrom(this.song().title, name));
    } else {
      await this.folders.addSongs([folderId], this.versionIds());
      this.toast.show(this.t.addedTo(this.song().title, name));
    }
  }

  /** iPhone: the list as a bottom sheet (opened from the ⋯ menu). */
  openSheet(): void {
    this.sheet().nativeElement.showModal();
  }

  protected async createFolder(): Promise<void> {
    this.popover().close();
    this.sheet().nativeElement.close();
    const folder = await this.nameDialog().create(this.versionIds());
    if (folder) this.toast.show(this.t.addedTo(this.song().title, folder.name));
  }
}
