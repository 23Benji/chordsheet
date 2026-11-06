// Cestino: how long deleted songs are kept, and what the list says about them.
import { TrashEntry } from './models';

export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

/** Entries whose 30 days are over (deleted for good when the app starts). */
export function expiredTrash(entries: readonly TrashEntry[], now: number): string[] {
  return entries.filter((e) => now - e.deletedAt >= TRASH_DAYS * DAY).map((e) => e.songId);
}

/** Whole days left before an entry goes away (at least 1 while it is still there). */
export function trashDaysLeft(entry: TrashEntry, now: number): number {
  return Math.max(1, Math.ceil((entry.deletedAt + TRASH_DAYS * DAY - now) / DAY));
}

/** Newest first, like "Eliminati di recente" on the iPhone. */
export const byDeletedAt = (a: TrashEntry, b: TrashEntry) => b.deletedAt - a.deletedAt;
