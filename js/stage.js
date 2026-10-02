/* Cargador del visor del auto (/auto/ y /en/car/). Pesa ~2 KB: decide QUÉ mostrar y solo descarga el visor 3D (js/viewer.js, ~160 KB gzip
 * + modelo) cuando corresponde. Modos:
 *   3D automático   pantallas > 560 px o teléfono sin video configurado, sin ahorro de datos: el 3D arranca al pintar el póster.
 *   video           teléfono con video configurado (assets/video/sr26-phone.{mp4,webm}): póster por defecto; el video corre solo con wifi
 *                   (Network Information API; donde no existe, p. ej. iPhone, solo al tocar) y "Explorar en 3D" carga el visor.
 *   3D al tocar     ahorro de datos o conexión 2G: póster + botón "Ver en 3D".
 * Sin WebGL se queda el póster. El video lo agrega el equipo: ver TODO-EQUIPO.md; npm run build:viewer lo detecta y lo conecta. */
(function(){
  var stage = document.getElementById('modelStage');
  if(!stage) return;
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var T = EN
    ? { video:'Watch video', d3:'Explore in 3D', load3d:'View in 3D', vlabel:'Video of the SR-26 exploded view', pause:'Tap to pause or play' }
    : { video:'Ver video', d3:'Explorar en 3D', load3d:'Ver en 3D', vlabel:'Video del despiece del SR-26', pause:'Toca para pausar o reanudar' };
  var ds = stage.dataset;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData, slow = /(^|-)2g$/.test(conn.effectiveType || '');
  var phone = window.matchMedia && window.matchMedia('(max-width:560px)').matches;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasVideo = !!(ds.videoMp4 || ds.videoWebm);
  var loaded = false, video = null, cta = null, userPaused = false;

  function fail(){ stage.classList.add('no-3d'); }
  try{
    var c = document.createElement('canvas');
    if(!(c.getContext('webgl') || c.getContext('experimental-webgl'))) return fail();
  }catch(e){ return fail(); }

  function afterFirstPaint(fn){
    function go(){ requestAnimationFrame(function(){ setTimeout(fn, 0); }); }
    if(document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go, { once:true });
  }
  function load3d(){
    if(loaded) return;
    loaded = true;
    stage.classList.add('is-loading');
    var bar = stage.querySelector('.model-bar i');
    if(bar) bar.style.transform = 'scaleX(0.05)';
    if(cta) cta.hidden = true;
    import(ds.viewer).then(function(m){ m.mount(stage); }).catch(function(){ stage.classList.remove('is-loading'); fail(); });
  }
  // cuando el 3D ya está listo se retira el video y los botones
  stage.addEventListener('sr26-ready', function(){
    if(video){ video.pause(); video.remove(); video = null; }
    if(cta){ cta.remove(); cta = null; }
    stage.classList.remove('is-idle');
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

  if(hasVideo && phone){
    var wifi = conn.type === 'wifi' && !saveData && !slow;
    if(wifi && !reduce) playVideo();
    else showCta([button(T.video, playVideo), button(T.d3, load3d, 'is-primary')]);
  }else if(saveData || slow){
    showCta([button(T.load3d, load3d, 'is-primary')]);
  }else if('IntersectionObserver' in window){
    // Carga anticipada: arranca cuando el visor está a menos de 600 px de entrar (en /auto/ ya está a la vista y arranca de inmediato)
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ io.disconnect(); afterFirstPaint(load3d); } });
    }, { rootMargin:'600px 0px' });
    io.observe(stage);
  }else{
    afterFirstPaint(load3d);
  }
})();
