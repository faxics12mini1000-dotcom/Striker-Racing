/* Striker Racing · SR-26 · animación de despiece guiada por scroll
 * Vanilla ES module. Usa el mismo importmap que el sitio ("three" r160 y "three/addons/").
 *
 *   import { initDespiece } from './despiece/sr26-despiece.js';
 *   initDespiece(document.getElementById('despiece'), { glb: 'despiece/sr26.glb', logo: 'logo.png' });
 *
 * Todo lo editable (clase, reglas, textos, librea, desplazamientos) está en la parte de CONFIG.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ───────────────────────── CONFIG ───────────────────────── */

export const CONFIG = {
  carName: 'SR-26',
  clase: 'entry',               // 'entry' | 'desarrollo'  → decide qué tabla de reglas se usa
  season: '2026-27',
  /* Medidas del modelo (salen del script de Fusion). Largo/ancho/alto se calculan del GLB. */
  model: { frontSpan: 78, rearSpan: 74, rearChord: 22, wingThickness: 3.2, axleFront: 60, axleRear: 64, cartridgeCenter: 33.5 },
};

/* Librea con la paleta del sitio. Sin degradados: un color plano por pieza. */
const C = { navy:'#071B33', surface:'#0E223D', line:'#183969', ice:'#CDDEEF', steel:'#9DB8D6',
            emerald:'#12B866', purple:'#7137D4', purpleDeep:'#5A2BA8', lime:'#C8FF32', tire:'#0A1424', dark:'#22385C' };
const LIVERY = {
  '01':C.purple, '02':C.purpleDeep, '03':C.purpleDeep, '04':C.ice,
  '05':C.emerald, '06':C.emerald, '07':C.ice, '08':C.ice,
  '09':C.emerald, '10':C.ice, '11':C.ice, '12':C.purple,
  '13':C.ice, '14':C.lime, '15':C.steel,
  '16':C.tire, '17':C.tire, '18':C.tire, '19':C.tire, '20':C.steel, '21':C.steel, '22':C.dark, '23':C.dark,
};

/* Capítulos de "pieza por pieza". Valores en `keys`: desplazamiento (mm) al despiece completo; x = largo, y = alto, z = ancho.
 * Los nombres y textos viven en STRINGS (es / en). */
const CHAPTERS = [
  { id:'cuerpo',      keys:{'01':[0,0,0]}, view:[.85,.55,.9] },
  { id:'pontones',    keys:{'02':[0,0,46],'03':[0,0,-46]}, view:[.2,.5,1] },
  { id:'nariz',       keys:{'04':[52,-4,0]}, view:[.9,.35,.7] },
  { id:'aleron-del',  keys:{'05':[78,0,0],'06':[50,24,0],'07':[78,0,34],'08':[78,0,-34]}, view:[1,.55,.55] },
  { id:'aleron-tras', keys:{'09':[-72,22,0],'10':[-72,14,34],'11':[-72,14,-34],'12':[-48,42,0]}, view:[-1,.55,.6] },
  { id:'halo',        keys:{'13':[0,66,0]}, view:[.6,.45,1], ph:true },
  { id:'casco',       keys:{'14':[0,32,0]}, view:[.7,.4,1], ph:true },
  { id:'cartucho',    keys:{'15':[-86,0,0]}, view:[-.9,.4,.8] },
  { id:'llantas',     keys:{'16':[0,0,-44],'17':[0,0,44],'18':[0,0,-44],'19':[0,0,44]}, view:[.5,.35,1], ph:true },
  { id:'ejes',        keys:{'20':[0,-30,0],'21':[0,-30,0]}, view:[.4,.7,1] },
  { id:'guias',       keys:{'22':[0,-46,0],'23':[0,-46,0]}, view:[.5,.8,.9], ph:true },
];

/* Reglas por clase (solo cifras; los textos están en STRINGS). Las de "entry" salen de la guía internacional de STEM Racing;
 * las de "desarrollo" del video de referencia. Verificar siempre contra el reglamento oficial de México antes de publicar cifras. */
