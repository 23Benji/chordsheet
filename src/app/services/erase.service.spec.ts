import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DB } from '../data/db';
import { EraseService } from './erase.service';
import { SyncService } from './sync.service';

describe('EraseService', () => {
  const setup = (state: 'off' | 'idle') => {
    const calls: string[] = [];
    const db = { delete: vi.fn(async () => void calls.push('delete')) };
    const sync = { state: signal(state), signOut: vi.fn(async () => void calls.push('signOut')) };
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }, { provide: SyncService, useValue: sync }] });
    return { erase: TestBed.inject(EraseService), db, sync, calls };
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('innario.recentSongs', '[]');
    localStorage.setItem('innario.statusBar', 'default');
    localStorage.setItem('chordsheet.oauthPending', '{}');
    localStorage.setItem('someOtherSite', 'keep');
  });

  it('deletes the database and only this app’s localStorage keys', async () => {
    const { erase, db, sync } = setup('off');
    await erase.eraseAll();
    expect(db.delete).toHaveBeenCalledOnce();
    expect(sync.signOut).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual(['someOtherSite']);
  });

  it('signs out of Google first, so the empty library never reaches Drive', async () => {
    const { erase, calls } = setup('idle');
    await erase.eraseAll();
    expect(calls).toEqual(['signOut', 'delete']);
  });
});
