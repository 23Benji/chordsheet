import { Injectable, inject } from '@angular/core';
import { ImportedFiles, classifyFiles } from '../core/songbook-file';
import { IT } from '../i18n/it';
import { BackupService } from './backup.service';
import { LibraryService } from './library.service';

export type ConflictPolicy = 'replace' | 'keepBoth' | 'skip';

/** Importing chosen files (songbook files, .cho files, backups) — shared by the welcome screen and Impostazioni. */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly library = inject(LibraryService);
  private readonly backup = inject(BackupService);

  async read(files: FileList | readonly File[]): Promise<ImportedFiles> {
    const list = await Promise.all(Array.from(files).map(async (f) => ({ name: f.name, text: await f.text() })));
    return classifyFiles(list);
  }

  conflicts(files: ImportedFiles): number {
    return this.library.countConflicts(files.songs);
  }

  /** Imports everything; returns the message to show. */
  async apply(files: ImportedFiles, policy: ConflictPolicy): Promise<string> {
    for (const backup of files.backups) await this.backup.restore(backup, 'merge');
    const result = await this.library.importEntries(files.songs, policy);
    const t = IT.importFiles;
    const parts = [
      result.added && t.added(result.added),
      result.replaced && t.replaced(result.replaced),
      result.skipped && t.skipped(result.skipped),
      files.backups.length && t.backups(files.backups.length),
      files.rejected.length && t.rejected(files.rejected.length),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : t.nothing;
  }
}
