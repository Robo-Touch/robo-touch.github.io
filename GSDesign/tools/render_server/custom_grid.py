"""The pre-rendered parameter grid of the "Build your own sensor" panel (single source of truth).

    python tools/render_server/custom_grid.py        # writes assets/data/custom_grid.json for the page

Every combination of the stops below is rendered (tools/render_jobs/custom_grid_job.py), once with the 3x3 indenter
grid and once without contact (background). File name: c{coating}i{interface}b{bottom}s{silicone}a{acrylic}p{spec}
k{camera}l{lights}_{grid|none}.webp, each letter followed by the stop index.
"""
import itertools, json, math, os

STOPS = {
    'c': {'label': 'coating', 'stops': [
        {'label': 'flat', 'shape': 'flat', 'height': 0}, {'label': 'cylinder · convex', 'shape': 'cyl', 'height': 2},
        {'label': 'cylinder · concave', 'shape': 'cyl', 'height': -2}, {'label': 'dome · convex', 'shape': 'sph', 'height': 2},
        {'label': 'dome · concave', 'shape': 'sph', 'height': -2}]},
    'i': {'label': 'interface', 'stops': [
        {'label': 'flat', 'shape': 'flat', 'height': 0}, {'label': 'dome · convex', 'shape': 'sph', 'height': 1},
        {'label': 'dome · concave', 'shape': 'sph', 'height': -1}]},
    'b': {'label': 'acrylic bottom', 'stops': [
        {'label': 'flat', 'shape': 'flat', 'height': 0}, {'label': 'lens · convex', 'shape': 'sph', 'height': 1.5},
        {'label': 'lens · concave', 'shape': 'sph', 'height': -1.5}]},
    's': {'label': 'silicone', 'stops': [{'label': '1 mm', 'value': 1.0}, {'label': '2 mm', 'value': 2.0}]},
    'a': {'label': 'acrylic', 'stops': [{'label': '3 mm', 'value': 3.0}, {'label': '5 mm', 'value': 5.0}]},
    'p': {'label': 'specularity', 'stops': [{'label': '0.1', 'value': 0.1}, {'label': '0.5', 'value': 0.5}, {'label': '0.8', 'value': 0.8}]},
    # same coverage for every camera: the distance is solved per stack so the frame fits the sensing surface
    'k': {'label': 'camera', 'stops': [
        {'label': 'standard<small>70°</small>', 'fov': 70}, {'label': 'close wide<small>90°</small>', 'fov': 90},
        {'label': 'far narrow<small>55°</small>', 'fov': 55}]},
    # light layouts: height "acr" = middle of the acrylic edge, "sil" = middle of the silicone edge, or mm
    'l': {'label': 'lights', 'stops': [
        {'label': 'edge-lit acrylic', 'lights': [['R', 'left', 'acr', 0, 10], ['G', 'bottom', 'acr', 0, 10], ['B', 'right', 'acr', 0, 10]]},
        {'label': 'edge-lit silicone', 'lights': [['R', 'left', 'sil', 0, 10], ['G', 'bottom', 'sil', 0, 10], ['B', 'right', 'sil', 0, 10]]},
        {'label': 'angled 30°', 'lights': [['R', 'left', 1.0, 30, 10], ['G', 'bottom', 1.0, 30, 10], ['B', 'right', 1.0, 30, 10]]},
        {'label': 'steep 60° from below', 'lights': [['R', 'left', 0.5, 60, 10], ['G', 'bottom', 0.5, 60, 10], ['B', 'right', 0.5, 60, 10]]},
        {'label': 'long bars', 'lights': [['R', 'left', 'acr', 0, 18], ['G', 'bottom', 'acr', 0, 18], ['B', 'right', 'acr', 0, 18]]},
        {'label': 'rotated sides', 'lights': [['R', 'bottom', 'acr', 0, 10], ['G', 'right', 'acr', 0, 10], ['B', 'top', 'acr', 0, 10]]}]},
}
ORDER = 'cibsapkl'
FIT_HALF_WIDTH = 10.4          # mm; the sensing surface is 22 x 16 mm, so the frame stays just inside its x edges
N_ACR, N_SIL = 1.49, 1.41


def fit_distance(fov, ta, ts):
    """camera distance below the acrylic so the edge ray of the horizontal field of view, refracted through the
    acrylic (ta) and silicone (ts), lands FIT_HALF_WIDTH from the centre on a flat stack"""
    t = math.radians(fov / 2)
    off = lambda n, th: th * math.tan(math.asin(math.sin(t) / n))
    return round((FIT_HALF_WIDTH - off(N_ACR, ta) - off(N_SIL, ts)) / math.tan(t), 2)
CONTACTS = ['grid', 'none']
RESOLUTION = (240, 180)


def params(idx, contact):
    """idx: dict letter -> stop index"""
    S = {k: STOPS[k]['stops'][idx[k]] for k in ORDER}
    ta, ts = S['a']['value'], S['s']['value']
    h = lambda v: ta / 2 if v == 'acr' else ta + ts / 2 if v == 'sil' else float(v)
    return {
        'spec': S['p']['value'], 'exposure': 0.0, 'contact': contact, 'resolution': list(RESOLUTION),
        'gel': {'shape': S['c']['shape'], 'height': S['c']['height'], 'thickness': ts},
        'interface': {'shape': S['i']['shape'], 'height': S['i']['height']},
        'acrylic': {'shape': S['b']['shape'], 'height': S['b']['height'], 'thickness': ta},
        'camera': {'distance': fit_distance(S['k']['fov'], ta, ts), 'tilt': 0.0, 'fov': S['k']['fov']},
        'lights': [{'color': c, 'side': side, 'height': h(hh), 'tilt': t, 'size': size, 'power': 1.0}
                   for c, side, hh, t, size in S['l']['lights']],
    }


def name(idx, contact):
    return ''.join(f'{k}{idx[k]}' for k in ORDER) + f'_{contact}'


def all_indices():
    for combo in itertools.product(*(range(len(STOPS[k]['stops'])) for k in ORDER)):
        yield dict(zip(ORDER, combo))


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    n = sum(1 for _ in all_indices())
    json.dump({'order': ORDER, 'stops': STOPS, 'contacts': CONTACTS, 'resolution': RESOLUTION, 'count': n * len(CONTACTS),
               'fit': {'half_width': FIT_HALF_WIDTH, 'n_acr': N_ACR, 'n_sil': N_SIL}},
              open(os.path.join(root, 'assets', 'data', 'custom_grid.json'), 'w'), indent=1)
    print(n, 'combinations x', len(CONTACTS), 'contacts =', n * len(CONTACTS), 'renders')
