// Copia <model-viewer> (npm @google/model-viewer, Apache-2.0) a vendor/model-viewer/<versión>/ para servirlo desde el propio sitio, sin CDN.
// La carpeta lleva la versión en el nombre porque vercel.json la sirve con caché de un año (immutable). Se carga solo al pulsar «Ver en tu mesa».
// Si cambia la versión: npm i -D @google/model-viewer@<nueva>, npm run vendor:model-viewer y actualizar data-ar-lib en las páginas (build-viewer lo hace).
// Uso: node scripts/vendor-model-viewer.mjs
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('node_modules/@google/model-viewer/package.json', 'utf8'));
const dir = `vendor/model-viewer/${pkg.version}`;
rmSync('vendor/model-viewer', { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
copyFileSync('node_modules/@google/model-viewer/dist/model-viewer.min.js', `${dir}/model-viewer.min.js`);
copyFileSync('node_modules/@google/model-viewer/LICENSE', `${dir}/LICENSE`);
console.log(`vendor/model-viewer/${pkg.version}/model-viewer.min.js (v${pkg.version}, Apache-2.0)`);
