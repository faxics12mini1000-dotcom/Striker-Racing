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
- [ ] **Cupos por nivel**: se quitaron los contadores de cupos (eran valores de ejemplo, no decisión del equipo). Si se
      definen cupos reales por nivel, agregarlos de nuevo.
- [ ] **Material de patrocinio**: el CTA "Escríbenos" abre WhatsApp con un mensaje
      prellenado pidiéndolo; no existe todavía un PDF de dossier adjuntable. Si se genera un PDF,
      se puede enlazar directamente en vez de pedirlo por WhatsApp.
- [ ] **Página /privacidad.html**: se creó como placeholder de aviso de privacidad con la
      información de contacto ya conocida (correo, WhatsApp) y sin recopilación de datos personal
      más allá de lo que el visitante decide enviar por correo/WhatsApp. Debe revisarla alguien con criterio legal antes de tratarla como
      aviso de privacidad definitivo.
- [ ] **Traducción /en**: hecha por el asistente (no es traducción profesional certificada).
      Conviene que alguien bilingüe del equipo la revise antes de compartirla con patrocinios
      internacionales.
- [ ] **Perfiles ampliados de cada integrante** (rol, responsabilidades, herramientas): se
      completó con base en el "badge" de rol ya existente en cada tarjeta + las herramientas ya
      mencionadas en `#herramientas`. Son inferencias razonables, no biografías dictadas por cada
      integrante — deben revisarlas y ajustarlas ellos mismos (ver modal de cada tarjeta).
- [ ] **og-share.png**: imagen para compartir con el logo (se genera con `node scripts/generate-og-image.mjs`). Sustituir por una foto o render del monoplaza terminado cuando exista.

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
- El menú perdió "Herramientas" y "Contacto" (el CTA "Escríbenos" cubre el contacto).
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

- **Visor 3D (mantenimiento)**: `/auto/` y `/en/car/` cargan un cargador mínimo (`js/stage.js`, 1.4 KB) y, solo cuando toca, el visor (`js/viewer.js`),
  ambos con hash en `js/dist/`. Si se toca `js/viewer.js`, `js/stage.js`, `js/car-look.js` o el modelo, correr en este orden: `npm run bake:glb`
  (solo si cambió el GLB: hornea normales), `npm run build:viewer` (empaqueta y estampa los hashes en el HTML) y, con
  `node scripts/dev-server.mjs` activo, `node scripts/generate-poster.mjs` (regenera los tres posters `assets/img/car-poster-{desktop,tablet,phone}.webp`
  capturando el visor real). El entorno de luz se rehace con `npm run bake:env`. `npm run measure:viewer` mide el arranque.
- **Video de Fusion para el teléfono (hueco listo, falta el video)**: en pantallas ≤ 560 px el sitio muestra el póster y, si existe el video,
  lo reproduce solo con wifi (donde el navegador informa el tipo de red; en iPhone solo al tocar "Ver video"); "Explorar en 3D" carga el visor.
  Sin video, el teléfono carga el 3D como siempre. Con ahorro de datos o 2G, en cualquier pantalla, se muestra el póster y un botón "Ver en 3D".
  Para activarlo: guardar `assets/video/sr26-phone.mp4` (y, opcional, `sr26-phone.webm`), correr `npm run build:viewer` y hacer commit. Especificaciones:
  animación de despiece de 5 a 8 s en bucle sin corte, **vertical 4:5 (720×900)**, **sin audio**, fondo liso `#0E223D` (el del visor), el auto centrado y con aire
  arriba y abajo; MP4 H.264 ≤ 1 MB y WebM VP9 ≤ 700 KB. Ejemplo: `ffmpeg -i render.mov -an -vf scale=720:900 -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart sr26-phone.mp4`
  y `ffmpeg -i render.mov -an -vf scale=720:900 -c:v libvpx-vp9 -crf 38 -b:v 0 sr26-phone.webm`.
