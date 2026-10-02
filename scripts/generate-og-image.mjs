// Regenera la imagen para compartir (og-share.png, 1200x630) y los iconos (favicon / apple-touch) a partir de logo.png.
// og-share.png: logo grande de la escudería + titular de marca sobre el fondo navy del sitio.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = 1200, H = 630;
const logoPath = path.join(root, 'logo.png');

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#183969" stroke-width="1" opacity="0.5"/>
    </pattern>
    <radialGradient id="glow" cx="215" cy="315" r="300" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1c4a8f" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#071B33" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#071B33"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="10" height="${H}" fill="#7137D4"/>
  <rect x="${W - 10}" y="0" width="10" height="${H}" fill="#12B866"/>

  <text x="470" y="170" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="#7FD9B0">STEM RACING MÉXICO · 2026–2027</text>
  <text x="466" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="#CDDEEF">STRIKER</text>
  <text x="466" y="394" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="#12B866">RACING</text>
  <rect x="470" y="424" width="520" height="3" fill="#7137D4"/>
  <text x="470" y="478" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.88">Escudería estudiantil de Preparatoria Celta</text>
  <text x="470" y="518" font-family="Arial, sans-serif" font-size="28" fill="#CDDEEF" opacity="0.88">Diseño, manufactura y competencia de un F1 a escala</text>
  <text x="1150" y="596" font-family="'JetBrains Mono', monospace" font-size="18" fill="#CDDEEF" opacity="0.6" text-anchor="end">strikerracing.com</text>
</svg>`;

const logoBig = await sharp(logoPath).trim().resize({ width: 330, height: 330, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logoBig).metadata();
await sharp(Buffer.from(svg))
  .composite([{ input: logoBig, left: 50 + Math.round((340 - lm.width) / 2), top: Math.round((H - lm.height) / 2) }])
  .png({ compressionLevel: 9, palette: true }).toFile(path.join(root, 'og-share.png'));
console.log('og-share.png (1200x630)');

// Iconos: el logo recortado, con margen, sobre transparente (favicon) y sobre navy (apple-touch, iOS rellena lo transparente con negro).
async function icon(size, bg, out){
  const pad = Math.round(size * 0.1), inner = size - pad * 2;
  const mark = await sharp(logoPath).trim().resize({ width: inner, height: inner, fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mark, gravity: 'center' }]).png({ compressionLevel: 9 }).toFile(path.join(root, out));
  console.log(out);
}
await icon(48, { r:0,g:0,b:0,alpha:0 }, 'favicon-48.png');
await icon(192, { r:0,g:0,b:0,alpha:0 }, 'favicon-192.png');
await icon(180, { r:7,g:27,b:51,alpha:1 }, 'apple-touch-icon.png');
