// Servidor estático mínimo para probar el sitio localmente (Vercel no requiere build, pero para
// desarrollo local hace falta algo que sirva los archivos con los content-types correctos, ya que
// abrir index.html con file:// rompe los módulos ES del visor 3D).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.argv[2] ? Number(process.argv[2]) : 8099;

const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.glb':'model/gltf-binary',
  '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.ico':'image/x-icon',
};

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
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  }catch(e){
    res.writeHead(404);
    res.end('Not found: ' + req.url);
  }
}).listen(port, () => console.log('Sirviendo en http://localhost:' + port));
