// Sella con un hash del contenido (?v=…) las imágenes de /assets/img/ que citan las páginas, para que un cambio de imagen con el mismo nombre
// (mapas de patrocinio, pósters del auto) no se quede en la caché del navegador, que las guarda 7 días. Idempotente; correr tras regenerar imágenes.
// Uso: node scripts/stamp-images.mjs        (o npm run stamp:img)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const pages = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    if (['node_modules', '.git', 'vendor', 'scripts', 'capturas', 'video', 'js'].includes(f)) continue;
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p);
  }
})('.');
let changed = 0;
for (const page of pages) {
  const src = readFileSync(page, 'utf8');
  const out = src.replace(/(\/assets\/img\/[A-Za-z0-9._-]+\.(?:webp|png|jpg))(\?v=[0-9a-f]+)?/g, (m, file) => {
    const f = '.' + file; if (!existsSync(f)) return m;
    return `${file}?v=${createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8)}`;
  });
  if (out !== src) { writeFileSync(page, out); changed++; console.log('sellado', page); }
}
console.log(`${changed} página(s) actualizadas`);
