// Canalización del modelo SR-26 (ver docs/PIPELINE_GLB.md).
//   fuente   assets/models/sr26.glb   (la exportación de Fusion 360, o el GLB ya procesado: el proceso es idempotente)
//   salidas  assets/models/sr26.glb     GLB web: normales suavizadas horneadas + meshopt (lo carga el visor; ver bake-sr26-normals.mjs)
//            assets/models/sr26-ar.glb  GLB para AR: SIN meshopt ni cuantización, materiales PBR horneados desde data/livery.json
//                                       (pieza → token de color/acabado) y cuerpo/pontones partidos en zonas de color. Escala 1:1 (metros).
//            data/modelo.json           medidas y lista de piezas calculadas del GLB (largo sin cartucho, ancho, distancia entre ejes…)
// Después valida ambos GLB con gltf-validator y comprueba que el de AR se lee sin extensiones. El póster por render lo hace scripts/generate-poster.mjs
// (npm run build:poster) y el empaquetado del visor, npm run build:viewer; `npm run build:model` los encadena.
// Uso: node scripts/build-model.mjs
import { Document, NodeIO } from '@gltf-transform/core';
import { dequantize, prune, dedup } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import validator from 'gltf-validator';
import { readGlb, measure, nodeBox } from './lib/glb.mjs';
import { tokens } from './lib/palette.mjs';
import { pieceId } from '../js/piece-id.js';

const WEB = 'assets/models/sr26.glb', AR = 'assets/models/sr26-ar.glb';
const LIVERY = JSON.parse(readFileSync('data/livery.json', 'utf8'));
const kb = f => (statSync(f).size / 1024).toFixed(1) + ' KB';

// 1) GLB web (normales + meshopt). Si el archivo ya viene procesado (meshopt + normales) no se vuelve a hornear, para que el resultado sea estable;
//    una exportación nueva de Fusion (sin meshopt) sí se procesa. --force obliga a rehornear.
{
  const cur = await readGlb(WEB);
  const processed = cur.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')
    && cur.getRoot().listMeshes().every(m => m.listPrimitives().every(p => p.getAttribute('NORMAL')));
  if (processed && !process.argv.includes('--force')) console.log('sr26.glb ya está procesado (meshopt + normales): no se rehornea (usa --force para obligarlo)');
  else execFileSync(process.execPath, ['scripts/bake-sr26-normals.mjs'], { stdio: 'inherit' });
}

// 2) GLB para AR
const css = tokens();
const resolve = v => (v && v.startsWith('var(') ? resolve(css[v.slice(6, -1)]) : v);
const hex = {};
for (const [name, token] of Object.entries(LIVERY.tokens)) hex[name] = resolve(css[token.replace(/^--/, '')]);
Object.assign(hex, LIVERY.materials);
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgba = h => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16) / 255)).concat(1);

const src = await readGlb(WEB);
await src.transform(dequantize());           // normales int8 → float32 (los visores de AR no siempre aceptan KHR_mesh_quantization)
const root = src.getRoot();
root.listExtensionsUsed().forEach(e => e.dispose());   // quita EXT_meshopt_compression / KHR_mesh_quantization del archivo

const mats = new Map();
function material(key, colorName, finishName) {
  const id = `${key}|${colorName}|${finishName}`;
  if (mats.has(id)) return mats.get(id);
  const fin = LIVERY.finishes[finishName] || LIVERY.finishes.satin;
  const color = fin.material ? hex[fin.material] : hex[colorName] || hex.ice;
  const m = src.createMaterial(`sr26_${colorName || fin.material}_${finishName}`).setBaseColorFactor(rgba(color))
    .setMetallicFactor(fin.metalness).setRoughnessFactor(Math.max(0.2, fin.roughness * (fin.kind === 'paint' ? 0.85 : 1)));
  mats.set(id, m); return m;
}

