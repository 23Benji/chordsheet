import { ChangeDetectionStrategy, Component, inject, input, viewChild } from '@angular/core';
import { Song } from '../../core/models';
import { formatSetlistDate } from '../../core/setlists';
import { IT } from '../../i18n/it';
import { SetlistService } from '../../services/setlist.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';
import { Popover } from '../../ui/popover';

/** "Aggiungi a una scaletta": menu of setlists (shared Popover pattern). */
@Component({
  selector: 'app-add-to-setlist',
  imports: [Icon, Popover],
  template: `
    <app-popover [label]="t.addToSetlist" [menu]="true">
      <app-icon trigger name="listAdd" />
      <p class="panel-title">{{ t.addToSetlist }}</p>
      @for (setlist of service.setlists(); track setlist.id) {
        <button type="button" class="menu-item" role="menuitem" (click)="add(setlist.id)">
          <app-icon name="list" />
          <span class="item-text">
            {{ setlist.name }}
            @if (setlist.date) {
              <small>{{ formatDate(setlist.date) }}</small>
            }
          </span>
        </button>
      }
      @if (service.setlists().length) {
        <div class="menu-separator"></div>
      }
      <button type="button" class="menu-item" role="menuitem" (click)="addToNew()">
        <app-icon name="plus" /> {{ t.newWithSong }}
      </button>
    </app-popover>
  `,
  styles: `
    .item-text {
      display: flex;
      flex-direction: column;

      small {
        color: var(--text-muted);
        font-size: 12px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToSetlist {
  protected readonly service = inject(SetlistService);
  private readonly toast = inject(ToastService);
  private readonly popover = viewChild.required(Popover);
  protected readonly t = IT.setlists;
  protected readonly formatDate = formatSetlistDate;

  readonly song = input.required<Song>();

  protected async add(setlistId: string): Promise<void> {
    const setlist = this.service.byId().get(setlistId);
    if (!setlist) return;
    this.popover().close();
    await this.service.addSong(setlist, this.song().id);
    this.toast.show(this.t.added(this.song().title, setlist.name));
  }

  protected async addToNew(): Promise<void> {
    const setlist = await this.service.create(this.t.defaultName, new Date().toISOString().slice(0, 10));
    await this.add(setlist.id);
  }
}
