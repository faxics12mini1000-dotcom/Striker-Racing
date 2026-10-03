// Esqueleto de las páginas generadas (dossier, bitácora): el menú, el pie, el botón fijo y «volver arriba» se toman de las páginas existentes
// (presupuesto/ y en/budget/), así hay una sola fuente de esos bloques. Cambia la barra de idioma y la página actual.
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { SITE } from './pages.mjs';
import { esc } from './inject.mjs';

const SRC = { es: 'presupuesto/index.html', en: 'en/budget/index.html' };

export function shell(lang, { navCurrent, esPath, enPath }) {
  const $ = load(readFileSync(SRC[lang], 'utf8'));
  $('nav.cockpit a[aria-current="page"]').removeAttr('aria-current');
  if (navCurrent) $(`nav.cockpit .cockpit-links a[href="${navCurrent}"]`).attr('aria-current', 'page');
  const sw = $('nav.cockpit .lang-switch a');
  sw.eq(0).attr('href', esPath); sw.eq(1).attr('href', enPath);
  sw.eq(lang === 'es' ? 1 : 0).removeAttr('aria-current'); sw.eq(lang === 'es' ? 0 : 1).attr('aria-current', 'true');
  const skip = $('a.skip-link');
  return { skip: $.html(skip), nav: $.html($('nav.cockpit')), footer: $.html($('footer')), sticky: $.html($('#stickyCta')), top: $.html($('#backToTop')) };
}

export function page({ lang, title, description, esPath, enPath, ogImage, noindex = false, body, navCurrent, css = [], scripts = [], bodyClass = '', afterFooter = '' }) {
  const self = lang === 'es' ? esPath : enPath;
  const s = shell(lang, { navCurrent, esPath, enPath });
  const og = ogImage || `${SITE}/og-share.png`;
  return `<!DOCTYPE html>
<html lang="${lang === 'es' ? 'es' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#071B33">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${SITE}${self}">
<link rel="alternate" hreflang="es-mx" href="${SITE}${esPath}">
<link rel="alternate" hreflang="en" href="${SITE}${enPath}">
<link rel="alternate" hreflang="x-default" href="${SITE}${esPath}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${self}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'es' ? 'es_MX' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/oswald-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/gallery.css">
${css.map(c => `<link rel="stylesheet" href="${c}">`).join('\n')}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${s.skip}
${s.nav}

<main id="main" tabindex="-1">
${body}
</main>

${s.footer}

${s.sticky}
${s.top}

<script src="/js/site.js" defer></script>
${scripts.map(x => `<script src="${x}" defer></script>`).join('\n')}
</body>
</html>
`;
}
