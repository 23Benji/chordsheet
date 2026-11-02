// Alternative versions of a song share the same number (123, 123b, 123c …).
// The library shows them as one entry; the song view switches between them.

export interface Versioned {
  id: string;
  number: number | null;
  suffix: string;
}

/** number → versions sorted by suffix ('' first). Songs without a number are not grouped. */
export function groupVersions<T extends Versioned>(songs: readonly T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const song of songs) {
    if (song.number === null) continue;
    const group = groups.get(song.number);
    if (group) group.push(song);
    else groups.set(song.number, [song]);
  }
  for (const group of groups.values()) group.sort((a, b) => a.suffix.localeCompare(b.suffix));
  return groups;
}

/**
 * Keeps one song per number, in the given order. Because the first occurrence
 * wins, passing ranked search results keeps the best match (e.g. "123c").
 */
export function collapseVersions<T extends Versioned>(songs: readonly T[]): T[] {
  const seen = new Set<number>();
  return songs.filter((song) => {
    if (song.number === null) return true;
    if (seen.has(song.number)) return false;
    seen.add(song.number);
    return true;
  });
}

/** Main version of a group: the one without suffix, else the first. */
export function mainVersion<T extends Versioned>(group: readonly T[]): T {
  return group.find((s) => s.suffix === '') ?? group[0];
}
