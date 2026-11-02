import { readdirSync, readFileSync } from 'node:fs';
import { HAS_SONGS } from '../../testing/bundled-songs';

describe.skipIf(!HAS_SONGS)('public/songs-index.json', () => {
  it('lists exactly the files in songs/ (run `npm run songs:index` if this fails)', () => {
    const index: string[] = JSON.parse(readFileSync('public/songs-index.json', 'utf8'));
    const files = readdirSync('songs')
      .filter((f) => f.endsWith('.cho'))
      .sort();
    expect(index).toEqual(files);
  });
});
