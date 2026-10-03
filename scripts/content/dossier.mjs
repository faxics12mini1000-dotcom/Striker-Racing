// /dossier/ y /en/dossier/: página A4 imprimible a PDF generada de las MISMAS páginas del sitio (fuente única, sin copiar texto a mano):
//   niveles, notas y fecha límite → patrocinios/ (en/sponsorship/) · presupuesto y nota fiscal → presupuesto/ (en/budget/) · contactos → pie de página.
// Solo agrega rótulos de sección y el QR a WhatsApp. Si cambias un precio o beneficio en el sitio, corre npm run build:content y el dossier se actualiza.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { load } from 'cheerio';
import QRCode from 'qrcode';
import { page } from '../lib/layout.mjs';
import { esc } from '../lib/inject.mjs';
import { palette } from '../lib/palette.mjs';
import { SITE } from '../lib/pages.mjs';

const SRC = {
  es: { pat: 'patrocinios/index.html', bud: 'presupuesto/index.html' },
  en: { pat: 'en/sponsorship/index.html', bud: 'en/budget/index.html' },
};
const L = {
  es: { title: 'Dossier de patrocinio · Striker Racing', desc: 'Dossier de patrocinio de Striker Racing: niveles, presupuesto de la temporada y contacto, listo para imprimir o guardar como PDF.',
        kicker: 'Dossier de patrocinio', budget: 'Presupuesto de la temporada', contact: 'Contacto', scan: 'Escanea para escribirnos por WhatsApp', print: 'Imprimir o guardar como PDF',
        src: 'Generado a partir de las páginas de Patrocinios y Presupuesto de strikerracing.com; si hay diferencias, valen las del sitio.', logoAlt: 'Logo de Striker Racing' },
  en: { title: 'Sponsorship dossier · Striker Racing', desc: 'Striker Racing sponsorship dossier: tiers, season budget and contact, ready to print or save as PDF.',
        kicker: 'Sponsorship dossier', budget: 'Season budget', contact: 'Contact', scan: 'Scan to message us on WhatsApp', print: 'Print or save as PDF',
        src: 'Generated from the Sponsorship and Budget pages of strikerracing.com; if they differ, the website prevails.', logoAlt: 'Striker Racing logo' },
};

export async function buildDossier() {
  const P = palette();
  for (const lang of ['es', 'en']) {
    const t = L[lang];
    const pat = load(readFileSync(SRC[lang].pat, 'utf8')), bud = load(readFileSync(SRC[lang].bud, 'utf8'));
    const txt = el => el.text().replace(/\s+/g, ' ').trim();
    const heading = txt(pat('.room-head h1')), lead = txt(pat('.room-head .hero-lead'));
    const tiersEyebrow = txt(pat('#niveles .eyebrow-tag, #tiers .eyebrow-tag').first());
    const tiers = pat('.tiers .tier').map((_, el) => {
      const $t = pat(el);
      return `<li class="dos-tier${$t.hasClass('featured') ? ' is-featured' : ''}"><h3>${txt($t.find('h3'))}</h3><p class="dos-price">${txt($t.find('.price'))} <span>${txt($t.find('.price-note'))}</span></p>${$t.find('.ribbon').length ? `<p class="dos-ribbon">${txt($t.find('.ribbon'))}</p>` : ''}<ul>${$t.find('ul').html()}</ul></li>`;
    }).get().join('\n');
    const tiersNote = pat('.tiers-note').html();
    const budTitle = txt(bud('#presupuesto h2, #budget h2').first());
    const total = txt(bud('.budget-figure')), totalLabel = txt(bud('.budget-figure-label'));
    const items = bud('.budget-list li').map((_, li) => { const $l = bud(li); return `<tr><td>${$l.children('span').html()}</td><td class="num">${txt($l.children('b').last())}</td></tr>`; }).get().join('\n');
    const notes = bud('.budget-note').map((_, n) => `<p class="dos-note">${bud(n).html()}</p>`).get().join('\n');
    const mail = bud('footer a[href^="mailto:"]').first().attr('href').replace('mailto:', '');
    const wa = bud('footer a.footer-wa').first(), waHref = wa.attr('href'), waText = txt(wa);
    const ig = bud('footer a.social-link').first(), igHref = ig.attr('href'), igText = txt(ig);
    const qr = await QRCode.toString(waHref, { type: 'svg', margin: 0, color: { dark: P.navy, light: '#0000' } });
    const season = txt(pat('.room-head .room-tag')).split('·').pop().trim();
    const body = `<article class="dossier">
  <div class="dos-bar"><button type="button" class="btn btn-solid" id="dosPrint">${t.print}</button></div>
  <section class="dos-page">
    <header class="dos-head">
      <img src="/logo-64.webp" width="48" height="45" alt="${t.logoAlt}">
      <div><p class="dos-kicker">${t.kicker} · ${season}</p><h1>${heading}</h1></div>
    </header>
    <p class="dos-lead">${lead}</p>
    <h2>${tiersEyebrow}</h2>
    <ul class="dos-tiers">
${tiers}
    </ul>
    <p class="dos-deadline">${tiersNote}</p>
  </section>
  <section class="dos-page dos-page-2">
    <h2>${t.budget}</h2>
    <p class="dos-total"><b>${total}</b> <span>${totalLabel}</span></p>
    <p class="dos-sub">${budTitle}</p>
    <table class="dos-table"><tbody>
${items}
    </tbody></table>
${notes}
    <h2>${t.contact}</h2>
    <div class="dos-contact">
      <ul>
        <li><a href="mailto:${esc(mail)}">${esc(mail)}</a></li>
        <li><a href="${esc(waHref)}">${esc(waText)}</a></li>
        <li><a href="${esc(igHref)}">${esc(igText)}</a></li>
      </ul>
      <figure class="dos-qr" role="img" aria-label="${t.scan}">${qr}<figcaption>${t.scan}</figcaption></figure>
    </div>
    <p class="dos-src">${t.src}</p>
  </section>
</article>`;
    const esPath = '/dossier/', enPath = '/en/dossier/';
    const html = page({ lang, title: t.title, description: t.desc, esPath, enPath, body, css: ['/css/dossier.css'], scripts: ['/js/dossier.js'], ogImage: `${SITE}/assets/img/og/dossier-${lang}.jpg`, navCurrent: lang === 'es' ? '/patrocinios/' : '/en/sponsorship/' });
    const dir = lang === 'es' ? 'dossier' : 'en/dossier';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, html);
  }
  return { empty: false, pages: 2 };
}
