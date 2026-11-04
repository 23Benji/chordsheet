import { Injectable, computed, inject, signal } from '@angular/core';
import { newFolder, sortFolders, withSongs, withoutSongs } from '../core/folders';
import { Folder } from '../core/models';
import { DB } from '../data/db';

/**
 * Folders ("cartelle"), alphabetical. Methods take song ids; callers pass all
 * versions of a song (LibraryService.versionsOf) so a song and its 12b/12c
 * versions are always filed together.
 */
@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly db = inject(DB);
  private readonly _folders = signal<Folder[]>([]);

  readonly folders = computed(() => sortFolders(this._folders()));
  readonly byId = computed(() => new Map(this._folders().map((f) => [f.id, f])));

  /**
   * The folder shown in the library (null = all songs). Kept here, not in the
   * library component, so "Nuovo canto" and imports can offer it as default.
   */
  readonly current = signal<string | null>(null);
  readonly currentFolder = computed(() => {
    const id = this.current();
    return id ? (this.byId().get(id) ?? null) : null;
  });

  async load(): Promise<void> {
    this._folders.set((await this.db.folders?.toArray()) ?? []);
    if (this.current() && !this.byId().has(this.current()!)) this.current.set(null);
  }

  /** Memory first (the UI reacts at once and quick edits build on each other), then IndexedDB. */
  private async put(...folders: Folder[]): Promise<void> {
    const ids = new Set(folders.map((f) => f.id));
    this._folders.update((list) => [...list.filter((f) => !ids.has(f.id)), ...folders]);
    await this.db.folders.bulkPut(folders);
  }

  async create(name: string, songIds: readonly string[] = []): Promise<Folder> {
    const folder = newFolder(name, songIds);
    await this.put(folder);
    return folder;
  }

  rename(folder: Folder, name: string): Promise<void> {
    return this.put({ ...folder, name: name.trim(), updatedAt: Date.now() });
  }

  /** Deletes the folder only; its songs stay in the library. */
  async remove(id: string): Promise<void> {
    if (this.current() === id) this.current.set(null);
    this._folders.update((list) => list.filter((f) => f.id !== id));
    await this.db.folders.delete(id);
  }

  async addSongs(folderIds: readonly string[], songIds: readonly string[]): Promise<void> {
    const changed = this.changed(folderIds, (f) => withSongs(f, songIds));
    if (changed.length) await this.put(...changed);
  }

  async removeSongs(folderIds: readonly string[], songIds: readonly string[]): Promise<void> {
    const changed = this.changed(folderIds, (f) => withoutSongs(f, songIds));
    if (changed.length) await this.put(...changed);
  }

  /** Takes the songs out of `fromId` and puts them in `toId`. */
  async moveSongs(fromId: string, toId: string, songIds: readonly string[]): Promise<void> {
    if (fromId === toId) return;
    const from = this.byId().get(fromId);
    const to = this.byId().get(toId);
    if (!from || !to) return;
    await this.put(withoutSongs(from, songIds), withSongs(to, songIds));
  }

  /** A deleted song leaves every folder. */
  async forgetSong(songId: string): Promise<void> {
    await this.removeSongs(
      this._folders().filter((f) => f.songIds.includes(songId)).map((f) => f.id),
      [songId],
    );
  }

  private changed(folderIds: readonly string[], change: (f: Folder) => Folder): Folder[] {
    const byId = this.byId();
    return folderIds
      .map((id) => byId.get(id))
      .filter((f): f is Folder => !!f)
      .map((f) => [f, change(f)] as const)
      .filter(([before, after]) => before !== after)
      .map(([, after]) => after);
  }
}
