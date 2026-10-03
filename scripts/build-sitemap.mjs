// Genera sitemap.xml (con hreflang es-mx / en / x-default y lastmod) y robots.txt a partir de scripts/lib/pages.mjs.
// lastmod = fecha del último commit que tocó el archivo de la página (o su fecha de modificación si aún no está en git).
// privacidad.html lleva noindex, por eso no se lista. Uso: node scripts/build-sitemap.mjs
import { writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pairs, fileOf, SITE } from './lib/pages.mjs';

const lastmod = file => {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim();
    if (d) return d;
  } catch { /* sin git */ }
  return statSync(file).mtime.toISOString().slice(0, 10);
};

const urls = [];
for (const p of pairs()) {
  const alt = `    <xhtml:link rel="alternate" hreflang="es-mx" href="${SITE}${p.es}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.es}"/>`;
  for (const lang of ['es', 'en']) {
    urls.push(`  <url>\n    <loc>${SITE}${p[lang]}</loc>\n    <lastmod>${lastmod(fileOf(p[lang]))}</lastmod>\n${alt}\n  </url>`);
  }
}
// entradas de la bitácora (generadas por scripts/content/bitacora.mjs): bitacora/<slug>/ ↔ en/log/<slug>/
if (existsSync('bitacora')) {
  for (const slug of readdirSync('bitacora', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    const es = `/bitacora/${slug}/`, en = `/en/log/${slug}/`;
    if (!existsSync(`en/log/${slug}/index.html`)) continue;
    const alt = `    <xhtml:link rel="alternate" hreflang="es-mx" href="${SITE}${es}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${es}"/>`;
    for (const [u, f] of [[es, `bitacora/${slug}/index.html`], [en, `en/log/${slug}/index.html`]]) urls.push(`  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${lastmod(f)}</lastmod>
${alt}
  </url>`);
  }
}
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap.xml: ${urls.length} URL · robots.txt`);
