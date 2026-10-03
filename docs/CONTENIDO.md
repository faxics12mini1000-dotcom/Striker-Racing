# Contenido que crece (apagado hasta que haya datos)

Todo lo de esta página se genera con `npm run build:content` a partir de archivos en `data/`. **Con el archivo vacío no hay ni una línea de HTML de esa sección.** Después de editar datos: `npm run build:content`, revisar en local (`npm run serve`) y hacer commit de `data/`, `assets/` y los HTML que cambien.

## Bitácora (`data/bitacora/*.md`)

Un archivo por entrada, nombrado `AAAA-MM-DD-nombre.md` (el nombre sin la fecha es la dirección: `/bitacora/nombre/` y `/en/log/nombre/`). Los que empiezan con `_` se ignoran. Plantilla:

```markdown
---
fecha: 2026-11-15
titulo_es: Primer corte del chasis
titulo_en: First chassis cut
resumen_es: Una línea para el listado y las vistas previas.
resumen_en: One line for the list and link previews.
imagen: /assets/bitacora/chasis.webp
alt_es: Chasis recién maquinado sobre la mesa
alt_en: Freshly machined chassis on the bench
---
Texto en español (Markdown: **negritas**, listas, enlaces, imágenes).

<!-- en -->
Text in English.
```

- `imagen`, `alt_es` y `alt_en` son opcionales (si pones imagen, pon el texto alternativo). Imágenes: WebP, en `assets/bitacora/`.
- Una entrada sin título/cuerpo en **ambos** idiomas se omite con un aviso.
- **Sin entradas**: no existen `/bitacora/` ni `/en/log/` y el menú y el pie no muestran el enlace. Con la primera entrada aparecen solos (también en el sitemap).
- Solo fotos reales y datos reales; nada de cifras o resultados que no se hayan medido.

## Muro de patrocinadores (`data/sponsors.json`)

```json
{ "show": true,
  "sponsors": [
    { "name": "Empresa", "logo": "/assets/sponsors/empresa.svg", "url": "https://empresa.com", "level": "partner" }
  ] }
```

- Se muestra en el inicio y en Patrocinios **solo si `show` es `true` y hay al menos un patrocinador**. Con `"show": false` (o vacío) está oculto; es el interruptor para publicar cuando el equipo quiera.
- `level`: `colaborador`, `impulsor`, `aliado` o `partner` (los nombres de nivel se toman de `data/zonas.json`, que repite los del sitio). Se agrupan del nivel más alto al más bajo.
- Logos en `assets/sponsors/` (SVG o PNG/WebP con fondo transparente). Solo patrocinadores reales que hayan aceptado aparecer. El enlace debe ser `https://` y se marca `rel="noopener sponsored"`.

## Dossier (`/dossier/`, `/en/dossier/`)

Se genera **desde las páginas Patrocinios y Presupuesto del sitio** (niveles, beneficios, meta, fecha límite, desglose, nota fiscal y contactos). No hay texto duplicado: si cambias un precio en el sitio, corre `npm run build:content` y el dossier lo recoge. Solo agrega rótulos de sección y un **QR** al WhatsApp de patrocinios. Son 2 hojas A4: abre la página y usa **Imprimir o guardar como PDF** (activa «Gráficos de fondo» si el navegador lo pide). Colores: solo tokens de `css/site.css`.

## Aerodinámica (`data/cfd.json`)

Ver `docs/AR_Y_CFD.md`. Vacía = oculta.

## Analítica (`data/analytics.json`)

Apagada por defecto. Ver `docs/ANALITICA.md`.
