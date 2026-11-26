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
const catalog = {};
const archivedArt = new Set(['actions','directions','heads','heads-profile','heads-back','neutral-heads','skin-zones'].map(name=>`./assets/atelier/${name}.webp`));
for (const path of paths) {
  const bytes = await readFile(new URL(path, dist));
  hash.update(bytes);
  if(path.startsWith('./assets/catalog/') && !path.startsWith('./assets/catalog/heads-cuts-')) {
    catalog[path]=createHash('sha256').update(bytes).digest('hex').slice(0,20);
  }
}
const version = hash.digest('hex').slice(0, 16);
const index = new URL('index.html', dist);
await writeFile(index, (await readFile(index, 'utf8')).replace('__CACHE_VERSION__', version));
const worker = await readFile(new URL('sw.js', dist), 'utf8');
await writeFile(new URL('sw.js', dist), worker
  .replace('__CACHE_VERSION__', version)
  .replace('/* PRECACHE */ []', JSON.stringify(paths.filter(path => path !== './sw.js' && !path.startsWith('./assets/catalog/') && !archivedArt.has(path))))
  .replace('/* CATALOG */ {}', JSON.stringify(catalog)));
console.log(`Built ${paths.length} app files in dist/`);
