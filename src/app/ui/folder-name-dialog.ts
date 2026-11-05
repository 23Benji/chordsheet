import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { cleanFolderName, folderNameTaken } from '../core/folders';
import { Folder } from '../core/models';
import { IT } from '../i18n/it';
import { FolderService } from '../services/folder.service';

/**
 * Asks for a folder name (new folder or rename) in a small native <dialog>.
 * Usage: `const folder = await this.nameDialog().create(songIds);` — resolves
 * to null when cancelled. Refuses empty names and names already in use.
 */
@Component({
  selector: 'app-folder-name-dialog',
  template: `
    <dialog #dialog (close)="settle(null)" (click)="onBackdrop($event)" aria-labelledby="folder-name-title">
      <form class="body" (submit)="$event.preventDefault(); submit(name.value)">
        <h2 id="folder-name-title">{{ renaming() ? t.renameTitle : t.newTitle }}</h2>
        <label class="field">
          <span>{{ t.label }}</span>
          <input
            #name
            type="text"
            autocomplete="off"
            enterkeyhint="done"
            maxlength="60"
            [placeholder]="t.placeholder"
            [value]="initial()"
            (input)="error.set(null)"
          />
        </label>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <div class="actions">
          <button type="button" class="btn" (click)="settle(null)">{{ t.cancel }}</button>
          <button type="submit" class="btn btn-primary">{{ renaming() ? t.save : t.create }}</button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(400px, calc(100vw - 32px));
      padding: 0;
      border: none;
      border-radius: var(--radius-l);
      background: var(--bg-elev-1);
      color: var(--text);
      box-shadow: var(--shadow);
    }
    dialog::backdrop {
      background: var(--scrim);
    }
    .body {
      padding: var(--space-6);
    }
    h2 {
      margin-bottom: var(--space-3);
      font-size: 22px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      color: var(--text-muted);
      font-size: 13px;
    }
    input {
      height: 44px;
      padding: 0 var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-s);
      background: var(--surface);
      font-size: 16px;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .error {
      margin: var(--space-2) 0 0;
      color: var(--coral);
      font-size: 14px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-5);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderNameDialog {
  private readonly folders = inject(FolderService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('name');
  protected readonly t = IT.folders.namePrompt;

  protected readonly renaming = signal<Folder | null>(null);
  protected readonly initial = signal('');
  protected readonly error = signal<string | null>(null);
  private resolve: ((name: string | null) => void) | null = null;

  /** New folder (optionally already containing these songs); null if cancelled. */
  async create(songIds: readonly string[] = []): Promise<Folder | null> {
    const name = await this.ask(null);
    return name === null ? null : this.folders.create(name, songIds);
  }

  async rename(folder: Folder): Promise<void> {
    const name = await this.ask(folder);
    if (name !== null && name !== folder.name) await this.folders.rename(folder, name);
  }

  private ask(folder: Folder | null): Promise<string | null> {
    this.renaming.set(folder);
    this.initial.set(folder?.name ?? '');
    this.error.set(null);
    const input = this.input().nativeElement;
    input.value = folder?.name ?? '';
    this.dialog().nativeElement.showModal();
    input.focus();
    input.select();
    return new Promise((resolve) => (this.resolve = resolve));
  }

  protected submit(raw: string): void {
    const name = cleanFolderName(raw);
    if (!name) return this.input().nativeElement.focus();
    if (folderNameTaken(this.folders.folders(), name, this.renaming()?.id)) {
      this.error.set(this.t.taken);
      return;
    }
    this.settle(name);
  }

  protected settle(name: string | null): void {
    const resolve = this.resolve;
    this.resolve = null;
    if (this.dialog().nativeElement.open) this.dialog().nativeElement.close();
    resolve?.(name);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.settle(null);
  }
}
