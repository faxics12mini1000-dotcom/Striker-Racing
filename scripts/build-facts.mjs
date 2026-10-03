// Franja de datos verificables del inicio: se calculan del repo y del modelo, nunca se escriben a mano.
//   integrantes y mentor → se cuentan las tarjetas de index.html (article.paddock-pass; el mentor lleva .is-mentor)
//   piezas modeladas, largo sin cartucho → se miden en assets/models/sr26.glb (scripts/lib/glb.mjs)
// Escribe data/hechos.json y reemplaza el bloque <!-- facts:begin --> … <!-- facts:end --> de index.html y en/index.html.
// Uso: node scripts/build-facts.mjs     (o npm run build:facts; también lo corre npm run build)
import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'cheerio';
import { readGlb, measure } from './lib/glb.mjs';

const $ = load(readFileSync('index.html', 'utf8'));
const members = $('article.paddock-pass').not('.is-mentor').length;
const mentors = $('article.paddock-pass.is-mentor').length;
const m = measure(await readGlb('assets/models/sr26.glb'));
const facts = { members, mentors, parts: m.parts, lengthMm: +m.length.toFixed(1) };
writeFileSync('data/hechos.json', JSON.stringify(facts, null, 2) + '\n');

const T = {
  es: { aria: 'Datos del equipo y del modelo 3D', members: 'Integrantes', mentor: 'Mentor certificado', parts: 'Piezas modeladas en 3D', length: 'Largo del modelo, sin cartucho',
        note: 'Largo y piezas: medidos en el modelo 3D del SR-26 (prototipo visual).' },
  en: { aria: 'Team and 3D model facts', members: 'Members', mentor: 'Certified mentor', parts: 'Parts modeled in 3D', length: 'Model length, without cartridge',
        note: 'Length and parts: measured on the SR-26 3D model (visual prototype).' },
};
const fmt = n => String(n).replace(/\.0$/, '');
function block(lang) {
  const t = T[lang];
  const item = (label, value, unit = '') => `<div class="hero-fact"><dt>${label}</dt><dd>${value}${unit ? `<span class="unit">${unit}</span>` : ''}</dd></div>`;
  return `<!-- facts:begin -->\n    <dl class="hero-facts" aria-label="${t.aria}">\n      ${item(t.members, facts.members)}\n      ${item(t.mentor, facts.mentors)}\n      ${item(t.parts, facts.parts)}\n      ${item(t.length, fmt(facts.lengthMm), 'mm')}\n    </dl>\n    <p class="hero-facts-note">${t.note}</p>\n    <!-- facts:end -->`;
}
for (const [file, lang] of [['index.html', 'es'], ['en/index.html', 'en']]) {
  const raw = readFileSync(file, 'utf8'), crlf = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n');
  const a = s.indexOf('<!-- facts:begin -->'), b = s.indexOf('<!-- facts:end -->');
  if (a < 0 || b < a) throw new Error(`${file}: faltan los marcadores facts`);
  s = s.slice(0, a) + block(lang) + s.slice(b + '<!-- facts:end -->'.length);
  writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
}
console.log('hechos:', JSON.stringify(facts));
