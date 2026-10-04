// Caras seguras del hero: ningún texto, botón ni el menú fijo del inicio (ES y EN) toca las cajas de data/hero-safe.json, a 1920×1080, 1440×900, 1024×768 y 390×844.
// Proyecta cada caja (en % de la foto) sobre la foto renderizada (object-fit/object-position incluidos) y revisa intersecciones con el título (máx. 2 líneas),
// la etiqueta, el subtexto, los botones, el menú y el enlace «Ver el auto». También exige que ninguna cara quede recortada por el borde de la ventana.
// Uso: node qa/hero-safe.test.mjs   (SAVE_SHOTS=1 guarda qa/screens/hero-safe-<idioma>-<ancho>.png)
import { readFileSync, mkdirSync } from 'node:fs';
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const SAFE = JSON.parse(readFileSync('data/hero-safe.json', 'utf8'));
const VIEWPORTS = [[1920, 1080], [1440, 900], [1024, 768], [390, 844]];
if (process.env.SAVE_SHOTS) mkdirSync('qa/screens', { recursive: true });
const stop = await ensureServer();
const browser = await launch();

for (const lang of ['es', 'en']) {
  for (const [w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
    const page = await ctx.newPage();
    await page.goto(BASE + (lang === 'es' ? '/' : '/en/'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => { const i = document.querySelector('.hero-bg img'); return i && i.complete && i.naturalWidth > 0; });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const box = e => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; };
      const img = document.querySelector('.hero-bg img'), cs = getComputedStyle(img), b = box(img);
      // proyección de object-fit: cover con object-position
      const nw = img.naturalWidth, nh = img.naturalHeight, s = Math.max(b.w / nw, b.h / nh), rw = nw * s, rh = nh * s;
      const [px, py] = cs.objectPosition.split(' ').map(v => parseFloat(v) / 100);
      const ox = b.x + (b.w - rw) * px, oy = b.y + (b.h - rh) * py;
      const lh = parseFloat(getComputedStyle(document.querySelector('.hero-copy h1')).lineHeight);
      const items = {};
      for (const [k, sel] of [['etiqueta', '.hero-copy .room-tag'], ['título', '.hero-copy h1'], ['subtexto', '.hero-copy .hero-lead'], ['menú', '.cockpit-bar'], ['ver el auto', '.hero-scroll']]) items[k] = box(document.querySelector(sel));
      document.querySelectorAll('.hero-copy .cta-row a').forEach((a, i) => { items['botón ' + (i + 1)] = box(a); });
      return { rw, rh, ox, oy, items, titleLines: Math.round(box(document.querySelector('.hero-copy h1')).h / lh), vw: innerWidth, scrollW: document.documentElement.scrollWidth };
    });
    const tag = `${lang} ${w}×${h}`;
    check(r.titleLines <= 2, `${tag}: título en ${r.titleLines} línea(s) (máx. 2)`);
    check(r.scrollW <= r.vw, `${tag}: sin scroll horizontal`);
    const faces = SAFE.faces.map(f => ({ id: f.id, x: r.ox + f.x / 100 * r.rw, y: r.oy + f.y / 100 * r.rh, w: f.w / 100 * r.rw, h: f.h / 100 * r.rh }));
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const hits = [];
    for (const [name, it] of Object.entries(r.items)) for (const f of faces) if (hit(it, f)) hits.push(`${name} × ${f.id}`);
    check(hits.length === 0, `${tag}: texto, botones y menú fuera de las caras${hits.length ? ' → ' + hits.join(', ') : ''}`);
    const cut = faces.filter(f => f.x < 0 || f.x + f.w > r.vw || f.y < 64).map(f => f.id);   // 64 = alto del menú fijo
    check(cut.length === 0, `${tag}: ninguna cara recortada por la ventana ni tapada por el menú${cut.length ? ' → ' + cut.join(', ') : ''}`);
    if (process.env.SAVE_SHOTS) await page.screenshot({ path: `qa/screens/hero-safe-${lang}-${w}.png` });
    await ctx.close();
  }
}
await browser.close(); stop();
finish();
