// Paridad ES/EN: cada página en español debe tener su par en inglés con la misma estructura, las mismas cifras, los mismos contactos, hreflang recíproco,
// alt en todas las imágenes y los nombres de nivel de data/zonas.json. También avisa de palabras en español coladas en el inglés (y al revés).
// Uso: node qa/parity.mjs
import { readFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';
import { pairs, fileOf, SITE } from '../scripts/lib/pages.mjs';
import { check, finish } from './lib.mjs';

const ZONAS = JSON.parse(readFileSync('data/zonas.json', 'utf8'));
const norm = s => s.replace(/\s+/g, ' ').trim();
const money = t => (t.match(/\$\s?[\d,]+(?:\.\d+)?/g) || []).map(x => x.replace(/\s/g, '')).sort().join(' ');
const ES_WORDS = /\b(para|los|las|con|del|una|que|nuestra|nuestro|patrocinio|escudería|equipo)\b/gi;
const EN_WORDS = /\b(the|with|your|our|and|team|sponsorship|season)\b/gi;

for (const p of pairs()) {
  const files = { es: fileOf(p.es), en: fileOf(p.en) };
  if (!existsSync(files.es) || !existsSync(files.en)) { check(false, `${p.id}: falta una de las dos páginas`); continue; }
  const $ = { es: load(readFileSync(files.es, 'utf8')), en: load(readFileSync(files.en, 'utf8')) };
  const N = (lang, sel) => $[lang](sel).length;
  check($.es('html').attr('lang') === 'es' && $.en('html').attr('lang') === 'en', `${p.id}: atributo lang es/en`);
  // hreflang y canonical recíprocos
  for (const lang of ['es', 'en']) {
    const other = lang === 'es' ? 'en' : 'es';
    const canon = $[lang]('link[rel=canonical]').attr('href');
    const alt = Object.fromEntries($[lang]('link[rel=alternate][hreflang]').toArray().map(e => [e.attribs.hreflang, e.attribs.href]));
    check(canon === SITE + p[lang] && alt[lang === 'es' ? 'es-mx' : 'en'] === SITE + p[lang] && alt[other === 'es' ? 'es-mx' : 'en'] === SITE + p[other] && alt['x-default'] === SITE + p.es,
      `${p.id} ${lang}: canonical y hreflang apuntan a su par`);
    check(norm($[lang]('title').text()).length > 10 && ($[lang]('meta[name=description]').attr('content') || '').length > 40, `${p.id} ${lang}: title y description`);
    const noAlt = $[lang]('img').filter((_, e) => e.attribs.alt === undefined).length;
    check(noAlt === 0, `${p.id} ${lang}: todas las <img> tienen alt (${noAlt} sin)`);
  }
  check(norm($.es('title').text()) !== norm($.en('title').text()), `${p.id}: el título es distinto en cada idioma`);
  // estructura
  for (const [name, sel] of [['h1', 'h1'], ['h2', 'main h2'], ['h3', 'main h3'], ['secciones con id', 'main section[id], main header[id]'], ['imágenes', 'main img'], ['botones', 'main button'],
    ['niveles', '.tier'], ['tarjetas de equipo', '.paddock-pass'], ['preguntas', 'details'], ['elementos del menú', 'nav .cockpit-links li'], ['filas de presupuesto', '.budget-list li'], ['zonas', '.zone-row'], ['pasos', '.car-steps li']]) {
    check(N('es', sel) === N('en', sel), `${p.id}: ${name} igual en ES y EN (${N('es', sel)})`);
  }
  // cifras y contactos
  const text = lang => norm($[lang]('main').text());
  check(money(text('es')) === money(text('en')), `${p.id}: mismas cantidades de dinero (${money(text('es')).slice(0, 80)})`);
  for (const [name, sel, attr] of [['WhatsApp (número)', 'a[href^="https://wa.me/"]', 'href'], ['correo', 'a[href^="mailto:"]', 'href'], ['Instagram', 'a[href*="instagram.com"]', 'href']]) {
    const f = lang => [...new Set($[lang](sel).map((_, e) => (e.attribs[attr] || '').split('?')[0].split(':').pop().split('/').filter(Boolean).pop()).get())].sort().join();
    check(f('es') === f('en'), `${p.id}: ${name} igual (${f('es')})`);
  }
  const waCount = lang => $[lang]('a[href^="https://wa.me/"]').length;
  check(waCount('es') === waCount('en') && [...$.es('a[href^="https://wa.me/"]'), ...$.en('a[href^="https://wa.me/"]')].every(a => /[?&]text=.{10,}/.test(a.attribs.href)), `${p.id}: ${waCount('es')} enlaces de WhatsApp, todos con mensaje`);
  const ld = lang => $[lang]('script[type="application/ld+json"]').map((_, e) => (e.children[0].data.match(/"@type":\s*"[A-Za-z]+"/g) || []).sort().join()).get().join('|');
  check(ld('es') === ld('en'), `${p.id}: mismos tipos JSON-LD`);
  // palabras del otro idioma
  const count = (re, t) => (t.match(re) || []).length;
  const leakEn = count(ES_WORDS, text('en')), leakEs = count(EN_WORDS, text('es'));
  check(leakEn <= 3, `${p.id} EN: ${leakEn} palabras en español (máx. 3: nombres propios)`);
  check(leakEs <= 3, `${p.id} ES: ${leakEs} palabras en inglés (máx. 3)`);
}
// niveles
for (const [lang, file] of [['es', 'patrocinios/index.html'], ['en', 'en/sponsorship/index.html']]) {
  const t = load(readFileSync(file, 'utf8'))('.tier h3').map((_, e) => norm(load(e).text())).get();
  const names = ZONAS.levels.map(l => l.name[lang]);
  check(JSON.stringify(t) === JSON.stringify(names), `data/zonas.json: nombres de nivel (${lang}) = los de ${file}: ${names.join(', ')}`);
}
// Páginas sin par declarado
check(existsSync('404.html'), '404.html existe');
finish();
