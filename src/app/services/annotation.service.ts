import { Injectable, computed, inject, signal } from '@angular/core';
import { reanchorAll } from '../core/anchoring';
import { Sheet } from '../core/chordpro';
import { Annotation, LineAnchor } from '../core/models';
import { DB } from '../data/db';

export type NewAnnotation = Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>;

/** Personal notes, highlights, tabs and personal chords (SPEC §5.4). */
@Injectable({ providedIn: 'root' })
export class AnnotationService {
  private readonly db = inject(DB);
  private readonly annotations = signal<Annotation[]>([]);

  /** songId → its annotations. */
  readonly bySong = computed(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of this.annotations()) map.set(a.songId, [...(map.get(a.songId) ?? []), a]);
    return map;
  });

  /** Song ids that have notes / tabs, for the library icons and filter. */
  readonly songsWithNotes = computed(
    () => new Set(this.annotations().filter((a) => a.type !== 'tab').map((a) => a.songId)),
  );
  readonly songsWithTabs = computed(
    () => new Set(this.annotations().filter((a) => a.type === 'tab').map((a) => a.songId)),
  );

  async load(): Promise<void> {
    this.annotations.set(await this.db.annotations.toArray());
  }

  forSong(songId: string): Annotation[] {
    return this.bySong().get(songId) ?? [];
  }

  async add(data: NewAnnotation): Promise<Annotation> {
    const now = Date.now();
    const annotation: Annotation = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    await this.db.annotations.put(annotation);
    this.annotations.update((list) => [...list, annotation]);
    return annotation;
  }

  async update(annotation: Annotation, patch: Partial<NewAnnotation>): Promise<void> {
    const next = { ...annotation, ...patch, updatedAt: Date.now() };
    await this.db.annotations.put(next);
    this.annotations.update((list) => list.map((a) => (a.id === next.id ? next : a)));
  }

  async remove(id: string): Promise<void> {
    await this.db.annotations.delete(id);
    this.annotations.update((list) => list.filter((a) => a.id !== id));
  }

  /** Attaches an orphaned (or any) annotation to another line. */
  relink(annotation: Annotation, anchor: LineAnchor): Promise<void> {
    return this.update(annotation, { anchor, orphaned: false });
  }

  /**
   * The song's text changed: find every annotation's line again.
   * Returns how many annotations are now orphaned ("da ricollegare").
   */
  async reanchorSong(songId: string, sheet: Sheet): Promise<number> {
    const before = this.forSong(songId);
    const after = reanchorAll(before, sheet);
    const changed = after.filter((a, i) => a !== before[i]);
    if (changed.length) {
      await this.db.annotations.bulkPut(changed);
      const byId = new Map(changed.map((a) => [a.id, a]));
      this.annotations.update((list) => list.map((a) => byId.get(a.id) ?? a));
    }
    return after.filter((a) => a.orphaned).length;
  }

  /** Forget a deleted song's annotations (the DB rows are deleted by LibraryService). */
  forgetSong(songId: string): void {
    this.annotations.update((list) => list.filter((a) => a.songId !== songId));
  }
}
