// "Build your own sensor": pick a stop for every parameter; the page shows the matching pre-rendered Cycles image
// (every combination of tools/render_server/custom_grid.py is rendered) and a three.js preview of the same scene.
import { Viewer, THREE, geometryFrom } from './viewer.js?v=20261020j';
import { W, D, IND_R, crown, topCrownZ, indenterCentres, interfaceHeight, lightPose, gridParams, gridName } from './sensor_geom.js?v=20261020j';
import { diffURL } from './bgsub.js?v=20261020j';

const bottomZ = (p, x, y) => -crown(p.acrylic.shape, p.acrylic.height, x, y);
const ifaceZ = (p, ih, x, y) => p.acrylic.thickness + crown(p.interface.shape, ih, x, y);
function gelZ(p, x, y, ind) {
  let z = topCrownZ(p, x, y);
  for (const [cx, cy, cz] of ind) { const r2 = (x - cx) ** 2 + (y - cy) ** 2; if (r2 < IND_R * IND_R) z = Math.min(z, cz - Math.sqrt(IND_R * IND_R - r2)); }
  return z;
}
function grid(zf, nx = 110, ny = 80) {
  const v = [], f = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = -W / 2 + (W * i) / nx, y = -D / 2 + (D * j) / ny; v.push(x, y, zf(x, y)); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; f.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  return geometryFrom(v, f);
}
function walls(lo, hi, n = 40) {
  const v = [], f = [];
  const E = [[[-W / 2, -D / 2], [W / 2, -D / 2]], [[W / 2, -D / 2], [W / 2, D / 2]], [[W / 2, D / 2], [-W / 2, D / 2]], [[-W / 2, D / 2], [-W / 2, -D / 2]]];
  for (const [[x0, y0], [x1, y1]] of E) {
    const b = v.length / 3;
    for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n; v.push(x, y, lo(x, y), x, y, hi(x, y)); }
    for (let k = 0; k < n; k++) { const a = b + 2 * k; f.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  }
  return geometryFrom(v, f);
}
const LED = { R: 0xff4d4d, G: 0x33e07a, B: 0x4d7cff };
// parameter cards: three columns of cards, every option list a single vertical column
const COLUMNS = [
  [['Surface shapes', 'c', 'i', 'b']],
  [['Lights', 'l'], ['Camera', 'k']],
  [['Thickness', 's', 'a'], ['Coating specularity', 'p']],
];
const bgsubOn = () => !!document.querySelector('.bgsub-toggle input')?.checked;

export async function initCustom() {
  const spec = await (await fetch('assets/data/custom_grid.json')).json();
  const idx = Object.fromEntries([...spec.order].map((k) => [k, 0]));

  // ── controls, generated from the grid definition
  const box = $('#customControls');
  const segFor = (k, wrap) => `<div class="seg wide${wrap ? ' wrap' : ''}" data-g="${k}">${spec.stops[k].stops.map((s, i) => `<button data-i="${i}">${s.label}</button>`).join('')}</div>`;
  const card = ([title, ...keys]) => `<div class="group"><h5>${title}</h5>${keys.map((k) =>
    `${keys.length > 1 ? `<div class="row-label">${spec.stops[k].label}</div>` : ''}${segFor(k, false).replace('seg wide', 'seg wide vertical')}`).join('')}</div>`;
  box.innerHTML = COLUMNS.map((col) => `<div class="param-col">${col.map(card).join('')}</div>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g] button'); if (!b) return;
    idx[b.parentElement.dataset.g] = +b.dataset.i; update();
  });

  // ── image
  const host = $('#customImg');
  const a = host.appendChild(new Image()), b = host.appendChild(new Image());
  a.alt = b.alt = 'Cycles render of the selected sensor'; b.style.opacity = 0;
  let tok = 0;
  const show = (src) => {
    const t = ++tok, im = new Image();
    im.onload = () => {
      if (t !== tok) return;
      const [front, back] = b.style.opacity === '0' ? [a, b] : [b, a];
      back.src = src; back.style.opacity = 1; front.style.opacity = 0;
    };
    im.src = src;
  };

  // ── 3D preview
  const v = new Viewer($('#customViewer'));
  let group = null, framed = false;
  const glassM = (c, o) => new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: o, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  function rebuild(st) {
    if (group) { group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); v.root.remove(group); }
    group = new THREE.Group();
    const ind = indenterCentres(st), ih = interfaceHeight(st);
    const coat = new THREE.MeshPhysicalMaterial({ color: 0xcfd3da, metalness: st.spec, roughness: Math.min(1, 0.1125 * (10 - 10 * st.spec)), side: THREE.DoubleSide });
    group.add(new THREE.Mesh(grid((x, y) => gelZ(st, x, y, ind)), coat));
    group.add(new THREE.Mesh(grid((x, y) => ifaceZ(st, ih, x, y), 44, 32), glassM(0x4fd1d9, 0.45)));
    group.add(new THREE.Mesh(walls((x, y) => ifaceZ(st, ih, x, y), (x, y) => gelZ(st, x, y, ind)), glassM(0xd7b8c8, 0.3)));
    group.add(new THREE.Mesh(walls((x, y) => bottomZ(st, x, y), (x, y) => ifaceZ(st, ih, x, y)), glassM(0x9fd9f2, 0.22)));
    group.add(new THREE.Mesh(grid((x, y) => bottomZ(st, x, y), 44, 32), glassM(0x9fd9f2, 0.3)));
    st.lights.forEach((l) => {
      const P = lightPose(l), pos = new THREE.Vector3(...P.pos), dir = new THREE.Vector3(...P.dir), along = new THREE.Vector3(...P.along);
      const m = new THREE.Mesh(new THREE.BoxGeometry(l.size, 1.2, 0.6), new THREE.MeshBasicMaterial({ color: LED[l.color] }));
      const z = dir.clone().negate(), x = along.clone().normalize(), y = z.clone().cross(x);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      m.position.copy(pos);
      group.add(m, new THREE.ArrowHelper(dir, pos, 5, LED[l.color], 1.4, 0.9));
    });
    const c = st.camera, cam = new THREE.Vector3(0, 0, -c.distance);
    const hz = Math.tan((c.fov * Math.PI) / 360), vz = hz * 0.75, dist = c.distance + st.acrylic.thickness + st.gel.thickness;
    const corners = [[-hz, -vz], [hz, -vz], [hz, vz], [-hz, vz]].map(([u, w]) => new THREE.Vector3(u * dist, w * dist, dist).add(cam));
    const lv = []; corners.forEach((p, i) => { lv.push(cam, p, p, corners[(i + 1) % 4]); });
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lv), new THREE.LineBasicMaterial({ color: 0x9aa3b5, transparent: true, opacity: 0.7 })));
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 2.4), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.3, roughness: 0.5 }));
    body.position.copy(cam).add(new THREE.Vector3(0, 0, -1.2));
    group.add(body);
    v.root.add(group);
    if (!framed) { v.frame([group], new THREE.Vector3(0.9, 0.75, 1.3), 0.7); framed = true; }
  }

  function update() {
    $$('[data-g]', box).forEach((g) => $$('button', g).forEach((x) => x.classList.toggle('on', +x.dataset.i === idx[g.dataset.g])));
    const src = `assets/img/custom/grid/${gridName(spec, idx, 'grid')}.webp`;
    if (bgsubOn()) diffURL(src, `assets/img/custom/grid/${gridName(spec, idx, 'none')}.webp`).then(show).catch(() => show(src));
    else show(src);
    rebuild(gridParams(spec, idx, 'grid'));
  }
  document.addEventListener('bgsub-change', update);
  update();
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
