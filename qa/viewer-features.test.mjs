// Funciones del visor 3D: vistas, teclado, plano técnico con cotas del GLB, numeración, panel de piezas, leyenda de etapas, foto PNG y compartir.
// Deja capturas del plano técnico en qa/screens/.
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const stop = await ensureServer();
const browser = await launch();
mkdirSync('qa/screens', { recursive: true });
const MODEL = JSON.parse(readFileSync('data/modelo.json', 'utf8'));

for (const [url, lang] of [['/auto/', 'es'], ['/en/car/', 'en']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + url);
  await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 });
  const L = lang === 'es'
    ? { rear: 'Vista: TRASERA', plan: 'Plano técnico', planOff: 'Salir del plano técnico', notes: 'Mostrar numeración de piezas', photo: 'Foto del auto (PNG transparente)', share: 'Compartir', length: 'Largo (sin cartucho)' }
    : { rear: 'View: REAR', plan: 'Technical drawing', planOff: 'Exit technical drawing', notes: 'Show part numbers', photo: 'Car photo (transparent PNG)', share: 'Share', length: 'Length (no cartridge)' };

  // vistas
  const rear = page.getByRole('button', { name: L.rear });
  check(await rear.count() === 1, `${url} botón de vista trasera`);
  await rear.click(); await page.waitForTimeout(1200);
  check(await rear.getAttribute('aria-pressed') === 'true', `${url} vista trasera activa`);
  for (const v of ['front', 'side', 'top', 'iso']) check(await page.locator(`.car-view[data-view="${v}"]`).count() === 1, `${url} vista ${v}`);

  // teclado
  await page.locator('#modelStage canvas').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Home');
  check(await page.evaluate(() => document.activeElement.tagName) === 'CANVAS', `${url} el canvas recibe foco de teclado`);
  check(!!(await page.locator('#modelStage canvas').getAttribute('aria-label')), `${url} el canvas tiene aria-label`);

  // numeración y panel de piezas
  await page.getByRole('button', { name: L.notes }).click(); await page.waitForTimeout(300);
  const notes = await page.locator('.car-note').count();
  check(notes >= 20, `${url} numeración: ${notes} marcas`);
  const items = await page.locator('#carParts .car-part').count();
  check(items >= 24, `${url} panel de piezas: ${items} piezas`);
  check(await page.locator('#carParts').isVisible(), `${url} panel de piezas visible`);
  await page.locator('#carParts .car-part').first().hover();
  check(await page.locator('.car-tip.is-on').count() === 1, `${url} al pasar sobre una pieza se muestra su nombre`);

  // leyenda de etapas se resalta durante el despiece
  await page.locator('.car-seg-btn[data-go="1"]').click();
  const legendOk = await page.waitForFunction(() => document.querySelectorAll('[data-step-legend] li.is-active, [data-step-legend] li.is-done').length >= 1, null, { timeout: 15000 }).then(() => true, () => false);
  check(legendOk, `${url} leyenda de etapas se actualiza`);
  await page.locator('.car-seg-btn[data-go="0"]').click(); await page.waitForTimeout(5000);

  // plano técnico
  await page.getByRole('button', { name: L.plan }).click(); await page.waitForTimeout(2500);
  check(await page.locator('#modelStage.is-plan').count() === 1, `${url} modo plano técnico activo`);
  const legend = await page.locator('.car-plan-legend').innerText();
  check(legend.includes(MODEL.lengthMm.toFixed(1) + ' mm'), `${url} cota de largo = ${MODEL.lengthMm.toFixed(1)} mm (GLB, sin cartucho)`);
  check(legend.includes(MODEL.widthMm.toFixed(1) + ' mm'), `${url} cota de ancho = ${MODEL.widthMm.toFixed(1)} mm`);
  check(legend.includes(MODEL.wheelbaseMm.toFixed(1) + ' mm'), `${url} distancia entre ejes = ${MODEL.wheelbaseMm.toFixed(1)} mm`);
  check(/prototipo visual|visual prototype/i.test(legend), `${url} el plano dice «prototipo visual»`);
  check(legend.includes(L.length), `${url} etiqueta «${L.length}»`);
  await page.screenshot({ path: `qa/screens/plano-tecnico-${lang}.png` });
  await page.getByRole('button', { name: L.planOff }).click(); await page.waitForTimeout(1500);
  check(await page.locator('#modelStage.is-plan').count() === 0, `${url} se sale del plano técnico`);

  // foto PNG transparente
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: L.photo }).click()]);
  const path = await dl.path();
  const buf = readFileSync(path);
  check(buf.slice(1, 4).toString() === 'PNG', `${url} la foto es PNG (${dl.suggestedFilename()}, ${(buf.length / 1024).toFixed(0)} KB)`);
  const alpha = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, corner: g.getImageData(2, 2, 1, 1).data[3] };
  }, buf.toString('base64'));
  check(alpha.corner === 0, `${url} la foto tiene fondo transparente (${alpha.w}×${alpha.h}, alfa de la esquina = ${alpha.corner})`);
  check(await page.locator('#modelStage.is-ready').count() === 1, `${url} el visor sigue funcionando tras la foto`);

  // compartir: sin Web Share cae a copiar el enlace
  await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  await page.getByRole('button', { name: L.share }).click();
  let clip = ''; for (let i = 0; i < 30 && !clip.startsWith('http'); i++) { await page.waitForTimeout(500); clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => ''); }
  check(clip.startsWith('http'), `${url} compartir sin Web Share copia el enlace (${clip})`);
  // compartir con Web Share (simulado)
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = d => { window.__shared = { title: d.title, files: (d.files || []).length, url: d.url }; return Promise.resolve(); }; });
  await page.getByRole('button', { name: L.share }).click();
  await page.waitForFunction(() => window.__shared, null, { timeout: 15000 }).catch(() => {});
  const shared = await page.evaluate(() => window.__shared);
  check(shared && shared.files === 1 && /^http/.test(shared.url), `${url} Web Share recibe imagen y enlace ${JSON.stringify(shared)}`);

  check(errors.length === 0, `${url} sin errores de página ${errors.join(' | ')}`);
  await ctx.close();
}
await browser.close();
stop();
finish();
