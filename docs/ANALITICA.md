# Analítica opcional (apagada por defecto)

**Estado actual: apagada.** Ninguna página carga `js/analytics.js` y el sitio no hace ninguna petición a terceros. El aviso de privacidad vigente (que dice que no hay analítica) sigue siendo correcto.

## Qué mide si se enciende

Solo conteos de eventos: `whatsapp_click` (cualquier enlace a `wa.me`), `configurator_logo` y `configurator_download` (uso del configurador), `ar_open` (botón Ver en tu mesa). Cada evento lleva **solo** el nombre, la ruta de la página y el idioma. **No** hay cookies, identificadores, huella del navegador, ni se envía nada del visitante: el logo que se carga en el configurador **nunca** sale del navegador. Se respeta «No rastrear» (`doNotTrack`) y Global Privacy Control: con cualquiera activo no se envía nada.

## Cómo encenderla

1. Elige dónde recibir los eventos: una cuenta de **Plausible** (`mode: "plausible"`, endpoint `https://plausible.io/api/event`, `domain: "strikerracing.com"`) o un endpoint propio que acepte POST JSON `{event, path, lang}` (`mode: "beacon"`).
2. Edita `data/analytics.json`: `"enabled": true` y el `"endpoint"` (https).
3. **Antes de publicar**, actualiza el aviso de privacidad con el texto propuesto en `CAMBIOS_PARA_EL_EQUIPO.md` (no se modifica `privacidad.html` desde aquí).
4. `npm run build:content`, revisa que las páginas ahora incluyan `<script src="/js/analytics.js" …>` y haz commit.

Para apagarla: `"enabled": false` y `npm run build:content`.
