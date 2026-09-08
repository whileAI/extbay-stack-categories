import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = path.join(root, 'package-root');
const dist = path.join(packageRoot, 'dist');
const manifest = JSON.parse(await readFile(path.join(root, 'extbay.json'), 'utf8'));

validateManifest(manifest);
await rm(packageRoot, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(
  path.join(packageRoot, 'extbay.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);
for (const file of ['index.html', 'app.css', 'app.js', 'core.js', 'extbay-sdk.js']) {
  await cp(path.join(root, 'src', file), path.join(dist, file));
}
console.log(`Built ${manifest.id}@${manifest.version} in package-root/`);

function validateManifest(value) {
  const required = [
    'schemaVersion',
    'id',
    'name',
    'version',
    'author',
    'compatibility',
    'runtime',
    'permissions',
    'ui',
  ];
  for (const field of required) {
    if (!(field in value)) throw new Error(`Manifest field is required: ${field}`);
  }
  if (value.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62})(?:\.[a-z0-9](?:[a-z0-9-]{0,62}))*$/.test(value.id))
    throw new Error('Invalid extension id');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.version))
    throw new Error('Invalid semantic version');
  if (value.ui?.entry !== 'dist/index.html') throw new Error('Unexpected UI entry');
}
