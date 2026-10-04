// Falla si alguna imagen en assets/, team/ o public/ trae GPS en el EXIF (privacidad).
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hasGps } from '../scripts/lib/exif-gps.mjs';
const EXT = /\.(jpe?g|webp|avif|png|tiff?)$/i;
const walk = p => !existsSync(p) ? [] : readdirSync(p).flatMap(e => { const q = join(p, e); return e === 'node_modules' ? [] : statSync(q).isDirectory() ? walk(q) : EXT.test(q) ? [q] : []; });
const files = ['assets', 'team', 'public'].flatMap(walk);
const bad = [];
for (const f of files) { try { if (await hasGps(f)) bad.push(f); } catch (e) { console.warn('no se pudo leer', f, e.message); } }
if (bad.length) { console.error('GPS en EXIF:\n' + bad.join('\n')); process.exit(1); }
console.log(`exif-gps ok: ${files.length} imagenes sin GPS`);
