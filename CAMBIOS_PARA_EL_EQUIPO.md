# Cambios para el equipo (decisiones que no se tomaron por ustedes)

Todo lo que toca contenido que el equipo se reservó (niveles, precios, FAQ, contactos, mentor, logo, rutas, textos fiscales, afirmaciones técnicas) **no se editó**; se propone aquí con el texto actual, el texto propuesto y la razón. Al final, las decisiones por defecto que sí se tomaron en el código y que conviene confirmar.

## A. Propuestas de texto (no aplicadas)

### A1. «se valida en Ansys Student CFD» (prioridad alta · regla E)
- **Dónde:** `/auto/` y `/en/car/`, nota del panel de cotas (`.hud-disclaimer`).
- **Texto actual (ES):** «*Prototipo visual del SR-26. El monoplaza se modela bajo normativa técnica en Autodesk Fusion 360 y **se valida en Ansys Student CFD**; el diseño final puede variar.»
- **Texto actual (EN):** «*Visual prototype of the SR-26. The car is modeled under the technical regulations in Autodesk Fusion 360 and **validated in Ansys Student CFD**; the final design may change.»
- **Propuesto (ES):** «*Prototipo visual del SR-26. El monoplaza se modela en Autodesk Fusion 360 con base en el reglamento técnico; el análisis aerodinámico en Ansys Student CFD está planeado y se mostrará aquí cuando haya resultados. El diseño final puede variar.»
- **Propuesto (EN):** «*Visual prototype of the SR-26. The car is modeled in Autodesk Fusion 360 based on the technical regulations; the aerodynamic analysis in Ansys Student CFD is planned and will be shown here once there are results. The final design may change.»
- **Razón:** hoy no hay un CFD corrido; afirmar que «se valida» es una afirmación de cumplimiento/validación que un patrocinador o un juez puede pedir comprobar. Cuando exista, llenar `data/cfd.json` (la sección *Aerodinámica* aparece sola) y volver al texto actual.
- **Otras frases del sitio con el mismo riesgo (revisar, no se tocaron):** home, tarjeta de Carlo: «Simulación y validación aerodinámica en CFD»; home, mentor: cita sobre «la validación en CFD» (la cita del mentor no se edita); `/presupuesto/`, Stack técnico: «Simulamos el flujo de aire sobre el auto antes de fabricar cada versión» (se puede dejar si se refiere al plan de trabajo, o cambiar a «Simularemos…» hasta que haya resultados).

### A2. Partner Estratégico y el Pit Display (configurador de marca)
- **Dónde:** maqueta del Pit Display del configurador (`/auto/#configurador`).
- **Hoy:** el nivel Partner Estratégico no menciona el Pit Display en sus beneficios («Uniforme», «Auto», «Activación y merch», «A la medida»). La maqueta lo dibuja con un panel central y la leyenda «A la medida / Tailor-made», sin prometer tamaño ni ubicación.
- **Propuesto:** confirmar si el Partner tiene presencia en el Pit Display. Si sí, añadirlo al nivel en las páginas de Patrocinios (texto del equipo); si no, quitar la maqueta del Pit Display para ese nivel (`data/zonas.json` → `pit`).
- **Razón:** no inventar un beneficio que no está escrito.

### A3. Aviso de privacidad (solo propuesta; `privacidad.html` no se modificó)
Hoy el aviso dice que «no usa cookies de rastreo ni herramientas de analítica de terceros». Sigue siendo cierto mientras `data/analytics.json` esté apagado. **Si se enciende la analítica o se quiere ser explícito sobre las funciones nuevas, añadir:**

