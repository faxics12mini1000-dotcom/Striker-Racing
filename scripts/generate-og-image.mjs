// Regenera og-preview.png (1200x630) en la paleta vigente (azul + verde, sin morado). Es un
// gráfico tipográfico/de marca -- no pretende ser una fotografía del auto terminado (ver
// TODO-EQUIPO.md: sustituir cuando exista una foto o render final real del monoplaza pintado).
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

  <rect x="0" y="0" width="10" height="${H}" fill="#2A6DF5"/>
  <rect x="${W - 10}" y="0" width="10" height="${H}" fill="#12B866"/>

  <text x="80" y="150" font-family="Arial, sans-serif" font-size="26" font-weight="700"
        letter-spacing="4" fill="#12B866">STEM RACING MEXICO &#183; TEMPORADA 2026&#8211;2027</text>

  <text x="78" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="98" font-weight="700" fill="#CDDEEF">STRIKER</text>
  <text x="78" y="368" font-family="Georgia, 'Times New Roman', serif" font-size="98" font-weight="700" fill="#CDDEEF">RACING</text>

  <rect x="80" y="410" width="640" height="3" fill="#183969"/>

  <text x="80" y="460" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.86">
    Escuderia estudiantil de Preparatoria Celta
  </text>
  <text x="80" y="500" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.86">
    Diseno, manufactura y competencia de un F1 a escala
  </text>

  <g transform="translate(80,538)">
    <rect x="0" y="0" width="360" height="50" fill="none" stroke="#2A6DF5" stroke-width="2"/>
    <text x="180" y="32" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#CDDEEF" text-anchor="middle" letter-spacing="1">SUMATE COMO PATROCINADOR</text>
  </g>

  <text x="1120" y="600" font-family="'JetBrains Mono', monospace" font-size="15" fill="#CDDEEF" opacity="0.55" text-anchor="end">striker-racing.vercel.app</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(root, 'og-preview.png'));
console.log('og-preview.png regenerado (1200x630)');
