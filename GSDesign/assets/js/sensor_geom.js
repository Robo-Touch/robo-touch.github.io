// Geometry of the parametric sensor (mirrors tools/render_server/sensor_builder.py and custom_grid.py).
export const W = 22, D = 16, IND_R = 1.5, IND_D = 0.5;

/** sagitta-h cap over the footprint (> 0 convex, < 0 concave): cyl = arc across x, sph = cap through the four corners */
export function crown(shape, h, x, y) {
  if (shape === 'flat' || Math.abs(h) <= 1e-6) return 0;
  if (h < 0) return -crown(shape, -h, x, y);
  const [c2, r2] = shape === 'cyl' ? [(W / 2) ** 2, x * x] : [(W / 2) ** 2 + (D / 2) ** 2, x * x + y * y];
  const R = (h * h + c2) / (2 * h);
  return Math.sqrt(Math.max(0, R * R - r2)) - (R - h);
}
export const topCrownZ = (p, x, y) => p.acrylic.thickness + p.gel.thickness + crown(p.gel.shape, p.gel.height, x, y) - Math.min(0, p.gel.height);
export const indentSites = (c) => (c === 'none' ? [] : c === 'center' ? [[0, 0]] : [-4.5, 0, 4.5].flatMap((y) => [-6, 0, 6].map((x) => [x, y])));
export const indenterCentres = (p, contact = p.contact) => indentSites(contact).map(([x, y]) => [x, y, topCrownZ(p, x, y) + IND_R - IND_D]);
/** interface crown capped so the interface stays >= 0.25 mm below the coating */
export function interfaceHeight(p) {
  let h = p.interface.height;
  const pts = []; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) pts.push([-W / 2 + (W * i) / 8, -D / 2 + (D * j) / 8]);
  const gap = (hh) => Math.min(...pts.map(([x, y]) => topCrownZ(p, x, y) - p.acrylic.thickness - crown(p.interface.shape, hh, x, y)));
  while (h > 0 && gap(h) < 0.25) h = Math.max(0, h - 0.05);
  return h;
}
export function lightPose(l) {
  const off = 0.8, t = (l.tilt * Math.PI) / 180;
  const S = { left: [[-W / 2 - off, 0], [1, 0], [0, 1]], right: [[W / 2 + off, 0], [-1, 0], [0, 1]],
    bottom: [[0, -D / 2 - off], [0, 1], [1, 0]], top: [[0, D / 2 + off], [0, -1], [1, 0]] }[l.side];
  const [[x, y], [ix, iy], along] = S;
  return { pos: [x, y, l.height], dir: [ix * Math.cos(t), iy * Math.cos(t), Math.sin(t)], along: [along[0], along[1], 0] };
}

/** camera distance that fits the frame to the sensing surface (mirrors custom_grid.fit_distance) */
export function fitDistance(fit, fov, ta, ts) {
  const t = (fov * Math.PI) / 360, off = (n, th) => th * Math.tan(Math.asin(Math.sin(t) / n));
  return Math.round(((fit.half_width - off(fit.n_acr, ta) - off(fit.n_sil, ts)) / Math.tan(t)) * 100) / 100;
}

/** scene parameters of a grid point (mirrors custom_grid.params) */
export function gridParams(spec, idx, contact) {
  const S = Object.fromEntries([...spec.order].map((k) => [k, spec.stops[k].stops[idx[k]]]));
  const ta = S.a.value, ts = S.s.value;
  const h = (v) => (v === 'acr' ? ta / 2 : v === 'sil' ? ta + ts / 2 : +v);
  return {
    spec: S.p.value, exposure: 0, contact,
    gel: { shape: S.c.shape, height: S.c.height, thickness: ts },
    interface: { shape: S.i.shape, height: S.i.height },
    acrylic: { shape: S.b.shape, height: S.b.height, thickness: ta },
    camera: { distance: fitDistance(spec.fit, S.k.fov, ta, ts), tilt: 0, fov: S.k.fov },
    lights: S.l.lights.map(([color, side, hh, tilt, size]) => ({ color, side, height: h(hh), tilt, size, power: 1 })),
  };
}
export const gridName = (spec, idx, contact) => [...spec.order].map((k) => `${k}${idx[k]}`).join('') + `_${contact}`;
