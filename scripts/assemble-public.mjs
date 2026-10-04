// Ensambla public/ con solo lo que el sitio sirve (HTML ES/EN, css, js, js/dist, assets, fonts, cv, team, vendor, data pública, iconos, manifest,
// sitemap, robots, 404, og). Deja fuera node_modules, scripts, qa, docs, .md internos, capturas y video. Lo usa `npm run build:deploy` (vercel.json: outputDirectory "public").
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public';
const DIRS = ['auto', 'patrocinios', 'presupuesto', 'dossier', 'en', 'css', 'js', 'assets', 'fonts', 'cv', 'team', 'vendor'];
const FILES = ['index.html', '404.html', 'privacidad.html', 'logo.png', 'logo-64.webp', 'og-share.png', 'apple-touch-icon.png', 'favicon.ico',
  'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'favicon-192.png', 'favicon-512.png', 'site.webmanifest', 'sitemap.xml', 'robots.txt'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const d of DIRS) { if (!existsSync(d)) throw new Error(`falta la carpeta ${d}`); cpSync(d, join(OUT, d), { recursive: true }); }
for (const f of FILES) { if (!existsSync(f)) throw new Error(`falta el archivo ${f}`); cpSync(f, join(OUT, f)); }
const count = p => readdirSync(p).reduce((n, e) => { const q = join(p, e); return n + (statSync(q).isDirectory() ? count(q) : 1); }, 0);
console.log(`public/ listo: ${count(OUT)} archivos`);
