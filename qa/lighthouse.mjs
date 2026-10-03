// Lighthouse móvil (configuración por defecto: Moto G Power, 4G lento) sobre todas las páginas, ES y EN.
// Uso: node qa/lighthouse.mjs [etiqueta] [ruta ...]   → qa/lighthouse/<etiqueta>.json (resumen) y salida en consola.
// Requiere el servidor local con caché y gzip: node scripts/dev-server.mjs 8099 . cache
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { BASE, PAGES } from './lib.mjs';

const label = process.argv[2] || 'actual';
const only = process.argv.slice(3);
const urls = PAGES.flatMap(p => [p.es, p.en]).filter(u => !only.length || only.includes(u));
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
mkdirSync('qa/lighthouse', { recursive: true });

const out = {};
for (const u of urls) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const r = await lighthouse(BASE + u, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    const c = r.lhr.categories, a = r.lhr.audits;
    const fails = Object.values(a).filter(x => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual')
      .map(x => `${x.id}(${x.score})`);
    out[u] = {
      perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100),
      bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
      lcp: Math.round(a['largest-contentful-paint'].numericValue), cls: +a['cumulative-layout-shift'].numericValue.toFixed(3),
      tbt: Math.round(a['total-blocking-time'].numericValue), fcp: Math.round(a['first-contentful-paint'].numericValue),
      bytes: Math.round(a['total-byte-weight'].numericValue / 1024), fails,
    };
    console.log(u.padEnd(20), JSON.stringify(out[u]));
  } catch (e) {
    console.log(u, 'ERROR', e.message);
  } finally { await chrome.kill(); }
}
writeFileSync(`qa/lighthouse/${label}.json`, JSON.stringify(out, null, 2));
