// Humo del visor 3D: carga en escritorio, en teléfono (botón «Explorar en 3D»), reintento tras un error de red y póster sin WebGL.
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const stop = await ensureServer();
const browser = await launch();
const URLS = [['/auto/', 'Explorar en 3D'], ['/en/car/', 'Explore in 3D']];

for (const [url, btnText] of URLS) {
  // escritorio: el 3D arranca solo
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + url);
    const ready = await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 }).then(() => true, () => false);
    check(ready, `${url} escritorio: el visor 3D carga solo`);
    const canvas = await page.$('#modelStage canvas');
    check(!!canvas, `${url} escritorio: hay canvas`);
    check(errors.length === 0, `${url} escritorio: sin errores de página ${errors.join(' | ')}`);
    await ctx.close();
  }
  // teléfono: póster + botón; al tocarlo carga
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(BASE + url);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => document.getElementById('modelStage').classList.contains('is-ready'));
    check(!before, `${url} teléfono: no descarga el 3D sin pedirlo`);
    const btn = page.getByRole('button', { name: btnText });
    check(await btn.count() === 1, `${url} teléfono: botón «${btnText}»`);
    await btn.tap();
    const ready = await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 }).then(() => true, () => false);
    check(ready, `${url} teléfono: el 3D carga al tocar el botón`);
    await ctx.close();
  }
}

// error de red: el visor ofrece reintentar y el póster se queda
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let block = true;
  await page.route('**/assets/models/sr26.glb*', r => (block ? r.abort() : r.continue()));
  await page.goto(BASE + '/auto/');
  const failed = await page.waitForSelector('#modelStage.has-error', { timeout: 30000 }).then(() => true, () => false);
  check(failed, '/auto/ con el GLB bloqueado: muestra estado de error');
  check(await page.locator('#modelStage .model-poster').isVisible(), '/auto/ con error: el póster sigue visible');
  block = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  const ok = await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 }).then(() => true, () => false);
  check(ok, '/auto/: «Reintentar» recupera el visor');
  await ctx.close();
}

// sin WebGL
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : orig.call(this, type, ...a); };
  });
  await page.goto(BASE + '/auto/');
  await page.waitForTimeout(1500);
  const noGl = await page.evaluate(() => document.getElementById('modelStage').classList.contains('no-3d'));
  check(noGl, '/auto/ sin WebGL: queda el póster (clase no-3d)');
  check(await page.locator('#modelStage .model-poster').isVisible(), '/auto/ sin WebGL: póster visible');
  await ctx.close();
}

await browser.close();
stop();
finish();
