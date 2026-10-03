// Genera el contenido que crece a partir de data/: aerodinámica (CFD), bitácora, muro de patrocinadores y dossier. Cada pieza queda apagada (sin HTML) mientras su
// archivo de datos esté vacío. Uso: node scripts/build-content.mjs     (o npm run build:content; también lo corre npm run build)
import { buildCfd } from './content/cfd.mjs';

const results = { cfd: buildCfd() };
for (const [name, r] of Object.entries(results)) {
  const state = r.empty ? 'apagado (sin datos)' : `encendido (${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => !['empty', 'warnings'].includes(k))))})`;
  console.log(`${name.padEnd(12)} ${state}`);
  (r.warnings || []).forEach(w => console.warn('  AVISO:', w));
}
