(function(){
  // Visor 3D del monoplaza con librea de marca (degradado nariz→chasis→alerón, sin necesitar UVs).
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
    var THREE, GLTFLoaderMod, OrbitControlsMod, RoomEnvMod, MeshoptMod;
    try{
      THREE = await import('three');
      GLTFLoaderMod = await import('three/addons/loaders/GLTFLoader.js');
      OrbitControlsMod = await import('three/addons/controls/OrbitControls.js');
      try{ RoomEnvMod = await import('three/addons/environments/RoomEnvironment.js'); }catch(e){ RoomEnvMod = null; }
      try{ MeshoptMod = await import('three/addons/libs/meshopt_decoder.module.js'); }catch(e){ MeshoptMod = null; }
    }catch(e){ return fail(); }

    try{
      initViewer(THREE, GLTFLoaderMod.GLTFLoader, OrbitControlsMod.OrbitControls, RoomEnvMod && RoomEnvMod.RoomEnvironment, MeshoptMod && MeshoptMod.MeshoptDecoder);
    }catch(e){ fail(); }
  }

  function initViewer(THREE, GLTFLoader, OrbitControls, RoomEnvironment, MeshoptDecoder){
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
    // Ambiente casi apagado (el IBL también se atenúa en makeLiveryMaterial) para que el contraste
    // lo den solo dos luces de firma: un key cenital blanco frío que recorta la arista superior del
    // chasis y un rim trasero cian/menta que perfila el alerón trasero.
    scene.add(new THREE.HemisphereLight(0x9DB8D6, 0x071B33, 0.32));
    var key = new THREE.DirectionalLight(0xEAF4FF, 2.6); // key cenital, blanco frío
    key.position.set(0.6, 10, 1.4);
    scene.add(key);
    var rimLight = new THREE.DirectionalLight(0x4DF0C8, 2.4); // rim trasero cian/menta
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
    if(MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder); // car.glb va comprimido con EXT_meshopt_compression
    loader.load(new URL('../car.glb', import.meta.url).href, function(gltf){
      var model = gltf.scene;

      // El .glb trae en los accessors un bounding box cacheado que quedó desalineado del eje
      // real de los vértices (metadata vieja de antes de la conversión Z-up -> Y-up). GLTFLoader
      // usa esa caja tal cual si existe, así que la recalculamos desde el buffer real para que el
      // encuadre de la cámara y la reorientación partan de las dimensiones correctas.
      model.traverse(function(obj){
        if(obj.isMesh){ obj.geometry.computeBoundingBox(); obj.geometry.computeBoundingSphere(); }
      });

      // Caja en el espacio LOCAL original del .glb (antes de reorientar `model`, con su matriz aún
      // en identidad): eje X = longitud (nariz→cola), eje Y = ancho lateral, eje Z = altura real.
      // Esta caja es el marco de referencia FIJO para pintar la librea -- ver toModelSpace abajo,
      // que ubica a cada sub-malla (carrocería, llantas, alerón, cada una con su propio origen
      // local en el .glb) dentro de este mismo marco, sin importar el giro idle del auto.
      var localBox = new THREE.Box3().setFromObject(model);
      var lMinX = localBox.min.x, lMaxX = localBox.max.x; // longitud
      var lMinY = localBox.min.y, lMaxY = localBox.max.y; // ancho lateral
      var lMinZ = localBox.min.z, lMaxZ = localBox.max.z; // altura real

      // Mide la geometría REAL de las 4 llantas (centro y radio en el plano X-Z, el plano de giro
      // de la rueda ya que el eje de rotación es lateral/Y) recorriendo los vértices que caen en la
      // franja delantera/trasera donde el auto alcanza su ancho total (perfil medido con bins: el
      // ancho salta al máximo SOLO en las 4 llantas, nunca en la carrocería entre ejes). Se usa para
      // separar con precisión el rin (disco metálico central) del neumático (banda exterior) más
      // abajo en el shader, sin depender de sub-mallas por pieza (el .glb no las trae).
      var wheelScanMat = new THREE.Matrix4();
      var wheelScanV = new THREE.Vector3();
      var frontWheelBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      var rearWheelBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      model.traverse(function(obj){
        if(!obj.isMesh) return;
        wheelScanMat.copy(model.matrixWorld).invert().multiply(obj.matrixWorld);
        var posAttr = obj.geometry.attributes.position;
        for(var vi = 0; vi < posAttr.count; vi++){
          wheelScanV.fromBufferAttribute(posAttr, vi).applyMatrix4(wheelScanMat);
          var vt = (lMaxX - wheelScanV.x) / (lMaxX - lMinX);
          var vEdge = Math.abs((wheelScanV.y - lMinY) / (lMaxY - lMinY) - 0.5) * 2.0;
          if(vEdge < 0.35) continue; // fuera de la franja lateral donde viven las llantas
          var bounds = null;
          if(vt > 0.03 && vt < 0.20) bounds = frontWheelBounds;
          else if(vt > 0.665 && vt < 0.835) bounds = rearWheelBounds;
          if(!bounds) continue;
          if(wheelScanV.x < bounds.minX) bounds.minX = wheelScanV.x;
          if(wheelScanV.x > bounds.maxX) bounds.maxX = wheelScanV.x;
          if(wheelScanV.z < bounds.minZ) bounds.minZ = wheelScanV.z;
          if(wheelScanV.z > bounds.maxZ) bounds.maxZ = wheelScanV.z;
        }
      });
      function wheelGeomFromBounds(b){
        if(!isFinite(b.minX)) return { cx: 0, cz: (lMinZ + lMaxZ) / 2, r: Math.max((lMaxZ - lMinZ) / 2, 1) };
        return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, r: Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 };
      }
      var frontWheelGeom = wheelGeomFromBounds(frontWheelBounds);
      var rearWheelGeom = wheelGeomFromBounds(rearWheelBounds);

      // Reorienta el auto para que descanse horizontal sobre sus 4 ruedas: la altura real (Z local)
      // pasa a ser "arriba" (Y de three.js) y el ancho (Y local) pasa a ser el eje lateral (Z de
      // three.js). Rotación de +90° en X intercambia Y/Z sin tocar la longitud (X) -- con -90° el
      // piso (plano liso) quedaba arriba y la cabina/cockpit abajo (auto "de cabeza"); +90° es el
      // sentido que deja el piso abajo y la carrocería arriba.
      model.rotation.x = Math.PI / 2;
      model.updateMatrixWorld(true);

      // El modelo quedaba con la nariz apuntando lejos de la cámara (alerón/cola hacia el frente).
      // Se gira 180° sobre el eje Y del MUNDO (ya vertical tras el tilt anterior) para que la
      // trompa quede orientada hacia la cámara en la vista de 3/4 inicial. rotateOnWorldAxis (en
      // vez de sumar a rotation.y) evita que se enrede con la rotación en X ya aplicada, así el
      // auto se mantiene perfectamente horizontal. Se hace ANTES de calcular la caja/centro para
      // que el recentrado de más abajo parta ya de la orientación final.
      model.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.PI);
      model.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(model); // caja MUNDIAL ya horizontal, para encuadre/sombra
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());

      model.position.sub(center); // centra el auto en el origen para orbitar/girar limpio
      model.updateMatrixWorld(true); // refresca matrixWorld ya centrado, antes de derivar toModelSpace por sub-malla

      // Crea un material de librea POR sub-malla: cada uno recibe `toModelSpace`, la matriz que
      // convierte sus vértices (en el espacio local de ESA malla) al marco fijo de `localBox`.
      // `toModelSpace = model.matrixWorld^-1 * obj.matrixWorld` cancela algebraicamente tanto la
      // matriz de `model` (rotación/centrado) como la de sus ancestros -- incluido `group`, cuyo
      // giro idle (`group.rotation.y`) cambia cada frame -- así que el resultado es estable aunque
      // el auto esté girando, y corrige el desalineamiento entre piezas con distinto origen local.
      function makeLiveryMaterial(toModelSpace){
        var mat = new THREE.MeshPhysicalMaterial({
          color: 0x0F2547, metalness:0.65, roughness:0.28, clearcoat:0.4, clearcoatRoughness:0.2,
          side: THREE.DoubleSide // el STL de origen trae normales/orientación poco fiables
        });
        mat.envMapIntensity = 0.3; // penumbra: el entorno solo aporta un reflejo tenue
        mat.onBeforeCompile = function(shader){
          shader.uniforms.uToModelSpace = { value: toModelSpace };
          shader.uniforms.uMinX = { value: lMinX };
          shader.uniforms.uMaxX = { value: lMaxX };
          shader.uniforms.uMinY = { value: lMinY };
          shader.uniforms.uMaxY = { value: lMaxY };
          shader.uniforms.uFrontWheel = { value: new THREE.Vector3(frontWheelGeom.cx, frontWheelGeom.cz, frontWheelGeom.r) };
          shader.uniforms.uRearWheel = { value: new THREE.Vector3(rearWheelGeom.cx, rearWheelGeom.cz, rearWheelGeom.r) };
          shader.uniforms.cBody = { value: new THREE.Color(0x0F2547) }; // azul marino profundo (carrocería, color base único)
          shader.uniforms.cAccent = { value: new THREE.Color(0x7138D4) }; // morado celta de acento (nariz, franja lateral)
          shader.uniforms.cSpeed = { value: new THREE.Color(0x3AF7B2) }; // verde menta neón (flaps/endplates de alerones)
          shader.uniforms.cTire = { value: new THREE.Color(0x11161B) }; // negro mate puro (caucho del neumático)
          shader.uniforms.cRim = { value: new THREE.Color(0x2B323B) }; // grafito/titanio técnico automotriz (cubo del rin)
          shader.vertexShader = 'uniform mat4 uToModelSpace;\nvarying vec3 vModelPos;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n  vModelPos = (uToModelSpace * vec4(transformed, 1.0)).xyz;'
          );
          shader.fragmentShader = 'varying vec3 vModelPos;\nuniform float uMinX;\nuniform float uMaxX;\nuniform float uMinY;\nuniform float uMaxY;\nuniform vec3 uFrontWheel;\nuniform vec3 uRearWheel;\nuniform vec3 cBody;\nuniform vec3 cAccent;\nuniform vec3 cSpeed;\nuniform vec3 cTire;\nuniform vec3 cRim;\n' + shader.fragmentShader
            .replace(
              '#include <color_fragment>',
              '#include <color_fragment>\n' +
              '  float t = clamp((uMaxX - vModelPos.x) / max(uMaxX - uMinX, 0.0001), 0.0, 1.0);\n' + // 0 nariz -> 1 cola
              '  float edge = abs((vModelPos.y - uMinY) / max(uMaxY - uMinY, 0.0001) - 0.5) * 2.0;\n' + // 0 centro -> 1 borde lateral
              // Llantas: rango de `t` medido de los vértices reales (ver frontWheelBounds/rearWheelBounds
              // en JS) -- el auto solo alcanza su ANCHO TOTAL en las 4 llantas (0.03-0.20 y 0.665-0.835);
              // el resto de la carrocería es siempre más angosto. Usar el rango correcto es lo que evita
              // que la pintura de nariz/alerón se filtre sobre las llantas.
              '  float frontAxle = smoothstep(0.025, 0.045, t) * (1.0 - smoothstep(0.195, 0.215, t));\n' +
              '  float rearAxle = smoothstep(0.665, 0.685, t) * (1.0 - smoothstep(0.815, 0.835, t));\n' +
              '  float wheelEdge = smoothstep(0.30, 0.55, edge);\n' +
              '  float wheelMask = clamp((frontAxle + rearAxle) * wheelEdge, 0.0, 1.0);\n' +
              '  vec3 livery = cBody;\n' + // pintura sólida uniforme: sin degradados ni parches en el resto del chasis
              '  float noseMask = 1.0 - smoothstep(0.02, 0.035, t);\n' + // punta delantera, se corta justo antes de la llanta
              '  livery = mix(livery, cAccent, noseMask);\n' +
              // Franja deportiva azul de acento a lo largo de pontones laterales / cubierta superior,
              // SOLO entre ejes (nunca sobre las llantas ni sobre nariz/alerón). Trazo nítido y delgado,
              // ceñido al lateral central del monoplaza (sin invadir el suelo ni las llantas).
              '  float sideStripeSpan = smoothstep(0.24, 0.26, t) * (1.0 - smoothstep(0.60, 0.62, t));\n' +
              '  float sideStripeEdge = smoothstep(0.44, 0.48, edge) * (1.0 - smoothstep(0.52, 0.58, edge));\n' +
              '  float sideStripeMask = sideStripeSpan * sideStripeEdge;\n' +
              '  livery = mix(livery, cAccent, sideStripeMask);\n' +
              // Trazo nítido de verde esmeralda en los extremos laterales de los endplates, delanteros
              // (t < 0.02) y traseros (t > 0.90), nunca cruza el centro de nariz/cola.
              '  float frontWingBand = 1.0 - smoothstep(0.012, 0.022, t);\n' +
              '  float rearWingBand = smoothstep(0.88, 0.90, t);\n' +
              // El alerón delantero es más angosto que el trasero (su borde lateral real llega a
              // edge~0.6, no ~0.85), así que su banda de verde usa un umbral más bajo para no quedar
              // invisible.
              '  float frontWingSide = smoothstep(0.48, 0.58, edge);\n' +
              '  float rearWingSide = smoothstep(0.55, 0.78, edge);\n' +
              '  float wingMask = frontWingBand * frontWingSide + rearWingBand * rearWingSide;\n' +
              '  livery = mix(livery, cSpeed, wingMask);\n' +
              // Llantas: SIEMPRE tienen prioridad final sobre nariz/franja/alerones. Dentro de la llanta,
              // la distancia radial al centro medido de cada eje (plano X-Z, el plano de giro real de la
              // rueda) separa el rin metálico (radio pequeño, solo cubo central y zona de tuerca/eje) del
              // neumático de caucho negro mate (radio grande, banda exterior) con un corte nítido de
              // competición -- así el rin gana profundidad mecánica en vez de verse como un disco plano.
              '  vec2 wheelC = mix(uFrontWheel.xy, uRearWheel.xy, step(0.5, t));\n' +
              '  float wheelR = mix(uFrontWheel.z, uRearWheel.z, step(0.5, t));\n' +
              '  float wheelRad = length(vec2(vModelPos.x, vModelPos.z) - wheelC) / max(wheelR, 0.0001);\n' +
              '  float rimFactor = 1.0 - smoothstep(0.18, 0.36, wheelRad);\n' + // 1 = cubo/tuerca central, 0 = neumático (concentra el metal, evita la plasta circular)
              '  vec3 wheelColor = mix(cTire, cRim, rimFactor);\n' +
              '  livery = mix(livery, wheelColor, wheelMask);\n' +
              '  diffuseColor.rgb = livery;\n'
            )
            .replace(
              '#include <roughnessmap_fragment>',
              '#include <roughnessmap_fragment>\n' +
              '  float wheelRough = mix(0.95, 0.38, rimFactor);\n' + // neumático mate puro / rin grafito técnico semi-mate
              '  roughnessFactor = mix(roughnessFactor, wheelRough, wheelMask);\n'
            )
            .replace(
              '#include <metalnessmap_fragment>',
              '#include <metalnessmap_fragment>\n' +
              '  float wheelMetal = mix(0.05, 0.70, rimFactor);\n' + // neumático no metálico / rin metálico automotriz
              '  metalnessFactor = mix(metalnessFactor, wheelMetal, wheelMask);\n'
            );
        };
        return mat;
      }

      var toModel = new THREE.Matrix4();
      model.traverse(function(obj){
        if(obj.isMesh){
          // El STL de origen no trae normales: las calculamos para que la iluminación funcione.
          if(!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
          toModel.copy(model.matrixWorld).invert().multiply(obj.matrixWorld);
          obj.material = makeLiveryMaterial(toModel.clone());
        }
      });
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
