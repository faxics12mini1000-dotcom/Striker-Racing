// Analítica opcional (clic a WhatsApp, uso del configurador y del AR). APAGADA por defecto: con "enabled": false (o sin "endpoint") ninguna página carga js/analytics.js
// y no sale ninguna petición. Configuración y texto para el aviso de privacidad: docs/ANALITICA.md y CAMBIOS_PARA_EL_EQUIPO.md.
import { readFileSync } from 'node:fs';
import { inject, esc } from '../lib/inject.mjs';

const FILES = ['index.html', 'auto/index.html', 'presupuesto/index.html', 'patrocinios/index.html', 'en/index.html', 'en/car/index.html', 'en/budget/index.html', 'en/sponsorship/index.html'];

export function buildAnalytics() {
  const d = JSON.parse(readFileSync('data/analytics.json', 'utf8'));
  const warnings = [];
  const on = d.enabled === true && !!d.endpoint;
  if (d.enabled && !d.endpoint) warnings.push('analytics.json: "enabled" es true pero falta "endpoint": sigue apagada');
  if (on && !/^https:\/\//.test(d.endpoint)) warnings.push('analytics.json: el endpoint debe ser https://');
  const tag = `<script src="/js/analytics.js" defer data-mode="${esc(d.mode || 'beacon')}" data-endpoint="${esc(d.endpoint)}" data-domain="${esc(d.domain || 'strikerracing.com')}"></script>`;
  for (const f of FILES) { inject(f, 'analytics', on ? tag : ''); }
  return { empty: !on, warnings };
}
