// Capturas de las costuras del hero → qa/screens/hero-seams-<ancho>-<estado>.png (arriba: header transparente; scroll: header sólido; franja hero→visor→siguiente sección).
// Uso: node qa/screens-hero.mjs
import { mkdirSync } from 'node:fs';
import { launch, ensureServer, BASE } from './lib.mjs';
mkdirSync('qa/screens', { recursive: true });
const stop = await ensureServer(); const browser = await launch();
for (const [w, h] of [[1920, 1080], [1440, 900], [1024, 768], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: w < 600 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => { const i = document.querySelector('.hero-bg img'); return i && i.complete && i.naturalWidth > 0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `qa/screens/hero-seams-${w}-top.png` });
  const hb = await page.evaluate(() => { const r = document.querySelector('.hero-photo').getBoundingClientRect(); return r.bottom + scrollY; });
  await page.evaluate(y => scrollTo(0, y), Math.max(0, hb - h * 0.6)); await page.waitForTimeout(400);
  await page.screenshot({ path: `qa/screens/hero-seams-${w}-junction.png` });
  const sb = await page.evaluate(() => { const r = document.querySelector('.viewer-full').getBoundingClientRect(); return r.bottom + scrollY; });
  await page.evaluate(y => scrollTo(0, y), Math.max(0, sb - h * 0.55)); await page.waitForTimeout(400);
  await page.screenshot({ path: `qa/screens/hero-seams-${w}-viewer-end.png` });
  await ctx.close();
}
await browser.close(); stop();
