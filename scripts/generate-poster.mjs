// Genera los posters del visor 3D capturando el visor REAL congelado en su primer cuadro (/auto/?still): mismo ángulo, luces, sombra,
// encuadre y tamaño que verá el canvas, así el fundido poster → canvas no se nota. Son PNG/WebP con alfa y se muestran sobre el
// mismo fondo CSS del visor. Salidas: assets/img/car-poster-desktop.webp (visor ≥ 961 px, casi cuadrado) y car-poster-mobile.webp (4:3).
// Requisitos: puppeteer-core, `node scripts/dev-server.mjs` en :8099 y Edge/Chrome (BROWSER para la ruta).
// Uso: node scripts/generate-poster.mjs      (tras cambiar el modelo, la librea, la luz o js/viewer.js; antes corre npm run build:viewer)
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, statSync } from 'node:fs';
const SITE = process.env.SITE_URL || 'http://localhost:8099';
const BROWSER = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const VARIANTS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1.5 },   // el canvas del visor usa DPR hasta 1.5
  { name: 'mobile', width: 960, height: 900, dpr: 1 },       // 4:3 (≤ 960 px el visor pasa a aspect-ratio 4/3)
];
// Todo transparente salvo el canvas: el poster debe llevar solo el auto y su sombra (alfa); el fondo lo pone el CSS del visor.
const HIDE = `*,*::before,*::after{background:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important}
*::before,*::after,.model-poster,.model-tag,.model-hint,.model-loader,.car-ctl,.car-labels{display:none!important}`;
mkdirSync('assets/img', { recursive: true });
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of VARIANTS) {
  const p = await browser.newPage();
  p.on('pageerror', e => console.error('pageerror:', e.message));
  await p.setViewport({ width: v.width, height: v.height, deviceScaleFactor: v.dpr });
  await p.goto(`${SITE}/auto/?still`, { waitUntil: 'load' });
  await p.waitForSelector('#modelStage.is-ready', { timeout: 120000 });
  await new Promise(r => setTimeout(r, 1200));           // un par de cuadros más, ya sin sombras pendientes
  await p.addStyleTag({ content: HIDE });
  await new Promise(r => setTimeout(r, 300));
  const canvas = await p.$('#modelStage canvas');
  const box = await canvas.boundingBox();
  const png = await canvas.screenshot({ omitBackground: true });
  const out = `assets/img/car-poster-${v.name}.webp`;
  await sharp(png).webp({ quality: 80, alphaQuality: 72, effort: 6, smartSubsample: true }).toFile(out);
  const m = await sharp(out).metadata();
  console.log(`${out}  ${m.width}x${m.height}  ${(statSync(out).size / 1024).toFixed(1)} KB  (visor ${Math.round(box.width)}x${Math.round(box.height)} CSS px)`);
  await p.close();
}
await browser.close();
