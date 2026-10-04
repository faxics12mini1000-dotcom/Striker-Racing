// El botón «Ver en tu mesa» queda justo debajo del visor (móvil y escritorio), sin mover la página, y el 3D en teléfono solo carga al tocar.
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const stop = await ensureServer();
const browser = await launch();
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
for (const [path, w, h, mobile] of [['/auto/', 375, 780, true], ['/auto/', 390, 844, true], ['/en/car/', 390, 844, true], ['/auto/', 1280, 800, false], ['/en/car/', 1280, 800, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile, userAgent: mobile ? ANDROID : undefined });
  await ctx.addInitScript(() => {   // dispositivo con AR simulado
    if (!/Android/.test(navigator.userAgent)) Object.defineProperty(navigator, 'xr', { value: { isSessionSupported: () => Promise.resolve(true) } });
    window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const page = await ctx.newPage();
  const viewerReqs = []; page.on('request', r => { if (/viewer\.\w+\.js|sr26\.glb/.test(r.url())) viewerReqs.push(r.url()); });
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const tag = `${path} ${w}px`;
  const r = await page.evaluate(() => {
    const b = document.getElementById('arBtn'), n = document.querySelector('.car-ar-note'), s = document.getElementById('modelStage').getBoundingClientRect(), br = b.getBoundingClientRect();
    return { hidden: b.hidden, noteVisible: n.offsetParent !== null, gap: Math.round(br.top - s.bottom), sameCol: br.left >= s.left - 1 && br.left < s.right, cls: window.__cls, noteText: n.textContent };
  });
  check(!r.hidden && r.noteVisible, `${tag}: botón y línea AR visibles`);
  check(r.gap >= 0 && r.gap < 120, `${tag}: botón pegado al visor (${r.gap}px)`);
  check(r.cls < 0.01, `${tag}: CLS ${r.cls.toFixed(4)}`);
  if (mobile) {
    check(viewerReqs.length === 0, `${tag}: el visor 3D no carga hasta tocar`);
    await page.getByRole('button', { name: /Explorar en 3D|Explore in 3D/ }).click();
    await page.waitForTimeout(2500);
    check(viewerReqs.length > 0, `${tag}: el visor carga al tocar`);
  }
  await page.screenshot({ path: `qa/screens/ar-row-${path.replace(/\W/g, '')}-${w}.png` });
  await ctx.close();
  // sin AR: nada visible
  if (w === 1280 && path === '/auto/') {
    const c2 = await browser.newContext({ viewport: { width: w, height: h } }); const p2 = await c2.newPage();
    await p2.goto(BASE + path, { waitUntil: 'load' }); await p2.waitForTimeout(800);
    check(await p2.evaluate(() => document.getElementById('arRow').offsetParent === null), `${path} escritorio sin AR: fila oculta`);
    await c2.close();
  }
}
await browser.close(); stop();
finish();
