(function(){
  // Visor 3D del monoplaza SR-26 (assets/models/sr26.glb) en el hero: gira solo, se arma y se desarma en bucle,
  // y se puede arrastrar para girar o mover el control para ver el despiece. NO secuestra el scroll de la página.
  // Perf: three.js + el .glb solo se descargan cuando el visor está por entrar en viewport y la página ya cargó;
  // hasta entonces se muestra el poster estático (car-poster.webp).
  var stage = document.getElementById('modelStage');
  if(!stage) return;
  function fail(){ stage.classList.add('no-3d'); }
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var TXT = EN
    ? { slider:'Exploded view of the car', assembled:'Assembled', exploded:'Exploded', pause:'Pause animation', play:'Play animation',
        steps:['Wheels & axles', 'Wings & nose', 'Sidepods', 'Spine & pillar', 'CO₂ cartridge'] }
    : { slider:'Despiece del auto', assembled:'Armado', exploded:'Despiece', pause:'Pausar animación', play:'Reanudar animación',
        steps:['Llantas y ejes', 'Alerones y nariz', 'Pontones', 'Espina y pilar', 'Cartucho CO₂'] };
  // Pieza que ancla la etiqueta de cada etapa (clave del nodo en el GLB)
  var LABEL_KEYS = ['17', '05', '02', '24', '15'];

  try{
    var testCanvas = document.createElement('canvas');
    var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if(!gl) return fail();
  }catch(e){ return fail(); }

  var booted = false;
  function whenIdle(fn){
    function go(){ if('requestIdleCallback' in window) requestIdleCallback(fn, { timeout:600 }); else setTimeout(fn, 100); }
    if(document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go, { once:true });
  }
  function bootWhenNear(){
    if(booted) return;
    booted = true;
    whenIdle(boot);
  }
  if('IntersectionObserver' in window){
    var bootIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ bootIO.disconnect(); bootWhenNear(); }
      });
    }, { rootMargin:'200px 0px' });
    bootIO.observe(stage);
  }else{
    bootWhenNear();
  }

  var mark = function(n){ try{ performance.mark('sr26:' + n); }catch(e){} };
  async function boot(){
    mark('boot');
    stage.classList.add('is-loading');
    var THREE, GLTFLoaderMod, OrbitControlsMod, MeshoptMod, Look;
    try{
      var mods = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/libs/meshopt_decoder.module.js').catch(function(){ return null; }),
        import('./car-look.js')
      ]);
      THREE = mods[0]; GLTFLoaderMod = mods[1]; OrbitControlsMod = mods[2]; MeshoptMod = mods[3]; Look = mods[4];
    }catch(e){ return fail(); }

    mark('modules');
    try{
      initViewer(THREE, GLTFLoaderMod.GLTFLoader, OrbitControlsMod.OrbitControls, MeshoptMod && MeshoptMod.MeshoptDecoder, Look);
    }catch(e){ fail(); }
  }

  function initViewer(THREE, GLTFLoader, OrbitControls, MeshoptDecoder, Look){
    var EXPLODE = Look.EXPLODE, STEPS = Look.EXPLODE_STEPS;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);

    // Nivel de calidad: equipos modestos (pocos núcleos / poca RAM / táctiles) arrancan sin sombras en tiempo real y a menor resolución.
    var lowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                 (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    var renderer = new THREE.WebGLRenderer({ antialias:!lowEnd, alpha:true, powerPreference:'high-performance' });
    var maxDpr = lowEnd ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    if('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    Look.lookRenderer(renderer, !lowEnd);
    stage.appendChild(renderer.domElement);

    // Esta escena trabaja en metros (el GLB viene en metros), de ahí u = 0.001.
    mark('renderer');
    Look.lookEnvironment(renderer, scene);
    mark('env');
    var keyLight = Look.lookLights(scene, 0.001, !lowEnd);
    var ground = Look.lookGround(scene, 0.001);

    var group = new THREE.Group();
    scene.add(group);

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false; // la rueda del mouse sigue haciendo scroll de la página
    controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(150);
    controls.rotateSpeed = 0.85;
    controls.autoRotate = false;
    // OrbitControls pone touch-action:none; en pantallas táctiles eso atrapa el dedo y no deja bajar por la página.
    // Con pan-y el deslizamiento vertical sigue siendo scroll; el horizontal gira el auto.
    renderer.domElement.style.touchAction = 'pan-y';
    var IDLE_SPIN_SPEED = 0.15; // rad/s

    var idleRotateAllowed = !reduceMotion;
    var resumeTimer = null;
    var RESUME_DELAY_MS = 2500;
    controls.addEventListener('start', function(){
      idleRotateAllowed = false;
      if(resumeTimer){ clearTimeout(resumeTimer); resumeTimer = null; }
    });
    controls.addEventListener('end', function(){
      if(reduceMotion) return;
      resumeTimer = setTimeout(function(){ idleRotateAllowed = true; resumeTimer = null; }, RESUME_DELAY_MS);
    });

    // ---------- DESPIECE: estado y ciclo automático ----------
    var parts = [];      // { mesh, home, off, step }
    var exploded = 0;    // 0 = armado, 1 = despiece completo
    var auto = !reduceMotion;
    var cycleT = 0;
    // armado (3.2 s) → separa (2.4 s) → despiece (3.6 s) → arma (2.4 s)
    var HOLD_A = 3.2, MOVE = 2.4, HOLD_B = 3.6, CYCLE = HOLD_A + MOVE + HOLD_B + MOVE;
    function ease(t){ return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
    function clamp01(x){ return Math.min(1, Math.max(0, x)); }
    function cycleValue(t){
      if(t < HOLD_A) return 0;
      if(t < HOLD_A + MOVE) return ease((t - HOLD_A) / MOVE);
      if(t < HOLD_A + MOVE + HOLD_B) return 1;
      return 1 - ease((t - HOLD_A - MOVE - HOLD_B) / MOVE);
    }
    var stepF = [0, 0, 0, 0, 0, 0];   // avance (0..1) de cada etapa, para las etiquetas
    var LIFT = 0.007;                 // m: las piezas se elevan un poco al viajar (arco) en vez de ir en recta
    function applyPose(u){
      for(var s = 1; s <= STEPS; s++) stepF[s] = 0;
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        // escalonado: cada etapa arranca después de la anterior y, dentro de la etapa, cada pieza con un pequeño retraso
        var d = (p.step - 1) / (STEPS - 1) * 0.42 + p.lag;
        var f = ease(clamp01((u - d) / 0.5));
        p.mesh.position.copy(p.home).addScaledVector(p.off, f);
        if(p.lift) p.mesh.position.y += Math.sin(Math.PI * f) * LIFT;
        if(p.wheel) p.mesh.rotation.z = f * Math.PI * 2 * p.spin; // las llantas dan una vuelta al salir
        if(f > stepF[p.step]) stepF[p.step] = f;
        if(p.guide){
          var g = p.guide, a = g.geometry.attributes.position;
          a.setXYZ(1, p.home.x + p.c.x + p.off.x * f, p.home.y + p.c.y + p.off.y * f, p.home.z + p.c.z + p.off.z * f);
          a.needsUpdate = true; g.computeLineDistances();
          g.material.opacity = 0.55 * Math.min(1, f * 3);
          g.visible = f > 0.02;
        }
      }
    }

    // ---------- Encuadre: la distancia se ajusta al tamaño real (armado ↔ despiece) para que el auto siempre quepa ----------
    var half0 = new THREE.Vector3(), half1 = new THREE.Vector3(), cy0 = 0, cy1 = 0;
    var halfNow = new THREE.Vector3(), cyNow = 0;
    var worldUp = new THREE.Vector3(0, 1, 0);
    var FIT_MARGIN = 1.16;
    var corner = new THREE.Vector3();
    function computeFitDistance(){
      var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if(dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
      var right = new THREE.Vector3().crossVectors(worldUp, dir);
      if(right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();
      var up = new THREE.Vector3().crossVectors(dir, right).normalize();
      var maxH = 0, maxV = 0;
      for(var sx = -1; sx <= 1; sx += 2) for(var sy = -1; sy <= 1; sy += 2) for(var sz = -1; sz <= 1; sz += 2){
        corner.set(sx * halfNow.x, sy * halfNow.y, sz * halfNow.z).applyQuaternion(group.quaternion);
        var h = Math.abs(corner.dot(right)), v = Math.abs(corner.dot(up));
        if(h > maxH) maxH = h;
        if(v > maxV) maxV = v;
      }
      var vFov = THREE.MathUtils.degToRad(camera.fov / 2);
      var hFov = Math.atan(Math.tan(vFov) * camera.aspect);
      return Math.max(maxV / Math.tan(vFov), maxH / Math.tan(hFov)) * FIT_MARGIN;
    }
    function applyFit(){
      if(!half0.x) return;
      halfNow.lerpVectors(half0, half1, exploded);
      cyNow = cy0 + (cy1 - cy0) * exploded;
      controls.target.set(0, cyNow, 0);
      var dist = computeFitDistance();
      var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if(dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
      camera.position.copy(dir.multiplyScalar(dist).add(controls.target));
      camera.near = Math.max(dist * 0.04, 0.05);
      camera.far = dist * 20;
      camera.updateProjectionMatrix();
    }

    function makeContactShadowTexture(){
      var c = document.createElement('canvas');
      c.width = c.height = 256;
      var ctx = c.getContext('2d');
      var g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    }

    var labelHost = null, labels = [];
    var tmpBox = new THREE.Box3(), tmpV = new THREE.Vector3();
    function updateLabels(){
      if(!labelHost) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      for(var i = 0; i < labels.length; i++){
        var L = labels[i], a = clamp01((stepF[L.step] - 0.35) / 0.4);
        if(!L.mesh || a <= 0.01){ L.el.style.opacity = 0; continue; }
        tmpBox.setFromObject(L.mesh).getCenter(tmpV).project(camera);
        var x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
        L.el.style.opacity = a;
        if(!L.w) L.w = L.el.offsetWidth;
        L.el.style.transform = 'translate(' + Math.round(Math.min(Math.max(x, 8), w - L.w - 24)) + 'px,' + Math.round(Math.min(Math.max(y, 8), h - 56)) + 'px)';
      }
    }

    var loader = new GLTFLoader();
    if(MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(new URL('../assets/models/sr26.glb?v=3', import.meta.url).href, function(gltf){
      mark('glb-parsed');
      var model = gltf.scene;

      // assets/models/sr26.glb: metros, Y arriba, X hacia el frente, un nodo por STL (nombre = archivo). Librea y materiales en car-look.js.
      var meshes = [], byKey = {};
      model.traverse(function(obj){ if(obj.isMesh) meshes.push(obj); }); // lista fija: lookPart reemplaza geometría y material
      meshes.forEach(function(obj){
        var k = obj.name.slice(0, 2);
        if(Look.HIDDEN.has(k)){ obj.removeFromParent(); return; } // sin halo
        Look.lookPart(obj);
        byKey[k] = obj;
        var ex = EXPLODE[k];
        if(ex){
          var off = new THREE.Vector3(ex.off[0], ex.off[1], ex.off[2]).multiplyScalar(0.001);
          obj.geometry.computeBoundingBox();
          parts.push({ mesh:obj, home:obj.position.clone(), off:off, step:ex.step, wheel:/^1[6-9]$/.test(k), spin:obj.position.z < 0 ? -1 : 1,
                       lift:Math.abs(off.y) < 1e-6, lag:(parseInt(k, 10) % 3) * 0.025,
                       c:obj.geometry.boundingBox.getCenter(new THREE.Vector3()) });
        }
      });
      model.updateMatrixWorld(true);
      mark('looks');

      // Líneas guía punteadas (una por clave de pieza; las dos mallas de una llanta comparten línea)
      var seenGuide = {};
      parts.forEach(function(p){
        var k = p.mesh.name.slice(0, 2);
        if(seenGuide[k]) return;
        seenGuide[k] = true;
        var geo = new THREE.BufferGeometry();
        var start = p.home.clone().add(p.c);
        geo.setAttribute('position', new THREE.Float32BufferAttribute([start.x, start.y, start.z, start.x, start.y, start.z], 3));
        var line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color:0xCDDEEF, dashSize:0.005, gapSize:0.004, transparent:true, opacity:0, depthTest:false, depthWrite:false, toneMapped:false }));
        line.renderOrder = 5; line.visible = false; line.frustumCulled = false;
        model.add(line);
        p.guide = line;
      });

      // Etiquetas por etapa (HTML sobre el visor, ancladas a una pieza de cada etapa)
      labelHost = document.createElement('div');
      labelHost.className = 'car-labels';
      labelHost.setAttribute('aria-hidden', 'true');
      LABEL_KEYS.forEach(function(k, i){
        var el = document.createElement('span');
        el.className = 'car-label';
        el.innerHTML = '<b>' + (i + 1) + '</b>' + TXT.steps[i];
        labelHost.appendChild(el);
        labels.push({ el:el, mesh:byKey[k], step:i + 1 });
      });
      stage.appendChild(labelHost);

      // Logos dibujados en código (espina + espacios disponibles). Si falla la carga, el auto se ve igual.
      Look.addLogoDecals(byKey, new URL('../logo.png', import.meta.url).href, EN ? 'en' : 'es').then(function(){ needsRender = true; startLoop(); }).catch(function(){});

      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      model.position.sub(center); // centra el auto armado en el origen
      model.updateMatrixWorld(true);

      group.add(model);
      ground.position.y = -size.y / 2 - 0.0002;

      var shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size.x * 1.3, size.z * 1.8),
        new THREE.MeshBasicMaterial({ map:makeContactShadowTexture(), transparent:true, opacity:0.8, depthWrite:false, toneMapped:false })
      );
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = -size.y / 2 + 0.0001;
      shadowMesh.renderOrder = -1;
      group.add(shadowMesh);

      var plinthR = size.x * 0.62;
      var plinth = new THREE.Mesh(
        new THREE.RingGeometry(plinthR, plinthR * 1.006, 96),
        new THREE.MeshBasicMaterial({ color:0xCDDEEF, transparent:true, opacity:0.22, depthWrite:false, toneMapped:false, side:THREE.DoubleSide })
      );
      plinth.rotation.x = -Math.PI / 2;
      plinth.position.y = -size.y / 2 + 0.0002;
      plinth.renderOrder = -1;
      group.add(plinth);

      // Medidas del auto armado y del despiece completo (para encuadrar sin saltos mientras se abre)
      function extents(){
        var b = new THREE.Box3().setFromObject(model);
        return { h:new THREE.Vector3(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), (b.max.y - b.min.y) / 2, Math.max(Math.abs(b.min.z), Math.abs(b.max.z))), cy:(b.max.y + b.min.y) / 2 };
      }
      var e0 = extents(); half0.copy(e0.h); cy0 = e0.cy;
      applyPose(1); model.updateMatrixWorld(true);
      var e1 = extents(); half1.copy(e1.h); cy1 = e1.cy;
      applyPose(0); model.updateMatrixWorld(true);

      var az = THREE.MathUtils.degToRad(35);
      var el = THREE.MathUtils.degToRad(26);
      camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      controls.target.set(0, cy0, 0);
      exploded = 0; applyFit(); controls.update();

      buildControls();
      mark('built');
      var reveal = function(){
        mark('compiled');
        stage.classList.remove('is-loading');
        stage.classList.add('is-ready');
        needsRender = true;
        startLoop();
      };
      if(renderer.compileAsync){ renderer.compileAsync(scene, camera).then(reveal, reveal); } else reveal();
    }, undefined, function(){ fail(); });

    // ---------- Control de despiece (botón pausa + deslizador) ----------
    var slider = null, playBtn = null, dragging = false;
    function setPlayUi(){
      if(!playBtn) return;
      playBtn.textContent = auto ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', auto ? TXT.pause : TXT.play);
      playBtn.setAttribute('aria-pressed', auto ? 'true' : 'false');
    }
    function buildControls(){
      var bar = document.createElement('div');
      bar.className = 'car-ctl';
      bar.innerHTML =
        '<button type="button" class="car-ctl-play"></button>' +
        '<span class="car-ctl-end">' + TXT.assembled + '</span>' +
        '<input type="range" class="car-ctl-range" min="0" max="100" step="1" value="0" aria-label="' + TXT.slider + '">' +
        '<span class="car-ctl-end">' + TXT.exploded + '</span>';
      stage.appendChild(bar);
      playBtn = bar.querySelector('.car-ctl-play'); slider = bar.querySelector('.car-ctl-range');
      setPlayUi();
      playBtn.addEventListener('click', function(){
        auto = !auto;
        if(auto){ cycleT = exploded < .5 ? 0 : HOLD_A + MOVE; } // sigue desde donde quedó
        setPlayUi(); requestRender();
      });
      slider.addEventListener('input', function(){
        auto = false; setPlayUi();
        exploded = slider.value / 100;
        requestRender();
      });
      slider.addEventListener('pointerdown', function(){ dragging = true; });
      slider.addEventListener('pointerup', function(){ dragging = false; });
      slider.addEventListener('blur', function(){ dragging = false; });
    }

    // ---------- RENDER ON-DEMAND + PAUSA FUERA DE VIEWPORT / PESTAÑA OCULTA ----------
    var inViewport = true;
    var pageVisible = document.visibilityState !== 'hidden';
    var rafId = null;
    var framePending = false;
    var needsRender = true;
    var clock = new THREE.Clock();

    // OrbitControls dispara 'change' de forma síncrona dentro de su propio update(). Sin la guarda de
    // `framePending` ese evento reentraría a startLoop() durante tick() y duplicaría el requestAnimationFrame.
    function requestRender(){ needsRender = true; startLoop(); }
    controls.addEventListener('change', requestRender);

    function startLoop(){
      if(framePending || !inViewport || !pageVisible) return;
      framePending = true;
      clock.getDelta();
      rafId = requestAnimationFrame(tick);
    }
    function stopLoop(){
      if(rafId != null){ cancelAnimationFrame(rafId); rafId = null; }
      framePending = false;
    }

    function resize(){
      var w = stage.clientWidth, h = stage.clientHeight;
      if(!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    }
    if('ResizeObserver' in window){ new ResizeObserver(resize).observe(stage); }
    else{ window.addEventListener('resize', resize); }
    resize();

    var lastU = -1;
    var perfFrames = 0, perfTime = 0, perfStage = 0;
    function degrade(){
      if(perfStage === 0){
        // 1.º paso: sin sombras en tiempo real (lo más caro) y se conserva la sombra de contacto dibujada
        perfStage = 1;
        renderer.shadowMap.enabled = false;
        keyLight.castShadow = false;
        ground.visible = false;
        scene.traverse(function(o){ if(o.material){ (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){ m.needsUpdate = true; }); } });
      }else if(perfStage === 1){
        perfStage = 2;
        renderer.setPixelRatio(1);
        renderer.setSize(stage.clientWidth, stage.clientHeight, false);
      }
    }
    var firstFrame = true;
    function tick(){
      rafId = null;
      framePending = false;
      var delta = Math.min(clock.getDelta(), 1 / 30);
      var t0 = performance.now();
      var stillAnimating = false;
      if(idleRotateAllowed){
        group.rotation.y += delta * IDLE_SPIN_SPEED;
        needsRender = true;
        stillAnimating = true;
      }
      if(auto){
        cycleT = (cycleT + delta) % CYCLE;
        exploded = cycleValue(cycleT);
        if(slider && !dragging) slider.value = Math.round(exploded * 100);
        stillAnimating = true;
      }
      if(exploded !== lastU){ applyPose(exploded); lastU = exploded; needsRender = true; }
      if(controls.update(delta)){ needsRender = true; stillAnimating = true; }
      if(needsRender){
        applyFit();
        renderer.render(scene, camera);
        if(firstFrame && stage.classList.contains('is-ready')){ firstFrame = false; mark('first-frame'); }
        updateLabels();
        needsRender = false;
        if(perfStage < 2 && ++perfFrames > 8){   // se ignoran los primeros cuadros (calentamiento)
          perfTime += performance.now() - t0;
          if(perfFrames >= 48){
            if(perfTime / 40 > 9) degrade();       // más de ~9 ms de CPU por cuadro: se baja la calidad
            perfFrames = 0; perfTime = 0;
          }
        }
      }
      if(stillAnimating) startLoop();
    }

    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          inViewport = entry.isIntersecting;
          if(inViewport) requestRender(); else stopLoop();
        });
      }, { threshold:0.01 }).observe(stage);
    }
    document.addEventListener('visibilitychange', function(){
      pageVisible = document.visibilityState !== 'hidden';
      if(pageVisible) requestRender(); else stopLoop();
    });
  }
})();
