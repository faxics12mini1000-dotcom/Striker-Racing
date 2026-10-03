// Lectura de GLB con @gltf-transform y medidas del modelo (mm). Compartido por la canalización (build-model.mjs), el dato del inicio (build-facts.mjs)
// y las pruebas. El GLB viene en metros, Y arriba, X hacia el frente (+x = nariz), un nodo por STL cuyo nombre empieza con el número de pieza.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

export async function makeIO() {
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, KHRMaterialsClearcoat])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}
export const readGlb = async file => (await makeIO()).read(file);

/** Caja (en mm) de un nodo con malla, en coordenadas del mundo. */
export function nodeBox(node) {
  const mesh = node.getMesh(); if (!mesh) return null;
  const m = node.getWorldMatrix(), v = [0, 0, 0];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const prim of mesh.listPrimitives()) {
    const a = prim.getAttribute('POSITION');
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      const p = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k] * 1000); mx[k] = Math.max(mx[k], p[k] * 1000); }
    }
  }
  return { mn, mx };
}
const merge = (a, b) => a ? { mn: a.mn.map((x, i) => Math.min(x, b.mn[i])), mx: a.mx.map((x, i) => Math.max(x, b.mx[i])) } : b;
export const prefix = name => name.slice(0, 2);
const center = (b, axis) => (b.mn[axis] + b.mx[axis]) / 2;

/** Medidas del auto armado, calculadas del GLB. Largo SIN cartucho (pieza 15); distancia entre ejes = separación de los centros de las piezas 20 y 21. */
export function measure(doc) {
  const nodes = doc.getRoot().listNodes().filter(n => n.getMesh());
  const boxes = nodes.map(n => [n, nodeBox(n)]);
  let all = null, noCart = null, axleF = null, axleR = null;
  for (const [n, b] of boxes) {
    all = merge(all, b);
    if (prefix(n.getName()) !== '15') noCart = merge(noCart, b);
    if (prefix(n.getName()) === '20') axleF = b;
    if (prefix(n.getName()) === '21') axleR = b;
  }
  const len = b => b.mx[0] - b.mn[0], wid = b => b.mx[2] - b.mn[2], hei = b => b.mx[1] - b.mn[1];
  return {
    parts: nodes.length,
    length: len(noCart), lengthWithCartridge: len(all), width: wid(noCart), height: hei(noCart),
    wheelbase: axleF && axleR ? Math.abs(center(axleF, 0) - center(axleR, 0)) : null,
    box: noCart,
  };
}
