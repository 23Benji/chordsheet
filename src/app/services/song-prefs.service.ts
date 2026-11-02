import { Injectable, computed, inject, signal } from '@angular/core';
import { SongPrefs } from '../core/models';
import { DB } from '../data/db';

const DEFAULT_PREFS: Omit<SongPrefs, 'songId'> = { transpose: 0, capo: 0 };

/** Per-song playback settings (transpose, capo, font size …), persisted in IndexedDB. */
@Injectable({ providedIn: 'root' })
export class SongPrefsService {
  private readonly db = inject(DB);
  private readonly prefs = signal<ReadonlyMap<string, SongPrefs>>(new Map());

  /** Songs with a Promemoria (counted as personal notes in the library). */
  readonly songsWithMemo = computed(
    () => new Set([...this.prefs().values()].filter((p) => p.memo?.trim()).map((p) => p.songId)),
  );

  async load(): Promise<void> {
    const all = await this.db.songPrefs.toArray();
    this.prefs.set(new Map(all.map((p) => [p.songId, p])));
  }

  /** Reading inside a template/computed tracks the signal, so the view updates on change. */
  get(songId: string): SongPrefs {
    return this.prefs().get(songId) ?? { songId, ...DEFAULT_PREFS };
  }

  /** True once the user has changed something for this song. */
  has(songId: string): boolean {
    return this.prefs().has(songId);
  }

  async update(songId: string, patch: Partial<Omit<SongPrefs, 'songId'>>): Promise<void> {
    const next: SongPrefs = { ...this.get(songId), ...patch, songId };
    // Signals hold immutable values: create a new Map so Angular sees a change.
    this.prefs.update((map) => new Map(map).set(songId, next));
    await this.db.songPrefs.put(next);
  }
}
