// Comprime car.glb con meshopt (cuantizacion + reordenado + compresion de buffers) via
// `gltf-transform optimize`, para reducir lo que se descarga cuando el visor 3D entra en
// viewport. Se ejecuta a mano con `npm run compress:glb`; sobreescribe car.glb en la raiz.
//
// El visor pinta la librea con un shader procedural que ignora los materiales originales del
// .glb y solo lee POSICIONES de vertice (ver index.html, makeLiveryMaterial), así que se
// deshabilitan --join/--flatten/--palette/--simplify: no aportan nada a ese pipeline y
// --simplify en particular decimaria la geometria del modelo de exhibicion.
import { execFileSync } from 'node:child_process';
import { renameSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const input = path.join(root, 'car.glb');
const tmp = path.join(root, 'car.compressed.glb');

const before = statSync(input).size;

execFileSync('npx', [
  '--no-install', 'gltf-transform', 'optimize', input, tmp,
  '--compress', 'meshopt',
  '--simplify', 'false',
  '--join', 'false',
  '--flatten', 'false',
  '--instance', 'false',
  '--palette', 'false',
], { stdio: 'inherit', shell: true });

const after = statSync(tmp).size;
copyFileSync(tmp, input);
unlinkSync(tmp);

console.log(`car.glb: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
