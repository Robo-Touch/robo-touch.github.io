// Hover cards for the four objective functions (Section 5 of the paper). Any element with data-metric="<key>" gets one.
const M = {
  rgb2norm: {
    name: 'RGB2Normal', sub: 'O₁ · shape-measurement accuracy · higher is better, ∈ [0, 1]',
    text: [
      'Photometric stereo works best when colour changes linearly with the surface normal. Press spherical indenters (r = 1.5 mm) at L = 9 sites. Through each contact centre, take D = 8 lines (cardinal and ordinal). Along each line, reduce the RGB values to a dominant colour c with PCA and regress it against the normal\'s polar angle θ.',
    ],
    tex: String.raw`O_1=\frac{1}{L\,D}\sum_{l=1}^{L}\sum_{d=1}^{D} R^2\!\left(c_{l,d},\,\theta_{l,d}\right)`,
    meta: [['needs', 'tactile + normal renders'], ['used in', 'Cases I–III']],
  },
  normdiff: {
    name: 'NormDiff', sub: 'O₂ · robustness of normal recovery to camera noise · closer to 0 is better',
    text: [
      'Each indented pixel gives a tuple (r, g, b, θ, φ). For a target normal (θᵢ, φᵢ), take its nearest pixels pⱼ. Perturb each one\'s colour by ±30 % (a proportional camera-noise model) and collect every pixel qₖ whose colour falls inside that box. The spread of their normals is how confused the normal estimate gets for that colour.',
    ],
    tex: String.raw`\begin{aligned}O_2&=-\frac{1}{|\mathcal N|}\sum_{i\in\mathcal N}\frac{1}{U}\sum_{j=1}^{U}C(p_j)\\[4pt]
      C(p_j)&=w_\theta\,(\max_k\theta_k-\min_k\theta_k)\\ &\quad+\,w_\phi\,(\max_k\phi_k-\min_k\phi_k)\end{aligned}`,
    meta: [['noise', '30 % of RGB'], ['used in', 'Cases I–III']],
  },
  aoap: {
    name: 'As-orthographic-as-possible (AOAP)', sub: 'O₃ · local geometric distortion · higher is better',
    text: [
      'Shoot one ray per pixel and follow ideal reflections and refractions until it hits the sensing surface. Rays should arrive along the surface normal, as if from an orthographic camera. A coverage term over the U of T surface faces that are hit prevents a mode collapse onto a tiny region.',
    ],
    tex: String.raw`O_3=\frac{1}{N}\sum_{i=1}^{N}\left|\,\mathbf n_i\cdot\boldsymbol\omega_i\right| + k_1\,\frac{U}{T},\qquad k_1=0.01`,
    meta: [['N', 'number of pixels'], ['used in', 'Case IV (Svelte)']],
  },
  pw: {
    name: '2D-to-3D projection warping', sub: 'O₄ · global warping of the image field · higher is better',
    text: [
      'Each pixel is a square of equal area, and its footprint on the sensing surface should be too. Split every pixel into two triangles, trace their corners to the surface, and compute each projected triangle area aᵢ in closed form. The score is the ratio of mean to standard deviation of those areas, as stated in the paper.',
    ],
    tex: String.raw`O_4=\frac{\mu_a}{\sigma_a},\qquad a_i=\tfrac12\big\lVert(\mathbf x_{i,1}-\mathbf x_{i,0})\times(\mathbf x_{i,2}-\mathbf x_{i,0})\big\rVert`,
    meta: [['complements', 'AOAP (local)'], ['used in', 'Case III, setting 1']],
  },
};

const pop = document.createElement('div');
pop.className = 'metric-pop';
pop.setAttribute('role', 'tooltip');
document.body.appendChild(pop);
let current = null, hideTimer = 0;

function fill(key) {
  const m = M[key];
  let math = m.tex;
  try { if (window.katex) math = katex.renderToString(m.tex, { displayMode: true, throwOnError: false }); } catch { /* fall back to TeX source */ }
  pop.innerHTML = `<h6>${m.name}</h6><p class="sub">${m.sub}</p>${m.text.map((t) => `<p>${t}</p>`).join('')}
    <div class="math">${math}</div><div class="meta">${m.meta.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
}

function place(el) {
  const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, g = 10;
  let x = Math.min(Math.max(16, r.left + r.width / 2 - pw / 2), innerWidth - pw - 16);
  let y = r.bottom + g;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - g);
  pop.style.left = `${x}px`; pop.style.top = `${y}px`;
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-metric]');
  if (!el || !M[el.dataset.metric]) return;
  clearTimeout(hideTimer);
  if (current !== el) { current = el; fill(el.dataset.metric); }
  place(el);
  pop.classList.add('on');
});
// the card stays open while the pointer travels from the metric name onto it (so it can be read or scrolled)
const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { pop.classList.remove('on'); current = null; }, 300); };
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest('[data-metric]');
  if (!el || el.contains(e.relatedTarget) || pop.contains(e.relatedTarget)) return;
  hideSoon();
});
pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
pop.addEventListener('mouseleave', (e) => { if (!current?.contains(e.relatedTarget)) hideSoon(); });
addEventListener('scroll', () => { if (!pop.matches(':hover')) { pop.classList.remove('on'); current = null; } }, { passive: true });
// touch: tap toggles
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-metric]');
  if (!el || !matchMedia('(hover: none)').matches) return;
  if (current === el && pop.classList.contains('on')) { pop.classList.remove('on'); current = null; return; }
  current = el; fill(el.dataset.metric); place(el); pop.classList.add('on');
});
