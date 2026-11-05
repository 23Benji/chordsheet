import { TestBed } from '@angular/core/testing';
import { RecentService, pushRecent } from './recent.service';

describe('RecentService', () => {
  beforeEach(() => localStorage.clear());

  it('newest first, no duplicates, at most 5', () => {
    expect(pushRecent([], 'a')).toEqual(['a']);
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  it('remembers the list on this device', () => {
    const recent = TestBed.inject(RecentService);
    recent.add('x');
    recent.add('y');
    expect(recent.ids()).toEqual(['y', 'x']);
    expect(JSON.parse(localStorage.getItem('innario.recentSongs')!)).toEqual(['y', 'x']);
  });
});
