// Writes public/songs-index.json: the list of bundled ChordPro files, which the
// app fetches on first run ("Importa l'innario incluso"). Run after adding or
// removing files in songs/: `npm run songs:index` (a unit test checks it is
// up to date).
import { existsSync, readdirSync, writeFileSync } from 'node:fs';

// No songs/ folder (e.g. the public build on GitHub): an empty list, so the
// app offers "Importa canti da file" instead of a bundled songbook.
const files = existsSync('songs')
  ? readdirSync('songs')
      .filter((f) => f.endsWith('.cho'))
      .sort()
  : [];
writeFileSync('public/songs-index.json', JSON.stringify(files, null, 2) + '\n');
console.log(`songs-index.json: ${files.length} songs`);
