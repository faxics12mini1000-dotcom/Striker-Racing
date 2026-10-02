/* Striker Racing · SR-26 · acabado compartido del auto 3D (visor del hero)
 * Un solo lugar para: librea por pieza, offsets del despiece, entorno/luces/sombras, materiales y el logo del equipo (decals).
 * La escena del hero trabaja en metros (el GLB viene en metros), de ahí `u = 0.001` en las luces. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/* Librea: un color plano por pieza (paleta del sitio). Pontones blancos para que el logo se lea; nariz esmeralda. */
export const LIVERY = {
  '01':'#7138D4', '02':'#E9F1FA', '03':'#E9F1FA', '04':'#12B866',
  '05':'#2020E0', '06':'#2020E0', '07':'#3AF7B2', '08':'#3AF7B2',
  '09':'#2020E0', '10':'#3AF7B2', '11':'#3AF7B2', '12':'#7138D4',
  '13':'#CDDEEF', '14':'#CDDEEF', '15':'#CDDEEF',
  '16':'#22385C', '17':'#22385C', '18':'#22385C', '19':'#22385C', '20':'#9DB8D6', '21':'#9DB8D6', '22':'#140A33', '23':'#140A33',
};

/* Despiece: desplazamiento (mm) de cada pieza al estar totalmente separada; x = largo, y = alto, z = ancho.
 * `step` ordena el escalonado (las piezas salen una tras otra, de adentro hacia afuera). */
export const EXPLODE = {
  '02':{ off:[0,0,46],   step:1 }, '03':{ off:[0,0,-46],  step:1 },
  '04':{ off:[52,-4,0],  step:2 },
  '05':{ off:[78,0,0],   step:3 }, '06':{ off:[50,24,0],  step:3 }, '07':{ off:[78,0,34],  step:3 }, '08':{ off:[78,0,-34], step:3 },
  '09':{ off:[-72,22,0], step:4 }, '10':{ off:[-72,14,34], step:4 }, '11':{ off:[-72,14,-34], step:4 }, '12':{ off:[-48,42,0], step:4 },
  '13':{ off:[0,66,0],   step:5 },
  '15':{ off:[-86,0,0],  step:6 },
  '16':{ off:[0,0,-44],  step:7 }, '17':{ off:[0,0,44], step:7 }, '18':{ off:[0,0,-44], step:7 }, '19':{ off:[0,0,44], step:7 },
  '20':{ off:[0,-30,0],  step:8 }, '21':{ off:[0,-30,0], step:8 },
  '22':{ off:[0,-46,0],  step:9 }, '23':{ off:[0,-46,0], step:9 },
};
export const EXPLODE_STEPS = 9;

const PAINT = new Set(['01','02','03','04','05','06','07','08','09','10','11','12']);
const WHEEL = /^1[6-9]$/;

export function lookRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
export function lookEnvironment(renderer, scene) {
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); } catch (e) { /* sin entorno: quedan las luces directas */ }
}
/* u = unidades de escena por mm (0.001 en el hero, que trabaja en metros). */
export function lookLights(scene, u = 1) {
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x1a2a52, .55));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(160 * u, 340 * u, 220 * u);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .5 * u; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -230 * u, right: 230 * u, top: 230 * u, bottom: -230 * u, near: 20 * u, far: 900 * u });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcddeef, 1.6); rim.position.set(-260 * u, 140 * u, -240 * u); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x8fb4ff, .5); fill.position.set(-220 * u, 60 * u, 200 * u); scene.add(fill);
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
  if (PAINT.has(key)) mat = new THREE.MeshPhysicalMaterial({ ...base, metalness: .22, roughness: .42, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1 });
  else if (WHEEL.test(key)) mat = new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: .82, envMapIntensity: .5 });
  else if (key === '13') mat = new THREE.MeshPhysicalMaterial({ ...base, metalness: .75, roughness: .32, clearcoat: .4, envMapIntensity: 1 });
  else if (key === '15' || key === '20' || key === '21') mat = new THREE.MeshStandardMaterial({ ...base, metalness: .85, roughness: .3, envMapIntensity: 1.1 });
  else mat = new THREE.MeshStandardMaterial({ ...base, metalness: .1, roughness: .55, envMapIntensity: .8 });
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true;
  if (WHEEL.test(key)) {   /* buje de aluminio: un cilindro liso se lee como rueda de juguete */
    const hubMat = new THREE.MeshStandardMaterial({ color: '#9DB8D6', metalness: .9, roughness: .28, envMapIntensity: 1.2, fog: false });
    const capMat = new THREE.MeshStandardMaterial({ color: '#0A1424', metalness: .6, roughness: .4, fog: false });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.0072, .0072, .0162, 28), hubMat); hub.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0026, .0026, .0172, 16), capMat); cap.rotation.x = Math.PI / 2;
    hub.castShadow = cap.castShadow = true; mesh.add(hub, cap);
  }
}

/* ───────────── logo del equipo ─────────────
 * Dos texturas dibujadas en canvas con logo.png: el "lockup" (logo + STRIKER RACING) para los pontones blancos
 * y una insignia redonda blanca para las superficies de color (cubierta del motor, alerón). */
async function drawLockup(img) {
  try { await document.fonts.load('700 120px Oswald'); } catch (e) { /* queda la fuente de respaldo */ }
  const c = document.createElement('canvas'); c.width = 1024; c.height = 384;
  const g = c.getContext('2d'), s = 384;
  g.drawImage(img, 6, 6, s - 12, (s - 12) * img.height / img.width);
  g.fillStyle = '#071B33'; g.textBaseline = 'alphabetic';
  g.font = '700 150px Oswald, "Arial Narrow", Impact, sans-serif'; g.fillText('STRIKER', 380, 190);
  g.fillStyle = '#12B866'; g.fillText('RACING', 380, 340);
  return c;
}
function drawBadge(img) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#F4F8FD'; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#071B33'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 238, 0, Math.PI * 2); g.stroke();
  const w = 330; g.drawImage(img, 256 - w / 2, 256 - w * img.height / img.width / 2, w, w * img.height / img.width);
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
/* parts: { '01': mesh, '02': mesh, ... } con las matrices del mundo ya actualizadas. Devuelve los materiales del logo. */
export async function addLogoDecals(parts, logoUrl) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = logoUrl; });
  const lockup = decalMaterial(await drawLockup(img)), badge = decalMaterial(drawBadge(img));
  const Y = new THREE.Vector3(0, 1, 0);
  ['02', '03'].forEach(k => {   /* lockup en el lado exterior de cada pontón; la nariz queda a la derecha de quien lo ve */
    const m = parts[k]; if (!m) return;
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), side = c.z >= 0 ? 1 : -1;
    stick(m, lockup, .034, .034 * 384 / 1024, new THREE.Vector3(c.x + .003, c.y + .0005, side * .2), new THREE.Vector3(0, 0, -side), Y);
  });
  const body = parts['01'];   /* insignia sobre la cubierta del motor, hacia atrás para que no tape el halo */
  if (body) {
    const b = new THREE.Box3().setFromObject(body), x = b.min.x + (b.max.x - b.min.x) * .3;
    stick(body, badge, .017, .017, new THREE.Vector3(x, .2, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0));
  }
  return [lockup, badge];
}
