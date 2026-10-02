(function(){
  // Visor 3D del monoplaza SR-26 (despiece/sr26.glb) en el hero: gira solo, se arma y se desarma en bucle,
  // y se puede arrastrar para girar o mover el control para ver el despiece. NO secuestra el scroll de la página.
  // Perf: three.js + el .glb solo se descargan cuando el visor está por entrar en viewport y la página ya cargó;
  // hasta entonces se muestra el poster estático (car-poster.webp).
  var stage = document.getElementById('modelStage');
  if(!stage) return;
  function fail(){ stage.classList.add('no-3d'); }
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var TXT = EN
    ? { slider:'Exploded view of the car', assembled:'Assembled', exploded:'Exploded', pause:'Pause animation', play:'Play animation' }
    : { slider:'Despiece del auto', assembled:'Armado', exploded:'Despiece', pause:'Pausar animación', play:'Reanudar animación' };

  try{
    var testCanvas = document.createElement('canvas');
    var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if(!gl) return fail();
  }catch(e){ return fail(); }

  var booted = false;
  function whenIdle(fn){
    function go(){ if('requestIdleCallback' in window) requestIdleCallback(fn, { timeout:1500 }); else setTimeout(fn, 300); }
    if(document.readyState === 'complete') go(); else window.addEventListener('load', go, { once:true });
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

  async function boot(){
    stage.classList.add('is-loading');
    var THREE, GLTFLoaderMod, OrbitControlsMod, MeshoptMod, Look;
    try{
      THREE = await import('three');
      GLTFLoaderMod = await import('three/addons/loaders/GLTFLoader.js');
      OrbitControlsMod = await import('three/addons/controls/OrbitControls.js');
      try{ MeshoptMod = await import('three/addons/libs/meshopt_decoder.module.js'); }catch(e){ MeshoptMod = null; }
      Look = await import('./car-look.js');
    }catch(e){ return fail(); }

    try{
      initViewer(THREE, GLTFLoaderMod.GLTFLoader, OrbitControlsMod.OrbitControls, MeshoptMod && MeshoptMod.MeshoptDecoder, Look);
    }catch(e){ fail(); }
  }

  function initViewer(THREE, GLTFLoader, OrbitControls, MeshoptDecoder, Look){
    var LIVERY = Look.LIVERY, EXPLODE = Look.EXPLODE, STEPS = Look.EXPLODE_STEPS;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);

    var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    Look.lookRenderer(renderer);
    stage.appendChild(renderer.domElement);

    // Esta escena trabaja en metros (el GLB viene en metros), de ahí u = 0.001.
    Look.lookEnvironment(renderer, scene);
    Look.lookLights(scene, 0.001);
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
    function applyPose(u){
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        var d = (p.step - 1) / (STEPS - 1) * 0.45;
        var f = ease(clamp01((u - d) / 0.55));
        p.mesh.position.copy(p.home).addScaledVector(p.off, f);
        if(p.wheel) p.mesh.rotation.z = f * Math.PI * 2 * p.spin; // las llantas dan una vuelta al salir
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

    var loader = new GLTFLoader();
    if(MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(new URL('../despiece/sr26.glb?v=2', import.meta.url).href, function(gltf){
      var model = gltf.scene;

      // despiece/sr26.glb: metros, Y arriba, X hacia el frente. Un material por pieza con la librea de car-look.js.
      var meshes = [], byKey = {};
      model.traverse(function(obj){ if(obj.isMesh) meshes.push(obj); }); // lookPart agrega bujes a las llantas: se recorre una lista fija
      meshes.forEach(function(obj){
        var k = obj.name.slice(0, 2);
        Look.lookPart(obj, k, LIVERY[k] || '#CDDEEF');
        byKey[k] = obj;
        var ex = EXPLODE[k];
        if(ex){
          parts.push({ mesh:obj, home:obj.position.clone(), off:new THREE.Vector3(ex.off[0], ex.off[1], ex.off[2]).multiplyScalar(0.001),
                       step:ex.step, wheel:/^1[6-9]$/.test(k), spin:obj.position.z < 0 ? -1 : 1 });
        }
      });
      model.updateMatrixWorld(true);

      // Logo de Striker Racing sobre el auto (pontones y cubierta del motor). Si falla la carga, el auto se ve igual.
      Look.addLogoDecals(byKey, new URL('../logo.png', import.meta.url).href).then(function(){ needsRender = true; startLoop(); }).catch(function(){});

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
      stage.classList.remove('is-loading');
      stage.classList.add('is-ready');
      needsRender = true;
      startLoop();
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
    function tick(){
      rafId = null;
      framePending = false;
      var delta = Math.min(clock.getDelta(), 1 / 30);
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
        needsRender = false;
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
