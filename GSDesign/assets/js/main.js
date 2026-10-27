import { lineChart } from './chart.js?v=20261020j';
import { Viewer, THREE, geometryFrom, animate } from './viewer.js?v=20261020j';
import { LiveRenderer } from './live.js?v=20261020j';
import { initCustom } from './custom.js?v=20261020j';
import './metrics.js?v=20261020j';
import { diffURL, setScale } from './bgsub.js?v=20261020j';

// global "background-subtracted" view: every panel registers its update() so the toggle can refresh it
export const VIEW = { bgsub: false };
const refreshers = [];
const onView = (fn) => (refreshers.push(fn), fn);
function setBgsub(on) {
  VIEW.bgsub = on;
  document.querySelectorAll('.bgsub-toggle input').forEach((i) => (i.checked = on));
  document.querySelectorAll('.bgsub-scale').forEach((g) => g.classList.toggle('off', !on));
  refreshers.forEach((fn) => fn());
  document.dispatchEvent(new Event('bgsub-change'));
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.bgsub-scale button'); if (!b) return;
  setScale(b.dataset.m);
  document.querySelectorAll('.bgsub-scale button').forEach((x) => x.classList.toggle('on', x.dataset.m === b.dataset.m));
  if (VIEW.bgsub) { refreshers.forEach((fn) => fn()); document.dispatchEvent(new Event('bgsub-change')); }
});


const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const IMG = 'assets/img';
const SPEC = Array.from({ length: 11 }, (_, i) => i / 10);
const json = (() => { const c = {}; return (n) => (c[n] ??= fetch(`assets/data/${n}.json`).then((r) => r.json())); })();

/* ───────────── Paper data ─────────────
   ≈ : read off the paper's plots (Fig. 9B-ii, 10C, 12E-iii); exact: score_*.json / text / Table 1 */
const SCORES = {
  mini: {
    cyl: { rgb: [0.91, 0.92, 0.92, 0.88, 0.88, 0.81, 0.65, 0.43, 0.17, 0.11, 0.12], nd: [-45.5, -35.5, -39, -40.5, -39.5, -38.5, -37.5, -52, -66.5, -85.5, -104.5], band: [0.1, 0.4] },
    sph: { rgb: [0.9, 0.89, 0.9, 0.92, 0.87, 0.83, 0.66, 0.51, 0.24, 0.16, 0.17], nd: [-47.9, -43.7, -47.9, -41.6, -44.2, -40.5, -50, -58.4, -80.5, -96.8, -101], band: [0, 0.4] },
  },
  belt: { rgb: [0.88, 0.87, 0.88, 0.87, 0.86, 0.81, 0.79, 0.74, 0.69, 0.49, 0.44], nd: [-16.5, -16.5, -10.5, -14, -19.4, -13.5, -18.5, -21, -43.3, -45.8, -142], band: [0, 0.3] },
  g360set1: [0.062311, 0.067793, 0.066667, 0.067023, 0.066793, 0.067257, 0.070885, 0.067959, 0.067803, 0.065274, 0.059327],
  g360set2: { nd: [-10.4, -14.4, -11.5, -12, -8.81, -14.1, -12.7, -11.5, -12.9, -10.2, -11] },
  table1: [
    ['GRRGGRRG', -37.745, 0.909, 'original'],
    ['GBBRRGGB', -17.172, 0.893],
    ['GRRBBGGR', -26.769, 0.919],
    ['GBRBRGBR', -19.81, 0.901],
    ['RGBRGBRG', -14.696, 0.891, 'best NormDiff'],
  ],
};

/* ───────────── helpers ───────────── */
function seg(host, onChange) {
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !host.contains(b) || b.disabled) return;
    $$('button', host).forEach((x) => x.classList.toggle('on', x === b));
    onChange(b.dataset);
  });
}
function setOn(host, attr, val) { $$('button', host).forEach((b) => b.classList.toggle('on', b.dataset[attr] === String(val))); }
function rangeFill(inp) {
  const f = () => inp.style.setProperty('--p', `${((inp.value - inp.min) / (inp.max - inp.min)) * 100}%`);
  inp.addEventListener('input', f); inp.addEventListener('fill', f); f();
}
$$('input[type=range]').forEach(rangeFill);
document.addEventListener('change', (e) => { if (e.target.closest('.bgsub-toggle')) setBgsub(e.target.checked); });

