/* Configurador de marca (/auto/ y /en/car/). El visitante carga su logo (PNG o SVG) y lo ve:
 *   · sobre las zonas del auto 3D del nivel Partner Estratégico (nariz A, alerón trasero C, alerón delantero D),
 *   · en maquetas 2D del uniforme y del Pit Display según el nivel elegido,
 * y descarga una imagen «propuesta de marca». PRIVACIDAD: el archivo se lee y se dibuja solo en este navegador (FileReader/canvas);
 * no hay ninguna petición de red con él. Los niveles salen de data/zonas.json (nombres idénticos a /patrocinios/). */
import DATA from '../data/zonas.json';

const root = document.getElementById('configurador');
if (root) init();
zonesPanel();

/* Panel «Zonas de patrocinio»: el botón resalta A–D sobre el auto 3D (y lo carga si aún no está listo); al pasar o enfocar una fila se resalta solo esa zona. */
function zonesPanel() {
  const panel = document.getElementById('zonas'), stage = document.getElementById('modelStage');
  if (!panel || !stage) return;
  const btn = document.getElementById('zonesToggle');
  let on = location.hash === '#zonas';
  const send = (isOn, only) => stage.dispatchEvent(new CustomEvent('sr26-zones', { detail: { on: isOn, only } }));
  const sync = () => { if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false'); window.__srZones = on; };
  sync();
  if (btn) btn.addEventListener('click', () => {
    on = !on; sync(); send(on);
    if (on && !stage.classList.contains('is-ready')) { const b = stage.querySelector('.car-cta-btn.is-primary'); if (b) b.click(); }
    if (on) stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });
  panel.querySelectorAll('.zone-row').forEach(r => {
    const id = r.getAttribute('data-zone');
    ['mouseenter', 'focus'].forEach(ev => r.addEventListener(ev, () => send(true, id)));
    ['mouseleave', 'blur'].forEach(ev => r.addEventListener(ev, () => send(on)));
  });
}

function init() {
  const lang = (document.documentElement.lang || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
  const T = lang === 'en' ? {
    errType: 'Use a PNG or SVG file.', errSize: 'The file is larger than 2 MB. Use a lighter version.', errRead: 'That file could not be read as an image.',
    opaque: 'Your logo has an opaque background. It is shown as is; a PNG or SVG with a transparent background looks better.',
    transparent: 'Transparent background detected.', noCar: 'This tier has no place on the car: your brand goes on the uniform and the Pit Display (mock-ups below).',
    onCar: 'Your logo is on the car’s Strategic Partner spaces (A nose, C rear wing, D front wing).', carWait: 'Open the 3D viewer to see it on the car.',
    front: 'Front', back: 'Back', uniform: 'Uniform', pit: 'Pit Display', car: 'Car (3D)', title: 'Brand proposal', tier: 'Tier',
    fine: 'Illustrative proposal on a visual prototype. It is not an agreement and does not confirm any placement; current tiers and benefits are on the sponsorship page.',
    noPhoto: 'Open the 3D viewer to include the car', saved: 'Proposal downloaded.', cleared: 'Logo removed.', loaded: 'Logo loaded.',
  } : {
    errType: 'Usa un archivo PNG o SVG.', errSize: 'El archivo pesa más de 2 MB. Usa una versión más ligera.', errRead: 'No se pudo leer ese archivo como imagen.',
    opaque: 'Tu logo tiene fondo opaco. Se muestra tal cual; un PNG o SVG con fondo transparente se ve mejor.',
    transparent: 'Fondo transparente detectado.', noCar: 'Este nivel no tiene lugar en el auto: tu marca va en el uniforme y en el Pit Display (maquetas de abajo).',
    onCar: 'Tu logo está en los espacios del auto del Partner Estratégico (A nariz, C alerón trasero, D alerón delantero).', carWait: 'Abre el visor 3D para verlo sobre el auto.',
    front: 'Frente', back: 'Espalda', uniform: 'Uniforme', pit: 'Pit Display', car: 'Auto (3D)', title: 'Propuesta de marca', tier: 'Nivel',
    fine: 'Propuesta ilustrativa sobre un prototipo visual. No es un acuerdo ni confirma ubicaciones; los niveles y beneficios vigentes están en la página de patrocinios.',
    noPhoto: 'Abre el visor 3D para incluir el auto', saved: 'Propuesta descargada.', cleared: 'Logo quitado.', loaded: 'Logo cargado.',
  };
  const $ = id => document.getElementById(id);
  const file = $('cfgFile'), levelSel = $('cfgLevel'), status = $('cfgStatus'), info = $('cfgInfo'), clearBtn = $('cfgClear'), dlBtn = $('cfgDownload'), see3d = $('cfgSee3d');
  const cUni = $('cfgUniform'), cPit = $('cfgPit');
  const stage = document.getElementById('modelStage');
  let logo = null, bg = 'dark';

  // colores: tokens de css/site.css
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = () => ({ navy: css('--navy-deep'), surface: css('--surface'), surface2: css('--surface-2'), line: css('--border-fine'), ice: css('--ice'), emerald: css('--emerald'), lime: css('--lime'), dim: 'rgba(205,222,239,0.72)' });

  // niveles
  levelSel.textContent = '';
  DATA.levels.forEach(l => { const o = document.createElement('option'); o.value = l.key; o.textContent = l.name[lang]; levelSel.appendChild(o); });
  levelSel.value = 'partner';
  const level = () => DATA.levels.find(l => l.key === levelSel.value);

  const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad); };

  // ---------- carga del logo ----------
  function validate(f) {
    if (!DATA.limits.types.includes(f.type) && !/\.(png|svg)$/i.test(f.name)) return T.errType;
    if (f.size > DATA.limits.maxBytes) return T.errSize;
    return '';
  }
  function rasterize(img) {
    // imagen → canvas (máx. 1024 px por lado; un SVG sin tamaño propio se dibuja a 512)
    let w = img.naturalWidth || 512, h = img.naturalHeight || 512; const k = Math.min(1, 1024 / Math.max(w, h));
    if (img.naturalWidth && img.naturalWidth < 256 && /svg/.test(img.src)) { /* SVG pequeño: se amplía */ }
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  }
  function hasTransparency(c) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) return true;
    return false;
  }
  function onFile() {
    const f = file.files && file.files[0]; if (!f) return;
    const err = validate(f);
    if (err) { say(err, true); file.value = ''; return; }
    const reader = new FileReader();
    reader.onerror = () => say(T.errRead, true);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => { say(T.errRead, true); logo = null; };
      img.onload = () => {
        logo = rasterize(img);
        say(T.loaded + ' ' + (hasTransparency(logo) ? T.transparent : T.opaque));
        refresh(); track('configurator_logo');
      };
      img.src = reader.result;   // data: URL, nunca una ruta de red
    };
    reader.readAsDataURL(f);
  }
  file.addEventListener('change', onFile);
  clearBtn.addEventListener('click', () => { logo = null; file.value = ''; say(T.cleared); refresh(); });
  levelSel.addEventListener('change', refresh);
  root.querySelectorAll('input[name="cfgBg"]').forEach(r => r.addEventListener('change', () => { bg = r.value; if (r.checked) refresh(); }));
  see3d.addEventListener('click', () => {
    if (!stage) return;
    stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const b = stage.querySelector('.car-cta-btn.is-primary'); if (b) b.click();
  });

  // ---------- 3D ----------
  function sendToCar() {
    const lv = level(), img = logo && lv.car ? logo : null;
    window.__srLogo = img;
    if (stage) stage.dispatchEvent(new CustomEvent('sr26-logo', { detail: { img } }));
    if (!logo) info.textContent = '';
    else info.textContent = lv.car ? (stage && stage.classList.contains('is-ready') ? T.onCar : T.onCar + ' ' + T.carWait) : T.noCar;
  }

  // ---------- maquetas 2D ----------
  const SHIRT = [[.30, 0], [.42, .06], [.58, .06], [.70, 0], [1, .18], [.86, .38], [.76, .32], [.76, 1], [.24, 1], [.24, .32], [.14, .38], [0, .18]];
  const REG = { chest: [.34, .2, .32, .16], backMain: [.28, .16, .44, .24], backLow: [.33, .66, .34, .14], backUpper: [.29, .1, .42, .13], sleeve: [.01, .15, .16, .12] };
  function put(g, img, x, y, w, h) {
    const pad = Math.min(w, h) * .12, k = Math.min((w - 2 * pad) / img.width, (h - 2 * pad) / img.height);
    g.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k);
  }
  function chip(g, c, x, y, w, h, withLogo) {
    g.save(); g.fillStyle = bg === 'light' ? c.ice : c.navy; g.fillRect(x, y, w, h);
    g.strokeStyle = c.emerald; g.lineWidth = Math.max(1.5, w / 90); g.setLineDash([5, 4]); g.strokeRect(x, y, w, h); g.restore();
    if (withLogo && logo) put(g, logo, x, y, w, h);
  }
  function shirt(g, c, x, y, w, h, back, regions) {
    g.save(); g.beginPath();
    SHIRT.forEach((p, i) => (i ? g.lineTo(x + p[0] * w, y + p[1] * h) : g.moveTo(x + p[0] * w, y + p[1] * h))); g.closePath();
    g.fillStyle = c.surface2; g.fill(); g.strokeStyle = c.line; g.lineWidth = 2; g.stroke(); g.restore();
    regions.forEach(r => { const q = REG[r]; chip(g, c, x + q[0] * w, y + q[1] * h, q[2] * w, q[3] * h, true); });
    g.fillStyle = c.dim; g.font = '500 ' + Math.round(h * .07) + 'px Inter, sans-serif'; g.textAlign = 'center';
    g.fillText(back ? T.back : T.front, x + w / 2, y + h + h * .1);
  }
  function drawUniform(cv) {
    const c = C(), g = cv.getContext('2d'), W = cv.width, H = cv.height, lv = level();
    g.clearRect(0, 0, W, H); g.fillStyle = c.surface; g.fillRect(0, 0, W, H);
    const front = lv.uniform.filter(r => r === 'chest' || r === 'sleeve'), back = lv.uniform.filter(r => r !== 'chest' && r !== 'sleeve');
    const sw = W * .30, sh = sw * 1.15, y = H * .06;
    shirt(g, c, W * .12, y, sw, sh, false, front); shirt(g, c, W * .58, y, sw, sh, true, back);
    g.fillStyle = c.ice; g.font = '600 ' + Math.round(H * .06) + 'px Oswald, sans-serif'; g.textAlign = 'left';
    g.fillText(lv.uniform.map(r => DATA.regions[r][lang]).join(' · '), W * .05, H * .95);
  }
  function drawPit(cv) {
    const c = C(), g = cv.getContext('2d'), W = cv.width, H = cv.height, lv = level();
    g.clearRect(0, 0, W, H); g.fillStyle = c.surface; g.fillRect(0, 0, W, H);
    const x0 = W * .06, y0 = H * .1, w = W * .88, h = H * .66;
    g.fillStyle = c.surface2; g.fillRect(x0, y0, w, h); g.strokeStyle = c.line; g.lineWidth = 2; g.strokeRect(x0, y0, w, h);
    if (lv.pit === 'perimeter') {
      const sw = h * .11; for (let i = 0; i < 5; i++) chip(g, c, x0 + w * (.04 + i * .19), y0 + h * .04, w * .16, sw, true);
      for (let i = 0; i < 5; i++) chip(g, c, x0 + w * (.04 + i * .19), y0 + h - h * .04 - sw, w * .16, sw, true);
    } else if (lv.pit === 'featured') chip(g, c, x0 + w * .2, y0 + h * .2, w * .6, h * .5, true);
    else chip(g, c, x0 + w * .15, y0 + h * .16, w * .7, h * .58, true);
    g.fillStyle = c.ice; g.font = '600 ' + Math.round(H * .07) + 'px Oswald, sans-serif'; g.textAlign = 'left';
    g.fillText(DATA.pit[lv.pit][lang], x0, y0 + h + H * .13);
  }
  function refresh() {
    drawUniform(cUni); drawPit(cPit); sendToCar();
    clearBtn.disabled = !logo; dlBtn.disabled = !logo;
    cUni.setAttribute('aria-label', T.uniform + ' · ' + level().name[lang]); cPit.setAttribute('aria-label', T.pit + ' · ' + level().name[lang]);
  }

  // ---------- propuesta de marca (PNG) ----------
  async function download() {
    if (!logo) return;
    const c = C(), W = 1600, H = 1000, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), lv = level();
    g.fillStyle = c.navy; g.fillRect(0, 0, W, H);
    g.fillStyle = c.emerald; g.fillRect(0, 0, 10, H);
    g.fillStyle = c.ice; g.textAlign = 'left'; g.font = '600 54px Oswald, sans-serif'; g.fillText(T.title.toUpperCase() + ' · STRIKER RACING', 56, 84);
    g.font = '500 28px Inter, sans-serif'; g.fillStyle = c.dim; g.fillText(T.tier + ': ' + lv.name[lang], 56, 128);
    // auto
    g.strokeStyle = c.line; g.lineWidth = 2; g.fillStyle = c.surface; g.fillRect(56, 168, 720, 560); g.strokeRect(56, 168, 720, 560);
    g.fillStyle = c.dim; g.font = '600 18px Inter, sans-serif'; g.fillText(T.car.toUpperCase(), 76, 198);
    let photo = null;
    try { if (lv.car && stage && stage.sr26) { const blob = await stage.sr26.photo(); if (blob) photo = await createImageBitmap(blob); } } catch (e) { /* sin foto */ }
    if (photo) { const k = Math.min(680 / photo.width, 500 / photo.height); g.drawImage(photo, 76 + (680 - photo.width * k) / 2, 210 + (510 - photo.height * k) / 2, photo.width * k, photo.height * k); }
    else { g.fillStyle = c.dim; g.font = '500 24px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(lv.car ? T.noPhoto : T.noCar.split(':')[0] + '.', 416, 450); g.textAlign = 'left'; }
    // maquetas
    const u = document.createElement('canvas'); u.width = 760; u.height = 400; drawUniform(u);
    const p = document.createElement('canvas'); p.width = 760; p.height = 400; drawPit(p);
    g.drawImage(u, 816, 168, 728, 383); g.drawImage(p, 816, 571, 728, 383);
    g.fillStyle = c.dim; g.font = '500 20px Inter, sans-serif';
    wrap(g, T.fine, 56, 780, 720, 28);
    g.font = '500 18px "JetBrains Mono", monospace'; g.fillText('strikerracing.com', 56, 960);
    cv.toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'propuesta-marca-striker-racing.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say(T.saved); track('configurator_download');
    }, 'image/png');
  }
  function wrap(g, text, x, y, maxW, lh) {
    let line = ''; for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = word; } else line = t; }
    g.fillText(line, x, y);
  }
  dlBtn.addEventListener('click', download);
  if (stage) stage.addEventListener('sr26-ready', sendToCar);
  // analítica opcional (apagada por defecto; js/analytics.js define window.srTrack solo si está activada)
  function track(name) { try { if (window.srTrack) window.srTrack(name); } catch (e) { /* nada */ } }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  refresh();
}
