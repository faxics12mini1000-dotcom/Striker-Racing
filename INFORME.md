# Informe · rama `mejoras/ui-3d-v1` (sin push)

Un commit por fase (`git log --oneline`). Ver también `AUDITORIA.md`, `CAMBIOS_PARA_EL_EQUIPO.md`, `README.md` y `docs/`.

## Qué cambió y cómo verlo en local (`npm run serve` → http://localhost:8099)

| Fase | Qué | Dónde verlo |
|---|---|---|
| 1 | Bug de `.reveal` (niveles invisibles en 320×480 y 844×390), SEO (404, favicon.ico, manifest, og por página, sitemap con lastmod, JSON-LD), AVIF/WebP, 3D bajo demanda en teléfono, presupuesto de peso | `/patrocinios/`, `/nope/`, `npm run check:budget` |
| 2 | Hero con foto del equipo + SR-26 3D, franja de datos (del HTML y del GLB), botón fijo Patrocinar | `/`, `/en/` |
| 3 | Canalización del GLB (web + AR sin meshopt + validación + medidas), librea en `data/livery.json`, piezas opcionales | `docs/PIPELINE_GLB.md`, `npm run build:model` |
| 4 | Visor: estados de carga/error, teclado, vista trasera, foto PNG, compartir, plano técnico (208.0 × 84.0 mm, entre ejes 130.0 mm, medidos del GLB), numeración, panel de piezas, leyenda de etapas | `/auto/` |
| 5 | Zonas A–D resaltables y enlazadas a su nivel, configurador de logo (local), maquetas de uniforme y Pit Display, descarga de propuesta | `/auto/#zonas`, `/auto/#configurador` |
| 6 | «Ver en tu mesa» (model-viewer autoalojado, 1:1) y sección CFD (`data/cfd.json`, oculta) | `docs/AR_Y_CFD.md` |
| 7 | Bitácora, muro de patrocinadores y analítica (apagados), dossier A4 con QR | `/dossier/`, `/en/dossier/`, `docs/CONTENIDO.md` |
| 8 | Pruebas Playwright, axe, Lighthouse, enlaces, paridad ES/EN, capturas | `npm run qa`, `qa/screens/` |

## Resultados (local, Lighthouse móvil, `qa/lighthouse/final.json`)

Rendimiento: inicio 90/91, /auto/ 98/98, presupuesto 99/99, patrocinios 99/99. Accesibilidad, buenas prácticas y SEO: 100 en todas. axe: 0 violaciones. Enlaces: 0 rotos. Paridad ES/EN: sin diferencias. Las pruebas de `qa/` pasan. Las capturas de `qa/screens/` se tomaron antes de los últimos ajustes de rendimiento (no cambian el aspecto). El inicio queda justo en 90 (varía ±5 entre corridas); en este equipo Windows con WebGL por software las cifras son más pesimistas que en un teléfono real; conviene confirmar en PageSpeed sobre el deploy.

## Riesgos
- «Ver en tu mesa» no se probó en un Android/iPhone reales (plan B USDZ documentado).
- El texto nuevo en inglés no es traducción certificada.
- La frase «se valida en Ansys Student CFD» sigue en `/auto/` hasta que el equipo decida (CAMBIOS A1).
- Las calcomanías del visor ahora sí se ven (antes no se pegaban): revisar que el aspecto guste.
- En teléfono el 3D arranca al tocar «Explorar en 3D» (decisión de rendimiento, CAMBIOS B3).

## Pasada de UI y ubicaciones como ideas (3-oct, segunda tanda)

