import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as Look from './car-look.js';

/* js/stage.js decide cuándo cargar este módulo (póster, video o 3D, según pantalla y conexión) y llama a mount(stage, pre), donde `pre`
 * trae las descargas del GLB y del entorno ya iniciadas ({ glb, env }: promesas de Response); sin `pre` el visor las pide él. */
export function mount(stage, pre){
  // Visor 3D del monoplaza SR-26 (assets/models/sr26.glb) en /auto/: gira solo, se arma y se desarma en bucle,
  // y se puede arrastrar para girar o mover el control para ver el despiece. NO secuestra el scroll de la página.
  // Carga: este bundle se pide con modulepreload (solo en pantallas > 560 px y sin ahorro de datos) y js/stage.js ya inició la descarga del GLB
  // y del entorno; al terminar de pintar el poster (idéntico al primer cuadro del visor) se parsean en paralelo con el logo y el canvas se funde
  // sobre el poster. fail() = sin WebGL (definitivo, queda el póster); loadError() = fallo de red o de datos (se ofrece reintentar).
  function fail(){ stage.classList.remove('is-loading'); stage.classList.add('no-3d'); }
  function loadError(){ stage.classList.remove('is-loading'); stage.dispatchEvent(new CustomEvent('sr26-error')); }
  var EN = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var TXT = EN
    ? { slider:'Exploded view of the car', assembled:'Assembled', exploded:'Exploded', pause:'Pause animation', play:'Play animation',
        steps:['Wheels & axles', 'Wings & nose', 'Sidepods', 'Spine & pillar', 'CO₂ cartridge'], group:'3D viewer controls', stepGo:'Show up to step ',
        views:{ iso:['ISO', 'ISO'], side:['SIDE', 'SIDE'], front:['FRONT', 'FRT'], top:['TOP', 'TOP'] }, viewsLabel:'Camera views', viewLabel:'View: ',
        fsOn:'Full screen', fsOff:'Exit full screen', tools:'Tools' }
    : { slider:'Despiece del auto', assembled:'Armado', exploded:'Despiece', pause:'Pausar animación', play:'Reanudar animación',
        steps:['Llantas y ejes', 'Alerones y nariz', 'Pontones', 'Espina y pilar', 'Cartucho CO₂'], group:'Controles del visor 3D', stepGo:'Ver hasta la etapa ',
        views:{ iso:['ISO', 'ISO'], side:['LATERAL', 'LAT'], front:['FRENTE', 'FRE'], top:['ARRIBA', 'SUP'] }, viewsLabel:'Vistas de cámara', viewLabel:'Vista: ',
        fsOn:'Pantalla completa', fsOff:'Salir de pantalla completa', tools:'Herramientas' };
  Object.assign(TXT, EN
    ? { rear:['REAR', 'REAR'], notesOn:'Show part numbers', notesOff:'Hide part numbers', planOn:'Technical drawing', planOff:'Exit technical drawing',
        photo:'Car photo (transparent PNG)', share:'Share', copied:'Link copied', saved:'Photo saved', planTag:'Technical drawing · visual prototype',
        dLength:'Length (no cartridge)', dWidth:'Width', dWheelbase:'Wheelbase', measured:'Measured on the 3D model. Visual prototype, not the final car.',
        zonesOn:'Highlight sponsorship zones', zonesOff:'Hide sponsorship zones',
        keys:'Use the arrow keys to rotate, Home for the ISO view.', parts:'Car parts', shareTitle:'SR-26 · Striker Racing', shareText:'The Striker Racing SR-26, a visual prototype.' }
    : { rear:['TRASERA', 'TRA'], notesOn:'Mostrar numeración de piezas', notesOff:'Ocultar numeración de piezas', planOn:'Plano técnico', planOff:'Salir del plano técnico',
        photo:'Foto del auto (PNG transparente)', share:'Compartir', copied:'Enlace copiado', saved:'Foto guardada', planTag:'Plano técnico · prototipo visual',
        dLength:'Largo (sin cartucho)', dWidth:'Ancho', dWheelbase:'Entre ejes', measured:'Medido en el modelo 3D. Prototipo visual, no es el auto final.',
        zonesOn:'Resaltar zonas de patrocinio', zonesOff:'Ocultar zonas de patrocinio',
        keys:'Usa las flechas para girar y Inicio para la vista ISO.', parts:'Piezas del auto', shareTitle:'SR-26 · Striker Racing', shareText:'El SR-26 de Striker Racing, un prototipo visual.' });
  TXT.views.rear = TXT.rear; TXT.views.plan = ['PLAN', 'PLAN'];
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

  function fetchGlb(src, onProgress){
    return Promise.resolve(typeof src === 'string' ? fetch(src) : src).then(function(res){
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
    var glbP = fetchGlb(pre ? pre.glb : URLS.model, function(f){ setProgress(0.05 + f * 0.45); });
    var decalsP = Look.preloadDecalAssets(URLS.logo).catch(function(){ return null; });
    glbP.catch(function(){});
    try{
      initViewer(glbP, decalsP);
    }catch(e){ loadError(); }
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
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', (stage.getAttribute('aria-label') || 'SR-26') + '. ' + TXT.keys);

    // Esta escena trabaja en metros (el GLB viene en metros), de ahí u = 0.001.
    mark('renderer');
    // Entorno prefiltrado y horneado (16 KB); si falla se genera el PMREM en el cliente.
    var envP = Look.lookEnvironmentBaked(scene, pre ? pre.env : URLS.env).catch(function(){ return Look.lookEnvironment(renderer, scene); }).then(function(){ mark('env'); });
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

    var zonesOn = false, zoneHost = null, zoneEls = [], userLogoActive = false;
    var decor = [], decals = [], notesOn = false, noteHost = null, notes = [], planOn = false, plan = null, lastBlob = null;
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
      var decalsDone = decalsP.then(function(assets){ return assets ? Look.addLogoDecals(byKey, Promise.resolve(assets), EN ? 'en' : 'es', model.position) : null; }).then(function(list){ decals = list || []; }).catch(function(){});

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
      group.add(footprint); decor.push(footprint);
      parts.forEach(function(p){
        if(!/^1[6-9]t$/.test(p.id)) return;
        var blob = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.034),
          new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, opacity:0.7, depthWrite:false, toneMapped:false }));
        blob.rotation.x = -Math.PI / 2; blob.position.y = floorY + 0.00015; blob.renderOrder = -1;
        group.add(blob); wheelBlobs.push({ part:p, mesh:blob }); decor.push(blob);
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
      group.add(plinth); decor.push(plinth, ground);

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
      buildPartsPanel();
      mark('built');
      setProgress(0.82);
      var reveal = function(){
        mark('compiled');
        setProgress(1);
        stage.classList.remove('is-loading');
        stage.classList.add('is-ready');
        stage.sr26 = { photo:function(){ return capturePhoto(false, true); } };   // js/configurator.js pide la foto del auto con el logo puesto
        if(window.__srLogo) applyLogo(window.__srLogo);
        if(location.hash === '#zonas' || window.__srZones) setZones(true);
        stage.dispatchEvent(new CustomEvent('sr26-ready'));   // js/stage.js retira el video/CTA si los había
        needsRender = true;
        startLoop();
      };
      // Los shaders se compilan en paralelo mientras se pegan los logos; el poster sigue visible hasta que todo está listo.
      var compiled = renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(function(){}) : Promise.resolve();
      Promise.all([decalsDone, compiled]).then(reveal, reveal);
    }).catch(function(e){ if(window.console) console.error('[SR-26 visor]', e); loadError(); });

    // ---------- Controles: reproducir, Armado/Despiece, deslizador con marcas por etapa, vistas y pantalla completa ----------
    var ICON = {
      play:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
      pause:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" fill="currentColor"/></svg>',
      fsOn:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      fsOff:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      zones:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 14V2.5h9l-1.6 3 1.6 3h-9" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      notes:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 3.5h2M6 3.5h8M2 8h2M6 8h8M2 12.5h2M6 12.5h8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
      plan:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 5v6M14.5 5v6M1.5 8h13M4 6l-2.5 2L4 10M12 6l2.5 2-2.5 2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
      photo:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 4.5h3l1-1.5h5l1 1.5h3v8h-13z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
      share:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="3.5" cy="8" r="1.6" fill="currentColor"/><circle cx="12.5" cy="3.5" r="1.6" fill="currentColor"/><circle cx="12.5" cy="12.5" r="1.6" fill="currentColor"/><path d="M5 7.2l6-3M5 8.8l6 3" stroke="currentColor" stroke-width="1.3"/></svg>'
    };
    // Posición (0..1) de la marca de cada etapa: espaciadas por igual; a esa altura la etapa ya va bien avanzada y las anteriores casi terminaron.
    var TICKS = [0, 1, 2, 3, 4].map(function(i){ return 0.3 + i * GAP / (STEPS - 1); });
    var VIEWS = { iso:{ az:35, el:26 }, side:{ az:0, el:7 }, front:{ az:90, el:7 }, rear:{ az:-90, el:7 }, top:{ az:0, el:72 } };
    var stepLegend = [].slice.call(document.querySelectorAll('[data-step-legend] [data-step]'));
    var slider = null, playBtn = null, fsBtn = null, segBtns = [], tickEls = [], viewBtns = {}, dragging = false;
    function setPlayUi(){
      if(!playBtn) return;
      playBtn.innerHTML = auto ? ICON.pause : ICON.play;
      playBtn.setAttribute('aria-label', auto ? TXT.pause : TXT.play);
      playBtn.setAttribute('aria-pressed', auto ? 'true' : 'false');
    }
    var viewCycle = null, VIEW_ORDER = ['iso', 'side', 'front', 'rear', 'top'];
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
      for(var j = 0; j < stepLegend.length; j++){ var sf = stepF[+stepLegend[j].getAttribute('data-step')]; stepLegend[j].classList.toggle('is-active', sf > 0.02 && sf < 0.98); stepLegend[j].classList.toggle('is-done', sf >= 0.98); }
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
        '<div class="car-tools" role="group" aria-label="' + TXT.tools + '">' +
          '<button type="button" class="car-btn car-ctl-zones" aria-pressed="false">' + ICON.zones + '</button>' +
          '<button type="button" class="car-btn car-ctl-notes" aria-pressed="false">' + ICON.notes + '</button>' +
          '<button type="button" class="car-btn car-ctl-plan" aria-pressed="false">' + ICON.plan + '</button>' +
          '<button type="button" class="car-btn car-ctl-photo">' + ICON.photo + '</button>' +
          '<button type="button" class="car-btn car-ctl-share">' + ICON.share + '</button>' +
          '<button type="button" class="car-btn car-ctl-fs"></button>' +
        '</div>';
      stage.appendChild(bar);
      [['zones', 'zonesOn'], ['notes', 'notesOn'], ['plan', 'planOn'], ['photo', 'photo'], ['share', 'share']].forEach(function(t){
        var b = bar.querySelector('.car-ctl-' + t[0]); b.setAttribute('aria-label', TXT[t[1]]); b.setAttribute('title', TXT[t[1]]);
      });
      bar.querySelector('.car-ctl-zones').addEventListener('click', function(){ setZones(!zonesOn); });
      bar.querySelector('.car-ctl-notes').addEventListener('click', function(){ setNotes(!notesOn); });
      bar.querySelector('.car-ctl-plan').addEventListener('click', function(){ setPlan(!planOn); });
      bar.querySelector('.car-ctl-photo').addEventListener('click', function(){ capturePhoto(true); });
      bar.querySelector('.car-ctl-share').addEventListener('click', shareCar);
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

    // ---------- TECLADO: flechas giran el auto, Inicio vuelve a la vista ISO ----------
    canvas.addEventListener('keydown', function(e){
      var d = THREE.MathUtils.degToRad, handled = true;
      if(e.key === 'ArrowLeft') nudge(-d(12), 0);
      else if(e.key === 'ArrowRight') nudge(d(12), 0);
      else if(e.key === 'ArrowUp') nudge(0, d(8));
      else if(e.key === 'ArrowDown') nudge(0, -d(8));
      else if(e.key === 'Home') goToView('iso');
      else handled = false;
      if(handled) e.preventDefault();
    });
    function nudge(dYaw, dEl){
      idleRotateAllowed = false; if(resumeTimer){ clearTimeout(resumeTimer); resumeTimer = null; }
      viewTween = null; setViewUi(null); stage.classList.add('has-interacted');
      group.rotation.y += dYaw;
      if(dEl){
        var c = currentAzEl(), el = Math.min(planOn ? 1.55 : THREE.MathUtils.degToRad(75), Math.max(0.12, c.el + dEl));
        camera.position.set(Math.sin(c.az) * Math.cos(el), Math.sin(el), Math.cos(c.az) * Math.cos(el)).multiplyScalar(camera.position.distanceTo(controls.target)).add(controls.target);
      }
      requestRender();
    }

    // ---------- Aviso breve (lector de pantalla y texto visible un momento) ----------
    var toastTimer = null;
    function toast(text){
      var m = stage.querySelector('.model-msg'); if(!m) return;
      m.textContent = text; m.classList.remove('sr-only');
      if(toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ m.classList.add('sr-only'); }, 2600);
    }

    // ---------- FOTO DEL AUTO (PNG con fondo transparente) y COMPARTIR ----------
    // Se dibuja un cuadro aparte de 1800×1100 sin piso, sombra ni anillo, solo el auto, y se devuelve el tamaño del visor.
    function capturePhoto(download, assembled){
      return new Promise(function(done){
        if(!modelRef) return done(null);
        var poseU = exploded;
        if(assembled && exploded > 0){ applyPose(0); modelRef.updateMatrixWorld(true); }   // la propuesta de marca siempre muestra el auto armado
        var size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), W = 1800, H = 1100;
        var vis = decor.map(function(m){ return m.visible; });
        decor.forEach(function(m){ m.visible = false; });
        clearHover();
        renderer.setPixelRatio(1); renderer.setSize(W, H, false);
        camera.aspect = W / H; camera.clearViewOffset(); fitScaleV = 1; camera.updateProjectionMatrix();
        applyFit(); renderer.render(scene, camera);
        canvas.toBlob(function(blob){
          lastBlob = blob;
          if(download && blob){
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sr26-striker-racing.png';
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
            toast(TXT.saved);
          }
          done(blob);
        }, 'image/png');
        decor.forEach(function(m, i){ m.visible = vis[i]; });
        if(assembled && poseU > 0){ applyPose(poseU); modelRef.updateMatrixWorld(true); }
        renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false);
        resize();
      });
    }
    function shareCar(){
      var data = { title:TXT.shareTitle, text:TXT.shareText, url:location.origin + location.pathname };
      capturePhoto(false).then(function(blob){
        var file = blob && window.File ? new File([blob], 'sr26-striker-racing.png', { type:'image/png' }) : null;
        if(navigator.canShare && file && navigator.canShare({ files:[file] })) data.files = [file];
        if(navigator.share) return navigator.share(data).catch(function(){});
        if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(data.url).then(function(){ toast(TXT.copied); }, function(){});
      });
    }

    // ---------- NUMERACIÓN DE PIEZAS (anotaciones) y panel de piezas ----------
    function idLabel(p){ return /^\d\d/.test(p.id) ? p.id.slice(0, 2) : '·'; }
    function setNotes(on){
      notesOn = on;
      var b = stage.querySelector('.car-ctl-notes');
      if(b){ b.setAttribute('aria-pressed', on ? 'true' : 'false'); var t = on ? TXT.notesOff : TXT.notesOn; b.setAttribute('aria-label', t); b.setAttribute('title', t); }
      if(on && !noteHost){
        noteHost = document.createElement('div'); noteHost.className = 'car-notes'; noteHost.setAttribute('aria-hidden', 'true');
        parts.forEach(function(p){
          if(/^\d\dr$/.test(p.id)) return;   // el rin comparte número con su llanta
          var el = document.createElement('span'); el.className = 'car-note'; el.textContent = idLabel(p);
          noteHost.appendChild(el); notes.push({ el:el, p:p });
        });
        stage.appendChild(noteHost);
      }
      if(noteHost) noteHost.style.display = on ? '' : 'none';
      requestRender();
    }
    function updateNotes(){
      if(!notesOn || !noteHost) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      for(var i = 0; i < notes.length; i++){
        var n = notes[i];
        tmpV.copy(n.p.c).applyMatrix4(n.p.mesh.matrixWorld).project(camera);
        var x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
        n.el.style.transform = 'translate(' + Math.round(x - 9) + 'px,' + Math.round(y - 9) + 'px)';
        n.el.style.opacity = (tmpV.z > 1 || y > h - insetPx) ? 0 : 1;
      }
    }
    function projectPart(p){
      var r = stage.getBoundingClientRect();
      tmpV.copy(p.c).applyMatrix4(p.mesh.matrixWorld).project(camera);
      return { x:r.left + (tmpV.x * 0.5 + 0.5) * r.width, y:r.top + (-tmpV.y * 0.5 + 0.5) * r.height };
    }
    function buildPartsPanel(){
      var host = document.getElementById('carParts'); if(!host) return;
      var list = host.querySelector('ul'); if(!list) return;
      list.textContent = '';
      parts.slice().sort(function(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function(p){
        var li = document.createElement('li'), btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'car-part'; btn.innerHTML = '<b>' + idLabel(p) + '</b><span></span>'; btn.lastChild.textContent = p.name;
        function on(){ var c = projectPart(p); showHover(p, c.x, c.y); }
        btn.addEventListener('mouseenter', on); btn.addEventListener('focus', on);
        btn.addEventListener('mouseleave', clearHover); btn.addEventListener('blur', clearHover);
        li.appendChild(btn); list.appendChild(li);
      });
      host.hidden = false;
    }

    // ---------- PLANO TÉCNICO: vista superior casi ortogonal, líneas y cotas calculadas del GLB ----------
    function cssColor(token, fallback){
      try{ return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback; }catch(e){ return fallback; }
    }
    // Caja del auto armado SIN cartucho (pieza 15) y centros de los ejes, en el marco del modelo (metros).
    function modelDims(){
      var yaw = group.rotation.y, u = exploded;
      group.rotation.y = 0; applyPose(0); group.updateMatrixWorld(true);
      var box = new THREE.Box3(), b = new THREE.Box3(), ax = {};
      parts.forEach(function(p){
        b.copy(p.mesh.geometry.boundingBox).applyMatrix4(p.mesh.matrixWorld);
        if(p.id !== '15') box.union(b);
        if(p.id === '20' || p.id === '21') ax[p.id] = (b.min.x + b.max.x) / 2;
      });
      applyPose(u); group.rotation.y = yaw; group.updateMatrixWorld(true);
      var o = modelRef.position;   // el grupo no tiene escala ni giro en reposo: local = mundo − posición del modelo
      var hasAxles = ax['20'] != null && ax['21'] != null;
      return { minX:box.min.x - o.x, maxX:box.max.x - o.x, minY:box.min.y - o.y, minZ:box.min.z - o.z, maxZ:box.max.z - o.z,
               front:hasAxles ? ax['20'] - o.x : null, rear:hasAxles ? ax['21'] - o.x : null };
    }
    function buildPlan(){
      var d = modelDims(), y = d.minY + 0.0003, off = 0.014, tk = 0.0035, pos = [];
      function seg(a, b){ pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
      var out = { dims:[], d:d };
      // largo (sin cartucho), a un costado
      var zL = d.maxZ + off;
      seg([d.minX, y, zL], [d.maxX, y, zL]); seg([d.minX, y, d.maxZ], [d.minX, y, zL + tk]); seg([d.maxX, y, d.maxZ], [d.maxX, y, zL + tk]);
      seg([d.minX, y, zL - tk], [d.minX, y, zL + tk]); seg([d.maxX, y, zL - tk], [d.maxX, y, zL + tk]);
      out.dims.push({ key:'dLength', mm:(d.maxX - d.minX) * 1000, at:new THREE.Vector3((d.minX + d.maxX) / 2, y, zL) });
      // ancho, detrás de la cola
      var xW = d.minX - off;
      seg([xW, y, d.minZ], [xW, y, d.maxZ]); seg([d.minX, y, d.minZ], [xW - tk, y, d.minZ]); seg([d.minX, y, d.maxZ], [xW - tk, y, d.maxZ]);
      seg([xW - tk, y, d.minZ], [xW + tk, y, d.minZ]); seg([xW - tk, y, d.maxZ], [xW + tk, y, d.maxZ]);
      out.dims.push({ key:'dWidth', mm:(d.maxZ - d.minZ) * 1000, at:new THREE.Vector3(xW, y, (d.minZ + d.maxZ) / 2) });
      // distancia entre ejes, del otro costado
      if(d.front != null){
        var zB = d.minZ - off;
        seg([d.rear, y, zB], [d.front, y, zB]); seg([d.rear, y, d.minZ], [d.rear, y, zB - tk]); seg([d.front, y, d.minZ], [d.front, y, zB - tk]);
        seg([d.rear, y, zB - tk], [d.rear, y, zB + tk]); seg([d.front, y, zB - tk], [d.front, y, zB + tk]);
        out.dims.push({ key:'dWheelbase', mm:Math.abs(d.front - d.rear) * 1000, at:new THREE.Vector3((d.front + d.rear) / 2, y, zB) });
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      var ice = cssColor('--ice', '#CDDEEF');
      out.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:ice, depthTest:false, depthWrite:false, toneMapped:false }));
      out.lines.renderOrder = 8; out.lines.frustumCulled = false; out.lines.visible = false;
      modelRef.add(out.lines);
      out.flat = new THREE.MeshBasicMaterial({ color:cssColor('--surface', '#0E223D'), polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1, toneMapped:false });
      parts.forEach(function(p){
        p.planMat = p.mesh.material;
        p.planEdges = new THREE.LineSegments(new THREE.EdgesGeometry(p.mesh.geometry, 24), new THREE.LineBasicMaterial({ color:ice, toneMapped:false }));
        p.planEdges.renderOrder = 4; p.planEdges.visible = false; p.mesh.add(p.planEdges);
      });
      // rótulos (HTML) y recuadro con los valores
      out.host = document.createElement('div'); out.host.className = 'car-dims'; out.host.setAttribute('aria-hidden', 'true');
      out.dims.forEach(function(m){
        m.el = document.createElement('span'); m.el.className = 'car-dim'; m.el.textContent = m.mm.toFixed(1) + ' mm'; out.host.appendChild(m.el);
      });
      stage.appendChild(out.host);
      out.legend = document.createElement('div'); out.legend.className = 'car-plan-legend';
      out.legend.innerHTML = '<b></b><dl></dl><p></p>';
      out.legend.firstChild.textContent = TXT.planTag;
      out.dims.forEach(function(m){ var dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = TXT[m.key]; dd.textContent = m.mm.toFixed(1) + ' mm'; out.legend.querySelector('dl').appendChild(dt); out.legend.querySelector('dl').appendChild(dd); });
      out.legend.lastChild.textContent = TXT.measured;
      stage.appendChild(out.legend);
      return out;
    }
    function setPlan(on){
      if(on === planOn || !modelRef) return;
      planOn = on;
      var b = stage.querySelector('.car-ctl-plan');
      if(b){ b.setAttribute('aria-pressed', on ? 'true' : 'false'); var t = on ? TXT.planOff : TXT.planOn; b.setAttribute('aria-label', t); b.setAttribute('title', t); }
      stage.classList.toggle('is-plan', on);
      if(on && !plan) plan = buildPlan();
      parts.forEach(function(p){ p.mesh.material = on ? plan.flat : p.planMat; p.planEdges.visible = on; });
      decals.forEach(function(dc){ dc.mesh.visible = !on; });
      decor.forEach(function(m){ m.visible = !on; });
      plan.lines.visible = on; plan.host.style.display = on ? '' : 'none'; plan.legend.style.display = on ? '' : 'none';
      if(on){
        auto = false; setPlayUi(); animateTo(0);
        camera.fov = 8; controls.minPolarAngle = 0.0001; FIT_MARGIN = 1.6;   // aire para las cotas y el recuadro de valores
        VIEWS.plan = { az:0, el:89 }; goToView('plan'); setViewUi(null);
      }else{
        camera.fov = 30; controls.minPolarAngle = THREE.MathUtils.degToRad(15); FIT_MARGIN = 1.12;
        goToView('iso');
      }
      requestRender();
    }
    function updateDims(){
      if(!planOn || !plan) return;
      var show = exploded < 0.02, w = stage.clientWidth, h = stage.clientHeight;
      plan.lines.visible = show; plan.host.style.display = show ? '' : 'none';
      if(!show) return;
      plan.dims.forEach(function(m){
        tmpV.copy(m.at); modelRef.localToWorld(tmpV); tmpV.project(camera);
        m.el.style.transform = 'translate(' + Math.round((tmpV.x * 0.5 + 0.5) * w) + 'px,' + Math.round((-tmpV.y * 0.5 + 0.5) * h) + 'px) translate(-50%,-50%)';
      });
    }

    // ---------- ZONAS DE PATROCINIO: contorno y letra (A nariz, B pontones, C alerón trasero, D alerón delantero), como en el mapa de /patrocinios/ ----------
    function ensureZones(){
      if(zoneEls.length || !decals.length) return;
      zoneHost = document.createElement('div'); zoneHost.className = 'car-notes'; zoneHost.setAttribute('aria-hidden', 'true');
      var lime = cssColor('--lime', '#7FD9B0'), ice = cssColor('--ice', '#CDDEEF');
      decals.forEach(function(d){
        if(!d.zone) return;
        d.line = new THREE.LineSegments(new THREE.EdgesGeometry(d.mesh.geometry), new THREE.LineBasicMaterial({ color:d.zone === 'B' ? ice : lime, depthTest:false, depthWrite:false, toneMapped:false }));
        d.line.renderOrder = 9; d.line.visible = false; d.mesh.add(d.line);
        var el = document.createElement('span'); el.className = 'car-note car-zone'; el.textContent = d.zone; el.style.display = 'none';
        zoneHost.appendChild(el); zoneEls.push({ el:el, d:d });
      });
      stage.appendChild(zoneHost);
    }
    function setZones(on, only){
      ensureZones();
      zonesOn = on;
      zoneEls.forEach(function(z){ var v = on && (!only || z.d.zone === only); z.d.line.visible = v; z.el.style.display = v ? '' : 'none'; });
      var b = stage.querySelector('.car-ctl-zones');
      if(b && !only){ b.setAttribute('aria-pressed', on ? 'true' : 'false'); var t = on ? TXT.zonesOff : TXT.zonesOn; b.setAttribute('aria-label', t); b.setAttribute('title', t); }
      requestRender();
    }
    function updateZones(){
      if(!zonesOn) return;
      var w = stage.clientWidth, h = stage.clientHeight;
      for(var i = 0; i < zoneEls.length; i++){
        var z = zoneEls[i]; if(z.el.style.display === 'none') continue;
        tmpV.setFromMatrixPosition(z.d.mesh.matrixWorld).project(camera);
        z.el.style.transform = 'translate(' + Math.round((tmpV.x * 0.5 + 0.5) * w - 9) + 'px,' + Math.round((-tmpV.y * 0.5 + 0.5) * h - 24) + 'px)';
        z.el.style.opacity = (tmpV.z > 1 || (-tmpV.y * 0.5 + 0.5) * h > h - insetPx) ? 0 : 1;
      }
    }
    // El logo que carga el visitante (js/configurator.js) se pega en los espacios del auto del nivel Partner Estratégico (A, C y D). Todo local.
    function applyLogo(img){
      window.__srLogo = img || null;
      decals.forEach(function(d){
        if(d.zone !== 'A' && d.zone !== 'C' && d.zone !== 'D') return;
        if(!d.origMat) d.origMat = d.mesh.material;
        if(d.userMat){ if(d.userMat.map) d.userMat.map.dispose(); d.userMat.dispose(); d.userMat = null; }
        if(img){ d.userMat = Look.userLogoMaterial(Look.slotCanvas(d.zone, img)); d.mesh.material = d.userMat; }
        else d.mesh.material = d.origMat;
      });
      userLogoActive = !!img;
      requestRender();
    }
    stage.addEventListener('sr26-logo', function(e){ applyLogo(e.detail && e.detail.img); });
    stage.addEventListener('sr26-zones', function(e){ setZones(!!(e.detail && e.detail.on), e.detail && e.detail.only); });

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
        updateLabels(); updateNotes(); updateZones(); updateDims();
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
