// Regresión: las secciones .reveal (sobre todo #patrocinios, ~4,600 px de alto) y las tarjetas de niveles deben quedar visibles
// en pantallas bajas, al hacer scroll y sin JS. Antes, con threshold 0.12 sobre una sección más alta que ~8× el viewport, nunca se activaban.
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const stop = await ensureServer();
const browser = await launch();
const SIZES = [[320, 480], [390, 844], [844, 390], [1280, 720]];
const URLS = ['/patrocinios/', '/en/sponsorship/'];

for (const [w, h] of SIZES) {
  for (const url of URLS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'load' });
    // recorre la página como lo haría una persona
    await page.evaluate(async () => {
      const step = Math.max(200, innerHeight * 0.6);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 900));
    });
    const res = await page.evaluate(() => {
      const hidden = [...document.querySelectorAll('.reveal, .card-reveal')]
        .filter(el => getComputedStyle(el).opacity !== '1').map(el => el.id || el.className);
      const tiers = document.querySelectorAll('.tier').length;
      const sec = document.querySelector('#patrocinios, #sponsorship');
      return { hidden, tiers, secH: Math.round(sec.getBoundingClientRect().height) };
    });
    check(res.hidden.length === 0 && res.tiers === 4, `${url} ${w}x${h}: ${res.tiers} niveles, sección de ${res.secH}px, ocultos: [${res.hidden.join(', ')}]`);
    await ctx.close();

    // sin JS el contenido debe verse completo
    const noJs = await browser.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false });
    const p2 = await noJs.newPage();
    await p2.goto(BASE + url, { waitUntil: 'load' });
    const vis = await p2.evaluate(() => [...document.querySelectorAll('.reveal, .card-reveal')].filter(el => getComputedStyle(el).opacity !== '1').length);
    check(vis === 0, `${url} ${w}x${h} sin JS: elementos ocultos = ${vis}`);
    await noJs.close();
  }
}
await browser.close();
stop();
finish();