- **Propuesto (ES), nueva sección «Analítica, configurador y realidad aumentada»:**
  «Si activamos la analítica, contamos únicamente eventos agregados (por ejemplo, cuántas veces se pulsa un enlace de WhatsApp o se usa el configurador), junto con la página y el idioma. No usamos cookies, no guardamos identificadores ni direcciones IP en el sitio y respetamos la señal «No rastrear» de tu navegador. El **configurador de marca** procesa tu logo únicamente en tu navegador: el archivo no se envía ni se guarda en ningún servidor. La función **Ver en tu mesa** descarga el modelo 3D desde este sitio y, según tu teléfono, lo abre con Google Scene Viewer o Apple Quick Look, aplicaciones de esos proveedores que se rigen por sus propias políticas de privacidad.»
- **Propuesto (EN):**
  «If we enable analytics, we only count aggregated events (for example, how many times a WhatsApp link is clicked or the configurator is used), together with the page and language. We do not use cookies, we do not store identifiers or IP addresses on the site, and we honor your browser’s “Do Not Track” signal. The **brand configurator** processes your logo only in your browser: the file is never sent to or stored on any server. The **See it on your table** feature downloads the 3D model from this site and, depending on your phone, opens it with Google Scene Viewer or Apple Quick Look, apps from those providers governed by their own privacy policies.»
- **Razón:** transparencia y consistencia con lo que hace el sitio; requiere revisión de alguien con criterio legal (como ya señala `TODO-EQUIPO.md`).

### A4. Fotos del equipo: textos alternativos
Se conservaron los `alt` existentes. Si prefieren describir mejor la foto de grupo para lectores de pantalla («Los cinco integrantes y su mentor de pie frente a un muro de bloques»), cambiar el `alt` de `/team/grupo.webp` en ambos idiomas (hoy: «Integrantes de Striker Racing junto con su mentor, Preparatoria Celta»).

### A5. Texto de beneficios que promete ubicación (NO editado; decide el equipo)
El sitio ahora presenta las ubicaciones en el auto como **ideas** («podría ir en…», «el diseño final se acuerda con el equipo»). Estas frases de beneficios decididas por el equipo suenan más firmes y chocan con ese tono; no se tocaron:
- **Partner Estratégico, «Auto»** (`/patrocinios/`, `/en/sponsorship/`, dossier): «es el único nivel con lugar en el auto: nariz / trompa frontal y alerón trasero, más alerón delantero según propuesta». *Propuesto:* «contempla lugar en el auto (ideas: nariz, alerón trasero, alerón delantero, cápsula); la ubicación final se acuerda con el equipo».
- **Uniforme, todos los niveles** («logotipo en cuadrante inferior de espalda», «patrocinador central en el pecho», etc.): el configurador los marca como «ubicaciones de ejemplo». *Propuesto:* anteponer «ejemplo:» o «según propuesta» si no están confirmadas con el proveedor del uniforme.
- **«Tu logo va en un proyecto real de ingeniería»** (Patrocinios, encabezado de beneficios): es figurativo, no una ubicación; se puede dejar.
- **«fotos del pit display con tu marca»** (FAQ de reportes): promete una foto con la marca; confirmar que el Pit Display llevará a todos los patrocinadores.
- **Zona B (pontones):** el reglamento la reserva al logo oficial de STEM Racing. Se muestra solo como idea de ejemplo y con esa aclaración; si prefieren no mostrarla, quitar la zona `B` de `data/zonas.json` (`carZones`) y su fila en las páginas.

### A6. Halo y casco aún no están modelados
El reglamento Development 2026–27 exige halo y casco, y el sitio lo afirma. **El SR-26 3D que se muestra todavía no los incluye: falta el CAD oficial.** El visor ya está listo para mostrarlos si el GLB trae `13_Halo` / `14_Casco` (ver B1). Mientras tanto, el prototipo visual debe seguir presentándose como tal.

### A7. Categoría
El equipo compite en **Desarrollo (Development), Bachillerato**. Se revisaron ES/EN, meta, OG, JSON-LD, dossier, `data/*.json` y README: todas las menciones dicen Desarrollo/Development y no queda ninguna a «Entry» (la única aparición de «entry fee» en `/en/` es la cuota de inscripción). No se cambió nada.

## B. Decisiones de código que conviene confirmar (sí aplicadas, fáciles de revertir)

