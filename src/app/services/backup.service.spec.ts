import { TestBed } from '@angular/core/testing';
import { DB } from '../data/db';
import { BackupService } from './backup.service';

/** Fake Dexie: tables with hooks we can trigger, and a kv table. */
function fakeDb() {
  const hooks: (() => void)[] = [];
  const table = () => ({
    toArray: async () => [],
    get: async () => undefined,
    hook: (_event: string, fn: () => void) => void hooks.push(fn),
  });
  const kv = new Map<string, unknown>();
  return {
    hooks,
    kv,
    db: {
      songs: table(),
      songPrefs: table(),
      annotations: table(),
      setlists: table(),
      folders: table(),
      settings: table(),
      kv: {
        get: async (key: string) => (kv.has(key) ? { key, value: kv.get(key) } : undefined),
        put: async ({ key, value }: { key: string; value: unknown }) => void kv.set(key, value),
        delete: async (key: string) => void kv.delete(key),
      },
    },
  };
}

describe('BackupService — automatic backup file', () => {
  afterEach(() => {
    delete (window as Partial<Window>).showSaveFilePicker;
    vi.useRealTimers();
  });

  it('writes the chosen file at once, again a few seconds after each change, and pauses if permission is lost', async () => {
    const writes: string[] = [];
    let fail = false;
    const handle = {
      name: 'innario-backup-automatico.json',
      createWritable: async () => {
        if (fail) throw new Error('NotAllowedError');
        return { write: async (text: string) => void writes.push(text), close: async () => undefined };
      },
    } as unknown as FileSystemFileHandle;
    window.showSaveFilePicker = async () => handle;
    const { db, hooks, kv } = fakeDb();
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
    const service = TestBed.inject(BackupService);
    expect(service.autoStatus()).toBe('off');

    expect(await service.enableAuto()).toBe(true);
    expect(service.autoStatus()).toBe('active');
    expect(writes.length).toBe(1);
    expect(JSON.parse(writes[0]).format).toBe('innario-backup');
    expect(kv.get('autoBackupHandle')).toBe(handle);
    expect(service.lastBackupAt()).toBeDefined();

    vi.useFakeTimers();
    hooks[0](); // a song changed
    hooks[3](); // and a setlist: still one write (debounced)
    await vi.advanceTimersByTimeAsync(4100);
    expect(writes.length).toBe(2);

    fail = true;
    hooks[0]();
    await vi.advanceTimersByTimeAsync(4100);
    expect(service.autoStatus()).toBe('paused');

    await service.disableAuto();
    expect(service.autoStatus()).toBe('off');
    expect(kv.has('autoBackupHandle')).toBe(false);
  });

  it('is "unsupported" where browsers can’t save to a chosen file (Safari, iPad)', () => {
    const { db } = fakeDb();
    TestBed.configureTestingModule({ providers: [{ provide: DB, useValue: db }] });
    expect(TestBed.inject(BackupService).autoStatus()).toBe('unsupported');
  });
});
