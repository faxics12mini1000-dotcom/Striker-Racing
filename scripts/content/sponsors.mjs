// Muro de patrocinadores (inicio y /patrocinios/), controlado por data/sponsors.json. Se muestra solo si "show" es true Y hay patrocinadores:
// con el archivo vacío (o con "show": false) no hay HTML. No se inventa ni se sugiere ningún patrocinador. Formato: docs/CONTENIDO.md.
import { readFileSync, existsSync } from 'node:fs';
import { inject, esc } from '../lib/inject.mjs';

const ZONAS = JSON.parse(readFileSync('data/zonas.json', 'utf8'));
const T = {
  es: { tag: 'Patrocinadores', h: 'Quienes nos acompañan', ids: { home: 'patrocinadores' } },
  en: { tag: 'Sponsors', h: 'Who backs us', ids: { home: 'sponsors' } },
};
const FILES = [['index.html', 'es'], ['patrocinios/index.html', 'es'], ['en/index.html', 'en'], ['en/sponsorship/index.html', 'en']];

export function buildSponsors() {
  const d = JSON.parse(readFileSync('data/sponsors.json', 'utf8'));
  const warnings = [];
  const list = (d.sponsors || []).filter(s => s && s.name);
  list.forEach(s => {
    if (s.logo && !existsSync(s.logo.replace(/^\//, ''))) warnings.push(`sponsors.json: no existe el logo de ${s.name} (${s.logo})`);
    if (s.url && !/^https:\/\//.test(s.url)) warnings.push(`sponsors.json: el enlace de ${s.name} debe ser https://`);
    if (s.level && !ZONAS.levels.some(l => l.key === s.level)) warnings.push(`sponsors.json: nivel desconocido «${s.level}» en ${s.name} (usa ${ZONAS.levels.map(l => l.key).join(', ')})`);
  });
  const on = d.show === true && list.length > 0;
  if (list.length && !on) warnings.push('sponsors.json: hay patrocinadores pero "show" es false: el muro sigue oculto');
  for (const [file, lang] of FILES) {
    if (!on) { inject(file, 'sponsors', ''); continue; }
    const t = T[lang];
    const order = [...ZONAS.levels].reverse();   // del nivel más alto al más bajo
    const groups = order.map(l => [l, list.filter(s => s.level === l.key)]).filter(([, a]) => a.length);
    const rest = list.filter(s => !s.level || !ZONAS.levels.some(l => l.key === s.level));
    if (rest.length) groups.push([null, rest]);
    const card = s => {
      const inner = s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy" decoding="async">` : `<span>${esc(s.name)}</span>`;
      return `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener sponsored" aria-label="${esc(s.name)}">${inner}</a>` : inner}</li>`;
    };
    inject(file, 'sponsors', `<section id="${t.ids.home}" class="sponsor-wall">
  <div class="wrap">
    <div class="eyebrow-tag">${t.tag}</div>
    <h2 class="zones-h">${t.h}</h2>
${groups.map(([l, a]) => `    <div class="sw-group">${l ? `<h3 class="micro">${esc(l.name[lang])}</h3>` : ''}<ul class="sw-list">\n${a.map(card).join('\n')}\n    </ul></div>`).join('\n')}
  </div>
</section>`);
  }
  return { empty: !on, sponsors: list.length, warnings };
}
