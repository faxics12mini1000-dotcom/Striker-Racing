# AR («Ver en tu mesa») y sección Aerodinámica (CFD)

## 1. Ver en tu mesa (realidad aumentada)

**Qué es.** Un botón en `/auto/` y `/en/car/` (junto a los botones del encabezado) que abre un cuadro con el SR-26 en `<model-viewer>` y, en teléfonos compatibles, lo coloca sobre una superficie real **a escala 1:1** (`ar-scale="fixed"`: el visitante no puede agrandarlo).

**Cómo está hecho.**
- `js/ar.js` (~2 KB) decide si mostrar el botón. Está **oculto** y solo aparece si el dispositivo puede hacer AR: Android con WebXR `immersive-ar` o Scene Viewer, o iPhone/iPad con Safari (Quick Look). En escritorio no aparece.
- `<model-viewer>` **no viene de un CDN**: `npm run vendor:model-viewer` copia la versión de npm (Apache-2.0) a `vendor/model-viewer/<versión>/model-viewer.min.js` (la carpeta lleva la versión porque se sirve con caché de un año). Se descarga **solo al pulsar el botón** (~285 KB gzip), igual que el GLB de AR.
- El modelo es `assets/models/sr26-ar.glb` (ver `docs/PIPELINE_GLB.md`): **sin meshopt ni cuantización**, con materiales PBR horneados desde `data/livery.json`; mide 0.208 m, que es el tamaño real del auto en metros.
- `build-viewer.mjs` estampa en el botón `data-ar-model` (con hash de versión) y `data-ar-usdz`.
- `model-viewer` solo pide decodificadores a gstatic si el GLB trae Draco/KTX2; el de AR no los trae, así que no hay peticiones a terceros.

**Cómo probarlo.**
1. Publica el sitio (Vercel) o expón el servidor local con HTTPS (p. ej. `npx localtunnel --port 8099` o `ngrok http 8099`): Scene Viewer y Quick Look **exigen HTTPS**; `http://localhost` solo sirve en el propio equipo.
2. **Android** (Chrome, con «Servicios de Google Play para RA» instalado): abre `/auto/`, toca **Ver en tu mesa** → **Abrir en AR**. Debe abrirse Scene Viewer o la vista WebXR; mueve el teléfono hasta detectar el piso y toca para colocar. Comprueba el tamaño contra una regla: el auto mide ~21 cm de largo.
3. **iPhone/iPad** (Safari, iOS 12+): mismo flujo; model-viewer genera al vuelo un USDZ desde el GLB y abre Quick Look. Si ves el auto sin colores o sin franja verde, usa el plan B.
4. Chrome/Firefox en iOS **no** soportan Quick Look: el botón no aparece (o, si aparece, el cuadro avisa que no hay AR).

**Plan B para iOS (USDZ).** Quick Look solo abre USDZ; model-viewer lo exporta del GLB automáticamente, pero ese USDZ puede perder detalles. Si pasa:
1. Convierte `assets/models/sr26-ar.glb` a USDZ con **Reality Converter** (Apple, gratis, macOS) o `usdzconvert`/`gltf2usd`; revisa los colores en un iPhone.
2. Guarda el resultado como `assets/models/sr26.usdz`.
3. Corre `npm run build:viewer`: detecta el archivo y estampa `data-ar-usdz="/assets/models/sr26.usdz?v=…"`; `js/ar.js` lo pasa como `ios-src` y Quick Look usa tu USDZ en lugar del generado.
4. Añade el tipo `.usdz` (`model/vnd.usdz+zip`) si algún día cambias de alojamiento (Vercel ya lo sirve bien).

**Aviso.** Es un prototipo visual; el diálogo lo dice. No hay pruebas en dispositivo real incluidas en este repositorio (el navegador de pruebas no tiene ARCore ni Quick Look): `qa/ar-cfd.test.mjs` verifica la lógica (botón oculto/visible, carga bajo demanda, sin CDN, escala fija, GLB cargando), no la sesión de AR en sí.

## 2. Sección «Aerodinámica» (CFD)

**Qué es.** Una sección al final de `/auto/` y `/en/car/` con una imagen o video del análisis, el método en una línea y una tabla de iteraciones (versión, resultado, fecha). **Está controlada por `data/cfd.json`: si el archivo está vacío, la sección no existe en el HTML.** Mientras no haya un CFD corrido, déjalo vacío (ver `CAMBIOS_PARA_EL_EQUIPO.md` sobre la frase «se valida en Ansys Student CFD»).

**Cómo llenarla.**
1. Guarda la imagen o el video en `assets/cfd/` (WebP/AVIF para imagen; MP4 H.264 corto para video). Máximo razonable: 300 KB la imagen.
2. Edita `data/cfd.json`:

```json
{
  "media": { "type": "image", "src": "/assets/cfd/v1-presion.webp", "width": 1600, "height": 900,
             "alt": { "es": "Mapa de presión del SR-26 v1", "en": "SR-26 v1 pressure map" },
             "caption": { "es": "Presión sobre el cuerpo, v1", "en": "Pressure on the body, v1" } },
  "method": { "es": "Ansys Student (Discovery), aire a 20 m/s, malla de N celdas", "en": "Ansys Student (Discovery), air at 20 m/s, N-cell mesh" },
  "iterations": [
    { "version": "v1", "result": { "es": "Arrastre de X N", "en": "Drag of X N" }, "date": "2026-12-01" }
  ]
}
```
   (video: `"type": "video"`, `"src": "/assets/cfd/v1.mp4"`, `"poster": "/assets/cfd/v1.webp"`). **Solo escribe datos reales de simulaciones corridas.** Cada texto va en español e inglés; el script avisa si falta uno.
3. Corre `npm run build:content` y revisa `/auto/` y `/en/car/`. Haz commit de `data/cfd.json`, `assets/cfd/` y los dos HTML.
4. Para ocultarla de nuevo: deja `"media": null, "method": null, "iterations": []` y corre `npm run build:content`.
