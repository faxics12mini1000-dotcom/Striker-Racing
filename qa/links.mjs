// Verificador de enlaces y recursos: recorre todos los .html del sitio y comprueba que cada href/src/srcset/poster/data-* interno exista en disco
// (rutas con / final → index.html), que cada ancla (#id) exista en la página destino y que no haya enlaces rotos a archivos versionados (?v=).
// Los enlaces externos (https://) no se descargan: solo se listan y se valida su forma. Uso: node qa/links.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const SKIP = new Set(['node_modules', '.git', 'qa', 'docs', 'scripts', 'capturas', 'video', 'vendor', 'fonts']);
const htmls = [];
(function walk(d) { for (const f of readdirSync(d)) { if (SKIP.has(f)) continue; const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) htmls.push(p.split(path.sep).join('/')); } })('.');

const redirects = JSON.parse(readFileSync('vercel.json', 'utf8')).redirects.map(r => r.source);
const idsCache = {};
const idsOf = file => idsCache[file] || (idsCache[file] = new Set(load(readFileSync(file, 'utf8'))('[id]').map((_, e) => e.attribs.id).get()));
function resolve(from, url) {
  let u = url.split('#')[0].split('?')[0];
  if (!u) return from;
  if (u.startsWith('/')) u = u.slice(1); else u = path.posix.join(path.posix.dirname(from), u);
  if (u === '' || u.endsWith('/')) u += 'index.html';
  return u;
}
let bad = 0, ext = new Set(), checked = 0;
for (const file of htmls) {
  const $ = load(readFileSync(file, 'utf8'));
  const refs = [];
  $('[href],[src],[poster],[data-src],[data-model],[data-env],[data-logo],[data-viewer],[data-ar-model],[data-ar-lib],[data-file]').each((_, el) => {
    for (const a of ['href', 'src', 'poster', 'data-src', 'data-model', 'data-env', 'data-logo', 'data-viewer', 'data-ar-model', 'data-ar-lib', 'data-file']) if (el.attribs[a]) refs.push([el.tagName, a, el.attribs[a]]);
  });
  $('[srcset]').each((_, el) => el.attribs.srcset.split(',').forEach(s => refs.push([el.tagName, 'srcset', s.trim().split(/\s+/)[0]])));
  $('meta[property="og:image"],meta[name="twitter:image"],link[rel="canonical"],link[rel="alternate"]').each((_, el) => refs.push([el.tagName, 'meta', el.attribs.content || el.attribs.href]));
  for (const [tag, attr, url] of refs) {
    if (!url || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) continue;
    checked++;
    if (/^https?:\/\//.test(url)) {
      if (url.startsWith('https://strikerracing.com')) { const local = url.replace('https://strikerracing.com', ''); if (!tgt(file, local, tag, attr)) continue; }
      else ext.add(url.replace(/\?.*$/, '')); continue;
    }
    tgt(file, url, tag, attr);
  }
}
function tgt(file, url, tag, attr) {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const dest = resolve(file, url);
  const pathOnly = '/' + url.split('#')[0].split('?')[0].replace(/^\//, '');
  if (redirects.includes(pathOnly)) return true;                         // redirecciones de vercel.json (equipo.html…)
  if (!existsSync(dest) || statSync(dest).isDirectory()) { console.log(`ROTO  ${file}: <${tag} ${attr}> ${url}`); bad++; return false; }
  if (hash && dest.endsWith('.html') && !idsOf(dest).has(hash)) { console.log(`ANCLA ${file}: ${url} (no existe #${hash} en ${dest})`); bad++; return false; }
  return true;
}
const hosts = [...new Set([...ext].map(u => new URL(u).host))].sort();
console.log(`${htmls.length} páginas, ${checked} referencias revisadas, ${bad} problemas`);
console.log('enlaces externos (no se descargan):', hosts.join(', '));
process.exit(bad ? 1 : 0);
