import { existsSync, readdirSync } from 'node:fs';

/**
 * The songs/ folder is not in the public repository (the lyrics are shared
 * as a file, not published). Tests over the real songs run only where the
 * folder exists (locally); elsewhere (GitHub Actions) they are skipped.
 */
export const HAS_SONGS = existsSync('songs') && readdirSync('songs').some((f) => f.endsWith('.cho'));