/** cross-fading image frame with preload + badge */
class XFade {
  constructor(host) {
    this.host = host;
    this.a = host.appendChild(new Image()); this.b = host.appendChild(new Image());
    this.a.alt = this.b.alt = '';
    this.b.style.opacity = 0;
    this.badge = host.appendChild(Object.assign(document.createElement('span'), { className: 'badge' }));
    host.appendChild(Object.assign(document.createElement('span'), { className: 'spinner' }));
    this.token = 0;
  }
  set(src, badge = '', alt = '', bg = null) {
    if (VIEW.bgsub && bg) {
      const tok = ++this.token;
      this.host.classList.add('loading');
      diffURL(src, bg).then((u) => { if (tok === this.token) { this.token--; this.set(u, `${badge}${badge ? ' · ' : ''}bg-subtracted`, alt); } })
        .catch(() => { if (tok === this.token) { this.token--; this.set(src, badge, alt); } });
      return;
    }
    const tok = ++this.token;
    const timer = setTimeout(() => this.host.classList.add('loading'), 120);
    const img = new Image();
    img.onload = img.onerror = () => {
      clearTimeout(timer);
      if (tok !== this.token) return;
      this.host.classList.remove('loading');
      const [front, back] = this.b.style.opacity === '0' ? [this.a, this.b] : [this.b, this.a];
      back.src = src; back.alt = alt;
      back.style.opacity = 1; front.style.opacity = 0;
      this.badge.innerHTML = badge;
      this.badge.hidden = !badge;
    };
    img.src = src;
  }
}
const preload = (srcs) => srcs.forEach((s) => (new Image().src = s));

/* ───────────── scroll reveal ───────────── */
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  if (e.target.classList.contains('reveal-stagger'))
    [...e.target.children].forEach((c, i) => { c.style.transitionDelay = `${i * 80}ms`; c.style.setProperty('--d', `${0.3 + i * 0.08}s`); });
  io.unobserve(e.target);
}), { threshold: 0.12 });
$$('.reveal, .reveal-stagger').forEach((el) => io.observe(el));

/* ───────────── hero: periodic press ───────────── */
{
  const f = $('#heroSensor .press-frame');
  let on = false;
  setInterval(() => { on = !on; f.classList.toggle('pressed', on); }, 2600);
}

/* ───────────── tabs & steps ───────────── */
const panelInit = {};
function showTab(name) {
  $$('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
  panelInit[name]?.();
  panelInit[name] = null;
}
$('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) showTab(b.dataset.tab); });
$$('[data-goto]').forEach((a) => a.addEventListener('click', () => showTab(a.dataset.goto)));
panelInit.custom = initCustom;
// chart titles carry the metric hover card
const METRIC = { rgb2norm: '<span data-metric="rgb2norm">RGB2Norm</span>', normdiff: '<span data-metric="normdiff">NormDiff</span>', pw: '<span data-metric="pw">2D-to-3D projection warping</span>' };

function steps(host, panel, onChange) {
  seg(host, ({ step }) => {
    $$('[data-step-show]', panel).forEach((el) => (el.hidden = el.dataset.stepShow !== step));
    $$('[data-step-hide]', panel).forEach((el) => (el.hidden = el.dataset.stepHide === step));
    onChange(step);
  });
}

/* ───────────── 3D builders ───────────── */
const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, ...o });

function g360Viewer(host, getCut) {
  const v = new Viewer(host);
  const groups = {}, parts = { 1: [], 2: [] };
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  let current = '1', center = null;
  const style = {
    SensingSurface: mat(0xc9ced8, { transparent: true, opacity: 0.5, roughness: 0.6 }),
    InterfaceSurface: mat(0x4fd1d9, { roughness: 0.2 }),
    EpoxySurface: mat(0x4fd1d9, { roughness: 0.2 }),
  };
  Object.values(style).forEach((m) => (m.clippingPlanes = [clip]));
  const ready = json('geo_g360').then((all) => {
    for (const setting of ['1', '2']) {
      groups[setting] = new THREE.Group();
      for (const [n, d] of Object.entries(all[setting])) {
        const g = geometryFrom(d.v0, d.f);
        const m = new THREE.Mesh(g, style[n]);
        m.renderOrder = n === 'SensingSurface' ? 2 : 1;
        groups[setting].add(m);
        parts[setting].push({ g, v0: Float32Array.from(d.v0), v1: Float32Array.from(d.v1) });
      }
      v.root.add(groups[setting]);
    }
    v.root.updateMatrixWorld(true); // setFromObject does not refresh parent transforms
    center = new THREE.Box3().setFromObject(groups['1']).getCenter(new THREE.Vector3());
    v.frame([groups['1']], new THREE.Vector3(1.4, 0.35, 0.2), 1.15);
    api.use(current); api.cut(getCut());
  });
  const A = { 1: 0.6, 2: 0.4 };
  const api = {
    ready,
    use(setting) {
      current = setting;
      for (const k in groups) groups[k].visible = k === setting;
      api.set(A[setting]);
    },
    set(a) {
      A[current] = a;
      for (const p of parts[current]) {
        const pos = p.g.attributes.position.array;
        for (let i = 0; i < pos.length; i++) pos[i] = p.v0[i] + a * (p.v1[i] - p.v0[i]);
        p.g.attributes.position.needsUpdate = true;
        p.g.computeVertexNormals();
        p.g.computeBoundingSphere();
      }
    },
    cut(on) {
      // half-section through the tip axis, like the 2D profiles in Fig. 12
      // root is rotated -90° about x, so Blender's y axis is three's -z
      if (center) clip.constant = on ? -center.z : 1e6;
    },
  };
  return api;
}

