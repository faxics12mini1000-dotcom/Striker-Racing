/* Striker Racing · SR-26 · acabado compartido del auto 3D (visor del hero y vista de patrocinios)
 * Un solo lugar para: librea por pieza, offsets del despiece, entorno/luces/sombras, materiales y los logos dibujados en código (decals).
 * Las piezas vienen de assets/models/sr26.glb (un nodo por STL, nombre = archivo sin extensión). La escena trabaja en metros,
 * de ahí `u = 0.001` en las luces. Faltan la 13 y la 14 en el modelo: nada aquí depende de que existan. */
import * as THREE from 'three';
import { STEM_BOX, STEM_MARK, STEM_WORD, STEM_GRADIENT, STEM_GRADIENT_LINE } from './stem-logo.js';

export const COLORS = { navy:'#071B33', blue:'#183969', purple:'#7137D4', green:'#12B866', ice:'#CDDEEF', rubber:'#0E1013', steel:'#8E9AAB', alu:'#C4CDD9', brass:'#C9A24A' };

/* Librea por pieza. La clave es el prefijo numérico del nombre del nodo; el cuerpo (01) y la boca de los pontones (02/03)
 * se resuelven en el shader por posición en X (ver bodyShader), no por malla. Las llantas (16–19) llevan dos mallas:
 * __Llanta_* (caucho) y __Rin_* (hielo), por eso `colorFor` mira también el nombre completo. */
export const LIVERY = {
  '01':COLORS.blue, '02':COLORS.purple, '03':COLORS.purple, '04':COLORS.blue,
  '05':COLORS.blue, '06':COLORS.navy, '07':COLORS.green, '08':COLORS.green,
  '09':COLORS.blue, '10':COLORS.green, '11':COLORS.green, '12':COLORS.navy,
  '15':COLORS.steel, '16':COLORS.rubber, '17':COLORS.rubber, '18':COLORS.rubber, '19':COLORS.rubber,
  '20':COLORS.steel, '21':COLORS.steel, '22':COLORS.steel, '23':COLORS.steel, '24':COLORS.purple, 
};
export const partKey = name => name.slice(0, 2);
export const isRim = name => /__Rin_/.test(name);
export const colorFor = name => isRim(name) ? COLORS.ice : (LIVERY[partKey(name)] || COLORS.ice);
/* Piezas que no se dibujan (el halo 13 ya no viene en el modelo; se deja por si reaparece). */
export const HIDDEN = new Set(['13']);

/* Despiece: cada una de las 27 mallas del GLB tiene su propio vector de separación (mm; x = largo, +x al frente; y = alto; z = ancho, +z = derecha),
 * su etapa (1–5), un retraso dentro de la etapa, un giro y un arco. El cuerpo (01) queda fijo y es la referencia.
 *   etapa 1 llantas, rines, ejes y guías · 2 nariz, alerones, placas y soportes · 3 pontones · 4 espina y pilar · 5 cartucho
 * pieceId(nombre del nodo) devuelve la clave de esta tabla: llanta (t) y rin (r) se separan, igual que el soporte der./izq. del alerón.
 *   off  [x,y,z] mm a despiece completo        d    retraso dentro de la etapa (fracción del recorrido, 0–0.1)
 *   rot  [x,y,z] grados a despiece completo    arc  mm que se eleva a mitad del recorrido (trayectoria curva)
 *   guide  false = sin línea guía punteada */
