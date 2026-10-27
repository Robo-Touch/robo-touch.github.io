# GelSight360 cage-based shape sweeps (logic from the embedded "set_cage_params.py").
#   setting 1: whole sensor shape, lattice OpticalSystemShapeCage, params in _optim_1
#   setting 2: inner resin shell,  lattice EpoxySurfaceShapeCage,  params in _optim_0
# usage: blender -b scene.blend -P g360_shape.py -- SETTING OUTDIR
# NO_CONTACT=1 renders the no-contact background of each design (for background subtraction).
import bpy, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render, set_lattice, load_cage

CFG = {'1': ('OpticalSystemShapeCage', '_optim_1'), '2': ('EpoxySurfaceShapeCage', '_optim_0')}


def setup():
    s = bpy.context.scene
    s.view_settings.view_transform = 'Standard'
    s.view_settings.exposure = -0.5
    s.cycles.glossy_bounces = 4
    bpy.data.collections["script"].hide_render = False
    for k in range(8):
        o = bpy.data.objects["Indenter_" + str(k)]
        o.hide_render = os.environ.get('NO_CONTACT') == '1'
        o.data.materials[0] = bpy.data.materials['AL_coating']
    for n in ("coating", "SensingSurface"):
        if n in bpy.data.objects:
            bpy.data.objects[n].data.materials[0] = bpy.data.materials["AL_coating"]


def dump_mesh(names, path):
    """Evaluated (deformed) vertex positions + faces, for in-browser morphing."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for n in names:
        o = bpy.data.objects.get(n)
        if not o:
            continue
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        mw = o.matrix_world
        m.calc_loop_triangles()
        out[n] = {'v': [round(c, 4) for v in m.vertices for c in (mw @ v.co)],
                  'f': [i for t in m.loop_triangles for i in t.vertices]}
        ev.to_mesh_clear()
    with open(path, 'w') as f:
        json.dump(out, f)


if __name__ == '__main__':
    setting, out = args()[:2]
    lat, cdir = CFG[setting]
    lo, hi = load_cage(os.path.join(os.path.dirname(bpy.data.filepath), cdir))
    gpu(); setup()
    os.makedirs(out, exist_ok=True)
    for d in range(11):
        a = d / 10
        set_lattice(lat, (1 - a) * lo + a * hi)
        bpy.context.view_layer.update()
        if d in (0, 10) and os.environ.get('NO_CONTACT') != '1':
            dump_mesh(["SensingSurface", "360_epoxy", "EpoxySurface", "InterfaceSurface"], os.path.join(out, f'mesh_{d}.json'))
        render(os.path.join(out, str(d)))