const RULES = {
  entry: m => [
    ['largo', m.L, 'mm', 170, 210], ['ancho', m.W, 'mm', null, 85], ['alto', m.H, 'mm', null, 65],
    ['frontSpan', m.frontSpan, 'mm', 60, 80], ['rearSpan', m.rearSpan, 'mm', 60, 80],
    ['rearChord', m.rearChord, 'mm', 12, 25], ['wing', m.wingThickness, 'mm', 3, 15],
    ['axles', m.axleFront + ' / ' + m.axleRear, 'mm', 50, 66, Math.min(m.axleFront, m.axleRear), Math.max(m.axleFront, m.axleRear)],
    ['mass', null, 'g', 65, null],
  ],
  desarrollo: m => [
    ['largo', m.L, 'mm', 170, 210], ['ancho', m.W, 'mm', null, 90],
    ['frontSpan', m.frontSpan, 'mm', 60, null], ['rearChord', m.rearChord, 'mm', 15, 30],
    ['wing', m.wingThickness, 'mm', 5, 15], ['cartridge', m.cartridgeCenter, 'mm', 30, 40],
    ['mass', null, 'g', 50, null],
  ],
};

/* Textos de la interfaz. No se traducen nombres propios (Striker Racing, STEM Racing, SR-26, Halo). */
const STRINGS = {
  es: {
    chip: (cls, season) => 'Medidas en mm · Clase ' + cls + ' ' + season,
    kick: (i, n) => 'Pieza ' + i + ' de ' + n, ph: 'Marcador',
    dims: { L: 'Largo', W: 'Ancho', H: 'Alto' },
    tableTitle: 'Medidas contra el reglamento', unmeasured: 'sin medir', min: 'mín. ', max: 'máx. ',
    within: (ok, n) => ok + ' de ' + n + ' dentro del límite', toFix: n => ' · ' + n + ' por corregir', pending: n => ' · ' + n + ' pendiente',
    status: { ok: 'Cumple', bad: 'No cumple', pend: 'Pendiente' },
    stages: { armado: 'Carro armado', cotas: 'Dimensiones generales', despiece: 'Despiece', piezas: 'Pieza por pieza', armado2: 'Armado', resumen: 'Resumen de medidas' },
    classes: { entry: 'Entry', desarrollo: 'Desarrollo' },
    notes: {
      entry: 'Límites de la guía internacional de STEM Racing (Entry). Falta cotejar con el reglamento en español de México.',
      desarrollo: 'Límites tomados del video de referencia (reglamento del Reino Unido). Falta cotejar con el reglamento en español de México y revisar la zona prohibida.',
    },
    rows: { largo: 'Largo total', ancho: 'Ancho total', alto: 'Alto total', frontSpan: 'Alerón delantero · envergadura', rearSpan: 'Alerón trasero · envergadura',
            rearChord: 'Alerón trasero · cuerda', wing: 'Grosor de alerones', axles: 'Ejes (del. / tras.)', cartridge: 'Centro del cartucho', mass: 'Masa mínima' },
    dimLine: s => 'Largo ' + s.x + ' · Ancho ' + s.z + ' · Alto ' + s.y + ' mm',
    chapters: {
      cuerpo: ['Cuerpo', 'Bloque central del carro. Aloja la cámara del cartucho de CO₂ (Ø19.1 mm, pared mínima de 2.15 mm) y une pontones, nariz y alerón trasero.'],
      pontones: ['Pontones', 'Dos cuerpos laterales de 84 mm. Guían el aire hacia los costados y alejan la estela de las llantas traseras. Llevan el logo del equipo y la zona lateral de patrocinio.'],
      nariz: ['Nariz', 'Cono frontal de 47 mm. Une el cuerpo con el alerón delantero y es una de las zonas de logos del patrocinio.'],
      'aleron-del': ['Alerón delantero', 'Ala principal y flap de dos elementos, con placas laterales. Envergadura de 78 mm y 74 mm, con 4° y 8° de ángulo de ataque. Generan carga y ordenan el aire alrededor de las llantas delanteras.'],
      'aleron-tras': ['Alerón trasero', 'Ala de 74 mm de envergadura y 22 mm de cuerda, a 9°, sobre un pilar central. Las placas laterales evitan que el aire se escape por las puntas.'],
      halo: ['Halo', 'Arco de protección sobre el piloto. Es una pieza estándar y no se modifica; aquí es un marcador con la altura y la posición correctas.'],
      casco: ['Casco', 'Casco del piloto, de Ø13 mm. Pieza estándar; en el modelo ayuda a ver cómo queda la cabina bajo el halo.'],
      cartucho: ['Cartucho de CO₂', 'Cartucho de 8 g, Ø18 × 50 mm. Es el motor del carro. Su centro queda a 33.5 mm del piso, dentro de la cámara del cuerpo.'],
      llantas: ['Llantas', 'Cuatro llantas de Ø26 mm. Aquí son un marcador del tamaño; las oficiales llegan con el kit.'],
      ejes: ['Ejes', 'Dos ejes de Ø3 mm, de 60 mm el delantero y 64 mm el trasero. Las llantas giran sobre ellos.'],
      guias: ['Guías de cable', 'Dos guías bajo el piso que mantienen al carro sobre el cable de la pista. Marcador hasta tener las piezas oficiales.'],
    },
  },
  en: {
    chip: (cls, season) => 'Dimensions in mm · ' + cls + ' class ' + season,
    kick: (i, n) => 'Part ' + i + ' of ' + n, ph: 'Placeholder',
    dims: { L: 'Length', W: 'Width', H: 'Height' },
    tableTitle: 'Dimensions vs. regulations', unmeasured: 'not measured', min: 'min. ', max: 'max. ',
    within: (ok, n) => ok + ' of ' + n + ' within limits', toFix: n => ' · ' + n + ' to fix', pending: n => ' · ' + n + ' pending',
    status: { ok: 'Pass', bad: 'Fail', pend: 'Pending' },
    stages: { armado: 'Assembled car', cotas: 'Overall dimensions', despiece: 'Exploded view', piezas: 'Part by part', armado2: 'Assembly', resumen: 'Dimension summary' },
    classes: { entry: 'Entry', desarrollo: 'Development' },
    notes: {
      entry: 'Limits from the international STEM Racing guide (Entry). Still to be checked against the Mexican regulations in Spanish.',
      desarrollo: 'Limits taken from the reference video (UK regulations). Still to be checked against the Mexican regulations in Spanish, and the no-go zone reviewed.',
    },
    rows: { largo: 'Overall length', ancho: 'Overall width', alto: 'Overall height', frontSpan: 'Front wing · span', rearSpan: 'Rear wing · span',
            rearChord: 'Rear wing · chord', wing: 'Wing thickness', axles: 'Axles (front / rear)', cartridge: 'Cartridge centre', mass: 'Minimum mass' },
    dimLine: s => 'Length ' + s.x + ' · Width ' + s.z + ' · Height ' + s.y + ' mm',
    chapters: {
      cuerpo: ['Body', 'The central block of the car. It houses the CO₂ cartridge chamber (Ø19.1 mm, 2.15 mm minimum wall) and joins the sidepods, nose and rear wing.'],
      pontones: ['Sidepods', 'Two 84 mm side bodies. They guide air to the sides and keep the wake away from the rear wheels. They carry the team logo and the side sponsorship area.'],
      nariz: ['Nose', '47 mm front cone. It joins the body to the front wing and is one of the sponsor logo areas.'],
      'aleron-del': ['Front wing', 'Main plane and a two-element flap, with end plates. Spans of 78 mm and 74 mm, at 4° and 8° angle of attack. They create downforce and organise the air around the front wheels.'],
      'aleron-tras': ['Rear wing', 'A 74 mm span wing with a 22 mm chord, at 9°, on a central pillar. The end plates stop air escaping around the tips.'],
      halo: ['Halo', 'Protective arch above the driver. It is a standard part and is not modified; here it is a placeholder at the correct height and position.'],
      casco: ['Helmet', 'The driver helmet, Ø13 mm. A standard part; in the model it shows how the cockpit sits under the halo.'],
      cartucho: ['CO₂ cartridge', '8 g cartridge, Ø18 × 50 mm. It is the car\'s engine. Its centre sits 33.5 mm above the floor, inside the body chamber.'],
      llantas: ['Wheels', 'Four Ø26 mm wheels. Here they are a size placeholder; the official ones arrive with the kit.'],
      ejes: ['Axles', 'Two Ø3 mm axles, 60 mm at the front and 64 mm at the rear. The wheels spin on them.'],
      guias: ['Tether guides', 'Two guides under the floor that keep the car on the track\'s tether line. Placeholder until we have the official parts.'],
    },
  },
};

