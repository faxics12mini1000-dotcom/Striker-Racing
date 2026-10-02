// Regenera og-preview.png (1200x630) con los 6 colores oficiales (navy, azul, morado, verde, hielo, limón).
// Compone el póster del SR-26 (car-poster.webp, ya con la librea vigente) junto al titular de marca.
// Si cambia la librea: regenerar primero car-poster.webp (scripts/generate-poster.mjs) y luego este script.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = 1200, H = 630;

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#183969" stroke-width="1" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#071B33"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  <rect x="0" y="0" width="10" height="${H}" fill="#7137D4"/>
  <rect x="${W - 10}" y="0" width="10" height="${H}" fill="#12B866"/>
  <rect x="640" y="70" width="480" height="330" fill="none" stroke="#183969" stroke-width="2"/>
  <rect x="80" y="104" width="10" height="10" fill="#7FD9B0"/>

  <text x="104" y="114" font-family="Arial, sans-serif" font-size="20" font-weight="700"
        letter-spacing="3" fill="#B79CF0">STEM RACING MÉXICO · 2026–2027</text>

  <text x="78" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="98" font-weight="700" fill="#CDDEEF">STRIKER</text>
  <text x="78" y="348" font-family="Georgia, 'Times New Roman', serif" font-size="98" font-weight="700" fill="#12B866">RACING</text>

  <rect x="80" y="400" width="480" height="3" fill="#7137D4"/>

  <text x="80" y="460" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.86">
    Escudería estudiantil de Preparatoria Celta
  </text>
  <text x="80" y="500" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.86">
    Diseño, manufactura y competencia de un F1 a escala
  </text>

  <g transform="translate(80,538)">
    <rect x="0" y="0" width="360" height="50" fill="none" stroke="#12B866" stroke-width="2"/>
    <text x="180" y="32" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#CDDEEF" text-anchor="middle" letter-spacing="1">SÚMATE COMO PATROCINADOR</text>
  </g>

  <text x="1120" y="600" font-family="'JetBrains Mono', monospace" font-size="15" fill="#CDDEEF" opacity="0.55" text-anchor="end">striker-racing.vercel.app</text>
</svg>`;

const car = await sharp(path.join(root, 'car-poster.webp')).resize(476, 327).png().toBuffer();
await sharp(Buffer.from(svg)).composite([{ input: car, left: 642, top: 72 }]).png().toFile(path.join(root, 'og-preview.png'));
console.log('og-preview.png regenerado (1200x630)');
