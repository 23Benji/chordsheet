import { Setlist } from './models';
import { StatsSong, monthsAgo, setlistDay, setlistStats } from './setlist-stats';

const song = (id: string, number: number | null, title: string, suffix = ''): StatsSong => ({ id, number, suffix, title });
const library = [
  song('s1', 1, 'Io lodo Te'),
  song('s4', 4, 'Siam riuniti'),
  song('s4b', 4, 'Siam riuniti', 'b'),
  song('s7', 7, 'Tu sei Re'),
  song('s30', 30, 'Grande è il Signore'),
  song('s60', 60, 'Maestà'),
  song('free', null, 'Canto senza numero'),
];
let n = 0;
const setlist = (date: string | undefined, ...songIds: string[]): Setlist => ({
  id: `l${++n}`,
  name: date ?? 'senza data',
  date,
  items: songIds.map((songId, i) => ({ id: `i${i}`, songId })),
  createdAt: Date.UTC(2026, 0, 15),
  updatedAt: 0,
});

const sundays = [
  setlist('2026-09-06', 's7', 's1', 's4'),
  setlist('2026-09-13', 's7', 's4b', 's30', 's7'), // Tu sei Re twice: counts once
  setlist('2026-10-04', 's7', 'free', 'deleted-song'),
  setlist(undefined, 's60'), // no date: the day it was created
];

describe('setlist statistics', () => {
  it('counts each song once per setlist, versions together, deleted songs skipped', () => {
    const stats = setlistStats(sundays, library);
    expect(stats.setlists).toBe(4);
    expect(stats.songs.map((s) => [s.song.id, s.count, s.last])).toEqual([
      ['s7', 3, '2026-10-04'],
      ['s4', 2, '2026-09-13'], // 4 and 4b are one song, shown as 4
      ['free', 1, '2026-10-04'],
      ['s30', 1, '2026-09-13'],
      ['s1', 1, '2026-09-06'],
      ['s60', 1, '2026-01-15'],
    ]);
    expect(stats.plays).toBe(9);
    expect(stats.distinct).toBe(6);
    expect([stats.from, stats.to]).toEqual(['2026-01-15', '2026-10-04']);
  });

  it('parts of the songbook by number: times sung, songs sung of how many', () => {
    const stats = setlistStats(sundays, library);
    expect(stats.ranges).toEqual([
      { from: 1, to: 25, plays: 6, sung: 3, total: 3 },
      { from: 26, to: 50, plays: 1, sung: 1, total: 1 },
      { from: 51, to: 60, plays: 1, sung: 1, total: 1 },
    ]);
    expect(stats.unnumberedPlays).toBe(1);
  });

  it('gaps in the numbering are left out of the parts', () => {
    const stats = setlistStats([], [song('a', 3, 'A'), song('z', 203, 'Z')]);
    expect(stats.ranges.map((r) => `${r.from}-${r.to}`)).toEqual(['1-25', '201-203']);
  });

  it('a period: only the setlists from that day on', () => {
    const stats = setlistStats(sundays, library, '2026-09-10');
    expect(stats.setlists).toBe(2);
    expect(stats.songs[0]).toMatchObject({ count: 2 });
    expect(stats.neverSung.map((s) => s.id)).toEqual(['s1', 's60']);
  });

  it('never sung: one per number, by number', () => {
    expect(setlistStats([setlist('2026-09-06', 's1')], library).neverSung.map((s) => s.id)).toEqual(['s4', 's7', 's30', 's60', 'free']);
  });

  it('no setlists: all zero, everything never sung', () => {
    const stats = setlistStats([], library);
    expect(stats).toMatchObject({ setlists: 0, plays: 0, distinct: 0, songs: [], from: null, to: null });
    expect(stats.neverSung.length).toBe(6);
  });

  it('days and periods', () => {
    expect(setlistDay({ date: '2026-03-01', createdAt: 0 })).toBe('2026-03-01');
    expect(setlistDay({ createdAt: Date.UTC(2026, 4, 2) })).toBe('2026-05-02');
    expect(monthsAgo(3, new Date(2026, 10, 5))).toBe('2026-08-05');
    expect(monthsAgo(12, new Date(2026, 10, 5))).toBe('2025-11-05');
  });
});