/* Etapas de la línea de tiempo (fracción del scroll). Las etiquetas están en STRINGS. */
const STAGES = [
  { id:'armado',   a:0,    b:.08 },
  { id:'cotas',    a:.08,  b:.20 },
  { id:'despiece', a:.20,  b:.33 },
  { id:'piezas',   a:.33,  b:.85 },
  { id:'armado2',  a:.85,  b:.93 },
  { id:'resumen',  a:.93,  b:1 },
];

/* ───────────────────────── utilidades ───────────────────────── */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => ease(clamp((x - a) / (b - a)));
const fmt = n => (Math.round(n * 10) / 10).toString();
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ───────────────────────── init ───────────────────────── */
export async function initDespiece(root, opts = {}) {
  const q = s => root.querySelector(s);
  const stage = q('.sr-stage'), canvasHost = q('.sr-canvas'), card = q('.sr-card'), table = q('.sr-table'),
        dimsHost = q('.sr-dims'), svg = q('.sr-lines'), barFill = q('.sr-bar-fill'), barLabel = q('.sr-bar-label'),
        ticksHost = q('.sr-ticks'), titleBox = q('.sr-title'), chip = q('.sr-chip'), fallback = q('.sr-fallback');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = STRINGS[opts.lang] ? opts.lang : 'es', L = STRINGS[lang];
  const clase = RULES[opts.clase] ? opts.clase : CONFIG.clase, rulesFor = RULES[clase], claseLabel = L.classes[clase];
  const chName = ch => L.chapters[ch.id][0], chText = ch => L.chapters[ch.id][1];
  chip.textContent = L.chip(claseLabel, CONFIG.season);

  /* WebGL disponible */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) { root.classList.add('no-3d'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(C.navy);
  canvasHost.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x1a2a52, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(180, 320, 240); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcddeef, 1.1); rim.position.set(-260, 120, -240); scene.add(rim);
  const grid = new THREE.GridHelper(1000, 40, new THREE.Color(C.line), new THREE.Color(C.line));
  grid.position.y = -.5; grid.material.transparent = true; grid.material.opacity = .55; grid.material.depthWrite = false; grid.renderOrder = -1; scene.add(grid);
  const cam = new THREE.PerspectiveCamera(28, 1, 5, 4000);

  /* ── modelo ── */
  const loader = new GLTFLoader();
  const gltf = await new Promise((ok, no) => {
    if (opts.glb instanceof ArrayBuffer) loader.parse(opts.glb, '', ok, no);
    else loader.load(opts.glb, ok, undefined, no);
  }).catch(() => null);
  if (!gltf) { root.classList.add('no-3d'); return; }
  const car = gltf.scene; car.scale.setScalar(1000); scene.add(car); car.updateMatrixWorld(true);   // m → mm

  const parts = {};   // '01' → { mesh, home, off, chapter, target, alpha, mat, color }
  car.traverse(o => {
    if (!o.isMesh) return;
    const k = o.name.slice(0, 2);
    if (!o.geometry.attributes.normal) { o.geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; o.geometry.computeVertexNormals(); }   // respaldo si el GLB no trae normales
    const color = new THREE.Color(LIVERY[k] || C.ice);
    o.material = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .04 });
    parts[k] = { mesh: o, key: k, home: o.position.clone(), off: new THREE.Vector3(), ci: -1, color, alpha: 1, target: 1, order: 0 };
  });
  CHAPTERS.forEach((ch, ci) => Object.entries(ch.keys).forEach(([k, off]) => { if (parts[k]) { parts[k].off.set(...off).multiplyScalar(.001); parts[k].ci = ci; } }));   // desplazamientos en mm; el GLB está en metros (×0.001)

  /* tamaños reales del modelo armado */
  const homeBox = new THREE.Box3().setFromObject(car);
  const size = homeBox.getSize(new THREE.Vector3()), center = homeBox.getCenter(new THREE.Vector3());
  const M = { ...CONFIG.model, L: size.x, W: size.z, H: size.y };

  /* encuadre de cada capítulo (con las piezas ya separadas) */
  const ghostColor = new THREE.Color(C.line);
  const setPose = (u) => Object.values(parts).forEach(p => p.mesh.position.copy(p.home).addScaledVector(p.off, u));
  setPose(1); car.updateMatrixWorld(true);
  CHAPTERS.forEach(ch => {
    const box = new THREE.Box3();
    Object.keys(ch.keys).forEach(k => parts[k] && box.expandByObject(parts[k].mesh));
    ch.center = box.getCenter(new THREE.Vector3()); ch.size = box.getSize(new THREE.Vector3());
    ch.dist = Math.max(140, ch.size.length() * 2.15 + 60);
    ch.dir = new THREE.Vector3(...ch.view).normalize();
  });
  setPose(0); car.updateMatrixWorld(true);

  /* logo del equipo sobre los pontones (se calcula con un rayo, así sigue la forma real de la pieza) */
  if (opts.logo) {
    new THREE.TextureLoader().load(opts.logo, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const ray = new THREE.Raycaster();
      [['02', 1], ['03', -1]].forEach(([k, side]) => {
        const p = parts[k]; if (!p) return;
        const b = new THREE.Box3().setFromObject(p.mesh), c = b.getCenter(new THREE.Vector3());
        ray.set(new THREE.Vector3(c.x + 4, c.y + 1, side * 200), new THREE.Vector3(0, 0, -side));
        const hit = ray.intersectObject(p.mesh, false)[0]; if (!hit) return;
        const n = hit.face.normal.clone().transformDirection(p.mesh.matrixWorld);
        const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(12, 12 * 64 / 68), m);
        const o = new THREE.Object3D(); o.position.copy(hit.point).addScaledVector(n, .12); o.up.set(0, 1, 0); o.lookAt(hit.point.clone().add(n));
        plane.position.copy(o.position); plane.quaternion.copy(o.quaternion);
        p.mesh.attach(plane); p.decal = m;
      });
    });
  }

  /* cotas 3D: largo, ancho y alto */
  const dimMat = new THREE.LineBasicMaterial({ color: new THREE.Color(C.emerald), transparent: true, opacity: 0, depthTest: false });
  const dimGroup = new THREE.Group(); dimGroup.renderOrder = 10; scene.add(dimGroup);
  const seg = (a, b) => { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, dimMat); l.renderOrder = 10; dimGroup.add(l); };
  const x0 = homeBox.min.x, x1 = homeBox.max.x, z0 = homeBox.min.z, z1 = homeBox.max.z, y1 = homeBox.max.y;
  const dimDefs = [
    { name: 'L', val: M.L, a: new THREE.Vector3(x0, 0, z1 + 16), b: new THREE.Vector3(x1, 0, z1 + 16), t1: [0, 0, -6], t2: [0, 0, 6] },
    { name: 'W', val: M.W, a: new THREE.Vector3(x1 + 16, 0, z0), b: new THREE.Vector3(x1 + 16, 0, z1), t1: [-6, 0, 0], t2: [6, 0, 0] },
    { name: 'H', val: M.H, a: new THREE.Vector3(x0 - 12, 0, z1 + 8), b: new THREE.Vector3(x0 - 12, y1, z1 + 8), t1: [-5, 0, 0], t2: [5, 0, 0] },
  ];
  dimDefs.forEach(d => {
    seg(d.a, d.b);
    [d.a, d.b].forEach(p => seg(p.clone().add(new THREE.Vector3(...d.t1)), p.clone().add(new THREE.Vector3(...d.t2))));
    d.mid = d.a.clone().add(d.b).multiplyScalar(.5);
    d.label = el('div', 'sr-dim', L.dims[d.name].toUpperCase() + ' ' + fmt(d.val) + ' mm'); dimsHost.appendChild(d.label);
  });

  /* ── interfaz: ticks, tarjetas ── */
  STAGES.forEach(s => {
    const b = el('button', 'sr-tick'); b.type = 'button'; b.style.left = (s.a * 100) + '%'; b.setAttribute('aria-label', L.stages[s.id]);
    b.title = L.stages[s.id]; b.addEventListener('click', () => scrollToT(s.a + .002)); ticksHost.appendChild(b);
  });
  const rowsHTML = () => {
    const rows = rulesFor(M).map(r => {
      const [key, val, unit, lo, hi, vmin, vmax] = r, label = L.rows[key];
      let status = L.status.pend, cls = 'pend', shown = val == null ? L.unmeasured : ((typeof val === 'number' ? fmt(val) : val) + ' ' + unit);
      if (val != null) {
        const a = vmin != null ? vmin : val, b = vmax != null ? vmax : val;
        const ok = (lo == null || a >= lo) && (hi == null || b <= hi);
        status = ok ? L.status.ok : L.status.bad; cls = ok ? 'ok' : 'bad';
      }
      const lim = lo != null && hi != null ? lo + '–' + hi : lo != null ? L.min + lo : L.max + hi;
      return { label, shown, lim, status, cls };
    });
    const ok = rows.filter(r => r.cls === 'ok').length, bad = rows.filter(r => r.cls === 'bad').length, pend = rows.filter(r => r.cls === 'pend').length;
    table.innerHTML = '<h3>' + L.tableTitle + '</h3><p class="sr-sub">' + L.within(ok, rows.length) + (bad ? L.toFix(bad) : '') + (pend ? L.pending(pend) : '') + ' · ' + claseLabel + '</p>' +
      '<div class="sr-rows">' + rows.map(r => '<span>' + r.label + '</span><span class="v">' + r.shown + '</span><span class="l">' + r.lim + '</span><span class="s ' + r.cls + '">' + r.status + '</span>').join('') + '</div>' +
      '<p class="sr-note">' + L.notes[clase] + '</p>';
  };
  rowsHTML();

  let shownChapter = -2;
  const dimsOf = ch => { const s = ch.homeSize; return L.dimLine({ x: fmt(s.x), y: fmt(s.y), z: fmt(s.z) }); };
  CHAPTERS.forEach(ch => { const b = new THREE.Box3(); Object.keys(ch.keys).forEach(k => parts[k] && b.expandByObject(parts[k].mesh)); ch.homeSize = b.getSize(new THREE.Vector3()); });
  const setCard = ci => {
    if (ci === shownChapter) return; shownChapter = ci;
    if (ci < 0) { card.classList.remove('on'); return; }
    const ch = CHAPTERS[ci];
    card.innerHTML = '<div class="sr-kick">' + L.kick(ci + 1, CHAPTERS.length) + (ch.ph ? '<span class="sr-ph">' + L.ph + '</span>' : '') + '</div>' +
      '<h3>' + chName(ch) + '</h3><div class="sr-meta">' + dimsOf(ch) + '</div><p>' + chText(ch) + '</p>';
    card.classList.add('on');
  };

  /* ── tiempo: scroll ── */
  let target = 0, t = 0;
  const readScroll = () => {
    const r = root.getBoundingClientRect(), total = r.height - stage.clientHeight;
    target = clamp(total > 0 ? -r.top / total : 0);
  };
  const scrollToT = v => { const r = root.getBoundingClientRect(), total = r.height - stage.clientHeight; scrollTo({ top: scrollY + r.top + v * total, behavior: reduce ? 'auto' : 'smooth' }); };
  addEventListener('scroll', readScroll, { passive: true }); readScroll(); t = target;

  /* ── tamaño ── */
  let W = 1, H = 1, mobile = false;
  const resize = () => {
    W = stage.clientWidth; H = stage.clientHeight; mobile = W <= 720;
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage); resize();

  /* ── cámara por etapa ── */
  const camPos = new THREE.Vector3(235, 120, 300), camLook = new THREE.Vector3(0, 22, 0), tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const KEY = {
    armado:   { p: [235, 120, 300], l: [0, 22, 0] },
    cotas:    { p: [300, 165, 340], l: [0, 24, 0] },
    despiece: { p: [330, 235, 400], l: [0, 30, 0] },
    armado2:  { p: [270, 140, 340], l: [0, 24, 0] },
    resumen:  { p: [250, 125, 330], l: [0, 24, 0] },
  };
  let focus = 0;

  /* ── bucle ── */
  const proj = new THREE.Vector3();
  const toScreen = v => { proj.copy(v).project(cam); return [(proj.x * .5 + .5) * W, (-proj.y * .5 + .5) * H]; };
  let last = performance.now(), visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe(root);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    t = reduce ? target : t + (target - t) * (1 - Math.exp(-dt * 7));

    /* etapa y capítulo actuales */
    const stg = STAGES.findIndex(s => t < s.b); const si = stg < 0 ? STAGES.length - 1 : stg, S = STAGES[si];
    const pa = STAGES[3].a, pb = STAGES[3].b;
    const ci = S.id === 'piezas' ? Math.min(CHAPTERS.length - 1, Math.floor((t - pa) / (pb - pa) * CHAPTERS.length)) : -1;

    /* explosión: sale en 'despiece', vuelve en 'armado2'; cada pieza con su retraso */
    const uOut = clamp((t - STAGES[2].a) / (STAGES[2].b - STAGES[2].a)), uIn = clamp((t - STAGES[4].a) / (STAGES[4].b - STAGES[4].a));
    const raw = t < STAGES[4].a ? uOut : 1 - uIn;
    Object.values(parts).forEach(p => {
      const d = Math.max(0, p.ci) / (CHAPTERS.length - 1) * .5, f = ease(clamp((raw - d) / .5));
      p.mesh.position.copy(p.home).addScaledVector(p.off, f);
      if (/^1[6-9]$/.test(p.key)) p.mesh.rotation.z = f * Math.PI * 2 * (p.home.z < 0 ? -1 : 1);
      p.target = (ci >= 0 && p.ci !== ci) ? .07 : 1;
      p.alpha += (p.target - p.alpha) * (1 - Math.exp(-dt * 9));
      const m = p.mesh.material, a = p.alpha, act = ci >= 0 && p.ci === ci;
      m.transparent = a < .995; m.opacity = a; m.depthWrite = a > .5;
      m.color.copy(p.color).lerp(ghostColor, (1 - a) * .8);
      m.emissive.copy(p.color).multiplyScalar(act ? .22 : 0);
      if (p.decal) { p.decal.opacity = a; }
    });

    /* cotas */
    const kDim = si === 1 ? smooth(STAGES[1].a, STAGES[1].a + .03, t) * (1 - smooth(STAGES[1].b - .02, STAGES[1].b, t)) : 0;
    dimMat.opacity = kDim; dimGroup.visible = kDim > .01;

    /* cámara */
    let kp, kl, dist = 1;
    if (ci >= 0) { const ch = CHAPTERS[ci]; kp = tmpP.copy(ch.center).addScaledVector(ch.dir, ch.dist); kl = tmpL.copy(ch.center); }
    else { const k = KEY[S.id] || KEY.armado; kp = tmpP.set(...k.p); kl = tmpL.set(...k.l);
      if (S.id === 'armado') { const a = t / S.b * .35; const x = k.p[0], z = k.p[2]; kp.set(x * Math.cos(a) + z * Math.sin(a), k.p[1], -x * Math.sin(a) + z * Math.cos(a)); } }
    const asp = W / H, scale = asp < 1 ? Math.min(2.6, 1 / asp * 1.05 + .25) : 1;
    const rel = kp.clone().sub(kl); if (ci < 0) rel.multiplyScalar(scale); else rel.multiplyScalar(asp < 1 ? Math.min(1.8, 1 / asp * .8 + .2) : 1);
    kp = kl.clone().add(rel);
    const kc = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
    camPos.lerp(kp, kc); camLook.lerp(kl, kc);
    cam.position.copy(camPos); cam.lookAt(camLook);
    /* composición: deja libre el lado de la tarjeta */
    let ox = 0, oy = 0;
    if (mobile) oy = H * (S.id === 'resumen' ? .3 : ci >= 0 ? .2 : .1); else ox = W * (S.id === 'resumen' ? .17 : ci >= 0 ? -.12 : S.id === 'armado' ? -.08 : 0);
    cam.setViewOffset(W, H, ox, oy, W, H);
    renderer.render(scene, cam);

    /* HUD */
    setCard(ci);
    titleBox.classList.toggle('on', S.id === 'armado' && t < S.b * .85);
    table.classList.toggle('on', S.id === 'resumen');
    barFill.style.transform = 'scaleX(' + t + ')';
    barLabel.textContent = S.id === 'piezas' ? L.stages[S.id] + ' · ' + (ci + 1) + '/' + CHAPTERS.length : L.stages[S.id];
    dimDefs.forEach(d => { const [x, y] = toScreen(d.mid); d.label.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)'; d.label.style.opacity = kDim > .5 ? 1 : 0; });

    /* línea guía tarjeta → pieza */
    svg.innerHTML = '';
    if (ci >= 0 && card.classList.contains('on')) {
      const ch = CHAPTERS[ci], c = new THREE.Vector3(); let n = 0;
      Object.keys(ch.keys).forEach(k => { if (parts[k]) { c.add(new THREE.Box3().setFromObject(parts[k].mesh).getCenter(new THREE.Vector3())); n++; } });
      c.multiplyScalar(1 / n); const [px, py] = toScreen(c);
      const sr = stage.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const ax = mobile ? cr.left - sr.left + cr.width / 2 : cr.right - sr.left - 18, ay = cr.top - sr.top + (mobile ? 0 : 20);
      svg.innerHTML = '<path d="M' + ax + ',' + ay + ' L' + px + ',' + py + '"/><circle cx="' + px + '" cy="' + py + '" r="4"/>';
    }
  }
  requestAnimationFrame(frame);
  root.classList.add('is-ready');
  return {};
}
