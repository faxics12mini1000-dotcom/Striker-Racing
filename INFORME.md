# Informe (parcial: se alcanzó el límite de uso antes de cerrar la fase 8)

Rama `mejoras/ui-3d-v1`, un commit por fase, sin push. Ver `AUDITORIA.md`, `CAMBIOS_PARA_EL_EQUIPO.md`, `README.md` y `docs/`.

- Fase 1: bug de `.reveal` corregido (`qa/reveal.test.mjs`), SEO (404, favicon.ico, manifest, og por página, sitemap, JSON-LD), AVIF/WebP, presupuesto de peso (`npm run check:budget`).
- Fase 2: inicio con foto + SR-26 3D, franja de datos calculados, botón fijo Patrocinar.
- Fase 3: canalización del GLB (`npm run build:model`), `docs/PIPELINE_GLB.md`.
- Fase 4: visor con teclado, vistas, foto PNG, compartir, plano técnico, numeración.
- Fase 5: zonas A–D, configurador de logo, calcomanías del visor corregidas.
- Fase 6: AR (model-viewer autoalojado) y sección CFD (`docs/AR_Y_CFD.md`).
- Fase 7: bitácora, muro, analítica (apagados), dossier A4 (`docs/CONTENIDO.md`).
- Fase 8: pruebas en `qa/` (`npm run qa`), capturas en `qa/screens/`, verificadores de enlaces y paridad.

Lighthouse móvil (último run, local): 97 / 97 / 98 / 98 en inicio ES/EN y auto ES/EN; 95–99 en las demás; accesibilidad, buenas prácticas y SEO en 100.

Pendiente: re-correr `npm run qa` completo tras los últimos cambios, regenerar `qa/lighthouse/` final y redactar capturas/riesgos en este informe.