- **Niveles de patrocinio**: precios y beneficios siguen el folleto del equipo (Folleto_STEM_racing.pdf). El configurador de logo y el
  diagrama de zonas se quitaron por ahora (usaban el auto anterior). Fecha límite en la web: 23 de noviembre.
- **Visor 3D en pestañas ocultas**: el loop de render se pausa con la pestaña oculta y fuera de
  viewport (intencional). En herramientas de automatización que reportan
  `document.visibilityState === "hidden"` permanente, el visor no arrancará.
- Los commits `chore(build)`, `perf(assets)` y `feat(site)` iniciales no llevan la línea
  Co-Authored-By; los siguientes sí.

## Revisión del 3-oct-2026 (reglamento Development 2026-27, edades 11–19)

- Categoría corregida de Entry a **Desarrollo (Development)**; masa mínima del auto 50 g -> **60 g** (D3.5). Longitud 170–210 mm y cartucho de 8 g coinciden con el reglamento.
- El modelo 3D incluye ya el **halo (13)** y el **casco (14)**, piezas estándar obligatorias (D4.3 y D4.4). Salen de `scripts/source/13_Halo.stl` y `14_Casco.stl`;
  `scripts/build-sr26-glb.mjs` los coloca (tabla `PLACE`) y los simplifica. **La posición es una estimación visual**: el halo con sus espigas en x = 130 y 170 mm y la base a 24.5 mm, el casco centrado.
  Hay que cotejarla con el Fusion del equipo: la muesca circular del halo debe quedar a 34.0 ± 1.0 mm de la pista (D4.3.3).
- Halo visible (D4.3.2): nada debe tapar el halo en vista frontal, lateral y superior. Se quitó la espina morada del modelo (`SKIP` en `scripts/build-sr26-glb.mjs`); el logo de Striker pasó al costado del cuerpo.
- El casco se movió 7 mm hacia atrás dentro del aro del halo (primero quedaba pegado al pilar delantero); su frente (visor y barbilla) apunta hacia +x, al frente del auto. Verificar contra el CAD.
- **Logo STEM Racing** (D1.14, D4.5): ahora es el logo oficial en vector (`js/stem-logo.js` y `assets/img/stem-racing-logo.svg`, extraídos de la guía de marca oficial: rótulo con las letras oficiales y emblema SR), sin imagen ni fondo, 30 mm de largo en la zona B. **Ojo:** el reglamento pide la calcomanía oficial (30 × 15 mm sobre vinilo blanco o negro con filete de 1 mm); en el auto físico va esa calcomanía, que entrega STEM Racing en el registro o se imprime con su arte oficial.
- Patrocinios: **solo Partner Estratégico tiene lugar en el auto** (nariz y, opcional, alerón trasero). Aliado Técnico ya no promete logo en el auto; su segundo beneficio ("Presencia: Pit Display destacado, memoria técnica, reporte por etapa") es una propuesta, confirmarla con el equipo.
- El video `video/sr26-despiece.mp4` se hizo con el modelo anterior (sin halo ni casco); hay que volver a renderizarlo.

## Patrocinio del nivel más alto (3-oct-2026)

- Partner Estratégico (+ $10,000) es el único nivel con lugar en el auto y el más negociable. Espacios dibujados en el visor y el mapa: A nariz, C alerón trasero (2 recuadros), y a negociar: D alerón delantero (a cada lado de la nariz), E placas traseras, F tramo delantero de los pontones. Se pueden ofrecer más (placas delanteras, halo) y activaciones.
- Meta de la temporada: $65,450 MXN, con aportaciones de todos los tamaños. Una mezcla de ejemplo (a ajustar con el equipo): 1–2 Partner ($10–15 mil c/u), 3 Aliado Técnico (~$7 mil), 4 Impulsor (~$4 mil), 6–8 Colaborador (~$2 mil) y en especie.
- Aliado Técnico, Impulsor y Colaborador ya no incluyen el auto; sus beneficios son uniforme, Pit Display y reportes.
