# Striker Racing · sitio web

Sitio de Striker Racing (escudería de Preparatoria Celta, STEM Racing México 2026–27), en español e inglés. Su objetivo es conseguir patrocinios. Es un **sitio estático**: el HTML se sirve tal cual (Vercel, `strikerracing.com`); los scripts de `scripts/` solo se usan para preparar archivos antes de hacer commit.

## Correr en local

Requisitos: Node 20+ (se probó con 24) y Chrome o Edge instalado (para pruebas, pósters e imágenes).

```bash
npm install
npm run serve          # http://localhost:8099  (gzip y caché como en Vercel; 404.html para rutas inexistentes)
```

Rutas: `/` · `/auto/` · `/presupuesto/` · `/patrocinios/` · `/dossier/` y en inglés `/en/`, `/en/car/`, `/en/budget/`, `/en/sponsorship/`, `/en/dossier/`.

## Construir (después de tocar datos, modelo o scripts del visor)

```bash
npm run build          # modelo → hechos del inicio → visor (js/dist) → contenido (CFD, bitácora, muro, dossier, sitemap) → sellos de imágenes
```

Piezas sueltas: `build:model` (GLB web + GLB de AR + validación), `build:poster` (pósters del visor, con el servidor local), `build:viewer` (empaqueta `js/` con hash en el nombre y lo estampa en las páginas), `build:content`, `build:images` (AVIF/WebP de las fotos del equipo), `build:brand` (iconos, favicon.ico, imagen para compartir), `build:og` (imagen para compartir de cada página). Detalle de cada una en la cabecera de su script.

**Qué se edita a mano y qué se genera.** A mano: los HTML de las 4 páginas (ES y EN), `css/`, `js/`, `data/*.json` y `data/bitacora/*.md`. Generado (no editar): `js/dist/`, `sitemap.xml`, `dossier/`, `en/dossier/`, `bitacora/`, `en/log/`, `assets/models/sr26-ar.glb`, `assets/img/og/`, los bloques entre `<!-- … :begin -->` y `<!-- … :end -->` de los HTML y `data/hechos.json`, `data/modelo.json`.

## Tareas frecuentes

| Quiero… | Hago… |
|---|---|
| **Cambiar la meta o lo recaudado** | Editar `js/config.js` (`funding.meta`, `funding.recaudado`); la barra de `/presupuesto/` lo lee. El desglose y el total del presupuesto están escritos en `presupuesto/index.html` y `en/budget/index.html` (cámbialos en ambos y corre `npm run build:content` para que el dossier los recoja). |
| **Cambiar la paleta** | Solo `:root` de `css/site.css` (y su copia en `css/gallery.css`). El auto 3D, las imágenes para compartir, los iconos y el dossier leen esos tokens. |
| **Agregar patrocinadores** | Logo en `assets/sponsors/`, entrada en `data/sponsors.json`, `"show": true`, `npm run build:content`. Ver `docs/CONTENIDO.md`. |
| **Publicar una entrada de bitácora** | Archivo `data/bitacora/AAAA-MM-DD-nombre.md` (plantilla en `docs/CONTENIDO.md`), `npm run build:content`. |
| **Mostrar la sección de CFD** | Llenar `data/cfd.json` y `npm run build:content`. Ver `docs/AR_Y_CFD.md`. |
| **Regenerar el auto 3D tras un cambio en Fusion** | Reemplazar `assets/models/sr26.glb` (nombres `NN_Nombre`) y `npm run build:model`, `npm run build:poster`. Ver `docs/PIPELINE_GLB.md`. |
| **Agregar el video para teléfonos** | Ver `TODO-EQUIPO.md` (sección Video de Fusion). |
| **Encender la analítica** | `data/analytics.json`; antes actualizar el aviso de privacidad. Ver `docs/ANALITICA.md`. |
| **Probar AR en un teléfono** | `docs/AR_Y_CFD.md`. |

## Calidad (`qa/`)

```bash
npm run serve                      # en otra terminal
npm run qa                         # pruebas: reveal, humo, visor, funciones del visor, configurador, AR/CFD, contenido, enlaces, paridad, axe, presupuesto de peso
npm run qa:lighthouse              # Lighthouse móvil, todas las páginas (resumen en qa/lighthouse/)
npm run qa:screens                 # capturas de cada página y idioma en 320, 390, 768, 1280 y 1920 px → qa/screens/
```

Las pruebas usan el Chrome/Edge del sistema (variable `BROWSER` para otra ruta) con WebGL por software, por eso el 3D tarda más que en un teléfono real. En Git Bash de Windows, las rutas que empiezan con `/` como argumento se convierten en rutas de Windows: antepón `MSYS_NO_PATHCONV=1`.

## Documentación

`AUDITORIA.md` (estado inicial) · `INFORME.md` (qué cambió y cómo verlo) · `CAMBIOS_PARA_EL_EQUIPO.md` (decisiones pendientes) · `docs/PIPELINE_GLB.md` · `docs/AR_Y_CFD.md` · `docs/CONTENIDO.md` · `docs/ANALITICA.md` · `docs/PRESUPUESTO_JS.md` · `TODO-EQUIPO.md` (notas históricas del equipo).

## Reglas del proyecto

Estética plana (sin degradados, brillos ni glassmorphism, sin emojis, solo fotos reales y renders del modelo propio), solo los colores de `css/site.css`, nada de datos inventados, todo texto nuevo en español (México) e inglés, y «Preparatoria Celta» siempre completo. El modelo 3D es un **prototipo visual**, no el auto final ni una validación del reglamento.
