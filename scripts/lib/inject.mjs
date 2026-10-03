// Reemplaza el bloque <!-- nombre:begin --> … <!-- nombre:end --> de una página (respeta CRLF/LF). html vacío = el bloque queda vacío (la sección no se muestra).
import { readFileSync, writeFileSync } from 'node:fs';

export function inject(file, name, html) {
  const raw = readFileSync(file, 'utf8'), crlf = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n');
  const begin = `<!-- ${name}:begin -->`, end = `<!-- ${name}:end -->`;
  const a = s.indexOf(begin), b = s.indexOf(end);
  if (a < 0 || b < a) throw new Error(`${file}: faltan los marcadores ${begin} … ${end}`);
  s = s.slice(0, a + begin.length) + (html ? '\n' + html.trim() + '\n' : '') + s.slice(b);
  writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
}
export const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const tr = (v, lang) => (v && typeof v === 'object' ? (v[lang] || v.es || '') : (v || ''));
