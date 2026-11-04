import { Injectable, computed, inject, signal } from '@angular/core';
import { Song } from '../core/models';
import { buildSearchEntry } from '../core/search';
import { songFromChordPro, withChordPro } from '../core/song-import';
import { SongbookEntry, nextFreeSuffix } from '../core/songbook-file';
import { compareByNumber, parseFileName } from '../core/song-meta';
import { groupVersions } from '../core/versions';
import { DB } from '../data/db';
import { AnnotationService } from './annotation.service';
import { FolderService } from './folder.service';

/**
 * Holds the song library in memory as a signal. Components read `songs()`
 * and Angular re-renders whatever depends on it whenever it changes —
 * no manual subscriptions needed (that's the main advantage over RxJS here).
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly db = inject(DB);
  private readonly annotationService = inject(AnnotationService);
  private readonly folders = inject(FolderService);

  private readonly _songs = signal<Song[]>([]);
  private readonly _loaded = signal(false);

  /** All songs, sorted by number. Read-only from outside (`asReadonly`). */
  readonly songs = this._songs.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly isEmpty = computed(() => this._loaded() && this._songs().length === 0);

  /** `computed` caches its result and only recomputes when `songs` changes. */
  readonly byId = computed(() => new Map(this._songs().map((s) => [s.id, s])));
  readonly searchEntries = computed(() => this._songs().map(buildSearchEntry));
  /** number → all versions of that song (123, 123b, 123c …). */
  readonly versionsByNumber = computed(() => groupVersions(this._songs()));

  /** All versions of a song (just the song itself if it has no alternatives). */
  versionsOf(song: Song): Song[] {
    return song.number === null ? [song] : (this.versionsByNumber().get(song.number) ?? [song]);
  }

  async load(): Promise<void> {
    const songs = await this.db.songs.toArray();
    this._songs.set(songs.sort(compareByNumber));
    this._loaded.set(true);
  }

  /**
   * Songs shipped with the build (songs/ folder present when building). The
   * public version has none: songs are imported from files.
   */
  async bundledAvailable(): Promise<boolean> {
    try {
      const files: string[] = await fetchJson(new URL('songs-index.json', document.baseURI));
      return files.length > 0;
    } catch {
      return false;
    }
  }

  /** How many of these songs have a number + suffix that's already in the library. */
  countConflicts(entries: readonly SongbookEntry[]): number {
    return entries.filter((e) => {
      const song = songFromChordPro(e.chordpro, e.file, 'imported');
      return song.number !== null && !!this.findByNumber(song.number, song.suffix);
    }).length;
  }

  /**
   * Imports songs from files. When the number + suffix already exists:
   * - 'replace': new text, same song (personal notes kept and re-anchored)
   * - 'keepBoth': added as another version (next free letter: 12 → 12b)
   * - 'skip': left out (the song already in the library is still listed in
   *   `songIds`, so "import into folder X" files it too)
   */
  async importEntries(
    entries: readonly SongbookEntry[],
    policy: 'replace' | 'keepBoth' | 'skip',
  ): Promise<{ added: number; replaced: number; skipped: number; songIds: string[] }> {
    const result = { added: 0, replaced: 0, skipped: 0 };
    const added: Song[] = [];
    const replaced: Song[] = [];
    const songIds: string[] = [];
    const taken = (number: number) =>
      new Set([...this._songs(), ...added].filter((s) => s.number === number).map((s) => s.suffix));

    for (const entry of entries) {
      const song = songFromChordPro(entry.chordpro, entry.file, 'imported');
      const existing =
        song.number !== null
          ? ([...this._songs(), ...added].find((s) => s.number === song.number && s.suffix === song.suffix) ?? null)
          : null;
      if (!existing) {
        added.push(song);
        songIds.push(song.id);
        result.added++;
      } else if (policy === 'skip' || added.includes(existing)) {
        songIds.push(existing.id);
        result.skipped++;
      } else if (policy === 'replace') {
        replaced.push(withChordPro(existing, entry.chordpro));
        songIds.push(existing.id);
        result.replaced++;
      } else {
        const suffix = nextFreeSuffix(taken(song.number!));
        added.push({ ...song, suffix });
        songIds.push(song.id);
        result.added++;
      }
    }

    await this.db.songs.bulkPut([...added, ...replaced]);
    if (replaced.length) {
      // Loaded on demand: the ChordPro parser isn't needed at start-up.
      const { parseChordPro } = await import('../core/chordpro');
      for (const song of replaced) await this.annotationService.reanchorSong(song.id, parseChordPro(song.chordpro));
    }
    await requestPersistentStorage();
    await this.load();
    return { ...result, songIds: [...new Set(songIds)] };
  }

  /** Another song (not `exceptId`) that already uses this number + suffix. */
  findByNumber(number: number, suffix: string, exceptId?: string): Song | undefined {
    return this._songs().find((s) => s.number === number && s.suffix === suffix && s.id !== exceptId);
  }

  /** Inserts or updates a song (editor save). */
  async saveSong(song: Song): Promise<void> {
    await this.db.songs.put(song);
    this._songs.update((songs) => [...songs.filter((s) => s.id !== song.id), song].sort(compareByNumber));
  }

  /** Deletes a song with its personal settings and notes. */
  async deleteSong(id: string): Promise<void> {
    // A Dexie transaction: either all three deletions happen, or none.
    await this.db.transaction('rw', [this.db.songs, this.db.songPrefs, this.db.annotations], async () => {
      await this.db.songs.delete(id);
      await this.db.songPrefs.delete(id);
      await this.db.annotations.where('songId').equals(id).delete();
    });
    this._songs.update((songs) => songs.filter((s) => s.id !== id));
    this.annotationService.forgetSong(id);
    await this.folders.forgetSong(id);
  }

  /** The original text of a bundled song (same number + suffix), for "Ripristina originale". */
  async bundledSource(song: Song): Promise<string | null> {
    if (song.number === null) return null;
    const base = document.baseURI;
    const files: string[] = await fetchJson(new URL('songs-index.json', base));
    const file = files.find((f) => {
      const parsed = parseFileName(f);
      return parsed.number === song.number && parsed.suffix === song.suffix;
    });
    return file ? fetchText(new URL(`songs/${encodeURIComponent(file)}`, base)) : null;
  }

  /**
   * Fetches every bundled ChordPro file (listed in songs-index.json) and stores
   * the ones whose number+suffix is not in the library yet.
   */
  async importBundled(onProgress?: (done: number, total: number) => void): Promise<number> {
    const base = document.baseURI;
    const files: string[] = await fetchJson(new URL('songs-index.json', base));
    const existing = new Set(this._songs().map((s) => `${s.number}${s.suffix}`));
    const songs: Song[] = [];
    let done = 0;

    // Fetch in small parallel batches: fast, without flooding the browser.
    for (let i = 0; i < files.length; i += 12) {
      const batch = files.slice(i, i + 12);
      const texts = await Promise.all(
        batch.map((file) => fetchText(new URL(`songs/${encodeURIComponent(file)}`, base))),
      );
      texts.forEach((text, j) => {
        const song = songFromChordPro(text, batch[j], 'bundled');
        if (!existing.has(`${song.number}${song.suffix}`)) songs.push(song);
      });
      done += batch.length;
      onProgress?.(done, files.length);
    }

    await this.db.songs.bulkPut(songs);
    await requestPersistentStorage();
    await this.load();
    return songs.length;
  }
}

async function fetchText(url: URL): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchJson<T>(url: URL): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/** Asks the browser not to evict our IndexedDB data (SPEC §2). */
async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not supported: nothing to do.
  }
}