/* ───────────── Case I: GelSight Mini ───────────── */
panelInit.mini = () => {
  const xf = new XFade($('#miniImg'));
  const sw = new XFade($('#miniSwatch'));
  const st = { shape: 'cyl', spec: 1, view: 'render', press: true };
  const specIn = $('#miniSpec');
  let charts = [];
  const drawCharts = () => {
    charts.forEach((c) => c.remove()); charts = [];
    const host = $('#miniCharts');
    host.querySelector('.chart-note')?.remove();
    const s = SCORES.mini[st.shape];
    if (!s) {
      host.insertAdjacentHTML('beforeend', '<p class="chart-note">The flat pad was tuned by hand in the original product. The paper optimizes the coating only for the curved variants.</p>');
      return;
    }
    const pick = (i) => { specIn.value = i; specIn.dispatchEvent(new Event('input')); };
    charts.push(lineChart(host, { title: METRIC.rgb2norm, note: 'Fig. 9', xs: SPEC, ys: s.rgb, yTicks: [0, 0.5, 1], band: s.band, bandLabel: 'optimal', xLabel: (x) => x.toFixed(1), onPick: pick }));
    charts.push(lineChart(host, { title: METRIC.normdiff, note: 'Fig. 9', xs: SPEC, ys: s.nd, yTicks: [-110, -70, -30], band: s.band, xLabel: (x) => x.toFixed(1), fmt: (v) => v.toFixed(1), onPick: pick }));
  };
  const update = () => {
    const view = st.shape === 'flat' ? 'render' : st.view;
    const state = st.press ? 'indented' : 'surface';
    xf.set(`${IMG}/mini/${st.shape}/${st.spec}_${state}_${view}.webp`,
      `${{ flat: 'flat', cyl: 'cylindrical', sph: 'spherical' }[st.shape]} · spec ${(st.spec / 10).toFixed(1)}`,
      '', view === 'render' ? `${IMG}/mini/${st.shape}/${st.spec}_surface_render.webp` : null);
    sw.set(`${IMG}/mini/swatch/${st.spec}.webp`);
    charts.forEach((c) => c.set(st.spec));
    $('#miniSpecOut').textContent = (st.spec / 10).toFixed(1);
    $('[data-v=normal]', $('#miniView')).disabled = st.shape === 'flat';
  };
  seg($('#miniShape'), ({ s }) => { st.shape = s; if (s === 'flat') { st.view = 'render'; setOn($('#miniView'), 'v', 'render'); } drawCharts(); update(); });
  seg($('#miniView'), ({ v }) => { st.view = v; update(); });
  $('#miniPress').addEventListener('change', (e) => { st.press = e.target.checked; update(); });
  specIn.addEventListener('input', () => { st.spec = +specIn.value; update(); });
  onView(update);
  drawCharts(); update();
  preload(SPEC.flatMap((_, i) => [`${IMG}/mini/cyl/${i}_indented_render.webp`, `${IMG}/mini/swatch/${i}.webp`]));
};

/* ───────────── Case II: GelBelt ───────────── */
// custom-light grid (tools/render_jobs/belt_basis.py) and Design 3 placements in that parametrisation
const BELT_H = [1, 2.5, 4, 5.5, 7, 8.5, 10], BELT_T = [0, 22.5, 45, 67.5];
const BELT_D3 = { R: { h: 2.5, t: 0, p: 1 }, G: { h: 10, t: 67.5, p: 1 }, B: { h: 2.5, t: 0, p: 1 } };
const BELT_BARS = { R: { fixed: [80.8, 66], horiz: [0, 0, -1], long: [1, 0, 0] }, B: { fixed: [80.8, 0.8], horiz: [0, 0, 1], long: [1, 0, 0] },
  G: { fixed: [105.5, 33.5], horiz: [-1, 0, 0], long: [0, 0, 1] } };
