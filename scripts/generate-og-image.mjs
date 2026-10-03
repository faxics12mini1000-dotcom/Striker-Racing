// Regenera la imagen por defecto para compartir (og-share.png, 1200x630) y los iconos del sitio a partir de logo.png:
//   favicon-16/32/48/192/512.png, favicon.ico (16+32+48), apple-touch-icon.png (180, sobre navy) y site.webmanifest.
// Estética plana: sin degradados ni brillos. Los colores salen de los tokens de css/site.css (scripts/lib/palette.mjs), no se escriben a mano.
// Las imágenes de cada página (assets/img/og/*.jpg) las genera scripts/generate-og-pages.mjs.
// Uso: node scripts/generate-og-image.mjs    (o npm run build:brand)
import sharp from 'sharp';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { palette, hexToRgb } from './lib/palette.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const P = palette();
const W = 1200, H = 630;
const logoPath = path.join(root, 'logo.png');

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="${P.line}" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${P.navy}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect x="0" y="0" width="10" height="${H}" fill="${P.purple}"/>
  <rect x="${W - 10}" y="0" width="10" height="${H}" fill="${P.emerald}"/>

  <text x="470" y="170" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${P.lime}">STEM RACING MÉXICO · 2026–2027</text>
  <text x="466" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="${P.ice}">STRIKER</text>
  <text x="466" y="394" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="${P.emerald}">RACING</text>
  <rect x="470" y="424" width="520" height="3" fill="${P.purple}"/>
  <text x="470" y="478" font-family="Arial, sans-serif" font-size="28" fill="${P.ice}" opacity="0.88">Escudería estudiantil de Preparatoria Celta</text>
  <text x="470" y="518" font-family="Arial, sans-serif" font-size="28" fill="${P.ice}" opacity="0.88">Diseño, manufactura y competencia de un F1 a escala</text>
  <text x="1150" y="596" font-family="'JetBrains Mono', monospace" font-size="18" fill="${P.ice}" opacity="0.6" text-anchor="end">strikerracing.com</text>
</svg>`;

const logoBig = await sharp(logoPath).trim().resize({ width: 330, height: 330, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logoBig).metadata();
await sharp(Buffer.from(svg))
  .composite([{ input: logoBig, left: 50 + Math.round((340 - lm.width) / 2), top: Math.round((H - lm.height) / 2) }])
  .png({ compressionLevel: 9, palette: true }).toFile(path.join(root, 'og-share.png'));
console.log('og-share.png (1200x630)');

// Iconos: el logo recortado, con margen, sobre transparente (favicon) y sobre navy (apple-touch, iOS rellena lo transparente con negro).
async function icon(size, bg, out) {
  const pad = Math.round(size * 0.1), inner = size - pad * 2;
  const mark = await sharp(logoPath).trim().resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mark, gravity: 'center' }]).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(path.join(root, out), buf);
  console.log(out);
  return buf;
}
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const navy = { ...hexToRgb(P.navy), alpha: 1 };
const png16 = await icon(16, clear, 'favicon-16.png');
const png32 = await icon(32, clear, 'favicon-32.png');
const png48 = await icon(48, clear, 'favicon-48.png');
await icon(192, clear, 'favicon-192.png');
await icon(512, clear, 'favicon-512.png');
await icon(180, navy, 'apple-touch-icon.png');

// favicon.ico con tres tamaños; cada imagen va como PNG dentro del contenedor ICO (válido en todos los navegadores actuales).
{
  const imgs = [[16, png16], [32, png32], [48, png48]];
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let offset = head.length;
  imgs.forEach(([size, buf], i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size, o); head.writeUInt8(size, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([head, ...imgs.map(i => i[1])]));
  console.log('favicon.ico (16, 32, 48)');
}

writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify({
  name: 'Striker Racing', short_name: 'Striker Racing',
  description: 'Striker Racing · Preparatoria Celta · STEM Racing México 2026–2027',
  start_url: '/', scope: '/', display: 'browser', lang: 'es-MX',
  theme_color: P.navy, background_color: P.navy,
  icons: [
    { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');
console.log('site.webmanifest');
