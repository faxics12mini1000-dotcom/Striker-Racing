// Hornea el entorno de estudio (RoomEnvironment prefiltrado con PMREM) en assets/models/env-room.png, para que el visor no
// tenga que generarlo en cada visita. Formato: PNG RGB con (v/64)^(1/3) en 8 bits por canal (ver lookEnvironmentBaked en js/car-look.js).
// Requisitos: puppeteer-core, `node scripts/dev-server.mjs` en :8099 y Edge/Chrome. Uso: node scripts/bake-env.mjs [cubeSize=64]
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
const SITE = process.env.SITE_URL || 'http://localhost:8099', size = process.argv[2] || 64;
const BROWSER = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const ENV_MAX = 64;
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage();
p.on('pageerror', e => console.error('pageerror:', e.message));
await p.goto(`${SITE}/scripts/env-bake.html?size=${size}`);
await p.waitForFunction('window.envBake', { timeout: 60000 });
const { w, h, max, data } = await p.evaluate(() => window.envBake);
await browser.close();
const raw = Buffer.alloc(w * h * 3);
for (let i = 0; i < w * h * 3; i++) raw[i] = Math.round(Math.cbrt(Math.min(1, Math.max(0, data[i]) / ENV_MAX)) * 255);
const out = 'assets/models/env-room.png';
await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9, palette: false }).toFile(out);
console.log(`${w}x${h} · máx ${max.toFixed(2)} (límite ${ENV_MAX}) · ${out} ${(statSync(out).size / 1024).toFixed(1)} KB`);
