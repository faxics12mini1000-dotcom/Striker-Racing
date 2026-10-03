// Empaqueta js/car-look.js (que importa data/livery.json) a un módulo que el navegador carga sin bundler, para las herramientas de desarrollo
// scripts/sr26-view.html (mapa de patrocinios, pósters). Salida: scripts/.car-look.bundle.js (ignorado por git). three queda externo (importmap).
import { build } from 'esbuild';
await build({ entryPoints: ['js/car-look.js'], bundle: true, format: 'esm', external: ['three'], outfile: 'scripts/.car-look.bundle.js', logLevel: 'error' });
