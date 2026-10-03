// Video del SR-26 (25 s · 1920×1080 · 60 fps): renderiza scripts/video-scene.html cuadro por cuadro en Chrome sin interfaz y lo une con ffmpeg.
// Salida en video/ (carpeta fuera del deploy: está en .gitignore y .vercelignore).
// Requisitos: `npm i --no-save puppeteer-core ffmpeg-static` y `node scripts/dev-server.mjs` corriendo en :8099 (BROWSER = ruta de Chrome/Edge si no es la usual).
// Uso:  node scripts/render-video.mjs test 4 15 19.2 23.5     → PNG de prueba en video/test/ (segundos indicados)
//       node scripts/render-video.mjs                          → video/sr26-despiece.mp4 completo   (WORKERS=n páginas en paralelo, FPS=60)
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, writeFileSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099';
const BROWSER = process.env.BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const W = 1920, H = 1080, FPS = +(process.env.FPS || 60), DUR = 25, WORKERS = +(process.env.WORKERS || 3);
const OUT = 'video';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', defaultViewport: { width: W, height: H },
  args: [...(process.env.GPU ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb'] });
async function openScene() {
  const p = await browser.newPage();
  p.on('pageerror', e => console.error('pageerror:', e.message));
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/scripts/video-scene.html?w=${W}&h=${H}`);
  await p.waitForFunction('window.sceneReady === true', { timeout: 120000 });
  return p;
}
const shot = async (p, t, file) => { await p.evaluate(t => window.frame(t), t); return p.screenshot({ path: file, type: 'png', optimizeForSpeed: true }); };

if (process.argv[2] === 'test') {
  mkdirSync(`${OUT}/test`, { recursive: true });
  const p = await openScene();
  for (const t of process.argv.slice(3).map(Number)) { await shot(p, t, `${OUT}/test/frame-${String(t).replace('.', '_')}s.png`); console.log('frame', t); }
  await browser.close(); process.exit(0);
}

const total = FPS * DUR, dir = `${OUT}/.frames`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
let next = 0, done = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async () => {
  const p = await openScene();
  while (next < total) {
    const i = next++;
    await shot(p, i / FPS, `${dir}/f${String(i).padStart(5, '0')}.png`);
    if (++done % 60 === 0) console.log(`${done}/${total} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}));
await browser.close();
const mp4 = `${OUT}/sr26-despiece.mp4`;
await new Promise((ok, no) => spawn(ffmpegPath, ['-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.png`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
  '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', mp4], { stdio: 'inherit' })
  .on('exit', c => c ? no(new Error('ffmpeg ' + c)) : ok()));
rmSync(dir, { recursive: true, force: true });
console.log('listo:', mp4);
