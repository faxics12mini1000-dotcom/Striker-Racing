// Hornea en assets/models/sr26.glb las normales suavizadas que antes calculaba el navegador en cada visita con toCreasedNormals
// (≈2 s de CPU en un equipo rápido, 6 s o más en un celular). Aquí se calculan una sola vez:
//   - en cada vértice, las caras incidentes se agrupan por ángulo (arista viva > CREASE: grupo distinto) y cada grupo promedia las
//     normales de sus caras ponderadas por el ángulo del triángulo en ese vértice; los vértices solo se parten en aristas vivas.
//   - NORMAL va en int8 normalizado (KHR_mesh_quantization, solo ese atributo) y POSITION sigue en f32, para no tocar la
//     traslación/escala de los nodos (el visor usa node.position como "home" del despiece).
// Es idempotente: parte de las posiciones y descarta las normales que ya haya. Uso: node scripts/bake-sr26-normals.mjs
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const file = 'assets/models/sr26.glb';
const CREASE = 38 * Math.PI / 180, COS = Math.cos(CREASE);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const before = statSync(file).size;
const doc = await io.read(file);
let verts0 = 0, verts1 = 0;

function bake(pos, index) {
  const nTri = index.length / 3, fn = new Float32Array(nTri * 3), ang = new Float32Array(nTri * 3);
  const key = i => `${Math.round(pos[i * 3] * 1e7)},${Math.round(pos[i * 3 + 1] * 1e7)},${Math.round(pos[i * 3 + 2] * 1e7)}`;
  const byPos = new Map(), corner = new Array(index.length);   // corner = [grupo] por esquina
  const P = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(a[0], a[1], a[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let t = 0; t < nTri; t++) {
    const v = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]], p = v.map(P);
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0])), l = len(n);
    const nn = l > 1e-18 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 0];
    fn.set(nn, t * 3);
    for (let c = 0; c < 3; c++) {
      const e1 = sub(p[(c + 1) % 3], p[c]), e2 = sub(p[(c + 2) % 3], p[c]), l1 = len(e1), l2 = len(e2);
      ang[t * 3 + c] = l1 > 0 && l2 > 0 ? Math.acos(Math.max(-1, Math.min(1, dot(e1, e2) / (l1 * l2)))) : 0;
      const k = key(v[c]); if (!byPos.has(k)) byPos.set(k, []); byPos.get(k).push(t * 3 + c);
    }
  }
  const outPos = [], outNrm = [], outIdx = new Array(index.length);
  for (const corners of byPos.values()) {
    const groups = [];   // { seed:[nx,ny,nz], sum:[..], corners:[] }
    for (const ci of corners) {
      const t = (ci / 3) | 0, n = [fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]];
      let g = groups.find(g => dot(g.seed, n) > COS);
      if (!g) groups.push(g = { seed: n, sum: [0, 0, 0], corners: [] });
      const w = ang[ci]; g.sum[0] += n[0] * w; g.sum[1] += n[1] * w; g.sum[2] += n[2] * w; g.corners.push(ci);
    }
    for (const g of groups) {
      const l = len(g.sum) || 1, vi = outPos.length / 3, v0 = index[g.corners[0]];
      outPos.push(pos[v0 * 3], pos[v0 * 3 + 1], pos[v0 * 3 + 2]); outNrm.push(g.sum[0] / l, g.sum[1] / l, g.sum[2] / l);
      for (const ci of g.corners) outIdx[ci] = vi;
    }
  }
  return { pos: Float32Array.from(outPos), nrm: Float32Array.from(outNrm), idx: Uint32Array.from(outIdx) };
}

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const posAcc = prim.getAttribute('POSITION'), idx = prim.getIndices();
    const pos = posAcc.getArray(), index = idx ? idx.getArray() : Uint32Array.from({ length: posAcc.getCount() }, (_, i) => i);
    verts0 += posAcc.getCount();
    const r = bake(pos, index), buf = posAcc.getBuffer();
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(r.pos).setBuffer(buf));
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(r.nrm).setBuffer(buf));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(r.idx).setBuffer(buf));
    for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL'].includes(sem)) prim.setAttribute(sem, null);
  }
}
await doc.transform(dedup(), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^NORMAL$/, quantizeNormal: 8 }), prune());
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) verts1 += prim.getAttribute('POSITION').getCount();
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(file, doc);
console.log(`vértices ${verts0} -> ${verts1} · ${(before / 1024).toFixed(1)} KB -> ${(statSync(file).size / 1024).toFixed(1)} KB`);
