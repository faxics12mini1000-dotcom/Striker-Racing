/* Striker Racing · SR-26 · acabado compartido del auto 3D (visor del hero y vista de patrocinios)
 * Un solo lugar para: librea por pieza, offsets del despiece, entorno/luces/sombras, materiales y los logos dibujados en código (decals).
 * Las piezas vienen de assets/models/sr26.glb (un nodo por STL, nombre = archivo sin extensión). La escena trabaja en metros,
 * de ahí `u = 0.001` en las luces. Faltan la 13 y la 14 en el modelo: nada aquí depende de que existan. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const COLORS = { navy:'#071B33', blue:'#183969', purple:'#7137D4', green:'#12B866', ice:'#CDDEEF', rubber:'#0E1013', steel:'#8E9AAB' };

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

/* Despiece por etapas (mm; x = largo, y = alto, z = ancho, +z = lado derecho). El cuerpo (01) queda fijo en el centro.
 *   1 llantas y ejes hacia afuera (+ guías, hacia abajo)   2 alerones, placas, soportes (y nariz) hacia adelante / atrás
 *   3 pontones a los lados   4 espina y pilar hacia arriba   5 cartucho hacia atrás
 * Las dos mallas de cada llanta (Llanta/Rin) y los dos soportes delanteros comparten clave, así que se mueven juntos. */
export const EXPLODE = {
  '16':{ off:[0,0,-44], step:1 }, '17':{ off:[0,0,44], step:1 }, '18':{ off:[0,0,-44], step:1 }, '19':{ off:[0,0,44], step:1 },
  '20':{ off:[0,-30,0], step:1 }, '21':{ off:[0,-30,0], step:1 }, '22':{ off:[0,-46,0], step:1 }, '23':{ off:[0,-46,0], step:1 },
  '04':{ off:[34,0,0],  step:2 }, '06':{ off:[56,0,0],  step:2 }, '05':{ off:[80,0,0],  step:2 },
  '07':{ off:[80,0,14], step:2 }, '08':{ off:[80,0,-14], step:2 },
  '09':{ off:[-72,0,0], step:2 }, '10':{ off:[-72,0,14], step:2 }, '11':{ off:[-72,0,-14], step:2 },
  '02':{ off:[0,0,46],  step:3 }, '03':{ off:[0,0,-46], step:3 },
  '24':{ off:[0,40,0],  step:4 }, '12':{ off:[0,40,0],  step:4 },
  '15':{ off:[-90,0,0], step:5 },
};
export const EXPLODE_STEPS = 5;

const PAINT = new Set(['01','02','03','04','05','06','07','08','09','10','11','12','24']);
const WHEEL = /^1[6-9]$/;

export function lookRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
export function lookEnvironment(renderer, scene) {
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); } catch (e) { /* sin entorno: quedan las luces directas */ }
}
/* u = unidades de escena por mm (0.001 en el hero, que trabaja en metros). */
export function lookLights(scene, u = 1) {
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x1a2a52, .5));
  const key = new THREE.DirectionalLight(0xf2f6ff, 1.7); key.position.set(160 * u, 340 * u, 220 * u);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .5 * u; key.shadow.radius = 4;
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

/* Prepara una pieza por su nombre de nodo: normales suavizadas, material por tipo (pintura mate/con barniz, caucho, metal) y sombras. */
export function lookPart(mesh) {
  const key = partKey(mesh.name), hex = colorFor(mesh.name);
  mesh.geometry = toCreasedNormals(mesh.geometry, THREE.MathUtils.degToRad(38));
  const base = { color: new THREE.Color(hex), fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  let mat;
  if (key === '01') mat = new THREE.MeshPhysicalMaterial({ ...base, metalness: .02, roughness: .88, clearcoat: 0, envMapIntensity: .35 });   // navy mate
  else if (PAINT.has(key)) mat = new THREE.MeshPhysicalMaterial({ ...base, metalness: .04, roughness: .62, clearcoat: .2, clearcoatRoughness: .4, envMapIntensity: .4 });
  else if (WHEEL.test(key) && isRim(mesh.name)) mat = new THREE.MeshStandardMaterial({ ...base, metalness: .45, roughness: .5, envMapIntensity: .6 });
  else if (WHEEL.test(key)) mat = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: .86, envMapIntensity: .45 });
  else mat = new THREE.MeshStandardMaterial({ ...base, metalness: .6, roughness: .42, envMapIntensity: .7 });   // gris acero: ejes, guías, cartucho
  if (key === '01') mat.onBeforeCompile = bodyShader(mesh, 'body');
  else if (key === '02' || key === '03') mat.onBeforeCompile = bodyShader(mesh, 'mouth');
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true;
}

