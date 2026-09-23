// Copia el subconjunto minimo de three.js (core + addons usados por el visor 3D) desde
// node_modules hacia /vendor/three, para servirlo como archivo estatico sin depender de un
// CDN externo (unpkg) en produccion. Se ejecuta a mano con `npm run vendor:three` cada vez
// que se actualice la version de "three" en package.json.
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'node_modules', 'three');
const dest = path.join(root, 'vendor', 'three');

// three.module.min.js ya viene minificado de fabrica; los addons (jsm) se distribuyen sin
// minificar, así que se minifican aquí con esbuild antes de copiarlos.
const copyAsIs = [
  ['build/three.module.min.js', 'build/three.module.min.js'],
];
const minify = [
  ['examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/utils/BufferGeometryUtils.js'],
  ['examples/jsm/controls/OrbitControls.js', 'examples/jsm/controls/OrbitControls.js'],
  ['examples/jsm/environments/RoomEnvironment.js', 'examples/jsm/environments/RoomEnvironment.js'],
  ['examples/jsm/libs/meshopt_decoder.module.js', 'examples/jsm/libs/meshopt_decoder.module.js'],
];

if (existsSync(dest)) await rm(dest, { recursive: true, force: true });

for (const [from, to] of copyAsIs) {
  const target = path.join(dest, to);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(src, from), target);
}

for (const [from, to] of minify) {
  const target = path.join(dest, to);
  await mkdir(path.dirname(target), { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(src, from)],
    outfile: target,
    format: 'esm',
    minify: true,
    bundle: false,
    logLevel: 'silent',
  });
}

console.log(`Vendorizado three.js (${copyAsIs.length + minify.length} archivos) en ${path.relative(root, dest)}`);