| # | Cambio | Dónde |
|---|---|---|
| 9 | Hero de inicio: foto del equipo a todo el ancho (mín. 88 vh) con velo navy plano al 60 %, texto abajo a la izquierda e indicador «Ver el auto»; visor 3D del SR-26 a ancho completo (mín. 80 vh) debajo. En 390 px el grupo completo queda arriba y el texto sobre un panel navy plano | `/`, `/en/` |
| 10 | Plano técnico: sin tarjeta sobre el dibujo; cotas como etiquetas sobre sus líneas; valores y nota en una línea debajo del visor; más aristas dibujadas (umbral 4°) | `/auto/` y `/en/car/` → botón de cota |
| 11 | Ubicación de logos = ideas: sin rótulos pintados, «Ver zonas posibles» (contornos punteados A nariz, B pontones, C alerón trasero, D alerón delantero, E cápsula), logo del configurador en UNA zona elegida, etiqueta «Ideas de ubicación · el diseño final se acuerda con el equipo»; polo = «Ubicaciones de ejemplo». Mapa de Patrocinios y pósters regenerados | `/auto/#zonas`, `#configurador`, `/patrocinios/` |
| 12 | Copy suavizado («podría ir en», «ideas») en configurador, Patrocinios (mapa) y propuesta descargable; el texto de beneficios del equipo no se tocó (CAMBIOS A5) | ES/EN |
| 13 | Categoría: Desarrollo (Development) en todo el sitio; no hay menciones a «Entry» (CAMBIOS A7) | — |
| 14 | UI: botones del visor con aria-label + tooltip y 44 px; «Patrocinar» siempre visible en el menú fijo; escala de espaciado única (`--sp-section`); se quitó el desenfoque (`backdrop-filter`) del menú, diálogos y etiquetas (sin glassmorphism); `prefers-reduced-motion` respetado | `css/gallery.css` |
| 15 | Herramienta de capturas: `scripts/sr26-view.html` volvía a funcionar (empaqueta `car-look.js`); `qa/screens-ui.mjs` captura hero, visor, plano y configurador (auto y polo) a 1440/1024/390 | `qa/screens/ui-*.png` |

**Fallas encontradas y corregidas:** configurador sin inicializar en la prueba (el render por software tarda ~5 s en liberar el hilo; la prueba ahora espera a que existan los niveles), prueba de enlaces de zonas (ahora A, C, D y E), botón «Patrocinar» móvil visible en escritorio (regla CSS pisada) y mapa de Patrocinios con rótulos horneados.

**Aviso:** la foto del equipo mide 1280 × 720 px (< 2000 px); a pantalla completa en monitores grandes se ve algo suave. No se escaló con IA (CAMBIOS B14).

## Hero con caras seguras, bordes sin corte duro, paridad EN y deploy ligero (3-oct, tercera tanda)
- **Caras seguras.** `data/hero-safe.json` guarda las cajas de las caras (en % de `team/grupo.webp`; en la foto actual se ven **6** caras, no 5). `qa/hero-safe.test.mjs` proyecta título (máx. 2 líneas), etiqueta, subtexto, CTAs, menú fijo y «Ver el auto» sobre la foto renderizada y falla si tocan una caja o si una cabeza queda recortada/tapada por el menú, en 1920×1080, 1440×900, 1024×768 y 390×844, ES y EN. Capturas: `qa/screens/hero-safe-*.png`.
- **Bordes.** La foto del hero se difumina arriba y abajo con `mask-image` sobre la propia foto (solo transparencia). `qa/audit.mjs` recorre todas las páginas ES/EN a 1440 y 390 (scroll horizontal, texto cortado, imágenes deformadas o fuera de la ventana, fotos recortadas sin difuminado, texto encimado; ignora el contenido de `<details>` cerrados) y guarda `qa/screens/audit-*.png` de página completa. Resultado: sin hallazgos.
- **Paridad EN.** `/en/` ya tenía el mismo hero y visor; el menú móvil decía «Sponsor» y ahora dice «Sponsor us» como en escritorio. `qa/parity.mjs` compara la estructura del hero (elementos y clases), la foto (srcset/sizes/tamaño/prioridad), los CTAs (clase y tipo de destino), el menú y los botones del menú, y exige «Home / Car / Budget / Sponsorship» y «Sponsor us / Contact us» en inglés.
- **Foto lista para el original.** `npm run build:images` genera 640/960/1280/1920/2560 en AVIF y WebP (y JPG en 1280/1920/2560) desde `assets/img/original/team.jpg` si existe, o desde `team/grupo.webp` si no (sin ampliar nunca), reescribe el `<picture>` del hero (`srcset` + `sizes="100vw"`) y la única precarga de imagen de la página en `index.html` y `en/index.html`. Avisa si la proporción cambia (hay que volver a medir `hero-safe.json`). Probado con un original de 2560 px y restaurado.
- **Deploy.** `vercel.json` ahora fija `installCommand` (`npm ci --omit=dev`: solo esbuild y three) y `buildCommand` (`npm run build:deploy` = solo esbuild del visor). Antes Vercel instalaba todas las devDependencies (Playwright, Lighthouse, gltf-transform, sharp…) y corría `npm run build` completo. El build completo pasó a `npm run build:all` (manual). `.npmrc` con `legacy-peer-deps` (el peer de three de model-viewer chocaba en `npm ci`). `.vercelignore` ya no excluye `scripts/`, `data/` ni `package-lock.json` (el build los necesita).
- **Pruebas.** `qa/lib.mjs` lanza Chrome con `--disable-gpu-compositing`: con la máscara del hero y compositor por software (SwiftShader) las navegaciones de `qa/content.test.mjs` se colgaban; en un navegador con GPU no aplica.

