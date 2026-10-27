# GelBelt forward design: light configurations x contact objects.
# Configurations are switched via view-layer exclusion (inactive ones are excluded in roller_sim3.blend).
# usage: blender -b scene.blend -P belt.py -- OUTDIR
import bpy, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render

CONFS = {'design1': 'conf_side', 'design2': 'conf_top', 'design3': 'conf_optimal.001',
         'design3_silgreen': 'conf_opt_silgreen', 'design3_anglegreen': 'conf_opt_anglegreen'}
SPHERES = ['sph%d' % i for i in range(1, 10)]
# spheres are pressed one at a time, as in the embedded roller_spec.blend script
OBJECTS = {**{s: [s] for s in SPHERES}, 'screw': ['screw'], 'breadboard': ['protoboard'], 'rack': ['rack'], 'none': []}

if __name__ == '__main__':
    out = args()[0]
    gpu()

    def layer(name, lc=None):
        lc = lc or bpy.context.view_layer.layer_collection
        if lc.name == name:
            return lc
        for ch in lc.children:
            r = layer(name, ch)
            if r:
                return r
    bpy.data.collections['spheres'].hide_render = True
    bpy.data.collections['spheres_test'].hide_render = True
    bpy.data.collections['conf_optimal'].hide_render = True
    for ck, cc in CONFS.items():
        for c in CONFS.values():
            layer(c).exclude = c != cc
            bpy.data.collections[c].hide_render = c != cc
        for ok, objs in OBJECTS.items():
            for o in SPHERES + ['screw', 'protoboard', 'rack']:
                bpy.data.objects[o].hide_render = o not in objs
            bpy.context.view_layer.update()
            render(os.path.join(out, f'{ck}_{ok}'), exr=False)
