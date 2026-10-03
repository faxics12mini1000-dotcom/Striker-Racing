// Contenido que crece: bitácora, muro de patrocinadores, analítica y dossier. Con los archivos de datos vacíos todo debe estar apagado; luego se prueba con datos
// de ejemplo (y se restauran los archivos al terminar). El dossier debe coincidir con las páginas de Patrocinios y Presupuesto.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

const build = () => execFileSync(process.execPath, ['scripts/build-content.mjs'], { stdio: 'ignore' });
const stop = await ensureServer();
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const get = async (url) => (await page.goto(BASE + url)).status();
const text = file => load(readFileSync(file, 'utf8'));
const norm = s => s.replace(/\s+/g, ' ').trim();

build();
// ---------- apagado por defecto ----------
check(await get('/bitacora/') === 404 && await get('/en/log/') === 404, 'sin entradas: no existen /bitacora/ ni /en/log/');
await get('/');
check(await page.locator('nav a[href="/bitacora/"]').count() === 0, 'sin entradas: el menú no tiene Bitácora');
check(await page.locator('#patrocinadores').count() === 0, 'sin patrocinadores: no hay muro en el inicio');
check(!readFileSync('index.html', 'utf8').includes('analytics.js'), 'analítica apagada: ninguna página carga js/analytics.js');

// ---------- dossier = fuente única ----------
for (const [url, lang, pat, bud] of [['/dossier/', 'es', 'patrocinios/index.html', 'presupuesto/index.html'], ['/en/dossier/', 'en', 'en/sponsorship/index.html', 'en/budget/index.html']]) {
  check(await get(url) === 200, `${url} existe`);
  const d = await page.locator('.dossier').innerText();
  const P = text(pat), B = text(bud);
  const tiers = P('.tiers .tier').map((_, el) => ({ n: norm(P(el).find('h3').text()), p: norm(P(el).find('.price').text()) })).get();
  check(tiers.length === 4 && tiers.every(t => d.includes(t.n) && d.includes(t.p)), `${url} trae los 4 niveles con nombre y precio idénticos al sitio (${tiers.map(t => t.n + ' ' + t.p).join(' | ')})`);
  const benefits = P('.tiers .tier li').map((_, li) => norm(P(li).text())).get();
  check(benefits.every(b => norm(d).includes(b)), `${url} trae todos los beneficios sin cambios (${benefits.length})`);
  const items = B('.budget-list li').map((_, li) => norm(B(li).children('b').last().text())).get();
  check(items.every(i => d.includes(i)) && d.includes(norm(B('.budget-figure').text())), `${url} trae el presupuesto (${items.join(', ')})`);
  check(norm(d).includes(norm(P('.tiers-note').text())), `${url} trae la meta y la fecha límite tal cual`);
  check(await page.locator('.dos-qr svg').count() === 1, `${url} QR a WhatsApp`);
  check((await page.locator('.dos-contact a[href^="https://wa.me/"]').getAttribute('href')).includes('525511839779'), `${url} enlace de WhatsApp de Unai`);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check(pages === 2, `${url} se imprime en 2 hojas A4 (${pages})`);
}
check(await (await get('/patrocinios/'), page.locator('a[href="/dossier/"]').count()) === 1, '/patrocinios/ enlaza al dossier');

// ---------- encendido con datos de ejemplo ----------
const saved = Object.fromEntries(['data/sponsors.json', 'data/analytics.json'].map(f => [f, readFileSync(f, 'utf8')]));
try {
  mkdirSync('data/bitacora', { recursive: true });
  writeFileSync('data/bitacora/2026-11-01-prueba.md', `---\nfecha: 2026-11-01\ntitulo_es: Entrada de prueba\ntitulo_en: Test entry\nresumen_es: Resumen de prueba\nresumen_en: Test summary\n---\nTexto **en español**.\n<!-- en -->\nText **in English**.\n`);
  writeFileSync('data/sponsors.json', JSON.stringify({ show: true, sponsors: [{ name: 'Empresa Ejemplo', logo: '/logo.png', url: 'https://example.com', level: 'partner' }] }));
  writeFileSync('data/analytics.json', JSON.stringify({ enabled: true, mode: 'beacon', endpoint: 'https://analytics.example.com/e', domain: 'strikerracing.com' }));
  build();
  check(await get('/bitacora/') === 200 && await get('/en/log/') === 200, 'con una entrada: existen /bitacora/ y /en/log/');
  check(await get('/bitacora/prueba/') === 200 && (await page.locator('.log-body').innerText()).includes('en español'), 'la entrada tiene su página en español');
  check(await get('/en/log/prueba/') === 200 && (await page.locator('.log-body').innerText()).includes('in English'), 'la entrada tiene su página en inglés');
  await get('/'); check(await page.locator('nav a[href="/bitacora/"]').count() === 1, 'con entradas: el menú muestra Bitácora');
  await get('/en/'); check(await page.locator('nav a[href="/en/log/"]').count() === 1, 'EN: el menú muestra Log');
  check(readFileSync('sitemap.xml', 'utf8').includes('/bitacora/prueba/'), 'el sitemap incluye la entrada');
  await get('/'); check(await page.locator('#patrocinadores img[alt="Empresa Ejemplo"]').count() === 1, 'con patrocinadores y show=true: aparece el muro en el inicio');
  await get('/en/sponsorship/'); check(await page.locator('#sponsors a[rel~="sponsored"]').count() === 1, 'el muro también está en /en/sponsorship/');
  await get('/'); check(await page.locator('script[src="/js/analytics.js"][data-endpoint="https://analytics.example.com/e"]').count() === 1, 'analítica encendida: se carga js/analytics.js con su endpoint');
  // «No rastrear» respetado
  const dnt = await browser.newContext({ extraHTTPHeaders: { DNT: '1' } });
  const p2 = await dnt.newPage(); await p2.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  const reqs = []; p2.on('request', r => { if (r.url().includes('analytics.example.com')) reqs.push(r.url()); });
  await p2.goto(BASE + '/patrocinios/'); await p2.locator('a[href^="https://wa.me/"]').first().evaluate(a => a.addEventListener('click', e => e.preventDefault())); await p2.locator('a[href^="https://wa.me/"]').first().click(); await p2.waitForTimeout(500);
  check(reqs.length === 0, 'con «No rastrear» no se envía nada');
  await dnt.close();
  // show=false oculta aunque haya datos
  writeFileSync('data/sponsors.json', JSON.stringify({ show: false, sponsors: [{ name: 'Empresa Ejemplo', logo: '/logo.png' }] }));
  build(); await get('/'); check(await page.locator('#patrocinadores').count() === 0, 'show=false: el muro sigue oculto');
} finally {
  rmSync('data/bitacora/2026-11-01-prueba.md', { force: true });
  for (const [f, c] of Object.entries(saved)) writeFileSync(f, c);
  build();
}
check(await get('/bitacora/') === 404 && !existsSync('bitacora'), 'tras restaurar: la bitácora vuelve a apagarse');
await ctx.close(); await browser.close(); stop(); finish();
