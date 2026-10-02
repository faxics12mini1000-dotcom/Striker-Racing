// Genera los recursos visuales del SR-26 renderizando el modelo real en un navegador (Chrome/Edge) sin interfaz:
//   poster : car-poster.webp (+ og-preview.png con generate-og-image.mjs)
//   mapa   : assets/img/sponsor-map-{top,side}-{es,en}.webp (vistas para /patrocinios/) e imprime la posición (%) de cada marcador
//   paginas: capturas/*.png de /auto/ (armado y despiece) y /patrocinios/ a 1440 y 375 px
// Requisitos: `npm i --no-save puppeteer-core`, `node scripts/dev-server.mjs` corriendo en :8099 y un Chrome/Edge (variable BROWSER para la ruta).
// Uso: node scripts/capture-sr26.mjs [poster] [mapa] [paginas]      (sin argumentos: las tres)
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8099';
const BROWSER = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const todo = process.argv.length > 2 ? process.argv.slice(2) : ['poster', 'mapa', 'paginas'];
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/* Renderiza scripts/sr26-view.html y devuelve { png (con alfa), markers } */
async function render(query, w, h) {
  const p = await browser.newPage();
  p.on('pageerror', e => console.error('pageerror:', e.message));
  await p.setViewport({ width: w, height: h });
  await p.goto(`${BASE}/scripts/sr26-view.html?${query}&w=${w}&h=${h}`);
  await p.evaluate(() => window.carReady);
  const markers = await p.evaluate(() => window.carMarkers);
  const png = await p.screenshot({ omitBackground: true });
  await p.close();
  return { png, markers };
}

if (todo.includes('poster')) {
  const { png } = await render('view=iso', 800, 550);
  const tmp = path.join(os.tmpdir(), 'sr26-poster.png');
  await sharp(png).toFile(tmp);
  execFileSync('node', ['scripts/generate-poster.mjs', tmp], { stdio: 'inherit' });
  execFileSync('node', ['scripts/generate-og-image.mjs'], { stdio: 'inherit' });
}

if (todo.includes('mapa')) {
  mkdirSync('assets/img', { recursive: true });
  for (const lang of ['es', 'en']) for (const view of ['top', 'side']) {
    const { png, markers } = await render(`view=${view}&lang=${lang}`, 1000, 400);
    await sharp(png).webp({ quality: 86, alphaQuality: 90 }).toFile(`assets/img/sponsor-map-${view}-${lang}.webp`);
    if (lang === 'es') console.log(view, JSON.stringify(markers));
  }
}

if (todo.includes('paginas')) {
  mkdirSync('capturas', { recursive: true });
  for (const w of [1440, 375]) {
    const p = await browser.newPage();
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);   // sin giro ni ciclo: la pose depende solo del control
    await p.setViewport({ width: w, height: w > 600 ? 900 : 812, deviceScaleFactor: 1, isMobile: w < 600 });
    await p.goto(`${BASE}/auto/`, { waitUntil: 'networkidle0' });
    await p.evaluate(() => document.getElementById('modelStage').scrollIntoView({ block: 'start' }));
    await p.waitForSelector('#modelStage.is-ready', { timeout: 30000 });
    for (const [name, v] of [['armado', 0], ['despiece', 100]]) {
      await p.evaluate(v => { const r = document.querySelector('.car-ctl-range'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      await new Promise(r => setTimeout(r, 1500));
      await p.screenshot({ path: `capturas/es-auto-${name}-${w}.png` });
    }
    await p.goto(`${BASE}/patrocinios/`, { waitUntil: 'networkidle0' });
    await p.evaluate(() => document.querySelectorAll('.reveal, .card-reveal').forEach(e => e.classList.add('is-visible', 'visible', 'in')));
    await p.evaluate(() => (document.querySelector('.sponsor-map') || document.body).scrollIntoView({ block: 'start' }));
    await new Promise(r => setTimeout(r, 800));
    await p.screenshot({ path: `capturas/es-patrocinios-mapa-${w}.png` });
    await p.close();
  }
}
await browser.close();
