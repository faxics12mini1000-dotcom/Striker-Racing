(function(){
  var lang = (document.documentElement.lang || 'es').slice(0, 2);

  // ---------- NAV COCKPIT (menú móvil que se repliega solo) ----------
  var toggle = document.getElementById('navToggle');
  var panel = document.getElementById('navPanel');
  function setNav(open){
    if(!toggle || !panel) return;
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', toggle.getAttribute(open ? 'data-label-close' : 'data-label-open'));
  }
  if(toggle && panel){
    toggle.addEventListener('click', function(){ setNav(!panel.classList.contains('open')); });
    panel.addEventListener('click', function(e){ if(e.target.closest('a')) setNav(false); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && panel.classList.contains('open')){ setNav(false); toggle.focus(); }
    });
    document.addEventListener('click', function(e){
      if(panel.classList.contains('open') && !panel.contains(e.target) && !toggle.contains(e.target)) setNav(false);
    });
    window.addEventListener('resize', function(){ if(window.innerWidth > 900) setNav(false); });
  }

  // Logo: si ya estamos en el inicio, sube suave en vez de recargar.
  var brand = document.getElementById('brandHome');
  if(brand){
    brand.addEventListener('click', function(e){
      var path = location.pathname.replace(/index\.html$/, '');
      if(path === '/' || path === '/en/' || path === ''){
        e.preventDefault();
        setNav(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Resalta en el navbar la sección visible (solo en la página principal, donde los enlaces son anclas).
  // Nota: se guarda el estado de intersección de CADA sección observada en `intersecting` y, tras
  // cada lote de entries, se deriva el único enlace activo (el último, en orden del documento, que
  // siga intersectando la franja) en vez de alternar aria-current entry por entry -- así nunca queda
  // más de un enlace marcado a la vez, sin importar el orden en que el navegador reporte los cambios.
  if('IntersectionObserver' in window){
    var spyLinks = {};
    var spyOrder = [];
    document.querySelectorAll('.cockpit-links a[href^="#"]').forEach(function(a){
      var id = a.getAttribute('href').slice(1);
      spyLinks[id] = a;
      spyOrder.push(id);
    });
    if(spyOrder.length){
      var intersecting = {};
      function applyActive(){
        var activeId = null;
        for(var i = 0; i < spyOrder.length; i++){
          if(intersecting[spyOrder[i]]) activeId = spyOrder[i];
        }
        spyOrder.forEach(function(id){
          if(id === activeId) spyLinks[id].setAttribute('aria-current', 'location');
          else spyLinks[id].removeAttribute('aria-current');
        });
      }
      var spy = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){ intersecting[entry.target.id] = entry.isIntersecting; });
        applyActive();
      }, { rootMargin: '-45% 0px -50% 0px' });
      spyOrder.forEach(function(id){ var el = document.getElementById(id); if(el) spy.observe(el); });
    }
  }

  // ---------- VOLVER ARRIBA ----------
  var backToTop = document.getElementById('backToTop');
  if(backToTop){
    var updateTop = function(){ backToTop.classList.toggle('is-visible', window.scrollY > 400); };
    window.addEventListener('scroll', updateTop, { passive: true });
    updateTop();
    backToTop.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // ---------- HIDRATA TEXTO DESDE window.STRIKER_CONFIG ----------
  // El HTML ya trae el valor por default visible sin JS; esto solo lo sincroniza con la config.
  var cfg = window.STRIKER_CONFIG;
  if(cfg){
    document.querySelectorAll('[data-config]').forEach(function(el){
      var val = cfg;
      el.getAttribute('data-config').split('.').forEach(function(k){ val = val && val[k]; });
      if(val && typeof val === 'object') val = val[lang] || val.es;
      if(val != null) el.textContent = val;
    });
    if(cfg.funding){
      var fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
      var meta = cfg.funding.meta || 0;
      var recaudado = cfg.funding.recaudado || 0;
      var pct = meta > 0 ? Math.min(100, Math.round((recaudado / meta) * 100)) : 0;
      document.querySelectorAll('[data-funding="meta"]').forEach(function(el){ el.textContent = '$' + fmt.format(meta); });
      document.querySelectorAll('[data-funding="recaudado"]').forEach(function(el){ el.textContent = '$' + fmt.format(recaudado); });
      document.querySelectorAll('[data-funding="fill"]').forEach(function(el){ el.style.width = pct + '%'; });
    }
  }

  // ---------- DIÁLOGOS GENÉRICOS (configurador de logo) ----------
  document.querySelectorAll('[data-open]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var dlg = document.getElementById(btn.getAttribute('data-open'));
      if(dlg && typeof dlg.showModal === 'function') dlg.showModal();
    });
  });
  document.querySelectorAll('dialog.profile-dialog').forEach(function(dlg){
    dlg.querySelectorAll('[data-close]').forEach(function(btn){ btn.addEventListener('click', function(){ dlg.close(); }); });
    dlg.addEventListener('click', function(e){ if(e.target === dlg) dlg.close(); });
  });

  // ---------- DIAGRAMA DE ZONAS: resalta al pasar/enfocar un nivel ----------
  function zoneEls(names){
    var sel = names.split(',').map(function(z){ return '.zone-shape[data-zone="' + z.trim() + '"]'; }).join(',');
    return document.querySelectorAll(sel);
  }
  document.querySelectorAll('.tier[data-zones]').forEach(function(tier){
    var zones = zoneEls(tier.getAttribute('data-zones'));
    function on(){ zones.forEach(function(z){ z.classList.add('zone-hot'); }); }
    function off(){ zones.forEach(function(z){ z.classList.remove('zone-hot'); }); }
    tier.addEventListener('mouseenter', on);
    tier.addEventListener('mouseleave', off);
    tier.addEventListener('focusin', on);
    tier.addEventListener('focusout', off);
  });
  document.querySelectorAll('.zone-shape').forEach(function(shape){
    shape.setAttribute('tabindex', '0');
    shape.setAttribute('role', 'button');
    function flip(){ shape.setAttribute('aria-pressed', shape.classList.toggle('zone-hot') ? 'true' : 'false'); }
    shape.addEventListener('click', flip);
    shape.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); flip(); } });
  });

  // ---------- REVEAL AL SCROLL ----------
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ entry.target.classList.add('in-view'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
    document.querySelectorAll('.card-reveal').forEach(function(el){
      if(!el.closest('.pass-grid, .tiers')) io.observe(el);
    });

    var STAGGER_MS = 90;
    document.querySelectorAll('.pass-grid, .tiers').forEach(function(group){
      var cards = group.querySelectorAll('.card-reveal');
      var gio = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            var i = Array.prototype.indexOf.call(cards, entry.target);
            entry.target.style.transitionDelay = (Math.max(i, 0) % 3 * STAGGER_MS) + 'ms';
            entry.target.classList.add('in-view');
            gio.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      cards.forEach(function(el){ gio.observe(el); });
    });
  }
})();
