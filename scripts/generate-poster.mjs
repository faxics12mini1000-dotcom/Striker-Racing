// Genera los posters del visor 3D capturando el visor REAL congelado en su primer cuadro (/auto/?still): mismo ángulo, luces, sombra,
// encuadre y tamaño que verá el canvas, así el fundido poster → canvas no se nota. Son PNG/WebP con alfa y se muestran sobre el
// mismo fondo CSS del visor. Salidas (una por forma del visor): assets/img/car-poster-desktop.webp (≥ 961 px, casi cuadrado), -tablet.webp (561–960 px, 4:3)
// y -phone.webp (≤ 560 px, 4:5). Los controles se dejan en el DOM (invisibles) porque el visor encuadra el auto por encima de ellos.
// Requisitos: Playwright (devDependency) y Chrome/Edge instalados (BROWSER para la ruta). Si no hay servidor en SITE_URL, levanta scripts/dev-server.mjs.
// Uso: node scripts/generate-poster.mjs      (tras cambiar el modelo, la librea, la luz o js/viewer.js; antes corre npm run build:viewer)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { existsSync, mkdirSync, statSync } from 'node:fs';
const SITE = process.env.SITE_URL || 'http://localhost:8099';
const BROWSER = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const VARIANTS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1.5 },   // el canvas del visor usa DPR hasta 1.5
  { name: 'tablet', width: 960, height: 900, dpr: 1 },       // 4:3 (≤ 960 px el visor pasa a aspect-ratio 4/3)
  { name: 'phone', width: 390, height: 844, dpr: 1.5 },      // 4:5 (≤ 560 px)
];
// Todo transparente salvo el canvas: el poster debe llevar solo el auto y su sombra (alfa); el fondo lo pone el CSS del visor.
const HIDE = `*,*::before,*::after{background:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important}
*::before,*::after,.model-poster,.model-tag,.model-hint,.model-loader,.car-labels,.car-tip{display:none!important}
.car-ctl,.car-ctl *{visibility:hidden!important}
.cockpit,.sticky-cta,.hud-top-btn,#backToTop{display:none!important}`;   /* el menú fijo no debe colarse en la captura del canvas */
mkdirSync('assets/img', { recursive: true });
// servidor local si hace falta
let server = null;
try { await fetch(SITE + '/'); } catch { server = spawn(process.execPath, ['scripts/dev-server.mjs', new URL(SITE).port || '8099', '.'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1200)); }
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of VARIANTS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('pageerror:', e.message));
  await p.goto(`${SITE}/auto/?still`, { waitUntil: 'load' });
  if (v.width <= 560) await p.getByRole('button', { name: 'Explorar en 3D' }).click();   // en teléfono el 3D espera al toque
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
  await ctx.close();
}
await browser.close();
if (server) server.kill();
