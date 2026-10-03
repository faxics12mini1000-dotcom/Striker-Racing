/* Cargador del visor del auto (/auto/, /en/car/ y el inicio). Pesa ~2 KB: decide QUÉ mostrar y solo descarga el visor 3D (js/viewer.js, ~170 KB gzip
 * + modelo) cuando corresponde. Modos:
 *   3D automático   pantallas > 560 px, sin ahorro de datos: el visor arranca cuando está a menos de 600 px de entrar en pantalla (en /auto/
 *                   ya está a la vista y arranca de inmediato). La descarga del GLB y del entorno empieza en ese mismo instante y se
 *                   le pasa ya iniciada al visor (mount(stage, { glb, env })), así no hay <link rel=preload> que se quede sin usar.
 *   teléfono        ≤ 560 px: póster y botón «Explorar en 3D» (ahorra ~1 MB y CPU en equipos modestos); solo con wifi confirmado
 *                   (Network Information API, no existe en iPhone) arranca solo. Si hay video configurado, el video corre con wifi.
 *   3D al tocar     ahorro de datos o conexión 2G, en cualquier pantalla: póster + botón «Ver en 3D».
 * Sin WebGL se queda el póster. El video lo agrega el equipo: ver TODO-EQUIPO.md; npm run build:viewer lo detecta y lo conecta. */
