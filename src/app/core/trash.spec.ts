import { Song, TrashEntry } from './models';
import { TRASH_DAYS, byDeletedAt, expiredTrash, trashDaysLeft } from './trash';

const DAY = 24 * 60 * 60 * 1000;
const entry = (songId: string, deletedAt: number): TrashEntry => ({
  songId,
  deletedAt,
  song: { id: songId } as Song,
  prefs: null,
  annotations: [],
  folderIds: [],
});

describe('trash', () => {
  const now = 100 * DAY;

  it('keeps songs for 30 days', () => {
    const entries = [entry('new', now - DAY), entry('edge', now - TRASH_DAYS * DAY + 1), entry('old', now - TRASH_DAYS * DAY)];
    expect(expiredTrash(entries, now)).toEqual(['old']);
  });

  it('counts the days left, never below 1', () => {
    expect(trashDaysLeft(entry('a', now), now)).toBe(30);
    expect(trashDaysLeft(entry('a', now - 10.5 * DAY), now)).toBe(20);
    expect(trashDaysLeft(entry('a', now - 30 * DAY + 1000), now)).toBe(1);
  });

  it('lists the newest first', () => {
    expect([entry('a', 1), entry('b', 3), entry('c', 2)].sort(byDeletedAt).map((e) => e.songId)).toEqual(['b', 'c', 'a']);
  });
});
