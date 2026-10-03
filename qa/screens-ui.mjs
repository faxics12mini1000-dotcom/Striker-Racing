// Capturas de la pasada de UI (hero, visor, plano técnico, configurador con zonas y polo) a 1440, 1024 y 390 px → qa/screens/ui-<tema>-<ancho>.png
import { launch, ensureServer, BASE } from './lib.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('qa/screens', { recursive: true });
const stop = await ensureServer();
const browser = await launch();
const out = (n, w) => `qa/screens/ui-${n}-${w}.png`;
const settle = ms => new Promise(r => setTimeout(r, ms));
async function loadViewer(page) {   // en teléfono el 3D espera un toque; en escritorio arranca solo
  const btn = page.locator('#modelStage .car-cta-btn.is-primary');
  if (await btn.count()) await btn.first().click().catch(() => {});
  await page.waitForSelector('#modelStage.is-ready', { timeout: 90000 });
}
async function scrollTo(page, sel, block = 'start') {
  await page.evaluate(([s, b]) => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector(s).scrollIntoView({ block: b }); }, [sel, block]); await settle(800);
}
for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  // hero + visor de inicio
  await page.goto(BASE + '/'); await settle(1500);
  await page.screenshot({ path: out('hero', w) });
  await scrollTo(page, '#sr26'); await loadViewer(page); await settle(2500);
  await page.screenshot({ path: out('visor', w) });
  // /auto/: plano técnico
  await page.goto(BASE + '/auto/'); await loadViewer(page);
  await scrollTo(page, '#modelStage', 'start');
  await page.getByRole('button', { name: /Plano técnico/ }).click(); await settle(3500);
  await page.screenshot({ path: out('plano', w), fullPage: false });
  await page.getByRole('button', { name: /Salir del plano técnico/ }).click(); await settle(800);
  // configurador: auto con zonas (logo cargado en una zona) y polo
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('configurador').scrollIntoView(); });
  await page.waitForFunction(() => document.getElementById('cfgLevel').options.length > 0, null, { timeout: 60000 });
  await page.setInputFiles('#cfgFile', 'qa/tmp/logo.svg'); await settle(800);
  await page.selectOption('#cfgZone', 'C'); await settle(800);
  await page.screenshot({ path: out('configurador-polo', w) });
  await scrollTo(page, '#modelStage', 'center'); await settle(1500);
  await page.screenshot({ path: out('configurador-auto-zonas', w) });
  await ctx.close();
}
await browser.close(); stop();
console.log('capturas en qa/screens/ui-*');