function beltPose(key, h, tilt) {   // mirrors belt_basis.pose(); Blender coordinates
  const B = BELT_BARS[key], t = (tilt * Math.PI) / 180;
  const d = new THREE.Vector3(...B.horiz).multiplyScalar(Math.cos(t)).add(new THREE.Vector3(0, -Math.sin(t), 0)).normalize();
  const z = d.clone().negate(), x = new THREE.Vector3(...B.long), y = z.clone().cross(x);
  return { p: new THREE.Vector3(B.fixed[0], h, B.fixed[1]), q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
}
const nearestIdx = (arr, v) => arr.reduce((bi, x, i) => (Math.abs(x - v) < Math.abs(arr[bi] - v) ? i : bi), 0);

panelInit.belt = () => {
  const xf = new XFade($('#beltImg'));
  const st = { step: '1', design: 'design3', obj: 'sph5', spec: 2, cobj: 'sph5', bar: 'R', lights: JSON.parse(JSON.stringify(BELT_D3)) };
  const grid = $('#beltGrid');
  // cell (row r, col c) — sph1 sits top-right, numbering runs right-to-left, top-to-bottom
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const b = document.createElement('button');
    b.dataset.o = `sph${r * 3 + (3 - c)}`;
    b.setAttribute('aria-label', `press sphere ${b.dataset.o}`);
    grid.appendChild(b);
  }
  const markObj = () => { $$('button', grid).forEach((b) => b.classList.toggle('on', b.dataset.o === st.obj)); setOn($('#beltObj'), 'o', st.obj); };
  grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.obj = b.dataset.o; markObj(); update(); } });
  seg($('#beltObj'), ({ o }) => { st.obj = o; markObj(); update(); });
  seg($('#beltObjC'), ({ o }) => { st.cobj = o; update(); });
  seg($('#beltDesign'), ({ d }) => { st.design = d; belt3d.show(d); update(); });
  const specIn = $('#beltSpec');
  specIn.addEventListener('input', () => { st.spec = +specIn.value; update(); });

  // ── custom lights
  const live = new LiveRenderer(8766, null);
  const liveBg = new LiveRenderer(8766, null);   // no-contact background for background subtraction
  const hIn = $('#beltH'), tIn = $('#beltT'), pIn = $('#beltP');
  const syncBar = () => {
    const l = st.lights[st.bar];
    hIn.value = l.h; tIn.value = l.t; pIn.value = l.p;
    $('#beltHOut').textContent = `${(+l.h).toFixed(1)} mm`; $('#beltTOut').textContent = `${(+l.t).toFixed(1)}°`; $('#beltPOut').textContent = `×${(+l.p).toFixed(1)}`;
    [hIn, tIn, pIn].forEach((i) => i.dispatchEvent(new Event('fill')));
    setOn($('#beltBar'), 'b', st.bar);
    pIn.disabled = live.online === false;
  };
  const onBar = () => {
    const l = st.lights[st.bar];
    l.h = +hIn.value; l.t = +tIn.value; l.p = +pIn.value;
    if (live.online === false) {          // offline grid: one bar at a time, others back at Design 3
      l.h = BELT_H[nearestIdx(BELT_H, l.h)]; l.t = BELT_T[nearestIdx(BELT_T, l.t)]; l.p = 1;
      for (const k of Object.keys(st.lights)) if (k !== st.bar) st.lights[k] = { ...BELT_D3[k] };
    }
    syncBar(); belt3d.custom(st.lights); update();
  };
  [hIn, tIn, pIn].forEach((i) => i.addEventListener('input', onBar));
  seg($('#beltBar'), ({ b }) => { st.bar = b; syncBar(); });
  $('#beltReset').addEventListener('click', () => { st.lights = JSON.parse(JSON.stringify(BELT_D3)); syncBar(); belt3d.custom(st.lights); update(); });
  live.ready.then((ok) => { $('#beltOffline').hidden = ok; syncBar(); });

  let charts = [];
  steps($('#beltSteps'), $('[data-panel=belt]'), (s) => {
    st.step = s;
    if (s === '2' && !st.obj.startsWith('sph')) { st.obj = 'sph5'; markObj(); }
    if (s === '2' && !charts.length) {
      const S = SCORES.belt, pick = (i) => { specIn.value = i; specIn.dispatchEvent(new Event('input')); };
      charts = [
        lineChart($('#beltCharts'), { title: METRIC.rgb2norm, note: 'Fig. 10C', xs: SPEC, ys: S.rgb, yTicks: [0, 0.5, 1], band: S.band, bandLabel: 'optimal', xLabel: (x) => x.toFixed(1), onPick: pick }),
        lineChart($('#beltCharts'), { title: METRIC.normdiff, note: 'Fig. 10C', xs: SPEC, ys: S.nd, yTicks: [-170, -90, -10], band: S.band, xLabel: (x) => x.toFixed(1), fmt: (v) => v.toFixed(1), onPick: pick }),
      ];
    }
    if (s === 'custom') { syncBar(); belt3d.custom(st.lights); } else if (s === '1') belt3d.show(st.design);
    update();
  });

  const NAMES = { design1: 'Design 1', design2: 'Design 2', design3: 'Design 3 (best)' };
  function offlineSrc() {
    const moved = Object.keys(st.lights).find((k) => st.lights[k].h !== BELT_D3[k].h || st.lights[k].t !== BELT_D3[k].t) || 'G';
    const l = st.lights[moved];
    return `${IMG}/belt/custom/${moved}_h${nearestIdx(BELT_H, l.h)}_t${nearestIdx(BELT_T, l.t)}_${st.cobj}.webp`;
  }
  let timer = 0;
  function update() {
    if (st.step === '1') {
      xf.set(`${IMG}/belt/design/${st.design}_${st.obj}.webp`, `${NAMES[st.design]}`, '', `${IMG}/belt/design/${st.design}_none.webp`);
    } else if (st.step === '2') {
      xf.set(`${IMG}/belt/spec/${st.spec}_${st.obj}.webp`, `Design 3 · coating spec ${(st.spec / 10).toFixed(1)}`, '', `${IMG}/belt/spec/${st.spec}_bg.webp`);
      $('#beltSpecOut').textContent = (st.spec / 10).toFixed(1);
      charts.forEach((c) => c.set(st.spec));
    } else {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await live.ready;
        if (!live.online) { const s = offlineSrc(); xf.set(s, 'custom lights', '', s.replace(/_[a-z0-9]+\.webp$/, '_none.webp')); return; }
        const lights = Object.fromEntries(Object.entries(st.lights).map(([k, l]) => [k, { height: l.h, tilt: l.t, power: l.p }]));
        live.render({ contact: st.cobj, lights }, (src, ms, cached) => {
          if (!VIEW.bgsub) return xf.set(src, 'custom lights');
          liveBg.render({ contact: 'none', lights }, (bg) => xf.set(src, 'custom lights', '', bg));
        });
      }, 150);
    }
  }

  // light placement viewer: the three LED bars fly between configurations
  const belt3d = (() => {
    const v = new Viewer($('#beltViewer'));
    const COLL = { design1: 'conf_side', design2: 'conf_top', design3: 'conf_optimal.001' };
    const bars = {}; const poses = {};
    json('geo_belt').then((d) => {
      const add = (n, m) => { const o = new THREE.Mesh(geometryFrom(d.meshes[n].v, d.meshes[n].f), m); v.root.add(o); return o; };
      add('belt', mat(0x9aa3b5, { transparent: true, opacity: 0.08, depthWrite: false }));
      const acrylic = add('acrylic', mat(0x7fd8e8, { transparent: true, opacity: 0.45, roughness: 0.05, depthWrite: false }));
      const gel = add('SensingSurface', mat(0xc0c4cc, { metalness: 0.4, roughness: 0.6, transparent: true, opacity: 0.55 }));
      add('side_sil', mat(0xb7c0d0, { transparent: true, opacity: 0.15, depthWrite: false }));
      for (const L of d.lights) {
        const key = Object.keys(COLL).find((k) => L.coll.includes(COLL[k]));
        if (!key) continue;
        const color = L.name[0].toUpperCase();
        const M = new THREE.Matrix4().set(...L.m), p = new THREE.Vector3(), q = new THREE.Quaternion();
        M.decompose(p, q, new THREE.Vector3());
        (poses[key] ??= {})[color] = { p, q };
        if (!bars[color]) {
          const c = { R: 0xff4d4d, G: 0x33e07a, B: 0x4d7cff }[color];
          bars[color] = new THREE.Mesh(new THREE.BoxGeometry(L.size[0], L.size[1], 2), new THREE.MeshBasicMaterial({ color: c }));
          bars[color].add(new THREE.PointLight(c, 400, 0, 1.4));
          v.root.add(bars[color]);
        }
      }
      for (const [c, b] of Object.entries(bars)) { b.position.copy(poses[st.design][c].p); b.quaternion.copy(poses[st.design][c].q); }
      // look from the sensor camera, with the tactile image's up direction (lights land where they glow in the image)
      v.alignToBlenderCamera(d.camera.m, [acrylic, gel, ...Object.values(bars)], 0.95);
    });
    const tween = (target) => {
      const from = Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, { p: b.position.clone(), q: b.quaternion.clone() }]));
      animate(500, (k) => {
        for (const [c, b] of Object.entries(bars)) {
          b.position.lerpVectors(from[c].p, target[c].p, k);
          b.quaternion.slerpQuaternions(from[c].q, target[c].q, k);
        }
      });
    };
    return {
      show(design) { if (poses[design]) tween(poses[design]); },
      custom(lights) {
        if (!Object.keys(bars).length) return;
        const target = Object.fromEntries(Object.entries(lights).map(([k, l]) => [k, beltPose(k, l.h, l.t)]));
        for (const [k, l] of Object.entries(lights)) bars[k].visible = l.p > 0;
        tween(target);
      },
    };
  })();
  onView(update);
  markObj(); update();
};

