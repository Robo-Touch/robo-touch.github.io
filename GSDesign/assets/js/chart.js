// Small dependency-free SVG line chart: one series, optional highlighted band, an animated "current" marker,
// and a hover tooltip. Clicking a point calls onPick(index).
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

export function lineChart(host, { title, note, xs, ys, xLabel = (x) => x, yTicks, band, bandLabel, fmt = (v) => v.toFixed(2), onPick }) {
  const card = document.createElement('div');
  card.className = 'chart';
  card.innerHTML = `<h6>${title}${note ? `<span>${note}</span>` : ''}</h6>`;
  host.appendChild(card);
  const W = 320, H = 118, m = { l: 34, r: 8, t: 8, b: 20 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${title} chart` }, card);
  const tip = document.createElement('div');
  tip.className = 'tip';
  card.appendChild(tip);

  const x0 = xs[0], x1 = xs[xs.length - 1];
  const lo = Math.min(...yTicks), hi = Math.max(...yTicks);
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (y) => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);

  const grid = el('g', { class: 'grid' }, svg), axis = el('g', { class: 'axis' }, svg);
  for (const t of yTicks) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid);
    el('text', { x: m.l - 6, y: Y(t) + 3, 'text-anchor': 'end' }, axis).textContent = t;
  }
  const step = Math.max(1, Math.round(xs.length / 6));
  xs.forEach((x, i) => {
    if (i % step === 0 || i === xs.length - 1)
      el('text', { x: X(x), y: H - 5, 'text-anchor': 'middle' }, axis).textContent = xLabel(x, i);
  });
  if (band) {
    const bx = X(band[0]) - 4, bw = X(band[1]) - X(band[0]) + 8;
    el('rect', { class: 'band', x: bx, y: m.t, width: bw, height: H - m.t - m.b, rx: 3 }, svg);
    if (bandLabel) el('text', { class: 'band-label', x: bx + 4, y: H - m.b - 5 }, svg).textContent = bandLabel;
  }
  const curG = el('g', { class: 'cur-g' });
  el('line', { class: 'cur-line', x1: 0, x2: 0, y1: m.t, y2: H - m.b }, curG);
  el('path', { class: 'series', d: xs.map((x, i) => `${i ? 'L' : 'M'}${X(x)},${Y(ys[i])}`).join('') }, svg);
  xs.forEach((x, i) => el('circle', { class: 'dot', cx: X(x), cy: Y(ys[i]), r: 3.5 }, svg));
  svg.appendChild(curG);
  const cur = el('circle', { class: 'cur', r: 6, cx: 0, cy: Y(ys[0]) }, curG);

  // hit targets wider than the marks
  const hw = (W - m.l - m.r) / (xs.length - 1);
  xs.forEach((x, i) => {
    const r = el('rect', { class: 'hit', x: X(x) - hw / 2, y: 0, width: hw, height: H }, svg);
    r.addEventListener('mouseenter', () => {
      const bb = svg.getBoundingClientRect(), s = bb.width / W;
      tip.textContent = `${xLabel(x, i)} → ${fmt(ys[i])}`;
      tip.style.left = `${12 + X(x) * s}px`;
      tip.style.top = `${30 + Y(ys[i]) * s}px`;
      tip.style.opacity = 1;
    });
    r.addEventListener('mouseleave', () => (tip.style.opacity = 0));
    if (onPick) r.addEventListener('click', () => onPick(i));
  });

  return {
    set(i) {
      curG.style.transform = `translateX(${X(xs[i])}px)`;
      cur.style.cy = `${Y(ys[i])}px`;
    },
    remove() { card.remove(); },
  };
}
