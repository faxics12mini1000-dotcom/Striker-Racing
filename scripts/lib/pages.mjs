// Lista única de páginas del sitio (ES ↔ EN). La usan el sitemap, las imágenes para compartir, el verificador de enlaces y las pruebas de qa/.
// `optional`: la página solo existe si la genera su script (dossier, bitácora); si el archivo no está, se ignora.
import { existsSync } from 'node:fs';

export const SITE = 'https://strikerracing.com';

export const PAIRS = [
  { id: 'inicio',      es: '/',               en: '/en/' },
  { id: 'auto',        es: '/auto/',          en: '/en/car/' },
  { id: 'presupuesto', es: '/presupuesto/',   en: '/en/budget/' },
  { id: 'patrocinios', es: '/patrocinios/',   en: '/en/sponsorship/' },
  { id: 'dossier',     es: '/dossier/',       en: '/en/dossier/',   optional: true },
  { id: 'bitacora',    es: '/bitacora/',      en: '/en/log/',       optional: true },
];

export const fileOf = url => (url.endsWith('/') ? url + 'index.html' : url).replace(/^\//, '');

/** Pares que existen en disco (las opcionales solo si ya se generaron). */
export const pairs = () => PAIRS.filter(p => !p.optional || (existsSync(fileOf(p.es)) && existsSync(fileOf(p.en))));
