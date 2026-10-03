# Canalización del modelo SR-26 (GLB)

El auto 3D sale de **Autodesk Fusion 360** y llega al sitio como tres archivos derivados de un solo GLB fuente. Todo se regenera con comandos; no se edita a mano ningún GLB.

| Archivo | Para qué | Cómo se hace |
|---|---|---|
| `assets/models/sr26.glb` | **Fuente** y GLB web (el que carga el visor): normales suavizadas horneadas, normales int8, compresión meshopt, ~295 KB | `scripts/bake-sr26-normals.mjs` |
| `assets/models/sr26-ar.glb` | **AR** («Ver en tu mesa»): **sin meshopt ni cuantización**, materiales PBR horneados desde `data/livery.json`, cuerpo y pontones partidos en zonas de color, escala 1:1 (metros), ~970 KB | `scripts/build-model.mjs` |
| `assets/img/car-poster-{desktop,tablet,phone}.webp` | Póster por render (lo que se ve antes de que cargue el 3D y sin WebGL) | `scripts/generate-poster.mjs` (captura el visor real) |
| `data/modelo.json` | Medidas calculadas del GLB (largo sin cartucho, ancho, alto, distancia entre ejes, piezas) | `scripts/build-model.mjs` |
| `data/hechos.json` | Datos de la franja del inicio (integrantes, mentor, piezas, largo) | `scripts/build-facts.mjs` |

El proceso es **idempotente**: si `sr26.glb` ya está procesado (meshopt + normales) no se vuelve a hornear; una exportación nueva de Fusion (sin meshopt) sí. `--force` obliga a rehornear.

## Re-exportar desde Fusion 360 conservando los prefijos numéricos

El visor, el despiece, las anotaciones y la librea identifican cada pieza por el **prefijo numérico del nombre del nodo**: `NN_Nombre` (dos dígitos, guion bajo, nombre sin espacios). **No renombres ni renumeres.** Si el nombre cambia, la pieza pierde su color, su movimiento de despiece y su nombre en pantalla.

Tabla vigente (nodo → pieza):

| NN | Pieza | NN | Pieza |
|---|---|---|---|
| 01 | Cuerpo | 12 | Pilar del alerón trasero |
| 02 / 03 | Pontón der. / izq. | **13** | **Halo (opcional)** |
| 04 | Nariz | **14** | **Casco (opcional)** |
| 05 | Alerón delantero | 15 | Cartucho de CO₂ |
| 06 | Soportes del alerón delantero (`…Soporte_Del_Der` / `…Soporte_Del_Izq`) | 16–19 | Ruedas: cada una con dos mallas, `__Llanta_*` y `__Rin_*` |
| 07 / 08 | Placas delanteras der. / izq. | 20 / 21 | Eje delantero / trasero |
| 09 | Alerón trasero | 22 / 23 | Guía delantera / trasera |
| 10 / 11 | Placas traseras der. / izq. | 24 | Espina |

Pasos:

1. En Fusion, exporta cada cuerpo como **STL** con el nombre `NN_Nombre.stl` (o, si exportas GLB/glTF directo, deja el nombre del componente igual: `NN_Nombre`).
2. Ensambla el GLB (hoy se hace con `scripts/build-sr26-glb.mjs` a partir de los STL en `scripts/source/`, carpeta fuera de git) con estas reglas: **metros**, **Y arriba**, **+X hacia el frente (la nariz)**, **un nodo por pieza** y el origen del auto en la cola/centro de ejes tal como está hoy (el visor centra el modelo solo).
3. Guarda el resultado como `assets/models/sr26.glb` (sustituye al actual).
4. Corre `npm run build:model`. Hace, en orden: hornea normales y comprime (web), genera `sr26-ar.glb`, valida ambos con **gltf-validator** (debe decir 0 errores), recalcula `data/modelo.json` y `data/hechos.json` y reempaqueta el visor (`js/dist/` con hash nuevo en las páginas).
5. Con el servidor local corriendo (`npm run serve`) o sin él, corre `npm run build:poster` para regenerar los pósters (y sellar sus versiones).
6. Revisa `/auto/` y `/en/car/` en local, haz commit de `assets/`, `data/`, `js/dist/` y los HTML tocados.

### Piezas opcionales: halo, casco, bujes y tubos de eje

- **13_Halo** y **14_Casco**: si el GLB las trae aparecen en el auto armado, en el despiece (etapa 4, suben con la espina) y en la numeración/anotaciones. Si no existen, no pasa nada. Ni el modelo ni este repositorio inventan su geometría ni sus medidas: solo se muestran si vienen de Fusion. (Antes el visor las ocultaba por decisión del equipo; esa regla se quitó y se anota en `CAMBIOS_PARA_EL_EQUIPO.md`.)
- **Bujes y tubos de eje**: cualquier nodo cuyo nombre contenga `Buje`/`Bushing` o `Tubo`/`Tube` se reconoce por nombre (da igual el número) y baja con los ejes en la etapa 1. Dale color/acabado en `data/livery.json` (`buje`, `tubo`, ya incluidos como opcionales).
- Una pieza con número que no esté en la tabla (por ejemplo `25_Algo`) se dibuja con acabado satín en el auto armado, pero no se mueve en el despiece ni aparece en la numeración; para sumarla al despiece agrégala a `PIECES` en `js/car-look.js` (nombre ES/EN, etapa y vector).

## Librea y colores (`data/livery.json`)

`pieces` asigna a cada id de pieza un **color** (nombre) y un **acabado**; `tokens` dice qué variable de `css/site.css` usa cada nombre (`navy → --navy-deep`, `green → --emerald`…). **La paleta se cambia en un solo lugar: `:root` de `css/site.css`.** El visor lee esos tokens en el navegador y `build-model.mjs` los lee al hornear el GLB de AR. Los `materials` (hule, aluminio, acero, latón) son colores físicos, no de marca. `zones` define las franjas del cuerpo y de la boca de los pontones (se aplican en el shader del visor y se hornean como zonas en el GLB de AR).

## Compatibilidad AR (por qué dos GLB)

`sr26.glb` usa `EXT_meshopt_compression` y `KHR_mesh_quantization`: excelente para web, pero Scene Viewer (Android) y la conversión a USDZ de Quick Look (iOS) no siempre aceptan esas extensiones. `sr26-ar.glb` va **sin extensiones requeridas** (se comprueba al construir: se relee sin registrar ninguna) y con materiales ya definidos (no hay shaders propios que las apps de AR ignorarían). Detalle de pruebas en `docs/AR_Y_CFD.md`.

## Póster

`generate-poster.mjs` abre `/auto/?still` (el visor congelado en su primer cuadro, sin animación) con Chrome/Edge headless, oculta todo salvo el canvas y guarda un WebP con transparencia por cada forma del visor (escritorio, tablet, teléfono). Es el mismo cuadro que verá el visitante cuando el 3D termine de cargar, por eso el cambio no se nota.
