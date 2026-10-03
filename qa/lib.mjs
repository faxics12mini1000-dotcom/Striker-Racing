// Utilidades compartidas por las pruebas de qa/: navegador (Chrome o Edge del sistema, sin descargar nada), servidor local y páginas del sitio.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export const BASE = process.env.SITE_URL || 'http://localhost:8099';

export const PAGES = [
  { id: 'inicio', es: '/', en: '/en/' },
  { id: 'auto', es: '/auto/', en: '/en/car/' },
  { id: 'presupuesto', es: '/presupuesto/', en: '/en/budget/' },
  { id: 'patrocinios', es: '/patrocinios/', en: '/en/sponsorship/' },
];

export const VIEWPORTS = [320, 390, 768, 1280, 1920];

const EXE = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => p && existsSync(p));

export async function launch(extraArgs = []) {
  return chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...extraArgs],
  });
}

/** Devuelve true si el servidor responde; si no, lo levanta (y devuelve una función para apagarlo). */
export async function ensureServer() {
  try { const r = await fetch(BASE + '/'); if (r.ok) return () => {}; } catch { /* no está corriendo */ }
  const port = new URL(BASE).port || '8099';
  const child = spawn(process.execPath, ['scripts/dev-server.mjs', port, '.', 'cache'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 150));
    try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch { /* reintento */ }
  }
  return () => child.kill();
}

let failures = 0;
export function check(ok, msg) {
  console.log((ok ? 'OK   ' : 'FALLA') + ' ' + msg);
  if (!ok) failures++;
}
export function finish() {
  console.log(failures ? `\n${failures} comprobación(es) fallaron` : '\nTodo en orden');
  process.exit(failures ? 1 : 0);
}
