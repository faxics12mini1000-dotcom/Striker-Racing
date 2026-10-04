// Sellado por contenido (?v=<sha1 corto>) de las referencias locales a recursos sin hash en el nombre. El hash sale del archivo, no de la fecha.
// Lo usa assemble-public.mjs (sobre public/) y qa/cache.test.mjs. Idempotente.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const STAMP_EXT = 'css|js|mjs|webp|png|jpg|jpeg|svg|ico|glb|woff2|mp4|webm|json|hdr|webmanifest';
// js/dist/viewer.6JBCKFAM.js: el hash ya va en el nombre
export const hashedName = f => /\.[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(f);

export const shortHash = file => createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);

/** Resuelve una ruta local ("/css/site.css" o relativa a baseDir) a un archivo bajo root, o null. */
export function resolveLocal(url, root, baseDir = '') {
  const clean = url.split(/[?#]/)[0];
  const rel = clean.startsWith('/') ? clean.slice(1) : path.posix.join(baseDir, clean);
  const f = path.join(root, rel);
  return existsSync(f) ? f : null;
}

const URL_RE = new RegExp(String.raw`((?:\.{0,2}/)?[A-Za-z0-9_./-]+\.(?:${STAMP_EXT}))(\?v=[0-9a-f]+)?(?=["'\s,)]|$)`, 'g');

/** Sella una cadena con una o varias URLs (valor de href/src/data-*, o lista srcset). Solo las que existen en root. */
export function stampValue(value, root, baseDir = '') {
  if (/^(https?:)?\/\//.test(value) || value.startsWith('data:')) return value;
  return value.replace(URL_RE, (m, url) => {
    if (hashedName(path.basename(url))) return url;
    const f = resolveLocal(url, root, baseDir);
    return f ? `${url}?v=${shortHash(f)}` : m;
  });
}

/** Sella todos los atributos de un HTML que apuntan a recursos locales. baseDir: carpeta de la página dentro de root (para rutas relativas). */
export function stampHtml(html, root, baseDir = '') {
  return html.replace(/(\s(?:href|src|srcset|poster|data-[a-z-]+)=)("([^"]*)"|'([^']*)')/g, (m, attr, q, a, b) => {
    const v = a ?? b; const out = stampValue(v, root, baseDir);
    return out === v ? m : `${attr}"${out}"`;
  });
}

/** Sella las url(...) locales de un CSS (fuentes e imágenes). cssDir: carpeta del css dentro de root. */
export function stampCss(css, root, cssDir) {
  return css.replace(/url\(\s*(['"]?)([^)'"]+?)\1\s*\)/g, (m, q, u) => {
    const out = stampValue(u, root, cssDir);
    return out === u ? m : `url(${q}${out}${q})`;
  });
}