/* ───────────── Case III: GelSight360 ───────────── */
panelInit.g360 = () => {
  const xf = new XFade($('#g360Img'));
  const PAIRS = ['RG', 'GR', 'RB', 'BR', 'BG', 'GB'];
  const COL = { R: 'var(--r)', G: 'var(--g)', B: 'var(--b)' };
  const st = { step: 'light', code: 'RGBRGBRG', base: '', sat: true, A1: 0.6, A2: 0.4 };
  // base (lower) LEDs: '' = the colour missing from the arm's pair (paper rule), else one colour for all arms
  const baseOf = (pair) => st.base || 'RGB'.replace(pair[0], '').replace(pair[1], '');
  const satIn = $('#g360Sat');

  // wheel: arm i (pair code[2i..2i+1]) drawn where it appears in the camera image — arm 0 bottom-right, anticlockwise on screen
  const svg = $('#g360Wheel');
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '<circle class="ring" r="100"/>';
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const ang = (45 - 90 * i) * Math.PI / 180, dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy * 6, ny = dx * 6;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'arm');
    const mk = (ox, oy, cls) => { const l = document.createElementNS(NS, 'line'); Object.entries({ x1: 14 * dx + ox, y1: 14 * dy + oy, x2: 92 * dx + ox, y2: 92 * dy + oy }).forEach(([k, v]) => l.setAttribute(k, v)); if (cls) l.setAttribute('class', cls); g.appendChild(l); return l; };
    mk(0, 0, 'hit');
    const a = mk(nx, ny), b = mk(-nx, -ny);
    // base LEDs: an arc of the outer ring centred on the arm (they sit on the base PCB around the circumference)
    const base = document.createElementNS(NS, 'path'), a0 = ang - 0.6, a1 = ang + 0.6;
    base.setAttribute('d', `M${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 0 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)}`);
    base.setAttribute('class', 'base'); g.appendChild(base);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'lg'); t.setAttribute('x', 64 * dx + 14 * dy - 8); t.setAttribute('y', 64 * dy - 14 * dx + 3); t.textContent = `${i + 1}`; g.appendChild(t);
    g.addEventListener('click', () => {
      const cur = st.code.slice(2 * i, 2 * i + 2), nxt = PAIRS[(PAIRS.indexOf(cur) + 1) % 6];
      setCode(st.code.slice(0, 2 * i) + nxt + st.code.slice(2 * i + 2));
    });
    svg.appendChild(g); arms.push([a, b, base]);
  }
  const presets = $('#g360Presets');
  SCORES.table1.forEach(([c, , , lab]) => presets.insertAdjacentHTML('beforeend', `<button data-c="${c}" title="${lab || ''}">${c}</button>`));
  presets.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setCode(b.dataset.c); });
  seg($('#g360Base'), ({ b }) => { st.base = b; setCode(st.code); });
  $('#g360Random').addEventListener('click', () => setCode(Array.from({ length: 4 }, () => PAIRS[Math.floor(Math.random() * 6)]).join('')));

  const scores = $('#g360Scores');
  const drawScores = () => {
    const best = Math.max(...SCORES.table1.map((r) => r[1]));
    scores.innerHTML = `<h5>Table 1 <span class="hint">higher is better</span></h5><table><thead><tr><th>config</th><th>NormDiff</th><th>RGB2Norm</th></tr></thead><tbody>${
      SCORES.table1.map(([c, nd, rg, lab]) => `<tr class="${c === st.code && !st.base ? 'on' : ''}"><td>${c}${lab ? ` <small>· ${lab}</small>` : ''}</td><td class="${nd === best ? 'best' : ''}">${nd.toFixed(2)}</td><td>${rg.toFixed(3)}</td></tr>`).join('')
    }</tbody></table>${st.base ? '<p class="fine">Scores are for the paper\'s base rule; with all base LEDs one colour this combination was not scored. Only its render is shown.</p>'
      : SCORES.table1.some((r) => r[0] === st.code) ? '' : '<p class="fine">This combination was not scored in the paper. Only its render is shown.</p>'}`;
  };
  function setCode(code) {
    st.code = code;
    arms.forEach(([a, b, base], i) => { a.style.stroke = COL[code[2 * i]]; b.style.stroke = COL[code[2 * i + 1]]; base.style.stroke = COL[baseOf(code.slice(2 * i, 2 * i + 2))]; });
    $('#g360Code').innerHTML = [...code].map((ch, i) => `<b class="${ch}">${ch}</b>${i % 2 ? ' ' : ''}`).join('');
    setOn(presets, 'c', code);
    drawScores(); update();
  }

  // shape steps
  const nearest = (A) => Math.round(A * 10);
  const c1 = lineChart($('#g360Chart1'), { title: METRIC.pw, note: 'Fig. 12D', xs: SPEC.map((_, i) => i), ys: SCORES.g360set1, yTicks: [0.058, 0.064, 0.07], band: [6, 6], bandLabel: 'best', xLabel: (x) => `D${x}`, fmt: (v) => v.toFixed(4), onPick: (i) => setA('A1', i / 10) });
  const c2 = lineChart($('#g360Chart2'), { title: METRIC.normdiff, note: 'Fig. 12E', xs: SPEC.map((_, i) => i), ys: SCORES.g360set2.nd, yTicks: [-20, -15, -10, -5], band: [4, 4], bandLabel: 'best', xLabel: (x) => `D${x}`, fmt: (v) => v.toFixed(2), onPick: (i) => setA('A2', i / 10) });
  // created on first use: a WebGL viewer initialised inside a display:none host renders nothing
  let view3d = null;
  function setA(k, A) {
    st[k] = A;
    const inp = $(k === 'A1' ? '#g360A1' : '#g360A2');
    if (+inp.value !== A) { inp.value = A; inp.dispatchEvent(new Event('input')); return; }
    update();
  }
  $('#g360A1').addEventListener('input', (e) => setA('A1', +e.target.value));
  $('#g360A2').addEventListener('input', (e) => setA('A2', +e.target.value));
  $('#g360Cut').addEventListener('change', (e) => view3d?.cut(e.target.checked));
  satIn.addEventListener('change', () => { st.sat = satIn.checked; update(); });
  steps($('#g360Steps'), $('[data-panel=g360]'), (s) => {
    st.step = s;
    if (s !== 'light') {
      view3d ??= g360Viewer($('#g360Viewer'), () => $('#g360Cut').checked);
      view3d.ready.then(() => view3d.use(s === 'set1' ? '1' : '2'));
    }
    update();
  });

  function update() {
    const sat = st.sat ? '_sat' : '';
    if (st.step === 'light') {
      const f = st.code + (st.base ? `_b${st.base}` : '');
      xf.set(`${IMG}/g360/light${sat}/${f}.webp`, `${st.code}${st.base ? ` · base ${st.base}` : ''}`, '', `${IMG}/g360/light${sat}_bg/${f}.webp`);
      $('#g360Caption').textContent = 'All 8 indenters pressed · tip shape design 6';
    } else {
      const k = st.step === 'set1' ? 'A1' : 'A2', d = nearest(st[k]);
      $(`#g360${k}Out`).textContent = `Design ${d}`;
      xf.set(`${IMG}/g360/${st.step}${sat}/${d}.webp`, `${st.step === 'set1' ? 'tip shape' : 'resin shell'} · design ${d}`, '', `${IMG}/g360/${st.step}${sat}_bg/${d}.webp`);
      (st.step === 'set1' ? c1 : c2).set(d);
      view3d?.set(st[k]);
      $('#g360Caption').textContent = st.step === 'set1' ? 'Cage A blends Cmin (flat tip) → Cmax (conical)' : 'Cage A blends a uniform shell → an almost flat inner resin';
    }
  }
  onView(update);
  setCode(st.code);
  c1.set(6); c2.set(4);
  preload(SCORES.table1.map(([c]) => `${IMG}/g360/light_sat/${c}.webp`));
};

