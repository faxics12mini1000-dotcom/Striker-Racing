// Mide el arranque del visor 3D de /auto/ hasta el primer cuadro (usa los performance.mark('sr26:*') de js/viewer.js).
// Requisitos: puppeteer-core, `node scripts/dev-server.mjs 8099 . cache` corriendo y Edge/Chrome (BROWSER para la ruta).
// Uso: node scripts/measure-viewer.mjs [ruta=/auto/] [corridas=3] [3g|4g|none] [cpu=1]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const BASE = process.env.SITE_URL || 'http://localhost:8099';
const BROWSER = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const route = process.argv[2] || '/auto/', runs = Number(process.argv[3] || 3), net = process.argv[4] || '4g', cpu = Number(process.argv[5] || 1);
const NET = { '3g':{ down:1.6e6 / 8, up:750e3 / 8, lat:300 }, '4g':{ down:9e6 / 8, up:9e6 / 8, lat:60 }, none:null }[net];
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const rows = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  p.on('pageerror', e => console.error('pageerror:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  const cdp = await p.createCDPSession();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (NET) await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: NET.down, uploadThroughput: NET.up, latency: NET.lat });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await p.goto(BASE + route, { waitUntil: 'load' });
  await p.waitForSelector('#modelStage.is-ready', { timeout: 120000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  const r = await p.evaluate(() => {
    const m = {}; performance.getEntriesByType('mark').filter(e => e.name.startsWith('sr26:')).forEach(e => { m[e.name.slice(5)] = Math.round(e.startTime); });
    const res = performance.getEntriesByType('resource').filter(e => /three|GLTF|Orbit|meshopt|Buffer|RoomEnv|car-look|viewer|sr26|poster|logo|\.glb|bundle/.test(e.name)).map(e => ({ n: e.name.split('/').pop().split('?')[0], kb: +(e.transferSize / 1024).toFixed(1), end: Math.round(e.responseEnd) }));
    const nav = performance.getEntriesByType('navigation')[0];
    return { m, res, load: Math.round(nav.loadEventEnd), lcp: null };
  });
  rows.push(r); await ctx.close();
}
await browser.close();
const keys = ['boot', 'modules', 'renderer', 'env', 'glb-parsed', 'looks', 'built', 'compiled', 'first-frame'];
console.log(`ruta ${route} · red ${net} · cpu x${cpu} · ${runs} corridas (ms desde navegación; mediana)`);
const med = a => { a = a.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
let prev = 0;
for (const k of keys) { const v = med(rows.map(r => r.m[k])); console.log(k.padEnd(12), String(v).padStart(7), v != null ? `  (+${v - prev})` : ''); if (v != null) prev = v; }
console.log('load event'.padEnd(12), String(med(rows.map(r => r.load))).padStart(7));
console.log('recursos (corrida 1):'); rows[0].res.forEach(x => console.log('  ', x.n.padEnd(28), String(x.kb).padStart(8), 'KB  fin', x.end));
console.log('total KB:', rows[0].res.reduce((a, x) => a + x.kb, 0).toFixed(1));
