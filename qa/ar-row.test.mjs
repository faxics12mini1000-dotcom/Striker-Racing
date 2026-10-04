// «Ver en tu mesa»: teléfono = botón siempre visible (con mensaje si no hay AR; iOS fuera de Safari pide Safari + Copiar enlace; ?ar=1 lo resalta sin abrirlo); escritorio = QR. Sin mover la página; el 3D en teléfono solo carga al tocar.
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

import { readFileSync } from 'node:fs';
if (!JSON.parse(readFileSync('data/features.json', 'utf8')).ar) { console.log('AR apagado (data/features.json): prueba omitida; la cubre qa/ar-cfd'); process.exit(0); }
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
  if (mobile) check(!r.hidden && r.noteVisible, `${tag}: botón y línea AR visibles`);
  else check(await page.evaluate(() => { const b = document.getElementById('arBtn'), q = document.querySelector('.car-ar-qr img'); return b.offsetParent === null && q.offsetParent !== null && q.getBoundingClientRect().width >= 120; }), `${tag}: escritorio muestra el QR y oculta el botón`);
  if (mobile) check(r.gap >= 0 && r.gap < 120, `${tag}: botón pegado al visor (${r.gap}px)`);
  check(r.cls < 0.01, `${tag}: CLS ${r.cls.toFixed(4)}`);
  if (mobile) {
    check(viewerReqs.length === 0, `${tag}: el visor 3D no carga hasta tocar`);
    await page.getByRole('button', { name: /Explorar en 3D|Explore in 3D/ }).click();
    await page.waitForTimeout(2500);
    check(viewerReqs.length > 0, `${tag}: el visor carga al tocar`);
  }
  await page.screenshot({ path: `qa/screens/ar-row-${path.replace(/\W/g, '')}-${w}.png` });
  await ctx.close();
  // sin AR en teléfono: el botón se ve y al tocarlo explica; iOS fuera de Safari: Safari + Copiar enlace
  if (mobile && w === 390 && path === '/auto/') {
    for (const [name, ua, re, copy] of [['sin AR', 'Mozilla/5.0 (Linux; U; Mobile) Gecko/20100101 Firefox/120.0', /no permite realidad aumentada/, false],
      ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1', /abre esta página en Safari/, true]]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, userAgent: ua }); const p2 = await c2.newPage();
      await p2.goto(BASE + path + '?ar=1', { waitUntil: 'load' }); await p2.waitForTimeout(1200);
      check(await p2.evaluate(() => { const b = document.getElementById('arBtn'); return !b.hidden && b.offsetParent !== null && b.classList.contains('is-hl') && !document.querySelector('dialog.ar-dialog'); }), `${name}: ?ar=1 resalta el botón sin abrirlo`);
      await p2.locator('#arBtn').click();
      const m = await p2.evaluate(() => { const e = document.getElementById('arMsg'); return { t: e.textContent, vis: !e.hidden, btn: !!e.querySelector('button') }; });
      check(m.vis && re.test(m.t) && m.btn === copy, `${name}: mensaje claro al tocar${copy ? ' + botón Copiar enlace' : ''}`);
      await c2.close();
    }
  }
}
await browser.close(); stop();
finish();