/* ───────────── Case IV: Svelte ───────────── */
panelInit.svelte = () => {
  // slider stop -> image prefix; 25/50/75 are blends of the two end shapes (tools/render_jobs/svelte_morph.py)
  const STOPS = ['original', 'morph25', 'morph50', 'morph75', 'optimized'];
  const LABEL = ['Original M1', 'M1 · 25 % blend', 'M1 · 50 % blend', 'M1 · 75 % blend', 'Optimized M1'];
  const st = { obj: 'lego', pos: 5, sat: true, t: 4 };
  const wipe = $('#svelteWipe'), A = $('#svelteA'), B = $('#svelteB'), loupe = $('#svelteLoupe');
  const name = () => (st.obj === 'sphere' ? `sphere${st.pos}` : st.obj);
  const update = () => {
    const d = st.sat ? 'svelte_sat' : 'svelte';
    const a = `${IMG}/${d}/original_${name()}.webp`, b = `${IMG}/${d}/${STOPS[st.t]}_${name()}.webp`;
    if (VIEW.bgsub) {
      Promise.all([diffURL(a, `${IMG}/${d}/original_none.webp`), diffURL(b, `${IMG}/${d}/${STOPS[st.t]}_none.webp`)])
        .then(([da, db]) => { A.src = da; B.src = db; });
    } else {
      const pa = new Image(), pb = new Image(); let n = 0;
      const done = () => { if (++n < 2) return; A.src = a; B.src = b; };
      pa.onload = pb.onload = pa.onerror = pb.onerror = done; pa.src = a; pb.src = b;
    }
    $('#svelteRight').textContent = LABEL[st.t];
  };
  seg($('#svelteObj'), ({ o }) => { st.obj = o; $('#sveltePosWrap').hidden = o !== 'sphere'; update(); });
  $('#sveltePos').addEventListener('input', (e) => { st.pos = +e.target.value; update(); });
  $('#svelteSat').addEventListener('change', (e) => { st.sat = e.target.checked; update(); });
  $('#svelteT').addEventListener('input', (e) => { st.t = +e.target.value; update(); morphTo(st.t / 4); });
  onView(update);

  // drag divider + magnifier
  let x = 0.5, drag = false;
  const setX = (cx) => { const r = wipe.getBoundingClientRect(); x = Math.min(1, Math.max(0, (cx - r.left) / r.width)); wipe.style.setProperty('--x', `${x * 100}%`); };
  wipe.addEventListener('pointerdown', (e) => { drag = true; wipe.setPointerCapture(e.pointerId); setX(e.clientX); });
  wipe.addEventListener('pointerup', () => (drag = false));
  wipe.addEventListener('pointermove', (e) => {
    if (drag) setX(e.clientX);
    const r = wipe.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, Z = 3;
    const src = px / r.width < x ? A.src : B.src;
    Object.assign(loupe.style, { left: `${px}px`, top: `${py}px`, backgroundImage: `url(${src})`, backgroundSize: `${r.width * Z}px ${r.height * Z}px`, backgroundPosition: `${75 - px * Z}px ${75 - py * Z}px` });
  });
  // wipe intro animation
  animate(1400, (k) => { const v = 0.5 + 0.32 * Math.sin(k * Math.PI * 2); wipe.style.setProperty('--x', `${v * 100}%`); }, () => wipe.style.setProperty('--x', '50%'));

  // AOAP count-up
  $$('.aoap .count').forEach((b) => animate(1200, (k) => (b.textContent = (k * +b.dataset.to).toFixed(3))));

  // mirror geometry: the morphing M1 (green) against the original mirror (red wireframe)
  const v = new Viewer($('#svelteViewer'));
  let morph = null, tNow = 1;
  Promise.all([json('geo_svelte'), json('geo_svelte_morph')]).then(([d, mm]) => {
    const add = (n, m) => { const o = new THREE.Mesh(geometryFrom(d.meshes[n].v, d.meshes[n].f), m); v.root.add(o); return o; };
    add('SensingSurface', mat(0xc9ced8, { transparent: true, opacity: 0.18, depthWrite: false }));
    add('SmallMirror', mat(0xdfe6ee, { metalness: 1, roughness: 0.08 }));
    add('cameralens', mat(0x333a46, { roughness: 0.3 }));
    add('MirrorOriginal', new THREE.MeshBasicMaterial({ color: 0xd9534f, wireframe: true, transparent: true, opacity: 0.35 }));
    const g = geometryFrom(mm.v1, mm.f);
    morph = { g, v0: Float32Array.from(mm.v0), v1: Float32Array.from(mm.v1) };
    v.root.add(new THREE.Mesh(g, mat(0x4cbb7f, { metalness: 0.6, roughness: 0.25 })));
    // match the tactile image: finger tip to the right (Blender -x), red LED row on top (Blender -z)
    v.alignAxes(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, -1), [v.root], 0.8);
  });
  const setMorph = (t) => {
    if (!morph) return;
    const p = morph.g.attributes.position.array;
    for (let i = 0; i < p.length; i++) p[i] = morph.v0[i] + t * (morph.v1[i] - morph.v0[i]);
    morph.g.attributes.position.needsUpdate = true;
    morph.g.computeVertexNormals();
    tNow = t;
  };
  const morphTo = (t) => { const t0 = tNow; animate(450, (k) => setMorph(t0 + (t - t0) * k)); };
  update();
};

