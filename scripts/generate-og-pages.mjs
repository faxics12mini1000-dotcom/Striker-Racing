// Imagen para compartir (1200×630) de cada página y cada idioma → assets/img/og/<id>-<es|en>.jpg
// El texto viene de la propia página (og:description) y de la tabla de abajo (rótulo y título corto); la foto es real (equipo) o el render del modelo
// (póster del visor). Plano: sin degradados ni brillos; colores de los tokens de css/site.css (scripts/lib/palette.mjs); fuentes del sitio (fonts/).
// Uso: node scripts/generate-og-pages.mjs      (después de cambiar el texto de una página, la foto del equipo o los pósters)
import { chromium } from 'playwright';
import { load } from 'cheerio';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { palette } from './lib/palette.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const P = palette();
const abs = f => pathToFileURL(path.join(root, f)).href;

// id → archivo ES / EN, rótulo y título corto por idioma, y la imagen del panel derecho
const SPECS = [
  { id: 'inicio', file: { es: 'index.html', en: 'en/index.html' }, img: 'team/grupo.webp', fit: 'cover', pos: '40% 50%',
    tag: { es: 'Desafío STEM Racing México · 2026–2027', en: 'STEM Racing Mexico challenge · 2026–2027' }, title: { es: 'Striker Racing', en: 'Striker Racing' } },
  { id: 'auto', file: { es: 'auto/index.html', en: 'en/car/index.html' }, img: 'assets/img/car-poster-desktop.webp', fit: 'contain', pos: '50% 50%',
    tag: { es: 'Prototipo visual · 2026–2027', en: 'Visual prototype · 2026–2027' }, title: { es: 'SR-26', en: 'SR-26' } },
  { id: 'presupuesto', file: { es: 'presupuesto/index.html', en: 'en/budget/index.html' }, img: 'logo.png', fit: 'contain', pos: '50% 50%',
    tag: { es: 'Temporada Regional · 2026–2027', en: 'Regional season · 2026–2027' }, title: { es: 'Presupuesto', en: 'Budget' } },
  { id: 'patrocinios', file: { es: 'patrocinios/index.html', en: 'en/sponsorship/index.html' }, img: 'team/grupo.webp', fit: 'cover', pos: '40% 50%',
    tag: { es: 'Patrocinios · 2026–2027', en: 'Sponsorship · 2026–2027' }, title: { es: 'Patrocina a Striker Racing', en: 'Sponsor Striker Racing' } },
  { id: 'dossier', file: { es: 'dossier/index.html', en: 'en/dossier/index.html' }, img: 'logo.png', fit: 'contain', pos: '50% 50%', optional: true,
    tag: { es: 'Dossier de patrocinio · 2026–2027', en: 'Sponsorship dossier · 2026–2027' }, title: { es: 'Dossier', en: 'Dossier' } },
];

const fontFace = (name, file, w) => `@font-face{font-family:'${name}';src:url('${abs('fonts/' + file)}') format('woff2');font-weight:${w};}`;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function html(s, lang, desc) {
  return `<!doctype html><meta charset="utf-8"><style>
${fontFace('Oswald', 'oswald-latin-wght-normal.woff2', '200 700')}${fontFace('Inter', 'inter-latin-wght-normal.woff2', '100 900')}${fontFace('JetBrains Mono', 'jetbrains-mono-latin-wght-normal.woff2', '100 800')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${P.navy};color:${P.ice};font-family:Inter,sans-serif;position:relative;overflow:hidden}
svg.grid{position:absolute;inset:0}
.bar{position:absolute;top:0;bottom:0;width:10px}
.txt{position:absolute;left:64px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.tag{font:700 20px 'JetBrains Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:${P.lime}}
h1{font:600 ${s.title[lang].length > 14 ? 76 : 120}px/0.98 Oswald,sans-serif;text-transform:uppercase;color:${P.ice}}
.rule{width:420px;height:3px;background:${P.purple}}
p{font:400 28px/1.35 Inter,sans-serif;color:${P.ice};opacity:.88}
.url{position:absolute;left:64px;bottom:34px;font:500 18px 'JetBrains Mono',monospace;color:${P.ice};opacity:.6}
.pic{position:absolute;right:48px;top:48px;bottom:48px;width:440px;border:1px solid ${P.line};background:${P.surface}}
.pic img{width:100%;height:100%;object-fit:${s.fit};object-position:${s.pos};display:block}
</style>
<svg class="grid" width="1200" height="630"><defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${P.line}" stroke-width="1" opacity=".5"/></pattern></defs><rect width="1200" height="630" fill="url(#g)"/></svg>
<div class="bar" style="left:0;background:${P.purple}"></div><div class="bar" style="right:0;background:${P.emerald}"></div>
<div class="txt"><div class="tag">${esc(s.tag[lang])}</div><h1>${esc(s.title[lang])}</h1><div class="rule"></div><p>${esc(desc)}</p></div>
<div class="url">strikerracing.com</div>
<div class="pic"><img src="${abs(s.img)}"></div>`;
}

mkdirSync(path.join(root, 'assets/img/og'), { recursive: true });
const browser = await chromium.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync),
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const tmp = path.join(os.tmpdir(), 'sr-og.html');
for (const s of SPECS) {
  for (const lang of ['es', 'en']) {
    const f = path.join(root, s.file[lang]);
    if (!existsSync(f)) { if (!s.optional) throw new Error('falta ' + s.file[lang]); continue; }
    const $ = load(readFileSync(f, 'utf8'));
    const desc = $('meta[property="og:description"]').attr('content');
    if (!desc) throw new Error('sin og:description en ' + s.file[lang]);
    writeFileSync(tmp, html(s, lang, desc));
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const png = await page.screenshot({ type: 'png' });
    const out = path.join(root, `assets/img/og/${s.id}-${lang}.jpg`);
    await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    console.log(`assets/img/og/${s.id}-${lang}.jpg  ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
}
await browser.close();
