# GelSight Svelte: intermediate back-mirror (M1) shapes between the original and the CMA-ES optimum.
# The two meshes have different topology, so every vertex V of the optimized mirror is paired with its
# closest point P on the original mirror; shape(t) = P + t (V - P).  t=0 ~ original, t=1 = optimized.
# These are blends of the two end shapes, not intermediate CMA-ES iterates.
# usage: blender -b svelte_v1.blend -P svelte_morph.py -- OUTDIR
# NO_CONTACT=1 instead renders the no-contact background for all five shapes (original, 25/50/75 %, optimized).
import bpy, os, sys, json
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render
from svelte import INDENTERS

TS = [0.25, 0.5, 0.75]

if __name__ == '__main__':
    out = args()[0]
    os.makedirs(out, exist_ok=True)
    gpu()
    dg = bpy.context.evaluated_depsgraph_get()
    orig = bpy.data.objects['Initial_MirrorSurface.001']
    opt = bpy.data.objects['Optimized_MirrorSurface']
    eo = orig.evaluated_get(dg)
    m = eo.to_mesh()
    bvh = BVHTree.FromPolygons([orig.matrix_world @ v.co for v in m.vertices], [p.vertices for p in m.polygons])
    eo.to_mesh_clear()

    mw, inv = opt.matrix_world, opt.matrix_world.inverted()
    V = [mw @ v.co for v in opt.data.vertices]
    P = [bvh.find_nearest(v)[0] for v in V]
    # morph end points + faces for the page's 3D viewer (world space, mm)
    json.dump({'v0': [round(c, 3) for p in P for c in p], 'v1': [round(c, 3) for v in V for c in v],
               'f': [i for poly in opt.data.polygons for i in poly.vertices] if all(len(p.vertices) == 3 for p in opt.data.polygons)
               else [i for poly in opt.data.polygons for k in range(1, len(poly.vertices) - 1)
                     for i in (poly.vertices[0], poly.vertices[k], poly.vertices[k + 1])]},
              open(os.path.join(out, 'mirror_morph.json'), 'w'))

    morph = opt.copy(); morph.data = opt.data.copy(); morph.name = 'MirrorMorph'
    for c in opt.users_collection:
        c.objects.link(morph)
    for o in ('BigMirror', 'Initial_MirrorSurface', 'Indenter_auto', 'Initial_MirrorSurface.001', 'Optimized_MirrorSurface'):
        bpy.data.objects[o].hide_render = True
    morph.hide_render = False
    if os.environ.get('NO_CONTACT') == '1':
        for o in INDENTERS.values():
            bpy.data.objects[o].hide_render = True
        for t in [0.0] + TS + [1.0]:
            for v, p, q in zip(morph.data.vertices, P, V):
                v.co = inv @ (p + t * (q - p))
            morph.data.update()
            morph.hide_render = not 0 < t < 1
            bpy.data.objects['Initial_MirrorSurface.001'].hide_render = t != 0
            bpy.data.objects['Optimized_MirrorSurface'].hide_render = t != 1
            name = {0.0: 'original', 1.0: 'optimized'}.get(t, f'morph{int(t * 100)}')
            render(os.path.join(out, f'{name}_none'))
        sys.exit(0)
    for t in TS:
        for v, p, q in zip(morph.data.vertices, P, V):
            v.co = inv @ (p + t * (q - p))
        morph.data.update()
        for ik, io in INDENTERS.items():
            for o in INDENTERS.values():
                bpy.data.objects[o].hide_render = o != io
            render(os.path.join(out, f'morph{int(t * 100)}_{ik}'))
