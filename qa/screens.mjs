// Capturas de cada página (ES y EN) en 320, 390, 768, 1280 y 1920 px → qa/screens/<id>-<es|en>-<ancho>.webp
// Se usa prefers-reduced-motion (el visor queda quieto en su primer cuadro) y se recorre la página para que se revelen las secciones.
// Uso: node qa/screens.mjs [id ...] [--widths=320,1280]     (id: inicio, auto, presupuesto, patrocinios, dossier, bitacora)
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { launch, ensureServer, BASE, VIEWPORTS } from './lib.mjs';
import { pairs } from '../scripts/lib/pages.mjs';

const args = process.argv.slice(2);
const widths = (args.find(a => a.startsWith('--widths=')) || '').replace('--widths=', '').split(',').filter(Boolean).map(Number);
const ids = args.filter(a => !a.startsWith('--'));
const list = pairs().filter(p => !ids.length || ids.includes(p.id));
mkdirSync('qa/screens', { recursive: true });

const stop = await ensureServer();
const browser = await launch();
for (const p of list) {
  for (const lang of ['es', 'en']) {
    for (const w of (widths.length ? widths : VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 }, reducedMotion: 'reduce', hasTouch: w < 500 });
      const page = await ctx.newPage();
      await page.goto(BASE + p[lang], { waitUntil: 'load' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        scrollTo(0, 0);
      });
      if (w >= 561) await page.waitForSelector('#modelStage.is-ready', { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(500);
      const out = `qa/screens/${p.id}-${lang}-${w}.webp`;
      const png = await page.screenshot({ fullPage: true });
      await sharp(png).webp({ quality: 70, effort: 4 }).toFile(out);   // WebP para que las 60 capturas pesen poco en git
      console.log(out);
      await ctx.close();
    }
  }
}
await browser.close();
stop();
