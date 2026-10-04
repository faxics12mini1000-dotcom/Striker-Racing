// Detecta GPS en el EXIF (IFD0 tag 0x8825) de una imagen con sharp. Devuelve true si hay bloque GPS.
import sharp from 'sharp';
export async function hasGps(file) {
  const { exif } = await sharp(file).metadata();
  if (!exif) return false;
  const t = exif.indexOf('II*\0') >= 0 ? exif.indexOf('II*\0') : exif.indexOf('MM\0*');
  if (t < 0) return false;
  const le = exif.toString('latin1', t, t + 2) === 'II';
  const u16 = o => le ? exif.readUInt16LE(t + o) : exif.readUInt16BE(t + o);
  const u32 = o => le ? exif.readUInt32LE(t + o) : exif.readUInt32BE(t + o);
  const ifd = u32(4), n = u16(ifd);
  for (let i = 0; i < n; i++) if (u16(ifd + 2 + i * 12) === 0x8825) return true;
  return false;
}