export const EXPLODE_STEPS = 5;
export const PIECES = {
  '01':{ step:0, off:[0, 0, 0], name:{ es:'Cuerpo', en:'Body' } },
  // etapa 1 · ruedas: la llanta sale primero y el rin un poco más lejos; ejes y guías bajan
  '16t':{ step:1, off:[0, 0, -40], rot:[0, 0, -360], d:.00, guide:false, name:{ es:'Llanta delantera izquierda', en:'Front-left tyre' } },
  '16r':{ step:1, off:[0, 0, -58], rot:[0, 0, -360], d:.02, name:{ es:'Rin delantero izquierdo', en:'Front-left rim' } },
  '17t':{ step:1, off:[0, 0,  40], rot:[0, 0,  360], d:.04, guide:false, name:{ es:'Llanta delantera derecha', en:'Front-right tyre' } },
  '17r':{ step:1, off:[0, 0,  58], rot:[0, 0,  360], d:.06, name:{ es:'Rin delantero derecho', en:'Front-right rim' } },
  '18t':{ step:1, off:[0, 0, -40], rot:[0, 0, -360], d:.08, guide:false, name:{ es:'Llanta trasera izquierda', en:'Rear-left tyre' } },
  '18r':{ step:1, off:[0, 0, -58], rot:[0, 0, -360], d:.10, name:{ es:'Rin trasero izquierdo', en:'Rear-left rim' } },
  '19t':{ step:1, off:[0, 0,  40], rot:[0, 0,  360], d:.12, guide:false, name:{ es:'Llanta trasera derecha', en:'Rear-right tyre' } },
  '19r':{ step:1, off:[0, 0,  58], rot:[0, 0,  360], d:.14, name:{ es:'Rin trasero derecho', en:'Rear-right rim' } },
  '20':{ step:1, off:[0, -30, 0],  d:.05, name:{ es:'Eje delantero', en:'Front axle' } },
  '21':{ step:1, off:[0, -30, 0],  d:.09, name:{ es:'Eje trasero', en:'Rear axle' } },
  '22':{ step:1, off:[8, -50, 0],  d:.07, name:{ es:'Guía delantera', en:'Front tether guide' } },
  '23':{ step:1, off:[-8, -50, 0], d:.11, name:{ es:'Guía trasera', en:'Rear tether guide' } },
  // etapa 2 · nariz y alerones: el frente sale hacia adelante, la cola hacia atrás
  '04':{ step:2, off:[34, 0, 0],       d:.00, arc:6, name:{ es:'Nariz', en:'Nose cone' } },
  '06d':{ step:2, off:[58, 3, 6],      d:.04, arc:5, rot:[0, 0, 10],  name:{ es:'Soporte del alerón delantero (der.)', en:'Front wing mount (right)' } },
  '06i':{ step:2, off:[58, 3, -6],     d:.05, arc:5, rot:[0, 0, -10], name:{ es:'Soporte del alerón delantero (izq.)', en:'Front wing mount (left)' } },
  '05':{ step:2, off:[84, -3, 0],      d:.08, arc:7, name:{ es:'Alerón delantero', en:'Front wing' } },
  '07':{ step:2, off:[88, -3, 22],     d:.11, arc:5, rot:[0, 14, 0],  name:{ es:'Placa delantera derecha', en:'Front endplate (right)' } },
  '08':{ step:2, off:[88, -3, -22],    d:.12, arc:5, rot:[0, -14, 0], name:{ es:'Placa delantera izquierda', en:'Front endplate (left)' } },
  '09':{ step:2, off:[-74, 8, 0],      d:.02, arc:7, name:{ es:'Alerón trasero', en:'Rear wing' } },
  '10':{ step:2, off:[-74, 8, 26],     d:.06, arc:5, rot:[0, -14, 0], name:{ es:'Placa trasera derecha', en:'Rear endplate (right)' } },
  '11':{ step:2, off:[-74, 8, -26],    d:.07, arc:5, rot:[0, 14, 0],  name:{ es:'Placa trasera izquierda', en:'Rear endplate (left)' } },
  // etapa 3 · pontones a los lados
  '02':{ step:3, off:[5, 2, 50],       d:.00, arc:4, name:{ es:'Pontón derecho', en:'Right sidepod' } },
  '03':{ step:3, off:[5, 2, -50],      d:.04, arc:4, name:{ es:'Pontón izquierdo', en:'Left sidepod' } },
  // etapa 4 · espina y pilar hacia arriba
  '24':{ step:4, off:[0, 46, 0],       d:.00, name:{ es:'Espina', en:'Spine' } },
  '12':{ step:4, off:[-14, 60, 0],     d:.06, rot:[0, 0, 0], name:{ es:'Pilar del alerón trasero', en:'Rear wing pillar' } },
  // etapa 5 · el cartucho sale hacia atrás girando sobre su eje
  '15':{ step:5, off:[-98, 12, 0],     d:.03, rot:[360, 0, 0], arc:0, name:{ es:'Cartucho de CO₂', en:'CO₂ cartridge' } },
};
export function pieceId(name) {
  const k = partKey(name);
  if (/__Rin_/.test(name)) return k + 'r';
  if (/__Llanta_/.test(name)) return k + 't';
  if (k === '06') return /Izq$/.test(name) ? '06i' : '06d';
  return k;
}
/* Compatibilidad (scripts/sr26-view.html): despiece por prefijo numérico, con el vector de la primera pieza de cada clave. */
export const EXPLODE = {};
for (const id of Object.keys(PIECES)) { const k = id.slice(0, 2); if (!EXPLODE[k] && PIECES[id].step) EXPLODE[k] = { off: PIECES[id].off, step: PIECES[id].step }; }

