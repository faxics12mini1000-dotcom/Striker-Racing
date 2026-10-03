/* Analítica mínima y OPCIONAL (apagada por defecto: ninguna página carga este archivo salvo que data/analytics.json la encienda; ver docs/ANALITICA.md).
 * Eventos: whatsapp_click (cualquier enlace a wa.me), configurator_logo, configurator_download, ar_open. Solo se envía el nombre del evento, la ruta y el idioma:
 * sin cookies, sin identificadores, sin IP guardada por el sitio, sin contenido del visitante (el logo del configurador NUNCA se envía) y respetando «No rastrear». */
(function(){
  var s = document.currentScript; if(!s) return;
  if(navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  var mode = s.dataset.mode || 'beacon', endpoint = s.dataset.endpoint, domain = s.dataset.domain || location.hostname;
  var lang = (document.documentElement.lang || 'es').slice(0, 2);
  if(!endpoint) return;
  function send(name){
    var body = mode === 'plausible'
      ? JSON.stringify({ name:name, url:location.origin + location.pathname, domain:domain, props:{ lang:lang } })
      : JSON.stringify({ event:name, path:location.pathname, lang:lang });
    try{
      if(navigator.sendBeacon && mode !== 'plausible') navigator.sendBeacon(endpoint, new Blob([body], { type:'application/json' }));
      else fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'text/plain' }, body:body, keepalive:true, credentials:'omit' }).catch(function(){});
    }catch(e){}
  }
  window.srTrack = send;
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
    if(a) send('whatsapp_click');
  }, true);
})();
