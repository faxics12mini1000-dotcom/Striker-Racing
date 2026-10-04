// Variantes responsivas de las fotos reales del equipo (team/*.webp) en AVIF, WebP y (hero) JPG. Se corre a mano (`npm run build:images`); lo generado va commiteado.
//   Hero (team/grupo): si existe assets/img/original/team.jpg (o .jpeg/.png/.webp) se genera desde ese original; si no, desde el team/grupo.webp actual.
//     anchos 640 / 960 / 1280 / 1920 / 2560, sin ampliar nunca (los que superen al original se omiten); AVIF y WebP en todos, JPG en 1280 / 1920 / 2560.
//     El WebP de 1280 es team/grupo.webp (lo usan el OG y el JSON-LD). Después reescribe el <picture> del hero y la precarga de la foto en index.html y en/index.html
//     (entre las marcas hero-img / hero-preload; conserva el alt de cada idioma). Solo la foto del hero se precarga.
//   Personas: team/<persona>.webp (680×1020) → <persona>-340 / <persona>-680 (.avif y .webp).
// Para cambiar la foto del hero: soltar el original en assets/img/original/team.jpg y correr `npm run build:images` (si cambia el encuadre, volver a medir las caras en data/hero-safe.json).
// Uso: node scripts/build-images.mjs
import sharp from 'sharp';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = 'team';
const DEFAULT = [340, 680];
const HERO_WIDTHS = [640, 960, 1280, 1920, 2560];
const HERO_JPG = [1280, 1920, 2560];
const PAGES = ['index.html', 'en/index.html'];
const kb = f => (statSync(f).size / 1024).toFixed(0) + ' KB';
const log = f => console.log(`${f} ${kb(f)}`);

// ---------- personas ----------
for (const file of readdirSync(dir).filter(f => /^[a-z-]+\.webp$/.test(f) && f !== 'grupo.webp')) {
  const name = file.replace('.webp', '');
  const src = path.join(dir, file);
  const meta = await sharp(src).metadata();
  for (const w of DEFAULT) {
    const width = Math.min(w, meta.width);
    const base = path.join(dir, `${name}-${w}`);
    const img = () => sharp(src).resize({ width, withoutEnlargement: true });
    await img().avif({ quality: 52, effort: 6 }).toFile(base + '.avif');
    // el WebP del tamaño original ya existe (team/<nombre>.webp): no se duplica ni se recomprime
    if (width < meta.width) await img().webp({ quality: 78, effort: 6 }).toFile(base + '.webp');
    console.log(`${base}.avif ${kb(base + '.avif')}` + (existsSync(base + '.webp') ? ` · .webp ${kb(base + '.webp')}` : ' · .webp = original'));
  }
}

// ---------- hero ----------
const original = ['jpg', 'jpeg', 'png', 'webp'].map(e => `assets/img/original/team.${e}`).find(existsSync);
const heroSrc = original || path.join(dir, 'grupo.webp');
const meta = await sharp(heroSrc).metadata();
console.log(`\nHero desde ${heroSrc} (${meta.width}×${meta.height})`);
const aspect = meta.width / meta.height;
try {
  const safe = JSON.parse(readFileSync('data/hero-safe.json', 'utf8'));
  if (Math.abs(aspect - safe.aspect) > 0.01) console.warn(`AVISO: la proporción de la foto (${aspect.toFixed(4)}) no es la de data/hero-safe.json (${safe.aspect}). Vuelve a medir las caras y ajusta --ph en css/gallery.css.`);
} catch { /* sin hero-safe.json */ }

const widths = HERO_WIDTHS.filter(w => w <= meta.width);
if (!widths.length) widths.push(meta.width);
const out = (w, ext) => ext === 'webp' && w === 1280 ? path.join(dir, 'grupo.webp') : path.join(dir, `grupo-${w}.${ext}`);
const pipeline = w => sharp(heroSrc).rotate().resize({ width: w, withoutEnlargement: true });
for (const w of widths) {
  const todo = [['avif', p => p.avif({ quality: 52, effort: 6 })], ['webp', p => p.webp({ quality: 78, effort: 6 })]];
  if (HERO_JPG.includes(w)) todo.push(['jpg', p => p.jpeg({ quality: 80, mozjpeg: true, progressive: true })]);
  for (const [ext, enc] of todo) {
    // sin original, el grupo.webp de 1280 ya es la fuente: no se recomprime
    if (!original && ext === 'webp' && w === 1280) continue;
    const f = out(w, ext);
    await enc(pipeline(w)).toFile(f);
    log(f);
  }
}
// sin original: el JPG de 1280 sale del WebP actual
const h1280 = widths.includes(1280) ? 1280 : widths[widths.length - 1];
const outMeta = await sharp(out(h1280, 'avif')).metadata();
const set = (ext, list) => list.filter(w => widths.includes(w)).map(w => `/${out(w, ext).split(path.sep).join('/')} ${w}w`).join(', ');
const jpgWidths = HERO_JPG.filter(w => widths.includes(w));

function inject(file) {
  let html = readFileSync(file, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const alt = (html.match(/<picture>[\s\S]*?<img[^>]*\balt="([^"]*)"/) || html.match(/<!-- hero-img:begin -->[\s\S]*?alt="([^"]*)"/) || [])[1];
  if (!alt) throw new Error(`${file}: no encuentro el alt del hero`);
  const picture = [
    '<!-- hero-img:begin -->',
    '    <picture>',
    `      <source type="image/avif" srcset="${set('avif', widths)}" sizes="100vw">`,
    `      <source type="image/webp" srcset="${set('webp', widths)}" sizes="100vw">`,
    `      <img src="/${out(jpgWidths[0] || h1280, 'jpg').split(path.sep).join('/')}" srcset="${set('jpg', jpgWidths)}" sizes="100vw" width="${outMeta.width}" height="${outMeta.height}" fetchpriority="high" decoding="async" alt="${alt}">`,
    '    </picture>',
    '    <!-- hero-img:end -->',
  ].join(nl);
  const preload = [
    '<!-- hero-preload:begin -->',
    `<link rel="preload" as="image" type="image/avif" imagesrcset="${set('avif', widths)}" imagesizes="100vw" fetchpriority="high">`,
    '<!-- hero-preload:end -->',
  ].join(nl);
  if (html.includes('<!-- hero-img:begin -->')) html = html.replace(/<!-- hero-img:begin -->[\s\S]*?<!-- hero-img:end -->/, () => picture);
  else html = html.replace(/<picture>[\s\S]*?<\/picture>/, () => picture);           // primera vez: el único <picture> de la página es el del hero
  if (html.includes('<!-- hero-preload:begin -->')) html = html.replace(/<!-- hero-preload:begin -->[\s\S]*?<!-- hero-preload:end -->/, () => preload);
  else html = html.replace(/(<link rel="preload" href="\/fonts\/inter[^>]*>)/, (m) => preload + nl + m);
  writeFileSync(file, html);
  console.log(`${file}: <picture> y precarga del hero actualizados`);
}
PAGES.forEach(inject);
