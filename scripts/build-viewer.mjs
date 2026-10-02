// Empaqueta el visor 3D (js/viewer.js + js/car-look.js + three.js recortado + GLTFLoader/OrbitControls/meshopt) en un único módulo con hash
// en js/dist/, y estampa en las páginas del visor las URLs versionadas (bundle, GLB, entorno) para poder cachearlas un año (immutable).
// Páginas: auto/index.html y en/car/index.html. Marcadores que busca en el HTML:
//   <!-- viewer:head:begin --> … <!-- viewer:head:end -->      modulepreload del bundle + preload del GLB y del entorno
//   <!-- viewer:script:begin --> … <!-- viewer:script:end -->  <script type="module"> del bundle
//   id="modelStage" con data-model / data-env                   URLs versionadas que lee el visor
// Uso: npm run build:viewer      (después de tocar js/viewer.js, js/car-look.js o los assets de assets/models/)
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const PAGES = ['auto/index.html', 'en/car/index.html'];
const ASSETS = { model: 'assets/models/sr26.glb', env: 'assets/models/env-room.png' };
const hash = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);

rmSync('js/dist', { recursive: true, force: true });
const res = await build({
  entryPoints: ['js/viewer.js'], bundle: true, splitting: false, format: 'esm', outdir: 'js/dist',
  entryNames: '[name].[hash]', minify: true, target: 'es2020', legalComments: 'none', metafile: true, logLevel: 'warning',
});
const outs = Object.entries(res.metafile.outputs);
const entry = outs.find(([, o]) => o.entryPoint === 'js/viewer.js')[0].replace(/\\/g, '/');
const bundleUrl = '/' + entry;
const v = { model: hash(ASSETS.model), env: hash(ASSETS.env) };
const urls = { bundle: bundleUrl, model: `/${ASSETS.model}?v=${v.model}`, env: `/${ASSETS.env}?v=${v.env}` };

for (const page of PAGES) {
  let html = readFileSync(page, 'utf8'); const crlf = html.includes('\r\n'); html = html.replace(/\r\n/g, '\n');
  const swap = (begin, end, body) => {
    const a = html.indexOf(begin), b = html.indexOf(end);
    if (a < 0 || b < a) throw new Error(`${page}: faltan los marcadores ${begin}`);
    html = html.slice(0, a + begin.length) + body + html.slice(b);
  };
  swap('<!-- viewer:head:begin -->', '<!-- viewer:head:end -->',
    `\n<link rel="modulepreload" href="${urls.bundle}">\n<link rel="preload" href="${urls.model}" as="fetch" type="model/gltf-binary" crossorigin>\n<link rel="preload" href="${urls.env}" as="fetch" crossorigin>\n`);
  swap('<!-- viewer:script:begin -->', '<!-- viewer:script:end -->', `<script type="module" src="${urls.bundle}"></script>`);
  html = html.replace(/data-model="[^"]*"/, `data-model="${urls.model}"`).replace(/data-env="[^"]*"/, `data-env="${urls.env}"`);
  if (crlf) html = html.replace(/\n/g, '\r\n');
  writeFileSync(page, html);
}

const kb = f => (statSync(f).size / 1024).toFixed(1), gz = f => (gzipSync(readFileSync(f)).length / 1024).toFixed(1);
for (const [f] of outs) if (f.endsWith('.js')) console.log(`${f.replace(/\\/g, '/')}  ${kb(f)} KB  (gzip ${gz(f)} KB)`);
console.log(`GLB ${kb(ASSETS.model)} KB · entorno ${kb(ASSETS.env)} KB · versiones ${v.model} / ${v.env}`);
