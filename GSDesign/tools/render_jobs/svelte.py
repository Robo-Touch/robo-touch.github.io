# GelSight Svelte: original vs CMA-ES-optimized back mirror (M1), for each indenter.
# usage: blender -b scene.blend -P svelte.py -- OUTDIR
import bpy, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render

MIRRORS = {'original': 'Initial_MirrorSurface.001', 'optimized': 'Optimized_MirrorSurface'}
# ordered tip -> base along the finger
INDENTERS = {'sphere1': 'IndenterSurface5-tip', 'sphere2': 'IndenterSurface', 'sphere3': 'IndenterSurface.001',
             'sphere4': 'IndenterSurface.002', 'sphere5': 'IndenterSurface.003', 'sphere6': 'IndenterSurface-bottom',
             'lego': 'Indenter_LEGO - block', 'screw': 'IndenterSurface-setscrew'}

if __name__ == '__main__':
    out = args()[0]
    gpu()
    for m in ('BigMirror', 'Initial_MirrorSurface', 'Indenter_auto'):
        bpy.data.objects[m].hide_render = True
    for mk, mo in MIRRORS.items():
        for o in MIRRORS.values():
            bpy.data.objects[o].hide_render = o != mo
        for ik, io in INDENTERS.items():
            for o in INDENTERS.values():
                bpy.data.objects[o].hide_render = o != io
            render(os.path.join(out, f'{mk}_{ik}'))
