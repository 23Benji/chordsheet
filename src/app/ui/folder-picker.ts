import { ChangeDetectionStrategy, Component, inject, input, model, viewChild } from '@angular/core';
import { IT } from '../i18n/it';
import { FolderService } from '../services/folder.service';
import { FolderNameDialog } from './folder-name-dialog';
import { Icon } from './icon';

/**
 * Choose folders with toggle chips (new song, import). `model()` makes
 * `selected` a two-way binding: `<app-folder-picker [(selected)]="ids" />`.
 * "Nuova cartella" creates one and selects it right away.
 */
@Component({
  selector: 'app-folder-picker',
  imports: [Icon, FolderNameDialog],
  template: `
    <div class="picker" role="group" [attr.aria-label]="t.pickerLabel">
      @for (folder of folders.folders(); track folder.id) {
        @let on = selected().includes(folder.id);
        <button type="button" class="chip" [class.on]="on" [attr.aria-pressed]="on" (click)="toggle(folder.id)">
          <app-icon [name]="on ? 'check' : 'folder'" />
          {{ folder.name }}
        </button>
      }
      <button type="button" class="chip add" (click)="createFolder()">
        <app-icon name="folderPlus" /> {{ t.new }}
      </button>
    </div>
    @if (hint()) {
      <p class="hint">{{ hint() }}</p>
    }
    <app-folder-name-dialog />
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .picker {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      max-width: 100%;
    }
    .chip.add,
    .chip.add app-icon {
      color: var(--accent);
    }
    .hint {
      margin: 8px 0 0;
      color: var(--text-muted);
      font-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderPicker {
  protected readonly folders = inject(FolderService);
  private readonly nameDialog = viewChild.required(FolderNameDialog);
  protected readonly t = IT.folders;

  readonly selected = model<string[]>([]);
  readonly hint = input<string>('');

  protected toggle(id: string): void {
    this.selected.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected async createFolder(): Promise<void> {
    const folder = await this.nameDialog().create();
    if (folder) this.selected.update((ids) => [...ids, folder.id]);
  }
}
