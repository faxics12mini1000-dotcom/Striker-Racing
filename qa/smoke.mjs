// Pruebas de humo: todas las páginas cargan sin errores de consola ni peticiones fallidas, la navegación y el cambio de idioma funcionan, los enlaces de WhatsApp
// llevan mensaje y número, el botón «Patrocinar» apunta a Patrocinios y el menú móvil se abre. (El visor 3D, el configurador, AR y el contenido tienen sus propias pruebas.)
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';
import { pairs } from '../scripts/lib/pages.mjs';

const stop = await ensureServer();
const browser = await launch();
for (const lang of ['es', 'en']) {
  for (const p of pairs()) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    const res = await page.goto(BASE + p[lang], { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    check(res.status() === 200, `${p[lang]} responde 200`);
    check(errors.length === 0 && failed.length === 0, `${p[lang]} sin errores de consola ni recursos rotos ${errors.concat(failed).join(' | ')}`);
    check(await page.locator('h1').count() === 1, `${p[lang]} tiene un solo h1`);
    // idioma
    const other = lang === 'es' ? 'en' : 'es';
    await page.locator(`.lang-switch a[lang="${other}"]`).click();
    await page.waitForLoadState('load');
    check(new URL(page.url()).pathname === p[other], `${p[lang]} → cambio de idioma lleva a ${p[other]}`);
    await page.goBack(); await page.waitForLoadState('load');
    // WhatsApp
    const wa = await page.locator('a[href^="https://wa.me/"]').evaluateAll(as => as.map(a => a.href));
    check(wa.length > 0 && wa.every(h => h.startsWith('https://wa.me/525511839779?text=') && decodeURIComponent(h.split('text=')[1]).length > 15), `${p[lang]} ${wa.length} enlaces de WhatsApp con número y mensaje`);
    await ctx.close();
  }
  // navegación por el menú (desde el inicio)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + (lang === 'es' ? '/' : '/en/'));
  const links = await page.locator('nav .cockpit-links a').evaluateAll(as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
  for (const [name, href] of links) {
    await page.goto(BASE + (lang === 'es' ? '/' : '/en/'));
    await page.locator(`nav .cockpit-links a[href="${href}"]`).click(); await page.waitForLoadState('load');
    check(new URL(page.url()).pathname === href && await page.locator('nav .cockpit-links a[aria-current="page"]').count() === 1, `menú ${lang}: «${name}» → ${href}`);
  }
  await page.goto(BASE + (lang === 'es' ? '/' : '/en/'));
  const sponsor = await page.locator('nav a.is-sponsor').getAttribute('href');
  check(sponsor === (lang === 'es' ? '/patrocinios/' : '/en/sponsorship/'), `botón Patrocinar (${lang}) → ${sponsor}`);
  await ctx.close();
}
// menú móvil y botón fijo
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/presupuesto/');
  await page.locator('#navToggle').tap();
  check(await page.locator('#navPanel.open').count() === 1 && await page.locator('#navToggle').getAttribute('aria-expanded') === 'true', 'móvil: el menú se abre');
  await page.keyboard.press('Escape');
  check(await page.locator('#navPanel.open').count() === 0, 'móvil: Escape cierra el menú');
  await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(600);
  check(await page.locator('#stickyCta.is-visible').count() === 1, 'móvil: el botón fijo «Patrocinar» aparece al bajar');
  await ctx.close();
}
await browser.close(); stop(); finish();
