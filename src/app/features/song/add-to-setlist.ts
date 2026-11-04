import { ChangeDetectionStrategy, Component, inject, input, viewChild } from '@angular/core';
import { Song } from '../../core/models';
import { formatSetlistDate } from '../../core/setlists';
import { IT } from '../../i18n/it';
import { SetlistService } from '../../services/setlist.service';
import { ToastService } from '../../services/toast.service';
import { Icon } from '../../ui/icon';
import { Popover } from '../../ui/popover';
import { ActionSheet, SheetAction } from '../../ui/action-sheet';

/**
 * "Aggiungi a una scaletta": menu of setlists (shared Popover pattern).
 * iPhone: no button in the bar; "Aggiungi a una scaletta…" in the ⋯ menu
 * calls openSheet(), which shows the same choices as a bottom sheet.
 */
@Component({
  selector: 'app-add-to-setlist',
  imports: [Icon, Popover, ActionSheet],
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
    <app-action-sheet />
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    @media (max-width: 600px) {
      app-popover {
        display: none;
      }
    }
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
  private readonly sheet = viewChild.required(ActionSheet);
  protected readonly t = IT.setlists;
  protected readonly formatDate = formatSetlistDate;

  readonly song = input.required<Song>();

  async openSheet(): Promise<void> {
    const actions: SheetAction[] = [
      ...this.service.setlists().map((s): SheetAction => ({ id: s.id, label: s.name, icon: 'list' })),
      { id: 'new', label: this.t.newWithSong, icon: 'plus', divider: this.service.setlists().length > 0 },
    ];
    const choice = await this.sheet().choose(this.t.addToSetlist, actions, this.t.cancel);
    if (choice === 'new') await this.addToNew();
    else if (choice) await this.add(choice);
  }

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
