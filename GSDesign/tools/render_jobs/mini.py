# GelSight Mini, flat gel pad: coating specularity sweep (mapping from the embedded SPECULARITY script).
# usage: blender -b scene.blend -P mini.py -- OUTDIR
import bpy, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render

if __name__ == '__main__':
    out = args()[0]
    gpu()
    s = bpy.context.scene
    s.view_settings.view_transform = 'Standard'
    s.cycles.film_exposure = 2
    s.cycles.glossy_bounces = 4
    s.view_settings.gamma = 0.8
    for n in ('surface_cyl', 'surface_sph', 'indented_cyl', 'indented_sph', 'cyl_balls_indent', 'sph_balls_indent'):
        bpy.data.objects[n].hide_render = True
    bpy.data.objects['pad'].hide_render = False
    bsdf = bpy.data.materials['AL_mini2'].node_tree.nodes['Principled BSDF']
    for spec in range(11):
        bsdf.inputs[1].default_value = spec / 10.0               # metallic
        bsdf.inputs[2].default_value = 0.45 / 4 * (10 - spec)    # roughness
        for pressed in (False, True):
            bpy.data.objects['Icosphere'].hide_render = not pressed
            render(os.path.join(out, str(spec), 'indented_flat_render' if pressed else 'surface_flat_render'), exr=False)