/* Acabado por pieza (clave de pieceId): cada familia de piezas tiene su propio material para que se lean distintas bajo la misma luz.
 *   mate/satín  cuerpo, alerones, nariz y soportes (pintura con poco barniz)
 *   laca        pontones, placas y espina (barniz alto: reflejan el entorno con nitidez)
 *   caucho      llantas   ·   aluminio  rines y cartucho   ·   acero pulido  ejes   ·   latón  guías del cordón */
const FINISH = {
  satin:  { kind:'paint', metalness:.05, roughness:.6,  clearcoat:.3,  clearcoatRoughness:.45, envMapIntensity:.45 },
  matte:  { kind:'paint', metalness:.03, roughness:.78, clearcoat:.12, clearcoatRoughness:.6,  envMapIntensity:.35 },
  lacquer:{ kind:'paint', metalness:.12, roughness:.3,  clearcoat:1,   clearcoatRoughness:.07, envMapIntensity:.85 },
  rubber: { kind:'std',   metalness:0,   roughness:.96, envMapIntensity:.25 },
  alu:    { kind:'std',   metalness:.92, roughness:.3,  envMapIntensity:1.1,  color:COLORS.alu },
  steel:  { kind:'std',   metalness:1,   roughness:.18, envMapIntensity:1.15, color:COLORS.steel },
  brass:  { kind:'std',   metalness:1,   roughness:.3,  envMapIntensity:1,    color:COLORS.brass },
};
const FINISH_OF = {
  '01':'satin', '04':'satin', '05':'satin', '09':'satin', '06d':'matte', '06i':'matte', '12':'matte',
  '02':'lacquer', '03':'lacquer', '07':'lacquer', '08':'lacquer', '10':'lacquer', '11':'lacquer', '24':'lacquer',
  '16t':'rubber', '17t':'rubber', '18t':'rubber', '19t':'rubber', '16r':'alu', '17r':'alu', '18r':'alu', '19r':'alu',
  '15':'alu', '20':'steel', '21':'steel', '22':'brass', '23':'brass',
};

export function lookRenderer(renderer, shadows = true) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
}
/* Entorno de estudio (RoomEnvironment) prefiltrado en CubeUV. Hornear una vez cuesta lo mismo que hacerlo en cada visita, así que:
 *   - lookEnvironmentBaked: carga assets/models/env-room.png (scripts/bake-env.mjs), que ya trae el PMREM; no genera nada en el cliente.
 *   - lookEnvironment: genera el PMREM en el cliente (RoomEnvironment se carga solo si hace falta). Se usa para hornear y como respaldo. */
