// Genera el contenido que crece a partir de data/ y de las propias páginas: bitácora (+ enlace de menú), aerodinámica (CFD), muro de patrocinadores,
// analítica opcional, dossier A4 y sitemap. Cada pieza queda apagada (sin HTML) mientras su archivo de datos esté vacío. El dossier se genera desde
// patrocinios/ y presupuesto/ (fuente única), así que corre siempre al final. Uso: node scripts/build-content.mjs   (o npm run build:content)
import { buildBitacora } from './content/bitacora.mjs';
import { buildCfd } from './content/cfd.mjs';
import { buildSponsors } from './content/sponsors.mjs';
import { buildAnalytics } from './content/analytics.mjs';
import { buildDossier } from './content/dossier.mjs';
import { execFileSync } from 'node:child_process';

const results = {};
results.bitacora = buildBitacora();     // primero: inyecta (o quita) el enlace de menú que copian las páginas generadas
results.cfd = buildCfd();
results.sponsors = buildSponsors();
results.analytics = buildAnalytics();
results.dossier = await buildDossier();
execFileSync(process.execPath, ['scripts/build-sitemap.mjs'], { stdio: 'inherit' });
for (const [name, r] of Object.entries(results)) {
  const extra = Object.entries(r).filter(([k]) => !['empty', 'warnings'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`${name.padEnd(10)} ${r.empty ? 'apagado (sin datos)' : 'encendido'} ${extra}`);
  (r.warnings || []).forEach(w => console.warn('  AVISO:', w));
}
