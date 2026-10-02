/* Striker Racing · SR-26 · acabado compartido del auto 3D (visor del hero)
 * Un solo lugar para: librea por pieza, offsets del despiece, entorno/luces/sombras, materiales y el logo del equipo (decals).
 * La escena del hero trabaja en metros (el GLB viene en metros), de ahí `u = 0.001` en las luces. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/* Librea: un color plano por pieza (paleta del sitio). Nada es blanco.
 *   carrocería: azul #183969 (cubierta) y navy #071B33 (pontones, donde va el logo en hielo)
 *   franja/acento: morado #7137D4 (nariz y pilar)   alerones y placas: verde #12B866
 *   hielo #CDDEEF solo en detalles chicos (ejes, bujes, texto del logo)   limón #C8FF32: solo el tapón del buje */
export const LIVERY = {
  '01':'#183969', '02':'#071B33', '03':'#071B33', '04':'#7137D4',
  '05':'#12B866', '06':'#12B866', '07':'#183969', '08':'#183969',
  '09':'#12B866', '10':'#183969', '11':'#183969', '12':'#7137D4',
  '14':'#CDDEEF', '15':'#071B33',
  '16':'#071B33', '17':'#071B33', '18':'#071B33', '19':'#071B33', '20':'#CDDEEF', '21':'#CDDEEF', '22':'#071B33', '23':'#071B33',
};
/* Piezas que no se dibujan. El halo (13_Halo_MARCADOR) es solo un marcador de volumen del reglamento: fuera del modelo visual. */
export const HIDDEN = new Set(['13']);

/* Despiece: desplazamiento (mm) de cada pieza al estar totalmente separada; x = largo, y = alto, z = ancho.
 * `step` ordena el escalonado (las piezas salen una tras otra, de adentro hacia afuera). */
export const EXPLODE = {
  '02':{ off:[0,0,46],   step:1 }, '03':{ off:[0,0,-46],  step:1 },
  '04':{ off:[52,-4,0],  step:2 },
  '05':{ off:[78,0,0],   step:3 }, '06':{ off:[50,24,0],  step:3 }, '07':{ off:[78,0,34],  step:3 }, '08':{ off:[78,0,-34], step:3 },
  '09':{ off:[-72,22,0], step:4 }, '10':{ off:[-72,14,34], step:4 }, '11':{ off:[-72,14,-34], step:4 }, '12':{ off:[-48,42,0], step:4 },
  '15':{ off:[-86,0,0],  step:6 },
  '16':{ off:[0,0,-44],  step:7 }, '17':{ off:[0,0,44], step:7 }, '18':{ off:[0,0,-44], step:7 }, '19':{ off:[0,0,44], step:7 },
  '20':{ off:[0,-30,0],  step:8 }, '21':{ off:[0,-30,0], step:8 },
  '22':{ off:[0,-46,0],  step:9 }, '23':{ off:[0,-46,0], step:9 },
};
export const EXPLODE_STEPS = 9;

const PAINT = new Set(['01','02','03','04','05','06','07','08','09','10','11','12']);
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
/* Prepara una pieza: normales suavizadas, material por tipo (pintura con barniz, caucho, metal) y sombras. */
export function lookPart(mesh, key, hex) {
  mesh.geometry = toCreasedNormals(mesh.geometry, THREE.MathUtils.degToRad(38));
  const base = { color: new THREE.Color(hex), fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  let mat;
  if (PAINT.has(key)) mat = new THREE.MeshPhysicalMaterial({ ...base, metalness: .04, roughness: .62, clearcoat: .2, clearcoatRoughness: .4, envMapIntensity: .4 });
  else if (WHEEL.test(key)) mat = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: .82, envMapIntensity: .5 });
  else if (key === '15' || key === '20' || key === '21') mat = new THREE.MeshStandardMaterial({ ...base, metalness: .6, roughness: .42, envMapIntensity: .7 });
  else mat = new THREE.MeshStandardMaterial({ ...base, metalness: .1, roughness: .55, envMapIntensity: .8 });
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true;
  if (WHEEL.test(key)) {   /* buje de aluminio: un cilindro liso se lee como rueda de juguete */
    const hubMat = new THREE.MeshStandardMaterial({ color: '#CDDEEF', metalness: .45, roughness: .5, envMapIntensity: .5, fog: false });
    const capMat = new THREE.MeshStandardMaterial({ color: '#C8FF32', metalness: .2, roughness: .5, envMapIntensity: .4, fog: false });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.0062, .0062, .0162, 28), hubMat); hub.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0024, .0024, .0168, 16), capMat); cap.rotation.x = Math.PI / 2;
    hub.castShadow = cap.castShadow = true; mesh.add(hub, cap);
  }
}

/* ───────────── logo del equipo ─────────────
 * Un solo decal: el "lockup" (logo + STRIKER RACING) en versión clara para fondo oscuro (STRIKER en hielo, RACING en esmeralda).
 * Va únicamente en los dos costados (pontones); no hay logo arriba del auto. */
async function drawLockup(img) {
  try { await document.fonts.load('700 120px Oswald'); } catch (e) { /* queda la fuente de respaldo */ }
  const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
  const g = c.getContext('2d'), s = 384;
  g.drawImage(img, 6, 6, s - 12, (s - 12) * img.height / img.width);
  g.fillStyle = '#CDDEEF'; g.textBaseline = 'alphabetic';
  g.font = '700 150px Oswald, "Arial Narrow", Impact, sans-serif'; g.fillText('STRIKER', 380, 190);
  g.fillStyle = '#12B866'; g.fillText('RACING', 380, 340);
  return c;
}
function decalMaterial(canvas) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false, toneMapped: false, fog: false });
}
/* Pega un decal a `mesh` en el punto donde un rayo (en mundo) toca la pieza. `up` orienta el decal. Devuelve el mesh del decal o null. */
function stick(mesh, mat, w, h, from, dir, up) {
  const hit = new THREE.Raycaster(from, dir).intersectObject(mesh, false)[0]; if (!hit) return null;
  const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const o = new THREE.Object3D(); o.up.copy(up); o.position.copy(hit.point).addScaledVector(n, .00012); o.lookAt(hit.point.clone().add(n)); o.updateMatrixWorld(true);
  plane.position.copy(o.position); plane.quaternion.copy(o.quaternion);
  mesh.attach(plane); return plane;
}
/* parts: { '01': mesh, '02': mesh, ... } con las matrices del mundo ya actualizadas. Devuelve el material del logo. */
export async function addLogoDecals(parts, logoUrl) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = logoUrl; });
  const lockup = decalMaterial(await drawLockup(img));
  const Y = new THREE.Vector3(0, 1, 0);
  ['02', '03'].forEach(k => {   /* lockup en el lado exterior de cada pontón; la nariz queda a la derecha de quien lo ve */
    const m = parts[k]; if (!m) return;
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), side = c.z >= 0 ? 1 : -1;
    stick(m, lockup, .034, .034 * 384 / 1024, new THREE.Vector3(c.x + .003, c.y + .0005, side * .2), new THREE.Vector3(0, 0, -side), Y);
  });
  return [lockup];
}
