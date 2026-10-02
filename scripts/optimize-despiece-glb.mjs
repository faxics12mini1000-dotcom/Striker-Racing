// Genera despiece/sr26.glb (liviano) a partir de scripts/source/sr26.full.glb (original completo, fuera de la carpeta que se publica):
//  - quita la pieza 14 (casco de ~9,000 triángulos); el módulo la reemplaza por una esfera si CONFIG.showCasco es true
//  - comprime con EXT_meshopt_compression SIN cuantizar (el módulo usa las posiciones/escalas de nodo tal cual)
// Uso: node scripts/optimize-despiece-glb.mjs
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read('scripts/source/sr26.full.glb');
const root = doc.getRoot();
for (const n of root.listNodes()) {
  if (n.getName().startsWith('14')) {
    const mesh = n.getMesh(); let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } } }
    console.log('casco', n.getName(), 'translation', n.getTranslation(), 'scale', n.getScale(), 'bbox', min, max);
    n.dispose();
  }
}
await doc.transform(prune(), dedup(), weld());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write('despiece/sr26.glb', doc);
console.log('full', (statSync('scripts/source/sr26.full.glb').size / 1024).toFixed(0), 'KB -> light', (statSync('despiece/sr26.glb').size / 1024).toFixed(1), 'KB');
