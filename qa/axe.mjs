// axe-core (WCAG 2.0/2.1/2.2 A y AA) sobre todas las páginas, ES y EN, en móvil y escritorio.
// Uso: node qa/axe.mjs [ruta ...]      Sale con código 1 si hay violaciones.
import { AxeBuilder } from '@axe-core/playwright';
import { launch, ensureServer, BASE, PAGES, check, finish } from './lib.mjs';

const only = process.argv.slice(2);
const urls = [...PAGES.flatMap(p => [p.es, p.en]), '/dossier/', '/en/dossier/', '/404.html', '/privacidad.html', '/en/privacidad.html', '/bitacora/', '/en/log/']
  .filter(u => !only.length || only.includes(u));
const stop = await ensureServer();
const browser = await launch();
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const u of urls) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const res = await page.goto(BASE + u, { waitUntil: 'load' });
    if (!res || res.status() >= 400) { await ctx.close(); continue; }   // páginas opcionales que aún no existen
    await page.waitForTimeout(1500);
    // el contenido que se revela al hacer scroll se evalúa ya visible
    await page.addStyleTag({ content: '.reveal,.card-reveal{opacity:1!important;transform:none!important}' });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    check(r.violations.length === 0, `${u} ${w}px: ${r.violations.length} violaciones`);
    for (const v of r.violations) console.log(`      - ${v.id} (${v.impact}): ${v.help} · ${v.nodes.length} nodo(s) · ${v.nodes[0].target.join(' ')}`);
    await ctx.close();
  }
}
await browser.close();
stop();
finish();
