// Carrusel de patrocinadores (franja blanca con borde a cuadros) en todas las páginas, controlado por data/sponsors.json.
// Va al pie de cada página (antes del footer); en /patrocinios/ va arriba del todo. Con "show": false o sin patrocinadores no hay HTML.
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from '../lib/inject.mjs';

const ZONAS = JSON.parse(readFileSync('data/zonas.json', 'utf8'));
const T = {
  es: { label: 'Con el apoyo de', aria: 'Patrocinadores' },
  en: { label: 'With the support of', aria: 'Sponsors' },
};
const SKIP = new Set(['node_modules', 'public', 'qa', 'scripts', 'vendor', 'docs', 'capturas', 'video', 'team', 'assets', 'fonts', 'cv', 'js', 'css', 'data']);
const BEGIN = '<!-- sponsor-strip:begin -->', END = '<!-- sponsor-strip:end -->';

function pages(dir = '.', out = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.') || SKIP.has(n)) continue;
    const p = join(dir, n), st = statSync(p);
    if (st.isDirectory()) pages(p, out);
    else if (n.endsWith('.html')) out.push(p.replaceAll('\\', '/').replace(/^\.\//, ''));
  }
  return out;
}

export function buildSponsorStrip() {
  const d = JSON.parse(readFileSync('data/sponsors.json', 'utf8'));
  const warnings = [];
  const list = (d.sponsors || []).filter(s => s && s.name && s.logo);
  list.forEach(s => {
    if (!existsSync(s.logo.replace(/^\//, ''))) warnings.push(`sponsors.json: no existe el logo de ${s.name} (${s.logo})`);
    if (s.url && !/^(https:\/\/|tel:\+?\d+$)/.test(s.url)) warnings.push(`sponsors.json: el enlace de ${s.name} debe ser https:// o tel:+52…`);
  });
  const on = d.show === true && list.length > 0;
  // Del nivel más alto al más bajo
  const rank = s => ZONAS.levels.findIndex(l => l.key === s.level);
  const sorted = [...list].sort((a, b) => rank(b) - rank(a));
  const top = ZONAS.levels[ZONAS.levels.length - 1].key;
  let count = 0;
  for (const file of pages()) {
    const raw = readFileSync(file, 'utf8');
    if (!raw.includes(BEGIN)) continue;
    const crlf = raw.includes('\r\n');
    let s = raw.replace(/\r\n/g, '\n');
    const a = s.indexOf(BEGIN), b = s.indexOf(END);
    if (b < a) throw new Error(`${file}: marcadores del carrusel mal puestos`);
    let html = '';
    if (on) {
      const lang = /^en\//.test(file) ? 'en' : 'es', t = T[lang];
      const copies = Math.ceil(10 / sorted.length);
      const item = (sp, hidden) => {
        const lvl = ZONAS.levels.find(l => l.key === sp.level);
        const inner = `<span class="ss-plate"><img src="${esc(sp.logo)}" alt="${hidden ? '' : esc(sp.name)}" height="108" decoding="async"></span>${lvl ? `<small>${esc(lvl.name[lang])}</small>` : ''}`;
        const cls = `ss-item${sp.level === top ? ' is-top' : ''}`;
        return sp.url
          ? `<a class="${cls}" href="${esc(sp.url)}"${sp.url.startsWith('tel:') ? '' : ' target="_blank" rel="noopener sponsored"'}${hidden ? ' aria-hidden="true" tabindex="-1"' : ''}>${inner}</a>`
          : `<div class="${cls}"${hidden ? ' aria-hidden="true"' : ''}>${inner}</div>`;
      };
      const half = hidden => Array.from({ length: copies }, (_, i) => sorted.map(sp => item(sp, hidden || i > 0)).join('')).join('');
      html = `<section class="sponsor-strip b-chk b1" aria-label="${t.aria}">
  <p class="ss-label">${t.label}</p>
  <div class="ss-viewport"><div class="ss-track">${half(false)}${half(true)}</div></div>
</section>`;
      count++;
    }
    s = s.slice(0, a + BEGIN.length) + (html ? '\n' + html + '\n' : '') + s.slice(b);
    writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
  }
  return { empty: !on, sponsors: list.length, pages: count, warnings };
}
