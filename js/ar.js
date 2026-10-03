/* «Ver en tu mesa» (/auto/ y /en/car/): realidad aumentada con <model-viewer> autoalojado (vendor/model-viewer/<versión>/, sin CDN).
 * Pesa ~2 KB. El botón #arBtn está oculto y solo aparece si el dispositivo puede hacer AR (WebXR immersive-ar, Quick Look de iPhone/iPad o Scene Viewer
 * de Android); <model-viewer> (~285 KB gzip) y el GLB de AR (assets/models/sr26-ar.glb, sin meshopt, escala 1:1) se descargan solo al pulsarlo.
 * El botón trae data-ar-lib, data-ar-model y data-ar-usdz (build-viewer.mjs los estampa; usdz queda vacío si no existe assets/models/sr26.usdz). */
(function(){
  var btn = document.getElementById('arBtn');
  if(!btn) return;
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var T = EN
    ? { title:'See the SR-26 on your table', hint:'Point the camera at a flat surface: the car appears at real size (1:1 scale). Visual prototype.', go:'Open in AR', close:'Close',
        loading:'Loading…', no:'Your device or browser does not support augmented reality. Try an Android phone with Chrome or an iPhone with Safari.', alt:'3D model of the SR-26, Striker Racing car', fail:'The model could not be loaded.' }
    : { title:'Ver el SR-26 en tu mesa', hint:'Apunta la cámara a una superficie plana: el auto aparece a tamaño real (escala 1:1). Prototipo visual.', go:'Abrir en AR', close:'Cerrar',
        loading:'Cargando…', no:'Tu dispositivo o navegador no permite realidad aumentada. Prueba con un teléfono Android con Chrome o un iPhone con Safari.', alt:'Modelo 3D del SR-26, monoplaza de Striker Racing', fail:'No se pudo cargar el modelo.' };

  // ¿puede este dispositivo hacer AR? (comprobación ligera; la definitiva es model-viewer.canActivateAR)
  function supportsAr(){
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = /Android/.test(ua);
    var quickLook = false;
    try{ var a = document.createElement('a'); quickLook = !!(a.relList && a.relList.supports && a.relList.supports('ar')); }catch(e){}
    if(ios) return Promise.resolve(quickLook);                       // iPhone/iPad: solo Safari (Quick Look) puede
    if(navigator.xr && navigator.xr.isSessionSupported){            // Android con ARCore (WebXR) o Scene Viewer
      return navigator.xr.isSessionSupported('immersive-ar').then(function(ok){ return ok || android; }, function(){ return android; });
    }
    return Promise.resolve(android);
  }
  supportsAr().then(function(ok){ if(ok) btn.hidden = false; }).catch(function(){});

  var dlg = null, mv = null, loaded = false;
  function build(){
    dlg = document.createElement('dialog');
    dlg.className = 'ar-dialog'; dlg.setAttribute('aria-labelledby', 'arTitle');
    dlg.innerHTML = '<div class="ar-head"><h2 id="arTitle"></h2><button type="button" class="ar-close"></button></div><p class="ar-hint"></p><div class="ar-stage"></div><p class="ar-msg" role="status" aria-live="polite"></p><div class="ar-actions"></div>';
    dlg.querySelector('#arTitle').textContent = T.title;
    dlg.querySelector('.ar-hint').textContent = T.hint;
    var close = dlg.querySelector('.ar-close'); close.textContent = T.close; close.addEventListener('click', function(){ dlg.close(); });
    dlg.addEventListener('click', function(e){ if(e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  function msg(t){ dlg.querySelector('.ar-msg').textContent = t || ''; }
  function mount(){
    mv = document.createElement('model-viewer');
    mv.setAttribute('src', btn.dataset.arModel);
    if(btn.dataset.arUsdz) mv.setAttribute('ios-src', btn.dataset.arUsdz);
    mv.setAttribute('alt', T.alt);
    mv.setAttribute('ar', ''); mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look'); mv.setAttribute('ar-scale', 'fixed');   // fixed = 1:1, el visitante no puede escalarlo
    mv.setAttribute('camera-controls', ''); mv.setAttribute('touch-action', 'pan-y'); mv.setAttribute('shadow-intensity', '0.8'); mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('reveal', 'auto');
    var go = document.createElement('button'); go.type = 'button'; go.className = 'btn btn-solid'; go.textContent = T.go; go.slot = 'ar-button'; go.hidden = true;
    mv.appendChild(go);
    dlg.querySelector('.ar-stage').appendChild(mv);
    mv.addEventListener('load', function(){
      msg('');
      if(mv.canActivateAR){ go.hidden = false; dlg.querySelector('.ar-actions').appendChild(go); go.removeAttribute('slot'); go.addEventListener('click', function(){ mv.activateAR(); }); }
      else{ msg(T.no); btn.hidden = true; }
    });
    mv.addEventListener('error', function(){ msg(T.fail); });
  }
  btn.addEventListener('click', function(){
    if(!dlg) build();
    dlg.showModal();
    if(loaded) return;
    loaded = true; msg(T.loading);
    var s = document.createElement('script'); s.type = 'module'; s.src = btn.dataset.arLib;
    s.onload = mount; s.onerror = function(){ loaded = false; msg(T.fail); };
    document.head.appendChild(s);
    try{ if(window.srTrack) window.srTrack('ar_open'); }catch(e){}
  });
})();
