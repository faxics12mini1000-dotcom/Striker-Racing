// Variantes responsivas de las fotos reales del equipo (team/*.webp) en AVIF y WebP. El original queda como respaldo y como tamaño mayor.
//   team/grupo.webp (1280×720)       → grupo-640 / grupo-960 / grupo-1280 (.avif y .webp)
//   team/<persona>.webp (680×1020)   → <persona>-340 / <persona>-680     (.avif y .webp)
// Se generan desde los archivos que haya en team/, sin ampliar nunca (si el original mide menos, ese es el máximo). Para cambiar una foto: reemplazar
// team/<nombre>.webp conservando el nombre y correr `npm run build:images`; después `npm run stamp:img` ya no hace falta (las fotos llevan el tamaño en el nombre).
// Uso: node scripts/build-images.mjs
import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const dir = 'team';
const SIZES = { grupo: [640, 960, 1280] };
const DEFAULT = [340, 680];
const kb = f => (statSync(f).size / 1024).toFixed(0) + ' KB';

for (const file of readdirSync(dir).filter(f => /^[a-z-]+\.webp$/.test(f))) {
  const name = file.replace('.webp', '');
  const src = path.join(dir, file);
  const meta = await sharp(src).metadata();
  for (const w of (SIZES[name] || DEFAULT)) {
    const width = Math.min(w, meta.width);
    const base = path.join(dir, `${name}-${w}`);
    const img = () => sharp(src).resize({ width, withoutEnlargement: true });
    await img().avif({ quality: 52, effort: 6 }).toFile(base + '.avif');
    // el WebP del tamaño original ya existe (team/<nombre>.webp): no se duplica ni se recomprime
    if (width < meta.width) await img().webp({ quality: 78, effort: 6 }).toFile(base + '.webp');
    console.log(`${base}.avif ${kb(base + '.avif')}` + (existsSync(base + '.webp') ? ` · .webp ${kb(base + '.webp')}` : ' · .webp = original'));
  }
}
