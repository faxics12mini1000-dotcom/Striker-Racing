// Bitácora: entradas en data/bitacora/*.md → /bitacora/ y /en/log/ (listado + una página por entrada). Sin entradas: no hay páginas ni enlace en el menú.
// Cada archivo: AAAA-MM-DD-nombre.md con encabezado (fecha, titulo_es, titulo_en, resumen_es, resumen_en, imagen/alt_es/alt_en opcionales) y el cuerpo en
// español, una línea `<!-- en -->` y el cuerpo en inglés. Guía y plantilla: docs/CONTENIDO.md. Los archivos que empiezan con _ se ignoran.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { marked } from 'marked';
import { page } from '../lib/layout.mjs';
import { inject, esc } from '../lib/inject.mjs';
import { SITE } from '../lib/pages.mjs';

const NAV = { es: ['<li><a href="/bitacora/">Bitácora</a></li>', '/bitacora/'], en: ['<li><a href="/en/log/">Log</a></li>', '/en/log/'] };
const ALL = ['index.html', 'auto/index.html', 'presupuesto/index.html', 'patrocinios/index.html', 'en/index.html', 'en/car/index.html', 'en/budget/index.html', 'en/sponsorship/index.html'];
const T = {
  es: { tag: 'Bitácora · Temporada 2026–2027', h1: 'Bitácora del <em>equipo.</em>', lead: 'Avances del auto, la manufactura y la escudería, escritos por el equipo.', title: 'Bitácora · Striker Racing', desc: 'Bitácora de Striker Racing: avances del auto, la manufactura y la escudería durante la temporada 2026–2027.', back: 'Volver a la bitácora', locale: 'es-MX' },
  en: { tag: 'Log · 2026–2027 season', h1: 'Team <em>log.</em>', lead: 'Progress on the car, manufacturing and the team, written by the team.', title: 'Log · Striker Racing', desc: 'Striker Racing log: progress on the car, manufacturing and the team during the 2026–2027 season.', back: 'Back to the log', locale: 'en-US' },
};

function parse(file) {
  const raw = readFileSync(`data/bitacora/${file}`, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: falta el encabezado entre --- y ---`);
  const meta = {};
  for (const line of m[1].split('\n')) { const k = line.match(/^([\wñ]+):\s*(.*)$/); if (k) meta[k[1]] = k[2].replace(/^["']|["']$/g, '').trim(); }
  const [es, en = ''] = m[2].split(/^<!--\s*en\s*-->\s*$/m);
  const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-?/, '') || file.replace(/\.md$/, '');
  return { file, slug, meta, body: { es: es.trim(), en: en.trim() } };
}

export function buildBitacora() {
  const warnings = [];
  const files = existsSync('data/bitacora') ? readdirSync('data/bitacora').filter(f => f.endsWith('.md') && !f.startsWith('_')) : [];
  const entries = files.map(parse).filter(e => {
    const ok = e.meta.fecha && e.meta.titulo_es && e.meta.titulo_en && e.body.es && e.body.en;
    if (!ok) warnings.push(`${e.file}: falta fecha, título o cuerpo en español o inglés: se omite`);
    return ok;
  }).sort((a, b) => b.meta.fecha.localeCompare(a.meta.fecha));

  // el generado anterior se borra siempre y se vuelve a escribir
  for (const d of ['bitacora', 'en/log']) rmSync(d, { recursive: true, force: true });
  for (const f of ALL) {
    const lang = f.startsWith('en/') ? 'en' : 'es';
    inject(f, 'nav-log', entries.length ? NAV[lang][0] : '');
  }
  if (!entries.length) return { empty: true, entries: 0, warnings };

  const dateOf = (iso, lang) => new Intl.DateTimeFormat(T[lang].locale, { dateStyle: 'long' }).format(new Date(iso + 'T12:00:00'));
  const base = lang => (lang === 'es' ? '/bitacora/' : '/en/log/');
  for (const lang of ['es', 'en']) {
    const t = T[lang], B = base(lang);
    const items = entries.map(e => `<li class="log-item"><time datetime="${e.meta.fecha}">${dateOf(e.meta.fecha, lang)}</time><h2><a href="${B}${e.slug}/">${esc(e.meta['titulo_' + lang])}</a></h2>${e.meta['resumen_' + lang] ? `<p>${esc(e.meta['resumen_' + lang])}</p>` : ''}</li>`).join('\n');
    const list = `<header class="room-head"><div class="wrap room-head-inner"><div class="room-tag micro">${t.tag}</div><h1>${t.h1}</h1><p class="hero-lead">${t.lead}</p></div></header>
<section class="log-list-wrap"><div class="wrap"><ul class="log-list">\n${items}\n</ul></div></section>`;
    const out = page({ lang, title: t.title, description: t.desc, esPath: '/bitacora/', enPath: '/en/log/', body: list, navCurrent: NAV[lang][1], css: ['/css/log.css'] });
    mkdirSync(B.slice(1), { recursive: true }); writeFileSync(`${B.slice(1)}index.html`, out);
    for (const e of entries) {
      const title = e.meta['titulo_' + lang], alt = e.meta['alt_' + lang] || '';
      const img = e.meta.imagen ? `<figure class="log-fig"><img src="${esc(e.meta.imagen)}" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>` : '';
      if (e.meta.imagen && !existsSync(e.meta.imagen.replace(/^\//, ''))) warnings.push(`${e.file}: no existe la imagen ${e.meta.imagen}`);
      const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, datePublished: e.meta.fecha, inLanguage: lang === 'es' ? 'es-MX' : 'en', author: { '@type': 'Organization', name: 'Striker Racing' }, mainEntityOfPage: `${SITE}${B}${e.slug}/` };
      const body = `<header class="room-head"><div class="wrap room-head-inner"><div class="room-tag micro">${t.tag}</div><h1>${esc(title)}</h1><p class="hero-lead"><time datetime="${e.meta.fecha}">${dateOf(e.meta.fecha, lang)}</time></p></div></header>
<section class="log-entry"><div class="wrap">${img}<div class="log-body">${marked.parse(e.body[lang])}</div><p class="log-back"><a href="${B}">← ${t.back}</a></p></div></section>
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
      const html = page({ lang, title: `${title} · Striker Racing`, description: e.meta['resumen_' + lang] || t.desc, esPath: `/bitacora/${e.slug}/`, enPath: `/en/log/${e.slug}/`, body, navCurrent: NAV[lang][1], css: ['/css/log.css'] });
      mkdirSync(`${B.slice(1)}${e.slug}`, { recursive: true }); writeFileSync(`${B.slice(1)}${e.slug}/index.html`, html);
    }
  }
  return { empty: false, entries: entries.length, warnings };
}