/* ───────────── logos dibujados en código ─────────────
 * - Espina (24), ambos lados: lockup de Striker Racing en versión clara (STRIKER en hielo, RACING en esmeralda).
 * - Espacios disponibles (contorno fino en hielo + texto chico): panel plano de cada pontón → ALIADO TÉCNICO;
 *   panel plano sobre la nariz → PARTNER ESTRATÉGICO; cara superior del alerón trasero → 4 recuadros chicos.
 * Los puntos de pegado vienen en mm del modelo (x = largo, y = alto, z = ancho; +z = lado derecho). */
export const SLOT_TEXT = {
  es:{ ally:'ALIADO TÉCNICO', partner:'PARTNER ESTRATÉGICO', wing:['ALIADO', 'TÉCNICO'] },
  en:{ ally:'TECHNICAL ALLY', partner:'STRATEGIC PARTNER', wing:['TECHNICAL', 'ALLY'] },
};
const FONT = '600 {s}px Oswald, "Arial Narrow", Impact, sans-serif';
async function fonts() { try { await document.fonts.load('700 120px Oswald'); await document.fonts.load('600 40px Oswald'); } catch (e) { /* queda la fuente de respaldo */ } }
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function drawLockup(img) {
  const c = canvasOf(1024, 384), g = c.getContext('2d'), s = 384;
  g.drawImage(img, 6, 6, s - 12, (s - 12) * img.height / img.width);
  g.fillStyle = COLORS.ice; g.textBaseline = 'alphabetic';
  g.font = '700 150px Oswald, "Arial Narrow", Impact, sans-serif'; g.fillText('STRIKER', 380, 190);
  g.fillStyle = COLORS.green; g.fillText('RACING', 380, 340);
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
  const W = 1024, H = 280, n = 4, gap = 20, bw = (W - gap * (n - 1)) / n, c = canvasOf(W, H), g = c.getContext('2d');
  for (let i = 0; i < n; i++) g.drawImage(drawSlot(bw, H, lines, 40), i * (bw + gap), 0);
  return c;
}
function decalMaterial(canvas) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
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
  ponton:{ x:96.6, y:14.4, z:31, w:34, h:9.5 },        // panel plano exterior de cada pontón (z = ±31)
  nariz:{ x:191, y:20.4, z:0, w:23, h:4.2 },           // panel plano sobre la nariz
  aleron:{ x:13.5, y:57, z:0, w:62, h:17 },            // cara superior del alerón trasero (4 recuadros)
  espina:{ x:46, y:51.4, z:1.2, w:23, h:8.6, tilt:5 },
};

/* parts: { '02': mesh, '03': mesh, ... } con las matrices del mundo ya actualizadas. lang: 'es' | 'en'.
 * Devuelve la lista de decals { kind, mesh }; si falta una pieza (p. ej. no existe la 13/14) simplemente se omite. */
export async function addLogoDecals(parts, logoUrl, lang = 'es') {
  const T = SLOT_TEXT[lang] || SLOT_TEXT.es;
  await fonts();
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = logoUrl; });
  const lockup = decalMaterial(drawLockup(img));
  const ally = decalMaterial(drawSlot(1024, 284, [T.ally], 96));
  const partner = decalMaterial(drawSlot(1024, 188, [T.partner], 82));
  const wing = decalMaterial(drawWingSlots(T.wing));
  const out = [], S = SLOTS;
  /* espina: el lockup va inclinado siguiendo la caída del lomo; a cada lado se mira desde afuera */
  const sp = parts['24'];
  if (sp) [1, -1].forEach(side => {
    const a = THREE.MathUtils.degToRad(S.espina.tilt), up = V(Math.sin(a), Math.cos(a), 0);
    const d = stick(sp, lockup, S.espina.w * .001, S.espina.w * .001 * 384 / 1024, mm(S.espina.x, S.espina.y, side * 40), V(0, 0, -side), up);
    if (d) out.push({ kind:'logo', mesh:d });
  });
  ['02', '03'].forEach((k, i) => {   // 02 = pontón derecho (+z), 03 = izquierdo (-z)
    const m = parts[k]; if (!m) return; const side = i === 0 ? 1 : -1;
    const d = stick(m, ally, S.ponton.w * .001, S.ponton.h * .001, mm(S.ponton.x, S.ponton.y, side * 200), V(0, 0, -side), V(0, 1, 0));
    if (d) out.push({ kind:'ally', mesh:d });
  });
  if (parts['04']) { const d = stick(parts['04'], partner, S.nariz.w * .001, S.nariz.h * .001, mm(S.nariz.x, 200, 0), V(0, -1, 0), V(0, 0, -1)); if (d) out.push({ kind:'partner', mesh:d }); }
  if (parts['09']) { const d = stick(parts['09'], wing, S.aleron.w * .001, S.aleron.h * .001, mm(S.aleron.x, 200, 0), V(0, -1, 0), V(1, 0, 0)); if (d) out.push({ kind:'wing', mesh:d }); }
  return out;
}
