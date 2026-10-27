// Background subtraction for tactile images: diff = image - background (per channel, display values in [-1, 1]),
// mapped to [0, 1] in one of two ways (both keep negative changes; identical inputs give flat 0.5):
//   'sym'    out = 0.5 + diff / (2 max|diff|)          "no change" is always 0.5
//   'minmax' out = (diff - min) / (max - min)          uses the full range; "no change" lands at -min / (max - min)
const cache = new Map();
let MODE = 'sym';
export const setScale = (m) => { MODE = m; };
export const getScale = () => MODE;

function load(src) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
function pixelsOf(im, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

/** normalised (a - b) as an ImageData; a, b are RGBA byte arrays of equal size */
export function subtract(a, b, w, h, mode = MODE) {
  const n = w * h, d = new Float32Array(n * 3);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
    const v = (a[i * 4 + c] - b[i * 4 + c]) / 255;
    d[i * 3 + c] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const peak = Math.max(-lo, hi), span = hi - lo;
  const map = mode === 'minmax' ? (v) => (v - lo) / span : (v) => 0.5 + v / (2 * peak);
  const flat = mode === 'minmax' ? span <= 1e-6 : peak <= 1e-6;
  const out = new ImageData(w, h);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = flat ? 128 : Math.round(map(d[i * 3 + c]) * 255);
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

export function toURL(imageData) {
  const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height;
  c.getContext('2d').putImageData(imageData, 0, 0);
  return c.toDataURL('image/png');
}

/** data URL of the background-subtracted image (cached per pair) */
export function diffURL(src, bg) {
  const key = src + '|' + bg + '|' + MODE;
  if (!cache.has(key)) {
    cache.set(key, Promise.all([load(src), load(bg)]).then(([a, b]) => {
      const w = a.naturalWidth, h = a.naturalHeight;
      return toURL(subtract(pixelsOf(a, w, h), pixelsOf(b, w, h), w, h));
    }));
    if (cache.size > 300) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
