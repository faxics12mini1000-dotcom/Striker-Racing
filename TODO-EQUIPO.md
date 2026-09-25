# TODO para el equipo — pendientes que requieren datos reales

Este archivo se actualiza durante la reestructuración del sitio (sep. 2026). Enumera lo que
**no se puede inventar** y necesita que el equipo lo proporcione, más las decisiones de
diseño/copy que se tomaron por default y conviene revisar.

## Datos reales pendientes

- [ ] **Fotos del equipo**: se dejaron monogramas de iniciales (placeholder) en las tarjetas de
      `#equipo`, listos para sustituirse por foto. Cuando haya fotos, reemplazar el bloque
      `.pass-photo` de cada integrante (y del mentor) por `<img>`.
- [ ] **Meta de recaudación real**: la barra de progreso de `#presupuesto` lee de un objeto de
      configuración (`window.STRIKER_CONFIG.funding`, ver `js/config.js`). Se dejó `meta: 65450`
      (el presupuesto total calculado en `#presupuesto`) y
      `recaudado: 0` porque no hay cifra real de lo ya recaudado. Actualizar `recaudado` en cuanto
      se tenga un monto verificado.
- [ ] **Disponibilidad de cupos por nivel de patrocinio**: se reemplazó "Cupo abierto" (igual en
      los 4 niveles, no aportaba información) por un contador de disponibilidad por zona, leído
      también de `window.STRIKER_CONFIG.sponsorTiers[].availability` (texto libre, ej. "3 de 5
      espacios disponibles"). Se dejaron valores de ejemplo razonables; confirmar cupos reales por
      nivel (uniforme y auto tienen espacio físico limitado).
- [ ] **Dossier ejecutivo**: el CTA "Solicitar dossier ejecutivo" abre WhatsApp con un mensaje
      prellenado pidiéndolo; no existe todavía un PDF de dossier adjuntable. Si se genera un PDF,
      se puede enlazar directamente en vez de pedirlo por WhatsApp.
- [ ] **Página /privacidad.html**: se creó como placeholder de aviso de privacidad con la
      información de contacto ya conocida (correo, WhatsApp) y sin recopilación de datos personal
      más allá de lo que el visitante decide enviar por correo/WhatsApp/el configurador (que no
      sube nada a servidor). Debe revisarla alguien con criterio legal antes de tratarla como
      aviso de privacidad definitivo.
- [ ] **Traducción /en**: hecha por el asistente (no es traducción profesional certificada).
      Conviene que alguien bilingüe del equipo la revise antes de compartirla con patrocinios
      internacionales.
- [ ] **Perfiles ampliados de cada integrante** (rol, responsabilidades, herramientas): se
      completó con base en el "badge" de rol ya existente en cada tarjeta + las herramientas ya
      mencionadas en `#herramientas`. Son inferencias razonables, no biografías dictadas por cada
      integrante — deben revisarlas y ajustarlas ellos mismos (ver modal de cada tarjeta).
- [ ] **og-preview.png**: regenerada en la nueva paleta (azul/verde, sin morado) con un script en
      `scripts/`, pero sigue siendo un layout genérico de marca — no una fotografía real del auto
      terminado. Sustituir cuando haya una fotografía o render final del monoplaza pintado.

## Auditoría del 24-sep-2026 (comparación commit 8a506d2 vs. HEAD)

Corregido:
- `/en/`: los 5 scripts se cargaban con ruta relativa incorrecta (404) -> sin visor 3D, sin menú, sin revelado de secciones.
- Visor 3D del hero: no llenaba su contenedor (`aspect-ratio` en item de grid) y dejaba un hueco vacío bajo el auto.
- Diagrama de zonas de logo: nunca aparecía (`.card-reveal` fuera de `.pass-grid`/`.tiers` no se observaba) y ocultaba el botón del configurador.
- Enlaces ancla del menú (#equipo, #presupuesto…) aterrizaban lejos del destino por `content-visibility:auto` (bug ya presente en 8a506d2). Se quitó de las secciones.
- Móvil: el footer en 3 columnas desbordaba el ancho (scroll horizontal); marcadores del timeline con número encimado; menú desplegable translúcido.
- Diálogos (configurador) pegados a la esquina superior izquierda (faltaba `margin:auto`).
- `equipo.html` y `patrocinios.html` (y `/en/`) duplicaban secciones de `index.html` y nada enlazaba a ellas: se eliminaron y `vercel.json` las redirige a `/#equipo` y `/#patrocinios`. Recuperables desde git (commit 5e195da).
- Se agregaron `robots.txt` y `sitemap.xml`.

Diferencias de diseño respecto a 8a506d2 que conviene que el equipo confirme:
- El hero ya no muestra "5 integrantes / 2027" ni la barra de meta de patrocinio (esta queda solo en `#presupuesto`).
- Los modales de perfil por integrante se sustituyeron por el visor de credenciales (PDF).
- El menú perdió "Herramientas" y "Contacto" (el CTA "Solicitar Dossier" cubre el contacto).
- Rendimiento: 8a506d2 inlineaba CSS/JS; ahora son archivos externos (más peticiones). En pruebas locales con throttling el LCP es ruidoso (2.6–8 s en ambas versiones); medir en PageSpeed sobre el deploy real.

## Decisiones tomadas por default (documentadas para que el equipo las pueda revertir)

- Paleta: se eliminó el morado (`--purple`) de toda la UI y del material del auto 3D. Se
  introdujo `--blue-accent:#2A6DF5` como color de acento (antes ocupaba el morado). El verde
  esmeralda (`--emerald`) se mantiene igual.
- Se quitaron los dos `radial-gradient` decorativos (halo detrás del hero y del visor 3D); el
  resto de "gradientes" que quedan en el CSS son degradados de líneas duras de 1px que dibujan la
  cuadrícula de plano técnico (`.blueprint`, `.hero::before`) — es el motivo de diseño central del
  sitio (estética de plano/ficha técnica), no un "glow", así que se conservaron.
- "Correo institucional" se acortó a "Correo" en los CTA de patrocinio (pedido explícito).
- Rangos de patrocinio ajustados a $1,500–2,999 / $3,000–5,999 / $6,000–9,999 / $10,000+ para que
  no se traslapen (antes compartían el número exacto de corte, ej. ambos extremos en $3,000).
- "Kit oficial F1SRMX" y cualquier otra referencia a "F1SRMX" se cambiaron a "STEM Racing México"
  (nombre vigente de la competencia).

## Rendimiento y auditoría (Lighthouse móvil, servidor local con gzip + cache como en Vercel)

| Categoría | Antes (commit 2c65eda) | Después |
|---|---|---|
| Performance | 35 | 91–96 (mediana ~93, 5 corridas) |
| Accesibilidad | 94 | 100 |
| Buenas prácticas | 100 | 100 |
| SEO | 100 | 100 |

- LCP 13.3 s -> ~2.1 s; TBT 2,310 ms -> 150–280 ms; CLS 0 -> 0.
- **La meta de 95+ en Performance no se alcanza de forma consistente** en local: el costo restante
  es un layout inicial de ~400 ms en esta máquina (sin un elemento único que lo domine; se
  descartó con bisección: fuentes, clip-path, cuadrículas, scripts, hero, secciones). Conviene
  volver a medir sobre el deploy real en Vercel (PageSpeed Insights); el resultado local varía
  ±3 puntos entre corridas.
- Lo que sí se hizo: three.js/GLB lazy + poster, GLB 1.5 MB -> 390 KB, fuentes autoalojadas
  (`fonts/`, `npm run vendor:fonts`) en vez del CSS bloqueante de Google Fonts, logo pequeño
  (`logo-64.webp`), `content-visibility:auto` bajo el fold, spinner solo mientras carga, y
  `vercel.json` con Cache-Control para fuentes/vendor/imágenes.
- No se auditó `/en` por separado (mismo código y assets).

## Notas técnicas para quien mantenga el sitio

- **Regenerar `car-poster.webp`** si cambia el modelo/librea: abrir el sitio, capturar el canvas
  del visor (necesita `preserveDrawingBuffer:true` temporal en el renderer) como PNG con alpha y
  correr `node scripts/generate-poster.mjs <captura.png>`.
- **Configurador de logo**: la placa del decal usa `DoubleSide`, así que visto desde el lado
  "trasero" el logo puede verse en espejo, y la posición por zona es aproximada (plano flotante
  cerca de la superficie, no un decal proyectado). Sirve para tamaño/color/ubicación relativa, no
  como render final. Para niveles solo de uniforme (Colaborador/Impulsor) no hay modelo 3D de
  uniforme: se previsualiza sobre el auto como referencia.
- **Visor 3D en pestañas ocultas**: el loop de render se pausa con la pestaña oculta y fuera de
  viewport (intencional). En herramientas de automatización que reportan
  `document.visibilityState === "hidden"` permanente, el visor no arrancará.
- Los commits `chore(build)`, `perf(assets)` y `feat(site)` iniciales no llevan la línea
  Co-Authored-By; los siguientes sí.
