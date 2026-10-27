# GelBelt "custom lights", offline grid: move one LED bar over a (height, tilt) grid while the other two stay at
# their Design 3 placement; all three bars on, scene settings untouched (the live server handles free combinations).
# Note: these renders cannot be composited per light: the scene clamps indirect samples (clamp 10), which makes
# the image non-linear in light emission.
#   height: bar centre above the gel (world y, mm); the acrylic/silicone interface is at y = 2.8
#   tilt:   emission direction rotated from horizontal (into the sensor) down toward the gel
# usage: blender -b roller_sim3.blend -P belt_basis.py -- OUTDIR
import bpy, os, sys, math
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render

HEIGHTS = [1.0, 2.5, 4.0, 5.5, 7.0, 8.5, 10.0]
TILTS = [0.0, 22.5, 45.0, 67.5]
CONTACTS = {'none': [], 'sph5': ['sph5'], 'screw': ['screw']}
# bar -> (object, fixed coordinates, horizontal emission direction, long axis) — Design 3 placements
BARS = {'R': ('rlight.005', (80.8, None, 66.0), Vector((0, 0, -1)), Vector((1, 0, 0))),
        'B': ('blight.005', (80.8, None, 0.8), Vector((0, 0, 1)), Vector((1, 0, 0))),
        'G': ('glight.005', (105.5, None, 33.5), Vector((-1, 0, 0)), Vector((0, 0, 1)))}


def pose(obj, key, h, tilt):
    _, fixed, horiz, long_axis = BARS[key]
    t = math.radians(tilt)
    d = (horiz * math.cos(t) + Vector((0, -1, 0)) * math.sin(t)).normalized()   # emission direction
    z = -d                                                                        # area lights emit along -Z
    x = long_axis.normalized()
    m = Matrix((x, z.cross(x), z)).transposed().to_4x4()
    m.translation = Vector((fixed[0], h, fixed[2]))
    obj.matrix_world = m @ Matrix.Diagonal(obj.matrix_world.to_scale().to_4d())


def layer(name, lc=None):
    lc = lc or bpy.context.view_layer.layer_collection
    if lc.name == name:
        return lc
    for ch in lc.children:
        r = layer(name, ch)
        if r:
            return r


def setup():
    for c in ('conf_side', 'conf_top', 'conf_opt_silgreen', 'conf_opt_anglegreen', 'conf_optimal'):
        layer(c).exclude = True
    layer('conf_optimal.001').exclude = False
    for c in ('spheres', 'spheres_test'):
        bpy.data.collections[c].hide_render = True
    return {k: bpy.data.objects[v[0]].matrix_world.copy() for k, v in BARS.items()}


def set_contact(objs):
    for o in ['sph%d' % i for i in range(1, 10)] + ['screw', 'protoboard', 'rack']:
        bpy.data.objects[o].hide_render = o not in objs


if __name__ == '__main__':
    out = args()[0]
    gpu()
    home = setup()
    for ck, objs in CONTACTS.items():
        set_contact(objs)
        for key in BARS:
            for k2, m in home.items():
                bpy.data.objects[BARS[k2][0]].matrix_world = m
            for i, h in enumerate(HEIGHTS):
                for j, tl in enumerate(TILTS):
                    p = os.path.join(out, f'{key}_h{i}_t{j}_{ck}')
                    if os.path.exists(p + '.png'):
                        continue
                    pose(bpy.data.objects[BARS[key][0]], key, h, tl)
                    bpy.context.view_layer.update()
                    render(p, exr=False)
