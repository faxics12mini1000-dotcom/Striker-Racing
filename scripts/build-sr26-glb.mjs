// Arma assets/models/sr26.glb a partir de un STL por pieza (exportados de Fusion).
// Entrada: scripts/source/sr26/*.stl (o scripts/source/*.stl si no existe la subcarpeta; esa carpeta está en .gitignore).
//  - un nodo + una malla por STL; el nombre es el del archivo sin extensión (01_Cuerpo, 16_Llanta_del_izq__Llanta_DI, ...)
//  - los STL vienen en mm con Z arriba y X al frente; el visor espera metros, Y arriba, X al frente, +Z = lado derecho:
//        (x, y, z)_stl  ->  (x, z, -y) * 0.001
//  - cada malla se recentra en el centro de su caja y ese centro va en la traslación del nodo (el visor usa
//    node.position como "home" del despiece y las llantas giran sobre el eje de su nodo)
//  - sin normales ni cuantización: el visor suaviza normales por su cuenta y usa las posiciones tal cual
// Uso: node scripts/build-sr26-glb.mjs
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const MM = 0.001;
const dir = existsSync('scripts/source/sr26') ? 'scripts/source/sr26' : 'scripts/source';
const out = 'assets/models/sr26.glb';

/* Piezas que el reglamento da ya hechas (halo y casco de STEM Racing): vienen en su propio marco de CAD y se llevan al del auto (mm, marco STL).
 *  - halo: gira 180° sobre la vertical (el pilar delantero angosto queda al frente) y sus dos espigas quedan en x = 130 y 170 (40 mm entre sí, como pide el reglamento)
 *  - casco: se centra sobre el halo, dentro del aro. `z` es la altura de la base de cada pieza sobre la pista. */
const PLACE = {
  '13_Halo':  { keep: .45, map: ([x, y, z]) => [125 - x, -y, z + 24.5] },
  '14_Casco': { keep: .2, map: ([x, y, z]) => [x + 181, y, z + 136 + 23.5] },
};

/* Devuelve los vértices (3 por triángulo) del STL, binario o ASCII. */
function readStl(file) {
  const b = readFileSync(file);
  const n = b.length >= 84 ? b.readUInt32LE(80) : 0;
  if (b.length === 84 + 50 * n) {
    const v = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) v[i * 9 + k] = b.readFloatLE(84 + i * 50 + 12 + k * 4);
    return v;
  }
  const nums = [...b.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].flatMap(m => [+m[1], +m[2], +m[3]]);
  return Float32Array.from(nums);
}

await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('sr26');
let tris = 0;

for (const f of readdirSync(dir).filter(f => f.toLowerCase().endsWith('.stl')).sort()) {
  const name = path.basename(f, path.extname(f));
  const src = readStl(path.join(dir, f));
  if (PLACE[name]) for (let i = 0; i < src.length; i += 3) { const q = PLACE[name].map([src[i], src[i + 1], src[i + 2]]); src[i] = q[0]; src[i + 1] = q[1]; src[i + 2] = q[2]; }
  const pos = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) { pos[i] = src[i] * MM; pos[i + 1] = src[i + 2] * MM; pos[i + 2] = -src[i + 1] * MM; }
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
  const c = min.map((m, k) => (m + max[k]) / 2);
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) pos[i + k] -= c[k];
  const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  scene.addChild(doc.createNode(name).setMesh(mesh).setTranslation(c));
  tris += pos.length / 9;
}

await doc.transform(weld(), dedup(), prune());
/* El halo y el casco vienen de CAD con mucha más malla de la que se nota a esta escala: se simplifican (keep = fracción de triángulos que queda). */
for (const mesh of doc.getRoot().listMeshes()) {
  const keep = PLACE[mesh.getName()]?.keep; if (!keep) continue;
  const prim = mesh.listPrimitives()[0], pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices(), before = idx.getCount() / 3;
  const [out] = MeshoptSimplifier.simplify(Uint32Array.from(idx.getArray()), pos, 3, Math.floor(before * keep) * 3, 0.0006, ['LockBorder']);
  idx.setArray(out); tris += out.length / 3 - before;
  console.log(`${mesh.getName()}: ${before} -> ${out.length / 3} triángulos`);
}
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
console.log(`${doc.getRoot().listNodes().length} piezas, ${tris} triángulos -> ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
