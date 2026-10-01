(function(){
  // Visor 3D del monoplaza SR-26 (despiece/sr26.glb) con la librea plana por pieza de despiece/sr26-despiece.js.
  // Perf: three.js + el .glb solo se descargan cuando el visor está por entrar en viewport (ver
  // bootWhenNear más abajo) -- hasta entonces se muestra el poster estático (car-poster.webp).
  var stage = document.getElementById('modelStage');
  if(!stage) return;
  function fail(){ stage.classList.add('no-3d'); }

  try{
    var testCanvas = document.createElement('canvas');
    var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if(!gl) return fail();
  }catch(e){ return fail(); }

  var booted = false;
  function bootWhenNear(){
    if(booted) return;
    booted = true;
    boot();
  }
  if('IntersectionObserver' in window){
    var bootIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ bootIO.disconnect(); bootWhenNear(); }
      });
    }, { rootMargin:'200px 0px' });
    bootIO.observe(stage);
  }else{
    bootWhenNear(); // sin IntersectionObserver, se carga de inmediato (mejor que quedarse sin visor)
  }

  async function boot(){
    stage.classList.add('is-loading');
    var THREE, GLTFLoaderMod, OrbitControlsMod, RoomEnvMod, MeshoptMod, DespieceMod;
    try{
      THREE = await import('three');
      GLTFLoaderMod = await import('three/addons/loaders/GLTFLoader.js');
      OrbitControlsMod = await import('three/addons/controls/OrbitControls.js');
      try{ RoomEnvMod = await import('three/addons/environments/RoomEnvironment.js'); }catch(e){ RoomEnvMod = null; }
      try{ MeshoptMod = await import('three/addons/libs/meshopt_decoder.module.js'); }catch(e){ MeshoptMod = null; }
      DespieceMod = await import('../despiece/sr26-despiece.js'); // solo para reutilizar LIVERY
    }catch(e){ return fail(); }

    try{
      initViewer(THREE, GLTFLoaderMod.GLTFLoader, OrbitControlsMod.OrbitControls, RoomEnvMod && RoomEnvMod.RoomEnvironment, MeshoptMod && MeshoptMod.MeshoptDecoder, DespieceMod.LIVERY);
    }catch(e){ fail(); }
  }

  function initViewer(THREE, GLTFLoader, OrbitControls, RoomEnvironment, MeshoptDecoder, LIVERY){
    function liveryFor(name){ return LIVERY[name.slice(0, 2)] || '#CDDEEF'; }
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);

    var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // tope 1.5: ahorra fillrate en pantallas retina/4K
    if('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);

    // Entorno de iluminación (IBL) para que el acabado metálico/clearcoat no se vea negro.
    if(RoomEnvironment){
      try{
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }catch(e){ /* sin entorno, se usan solo las luces directas */ }
    }

    // Iluminación de galería: el monoplaza se lee como una escultura en penumbra.
    // Ambiente casi apagado para que el contraste
    // lo den solo dos luces de firma: un key cenital blanco frío que recorta la arista superior del
    // chasis y un rim trasero blanco frío/ice que perfila el alerón trasero.
    scene.add(new THREE.HemisphereLight(0xCFE0F5, 0x1A2A52, 0.9));
    var key = new THREE.DirectionalLight(0xEAF4FF, 2.6); // key cenital, blanco frío
    key.position.set(0.6, 10, 1.4);
    scene.add(key);
    var rimLight = new THREE.DirectionalLight(0xCDDEEF, 2.4); // rim trasero blanco frío/ice
    rimLight.position.set(-3, 2.4, -8);
    scene.add(rimLight);
    var fillLight = new THREE.DirectionalLight(0x8FB4FF, 0.14); // relleno mínimo: evita la nariz en negro absoluto
    fillLight.position.set(-4, 2, 4);
    scene.add(fillLight);

    var group = new THREE.Group();
    scene.add(group);

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false; // evita "secuestrar" el scroll de la página
    controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(150);
    controls.rotateSpeed = 0.85;
    controls.autoRotate = false; // el giro idle mueve el AUTO (group.rotation.y), no la cámara: ver animate()
    var IDLE_SPIN_SPEED = 0.15; // rad/s — auto girando sobre su eje vertical, como en una plataforma de exhibición

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

    // --- Encuadre: ajusta la DISTANCIA de la cámara (no solo el FOV/aspect) para que el auto
    // llene ~75% del canvas sin importar el ángulo de órbita actual ni el tamaño del contenedor.
    var fitCorners = null; // 8 esquinas del bounding box, ya centrado en el origen
    var worldUp = new THREE.Vector3(0, 1, 0);
    var FIT_MARGIN = 1.3; // >1 dorado de margen; ~1.3 deja al auto llenando ~75-80% del cuadro

    var fitCornerScratch = new THREE.Vector3();
    function computeFitDistance(){
      var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if(dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
      var right = new THREE.Vector3().crossVectors(worldUp, dir);
      if(right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();
      var up = new THREE.Vector3().crossVectors(dir, right).normalize();

      // Los corners están en espacio LOCAL del auto (centrado en el origen); como el auto gira sobre
      // group.rotation.y en el idle, se rotan aquí a su orientación mundial actual antes de proyectarlos.
      var maxH = 0, maxV = 0;
      for(var i = 0; i < fitCorners.length; i++){
        var c = fitCornerScratch.copy(fitCorners[i]).applyQuaternion(group.quaternion);
        var h = Math.abs(c.dot(right));
        var v = Math.abs(c.dot(up));
        if(h > maxH) maxH = h;
        if(v > maxV) maxV = v;
      }
      var vFov = THREE.MathUtils.degToRad(camera.fov / 2);
      var hFov = Math.atan(Math.tan(vFov) * camera.aspect);
      var distV = maxV / Math.tan(vFov);
      var distH = maxH / Math.tan(hFov);
      return Math.max(distV, distH) * FIT_MARGIN;
    }

    function applyFit(){
      if(!fitCorners) return;
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
    if(MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder); // por si el GLB trae EXT_meshopt_compression
    loader.load(new URL('../despiece/sr26.glb', import.meta.url).href, function(gltf){
      var model = gltf.scene;

      // despiece/sr26.glb: metros, Y arriba, X hacia el frente, centrado en X. Sin reorientar.
      // Material plano por pieza con la librea de LIVERY (misma paleta del despiece, sin degradados).
      model.traverse(function(obj){
        if(!obj.isMesh) return;
        obj.geometry.computeBoundingBox(); obj.geometry.computeBoundingSphere();
        if(!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
        obj.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(liveryFor(obj.name)), roughness:0.55, metalness:0.04 });
      });
      model.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      model.position.sub(center); // centra el auto en el origen para orbitar/girar limpio
      model.updateMatrixWorld(true);

      group.add(model);

      // Sombra de contacto: plano con textura de degradado radial, apoyado justo bajo el auto,
      // para que no se vea flotando.
      var shadowTex = makeContactShadowTexture();
      var shadowGeo = new THREE.PlaneGeometry(size.x * 1.3, size.z * 1.8);
      var shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent:true, opacity:0.8, depthWrite:false, toneMapped:false });
      var shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = -size.y / 2 + 0.01;
      shadowMesh.renderOrder = -1;
      group.add(shadowMesh);

      // Peana: anillo de 1px que ancla la escultura al piso del estudio.
      var plinthR = size.x * 0.62;
      var plinth = new THREE.Mesh(
        new THREE.RingGeometry(plinthR, plinthR * 1.006, 96),
        new THREE.MeshBasicMaterial({ color:0xCDDEEF, transparent:true, opacity:0.22, depthWrite:false, toneMapped:false, side:THREE.DoubleSide })
      );
      plinth.rotation.x = -Math.PI / 2;
      plinth.position.y = -size.y / 2 + 0.02;
      plinth.renderOrder = -1;
      group.add(plinth);

      // Encuadre inicial: vista de 3/4 clásica, y a partir de aquí el loop de animación mantiene
      // el ~75% de llenado sin importar hacia dónde se orbite ni el resize del contenedor.
      fitCorners = [];
      [-1, 1].forEach(function(sx){
        [-1, 1].forEach(function(sy){
          [-1, 1].forEach(function(sz){
            fitCorners.push(new THREE.Vector3(sx * size.x / 2, sy * size.y / 2, sz * size.z / 2));
          });
        });
      });
      var az = THREE.MathUtils.degToRad(35);
      var el = THREE.MathUtils.degToRad(26); // 3/4 superior deportivo: se ven ancho, cabina y 4 ruedas al girar
      camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      controls.target.set(0, 0, 0);
      applyFit();
      controls.update();

      idleRotateAllowed = !reduceMotion;
      stage.classList.remove('is-loading');
      stage.classList.add('is-ready');
      needsRender = true;
      startLoop();
    }, undefined, function(){ fail(); });

    // ---------- RENDER ON-DEMAND + PAUSA FUERA DE VIEWPORT / PESTAÑA OCULTA ----------
    // El giro idle es continuo mientras el visor es visible y con motion permitido (needsRender se
    // marca cada frame); en reduced-motion o si el usuario no interactúa, el loop se detiene solo
    // (no vuelve a pedir rAF) hasta el próximo evento real (orbit, resize, cambio de visibilidad).
    var inViewport = true; // el bootstrap solo llega aquí cuando el stage ya está cerca del viewport
    var pageVisible = document.visibilityState !== 'hidden';
    var rafId = null;
    var framePending = false; // true entre el requestAnimationFrame() y el momento en que tick() arranca
    var needsRender = true;
    var clock = new THREE.Clock();

    // OrbitControls dispara 'change' de forma SÍNCRONA dentro de su propio update() (ver
    // OrbitControls.js) -- incluido cuando `applyFit()` reposiciona la cámara cada frame para
    // mantener el encuadre. Sin la guarda de `framePending`, ese 'change' reentraría a
    // startLoop() DURANTE el propio tick() y, sumado al re-encolado de más abajo, duplicaba el
    // requestAnimationFrame en cada frame (explosión exponencial de callbacks -> pestaña colgada).
    function requestRender(){ needsRender = true; startLoop(); }
    controls.addEventListener('change', requestRender);

    function startLoop(){
      if(framePending || !inViewport || !pageVisible) return;
      framePending = true;
      clock.getDelta(); // descarta el tiempo acumulado mientras estuvo pausado
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

    function tick(){
      rafId = null;
      framePending = false; // este frame ya llegó; cualquier re-encolado de aquí en adelante es nuevo
      // Se limita el delta para que un frame retrasado (pestaña en segundo plano, hitch del
      // navegador) no produzca un salto grande en el auto-giro.
      var delta = Math.min(clock.getDelta(), 1 / 30);
      var stillAnimating = false;
      if(idleRotateAllowed){
        group.rotation.y += delta * IDLE_SPIN_SPEED; // plataforma giratoria: gira el auto, no la cámara
        needsRender = true;
        stillAnimating = true;
      }
      // controls.update() puede disparar 'change' (ver comentario arriba de requestRender): si lo
      // hace, startLoop() ya deja framePending=true aquí mismo, así que el startLoop() de abajo
      // (guardado por framePending) no vuelve a encolar un segundo requestAnimationFrame.
      if(controls.update(delta)){ needsRender = true; stillAnimating = true; }
      if(needsRender){
        applyFit(); // recalcula la distancia para el ángulo/aspect actuales: mantiene el llenado del cuadro
        renderer.render(scene, camera);
        needsRender = false;
      }
      if(stillAnimating) startLoop(); // giro continuo o damping asentando: se re-encola solo (una vez)
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
