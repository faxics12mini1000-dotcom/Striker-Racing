# Auditoría inicial · Striker Racing (3-oct-2026)

Estado del repo al arrancar: rama `main` limpia (commit `a46ce97`), trabajo en `mejoras/ui-3d-v1`. Sitio estático (HTML escrito a mano, ES y EN),
CSS en `css/site.css` + `css/gallery.css`, visor 3D empaquetado con esbuild en `js/dist/` (hashes en el nombre), deploy en Vercel (`vercel.json`).
Mediciones: Lighthouse móvil por defecto (Moto G Power, 4G lento) contra `node scripts/dev-server.mjs 8099 . cache` (gzip + Cache-Control como Vercel);
Chrome headless con SwiftShader (WebGL por software), por lo que el TBT del 3D sale más alto que en un teléfono real. Datos crudos: `qa/lighthouse/base.json`.

## Estructura relevante

| Qué | Dónde |
|---|---|
| Páginas ES | `index.html`, `auto/`, `presupuesto/`, `patrocinios/`, `privacidad.html` |
| Páginas EN | `en/index.html`, `en/car/`, `en/budget/`, `en/sponsorship/`, `en/privacidad.html` |
| Tokens de color | `:root` de `css/site.css` (y copia en `css/gallery.css`) |
| Visor 3D | `js/stage.js` (cargador, 1.4 KB) → `js/viewer.js` + `js/car-look.js` + three recortado → `js/dist/*.js` (`npm run build:viewer`) |
| Modelo | `assets/models/sr26.glb` (301 KB, meshopt + normales int8), `env-room.png` (17 KB, entorno horneado) |
| Meta de fondeo | `js/config.js` (`STRIKER_CONFIG.funding`) |
| Scripts de mantenimiento | `scripts/` (hornear GLB/entorno, pósters, og-share, sellado de imágenes, servidor local) |

## Hallazgos priorizados

### Crítico
1. **Niveles de patrocinio invisibles en pantallas bajas.** `#patrocinios` (`.reveal`, ~3,200–5,700 px de alto según el ancho) se revela con
   `IntersectionObserver` `threshold: 0.12`. Si el viewport mide menos de ~12 % de la sección (≈ 8× más alta que la ventana), nunca cruza el umbral
   y toda la sección queda en `opacity:0`. Reproducido con `qa/reveal.test.mjs`: **falla en 320×480 y 844×390** (ES y EN); funciona en 390×844 y 1280×720.
   Además la clase `has-io` se pone en el `<head>`; si `site.js` no llega a ejecutarse, el contenido queda oculto para siempre.
2. **`/auto/` y `/en/car/`: Performance 48 y 52** (LCP 4.5–4.8 s, TBT 3–6 s). El 3D arranca solo, también en teléfono, y compite con el LCP.

### Alto
3. **Preloads de `sr26.glb` y `env-room.png`** (inyectados por un script en línea): el visor puede tardar en consumirlos (espera el primer pintado, descarga el
   módulo y recién ahí pide el GLB), con lo que Chrome avisa que no se usaron a tiempo; además se piden en teléfonos aunque el 3D no se muestre de inmediato.
4. **Accesibilidad.** axe: solo falla `target-size` en las marcas 1–5 del despiece (16 px). Lighthouse: `heading-order` en `/auto/` (el pie usa `h3` sin `h2`).
   Pendiente verificar a mano: el canvas del visor no se puede operar con teclado, las marcas del deslizador no anuncian la etapa en curso, no hay estado de error
   anunciado, y la animación del despiece no se pausa al pasar `prefers-reduced-motion` salvo en la rotación automática.
5. **Datos que no existen y el sitio no debe afirmar.** `/auto/` dice «se valida en Ansys Student CFD» sin que haya un CFD corrido (regla E). Se propone el cambio en
   `CAMBIOS_PARA_EL_EQUIPO.md`; no se edita el texto.

