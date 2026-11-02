import { Injectable, computed, inject, signal } from '@angular/core';
import { Setlist, SetlistItem } from '../core/models';
import { duplicateSetlist, newItem, newSetlist } from '../core/setlists';
import { DB } from '../data/db';
import { IT } from '../i18n/it';

/** Setlists ("scalette"), most recently changed first. */
@Injectable({ providedIn: 'root' })
export class SetlistService {
  private readonly db = inject(DB);
  private readonly _setlists = signal<Setlist[]>([]);

  readonly setlists = computed(() => [...this._setlists()].sort((a, b) => b.updatedAt - a.updatedAt));
  readonly byId = computed(() => new Map(this._setlists().map((s) => [s.id, s])));

  async load(): Promise<void> {
    this._setlists.set(await this.db.setlists.toArray());
  }

  /**
   * Updates memory first (so quick successive edits build on each other and
   * the UI reacts instantly), then IndexedDB.
   */
  private async put(setlist: Setlist): Promise<Setlist> {
    this._setlists.update((list) => [...list.filter((s) => s.id !== setlist.id), setlist]);
    await this.db.setlists.put(setlist);
    return setlist;
  }

  create(name: string, date?: string): Promise<Setlist> {
    return this.put(newSetlist(name, date));
  }

  /** Saves a changed setlist (name, date, items …). */
  update(setlist: Setlist, patch: Partial<Omit<Setlist, 'id' | 'createdAt'>>): Promise<Setlist> {
    return this.put({ ...setlist, ...patch, updatedAt: Date.now() });
  }

  updateItems(setlist: Setlist, items: SetlistItem[]): Promise<Setlist> {
    return this.update(setlist, { items });
  }

  addSong(setlist: Setlist, songId: string): Promise<Setlist> {
    return this.updateItems(setlist, [...setlist.items, newItem(songId)]);
  }

  duplicate(setlist: Setlist): Promise<Setlist> {
    return this.put(duplicateSetlist(setlist, IT.setlists.copySuffix));
  }

  /** Stores an imported setlist as a new one. */
  add(setlist: Setlist): Promise<Setlist> {
    return this.put(setlist);
  }

  async remove(id: string): Promise<void> {
    await this.db.setlists.delete(id);
    this._setlists.update((list) => list.filter((s) => s.id !== id));
  }
}
