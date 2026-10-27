"""Build the web assets (compressed images + JSON) from the paper Toolbox and the Sigma renders.

    python tools/build_assets.py            # run from the repo root (needs numpy, pillow, opencv)

Inputs : References/Toolbox/...  (original paper renders)   renders/...  (new renders, see tools/render_jobs)
Outputs: assets/img/...  assets/data/...
"""
import os, json, glob
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TB = os.path.join(ROOT, 'References', 'Toolbox')
RD = os.path.join(ROOT, 'renders')
IMG = os.path.join(ROOT, 'assets', 'img')
DATA = os.path.join(ROOT, 'assets', 'data')


def save(src, dst, width=None, q=82, arr=None, alpha=False):
    dst = os.path.join(IMG, dst)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.fromarray(arr) if arr is not None else Image.open(src).convert('RGBA' if alpha else 'RGB')
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=q, method=5)


def washout(exr_path, png_path):
    """Camera saturation model from rebuttal/washout/light_spot_saturating.py (Section 4, 'Camera')."""
    im_exr = cv2.imread(exr_path, cv2.IMREAD_UNCHANGED)[..., :3]
    im_png = cv2.imread(png_path) / 255.0
    mask = (np.linalg.norm(im_exr, axis=2) > 5).astype(np.float32)
    blurred = cv2.GaussianBlur(mask, (11, 11), sigmaX=100)[..., None]
    correction = 0.2
    out = (1 - blurred * (1 - correction)) * im_png + blurred * (1 - correction)
    return cv2.cvtColor((np.clip(out, 0, 1) * 255).astype(np.uint8), cv2.COLOR_BGR2RGB)


def mini():
    for shape in ('cyl', 'sph'):
        for s in range(11):
            d = os.path.join(TB, 'sensors', 'Mini', shape, str(s))
            for state in ('surface', 'indented'):
                for kind in ('render', 'normal'):
                    save(os.path.join(d, f'{state}_{shape}_{kind}.png'), f'mini/{shape}/{s}_{state}_{kind}.webp', 648)
    for s in range(11):
        for state in ('surface', 'indented'):
            save(os.path.join(RD, 'mini_flat', str(s), f'{state}_flat_render.png'), f'mini/flat/{s}_{state}_render.webp', 648)
        save(os.path.join(RD, 'mini_swatch', f'{s}.png'), f'mini/swatch/{s}.webp', q=88, alpha=True)


def belt():
    for p in glob.glob(os.path.join(RD, 'belt', '*.png')):
        if '_silgreen' in p or '_anglegreen' in p:  # exploratory green-LED variants, not shown on the page
            continue
        save(p, 'belt/design/' + os.path.basename(p)[:-4] + '.webp')
    for p in glob.glob(os.path.join(RD, 'belt_basis', '*.png')):
        save(p, 'belt/custom/' + os.path.basename(p)[:-4] + '.webp', q=80)
    for s in range(11):
        d = os.path.join(TB, 'sensors', 'GelBelt', 'results', str(s))
        save(os.path.join(d, 'bg_0.png'), f'belt/spec/{s}_bg.webp')
        for j in range(9):
            save(os.path.join(d, f'render_0_{j}.png'), f'belt/spec/{s}_sph{j + 1}.webp')


def g360light():
    # *_bg: no-contact backgrounds (NO_CONTACT=1 renders) for background subtraction
    for sub, tag in (('g360_light', ''), ('g360_light_bg', '_bg'), ('g360_base', ''), ('g360_base_bg', '_bg')):
        for p in sorted(glob.glob(os.path.join(RD, sub, '*.png'))):
            c = os.path.basename(p)[:-4]
            save(p, f'g360/light{tag}/{c}.webp', q=80)
            save(None, f'g360/light_sat{tag}/{c}.webp', q=80, arr=washout(p[:-4] + '.exr', p))


def g360():
    for st in ('1', '2'):
        for sub, tag in ((f'g360_set{st}', ''), (f'g360_set{st}_bg', '_bg')):
            for d in range(11):
                p = os.path.join(RD, sub, f'{d}.png')
                save(p, f'g360/set{st}{tag}/{d}.webp')
                save(None, f'g360/set{st}_sat{tag}/{d}.webp', arr=washout(p[:-4] + '.exr', p))


def svelte():
    for p in (glob.glob(os.path.join(RD, 'svelte', '*.png')) + glob.glob(os.path.join(RD, 'svelte_morph', '*.png'))
              + glob.glob(os.path.join(RD, 'svelte_bg', '*_none.png'))):
        n = os.path.basename(p)[:-4]
        save(p, f'svelte/{n}.webp', 1296, q=85)
        save(None, f'svelte_sat/{n}.webp', 1296, q=85, arr=washout(p[:-4] + '.exr', p))


def ml():
    for s in (0, 1, 5, 8):
        d = os.path.join(TB, 'rebuttal', 'ML', 'results', 'cyl', str(s))
        save(os.path.join(d, 'surface_cyl_render.png'), f'ml/tilt/{s}/bg.webp', 324, q=78)
        for x in range(-10, 11):
            for y in range(-10, 11):
                save(os.path.join(d, f'x{x}y{y}.png'), f'ml/tilt/{s}/x{x}y{y}.webp', 324, q=78)
    for shape in ('cyl', 'sph'):
        for s in (1, 5, 8):
            d = os.path.join(TB, 'rebuttal', 'ML', 'results_cylRad', shape, str(s))
            save(os.path.join(d, f'surface_{shape}_render.png'), f'ml/radius/{shape}/{s}/bg.webp', 324, q=78)
            for r in range(2, 51):
                save(os.path.join(d, f's{r}.png'), f'ml/radius/{shape}/{s}/{r}.webp', 324, q=78)


def custom():
    """Build-your-own grid (tools/render_jobs/custom_grid_job.py) -> assets/img/custom/grid"""
    for p in glob.glob(os.path.join(RD, 'custom_grid', '*.png')):
        dst = 'custom/grid/' + os.path.basename(p)[:-4] + '.webp'
        if not os.path.exists(os.path.join(IMG, dst)):
            save(p, dst, q=80)


def meshes():
    """Pack exported meshes (renders/geo) and the G360 cage morph end-points into one JSON per sensor."""
    os.makedirs(DATA, exist_ok=True)
    for n in ('mini', 'svelte', 'belt'):
        with open(os.path.join(RD, 'geo', f'{n}.json')) as f:
            json.dump(json.load(f), open(os.path.join(DATA, f'geo_{n}.json'), 'w'), separators=(',', ':'))
    out = {}
    for st, names in (('1', ['SensingSurface', 'InterfaceSurface']), ('2', ['SensingSurface', 'EpoxySurface'])):
        a = json.load(open(os.path.join(RD, f'g360_set{st}', 'mesh_0.json')))
        b = json.load(open(os.path.join(RD, f'g360_set{st}', 'mesh_10.json')))
        out[st] = {n: {'v0': a[n]['v'], 'v1': b[n]['v'], 'f': a[n]['f']} for n in names}
    json.dump(out, open(os.path.join(DATA, 'geo_g360.json'), 'w'), separators=(',', ':'))
    with open(os.path.join(RD, 'svelte_morph', 'mirror_morph.json')) as f:
        json.dump(json.load(f), open(os.path.join(DATA, 'geo_svelte_morph.json'), 'w'), separators=(',', ':'))


if __name__ == '__main__':
    import sys
    steps = sys.argv[1:] or ['mini', 'belt', 'g360', 'g360light', 'svelte', 'ml', 'custom', 'meshes']
    for s in steps:
        print('building', s, flush=True)
        globals()[s]()
