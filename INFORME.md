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
