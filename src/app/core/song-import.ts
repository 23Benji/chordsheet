// Builds a Song record from ChordPro text (bundled files, user imports, editor).
import { Song } from './models';
import { parseFileName, parseSongNumber, readDirective, readNumeroMeta } from './song-meta';
import { detectKey } from './transpose';

type SongFields = Pick<Song, 'number' | 'suffix' | 'title' | 'key' | 'capo' | 'tempo' | 'tags'>;

/** Number, title, key … as written in the ChordPro text (file name as fallback). */
export function fieldsFromChordPro(chordpro: string, fileName = ''): SongFields {
  const fromFile = parseFileName(fileName);
  const fromMeta = parseSongNumber(readNumeroMeta(chordpro));
  const { number, suffix } = fromMeta.number !== null || !fileName ? fromMeta : fromFile;
  const toNumber = (value: string | null) => {
    const n = value === null ? NaN : parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    number,
    suffix,
    title: readDirective(chordpro, 'title') || fromFile.title || 'Senza titolo',
    key: readDirective(chordpro, 'key') ?? detectKey(chordpro) ?? undefined,
    capo: toNumber(readDirective(chordpro, 'capo')),
    tempo: toNumber(readDirective(chordpro, 'tempo')),
    tags: number !== null && number >= 200 ? ['natale'] : [],
  };
}

export function songFromChordPro(
  chordpro: string,
  fileName: string,
  source: Song['source'],
  now = Date.now(),
): Song {
  return {
    id: crypto.randomUUID(),
    ...fieldsFromChordPro(chordpro, fileName),
    chordpro,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

/** The same song with new ChordPro text (editor save): id and history kept. */
export function withChordPro(song: Song, chordpro: string, now = Date.now()): Song {
  return { ...song, ...fieldsFromChordPro(chordpro), chordpro, updatedAt: now };
}