## Caché con hash y costuras del hero (3-oct, cuarta tanda)
- **Caché.** Antes css/js se servían 1 h (+ 24 h de revalidación en segundo plano) sin hash: tras un deploy, quien ya había entrado veía HTML nuevo con CSS viejo. Ahora  ( + ) agrega  a todas las referencias locales de los HTML ES/EN (css, js, imágenes, modelos, fuentes, favicons, manifest; también  y ) y a las  de los CSS (fuentes). Los  ya llevan hash en el nombre y siguen . El hash sale del archivo, no de la fecha; el código fuente no se toca (solo ).
- **vercel.json.**  y  (sin ) →  (se revalidan con ETag: si no cambió, 304). Los demás headers quedan igual (lo que lleva  puede conservar su caché larga con seguridad).
- **Prueba.**  (primer paso de ) arma  y falla si un recurso local citado por un HTML no tiene hash en el nombre ni , si el  no coincide con el contenido, si css/js sin hash no son , o si una ruta sin hash con caché larga se cita sin . Probé romper  y falla.
- **Hero.** En escritorio (>900 px) el menú es transparente sobre la foto (velo navy plano 55 %) y pasa a navy sólido con scroll >40 px (, js/site.js) o con el menú abierto. La foto llega al borde superior: la altura de la foto se calcula en CSS () para que el texto quede sobre las cabezas, y cubre en horizontal con  (en pantallas angostas recorta a los lados, sin cortar caras). Abajo, el difuminado a #071B33 mide ~38 % del alto (), sin línea. En ≤900 px la foto va arriba y el texto debajo (antes el corte era 640 px) y el menú sigue sólido.
- **Visor.**  ya no tiene fondo  ni bordes: es el mismo navy y la cuadrícula del plano ( con ) entra y sale suave. Efecto lateral: lo mismo aplica al visor de /auto/.
- **Póster del visor.** Los  tenían el menú fijo («STRIKER RACING / Patrocinar») horneado en la esquina;  ahora oculta el menú y se regeneraron.
- **Capturas.**  →  (1920, 1440, 1024, 390). Queda una línea normal de sección entre los datos del equipo y «Cinco integrantes» (borde de la siguiente sección, mismo navy); no se tocó.

## Hero: encuadre más lejano (3-oct, quinta tanda)
- **Altura.** En escritorio (>900 px) el hero mide `min(100svh, 56.25vw)`: la foto 16:9 se ajusta al ancho sin ampliarse de más (equipo completo, aire sobre las cabezas, torsos visibles), con `object-position: 50% 30%`. Antes medía ~1090 px a 1440 y la foto se ampliaba ~1.5×.
- **Texto.** Etiqueta y título (máx. 2 líneas) arriba sobre el muro; subtexto y botones abajo sobre la zona difuminada (piernas); `--fs: clamp(1.5rem, 3.3vw, 3.2rem)`. El HTML (ES y EN) agrupa el texto en `.hero-copy-top` y `.hero-copy-bottom`. ≤900 px sin cambios.
- **Pruebas.** `qa:hero` pasa a 1920, 1440, 1024 y 390 (ES y EN). El tamaño de la cabeza ya no depende del alto de la ventana sino solo del ancho: la cabeza más grande (rizado) mide ~20 % del alto de la foto con 1 % de margen en `hero-safe.json` (~17 % sin margen), no 12-14 %; bajarlo más exige una foto con más aire o encuadre más abierto. Capturas: `qa/screens/hero-safe-*` y `hero-seams-*`.
