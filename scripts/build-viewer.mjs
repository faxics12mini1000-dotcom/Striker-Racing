// Empaqueta el cargador (js/stage.js, ~2 KB) y el visor 3D (js/viewer.js + js/car-look.js + three.js recortado + GLTFLoader/OrbitControls/meshopt)
// en js/dist/ con hash en el nombre, y estampa en las páginas del visor las URLs versionadas (cargador, visor, GLB, entorno y video) para
// poder cachearlas un año (immutable). Páginas: auto/index.html y en/car/index.html. Marcadores que busca en el HTML:
//   <!-- viewer:head:begin --> … <!-- viewer:head:end -->      script en línea que precarga visor + GLB + entorno (solo donde se usará el 3D de inmediato)
//   <!-- viewer:script:begin --> … <!-- viewer:script:end -->  <script type="module"> del cargador
//   id="modelStage" con data-viewer / data-model / data-env / data-video-mp4 / data-video-webm
// Video de Fusion para teléfono (opcional): dejar assets/video/sr26-phone.mp4 y/o sr26-phone.webm y correr este script.
// Uso: npm run build:viewer      (después de tocar js/viewer.js, js/stage.js, js/car-look.js o los archivos de assets/models/ y assets/video/)
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const PAGES = ['auto/index.html', 'en/car/index.html'];
const ASSETS = { model: 'assets/models/sr26.glb', env: 'assets/models/env-room.png' };
const VIDEO = { mp4: 'assets/video/sr26-phone.mp4', webm: 'assets/video/sr26-phone.webm' };
const hash = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);

rmSync('js/dist', { recursive: true, force: true });
const res = await build({
  entryPoints: ['js/stage.js', 'js/viewer.js'], bundle: true, splitting: false, format: 'esm', outdir: 'js/dist',
  entryNames: '[name].[hash]', minify: true, target: 'es2020', legalComments: 'none', metafile: true, logLevel: 'warning',
});
const outs = Object.entries(res.metafile.outputs);
const outOf = entryPoint => '/' + outs.find(([, o]) => o.entryPoint === entryPoint)[0].replace(/\\/g, '/');
const v = { model: hash(ASSETS.model), env: hash(ASSETS.env) };
const urls = {
  stage: outOf('js/stage.js'), viewer: outOf('js/viewer.js'),
  model: `/${ASSETS.model}?v=${v.model}`, env: `/${ASSETS.env}?v=${v.env}`,
  mp4: existsSync(VIDEO.mp4) ? `/${VIDEO.mp4}?v=${hash(VIDEO.mp4)}` : '',
  webm: existsSync(VIDEO.webm) ? `/${VIDEO.webm}?v=${hash(VIDEO.webm)}` : '',
};
const hasVideo = !!(urls.mp4 || urls.webm);
// Precarga solo donde el 3D se usará de inmediato: sin ahorro de datos ni 2G y, si hay video, fuera de teléfonos (≤ 560 px).
const preload = '(function(){var c=navigator.connection||{};if(c.saveData||/2g/.test(c.effectiveType||\'\'))return;'
  + (hasVideo ? 'if(matchMedia(\'(max-width:560px)\').matches)return;' : '')
  + 'var h=document.head;function l(r,u,a){var e=document.createElement(\'link\');e.rel=r;e.href=u;for(var k in a)e.setAttribute(k,a[k]);h.appendChild(e)}'
  + `l('modulepreload','${urls.viewer}');l('preload','${urls.model}',{as:'fetch',type:'model/gltf-binary',crossorigin:''});l('preload','${urls.env}',{as:'fetch',crossorigin:''})})();`;

for (const page of PAGES) {
  let html = readFileSync(page, 'utf8'); const crlf = html.includes('\r\n'); html = html.replace(/\r\n/g, '\n');
  const swap = (begin, end, body) => {
    const a = html.indexOf(begin), b = html.indexOf(end);
    if (a < 0 || b < a) throw new Error(`${page}: faltan los marcadores ${begin}`);
    html = html.slice(0, a + begin.length) + body + html.slice(b);
  };
  swap('<!-- viewer:head:begin -->', '<!-- viewer:head:end -->', `\n<script>${preload}</script>\n`);
  swap('<!-- viewer:script:begin -->', '<!-- viewer:script:end -->', `<script type="module" src="${urls.stage}"></script>`);
  const attr = (name, val) => {
    const re = new RegExp(`data-${name}="[^"]*"`);
    if (!re.test(html)) throw new Error(`${page}: falta data-${name} en #modelStage`);
    html = html.replace(re, `data-${name}="${val}"`);
  };
  attr('viewer', urls.viewer); attr('model', urls.model); attr('env', urls.env); attr('video-mp4', urls.mp4); attr('video-webm', urls.webm);
  if (crlf) html = html.replace(/\n/g, '\r\n');
  writeFileSync(page, html);
}

const kb = f => (statSync(f).size / 1024).toFixed(1), gz = f => (gzipSync(readFileSync(f)).length / 1024).toFixed(1);
for (const [f] of outs) if (f.endsWith('.js')) console.log(`${f.replace(/\\/g, '/')}  ${kb(f)} KB  (gzip ${gz(f)} KB)`);
console.log(`GLB ${kb(ASSETS.model)} KB · entorno ${kb(ASSETS.env)} KB · versiones ${v.model} / ${v.env} · video ${hasVideo ? [urls.mp4 && 'mp4', urls.webm && 'webm'].filter(Boolean).join('+') : 'sin configurar'}`);
