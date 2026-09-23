// Compone el poster estático del visor 3D (car-poster.webp): un recorte REAL del auto (PNG con
// alpha capturado del propio renderer de three.js, ver README de la sección) sobre el mismo fondo
// de cuadrícula navy que usa .model-stage en CSS, para que el crossfade poster -> canvas al cargar
// three.js sea imperceptible. Uso: node scripts/generate-poster.mjs <ruta-al-PNG-capturado>
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const input = process.argv[2];
if(!input){
  console.error('Uso: node scripts/generate-poster.mjs <ruta-al-PNG-capturado-del-canvas>');
  process.exit(1);
}

const W = 800, H = 550;

const bgSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#183969" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#071B33"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
</svg>`;

const carBuffer = await sharp(path.resolve(input)).resize(W, H, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toBuffer();

await sharp(Buffer.from(bgSvg))
  .composite([{ input: carBuffer, gravity: 'center' }])
  .webp({ quality: 82 })
  .toFile(path.join(root, 'car-poster.webp'));

console.log('car-poster.webp generado (' + W + 'x' + H + ')');
