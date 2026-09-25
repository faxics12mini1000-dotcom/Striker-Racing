(function(){
  // Configurador de logo (EXTRA): decal del logo del visitante sobre el auto 3D. Todo el
  // procesamiento ocurre en el navegador -- el archivo nunca se sube a un servidor (ver
  // privacidad.html). Carga three.js/GLB de forma perezosa, solo la primera vez que se abre el
  // diálogo, igual que el visor del hero.
  var openBtn = document.querySelector('[data-open="dlg-configurator"]');
  var dialog = document.getElementById('dlg-configurator');
  if(!openBtn || !dialog) return;

  var stage = document.getElementById('cfgStage');
  var fileInput = document.getElementById('cfgLogoInput');
  var tierSelect = document.getElementById('cfgTierSelect');
  var zoneSelect = document.getElementById('cfgZoneSelect');
  var uniformHint = document.getElementById('cfgUniformHint');
  var downloadBtn = document.getElementById('cfgDownloadBtn');

  var started = false;
  openBtn.addEventListener('click', function(){
    if(started) return;
    started = true;
    stage.classList.add('is-loading');
    boot().catch(function(){ stage.classList.add('no-3d'); });
  });

  function syncUniformHint(){
    var opt = tierSelect.options[tierSelect.selectedIndex];
    var isAutoTier = opt.value === 'aliado-tecnico' || opt.value === 'partner';
    uniformHint.hidden = isAutoTier;
    zoneSelect.value = opt.getAttribute('data-zone');
  }
  tierSelect.addEventListener('change', function(){
    syncUniformHint();
    zoneSelect.dispatchEvent(new Event('change'));
  });
  syncUniformHint();

  async function boot(){
    var THREE = await import('three');
    var { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    var { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    var RoomEnvironment = null;
    try{ RoomEnvironment = (await import('three/addons/environments/RoomEnvironment.js')).RoomEnvironment; }catch(e){}
    var MeshoptDecoder = null;
    try{ MeshoptDecoder = (await import('three/addons/libs/meshopt_decoder.module.js')).MeshoptDecoder; }catch(e){}

    var testCanvas = document.createElement('canvas');
    if(!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'))){
      stage.classList.add('no-3d');
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);

    if(RoomEnvironment){
      try{
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }catch(e){}
    }
    scene.add(new THREE.HemisphereLight(0xCDDEEF, 0x27125F, 1.1));
    var key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 6, 5);
    scene.add(key);
    var fillLight = new THREE.DirectionalLight(0xBFD4FF, 0.25);
    fillLight.position.set(-4, 2.5, 3);
    scene.add(fillLight);

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // minDistance/maxDistance se fijan más abajo, relativos al tamaño real del modelo (una vez
    // calculado `dist`): car.glb no está modelado en metros, así que un límite fijo tipo "20"
    // podía quedar más cerca que el near-plane calculado para ese mismo `dist` y dejar la cámara
    // recortando el auto entero (pantalla en blanco al exportar el PNG).

    // Material de librea: misma técnica que el visor del hero (pintura procedural por posición de
    // vértice, sin depender de UVs). Ver js/viewer.js para los comentarios extensos del
    // porqué de cada máscara; aquí se mantiene idéntico para que el color coincida.
    function makeLiveryMaterial(toModelSpace, bounds, wheels){
      var mat = new THREE.MeshPhysicalMaterial({ color:0x27125F, metalness:0.65, roughness:0.28, clearcoat:0.4, clearcoatRoughness:0.2, side:THREE.DoubleSide });
      mat.onBeforeCompile = function(shader){
        shader.uniforms.uToModelSpace = { value: toModelSpace };
        shader.uniforms.uMinX = { value: bounds.minX }; shader.uniforms.uMaxX = { value: bounds.maxX };
        shader.uniforms.uMinY = { value: bounds.minY }; shader.uniforms.uMaxY = { value: bounds.maxY };
        shader.uniforms.uFrontWheel = { value: new THREE.Vector3(wheels.front.cx, wheels.front.cz, wheels.front.r) };
        shader.uniforms.uRearWheel = { value: new THREE.Vector3(wheels.rear.cx, wheels.rear.cz, wheels.rear.r) };
        shader.uniforms.cBody = { value: new THREE.Color(0x27125F) };
        shader.uniforms.cAccent = { value: new THREE.Color(0x7138D4) };
        shader.uniforms.cSpeed = { value: new THREE.Color(0x3AF7B2) };
        shader.uniforms.cTire = { value: new THREE.Color(0x11161B) };
        shader.uniforms.cRim = { value: new THREE.Color(0x2B323B) };
        shader.vertexShader = 'uniform mat4 uToModelSpace;\nvarying vec3 vModelPos;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\n  vModelPos = (uToModelSpace * vec4(transformed, 1.0)).xyz;'
        );
        shader.fragmentShader = 'varying vec3 vModelPos;\nuniform float uMinX;\nuniform float uMaxX;\nuniform float uMinY;\nuniform float uMaxY;\nuniform vec3 uFrontWheel;\nuniform vec3 uRearWheel;\nuniform vec3 cBody;\nuniform vec3 cAccent;\nuniform vec3 cSpeed;\nuniform vec3 cTire;\nuniform vec3 cRim;\n' + shader.fragmentShader
          .replace('#include <color_fragment>',
            '#include <color_fragment>\n' +
            '  float t = clamp((uMaxX - vModelPos.x) / max(uMaxX - uMinX, 0.0001), 0.0, 1.0);\n' +
            '  float edge = abs((vModelPos.y - uMinY) / max(uMaxY - uMinY, 0.0001) - 0.5) * 2.0;\n' +
            '  float frontAxle = smoothstep(0.025, 0.045, t) * (1.0 - smoothstep(0.195, 0.215, t));\n' +
            '  float rearAxle = smoothstep(0.665, 0.685, t) * (1.0 - smoothstep(0.815, 0.835, t));\n' +
            '  float wheelEdge = smoothstep(0.30, 0.55, edge);\n' +
            '  float wheelMask = clamp((frontAxle + rearAxle) * wheelEdge, 0.0, 1.0);\n' +
            '  vec3 livery = cBody;\n' +
            '  float noseMask = 1.0 - smoothstep(0.02, 0.035, t);\n' +
            '  livery = mix(livery, cAccent, noseMask);\n' +
            '  float sideStripeSpan = smoothstep(0.24, 0.26, t) * (1.0 - smoothstep(0.60, 0.62, t));\n' +
            '  float sideStripeEdge = smoothstep(0.44, 0.48, edge) * (1.0 - smoothstep(0.52, 0.58, edge));\n' +
            '  livery = mix(livery, cAccent, sideStripeSpan * sideStripeEdge);\n' +
            '  float frontWingBand = 1.0 - smoothstep(0.012, 0.022, t);\n' +
            '  float rearWingBand = smoothstep(0.88, 0.90, t);\n' +
            '  float frontWingSide = smoothstep(0.48, 0.58, edge);\n' +
            '  float rearWingSide = smoothstep(0.55, 0.78, edge);\n' +
            '  float wingMask = frontWingBand * frontWingSide + rearWingBand * rearWingSide;\n' +
            '  livery = mix(livery, cSpeed, wingMask);\n' +
            '  vec2 wheelC = mix(uFrontWheel.xy, uRearWheel.xy, step(0.5, t));\n' +
            '  float wheelR = mix(uFrontWheel.z, uRearWheel.z, step(0.5, t));\n' +
            '  float wheelRad = length(vec2(vModelPos.x, vModelPos.z) - wheelC) / max(wheelR, 0.0001);\n' +
            '  float rimFactor = 1.0 - smoothstep(0.18, 0.36, wheelRad);\n' +
            '  vec3 wheelColor = mix(cTire, cRim, rimFactor);\n' +
            '  livery = mix(livery, wheelColor, wheelMask);\n' +
            '  diffuseColor.rgb = livery;\n'
          )
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  float wheelRough = mix(0.95, 0.38, rimFactor);\n  roughnessFactor = mix(roughnessFactor, wheelRough, wheelMask);\n')
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  float wheelMetal = mix(0.05, 0.70, rimFactor);\n  metalnessFactor = mix(metalnessFactor, wheelMetal, wheelMask);\n');
      };
      return mat;
    }

    var decalMesh = null;
    var modelRef = null, boundsRef = null;

    // Posición aproximada del decal por zona, en el espacio LOCAL original del .glb (mismo marco
    // que usa el shader de arriba: X=longitud nariz(max)->cola(min), Y=lateral, Z=altura). No es
    // un raycast conformado a la superficie (ver nota en el módulo del hero sobre por qué):
    // una placa plana ligeramente fuera de la carrocería es visualmente suficiente aquí y muchísimo
    // más robusta que proyectar un DecalGeometry sobre una malla sin UVs fiables.
    var ZONES = {
      'nose': { t:0.04, edge:0, height:0.32, face:'x' },
      'side-pontoon': { t:0.42, edge:1, height:0.5, face:'y' },
      'rear-wing': { t:0.93, edge:0.75, height:0.85, face:'y' },
    };

    function zoneLocalPosition(zoneKey){
      var z = ZONES[zoneKey] || ZONES.nose;
      var b = boundsRef;
      var centerY = (b.minY + b.maxY) / 2;
      var x = b.maxX - z.t * (b.maxX - b.minX);
      var y = centerY + z.edge * (b.maxY - centerY);
      var h = b.minZ + z.height * (b.maxZ - b.minZ);
      var marginX = 0.04 * (b.maxX - b.minX);
      var marginY = 0.04 * (b.maxY - b.minY);
      if(z.face === 'x') x += marginX; else y += marginY;
      return { pos: new THREE.Vector3(x, y, h), face: z.face };
    }

    function placeDecal(zoneKey){
      if(!decalMesh || !boundsRef) return;
      var z = zoneLocalPosition(zoneKey);
      decalMesh.position.copy(z.pos);
      decalMesh.rotation.set(0, 0, 0);
      if(z.face === 'x') decalMesh.rotation.y = -Math.PI / 2;
      else decalMesh.rotation.x = Math.PI / 2;
    }

    var loader = new GLTFLoader();
    if(MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(new URL('../car.glb', import.meta.url).href, function(gltf){
      var model = gltf.scene;
      model.traverse(function(obj){ if(obj.isMesh){ obj.geometry.computeBoundingBox(); obj.geometry.computeBoundingSphere(); } });

      var localBox = new THREE.Box3().setFromObject(model);
      var bounds = { minX:localBox.min.x, maxX:localBox.max.x, minY:localBox.min.y, maxY:localBox.max.y, minZ:localBox.min.z, maxZ:localBox.max.z };

      var scanMat = new THREE.Matrix4(), scanV = new THREE.Vector3();
      var frontB = { minX:Infinity, maxX:-Infinity, minZ:Infinity, maxZ:-Infinity };
      var rearB = { minX:Infinity, maxX:-Infinity, minZ:Infinity, maxZ:-Infinity };
      model.traverse(function(obj){
        if(!obj.isMesh) return;
        scanMat.copy(model.matrixWorld).invert().multiply(obj.matrixWorld);
        var pos = obj.geometry.attributes.position;
        for(var i = 0; i < pos.count; i++){
          scanV.fromBufferAttribute(pos, i).applyMatrix4(scanMat);
          var vt = (bounds.maxX - scanV.x) / (bounds.maxX - bounds.minX);
          var vEdge = Math.abs((scanV.y - bounds.minY) / (bounds.maxY - bounds.minY) - 0.5) * 2.0;
          if(vEdge < 0.35) continue;
          var b = vt > 0.03 && vt < 0.20 ? frontB : (vt > 0.665 && vt < 0.835 ? rearB : null);
          if(!b) continue;
          if(scanV.x < b.minX) b.minX = scanV.x; if(scanV.x > b.maxX) b.maxX = scanV.x;
          if(scanV.z < b.minZ) b.minZ = scanV.z; if(scanV.z > b.maxZ) b.maxZ = scanV.z;
        }
      });
      function wheelFrom(b){
        if(!isFinite(b.minX)) return { cx:0, cz:(bounds.minZ+bounds.maxZ)/2, r:Math.max((bounds.maxZ-bounds.minZ)/2,1) };
        return { cx:(b.minX+b.maxX)/2, cz:(b.minZ+b.maxZ)/2, r:Math.max(b.maxX-b.minX, b.maxZ-b.minZ)/2 };
      }
      var wheels = { front: wheelFrom(frontB), rear: wheelFrom(rearB) };

      model.rotation.x = Math.PI / 2;
      model.updateMatrixWorld(true);
      model.rotateOnWorldAxis(new THREE.Vector3(0,1,0), Math.PI);
      model.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);

      var toModel = new THREE.Matrix4();
      model.traverse(function(obj){
        if(obj.isMesh){
          if(!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
          toModel.copy(model.matrixWorld).invert().multiply(obj.matrixWorld);
          obj.material = makeLiveryMaterial(toModel.clone(), bounds, wheels);
        }
      });
      scene.add(model);
      modelRef = model;
      boundsRef = bounds;

      // Placa del decal (oculta hasta que se suba un logo): child de `model`, así hereda el
      // recentrado/reorientación automáticamente y no hay que recalcular su posición por frame.
      var decalGeo = new THREE.PlaneGeometry(size.x * 0.16, size.x * 0.16);
      // DoubleSide: el usuario orbita libremente la cámara, así que el decal debe verse desde
      // cualquier ángulo. Con textura + DoubleSide, three.js no voltea el mapeo UV de la cara
      // trasera, así que visto desde "atrás" el logo puede leerse en espejo -- limitación conocida
      // de esta vista previa aproximada (ver TODO-EQUIPO.md), no crítica para el propósito de la
      // herramienta (mostrar tamaño/color/ubicación relativa del logo, no un render final).
      var decalMat = new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false, toneMapped:false, side:THREE.DoubleSide });
      decalMesh = new THREE.Mesh(decalGeo, decalMat);
      decalMesh.renderOrder = 2;
      model.add(decalMesh);
      placeDecal(zoneSelect.value);

      var fitCorners = [];
      [-1,1].forEach(function(sx){ [-1,1].forEach(function(sy){ [-1,1].forEach(function(sz){
        fitCorners.push(new THREE.Vector3(sx*size.x/2, sy*size.y/2, sz*size.z/2));
      });});});
      var az = THREE.MathUtils.degToRad(35), el = THREE.MathUtils.degToRad(22);
      var dir = new THREE.Vector3(Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el));
      var vFov = THREE.MathUtils.degToRad(camera.fov/2);
      var maxH = 0, maxV = 0;
      var right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir).normalize();
      var up = new THREE.Vector3().crossVectors(dir, right).normalize();
      fitCorners.forEach(function(c){ maxH = Math.max(maxH, Math.abs(c.dot(right))); maxV = Math.max(maxV, Math.abs(c.dot(up))); });
      var hFov = Math.atan(Math.tan(vFov) * (stage.clientWidth / Math.max(stage.clientHeight,1)));
      var dist = Math.max(maxV/Math.tan(vFov), maxH/Math.tan(hFov)) * 1.5;
      camera.position.copy(dir.multiplyScalar(dist));
      camera.near = Math.max(dist*0.04, 0.05); camera.far = dist*20;
      camera.updateProjectionMatrix();
      controls.minDistance = dist * 0.3;
      controls.maxDistance = dist * 3;
      controls.target.set(0,0,0);
      controls.update();

      stage.classList.add('is-ready');
      renderOnce();
    }, undefined, function(){ stage.classList.add('no-3d'); });

    function resize(){
      var w = stage.clientWidth, h = stage.clientHeight;
      if(!w || !h) return;
      camera.aspect = w/h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderOnce();
    }
    if('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    resize();

    var needsRender = true;
    function renderOnce(){ needsRender = true; }
    controls.addEventListener('change', renderOnce);
    (function loop(){
      requestAnimationFrame(loop);
      if(dialog.open && needsRender){
        controls.update();
        renderer.render(scene, camera);
        needsRender = false;
      }
    })();

    zoneSelect.addEventListener('change', function(){ placeDecal(zoneSelect.value); renderOnce(); });

    fileInput.addEventListener('change', function(){
      var file = fileInput.files && fileInput.files[0];
      if(!file) return;
      var img = new Image();
      img.onload = function(){
        var tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        if('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
        if(decalMesh){
          var aspect = img.naturalWidth / img.naturalHeight;
          var baseSize = boundsRef ? (boundsRef.maxX - boundsRef.minX) * 0.16 : 1;
          decalMesh.geometry.dispose();
          decalMesh.geometry = new THREE.PlaneGeometry(baseSize * Math.max(aspect,1), baseSize / Math.max(aspect,1));
          decalMesh.material.map = tex;
          decalMesh.material.opacity = 1;
          decalMesh.material.needsUpdate = true;
        }
        downloadBtn.disabled = false;
        renderOnce();
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

    downloadBtn.addEventListener('click', function(){
      controls.update();
      renderer.render(scene, camera);
      var url = renderer.domElement.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'striker-racing-configurador.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
})();
