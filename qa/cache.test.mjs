// Prueba de caché: arma public/ (build:deploy) y verifica que (1) todo recurso local que citan los HTML lleva hash en el nombre o ?v=<hash del contenido>,
// (2) el ?v= coincide con el contenido actual del archivo, (3) css y js sin hash se sirven con max-age=0 + must-revalidate, y
// (4) ninguna ruta sin hash en el nombre tiene caché larga en vercel.json si algún HTML la cita sin ?v=. Falla si alguien lo rompe.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { STAMP_EXT, hashedName, shortHash } from '../scripts/lib/stamp.mjs';

execFileSync(process.execPath, ['scripts/assemble-public.mjs'], { stdio: 'ignore' });
const OUT = 'public';
const fails = [];
const fail = m => fails.push(m);
const walk = (d, ext) => readdirSync(d).flatMap(e => { const p = path.join(d, e); return statSync(p).isDirectory() ? walk(p, ext) : ext.test(p) ? [p] : []; });

// ---- (1) y (2): referencias en los HTML
const refRe = new RegExp(String.raw`(?:^|[\s"',(])(/[A-Za-z0-9_./-]+\.(?:${STAMP_EXT}))(\?v=([0-9a-f]+))?(?=["'\s,)]|$)`, 'g');
const attrRe = /\s(?:href|src|srcset|poster|data-[a-z-]+)=("[^"]*"|'[^']*')/g;
const unstamped = new Map(); // archivo -> páginas que lo citan sin ?v
let nRefs = 0;
for (const page of walk(OUT, /\.html$/)) {
  const html = readFileSync(page, 'utf8');
  for (const [, val] of html.matchAll(attrRe)) {
    for (const m of val.slice(1, -1).matchAll(refRe)) {
      const [, url, , v] = m;
      const f = path.join(OUT, url);
      if (!existsSync(f)) continue; // enlaces rotos los cubre qa:links
      nRefs++;
      if (hashedName(path.basename(url))) continue;
      if (!v) { (unstamped.get(url) ?? unstamped.set(url, new Set()).get(url)).add(page); continue; }
      if (v !== shortHash(f)) fail(`${page}: ${url}?v=${v} no coincide con el contenido (${shortHash(f)})`);
    }
  }
}
for (const [url, pages] of unstamped) fail(`${url} sin hash en el nombre ni ?v= en ${[...pages].slice(0, 3).join(', ')}${pages.size > 3 ? '…' : ''}`);

// ---- (3) y (4): vercel.json
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rules = cfg.headers.map(h => ({ re: new RegExp(`^${h.source}$`), cc: h.headers.find(x => x.key === 'Cache-Control')?.value })).filter(r => r.cc);
const maxAge = cc => Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 0);
const isLong = cc => /immutable/.test(cc) || maxAge(cc) > 3600;
for (const f of walk(OUT, /./)) {
  const route = '/' + path.relative(OUT, f).split(path.sep).join('/');
  const hit = rules.filter(r => r.re.test(route));
  if (new Set(hit.map(h => h.cc)).size > 1) fail(`${route}: varias reglas de Cache-Control (${hit.map(h => h.cc).join(' | ')})`);
  const cc = hit[0]?.cc;
  if (/^\/(css|js)\//.test(route) && !hashedName(path.basename(route))) {
    if (!cc || maxAge(cc) !== 0 || !/must-revalidate/.test(cc)) fail(`${route}: css/js sin hash debe ser "public, max-age=0, must-revalidate" (hoy: ${cc ?? 'sin regla'})`);
  }
  if (cc && isLong(cc) && !hashedName(path.basename(route)) && unstamped.has(route)) fail(`${route}: caché larga (${cc}) sin hash y citado sin ?v=`);
}
const dist = rules.find(r => r.re.test('/js/dist/viewer.6JBCKFAM.js'));
if (!dist || !/immutable/.test(dist.cc)) fail('js/dist/* (con hash) debe conservar "immutable"');

if (fails.length) { console.error(`FALLO caché: ${fails.length}\n- ` + fails.join('\n- ')); process.exit(1); }
console.log(`OK caché: ${nRefs} referencias locales con hash o ?v= verificado; css/js sin hash con must-revalidate; js/dist immutable`);
