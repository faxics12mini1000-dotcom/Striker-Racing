// Auditoría visual: recorre todas las páginas ES y EN a 1440 y 390 px, guarda captura de página completa (qa/screens/audit-<id>-<idioma>-<ancho>.png) y reporta
// scroll horizontal, texto cortado (scrollWidth > clientWidth), imágenes que desbordan su contenedor o su ventana, fotos que terminan en corte duro (sin mask-image)
// y elementos con texto encimados. Falla si encuentra algo. Uso: node qa/audit.mjs
import { mkdirSync } from 'node:fs';
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';
import { pairs } from '../scripts/lib/pages.mjs';
mkdirSync('qa/screens', { recursive: true });
const stop = await ensureServer();
const browser = await launch();
for (const p of pairs()) for (const lang of ['es', 'en']) for (const w of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  await page.goto(BASE + p[lang], { waitUntil: 'load' });
  await page.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const out = { hscroll: document.documentElement.scrollWidth - innerWidth, clipped: [], imgs: [], hard: [], overlap: [] };
    const vis = e => { const b = e.getBoundingClientRect(), c = getComputedStyle(e); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '');
    for (const e of document.querySelectorAll('main *, nav *, footer *')) {
      if (!vis(e) || e.closest('svg, #modelStage, .model-stage, .sr-only, .skip-link')) continue;
      const c = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (c.overflowX === 'hidden' || c.overflowX === 'clip' || c.textOverflow === 'ellipsis') && !['IMG', 'PICTURE'].includes(e.tagName)) out.clipped.push(name(e) + ` (${e.scrollWidth}>${e.clientWidth})`);
      else if (e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.cockpit, .hero-bg') && e.getBoundingClientRect().width < innerWidth * 3 && c.position !== 'fixed' && !e.closest('[style*="overflow"], .table-wrap, pre, .scroll-x')) {
        if (!e.parentElement || e.parentElement.getBoundingClientRect().right <= innerWidth + 1 || true) out.clipped.push(name(e) + ` desborda la ventana (${Math.round(e.getBoundingClientRect().right)}>${innerWidth})`);
      }
    }
    for (const i of document.querySelectorAll('main img, .hero-bg img')) {
      if (!vis(i) || i.closest('.model-stage')) continue;
      const b = i.getBoundingClientRect(), c = getComputedStyle(i), pb = i.parentElement.getBoundingClientRect();
      if (i.complete && i.naturalWidth && c.objectFit === 'fill' && Math.abs(b.width / b.height - i.naturalWidth / i.naturalHeight) > 0.05) out.imgs.push(name(i) + ' deformada');
      if (b.right > innerWidth + 1 || b.left < -1) out.imgs.push(name(i) + ' fuera de la ventana');
      const masked = (c.maskImage && c.maskImage !== 'none') || (c.webkitMaskImage && c.webkitMaskImage !== 'none');
      const big = b.width > 300 && b.height > 150;
      const cropped = c.objectFit === 'cover' && i.naturalWidth && Math.abs(b.width / b.height - i.naturalWidth / i.naturalHeight) > 0.05;
      if (big && cropped && !masked && !i.closest('.paddock-pass, .pass-img')) out.hard.push(`${name(i)} ${Math.round(b.width)}×${Math.round(b.height)} recortada con object-fit sin difuminado`);
    }
    const texts = [...document.querySelectorAll('main h1, main h2, main h3, main p, main .btn, main .micro, nav a')].filter(e => vis(e) && !e.closest('details:not([open])'));   // el contenido de un <details> cerrado no se ve
    for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
      if (texts[a].contains(texts[b]) || texts[b].contains(texts[a])) continue;
      const x = texts[a].getBoundingClientRect(), y = texts[b].getBoundingClientRect();
      const ix = Math.min(x.right, y.right) - Math.max(x.left, y.left), iy = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (ix > 4 && iy > 4 && getComputedStyle(texts[a]).position !== 'fixed' && getComputedStyle(texts[b]).position !== 'fixed') out.overlap.push(`${name(texts[a])} × ${name(texts[b])}`);
    }
    return out;
  });
  const tag = `${p.id} ${lang} ${w}`;
  await page.screenshot({ path: `qa/screens/audit-${p.id}-${lang}-${w}.png`, fullPage: true });
  check(r.hscroll <= 0, `${tag}: sin scroll horizontal (${r.hscroll})`);
  check(!r.clipped.length, `${tag}: sin texto cortado ${r.clipped.slice(0, 5).join(' | ')}`);
  check(!r.imgs.length, `${tag}: imágenes sin deformar ni fuera de la ventana ${r.imgs.join(' | ')}`);
  check(!r.hard.length, `${tag}: fotos sin corte duro ${r.hard.join(' | ')}`);
  check(!r.overlap.length, `${tag}: sin elementos de texto encimados ${r.overlap.slice(0, 5).join(' | ')}`);
  await ctx.close();
}
await browser.close(); stop();
finish();
