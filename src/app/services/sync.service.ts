import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { SyncData } from '../core/sync';
import { DB } from '../data/db';
import { BackupService } from './backup.service';
import type { DriveClient, GoogleAuth } from './google-drive';
import { isSignInReturn, syncAvailable } from './sync-config';

/**
 * The sync code (merge + Google Drive) is downloaded only when it is used:
 * `import()` makes the bundler put it in a separate file, so devices that
 * never sign in don't load it at start-up. The service worker still caches
 * that file for offline use.
 */
const loadSyncCode = () => Promise.all([import('../core/sync'), import('../core/backup'), import('./google-drive')]);

/**
 * - off: not connected to Google on this device
 * - idle: connected, everything synced (or nothing to do)
 * - syncing: a sync is running
 * - error: the last try failed (offline…): tried again later automatically
 * - expired: Google no longer accepts the sign-in → "Accedi di nuovo"
 */
export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'expired';

const AUTH = 'syncAuth';
const BASE = 'syncBase';
const LAST = 'syncLastAt';
/** Drive version of the cloud file at the last sync. */
const VERSION = 'syncRemoteVersion';
/** While the app is open, look for changes from other devices this often. */
const POLL_MS = 30_000;
/** Wait this long after the last change before syncing (typing a note = many changes). */
const CHANGE_DELAY_MS = 5000;
/** When the app comes back to the front, sync again if the last sync is older than this. */
const RESUME_AFTER_MS = 30_000;

/**
 * Keeps this device in sync with the user's other devices through one file in
 * their Google Drive (see core/sync.ts for the merge, google-drive.ts for the
 * network). Syncs at start-up, when the app comes back to the front, when the
 * connection returns and a few seconds after every change.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly db = inject(DB);
  private readonly backup = inject(BackupService);
  private readonly router = inject(Router);

  readonly available = syncAvailable();
  readonly state = signal<SyncState>('off');
  readonly email = signal<string | null>(null);
  readonly lastSyncAt = signal<number | null>(null);
  /** Shown when signing in fails. */
  readonly signInError = signal(false);

  private auth: GoogleAuth | null = null;
  private drive: DriveClient | null = null;
  private fileId: string | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  /** True while the sync itself writes to the database (those changes must not trigger a new sync). */
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!this.available || typeof window === 'undefined') return;
    const db = this.db;
    // Dexie hooks run on every write to these tables: schedule a sync.
    for (const table of [db.songs, db.songPrefs, db.annotations, db.setlists, db.folders]) {
      if (typeof table?.hook !== 'function') continue; // test doubles
      const schedule = () => this.scheduleSync();
      table.hook('creating', schedule);
      table.hook('updating', schedule);
      table.hook('deleting', schedule);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - (this.lastSyncAt() ?? 0) > RESUME_AFTER_MS) void this.sync();
    });
    window.addEventListener('online', () => void this.sync());
    // No server can tell us that another device changed something, so while
    // the app is on screen we ask Drive every 30 s (a tiny request; the file
    // is only downloaded when its version changed).
    setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void this.sync();
    }, POLL_MS);
  }

  /** At start-up: finish a sign-in that just came back from Google, then sync in the background. */
  async load(): Promise<void> {
    if (!this.available || !this.db.kv) return;
    if (isSignInReturn(location.href)) {
      try {
        const [, , google] = await loadSyncCode();
        const fresh = await google.finishSignIn();
        if (fresh) {
          await this.db.kv.put({ key: AUTH, value: fresh });
          await Promise.all([BASE, VERSION].map((key) => this.db.kv.delete(key))); // new account: first sync again
        }
      } catch {
        this.signInError.set(true);
      }
    }
    this.auth = ((await this.db.kv.get(AUTH))?.value as GoogleAuth | undefined) ?? null;
    this.lastSyncAt.set(((await this.db.kv.get(LAST))?.value as number | undefined) ?? null);
    if (!this.auth) return;
    this.email.set(this.auth.email);
    this.state.set('idle');
    void this.sync(); // not awaited: the app opens right away
  }

  /** "Accedi con Google" (must be called from a tap: the page goes to Google). */
  async signIn(): Promise<void> {
    this.signInError.set(false);
    const [, , google] = await loadSyncCode();
    await google.startSignIn();
  }

  /** "Esci": this device stops syncing; its data stays as it is. */
  async signOut(): Promise<void> {
    clearTimeout(this.timer);
    await this.drive?.revoke();
    this.auth = null;
    this.drive = null;
    this.fileId = null;
    await Promise.all([AUTH, BASE, LAST, VERSION].map((key) => this.db.kv.delete(key)));
    this.email.set(null);
    this.lastSyncAt.set(null);
    this.state.set('off');
  }

  private scheduleSync(): void {
    if (this.applying || !this.auth) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), CHANGE_DELAY_MS);
  }

  /** Syncs now. If a sync is already running, one more runs right after it. */
  sync(): Promise<void> {
    if (!this.auth || this.state() === 'expired') return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  }

  private async run(): Promise<void> {
    try {
      const [{ EMPTY_SYNC_DATA, sameSyncData, syncMerge, toSyncData }, { createBackup, parseBackup }, google] = await loadSyncCode();
      const drive = (this.drive ??= new google.DriveClient(this.auth!));
      const file = await drive.findFile();
      const base = ((await this.db.kv.get(BASE))?.value as SyncData | undefined) ?? null;
      const local = toSyncData(await this.backup.readAll());
      const lastVersion = (await this.db.kv.get(VERSION))?.value as string | undefined;
      if (file && base && file.version === lastVersion && sameSyncData(local, base)) {
        // Nobody changed anything since the last sync: nothing to download or upload.
        await this.done(Date.now());
        return;
      }
      // Only now show "Sincronizzazione…": the 30-second checks stay invisible.
      this.state.set('syncing');
      this.fileId = file?.id ?? null;
      const remote: SyncData = this.fileId ? toSyncData(parseBackup(await drive.download(this.fileId))) : EMPTY_SYNC_DATA;
      let version = file?.version;
      const { data, renamed } = syncMerge(base, local, remote);

      if (!sameSyncData(data, local)) {
        this.applying = true;
        try {
          await this.backup.writeAll(data); // settings stay as they are on this device
        } finally {
          this.applying = false;
        }
        this.followRenamedSong(renamed);
      }
      if (!this.fileId || !sameSyncData(data, remote)) {
        // The file is a normal backup file (without settings): it can also be imported by hand.
        const uploaded = await drive.upload(this.fileId, JSON.stringify(createBackup({ ...data, settings: null })));
        this.fileId = uploaded.id;
        version = uploaded.version;
      }
      await this.db.kv.put({ key: BASE, value: data });
      await this.db.kv.put({ key: VERSION, value: version });
      await this.done(Date.now());
    } catch (error) {
      this.state.set(error instanceof Error && error.message === 'sign-in-required' ? 'expired' : 'error');
    }
  }

  private async done(now: number): Promise<void> {
    this.lastSyncAt.set(now);
    this.state.set('idle');
    await this.db.kv.put({ key: LAST, value: now });
  }

  /** The open song got the id used by the other devices: keep it open. */
  private followRenamedSong(renamed: Map<string, string>): void {
    const match = /\/canto\/([^/?#]+)/.exec(this.router.url);
    const next = match && renamed.get(decodeURIComponent(match[1]));
    if (next) void this.router.navigateByUrl(this.router.url.replace(match[1], encodeURIComponent(next)), { replaceUrl: true });
  }
}