export async function lookEnvironment(renderer, scene, cubeSize) {
  try {
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pm = new THREE.PMREMGenerator(renderer);
    if (cubeSize) { const set = pm._setSize; pm._setSize = function () { return set.call(this, cubeSize); }; }
    const rt = pm.fromScene(new RoomEnvironment(), .04); scene.environment = rt.texture; pm.dispose();
    return rt;
  } catch (e) { /* sin entorno: quedan las luces directas */ }
}
/* PNG RGB: el valor lineal v (0..64) va como (v/64)^(1/3) en 8 bits; la imagen ES el render target CubeUV (mismo orden de filas). */
export const ENV_MAX = 64;
export async function lookEnvironmentBaked(scene, url) {
  const mk = n => { try { performance.mark('sr26:env-' + n); } catch (e) {} };
  const res = await (typeof url === 'string' ? fetch(url) : url);   // url: ruta o promesa de Response ya iniciada (js/stage.js)
  if (!res.ok) throw new Error('env ' + res.status);
  const blob = await res.blob(); mk('fetched');
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
  mk('decoded');
  const px = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, half = new Uint16Array(n * 4);
  const one = THREE.DataUtils.toHalfFloat(1);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const e = px[i * 4 + k] / 255; half[i * 4 + k] = THREE.DataUtils.toHalfFloat(e * e * e * ENV_MAX); half[i * 4 + 3] = one; }
  const tex = new THREE.DataTexture(half, c.width, c.height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.CubeUVReflectionMapping; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.LinearSRGBColorSpace; tex.needsUpdate = true;
  scene.environment = tex; mk('ready');
  return tex;
}
/* u = unidades de escena por mm (0.001 en el hero, que trabaja en metros). */
export function lookLights(scene, u = 1, shadows = true) {
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x1a2a52, .5));
  const key = new THREE.DirectionalLight(0xf2f6ff, 1.7); key.position.set(160 * u, 340 * u, 220 * u);
  key.castShadow = shadows; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; key.shadow.normalBias = .5 * u; key.shadow.radius = 3;
  Object.assign(key.shadow.camera, { left: -230 * u, right: 230 * u, top: 230 * u, bottom: -230 * u, near: 20 * u, far: 900 * u });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcddeef, 1.2); rim.position.set(-260 * u, 140 * u, -240 * u); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x8fb4ff, .6); fill.position.set(-220 * u, 60 * u, 200 * u); scene.add(fill);
  return key;
}
export function lookGround(scene, u = 1, y = -.3) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1200 * u, 1200 * u), new THREE.ShadowMaterial({ opacity: .42, depthWrite: false, fog: false }));
  g.rotation.x = -Math.PI / 2; g.position.y = y * u; g.receiveShadow = true; g.renderOrder = -1; scene.add(g); return g;
}

/* Colorea por posición en X (coordenadas locales de la malla, que viene centrada), no por malla:
 *   cuerpo (01): navy de la cola hasta el 55% del largo, azul hacia el frente, y entre ambos una franja verde inclinada
 *                (el corte se desplaza con el ancho Z para que quede en diagonal).
 *   pontones (02/03): morados, con la boca frontal (el último tramo hacia el frente) en navy. */
