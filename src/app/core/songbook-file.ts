// Sharing songs between people: a "songbook file" contains only the songs'
// ChordPro text (no notes, prefs or setlists). The app doesn't ship any
// songs; a church/group shares its songbook as such a file and everyone
// imports it once. ChordPro files (.cho …) and backups can be imported too.
import { BACKUP_FORMAT } from './backup';
import { choFileName } from './export';
import { Song } from './models';

export const SONGBOOK_FORMAT = 'innario-songbook';

export interface SongbookEntry {
  /** File name, used to detect number/title when the text has no {meta: numero}. */
  file: string;
  chordpro: string;
}

export interface SongbookFile {
  format: typeof SONGBOOK_FORMAT;
  version: 1;
  songs: SongbookEntry[];
}

export function createSongbookFile(songs: readonly Song[]): SongbookFile {
  return {
    format: SONGBOOK_FORMAT,
    version: 1,
    songs: songs.map((song) => ({ file: choFileName(song), chordpro: song.chordpro })),
  };
}

export function songbookFileName(now = new Date()): string {
  return `innario-canti-${now.toISOString().slice(0, 10)}.json`;
}

const CHORDPRO_FILE = /\.(cho|chopro|chordpro|crd|pro|txt)$/i;

export interface ImportedFiles {
  songs: SongbookEntry[];
  /** Backup files (JSON text), restored with "merge". */
  backups: string[];
  /** Names of files that aren't songs, songbooks or backups. */
  rejected: string[];
}

/** Sorts the chosen files into songs, backups and rejects (pure: no file reading). */
export function classifyFiles(files: readonly { name: string; text: string }[]): ImportedFiles {
  const result: ImportedFiles = { songs: [], backups: [], rejected: [] };
  for (const { name, text } of files) {
    if (CHORDPRO_FILE.test(name)) {
      if (text.trim()) result.songs.push({ file: name, chordpro: text });
      else result.rejected.push(name);
      continue;
    }
    if (/\.json$/i.test(name)) {
      try {
        const data = JSON.parse(text);
        if (data?.format === SONGBOOK_FORMAT && Array.isArray(data.songs)) {
          for (const s of data.songs) {
            if (typeof s?.chordpro === 'string') result.songs.push({ file: String(s.file ?? ''), chordpro: s.chordpro });
          }
          continue;
        }
        if (data?.format === BACKUP_FORMAT) {
          result.backups.push(text);
          continue;
        }
      } catch {
        // falls through to rejected
      }
    }
    result.rejected.push(name);
  }
  return result;
}

/** Next free version letter for a number ("" taken → "b", "b" taken → "c" …). */
export function nextFreeSuffix(taken: ReadonlySet<string>): string {
  for (const letter of 'bcdefghijklmnopqrstuvwxyz') if (!taken.has(letter)) return letter;
  return 'z';
}
