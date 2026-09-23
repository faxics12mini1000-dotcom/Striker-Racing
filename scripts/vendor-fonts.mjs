// Copia las fuentes variables (subset latin, woff2) desde node_modules a /fonts para servirlas
// desde el mismo origen: elimina el CSS de Google Fonts, que bloqueaba el render.
// `npm run vendor:fonts` después de actualizar las dependencias @fontsource-variable/*.
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dest = path.join(root, 'fonts');
await mkdir(dest, { recursive: true });

const files = [
  ['inter', 'inter-latin-wght-normal.woff2'],
  ['oswald', 'oswald-latin-wght-normal.woff2'],
  ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2'],
];
for (const [pkg, file] of files) {
  await copyFile(path.join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file), path.join(dest, file));
}
console.log('Fuentes copiadas a fonts/ (' + files.length + ' archivos)');
