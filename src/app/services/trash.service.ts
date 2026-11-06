import { Injectable, computed, inject, signal } from '@angular/core';
import { TrashEntry } from '../core/models';
import { byDeletedAt, expiredTrash } from '../core/trash';
import { DB } from '../data/db';

/**
 * The Cestino's list (deleted songs, newest first). LibraryService puts songs
 * in when they are deleted and takes them out when they are restored; this
 * service only keeps the list and removes entries for good.
 */
@Injectable({ providedIn: 'root' })
export class TrashService {
  private readonly db = inject(DB);
  private readonly _entries = signal<TrashEntry[]>([]);
  readonly entries = computed(() => [...this._entries()].sort(byDeletedAt));
  readonly count = computed(() => this._entries().length);

  /** At start-up: read the list and drop what is older than 30 days. */
  async load(now = Date.now()): Promise<void> {
    if (!this.db.trash) return; // test doubles without a Cestino
    const all = await this.db.trash.toArray();
    const expired = expiredTrash(all, now);
    if (expired.length) await this.db.trash.bulkDelete(expired);
    const gone = new Set(expired);
    this._entries.set(all.filter((e) => !gone.has(e.songId)));
  }

  /** Called by LibraryService after it stored new entries. */
  added(entries: readonly TrashEntry[]): void {
    const ids = new Set(entries.map((e) => e.songId));
    this._entries.update((list) => [...list.filter((e) => !ids.has(e.songId)), ...entries]);
  }

  /** Take entries out of the Cestino (restored, or deleted for good). */
  async remove(songIds: readonly string[]): Promise<void> {
    if (!songIds.length || !this.db.trash) return;
    await this.db.trash.bulkDelete([...songIds]);
    const gone = new Set(songIds);
    this._entries.update((list) => list.filter((e) => !gone.has(e.songId)));
  }
}
