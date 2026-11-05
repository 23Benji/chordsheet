import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'innario.recentSongs';
/** How many songs "Recenti" shows. */
export const RECENT_MAX = 5;

/** The list after opening `id`: it moves to the front, no duplicates, at most `max`. */
export function pushRecent(list: readonly string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((other) => other !== id)].slice(0, max);
}

/**
 * The last songs opened on this device, newest first: shown as "Recenti"
 * when you tap the empty search. Per device (like the theme), in
 * localStorage: it's a convenience, not data worth syncing or backing up.
 */
@Injectable({ providedIn: 'root' })
export class RecentService {
  private readonly _ids = signal<string[]>(read());
  readonly ids = this._ids.asReadonly();

  add(id: string): void {
    if (this._ids()[0] === id) return;
    const next = pushRecent(this._ids(), id);
    this._ids.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / storage full: the list just isn't remembered.
    }
  }
}

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