/* ───────────── Beyond geometry ───────────── */
{
  const xf = new XFade($('#tiltImg'));
  const st = { x: 0, y: 0, s: 1 };
  const pad = $('#tiltPad'), knob = $('.knob', pad);
  const update = () => {
    knob.style.left = `${50 + st.x * 5}%`; knob.style.top = `${50 - st.y * 5}%`;
    $('#tiltOut').innerHTML = `θx ${st.x}°<br>θy ${st.y}°`;
    xf.set(`${IMG}/ml/tilt/${st.s}/x${st.x}y${st.y}.webp`, `spec ${(st.s / 10).toFixed(1)}`, '', `${IMG}/ml/tilt/${st.s}/bg.webp`);
  };
  const fromEvt = (e) => {
    const r = pad.getBoundingClientRect();
    st.x = Math.max(-10, Math.min(10, Math.round(((e.clientX - r.left) / r.width - 0.5) * 20)));
    st.y = Math.max(-10, Math.min(10, Math.round((0.5 - (e.clientY - r.top) / r.height) * 20)));
    update();
  };
  let drag = false;
  pad.addEventListener('pointerdown', (e) => { drag = true; pad.setPointerCapture(e.pointerId); fromEvt(e); });
  pad.addEventListener('pointermove', (e) => drag && fromEvt(e));
  pad.addEventListener('pointerup', () => (drag = false));
  seg($('#tiltSpec'), ({ s }) => { st.s = +s; update(); });
  update();

  const rx = new XFade($('#radImg'));
  const rs = { shape: 'cyl', s: 1, r: 12 };
  const rUpdate = () => { $('#radOut').textContent = rs.r; rx.set(`${IMG}/ml/radius/${rs.shape}/${rs.s}/${rs.r}.webp`, `${rs.shape === 'cyl' ? 'cylindrical' : 'spherical'} pad · spec ${(rs.s / 10).toFixed(1)}`, '', `${IMG}/ml/radius/${rs.shape}/${rs.s}/bg.webp`); };
  onView(update); onView(rUpdate);
  $('#radS').addEventListener('input', (e) => { rs.r = +e.target.value; rUpdate(); });
  seg($('#radShape'), ({ s }) => { rs.shape = s; rUpdate(); });
  seg($('#radSpec'), ({ s }) => { rs.s = +s; rUpdate(); });
  rUpdate();
}

/* ───────────── misc ───────────── */
$('#copyBib').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText($('#bib').textContent); e.target.textContent = 'Copied ✓'; }
  catch { e.target.textContent = 'Select & copy'; }
  setTimeout(() => (e.target.textContent = 'Copy BibTeX'), 1600);
});

showTab('mini');