| # | Qué se hizo | Por qué | Cómo revertir |
|---|---|---|---|
| B1 | **Halo y casco ya no se ocultan por regla en el visor.** Si el GLB trae `13_Halo` / `14_Casco`, aparecen (armado, despiece, numeración). Hoy el GLB no los trae, así que nada cambia. | Lo pidió el encargo; antes `HIDDEN` los ocultaba aunque vinieran. El reglamento los exige en el auto real (TODO-EQUIPO, 3-oct). | `HIDDEN = new Set(['13'])` en `js/car-look.js` |
| B2 | **Las calcomanías (logos) del visor ahora sí se pegan.** Estaban silenciosamente ausentes: el visor centraba el auto antes de calcularlas y ningún rayo golpeaba la pieza. Ahora se ven la espina con el logo de Striker, los recuadros «PARTNER ESTRATÉGICO» (A, C, D) y el logo de STEM Racing en los pontones (B), exactamente como el mapa de Patrocinios. | Corrección de un defecto; el zonificado y el configurador dependen de ello. | Es corrección; revisar que el aspecto les guste (los pósters se regeneraron). |
| B3 | **En teléfono el 3D arranca al tocar «Explorar en 3D»** (salvo wifi confirmado). En escritorio arranca solo. El póster es idéntico al primer cuadro. | Lighthouse móvil de `/auto/` pasó de 48 a 90+; ahorra ~1 MB y CPU a teléfonos modestos. | `js/stage.js` (condición `phone && !wifi`) |
| B4 | **Inicio:** foto del equipo y SR-26 3D en el encabezado; botón principal = «Ver patrocinios», secundario = «Conocer la escudería» (antes al revés). Se quitó la foto a todo ancho y el bloque Integrantes/Mentor/Categoría/Temporada de la sección Equipo: los datos pasaron a la franja del encabezado (Integrantes y Mentor contados del HTML; piezas y largo medidos del GLB). Categoría y temporada siguen en el texto del encabezado. | Pedido del encargo; evitar duplicados. | `git revert` del commit «feat(inicio)» |
| B5 | **Botón fijo «Patrocinar»** (menú de escritorio y barra flotante en móvil) hacia Patrocinios; «Escríbenos» (WhatsApp) pasa a botón de contorno. | Pedido del encargo. | Quitar `.is-sponsor` y `#stickyCta` de los HTML |
| B6 | **Presupuesto de contenido nuevo (todo apagado):** bitácora, muro de patrocinadores, CFD y analítica no muestran nada hasta que se llenen sus archivos. | Regla C. | — |
| B7 | **Degradados que ya existían y no se tocaron:** retícula de plano técnico (líneas de 1 px) y su fundido en cabeceras (`mask-image`); scrim bajo el texto de las tarjetas del equipo (`.paddock-pass::before`); relleno del deslizador del visor. No se añadió ninguno nuevo (las imágenes para compartir se rehicieron planas). | La regla B pide estética plana; esos son legibilidad/retícula, decisión del equipo. | Si prefieren cero degradados: sustituir el scrim por un panel navy sólido bajo el texto de cada tarjeta. |
| B8 | **`vercel.json` y `.vercelignore`** (archivos del repo, no ajustes del panel de Vercel): cabeceras de caché para `/team/`, favicons, sitemap y `/vendor/model-viewer/`, cabeceras de seguridad básicas (`nosniff`, `Referrer-Policy`, `Permissions-Policy`) y exclusión de `qa/`, `docs/`, `data/` y los `.md` del despliegue. | Rendimiento y SEO. Los ajustes del panel (dominio, DNS, proyecto) no se tocaron. | `git revert` / editar el archivo |
| B9 | **`sitemap.xml` ya no lista `privacidad.html`** (lleva `noindex`; era una contradicción). | SEO. | `scripts/build-sitemap.mjs` |
| B10 | **`data/zonas.json` repite los nombres de nivel** (Colaborador, Impulsor, Aliado Técnico, Partner Estratégico y sus equivalentes en inglés) para el configurador. `qa/parity.mjs` falla si dejan de coincidir con las páginas de Patrocinios. | El configurador vive en `/auto/`, que no contiene esos nombres. | — |
| B11 | **Traducción al inglés:** el texto nuevo (configurador, zonas, AR, plano técnico, dossier, mensajes) lo escribió el asistente; no es traducción certificada. | Igual que el resto de `/en/`. | Que alguien bilingüe del equipo lo revise antes de enviarlo a patrocinadores internacionales. |
| B12 | **Meta y recaudado:** sin cambios (`$65,450` y `$0`, `js/config.js`). | Regla A. | — |
| B13 | **Inicio:** el encabezado es ahora la foto del equipo a todo el ancho (mín. 88 % de alto de pantalla) con velo navy plano al 60 %, título abajo a la izquierda e indicador «Ver el auto»; el visor 3D del SR-26 va debajo, a ancho completo (mín. 80 % de alto). El texto y los botones son los de siempre. | Pedido del encargo. | `git revert` |
| B14 | **La foto del equipo mide 1280 × 720 px** (menos de 2000 px de ancho): a pantalla completa en monitores grandes se ve algo suave. No se escaló con IA. | Aviso. | Enviar una foto original ≥ 2400 px de ancho y correr `npm run build:images` |
| B15 | **Ubicación de logos = ideas.** Se quitaron los rótulos «PARTNER ESTRATÉGICO» pintados en el render; el botón «Ver zonas posibles» dibuja contornos punteados (A nariz, B pontones, C alerón trasero, D alerón delantero, E cápsula) y el configurador pone el logo en UNA zona elegida como ejemplo. Mapa de Patrocinios y pósters regenerados sin rótulos. | Pedido del encargo. | `js/car-look.js` (`blank`) |
| B16 | **Plano técnico:** se quitó la tarjeta sobre el modelo; los valores y la nota viajan en una línea debajo del visor. | Pedido del encargo. | `js/viewer.js` (`car-plan-line`) |
| B17 | **«Patrocinar» siempre visible** en el menú fijo (escritorio y móvil); se retiró la barra flotante inferior (era redundante). | Pedido del encargo. | Restaurar `#stickyCta` |