function bodyShader(mesh, mode) {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox, len = bb.max.x - bb.min.x;
  const U = {
    uMinX:{ value:bb.min.x }, uLen:{ value:len }, uCut:{ value: mode === 'body' ? .55 : .895 },
    uSkew:{ value: mode === 'body' ? .55 : 0 }, uStripe:{ value: mode === 'body' ? .035 : 0 },
    uA:{ value:new THREE.Color(mode === 'body' ? COLORS.navy : COLORS.purple) },
    uB:{ value:new THREE.Color(mode === 'body' ? COLORS.blue : COLORS.navy) },
    uG:{ value:new THREE.Color(COLORS.green) },
  };
  return shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform float uMinX, uLen, uCut, uSkew, uStripe;\nuniform vec3 uA, uB, uG;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float tt = (vLocal.x - uMinX) / uLen + uSkew * vLocal.z / uLen;
        float aa = max(fwidth(tt), 1e-5), hw = uStripe * .5;
        vec3 base = mix(uA, uG, step(1e-5, uStripe) * smoothstep(uCut - hw - aa, uCut - hw + aa, tt));
        base = mix(base, uB, smoothstep(uCut + hw - aa, uCut + hw + aa, tt));
        diffuseColor.rgb = base;`);
  };
}

/* Prepara una pieza por su nombre de nodo: normales (horneadas en el GLB), acabado según FINISH_OF y sombras. */
export function lookPart(mesh) {
  const key = partKey(mesh.name), id = pieceId(mesh.name), hex = colorFor(mesh.name);
  // Las normales suavizadas vienen horneadas en el GLB (scripts/bake-sr26-normals.mjs); si faltan, se suaviza todo.
  if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
  const fin = FINISH[FINISH_OF[id]] || FINISH.satin;
  const base = { color: new THREE.Color(fin.color || hex), fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
                 metalness: fin.metalness, roughness: fin.roughness, envMapIntensity: fin.envMapIntensity };
  const mat = fin.kind === 'paint'
    ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat: fin.clearcoat, clearcoatRoughness: fin.clearcoatRoughness })
    : new THREE.MeshStandardMaterial(base);
  if (key === '01') mat.onBeforeCompile = bodyShader(mesh, 'body');
  else if (key === '02' || key === '03') mat.onBeforeCompile = bodyShader(mesh, 'mouth');
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true;
}

/* ───────────── logos dibujados en código ─────────────
 * - Espina (24), ambos lados: lockup de Striker Racing en una línea (STRIKER en hielo, RACING en esmeralda).
 * - Zona B, los costados (pontones): reservados por completo al logo oficial de STEM Racing en vector (obligatorio a cada lado, entre las ruedas).
 * - Espacios del Partner Estratégico, el único nivel con lugar en el auto (contorno fino en hielo + texto chico): nariz (A), alerón trasero, 2 recuadros (C),
 *   alerón delantero a cada lado de la nariz (D), a negociar según la propuesta. Las placas traseras quedan sin recuadro (diseño aún no final).
 * Los puntos de pegado vienen en mm del modelo (x = largo, y = alto, z = ancho; +z = lado derecho). */
export const SLOT_TEXT = {
  es:{ partner:'PARTNER ESTRATÉGICO', partnerShort:'PARTNER', wing:['PARTNER', 'ESTRATÉGICO'] },
  en:{ partner:'STRATEGIC PARTNER', partnerShort:'PARTNER', wing:['STRATEGIC', 'PARTNER'] },
};
const FONT = '600 {s}px Oswald, "Arial Narrow", Impact, sans-serif';
export async function fonts() { try { await document.fonts.load('700 120px Oswald'); await document.fonts.load('600 40px Oswald'); } catch (e) { /* queda la fuente de respaldo */ } }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function drawLockup(img) {
  const c = canvasOf(1792, 320), g = c.getContext('2d'), s = 320;
  g.drawImage(img, 4, 4, s - 8, (s - 8) * img.height / img.width);
  g.textBaseline = 'alphabetic';
  let fs = 236; const face = n => `700 ${n}px Oswald, "Arial Narrow", Impact, sans-serif`;
  for (g.font = face(fs); g.measureText('STRIKER RACING').width > 1792 - 350 - 24 && fs > 80; g.font = face(fs -= 4));   // si Oswald no cargó, la de respaldo es más ancha: se reduce
  g.fillStyle = COLORS.ice; g.fillText('STRIKER', 350, 244);
  const w = g.measureText('STRIKER ').width; g.fillStyle = COLORS.green; g.fillText('RACING', 350 + w, 244);
  return c;
}
/* Logo oficial de STEM Racing dibujado en vector (js/stem-logo.js, de la guía de marca): emblema SR con su degradado y rótulo blanco con las letras oficiales. Sin imagen ni fondo. */
function drawStem() {
  const B = STEM_BOX, k = 4096 / B.w, c = canvasOf(4096, Math.round(B.h * k)), g = c.getContext('2d');
  g.scale(k, k); g.translate(-B.x, -B.y);
  const [x1, y1, x2, y2] = STEM_GRADIENT_LINE, gr = g.createLinearGradient(x1, y1, x2, y2);
  STEM_GRADIENT.forEach(([o, col]) => gr.addColorStop(o, col));
  const mk = new Path2D(STEM_MARK);
  g.lineJoin = 'round'; g.lineWidth = 3.2; g.strokeStyle = COLORS.navy; g.stroke(mk);   // filete oscuro: el emblema se separa del pontón morado
  g.fillStyle = gr; g.fill(mk);
  g.fillStyle = '#fff'; g.fill(new Path2D(STEM_WORD));
  return c;
}
/* Recuadro disponible: contorno fino en hielo y texto chico centrado (lines = 1 o 2 renglones). */
function drawSlot(w, h, lines, size) {
  const c = canvasOf(w, h), g = c.getContext('2d'), lw = Math.max(3, Math.round(h / 60));
  g.strokeStyle = COLORS.ice; g.lineWidth = lw; g.globalAlpha = .9; g.strokeRect(lw, lw, w - 2 * lw, h - 2 * lw);
  g.fillStyle = COLORS.ice; g.globalAlpha = .85; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = FONT.replace('{s}', size);
  const lh = size * 1.15, y0 = h / 2 - lh * (lines.length - 1) / 2;
  lines.forEach((t, i) => g.fillText(t, w / 2, y0 + i * lh));
  return c;
}
function drawWingSlots(lines) {
  const W = 1024, H = 280, n = 2, gap = 70, bw = (W - gap * (n - 1)) / n, c = canvasOf(W, H), g = c.getContext('2d');
  for (let i = 0; i < n; i++) g.drawImage(drawSlot(bw, H, lines, 64), i * (bw + gap), 0);   // el hueco central deja pasar la espina
  return c;
}
function decalMaterial(canvas) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false, toneMapped: false, fog: false });
}
/* Pega un decal a `mesh` donde un rayo (en mundo) toca la pieza. `up` orienta el decal. Devuelve el mesh del decal o null. */
function stick(mesh, mat, w, h, from, dir, up) {
  const hit = new THREE.Raycaster(from, dir).intersectObject(mesh, false)[0]; if (!hit) return null;
  const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const o = new THREE.Object3D(); o.up.copy(up); o.position.copy(hit.point).addScaledVector(n, .00012); o.lookAt(hit.point.clone().add(n)); o.updateMatrixWorld(true);
  plane.position.copy(o.position); plane.quaternion.copy(o.quaternion);
  mesh.attach(plane); return plane;
}
const mm = (x, y, z) => new THREE.Vector3(x, y, z).multiplyScalar(.001);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Posiciones de los espacios (mm, marco del modelo). Se exportan para dibujar marcadores sobre capturas. */
export const SLOTS = {
  ponton:{ x:93, y:14.2, z:31, w:28, h:28 * STEM_BOX.h / STEM_BOX.w },   // logo STEM Racing: el rectángulo más grande que cabe del todo en la parte plana del costado del pontón (x 79–107, z 9.4–19, z = ±31)
  alaDel:{ x:198.5, y:9.8, z:21, w:20, h:14 },         // cara superior del alerón delantero, a cada lado de la nariz (Partner Estratégico, a negociar)
  nariz:{ x:191, y:20.4, z:0, w:23, h:4.2 },           // panel plano sobre la nariz
  aleron:{ x:13.5, y:57, z:0, w:62, h:17 },            // cara superior del alerón trasero (4 recuadros)
  espina:{ x:57, y:49.6, z:1.2, w:40, h:40 * 320 / 1792, tilt:12 },   // lockup de Striker Racing sobre la espina, inclinado con la caída del lomo
};

/* parts: { '02': mesh, '03': mesh, ... } con las matrices del mundo ya actualizadas. lang: 'es' | 'en'.
 * Devuelve la lista de decals { kind, mesh }; si falta una pieza (p. ej. no existe la 13/14) simplemente se omite. */
/* Fuentes + imagen del logo; se puede llamar antes de tener el modelo para que la descarga corra en paralelo. */
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
export function preloadDecalAssets(logoUrl) {
  return Promise.all([fonts(), loadImg(logoUrl)]).then(r => ({ logo: r[1] }));
}
export async function addLogoDecals(parts, logoUrl, lang = 'es') {
  const T = SLOT_TEXT[lang] || SLOT_TEXT.es;
  const { logo: img } = await (typeof logoUrl === 'string' ? preloadDecalAssets(logoUrl) : logoUrl);   // logoUrl puede ser la promesa de preloadDecalAssets
  const lockup = decalMaterial(drawLockup(img));
  const partner = decalMaterial(drawSlot(1024, 188, [T.partner], 82));
  const wing = decalMaterial(drawWingSlots(T.wing));
  const stemMat = decalMaterial(drawStem());
  const wingFront = decalMaterial(drawSlot(700, Math.round(700 * SLOTS.alaDel.h / SLOTS.alaDel.w), [T.partnerShort], 70));
  const out = [], S = SLOTS;
  /* espina: el lockup va inclinado siguiendo la caída del lomo; a cada lado se mira desde afuera */
  const sp = parts['24'];
  if (sp) [1, -1].forEach(side => {
    const a = THREE.MathUtils.degToRad(S.espina.tilt), up = V(Math.sin(a), Math.cos(a), 0);
    const d = stick(sp, lockup, S.espina.w * .001, S.espina.h * .001, mm(S.espina.x, S.espina.y, side * 40), V(0, 0, -side), up);
    if (d) out.push({ kind:'logo', mesh:d });
  });
  ['02', '03'].forEach((k, i) => {   // 02 = pontón derecho (+z), 03 = izquierdo (-z)
    const m = parts[k]; if (!m) return; const side = i === 0 ? 1 : -1;
    // Zona B: el costado es solo del logo de STEM Racing (obligatorio a cada lado, entre las ruedas), con las letras oficiales
    const d = stick(m, stemMat, S.ponton.w * .001, S.ponton.h * .001, mm(S.ponton.x, S.ponton.y, side * 200), V(0, 0, -side), V(0, 1, 0));
    if (d) out.push({ kind:'stem', mesh:d });
  });
  if (parts['05']) [1, -1].forEach(side => {   // alerón delantero: un recuadro a cada lado de la nariz
    const d = stick(parts['05'], wingFront, S.alaDel.w * .001, S.alaDel.h * .001, mm(S.alaDel.x, 200, side * S.alaDel.z), V(0, -1, 0), V(1, 0, 0));
    if (d) out.push({ kind:'partner', mesh:d });
  });
  if (parts['04']) { const d = stick(parts['04'], partner, S.nariz.w * .001, S.nariz.h * .001, mm(S.nariz.x, 200, 0), V(0, -1, 0), V(0, 0, -1)); if (d) out.push({ kind:'partner', mesh:d }); }
  if (parts['09']) { const d = stick(parts['09'], wing, S.aleron.w * .001, S.aleron.h * .001, mm(S.aleron.x, 200, 0), V(0, -1, 0), V(1, 0, 0)); if (d) out.push({ kind:'wing', mesh:d }); }
  return out;
}
