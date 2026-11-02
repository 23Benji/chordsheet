import { daysAgo, shouldRemindBackup, snoozeUntil } from './backup-reminder';

const DAY = 86_400_000;
const now = new Date('2026-11-20T12:00:00').getTime();

describe('backup reminder', () => {
  it('reminds when the last backup (or the data, if never) is older than 14 days', () => {
    expect(shouldRemindBackup({ now, lastBackupAt: undefined, dataSince: now - 3 * DAY, snoozedUntil: undefined })).toBe(false);
    expect(shouldRemindBackup({ now, lastBackupAt: undefined, dataSince: now - 20 * DAY, snoozedUntil: undefined })).toBe(true);
    expect(shouldRemindBackup({ now, lastBackupAt: now - 2 * DAY, dataSince: now - 90 * DAY, snoozedUntil: undefined })).toBe(false);
    expect(shouldRemindBackup({ now, lastBackupAt: now - 15 * DAY, dataSince: now - 90 * DAY, snoozedUntil: undefined })).toBe(true);
    expect(shouldRemindBackup({ now, lastBackupAt: undefined, dataSince: undefined, snoozedUntil: undefined })).toBe(false);
  });

  it('can be snoozed for 14 days', () => {
    const snoozed = snoozeUntil(now);
    expect(shouldRemindBackup({ now: now + DAY, lastBackupAt: undefined, dataSince: now - 30 * DAY, snoozedUntil: snoozed })).toBe(false);
    expect(shouldRemindBackup({ now: now + 15 * DAY, lastBackupAt: undefined, dataSince: now - 30 * DAY, snoozedUntil: snoozed })).toBe(true);
  });

  it('says how long ago in Italian', () => {
    expect(daysAgo(now - 2 * 3600_000, now)).toBe('oggi');
    expect(daysAgo(now - DAY, now)).toBe('ieri');
    expect(daysAgo(now - 5 * DAY, now)).toBe('5 giorni fa');
  });
});
