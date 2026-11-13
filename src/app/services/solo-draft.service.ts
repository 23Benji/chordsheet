import { Injectable, computed, signal } from '@angular/core';
import { TabItem, sanitizeItems, tabText } from '../core/tab-writer';

const KEY = 'chordsheet.soloDraft';
/** Steps "Annulla" can go back. */
const HISTORY = 100;

/** A finished solo on its way into a song: the song view asks which line it goes under. */
export interface PendingSolo {
  title: string;
  text: string;
}

/**
 * "Scrivi assolo": the solo being written. Kept on this device
 * (localStorage), so leaving the page or the app doesn't lose it; it isn't a
 * song and doesn't go into backups or Drive. Undo/redo are snapshots of the
 * whole list (a solo is small, so this is cheaper than tracking edits).
 */
@Injectable({ providedIn: 'root' })
export class SoloDraftService {
  private readonly _items = signal<TabItem[]>([]);
  private readonly _title = signal('');
  readonly items = this._items.asReadonly();
  readonly title = this._title.asReadonly();
  readonly text = computed(() => tabText(this._items()));

  private readonly past = signal<TabItem[][]>([]);
  private readonly future = signal<TabItem[][]>([]);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  /** Set by "Aggiungi a un canto", taken by the song view when a line is tapped. */
  readonly pending = signal<PendingSolo | null>(null);

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { items?: unknown; title?: unknown } | null;
      if (saved) {
        this._items.set(sanitizeItems(saved.items));
        this._title.set(typeof saved.title === 'string' ? saved.title : '');
      }
    } catch {
      // Private mode or a broken value: start empty.
    }
  }

  /** Every change goes through here: one undo step, saved right away. */
  change(next: TabItem[]): void {
    const current = this._items();
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    this.past.update((list) => [...list.slice(-(HISTORY - 1)), current]);
    this.future.set([]);
    this._items.set(next);
    this.save();
  }

  setTitle(title: string): void {
    this._title.set(title);
    this.save();
  }

  undo(): void {
    const past = this.past();
    if (!past.length) return;
    this.future.update((list) => [this._items(), ...list]);
    this._items.set(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
    this.save();
  }

  redo(): void {
    const [next, ...rest] = this.future();
    if (!next) return;
    this.past.update((list) => [...list, this._items()]);
    this._items.set(next);
    this.future.set(rest);
    this.save();
  }

  /** "Nuovo": empty page (the title too); "Annulla" brings the solo back. */
  clear(): void {
    this.change([]);
    this.setTitle('');
  }

  private save(): void {
    try {
      if (!this._items().length && !this._title()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ items: this._items(), title: this._title() }));
    } catch {
      // Storage full or blocked: the draft lives until the app closes.
    }
  }
}
