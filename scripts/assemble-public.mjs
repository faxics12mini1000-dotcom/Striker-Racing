// Ensambla public/ con solo lo que el sitio sirve (HTML ES/EN, css, js, js/dist, assets, fonts, cv, team, vendor, data pública, iconos, manifest,
// sitemap, robots, 404, og). Deja fuera node_modules, scripts, qa, docs, .md internos, capturas y video. Lo usa `npm run build:deploy` (vercel.json: outputDirectory "public").
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { stampHtml, stampCss } from './lib/stamp.mjs';

const OUT = 'public';
const DIRS = ['auto', 'patrocinios', 'presupuesto', 'dossier', 'en', 'css', 'js', 'assets', 'fonts', 'cv', 'team', 'vendor'];
const FILES = ['index.html', '404.html', 'privacidad.html', 'logo.png', 'logo-64.webp', 'og-share.png', 'apple-touch-icon.png', 'favicon.ico',
  'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'favicon-192.png', 'favicon-512.png', 'site.webmanifest', 'sitemap.xml', 'robots.txt'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const d of DIRS) { if (!existsSync(d)) throw new Error(`falta la carpeta ${d}`); cpSync(d, join(OUT, d), { recursive: true }); }
for (const f of FILES) { if (!existsSync(f)) throw new Error(`falta el archivo ${f}`); cpSync(f, join(OUT, f)); }
// Sellado por contenido: ?v=<hash> en todas las referencias locales sin hash en el nombre (primero el CSS, luego el HTML, para que el hash del CSS ya incluya sus fuentes).
const walkFiles = (p, ext) => readdirSync(p).flatMap(e => { const q = join(p, e); return statSync(q).isDirectory() ? walkFiles(q, ext) : q.endsWith(ext) ? [q] : []; });
for (const f of walkFiles(join(OUT, 'css'), '.css')) writeFileSync(f, stampCss(readFileSync(f, 'utf8'), OUT, 'css'));
let stamped = 0;
for (const f of walkFiles(OUT, '.html')) {
  const src = readFileSync(f, 'utf8'), out = stampHtml(src, OUT, relative(OUT, dirname(f)).split(sep).join("/"));
  if (out !== src) { writeFileSync(f, out); stamped++; }
}
console.log(`sellado ?v= en ${stamped} HTML`);
const count = p => readdirSync(p).reduce((n, e) => { const q = join(p, e); return n + (statSync(q).isDirectory() ? count(q) : 1); }, 0);
console.log(`public/ listo: ${count(OUT)} archivos`);
