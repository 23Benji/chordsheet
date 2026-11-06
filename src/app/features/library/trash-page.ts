import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrashEntry } from '../../core/models';
import { numberLabel } from '../../core/song-meta';
import { trashDaysLeft } from '../../core/trash';
import { IT } from '../../i18n/it';
import { LibraryService } from '../../services/library.service';
import { ToastService } from '../../services/toast.service';
import { TrashService } from '../../services/trash.service';
import { ActionSheet } from '../../ui/action-sheet';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icon';

const DAY = 24 * 60 * 60 * 1000;

/**
 * "Cestino": songs deleted in the last 30 days, newest first. Each can be
 * restored (one tap on "Ripristina") or deleted for good (tap the row).
 * Like "Eliminati di recente" in the iPhone's Notes and Photos.
 */
@Component({
  selector: 'app-trash-page',
  imports: [RouterLink, Icon, ActionSheet, ConfirmDialog],
  template: `
    <div class="page">
      <nav class="top">
        <a class="btn icon-btn back" routerLink="/" [attr.aria-label]="t.back" [title]="t.back"><app-icon name="chevronLeft" /></a>
        <h1>{{ t.title }}</h1>
        @if (trash.count()) {
          <button type="button" class="btn danger-text" (click)="emptyTrash()">{{ t.emptyTrash }}</button>
        }
      </nav>

      @if (!trash.count()) {
        <div class="empty-state">
          <span class="empty-icon"><app-icon name="trash" /></span>
          <h2>{{ t.emptyTitle }}</h2>
          <p>{{ t.empty }}</p>
        </div>
      } @else {
        <p class="hint">{{ t.hint }}</p>
        <div class="list-group">
          @for (entry of trash.entries(); track entry.songId) {
            <div class="list-row clickable" role="button" tabindex="0" (click)="openEntry(entry)" (keydown.enter)="openEntry(entry)">
              <span class="pill">{{ numberLabel(entry.song) }}</span>
              <span class="row-text">
                <span class="row-label">{{ entry.song.title }}</span>
                <span class="row-hint">{{ t.deletedAgo(daysAgo(entry)) }} · {{ t.daysLeft(daysLeft(entry)) }}</span>
              </span>
              <button type="button" class="btn btn-secondary" (click)="$event.stopPropagation(); restore([entry.songId])">{{ t.restore }}</button>
            </div>
          }
        </div>
        @if (trash.count() > 1) {
          <div class="all">
            <button type="button" class="btn btn-secondary" (click)="restoreAll()"><app-icon name="restore" /> {{ t.restoreAll }}</button>
          </div>
        }
      }
    </div>
    <app-action-sheet />
    <app-confirm-dialog />
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: calc(max(var(--space-5), env(safe-area-inset-top)) + var(--top-gap)) var(--page-x) var(--space-12);
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-left: calc(-1 * var(--space-2));

      h1 {
        flex: 1;
        font-size: 30px;
      }
    }
    .danger-text {
      color: var(--coral);
    }
    .hint {
      margin: var(--space-2) var(--space-1) var(--space-4);
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.4;
    }
    .list-row .pill {
      flex: none;
      min-width: 36px;
    }
    .row-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .all {
      display: flex;
      justify-content: center;
      margin-top: var(--space-5);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashPage {
  protected readonly trash = inject(TrashService);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);
  private readonly sheet = viewChild.required(ActionSheet);
  private readonly dialog = viewChild.required(ConfirmDialog);
  protected readonly t = IT.trash;
  protected readonly numberLabel = numberLabel;

  protected daysAgo(entry: TrashEntry): number {
    return Math.floor((Date.now() - entry.deletedAt) / DAY);
  }

  protected daysLeft(entry: TrashEntry): number {
    return trashDaysLeft(entry, Date.now());
  }

  protected async restore(songIds: string[]): Promise<void> {
    const n = await this.library.restoreFromTrash(songIds);
    if (n) this.toast.show(this.t.restored(n));
  }

  protected restoreAll(): Promise<void> {
    return this.restore(this.trash.entries().map((e) => e.songId));
  }

  protected async openEntry(entry: TrashEntry): Promise<void> {
    const choice = await this.sheet().choose(
      entry.song.title,
      [
        { id: 'restore', label: this.t.restore, icon: 'restore' },
        { id: 'delete', label: this.t.deleteForever, icon: 'trash', danger: true, divider: true },
      ],
      this.t.cancel,
    );
    if (choice === 'restore') await this.restore([entry.songId]);
    else if (choice === 'delete' && (await this.dialog().ask({ ...this.t.confirmDelete(entry.song.title), danger: true }))) {
      await this.trash.remove([entry.songId]);
    }
  }

  protected async emptyTrash(): Promise<void> {
    const ids = this.trash.entries().map((e) => e.songId);
    if (await this.dialog().ask({ ...this.t.confirmEmpty(ids.length), danger: true })) await this.trash.remove(ids);
  }
}
