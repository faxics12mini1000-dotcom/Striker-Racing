// Genera los QR del botón «Ver en tu mesa» como SVG estático (sin librería en el navegador): modules oscuros sobre fondo claro, zona de silencio de 4 módulos.
// Apuntan a la página del auto con ?ar=1, que en un teléfono lleva al botón de AR. Uso: npm run build:qr   (también lo corre build:all)
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const TARGETS = { es: 'https://strikerracing.com/auto/?ar=1', en: 'https://strikerracing.com/en/car/?ar=1' };
for (const [lang, url] of Object.entries(TARGETS)) {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#071b33', light: '#ffffff' } });
  writeFileSync(`assets/img/ar-qr-${lang}.svg`, svg);
  console.log(`assets/img/ar-qr-${lang}.svg → ${url}`);
}
