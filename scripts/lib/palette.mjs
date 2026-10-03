// Paleta del sitio: se lee de los tokens de css/site.css (:root), la única fuente. Si cambia un color allí, los scripts (imágenes para compartir,
// iconos, GLB de AR, dossier) lo toman solos. No se escribe ningún hex a mano en los scripts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export function tokens() {
  const css = readFileSync(path.join(root, 'css/site.css'), 'utf8');
  const block = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/)[1];
  const out = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Nombres cortos usados por los scripts → token del CSS. */
export const TOKEN_OF = { navy: 'navy-deep', blue: 'border-fine', purple: 'purple', purpleText: 'purple-text', emerald: 'emerald', green: 'emerald', lime: 'lime', ice: 'ice', line: 'line', surface: 'surface', surface2: 'surface-2' };

export function palette() {
  const t = tokens();
  const p = {};
  for (const [name, token] of Object.entries(TOKEN_OF)) {
    let v = t[token];
    if (v && v.startsWith('var(')) v = t[v.slice(6, -1)];   // var(--x) → su valor
    p[name] = v;
  }
  return p;
}

export const hexToRgb = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
