// Zonas de patrocinio y configurador de marca: validación de archivos, PNG con transparencia, SVG, maquetas 2D, descarga de la propuesta,
// resaltado de zonas en el 3D y privacidad (ninguna petición de red sale con el logo).
import sharp from 'sharp';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { launch, ensureServer, BASE, check, finish } from './lib.mjs';

mkdirSync('qa/tmp', { recursive: true });
const png = await sharp({ create: { width: 400, height: 160, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: Buffer.from('<svg width="400" height="160"><rect x="20" y="20" width="360" height="120" fill="#e0402a"/><circle cx="80" cy="80" r="40" fill="#ffffff"/></svg>'), top: 0, left: 0 }]).png().toBuffer();
writeFileSync('qa/tmp/logo.png', png);
writeFileSync('qa/tmp/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" fill="#2a60e0"/><text x="100" y="52" font-size="40" text-anchor="middle" fill="#fff">ACME</text></svg>');
writeFileSync('qa/tmp/nota.txt', 'no soy una imagen');
writeFileSync('qa/tmp/grande.png', Buffer.concat([png, Buffer.alloc(2.2 * 1024 * 1024)]));

const stop = await ensureServer();
const browser = await launch();
const nonBlank = async (page, sel) => page.evaluate(s => {
  const c = document.querySelector(s), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
  return seen.size;
}, sel);

for (const [url, lang] of [['/auto/', 'es'], ['/en/car/', 'en']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const posts = []; page.on('request', r => { if (r.method() !== 'GET') posts.push(r.method() + ' ' + r.url()); });
  await page.goto(BASE + url);
  await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 });
  await page.locator('#configurador').scrollIntoViewIfNeeded(); await page.waitForTimeout(800);   // el configurador arranca al acercarse
  const before = await nonBlank(page, '#cfgUniform');
  check(before >= 2, `${url} maqueta del uniforme se dibuja sin logo (${before} colores)`);
  const levels = await page.locator('#cfgLevel option').allTextContents();
  check(levels.length === 4, `${url} 4 niveles en el selector: ${levels.join(', ')}`);

  // validación
  await page.setInputFiles('#cfgFile', 'qa/tmp/nota.txt');
  check(/PNG|SVG/.test(await page.locator('#cfgStatus').innerText()) && await page.locator('#cfgStatus.is-bad').count() === 1, `${url} rechaza un .txt`);
  await page.setInputFiles('#cfgFile', 'qa/tmp/grande.png');
  check(/2 MB/.test(await page.locator('#cfgStatus').innerText()), `${url} rechaza un archivo de más de 2 MB`);
  check(await page.locator('#cfgDownload').isDisabled(), `${url} sin logo no se puede descargar`);

  // PNG con transparencia, nivel Partner (con lugar en el auto)
  await page.setInputFiles('#cfgFile', 'qa/tmp/logo.png'); await page.waitForTimeout(800);
  const st = await page.locator('#cfgStatus').innerText();
  check(/transpar/i.test(st), `${url} detecta el fondo transparente: «${st}»`);
  check(await page.locator('#cfgDownload').isEnabled(), `${url} con logo se habilita la descarga`);
  check((await page.locator('#cfgInfo').innerText()).length > 20, `${url} indica que va en el auto (nivel Partner): «${await page.locator('#cfgInfo').innerText()}»`);
  const withLogo = await nonBlank(page, '#cfgUniform');
  check(withLogo > before, `${url} el logo aparece en la maqueta del uniforme (${before} → ${withLogo} colores)`);
  // un nivel sin lugar en el auto lo dice
  await page.selectOption('#cfgLevel', 'colaborador'); await page.waitForTimeout(300);
  check(/uniform/i.test(await page.locator('#cfgInfo').innerText()), `${url} Colaborador: «${await page.locator('#cfgInfo').innerText()}»`);
  await page.selectOption('#cfgLevel', 'partner');

  // SVG
  await page.setInputFiles('#cfgFile', 'qa/tmp/logo.svg'); await page.waitForTimeout(800);
  check(await page.locator('#cfgStatus.is-bad').count() === 0 && await page.locator('#cfgDownload').isEnabled(), `${url} acepta SVG`);

  // fondo claro
  await page.locator('input[name="cfgBg"][value="light"]').check(); await page.waitForTimeout(200);

  // descarga
  await page.locator('#cfgDownload').scrollIntoViewIfNeeded();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('#cfgDownload').click()]);
  const buf = readFileSync(await dl.path());
  const meta = await sharp(buf).metadata();
  check(meta.format === 'png' && meta.width === 1600, `${url} propuesta descargada ${dl.suggestedFilename()} ${meta.width}×${meta.height}`);
  await sharp(buf).resize(800).toFile(`qa/screens/propuesta-${lang}.png`);

  // quitar
  await page.locator('#cfgClear').click();
  check(await page.locator('#cfgDownload').isDisabled(), `${url} «Quitar logo» deshabilita la descarga`);

  // zonas
  const zones0 = await page.locator('.car-zone:visible').count();
  await page.locator('#zonesToggle').click(); await page.waitForTimeout(600);
  const zones1 = await page.locator('.car-zone:visible').count();
  check(zones0 === 0 && zones1 >= 5, `${url} el botón resalta las zonas (${zones0} → ${zones1} letras)`);
  const letters = [...new Set(await page.locator('.car-zone:visible').allTextContents())].sort().join('');
  check(letters === 'ABCD', `${url} letras de zona A–D: ${letters}`);
  check(await page.locator('#zonas a[href*="niveles"], #zonas a[href*="tiers"]').count() >= 4, `${url} cada zona enlaza a su nivel`);

  check(posts.length === 0, `${url} ninguna petición POST/PUT (privacidad): ${posts.join(', ')}`);
  check(errors.length === 0, `${url} sin errores de página ${errors.join(' | ')}`);
  await ctx.close();
}
// #zonas abre con las zonas resaltadas y desde /patrocinios/ hay enlace a /auto/#zonas
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/auto/#zonas');
  await page.waitForSelector('#modelStage.is-ready', { timeout: 60000 });
  await page.waitForTimeout(500);
  check(await page.locator('.car-zone:visible').count() >= 5, '/auto/#zonas abre con las zonas resaltadas');
  await page.goto(BASE + '/patrocinios/');
  check(await page.locator('a[href="/auto/#zonas"]').count() === 1, '/patrocinios/ enlaza a /auto/#zonas');
  check(await page.locator('.sm-legend a[href="#niveles"]').count() === 3, '/patrocinios/ enlaza las zonas A, C y D a #niveles');
  await ctx.close();
}
await browser.close();
stop();
finish();