const zoneCount = {};
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const id = pieceId(node.getName()), spec = LIVERY.pieces[id] || {};
  const prims = mesh.listPrimitives();
  for (const prim of prims) {
    if (!spec.zones) { prim.setMaterial(material(id, spec.color, spec.finish || 'satin')); continue; }
    // cuerpo y pontones: se parte la malla por triángulo según su posición en X (misma regla que el shader del visor, data/livery.json → zones)
    const Z = LIVERY.zones[spec.zones];
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices().getArray();
    let minX = Infinity, maxX = -Infinity; const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); }
    const len = maxX - minX, hw = Z.stripe / 2, buckets = { a: [], g: [], b: [] }, p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) pos.getElement(idx[t + k], p[k]);
      const cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cz = (p[0][2] + p[1][2] + p[2][2]) / 3;
      const tt = (cx - minX) / len + Z.skew * cz / len;
      const zone = tt < Z.cut - hw ? 'a' : (Z.stripe > 0 && tt <= Z.cut + hw ? 'g' : 'b');
      buckets[zone].push(idx[t], idx[t + 1], idx[t + 2]);
    }
    for (const [zone, tri] of Object.entries(buckets)) {
      if (!tri.length) continue;
      zoneCount[`${id}:${zone}`] = tri.length / 3;
      const np = src.createPrimitive().setMode(prim.getMode()).setMaterial(material(id + zone, Z[zone], spec.finish));
      for (const sem of prim.listSemantics()) np.setAttribute(sem, prim.getAttribute(sem));
      np.setIndices(src.createAccessor().setType('SCALAR').setArray(Uint32Array.from(tri)).setBuffer(pos.getBuffer()));
      mesh.addPrimitive(np);
    }
    mesh.removePrimitive(prim);
  }
}
await src.transform(prune(), dedup());
root.getAsset().copyright = 'Striker Racing · SR-26 · prototipo visual (no es el auto final)';
root.getAsset().generator = 'striker-racing build-model.mjs';
await new NodeIO().write(AR, src);

// 3) validación (los dos) y lectura del GLB de AR sin extensiones registradas
for (const f of [WEB, AR]) {
  const rep = await validator.validateBytes(new Uint8Array(readFileSync(f)), { uri: f, ignoredIssues: f === WEB ? ['UNSUPPORTED_EXTENSION', 'MESH_PRIMITIVE_ATTRIBUTES_ACCESSOR_INVALID_FORMAT'] : [] }  );   // el web usa KHR_mesh_quantization (normales int8), que este validador aún no conoce
  const { numErrors, numWarnings } = rep.issues;
  console.log(`validador ${f}: ${numErrors} errores, ${numWarnings} avisos · ${kb(f)}`);
  if (numErrors) { console.error(JSON.stringify(rep.issues.messages.filter(m => m.severity === 0).slice(0, 5), null, 2)); process.exit(1); }
}
const check = await new NodeIO().read(AR);   // lanza si requiere EXT_meshopt_compression u otra extensión
if (check.getRoot().listExtensionsRequired().length) throw new Error('sr26-ar.glb todavía requiere extensiones');
console.log('sr26-ar.glb: sin extensiones requeridas · zonas:', JSON.stringify(zoneCount));

// 4) medidas del modelo web
const doc = await readGlb(WEB), m = measure(doc);
const parts = doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => ({ node: n.getName(), id: pieceId(n.getName()), box: nodeBox(n) }));
const out = {
  _ayuda: 'Calculado por scripts/build-model.mjs a partir de assets/models/sr26.glb. Milímetros, prototipo visual. No editar a mano.',
  parts: m.parts, lengthMm: +m.length.toFixed(2), lengthWithCartridgeMm: +m.lengthWithCartridge.toFixed(2), widthMm: +m.width.toFixed(2),
  heightMm: +m.height.toFixed(2), wheelbaseMm: m.wheelbase == null ? null : +m.wheelbase.toFixed(2),
  nodes: parts.map(p => p.node),
};
writeFileSync('data/modelo.json', JSON.stringify(out, null, 2) + '\n');
console.log('medidas:', JSON.stringify({ largo: out.lengthMm, ancho: out.widthMm, alto: out.heightMm, entreEjes: out.wheelbaseMm, piezas: out.parts }));
