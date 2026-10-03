import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as Look from './car-look.js';

/* js/stage.js decide cuándo cargar este módulo (póster, video o 3D, según pantalla y conexión) y llama a mount(stage). */
export function mount(stage){
  // Visor 3D del monoplaza SR-26 (assets/models/sr26.glb) en /auto/: gira solo, se arma y se desarma en bucle,
  // y se puede arrastrar para girar o mover el control para ver el despiece. NO secuestra el scroll de la página.
  // Carga: este bundle se pide con modulepreload y el GLB con preload (solo en pantallas > 560 px y sin ahorro de datos); al terminar de
  // pintar el poster (idéntico al primer cuadro del visor) se descargan/parsean en paralelo el GLB, el entorno horneado y el logo,
  // y el canvas se funde sobre el poster.
  function fail(){ stage.classList.add('no-3d'); }
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var TXT = EN
    ? { slider:'Exploded view of the car', assembled:'Assembled', exploded:'Exploded', pause:'Pause animation', play:'Play animation',
        steps:['Wheels & axles', 'Wings & nose', 'Sidepods', 'Pillar, halo & helmet', 'CO₂ cartridge'], group:'3D viewer controls', stepGo:'Show up to step ',
        views:{ iso:['ISO', 'ISO'], side:['SIDE', 'SIDE'], front:['FRONT', 'FRT'], top:['TOP', 'TOP'] }, viewsLabel:'Camera views', viewLabel:'View: ',
        fsOn:'Full screen', fsOff:'Exit full screen' }
    : { slider:'Despiece del auto', assembled:'Armado', exploded:'Despiece', pause:'Pausar animación', play:'Reanudar animación',
        steps:['Llantas y ejes', 'Alerones y nariz', 'Pontones', 'Pilar, halo y casco', 'Cartucho CO₂'], group:'Controles del visor 3D', stepGo:'Ver hasta la etapa ',
        views:{ iso:['ISO', 'ISO'], side:['LATERAL', 'LAT'], front:['FRENTE', 'FRE'], top:['ARRIBA', 'SUP'] }, viewsLabel:'Vistas de cámara', viewLabel:'Vista: ',
        fsOn:'Pantalla completa', fsOff:'Salir de pantalla completa' };
  // Pieza que ancla la etiqueta de cada etapa (clave del nodo en el GLB)
  var LABEL_KEYS = ['17', '05', '02', '24', '15'];
  var URLS = {
    model: stage.dataset.model || '/assets/models/sr26.glb',
    env: stage.dataset.env || '/assets/models/env-room.png',
    logo: stage.dataset.logo || '/logo.png'
  };

  try{
    var testCanvas = document.createElement('canvas');
    var gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if(!gl) return fail();
  }catch(e){ return fail(); }

  // /auto/?still congela el visor en su primer cuadro (sin giro ni ciclo): scripts/generate-poster.mjs lo captura como poster.
  var STILL = /[?&]still(=|&|$)/.test(location.search);
  var mark = function(n){ try{ performance.mark('sr26:' + n); }catch(e){} };
  var barFill = stage.querySelector('.model-bar i');
  var progress = 0;
  // Progreso real por fases: descarga del GLB (por bytes) 5–50 %, parseo 50–62 %, piezas y logo 62–82 %, shaders 82–100 %.
  function setProgress(p){
    if(p <= progress) return;
    progress = Math.min(1, p);
    if(barFill) barFill.style.transform = 'scaleX(' + progress.toFixed(3) + ')';
  }

  function fetchGlb(url, onProgress){
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error('glb ' + res.status);
      var total = +res.headers.get('content-length') || 0;
      if(!res.body || !total) return res.arrayBuffer().then(function(b){ onProgress(1); return b; });
      var reader = res.body.getReader(), chunks = [], got = 0;
      function pump(){
        return reader.read().then(function(r){
          if(r.done){
            var out = new Uint8Array(got), o = 0;
            chunks.forEach(function(c){ out.set(c, o); o += c.length; });
            return out.buffer;
          }
          chunks.push(r.value); got += r.value.length; onProgress(Math.min(1, got / total));
          return pump();
        });
      }
      return pump();
    });
  }

  async function boot(){
    mark('boot');
    stage.classList.add('is-loading');
    setProgress(0.05);
    // Todo lo de red arranca ya y en paralelo: GLB (con progreso), logo + fuentes de los decals y entorno horneado.
    var glbP = fetchGlb(URLS.model, function(f){ setProgress(0.05 + f * 0.45); });
    var decalsP = Look.preloadDecalAssets(URLS.logo).catch(function(){ return null; });
    glbP.catch(function(){});
    try{
      initViewer(glbP, decalsP);
    }catch(e){ fail(); }
  }

  function initViewer(glbP, decalsP){
    var STEPS = Look.EXPLODE_STEPS, PIECES = Look.PIECES;
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
    var canvas = renderer.domElement;

    // Esta escena trabaja en metros (el GLB viene en metros), de ahí u = 0.001.
    mark('renderer');
    // Entorno prefiltrado y horneado (16 KB); si falla se genera el PMREM en el cliente.
    var envP = Look.lookEnvironmentBaked(scene, URLS.env).catch(function(){ return Look.lookEnvironment(renderer, scene); }).then(function(){ mark('env'); });
    var keyLight = Look.lookLights(scene, 0.001, !lowEnd);
    var ground = Look.lookGround(scene, 0.001);

    var group = new THREE.Group();
    scene.add(group);

    var reduceMotion = STILL || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.enableZoom = false; // la rueda del mouse sigue haciendo scroll de la página
    controls.minPolarAngle = THREE.MathUtils.degToRad(15);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(150);
    controls.rotateSpeed = 0.8;
    controls.autoRotate = false;
    // OrbitControls pone touch-action:none; en pantallas táctiles eso atrapa el dedo y no deja bajar por la página.
    // Con pan-y el deslizamiento vertical sigue siendo scroll; el horizontal gira el auto.
    canvas.style.touchAction = 'pan-y';
    var IDLE_SPIN_SPEED = 0.15; // rad/s

    var idleRotateAllowed = !reduceMotion;
    var resumeTimer = null;
    var RESUME_DELAY_MS = 2500;
    var orbiting = false;
    controls.addEventListener('start', function(){
      orbiting = true; clearHover(); viewTween = null; setViewUi(null); valueTween = null;
      stage.classList.add('has-interacted');
      idleRotateAllowed = false;
      if(resumeTimer){ clearTimeout(resumeTimer); resumeTimer = null; }
    });
    controls.addEventListener('end', function(){
      orbiting = false;
      if(reduceMotion) return;
      resumeTimer = setTimeout(function(){ idleRotateAllowed = true; resumeTimer = null; requestRender(); }, RESUME_DELAY_MS);
    });

    // ---------- DESPIECE: estado, ciclo automático y pose por pieza ----------
    var parts = [];        // { mesh, id, step, name, home, off, rot, arc, start, c, guide, edges }
    var uTarget = 0;       // destino del despiece (slider o ciclo): 0 = armado, 1 = despiece completo
    var exploded = 0;      // valor mostrado: sigue a uTarget con suavizado cuando manda el slider
    var auto = !reduceMotion;
    var cycleT = 0;
    var valueTween = null;   // animación de Armado/Despiece (botones y marcas): { from, to, t, dur } en ms
    var viewTween = null, currentView = 'iso';
    var insetPx = 0, fitScaleV = 1;   // alto que ocupan los controles; el auto se encuadra por encima de ellos
    function easeSine(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); }
    function animateTo(target){
      auto = false; setPlayUi();
      valueTween = { from:exploded, to:target, t:0, dur:Math.max(900, 3600 * Math.abs(target - exploded)) };
      requestRender();
    }
    // armado (3.2 s) → separa (3.6 s) → despiece (3.4 s) → arma (3.0 s). El tiempo avanza lineal: la suavidad la pone cada pieza con su easing.
    var HOLD_A = 3.2, MOVE_OUT = 3.6, HOLD_B = 3.4, MOVE_IN = 3.0, CYCLE = HOLD_A + MOVE_OUT + HOLD_B + MOVE_IN;
    var GAP = 0.50, SPAN = 0.46;   // la etapa s arranca en (s-1)/(STEPS-1)·GAP, más el retraso de la pieza; cada pieza recorre SPAN
    function ease(t){ return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
    function clamp01(x){ return Math.min(1, Math.max(0, x)); }
    function cycleValue(t){
      if(t < HOLD_A) return 0;
      if(t < HOLD_A + MOVE_OUT) return (t - HOLD_A) / MOVE_OUT;
      if(t < HOLD_A + MOVE_OUT + HOLD_B) return 1;
      return 1 - (t - HOLD_A - MOVE_OUT - HOLD_B) / MOVE_IN;
    }
    var stepF = [0, 0, 0, 0, 0, 0];   // avance (0..1) de cada etapa: etiquetas y cámara
    var floorY = 0, footprint = null, wheelBlobs = [], modelRef = null;
    function updateContactShadows(){
      if(!footprint || !modelRef) return;
      var off = modelRef.position;
      for(var i = 0; i < wheelBlobs.length; i++){
        var m = wheelBlobs[i].mesh, pos = wheelBlobs[i].part.mesh.position;
        m.position.x = pos.x + off.x; m.position.z = pos.z + off.z;
      }
      footprint.material.opacity = 0.75 - 0.3 * exploded;
    }
    function applyPose(u){
      for(var s = 1; s <= STEPS; s++) stepF[s] = 0;
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        var f = p.step ? ease(clamp01((u - p.start) / SPAN)) : 0;
        p.mesh.position.copy(p.home).addScaledVector(p.off, f);
        if(p.arc) p.mesh.position.y += Math.sin(Math.PI * f) * p.arc;
        if(p.hasRot) p.mesh.rotation.set(p.rot.x * f, p.rot.y * f, p.rot.z * f);
        if(p.step && f > stepF[p.step]) stepF[p.step] = f;
        if(p.guide){
          var g = p.guide, a = g.geometry.attributes.position;
          a.setXYZ(1, p.home.x + p.c.x + p.off.x * f, p.home.y + p.c.y + p.off.y * f, p.home.z + p.c.z + p.off.z * f);
          a.needsUpdate = true; g.computeLineDistances();
          g.material.opacity = 0.55 * Math.min(1, f * 3);
          g.visible = f > 0.02;
        }
      }
      updateContactShadows();
    }

    // ---------- Encuadre: la distancia se ajusta al tamaño real (armado ↔ despiece) para que el auto siempre quepa ----------
    // Además la cámara acompaña cada etapa mientras se mueve: se acerca un poco y mira hacia donde ocurre (solo en vertical y en
    // distancia, para no arrastrar la mirada mientras el auto gira) y vuelve al encuadre neutro cuando la etapa termina.
    var CAM = [null, { dy:-7, z:.94 }, { dy:0, z:1 }, { dy:0, z:.96 }, { dy:14, z:.95 }, { dy:4, z:.97 }];   // dy en mm, z = multiplicador de distancia
    var camDy = 0, camZoom = 1, camTarget = { dy:0, z:1 };
    function computeCamTarget(){
      var sum = 0, dy = 0, zm = 0;
      for(var s = 1; s <= STEPS; s++){
        var a = Math.sin(Math.PI * stepF[s]);   // 0 en reposo (armada o terminada), 1 a mitad del recorrido
        if(a <= 0.001) continue;
        dy += a * CAM[s].dy; zm += a * (CAM[s].z - 1); sum += a;
      }
      var n = Math.max(1, sum);
      camTarget.dy = dy / n * 0.001; camTarget.z = 1 + zm / n;
    }
    var half0 = new THREE.Vector3(), half1 = new THREE.Vector3(), cy0 = 0, cy1 = 0;
    var halfNow = new THREE.Vector3(), cyNow = 0;
    var worldUp = new THREE.Vector3(0, 1, 0);
    var FIT_MARGIN = 1.12;
    var fitDir = new THREE.Vector3(), fitRight = new THREE.Vector3(), fitUp = new THREE.Vector3(), fitM = new THREE.Matrix4(), fitV = new THREE.Vector3();
    // Distancia a la que cabe el auto: se proyectan las 8 esquinas de la caja de CADA pieza en su pose actual (armado o despiece), así el
    // encuadre es ajustado en ambos estados en vez de usar una caja global que sobra cuando las piezas se separan.
    function computeFitDistance(){
      fitDir.subVectors(camera.position, controls.target);
      if(fitDir.lengthSq() < 1e-8) fitDir.set(0, 0, 1);
      fitDir.normalize();
      fitRight.crossVectors(worldUp, fitDir);
      if(fitRight.lengthSq() < 1e-8) fitRight.set(1, 0, 0); else fitRight.normalize();
      fitUp.crossVectors(fitDir, fitRight).normalize();
      var maxH = 0, maxV = 0, mo = modelRef.position;
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        fitM.compose(p.mesh.position, p.mesh.quaternion, p.mesh.scale);
        for(var j = 0; j < 8; j++){
          fitV.copy(p.corners[j]).applyMatrix4(fitM).add(mo).applyQuaternion(group.quaternion).sub(controls.target);
          var h = Math.abs(fitV.dot(fitRight)), v = Math.abs(fitV.dot(fitUp));
          if(h > maxH) maxH = h;
          if(v > maxV) maxV = v;
        }
      }
      var vFov = THREE.MathUtils.degToRad(camera.fov / 2);
      var hFov = Math.atan(Math.tan(vFov) * camera.aspect);
      return Math.max(maxV / (Math.tan(vFov) * fitScaleV), maxH / Math.tan(hFov)) * FIT_MARGIN;
    }
    function applyFit(){
      if(!half0.x || !modelRef) return;
      cyNow = cy0 + (cy1 - cy0) * exploded;
      controls.target.set(0, cyNow + camDy, 0);
      var dist = computeFitDistance() * camZoom;
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
        L.el.style.transform = 'translate(' + Math.round(Math.min(Math.max(x, 8), w - L.w - 24)) + 'px,' + Math.round(Math.min(Math.max(y, 8), h - insetPx - 24)) + 'px)';
      }
    }

    // ---------- Resaltado de pieza: al pasar el mouse o tocar se ilumina con contorno y muestra su nombre ----------
    var tip = document.createElement('div');
    tip.className = 'car-tip';
    tip.setAttribute('aria-hidden', 'true');
    stage.appendChild(tip);
    var tipB = document.createElement('b'), tipT = document.createElement('span');
    tip.appendChild(tipB); tip.appendChild(tipT);
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var pickMeshes = [], hovered = null;
    var pointer = { inside:false, x:0, y:0, dirty:false };
    var stickyTimer = null;
    function outlineOf(p){
      if(!p.edges){
        var ln = new THREE.LineSegments(new THREE.EdgesGeometry(p.mesh.geometry, 30),
          new THREE.LineBasicMaterial({ color:0x6CF2B0, transparent:true, opacity:0.9, depthTest:false, depthWrite:false, toneMapped:false }));
        ln.renderOrder = 6; p.mesh.add(ln); p.edges = ln;
      }
      return p.edges;
    }
    function setHighlight(p, on){
      if(!p) return;
      var m = p.mesh.material;
      if(m.emissive){ m.emissive.setHex(on ? 0x12B866 : 0x000000); m.emissiveIntensity = on ? 0.16 : 1; }
      if(on) outlineOf(p).visible = true; else if(p.edges) p.edges.visible = false;
    }
    function placeTip(cx, cy){
      var r = stage.getBoundingClientRect(), w = tip.offsetWidth || 180;
      var x = Math.min(cx - r.left + 14, r.width - w - 8), y = Math.min(cy - r.top + 18, r.height - 64);
      tip.style.transform = 'translate(' + Math.round(Math.max(8, x)) + 'px,' + Math.round(Math.max(8, y)) + 'px)';
    }
    function showHover(p, cx, cy){
      if(hovered !== p){
        setHighlight(hovered, false); hovered = p; setHighlight(p, true);
        tipB.textContent = p.step ? String(p.step) : '·'; tipT.textContent = p.name;
        tip.classList.add('is-on');
        requestRender();
      }
      placeTip(cx, cy);
    }
    function clearHover(){
      if(stickyTimer){ clearTimeout(stickyTimer); stickyTimer = null; }
      if(!hovered) return;
      setHighlight(hovered, false); hovered = null; tip.classList.remove('is-on'); requestRender();
    }
    function pick(cx, cy){
      var r = canvas.getBoundingClientRect();
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hit = raycaster.intersectObjects(pickMeshes, false)[0];
      return hit ? hit.object.userData.part : null;
    }
    function updateHover(){
      if(!pointer.inside || orbiting || !pickMeshes.length) return;
      var p = pick(pointer.x, pointer.y);
      if(p) showHover(p, pointer.x, pointer.y); else if(hovered) clearHover();
      canvas.style.cursor = p ? 'pointer' : '';
    }
    canvas.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      pointer.inside = true; pointer.x = e.clientX; pointer.y = e.clientY; pointer.dirty = true; requestRender();
    });
    canvas.addEventListener('pointerleave', function(e){
      if(e.pointerType === 'touch') return;
      pointer.inside = false; pointer.dirty = false; canvas.style.cursor = ''; clearHover();
    });
    // Toque: un tap (sin arrastre) resalta la pieza durante unos segundos; arrastrar sigue girando el auto.
    var tapStart = null;
    canvas.addEventListener('pointerdown', function(e){ if(e.pointerType !== 'mouse') tapStart = { x:e.clientX, y:e.clientY, t:performance.now() }; });
    canvas.addEventListener('pointerup', function(e){
      if(e.pointerType === 'mouse' || !tapStart) return;
      var moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y), dt = performance.now() - tapStart.t;
      tapStart = null;
      if(moved > 8 || dt > 450 || !pickMeshes.length) return;
      var p = pick(e.clientX, e.clientY);
      if(!p){ clearHover(); return; }
      showHover(p, e.clientX, e.clientY);
      if(stickyTimer) clearTimeout(stickyTimer);
      stickyTimer = setTimeout(clearHover, 2800);
    });

    var loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    // Primero terminan todas las descargas (en paralelo y pequeñas salvo el GLB); así el trabajo de CPU queda contiguo.
    Promise.all([glbP, envP, decalsP]).then(function(r){
      return new Promise(function(ok, no){ loader.parse(r[0], '', ok, no); });
    }).then(function(gltf){
      setProgress(0.62);
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
        var spec = PIECES[Look.pieceId(obj.name)];
        if(!spec) return;
        var rot = spec.rot || [0, 0, 0];
        obj.geometry.computeBoundingBox();
        var part = {
          mesh:obj, id:Look.pieceId(obj.name), step:spec.step, name:spec.name[EN ? 'en' : 'es'], home:obj.position.clone(),
          off:new THREE.Vector3(spec.off[0], spec.off[1], spec.off[2]).multiplyScalar(0.001),
          rot:new THREE.Vector3(rot[0], rot[1], rot[2]).multiplyScalar(Math.PI / 180), hasRot:!!(rot[0] || rot[1] || rot[2]),
          arc:(spec.arc || 0) * 0.001, guide:null, edges:null,
          start:spec.step ? (spec.step - 1) / (STEPS - 1) * GAP + (spec.d || 0) : 0,
          c:obj.geometry.boundingBox.getCenter(new THREE.Vector3())
        };
        var bb = obj.geometry.boundingBox;
        part.corners = [];
        for(var cx = 0; cx < 2; cx++) for(var cy = 0; cy < 2; cy++) for(var cz = 0; cz < 2; cz++)
          part.corners.push(new THREE.Vector3(cx ? bb.max.x : bb.min.x, cy ? bb.max.y : bb.min.y, cz ? bb.max.z : bb.min.z));
        obj.userData.part = part;
        parts.push(part);
        pickMeshes.push(obj);
      });
      model.updateMatrixWorld(true);
      mark('looks');

      // Líneas guía punteadas (una por pieza que viaja; las llantas la comparten con su rin)
      parts.forEach(function(p){
        var spec = PIECES[p.id];
        if(!p.step || spec.guide === false) return;
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
        el.innerHTML = '<b>' + (i + 1) + '</b><span class="t">' + TXT.steps[i] + '</span>';
        labelHost.appendChild(el);
        labels.push({ el:el, mesh:byKey[k], step:i + 1 });
      });
      stage.appendChild(labelHost);

      // Logos dibujados en código (espina + espacios disponibles). Si falla la carga, el auto se ve igual.
      var decalsDone = decalsP.then(function(assets){ return assets ? Look.addLogoDecals(byKey, Promise.resolve(assets), EN ? 'en' : 'es') : null; }).catch(function(){});

      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      model.position.sub(center); // centra el auto armado en el origen
      modelRef = model;
      model.updateMatrixWorld(true);

      group.add(model);
      ground.position.y = -size.y / 2 - 0.0002;

      // Sombra de contacto falsa (no depende de sombras en tiempo real): una mancha suave bajo el cuerpo y una bajo cada llanta.
      // Las manchas de las llantas siguen a su llanta cuando el auto se abre; el huella del cuerpo se aclara al separarse las piezas.
      floorY = -size.y / 2;
      var blobTex = makeContactShadowTexture();
      footprint = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.15, size.z * 1.9),
        new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, opacity:0.75, depthWrite:false, toneMapped:false }));
      footprint.rotation.x = -Math.PI / 2; footprint.position.y = floorY + 0.0001; footprint.renderOrder = -1;
      group.add(footprint);
      parts.forEach(function(p){
        if(!/^1[6-9]t$/.test(p.id)) return;
        var blob = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.034),
          new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, opacity:0.7, depthWrite:false, toneMapped:false }));
        blob.rotation.x = -Math.PI / 2; blob.position.y = floorY + 0.00015; blob.renderOrder = -1;
        group.add(blob); wheelBlobs.push({ part:p, mesh:blob });
      });
      model.updateMatrixWorld(true); updateContactShadows();

      var plinthR = size.x * 0.54;
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
      exploded = 0; uTarget = 0; applyFit(); controls.update();

      buildControls();
      mark('built');
      setProgress(0.82);
      var reveal = function(){
        mark('compiled');
        setProgress(1);
        stage.classList.remove('is-loading');
        stage.classList.add('is-ready');
        stage.dispatchEvent(new CustomEvent('sr26-ready'));   // js/stage.js retira el video/CTA si los había
        needsRender = true;
        startLoop();
      };
      // Los shaders se compilan en paralelo mientras se pegan los logos; el poster sigue visible hasta que todo está listo.
      var compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function(){}) : Promise.resolve();
      Promise.all([decalsDone, compiled]).then(reveal, reveal);
    }).catch(function(e){ if(window.console) console.error('[SR-26 visor]', e); fail(); });

    // ---------- Controles: reproducir, Armado/Despiece, deslizador con marcas por etapa, vistas y pantalla completa ----------
    var ICON = {
      play:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
      pause:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" fill="currentColor"/></svg>',
      fsOn:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      fsOff:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
    };
    // Posición (0..1) de la marca de cada etapa: espaciadas por igual; a esa altura la etapa ya va bien avanzada y las anteriores casi terminaron.
    var TICKS = [0, 1, 2, 3, 4].map(function(i){ return 0.3 + i * GAP / (STEPS - 1); });
    var VIEWS = { iso:{ az:35, el:26 }, side:{ az:0, el:7 }, front:{ az:90, el:7 }, top:{ az:0, el:72 } };
    var slider = null, playBtn = null, fsBtn = null, segBtns = [], tickEls = [], viewBtns = {}, dragging = false;
    function setPlayUi(){
      if(!playBtn) return;
      playBtn.innerHTML = auto ? ICON.pause : ICON.play;
      playBtn.setAttribute('aria-label', auto ? TXT.pause : TXT.play);
      playBtn.setAttribute('aria-pressed', auto ? 'true' : 'false');
    }
    var viewCycle = null, VIEW_ORDER = ['iso', 'side', 'front', 'top'];
    function setViewUi(v){
      currentView = v;
      for(var k in viewBtns) viewBtns[k].setAttribute('aria-pressed', k === v ? 'true' : 'false');
      if(viewCycle){
        viewCycle.textContent = TXT.views[v || 'iso'][1];
        viewCycle.setAttribute('aria-label', TXT.viewsLabel + ': ' + TXT.views[v || 'iso'][0]);
      }
    }
    // Refleja el despiece en el deslizador, las marcas y Armado/Despiece
    function updateUi(){
      if(!slider) return;
      if(!dragging) slider.value = Math.round(exploded * 100);
      slider.style.setProperty('--p', (exploded * 100).toFixed(1) + '%');
      slider.setAttribute('aria-valuetext', Math.round(exploded * 100) + ' %');
      for(var i = 0; i < tickEls.length; i++) tickEls[i].classList.toggle('is-lit', exploded >= TICKS[i] - 0.004);
      segBtns[0].setAttribute('aria-pressed', uTarget < 0.5 ? 'true' : 'false');
      segBtns[1].setAttribute('aria-pressed', uTarget >= 0.5 ? 'true' : 'false');
    }
    function buildControls(){
      var bar = document.createElement('div');
      bar.className = 'car-ctl';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', TXT.group);
      var ticksHtml = TICKS.map(function(x, i){
        return '<button type="button" class="car-tick" data-step="' + (i + 1) + '" style="left:calc(7px + ' + x.toFixed(3) + ' * (100% - 14px))" aria-label="' + TXT.stepGo + (i + 1) + ': ' + TXT.steps[i] + '" title="' + TXT.steps[i] + '">' + (i + 1) + '</button>';
      }).join('');
      var viewsHtml = Object.keys(VIEWS).map(function(k){
        return '<button type="button" class="car-view" data-view="' + k + '" aria-pressed="false" aria-label="' + TXT.viewLabel + TXT.views[k][0] + '"><span class="long">' + TXT.views[k][0] + '</span><span class="short">' + TXT.views[k][1] + '</span></button>';
      }).join('');
      bar.innerHTML =
        '<button type="button" class="car-btn car-ctl-play"></button>' +
        '<div class="car-seg" role="group" aria-label="' + TXT.slider + '"><button type="button" class="car-seg-btn" data-go="0">' + TXT.assembled + '</button><button type="button" class="car-seg-btn" data-go="1">' + TXT.exploded + '</button></div>' +
        '<div class="car-ctl-track"><input type="range" class="car-ctl-range" min="0" max="100" step="1" value="0" aria-label="' + TXT.slider + '"><div class="car-ticks">' + ticksHtml + '</div></div>' +
        '<div class="car-views" role="group" aria-label="' + TXT.viewsLabel + '">' + viewsHtml + '</div>' +
        '<button type="button" class="car-view car-view-cycle" aria-label="' + TXT.viewsLabel + '"></button>' +
        '<button type="button" class="car-btn car-ctl-fs"></button>';
      stage.appendChild(bar);
      playBtn = bar.querySelector('.car-ctl-play'); slider = bar.querySelector('.car-ctl-range'); fsBtn = bar.querySelector('.car-ctl-fs');
      segBtns = [].slice.call(bar.querySelectorAll('.car-seg-btn')); tickEls = [].slice.call(bar.querySelectorAll('.car-tick'));
      [].forEach.call(bar.querySelectorAll('.car-view[data-view]'), function(el){ viewBtns[el.getAttribute('data-view')] = el; });
      viewCycle = bar.querySelector('.car-view-cycle');
      setPlayUi(); setFsUi(); setViewUi('iso'); updateUi();
      playBtn.addEventListener('click', function(){
        auto = !auto; valueTween = null;
        if(auto){ cycleT = exploded < .5 ? 0 : HOLD_A + MOVE_OUT; } // sigue desde donde quedó
        setPlayUi(); requestRender();
      });
      segBtns.forEach(function(btn){ btn.addEventListener('click', function(){ animateTo(+btn.getAttribute('data-go')); }); });
      tickEls.forEach(function(btn){ btn.addEventListener('click', function(){ animateTo(TICKS[+btn.getAttribute('data-step') - 1]); }); });
      slider.addEventListener('input', function(){
        auto = false; valueTween = null; setPlayUi();
        uTarget = slider.value / 100;   // el valor mostrado lo alcanza con suavizado (ver tick)
        requestRender();
      });
      slider.addEventListener('pointerdown', function(){ dragging = true; });
      slider.addEventListener('pointerup', function(){ dragging = false; });
      slider.addEventListener('blur', function(){ dragging = false; });
      Object.keys(viewBtns).forEach(function(k){ viewBtns[k].addEventListener('click', function(){ goToView(k); }); });
      viewCycle.addEventListener('click', function(){ goToView(VIEW_ORDER[(VIEW_ORDER.indexOf(currentView || 'iso') + 1) % VIEW_ORDER.length]); });
      fsBtn.addEventListener('click', toggleFullscreen);
      resize();   // ya existen los controles: se mide su altura para encuadrar el auto por encima
    }

    // Vistas: la cámara y el giro del auto viajan juntos al ángulo elegido; en ISO el auto vuelve a girar solo.
    function currentAzEl(){
      var d = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      return { az:Math.atan2(d.x, d.z), el:Math.asin(Math.max(-1, Math.min(1, d.y))) };
    }
    function shortest(from, to){ var d = (to - from) % (Math.PI * 2); if(d > Math.PI) d -= Math.PI * 2; if(d < -Math.PI) d += Math.PI * 2; return d; }
    function goToView(name){
      var v = VIEWS[name]; if(!v) return;
      var cur = currentAzEl(), az1 = THREE.MathUtils.degToRad(v.az), el1 = THREE.MathUtils.degToRad(v.el);
      viewTween = { name:name, t:0, dur:reduceMotion ? 1 : 850, az0:cur.az, el0:cur.el, daz:shortest(cur.az, az1), del:el1 - cur.el, yaw0:group.rotation.y, dyaw:shortest(group.rotation.y, 0) };
      idleRotateAllowed = false;
      if(resumeTimer){ clearTimeout(resumeTimer); resumeTimer = null; }
      stage.classList.add('has-interacted');
      setViewUi(name); clearHover(); requestRender();
    }
    function stepViewTween(delta){
      var vt = viewTween; vt.t += delta * 1000;
      var k = easeSine(clamp01(vt.t / vt.dur)), az = vt.az0 + vt.daz * k, el = vt.el0 + vt.del * k;
      camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(camera.position.distanceTo(controls.target)).add(controls.target);
      group.rotation.y = vt.yaw0 + vt.dyaw * k;
      if(vt.t >= vt.dur){
        viewTween = null;
        if(vt.name === 'iso' && !reduceMotion) resumeTimer = setTimeout(function(){ idleRotateAllowed = true; resumeTimer = null; requestRender(); }, 1200);
      }
    }

    // Pantalla completa: API nativa si existe; si no (iPhone), el visor ocupa toda la ventana con la clase is-fs.
    function isFullscreen(){ return document.fullscreenElement === stage || document.webkitFullscreenElement === stage || stage.classList.contains('is-fs'); }
    function setFsUi(){
      if(!fsBtn) return;
      var on = isFullscreen();
      fsBtn.innerHTML = on ? ICON.fsOff : ICON.fsOn;
      fsBtn.setAttribute('aria-label', on ? TXT.fsOff : TXT.fsOn);
      fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    function fakeFullscreen(on){
      stage.classList.toggle('is-fs', on); document.documentElement.classList.toggle('fs-lock', on);
      setFsUi(); resize();
    }
    function toggleFullscreen(){
      if(isFullscreen()){
        if(stage.classList.contains('is-fs')) fakeFullscreen(false);
        else if(document.exitFullscreen) document.exitFullscreen(); else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
        return;
      }
      var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
      if(!req){ fakeFullscreen(true); return; }
      var res = req.call(stage);
      if(res && res.catch) res.catch(function(){ fakeFullscreen(true); });
    }
    function onFsChange(){ setFsUi(); resize(); }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && stage.classList.contains('is-fs')) fakeFullscreen(false); });

    // Si el sistema pierde el contexto WebGL (poca memoria, GPU reiniciada) se vuelve a mostrar el poster y, al recuperarlo, el visor.
    canvas.addEventListener('webglcontextlost', function(e){
      e.preventDefault(); stopLoop(); stage.classList.remove('is-ready'); stage.classList.add('is-lost');
    });
    canvas.addEventListener('webglcontextrestored', function(){
      stage.classList.remove('is-lost'); stage.classList.add('is-ready'); requestRender();
    });

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
      var bar = stage.querySelector('.car-ctl');
      insetPx = bar ? Math.max(0, h - bar.offsetTop + 4) : 0;
      if(insetPx > h * 0.5) insetPx = 0;                 // visor diminuto: no se reserva nada
      fitScaleV = (h - insetPx) / h;
      camera.aspect = w / h;
      if(insetPx) camera.setViewOffset(w, h, 0, insetPx / 2, w, h); else camera.clearViewOffset();   // el auto sube insetPx/2 px: queda sobre los controles
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
    var idleAccum = 0;   // tiempo de giro pendiente: en equipos modestos el giro en reposo se dibuja a 30 cuadros/s
    function tick(){
      rafId = null;
      framePending = false;
      var delta = Math.min(clock.getDelta(), 0.1);   // tope 10 cuadros/s: en equipos lentos la animación sigue a su ritmo real
      var t0 = performance.now();
      var stillAnimating = false;
      if(auto){
        cycleT = (cycleT + delta) % CYCLE;
        uTarget = exploded = cycleValue(cycleT);
        stillAnimating = true;
      }else if(valueTween){
        valueTween.t += delta * 1000;
        var vk = clamp01(valueTween.t / valueTween.dur);
        exploded = uTarget = valueTween.from + (valueTween.to - valueTween.from) * easeSine(vk);
        if(vk >= 1) valueTween = null;
        stillAnimating = true;
      }else if(exploded !== uTarget){
        // suavizado exponencial hacia el destino del slider (sin saltos al arrastrar o soltar)
        exploded += (uTarget - exploded) * (1 - Math.exp(-delta * 9));
        if(Math.abs(uTarget - exploded) < 0.0004) exploded = uTarget;
        stillAnimating = true;
      }
      if(exploded !== lastU){
        applyPose(exploded); lastU = exploded; needsRender = true;
        computeCamTarget(); updateUi();
      }
      if(viewTween){ stepViewTween(delta); needsRender = true; stillAnimating = true; }
      // la cámara persigue su objetivo (acompaña la etapa en curso) con suavizado
      if(Math.abs(camTarget.dy - camDy) > 2e-6 || Math.abs(camTarget.z - camZoom) > 2e-4){
        var k = 1 - Math.exp(-delta * 4.5);
        camDy += (camTarget.dy - camDy) * k; camZoom += (camTarget.z - camZoom) * k;
        needsRender = true; stillAnimating = true;
      }
      if(controls.update(delta)){ needsRender = true; stillAnimating = true; }
      if(pointer.inside && (pointer.dirty || stillAnimating)){ updateHover(); pointer.dirty = false; }
      if(idleRotateAllowed){
        idleAccum += delta;
        stillAnimating = true;
        if(!lowEnd || needsRender || idleAccum >= 1 / 30 - 0.002){
          group.rotation.y += idleAccum * IDLE_SPIN_SPEED; idleAccum = 0;
          needsRender = true;
        }
      }
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
  boot();
}
