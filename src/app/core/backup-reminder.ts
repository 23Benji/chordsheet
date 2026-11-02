// When to remind the user to make a backup, and how to say how long ago.

const DAY = 24 * 60 * 60 * 1000;
export const REMIND_AFTER_DAYS = 14;

/**
 * Remind when the data is older than 14 days and the last backup (or, if
 * there never was one, the oldest data) is more than 14 days ago — unless
 * the reminder was snoozed.
 */
export function shouldRemindBackup(opts: {
  now: number;
  lastBackupAt: number | undefined;
  /** When the user's data started (oldest song); undefined = no data. */
  dataSince: number | undefined;
  snoozedUntil: number | undefined;
}): boolean {
  const { now, lastBackupAt, dataSince, snoozedUntil } = opts;
  if (dataSince === undefined) return false;
  if (snoozedUntil !== undefined && now < snoozedUntil) return false;
  const since = lastBackupAt ?? dataSince;
  return now - since > REMIND_AFTER_DAYS * DAY;
}

export function snoozeUntil(now: number): number {
  return now + REMIND_AFTER_DAYS * DAY;
}

/** "oggi", "ieri", "3 giorni fa" (calendar days). */
export function daysAgo(then: number, now: number): string {
  const start = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((start(now) - start(then)) / DAY);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} giorni fa`;
}
