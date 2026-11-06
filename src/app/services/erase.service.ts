import { Injectable, inject } from '@angular/core';
import { DB } from '../data/db';
import { SyncService } from './sync.service';

/** localStorage keys of this app (recent songs, dismissed hints, status bar, sign-in in progress). */
const OWN_KEYS = /^(innario|chordsheet)\./;

/**
 * "Elimina tutti i dati": this device goes back to how it was before the app
 * was ever opened — songs, notes, setlists, folders, settings, backup and
 * sync state all gone. The caller then reloads the app.
 *
 * If the device syncs with Google Drive it is signed out first, so the empty
 * library is NOT sent to Drive: the copy there (and on the other devices)
 * stays, and signing in again brings the songs back.
 */
@Injectable({ providedIn: 'root' })
export class EraseService {
  private readonly db = inject(DB);
  private readonly sync = inject(SyncService);

  async eraseAll(): Promise<void> {
    if (this.sync.state() !== 'off') await this.sync.signOut();
    for (const key of Object.keys(localStorage)) if (OWN_KEYS.test(key)) localStorage.removeItem(key);
    // Dexie closes the connection and deletes the whole IndexedDB database;
    // the app creates a fresh, empty one when it starts again.
    await this.db.delete();
  }
}
