import { createHash } from 'node:crypto';
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const source = new URL('public/', root);
const files = await readdir(source, { recursive: true, withFileTypes: true });
await rm(dist, { recursive: true, force: true });
await cp(source, dist, { recursive: true });
const paths = files.filter(file => file.isFile())
  .map(file => `./${relative(fileURLToPath(source), join(file.parentPath, file.name)).replaceAll('\\', '/')}`)
  .sort();
const hash = createHash('sha256');
for (const path of paths) hash.update(await readFile(new URL(path, dist)));
const worker = await readFile(new URL('sw.js', dist), 'utf8');
await writeFile(new URL('sw.js', dist), worker
  .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 16))
  .replace('/* PRECACHE */ []', JSON.stringify(paths.filter(path => path !== './sw.js'))));
console.log(`Built ${paths.length} app files in dist/`);
