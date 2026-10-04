// Servidor estático mínimo para probar el sitio localmente (Vercel no requiere build, pero para
// desarrollo local hace falta algo que sirva los archivos con los content-types correctos, ya que
// abrir index.html con file:// rompe los módulos ES del visor 3D).
// Uso: node scripts/dev-server.mjs [puerto] [carpeta-raíz] [cache]
// Con el tercer argumento 'cache' replica los Cache-Control de vercel.json (útil para auditar con Lighthouse).
// Comprime con gzip los tipos de texto (como lo hace Vercel en producción) para que auditorías
// locales de Lighthouse no penalicen "enable text compression" por un artefacto del servidor.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ? Number(process.argv[2]) : 8099;
const useCache = process.argv[4] === 'cache';
const root = process.argv[3] ? path.resolve(process.argv[3]) : defaultRoot;

const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.glb':'model/gltf-binary',
  '.png':'image/png', '.mp4':'video/mp4', '.webm':'video/webm', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.pdf':'application/pdf', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.avif':'image/avif', '.webmanifest':'application/manifest+json', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8', '.usdz':'model/vnd.usdz+zip',
};
const compressible = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.xml', '.txt', '.webmanifest']);

http.createServer(async (req, res) => {
  try{
    var urlPath = decodeURIComponent(req.url.split('?')[0]);
    if(urlPath.endsWith('/')) urlPath += 'index.html';
    var filePath = path.join(root, urlPath);
    if(!filePath.startsWith(root)){ res.writeHead(403); return res.end('Forbidden'); }
    var s = await stat(filePath).catch(() => null);
    if(s && s.isDirectory()) filePath = path.join(filePath, 'index.html');
    var data = await readFile(filePath);
    var ext = path.extname(filePath);
    var headers = { 'Content-Type': types[ext] || 'application/octet-stream' };
    if(useCache){
      if(urlPath.startsWith('/fonts/') || urlPath.startsWith('/vendor/') || urlPath.startsWith('/js/dist/') || urlPath.startsWith('/assets/models/') || urlPath.startsWith('/assets/video/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      else if(['.css', '.js'].includes(ext)) headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
      else if(['.glb', '.webp', '.png'].includes(ext)) headers['Cache-Control'] = 'public, max-age=604800';
    }
    if(compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')){
      data = gzipSync(data);
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    res.end(data);
  }catch(e){
    // como en Vercel: las rutas que no existen devuelven /404.html con estado 404
    try{
      var nf = await readFile(path.join(root, '404.html'));
      res.writeHead(404, { 'Content-Type': types['.html'], 'Content-Length': nf.length });
      return res.end(nf);
    }catch(e2){ /* sin 404.html */ }
    res.writeHead(404);
    res.end('Not found: ' + req.url);
  }
}).listen(port, () => console.log('Sirviendo ' + root + ' en http://localhost:' + port));
