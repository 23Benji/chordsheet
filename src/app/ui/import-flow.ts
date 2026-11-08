import { ChangeDetectionStrategy, Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { currentPlatform, songImportAccept } from '../core/platform';
import { ImportedFiles } from '../core/songbook-file';
import { IT } from '../i18n/it';
import { BackupService, RestoreMode } from '../services/backup.service';
import { FolderService } from '../services/folder.service';
import { ConflictPolicy, ImportService } from '../services/import.service';
import { ToastService } from '../services/toast.service';
import { ConfirmDialog } from './confirm-dialog';
import { FolderPicker } from './folder-picker';
import { Icon } from './icon';

/**
 * Importing files, from choosing them to the result: songs → which folder and
 * what to do with the ones already here; a backup → add or replace. Shared by
 * the "+" of the library and "Importa" in Impostazioni.
 * Usage: put <app-import-flow /> in the page and call pick() from a tap.
 */
@Component({
  selector: 'app-import-flow',
  imports: [ConfirmDialog, FolderPicker, Icon],
  templateUrl: './import-flow.html',
  styleUrl: './import-flow.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportFlow {
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly importer = inject(ImportService);
  private readonly folders = inject(FolderService);
  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');
  private readonly importDialog = viewChild.required<ElementRef<HTMLDialogElement>>('importDialog');
  private readonly restoreDialog = viewChild.required<ElementRef<HTMLDialogElement>>('restoreDialog');
  private readonly dialog = viewChild.required(ConfirmDialog);

  /** Something was imported or restored. */
  readonly finished = output<void>();

  protected readonly t = IT.settings;
  protected readonly it = IT.importFiles;
  protected readonly ft = IT.folders;
  protected readonly accept = songImportAccept(currentPlatform(), IT.importFiles.accept);

  /** Files chosen, waiting for the folder choice (and what to do with songs that already exist). */
  protected readonly pendingImport = signal<{ files: ImportedFiles; conflicts: number } | null>(null);
  /** Folders for the songs being imported; starts with the folder open in the library. */
  protected readonly importFolders = signal<string[]>([]);
  /** Backup file chosen, waiting for "Unisci" or "Sostituisci". */
  protected readonly pendingRestore = signal<{ name: string; json: string } | null>(null);
  protected readonly busy = signal(false);

  /** Opens the file picker. Must run inside a tap or click, or the browser refuses. */
  pick(): void {
    this.file().nativeElement.click();
  }

  protected async chooseFiles(input: HTMLInputElement): Promise<void> {
    const list = input.files;
    if (!list?.length) return;
    const name = list[0].name;
    const files = await this.importer.read(list);
    input.value = '';
    if (!files.songs.length && files.backups.length === 1) {
      // A backup: ask whether to add it to what is here or to replace everything.
      this.pendingRestore.set({ name, json: files.backups[0] });
      this.restoreDialog().nativeElement.showModal();
      return;
    }
    if (!files.songs.length) {
      // Only backups (or unknown files): nothing to file in a folder.
      await this.runImport(files, 'skip');
      return;
    }
    const current = this.folders.current();
    this.importFolders.set(current ? [current] : []);
    this.pendingImport.set({ files, conflicts: this.importer.conflicts(files) });
    this.importDialog().nativeElement.showModal();
  }

  protected async resolveImport(policy: ConflictPolicy | null): Promise<void> {
    const pending = this.pendingImport();
    this.importDialog().nativeElement.close();
    this.pendingImport.set(null);
    if (pending && policy) await this.runImport(pending.files, policy, this.importFolders());
  }

  private async runImport(files: ImportedFiles, policy: ConflictPolicy, folderIds: string[] = []): Promise<void> {
    this.busy.set(true);
    try {
      this.toast.show(await this.importer.apply(files, policy, folderIds), 6000);
    } finally {
      this.busy.set(false);
      this.finished.emit();
    }
  }

  protected closeRestore(): void {
    this.restoreDialog().nativeElement.close();
    this.pendingRestore.set(null);
  }

  protected async restore(mode: RestoreMode): Promise<void> {
    const pending = this.pendingRestore();
    if (!pending) return;
    if (mode === 'replace') {
      this.restoreDialog().nativeElement.close();
      if (!(await this.dialog().ask({ ...this.t.confirmReplace, danger: true }))) return this.pendingRestore.set(null);
    }
    this.busy.set(true);
    try {
      const data = await this.backup.restore(pending.json, mode);
      this.toast.show(this.t.restored(data.songs.length, data.setlists.length));
    } catch {
      this.toast.show(this.t.restoreError);
    } finally {
      this.busy.set(false);
      this.closeRestore();
      this.finished.emit();
    }
  }
}
