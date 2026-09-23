// logo.png pesa 44 KB (321x303) pero en el nav/footer se pinta a ~32px de alto: genera una versión
// pequeña en webp (2x retina) para esos usos. logo.png se conserva para favicon y JSON-LD.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await sharp(path.join(root, 'logo.png')).resize({ height: 64 }).webp({ quality: 90 }).toFile(path.join(root, 'logo-64.webp'));
const m = await sharp(path.join(root, 'logo-64.webp')).metadata();
console.log('logo-64.webp ' + m.width + 'x' + m.height);