### Medio
6. **SEO.** Ya hay `robots.txt`, `sitemap.xml` con hreflang, canonical, hreflang en `<head>`, JSON-LD (`SportsTeam` en inicio y `WebPage`/`FAQPage`
   en las demás). Falta: página 404, `favicon.ico`, manifest, `og:image` distinta por página (todas usan `og-share.png`), `lastmod` en el sitemap, y el sitemap lista
   `privacidad.html`, que lleva `noindex` (contradicción). `og-share.png` se dibuja con un `radialGradient` (efecto de brillo, contra la regla B).
7. **Rendimiento (resto de páginas).** Inicio 79/71 (ES/EN): TBT ~650 ms y LCP 2.2–4.0 s; la foto de equipo (`team/grupo.webp`, 173 KB, 1280×720) sale a todo
   ancho sin `srcset` ni AVIF; las 6 fotos de tarjetas son WebP de 680×1020 (90–170 KB) sin variantes; se precargan las 3 fuentes en todas las páginas aunque
   JetBrains Mono solo se usa en etiquetas. Las demás páginas ya rinden 93–97.
8. **Bundle del visor: 630 KB sin comprimir (170 KB gzip)** en `js/dist/viewer.*.js` + GLB 302 KB + entorno 17 KB. No hay un presupuesto de JS documentado.
9. **Herramientas de QA ausentes.** No hay pruebas automáticas; `scripts/generate-poster.mjs` usa `puppeteer-core`, que no está en `package.json` (instalado «extraneous»).
   Las capturas de `capturas/` están fuera de git (ignoradas) y fuera del deploy (`.vercelignore`).
10. **Paridad ES/EN.** Estructura equivalente por inspección; no hay verificador automático. El bundle del visor ya trae ambos idiomas.

### Bajo / observaciones
11. Estética: aún hay degradados en el CSS, todos funcionales y no decorativos: la retícula de plano técnico (líneas de 1 px), el fundido de esa retícula en las
    cabeceras (`mask-image`), el scrim de las fotos de equipo y de las tarjetas (`.team-hero::before`, `.paddock-pass::before`) y el relleno del deslizador del visor.
    No se añaden degradados nuevos; los scrims se listan en `CAMBIOS_PARA_EL_EQUIPO.md` por si se prefiere un tratamiento plano.
12. `css/site.css` y `css/gallery.css` repiten el bloque `:root`. Los colores de acabado del auto (hule, acero, aluminio, latón) y los `rgba(7,27,51,…)` de
    los paneles flotantes no son tokens (están en `js/car-look.js` y en el CSS).
13. `scripts/dev-server.mjs` no reproduce `trailingSlash`/404 de Vercel (devuelve 404 de texto plano).
14. `TODO-EQUIPO.md` conserva notas anteriores (paleta con `--blue-accent`, pontones con logo, etc.) que ya no reflejan el código.
15. El GLB fuente y el GLB web son el mismo archivo (`assets/models/sr26.glb`, ya comprimido con meshopt); no hay forma de regenerar variantes (AR, póster)
    sin una canalización. Los STL de origen viven en `scripts/source/` (ignorado por git).

## Lo que **no** se toca (regla A)

Nombres, precios, rangos, beneficios y cantidad de niveles; meta de $65,450 y desglose del presupuesto; fecha límite del 23 de noviembre; respuestas del FAQ y
texto fiscal; contactos; nombres, roles, bios y cita del mentor; logo; rutas `/auto/`, `/presupuesto/`, `/patrocinios/`, `/en/...`. Cualquier cambio aquí se propone en
`CAMBIOS_PARA_EL_EQUIPO.md`.

## Plan de ejecución

Una rama (`mejoras/ui-3d-v1`), un commit por fase, sin push: 1 correcciones técnicas · 2 inicio · 3 canalización del modelo · 4 visor · 5 zonas y configurador ·
6 AR y CFD · 7 contenido que crece · 8 calidad. Las líneas base (Lighthouse, axe, prueba de `.reveal`) quedan en `qa/` y se repiten al final.
