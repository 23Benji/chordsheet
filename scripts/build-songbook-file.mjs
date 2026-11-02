// Turns a folder of ChordPro files into one "songbook file" to share with
// others (they import it in the app: welcome screen or Impostazioni → Importa canti).
//   node scripts/build-songbook-file.mjs <songs-folder> <output.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [folder = 'songs', output = 'chordsheet-canti.json'] = process.argv.slice(2);
const files = readdirSync(folder)
  .filter((f) => /\.(cho|chopro|chordpro)$/i.test(f))
  .sort();
const songs = files.map((file) => ({ file, chordpro: readFileSync(join(folder, file), 'utf8') }));
writeFileSync(output, JSON.stringify({ format: 'innario-songbook', version: 1, songs }));
console.log(`${output}: ${songs.length} songs`);