(function(){
  var stage = document.getElementById('modelStage');
  if(!stage) return;
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var T = EN
    ? { loading:'Loading the 3D model…', error:'The 3D model could not be loaded. Check your connection and try again.', ready:'3D model ready. Use the arrow keys to rotate it, Home for the ISO view.',
        video:'Watch video', d3:'Explore in 3D', load3d:'View in 3D', retry:'Try again', vlabel:'Video of the SR-26 exploded view', pause:'Tap to pause or play' }
    : { loading:'Cargando el modelo 3D…', error:'No se pudo cargar el modelo 3D. Revisa tu conexión e inténtalo de nuevo.', ready:'Modelo 3D listo. Usa las flechas para girarlo y Inicio para la vista ISO.',
        video:'Ver video', d3:'Explorar en 3D', load3d:'Ver en 3D', retry:'Reintentar', vlabel:'Video del despiece del SR-26', pause:'Toca para pausar o reanudar' };
  var ds = stage.dataset;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData, slow = /(^|-)2g$/.test(conn.effectiveType || '');
  var phone = window.matchMedia && window.matchMedia('(max-width:560px)').matches;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasVideo = !!(ds.videoMp4 || ds.videoWebm);
  var loaded = false, video = null, cta = null, userPaused = false, pre = null;

  // Mensaje de estado (visible al cargar o fallar; al terminar queda solo para lectores de pantalla)
  var msg = document.createElement('div');
  msg.className = 'model-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
  stage.appendChild(msg);
  function say(text, visible){ msg.textContent = text; msg.classList.toggle('sr-only', !visible); }
  say('', false);
  // La comprobación de WebGL la hace el visor (js/viewer.js) cuando se va a usar: crear un contexto WebGL al cargar la página cuesta cientos de ms en equipos
  // sin GPU (y suma al bloqueo del hilo principal); sin WebGL el visor marca .no-3d y queda el póster.

  function afterFirstPaint(fn){
    function go(){ requestAnimationFrame(function(){ setTimeout(fn, 0); }); }
    if(document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go, { once:true });
  }
  // data-defer="idle" (inicio): el 3D no compite con el LCP; espera a que cargue la página y a un momento de reposo del hilo principal.
  function whenReady(fn){
    if(ds.defer !== 'idle') return afterFirstPaint(fn);
    function idle(){ (window.requestIdleCallback || function(f){ setTimeout(f, 600); })(function(){ afterFirstPaint(fn); }, { timeout:2500 }); }
    if(document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once:true });
  }
  // Descargas del modelo y del entorno: se inician una sola vez y se entregan al visor ya en curso.
  function prefetch(){
    if(pre) return pre;
    pre = { glb:fetch(ds.model), env:fetch(ds.env) };
    pre.glb.catch(function(){}); pre.env.catch(function(){});
    return pre;
  }
  function load3d(){
    if(loaded) return;
    loaded = true;
    stage.classList.add('is-loading');
    stage.classList.remove('has-error');
    say(T.loading, true);
    var bar = stage.querySelector('.model-bar i');
    if(bar) bar.style.transform = 'scaleX(0.05)';
    if(cta) cta.hidden = true;
    var p = prefetch();
    import(ds.viewer).then(function(m){ m.mount(stage, p); }).catch(function(){ stage.classList.remove('is-loading'); onError(); });
  }
  // Si la descarga o el visor fallan (red caída, GLB dañado) se avisa y se ofrece reintentar sin recargar la página; el póster se queda.
  function onError(){
    loaded = false; pre = null;
    stage.classList.remove('is-loading'); stage.classList.add('has-error');
    say(T.error, true);
    showCta([button(T.retry, load3d, 'is-primary')]);
  }
  stage.addEventListener('sr26-error', onError);
  // cuando el 3D ya está listo se retira el video y los botones
  stage.addEventListener('sr26-ready', function(){
    if(video){ video.pause(); video.remove(); video = null; }
    if(cta){ cta.remove(); cta = null; }
    stage.classList.remove('is-idle', 'has-error');
    say(T.ready, false);
  });

  function button(label, onClick, cls){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'car-cta-btn' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function showCta(buttons){
    if(!cta){ cta = document.createElement('div'); cta.className = 'car-cta'; stage.appendChild(cta); stage.classList.add('is-idle'); }
    cta.hidden = false; cta.textContent = '';
    buttons.forEach(function(b){ cta.appendChild(b); });
  }

  function playVideo(){
    if(video){ video.play(); return; }
    video = document.createElement('video');
    video.className = 'model-video';
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('playsinline', ''); video.setAttribute('aria-label', T.vlabel); video.setAttribute('title', T.pause);
    [['video/webm', ds.videoWebm], ['video/mp4', ds.videoMp4]].forEach(function(s){
      if(!s[1]) return;
      var el = document.createElement('source'); el.src = s[1]; el.type = s[0]; video.appendChild(el);
    });
    video.addEventListener('playing', function(){ video.classList.add('is-on'); });
    video.addEventListener('click', function(){ if(video.paused){ userPaused = false; video.play(); } else { userPaused = true; video.pause(); } });
    var anchor = stage.querySelector('picture') || stage.querySelector('.model-poster');
    stage.insertBefore(video, anchor ? anchor.nextSibling : stage.firstChild);
    var p = video.play();
    if(p && p.catch) p.catch(function(){ showCta([button(T.video, playVideo), button(T.d3, load3d, 'is-primary')]); });
    if('IntersectionObserver' in window){        // el video se pausa fuera de pantalla para ahorrar batería y datos
      new IntersectionObserver(function(es){
        es.forEach(function(e){ if(!video) return; if(e.isIntersecting){ if(!userPaused) video.play().catch(function(){}); } else video.pause(); });
      }, { threshold:0.15 }).observe(stage);
    }
    showCta([button(T.d3, load3d, 'is-primary')]);
  }

  var wifi = conn.type === 'wifi' && !saveData && !slow;
  if(hasVideo && phone){
    if(wifi && !reduce) playVideo();
    else showCta([button(T.video, playVideo), button(T.d3, load3d, 'is-primary')]);
  }else if(saveData || slow || (phone && !wifi)){
    showCta([button(phone && !saveData && !slow ? T.d3 : T.load3d, load3d, 'is-primary')]);
  }else if('IntersectionObserver' in window){
    // Carga anticipada: la descarga arranca al estar a menos de 600 px de entrar; el visor se monta tras el primer pintado.
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ io.disconnect(); if(ds.defer !== 'idle') prefetch(); whenReady(load3d); } });
    }, { rootMargin:'600px 0px' });
    io.observe(stage);
  }else{
    if(ds.defer !== 'idle') prefetch();
    whenReady(load3d);
  }
})();
