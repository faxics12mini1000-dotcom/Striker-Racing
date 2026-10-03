// Sección «Aerodinámica» de /auto/ y /en/car/, controlada por data/cfd.json. Vacío (sin imagen/video ni iteraciones) = la sección no se muestra.
// Formato y cómo llenarla: docs/AR_Y_CFD.md. No se inventa nada: todo sale del archivo.
import { readFileSync, existsSync } from 'node:fs';
import { inject, esc, tr } from '../lib/inject.mjs';

const T = {
  es: { tag: 'Aerodinámica', h: 'Simulación CFD', method: 'Método', version: 'Versión', result: 'Resultado', date: 'Fecha', iters: 'Iteraciones', locale: 'es-MX' },
  en: { tag: 'Aerodynamics', h: 'CFD simulation', method: 'Method', version: 'Version', result: 'Result', date: 'Date', iters: 'Iterations', locale: 'en-US' },
};

export function buildCfd() {
  const d = JSON.parse(readFileSync('data/cfd.json', 'utf8'));
  const warnings = [];
  const items = (d.iterations || []).filter(i => i && i.version);
  const hasMedia = d.media && d.media.src;
  const empty = !hasMedia && !items.length;
  for (const [file, lang] of [['auto/index.html', 'es'], ['en/car/index.html', 'en']]) {
    if (empty) { inject(file, 'cfd', ''); continue; }
    const t = T[lang];
    let media = '';
    if (hasMedia) {
      if (!existsSync(d.media.src.replace(/^\//, ''))) warnings.push(`cfd.json: no existe ${d.media.src}`);
      const alt = tr(d.media.alt, lang), cap = tr(d.media.caption, lang);
      if (!alt) warnings.push(`cfd.json: falta media.alt (${lang})`);
      media = d.media.type === 'video'
        ? `<figure class="cfd-media"><video controls preload="none" playsinline ${d.media.poster ? `poster="${esc(d.media.poster)}"` : ''} aria-label="${esc(alt)}"><source src="${esc(d.media.src)}"></video>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`
        : `<figure class="cfd-media"><img src="${esc(d.media.src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${d.media.width ? ` width="${d.media.width}" height="${d.media.height}"` : ''}>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
    }
    const fmt = iso => { const dt = new Date(iso + 'T12:00:00'); return isNaN(dt) ? esc(iso) : new Intl.DateTimeFormat(t.locale, { dateStyle: 'long' }).format(dt); };
    let table = '';
    if (items.length) {
      for (const i of items) { if (!tr(i.result, lang)) warnings.push(`cfd.json: la iteración ${i.version} no tiene resultado en ${lang}`); }
      table = `<table class="cfd-table"><caption class="sr-only">${t.iters}</caption><thead><tr><th scope="col">${t.version}</th><th scope="col">${t.result}</th><th scope="col">${t.date}</th></tr></thead><tbody>\n${
        items.map(i => `<tr><th scope="row">${esc(i.version)}</th><td>${esc(tr(i.result, lang))}</td><td><time datetime="${esc(i.date || '')}">${i.date ? fmt(i.date) : ''}</time></td></tr>`).join('\n')}\n</tbody></table>`;
    }
    const method = tr(d.method, lang);
    inject(file, 'cfd', `<section id="aerodinamica" class="cfd">
  <div class="wrap">
    <div class="eyebrow-tag">${t.tag}</div>
    <h2 class="zones-h">${t.h}</h2>
    ${method ? `<p class="zones-p"><b>${t.method}:</b> ${esc(method)}</p>` : ''}
    ${media}
    ${table}
  </div>
</section>`);
  }
  return { empty, iterations: items.length, warnings };
}
