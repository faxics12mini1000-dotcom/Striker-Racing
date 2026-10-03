// Presupuesto de peso del sitio (ver docs/PRESUPUESTO_JS.md). Mide JS, CSS, HTML y modelos tal como se sirven (gzip para texto) y falla si algo lo rebasa.
// «Camino crítico» = lo que descarga cualquier página sin tocar el 3D: HTML + CSS + site.js (+ cv-viewer.js en el inicio).
// Uso: node scripts/check-budget.mjs        (o npm run check:budget)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const gz = f => gzipSync(readFileSync(f)).length / 1024;
const raw = f => statSync(f).size / 1024;
const newest = (dir, re) => { if (!existsSync(dir)) return null; const f = readdirSync(dir).filter(x => re.test(x)).sort()[0]; return f ? `${dir}/${f}` : null; };

// [nombre, archivo, tipo, límite en KB]
const LIMITS = [
  ['site.js (todas las páginas)', 'js/site.js', 'gz', 4],
  ['cv-viewer.js (inicio)', 'js/cv-viewer.js', 'gz', 2],
  ['cargador del visor (stage)', newest('js/dist', /^stage\..*\.js$/), 'gz', 3],
  ['visor 3D (three + visor), bajo demanda', newest('js/dist', /^viewer\..*\.js$/), 'gz', 200],
  ['CSS (site + gallery)', ['css/site.css', 'css/gallery.css'], 'gz', 22],
  ['modelo web sr26.glb', 'assets/models/sr26.glb', 'raw', 330],
  ['entorno horneado', 'assets/models/env-room.png', 'raw', 30],
  ['modelo para AR sr26-ar.glb (solo AR, bajo demanda)', 'assets/models/sr26-ar.glb', 'raw', 700, true],
  ['model-viewer autoalojado (solo AR, bajo demanda)', newest('vendor/model-viewer', /\.js$/) , 'gz', 420, true],
  ['configurador (js/configurator.js, bajo demanda)', 'js/configurator.js', 'gz', 12, true],
];
let bad = 0;
for (const [name, file, kind, limit, optional] of LIMITS) {
  const files = [].concat(file).filter(Boolean);
  if (!files.length || !files.every(existsSync)) { if (!optional) { console.log(`FALTA  ${name}`); bad++; } continue; }
  const kb = files.reduce((t, f) => t + (kind === 'gz' ? gz(f) : raw(f)), 0);
  const ok = kb <= limit; if (!ok) bad++;
  console.log(`${ok ? 'OK   ' : 'EXCEDE'} ${name.padEnd(52)} ${kb.toFixed(1).padStart(7)} KB ${kind === 'gz' ? 'gzip' : 'crudo'}  (límite ${limit})`);
}
// camino crítico por página
for (const page of ['index.html', 'en/index.html', 'patrocinios/index.html', 'presupuesto/index.html', 'auto/index.html']) {
  const js = (page === 'index.html' || page === 'en/index.html') ? gz('js/site.js') + gz('js/cv-viewer.js') : gz('js/site.js');
  const kb = gz(page) + gz('css/site.css') + gz('css/gallery.css') + js;
  const ok = kb <= 45; if (!ok) bad++;
  console.log(`${ok ? 'OK   ' : 'EXCEDE'} camino crítico ${page.padEnd(30)} ${kb.toFixed(1).padStart(7)} KB gzip (HTML + CSS + JS; límite 45)`);
}
process.exit(bad ? 1 : 0);