## C. Pendientes que solo el equipo puede resolver

- Un CFD corrido (para la sección Aerodinámica y para poder mantener afirmaciones sobre validación).
- Video de Fusion para teléfonos (ver `TODO-EQUIPO.md`), logos de patrocinadores reales y la primera entrada de bitácora.
- Probar «Ver en tu mesa» en un Android y un iPhone reales (`docs/AR_Y_CFD.md`); si en iPhone el USDZ automático pierde detalle, exportar el USDZ con Reality Converter (plan B documentado).
- Confirmar el endpoint de analítica (Plausible u otro) si deciden encenderla.

## D. Tercera tanda (3-oct): hero, original de la foto y deploy
- **Foto original del equipo:** soltarla como `assets/img/original/team.jpg` (idealmente 2560×1440 o más, 16:9) y correr `npm run build:images`. Si la proporción o el encuadre cambian, hay que volver a medir las caras en `data/hero-safe.json` (la prueba `qa/hero-safe.test.mjs` dirá si algo toca una cara). En la foto actual se ven 6 personas en el encuadre del hero, no 5: confirmar quién es quién.
- **Vercel:** el proyecto ahora instala solo `esbuild` y `three` y corre solo el empaquetado del visor. Lo generado (imágenes, OG, dossier, modelo, capturas) va commiteado; para regenerarlo en local: `npm run build:all`, `npm run build:images`, etc. Si en el panel de Vercel hay un *Build Command* o *Install Command* propio, el de `vercel.json` lo sustituye.
- **Copy en inglés:** el botón móvil del menú pasó de «Sponsor» a «Sponsor us» para igualar escritorio y el español («Patrocínanos»).
