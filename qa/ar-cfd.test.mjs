// «Ver en tu mesa» (AR) y sección Aerodinámica (CFD). El botón de AR está oculto salvo que el dispositivo soporte AR; model-viewer es autoalojado y solo se
// descarga al pulsarlo (no hay CDN). La sección CFD aparece solo con datos en data/cfd.json (aquí se prueba con datos de ejemplo y se restaura el archivo).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const stop = await ensureServer();
const browser = await launch();

for (const [url, label] of [['/auto/', 'Ver en tu mesa'], ['/en/car/', 'See it on your table']]) {
  // escritorio sin AR: oculto, sin descargar model-viewer
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const reqs = []; page.on('request', r => reqs.push(r.url()));
    await page.goto(BASE + url); await page.waitForTimeout(1200);
    check(await page.locator('#arBtn').isHidden(), `${url} sin AR: el botón «${label}» está oculto`);
    check(!reqs.some(u => /model-viewer|sr26-ar/.test(u)), `${url} sin AR: no se descarga model-viewer ni el GLB de AR`);
    check(await page.locator('#arBtn').getAttribute('data-ar-model').then(v => /^\/assets\/models\/sr26-ar\.glb\?v=[0-9a-f]{8}$/.test(v)), `${url} el botón apunta a sr26-ar.glb versionado`);
    await ctx.close();
  }
  // dispositivo con AR (WebXR simulado)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
    const page = await ctx.newPage();
    const reqs = []; page.on('request', r => reqs.push(r.url()));
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + url); await page.waitForTimeout(800);
    check(await page.locator('#arBtn').isVisible(), `${url} Android: el botón «${label}» aparece`);
    check(!reqs.some(u => /model-viewer/.test(u)), `${url} Android: model-viewer aún no se descargó (bajo demanda)`);
    await page.locator('#arBtn').click();
    const mv = page.locator('dialog.ar-dialog model-viewer');
    await mv.waitFor({ timeout: 20000 });
    check(reqs.some(u => /\/vendor\/model-viewer\/4\.3\.1\/model-viewer\.min\.js$/.test(u)), `${url} model-viewer viene de /vendor/ (autoalojado)`);
    check(!reqs.some(u => /unpkg|jsdelivr|cdnjs|ajax\.googleapis|modelviewer\.dev/.test(u)), `${url} sin CDN`);
    check(await mv.getAttribute('ar-scale') === 'fixed', `${url} escala AR fija (1:1)`);
    check(/sr26-ar\.glb/.test(await mv.getAttribute('src')), `${url} usa sr26-ar.glb`);
    const loaded = await page.waitForFunction(() => { const m = document.querySelector('model-viewer'); return m && m.loaded; }, null, { timeout: 30000 }).then(() => true, () => false);
    check(loaded, `${url} el GLB de AR carga en model-viewer (sin meshopt)`);
    check(errors.length === 0, `${url} sin errores de página ${errors.join(' | ')}`);
    await ctx.close();
  }
}

// CFD: apagado por defecto y encendido con datos
{
  const original = readFileSync('data/cfd.json', 'utf8');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/auto/');
  check(await page.locator('#aerodinamica').count() === 0, '/auto/ sin datos CFD: la sección no existe');
  try {
    writeFileSync('data/cfd.json', JSON.stringify({
      media: { type: 'image', src: '/assets/img/car-poster-tablet.webp', width: 910, height: 682, alt: { es: 'Mapa de presión de ejemplo', en: 'Sample pressure map' }, caption: { es: 'Ejemplo', en: 'Example' } },
      method: { es: 'Ansys Student, malla de ejemplo', en: 'Ansys Student, sample mesh' },
      iterations: [{ version: 'v1', result: { es: 'Resultado de ejemplo', en: 'Sample result' }, date: '2026-12-01' }],
    }));
    execFileSync(process.execPath, ['scripts/build-content.mjs'], { stdio: 'ignore' });
    for (const [url, lang] of [['/auto/', 'es'], ['/en/car/', 'en']]) {
      await page.goto(BASE + url);
      check(await page.locator('#aerodinamica').count() === 1, `${url} con datos CFD: aparece la sección`);
      const txt = await page.locator('#aerodinamica').innerText();
      check(lang === 'es' ? /Resultado de ejemplo/.test(txt) && /diciembre de 2026/.test(txt) : /Sample result/.test(txt) && /December 1, 2026/.test(txt), `${url} tabla en su idioma con fecha localizada`);
      check(await page.locator('#aerodinamica img[alt]').count() === 1, `${url} imagen con alt`);
    }
  } finally {
    writeFileSync('data/cfd.json', original);
    execFileSync(process.execPath, ['scripts/build-content.mjs'], { stdio: 'ignore' });
  }
  await page.goto(BASE + '/auto/');
  check(await page.locator('#aerodinamica').count() === 0, '/auto/ tras restaurar: la sección vuelve a ocultarse');
  await ctx.close();
}
await browser.close();
stop();
finish();
