# Coating preview: the GelSight Mini coating material (AL_mini2 from mini_sim_V2.blend) on a sphere lit by Blender's
# Material Preview HDRI (datafiles/studiolights/world/forest.exr), like the material preview ball in Blender.
# Transparent film, so the page puts it on its own background.
# usage: blender -b --factory-startup -P mini_swatch.py -- MINI_BLEND OUTDIR
import bpy, os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu

src, out = args()[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(src, link=False) as (fr, to):
    to.materials = ['AL_mini2']
mat = to.materials[0]
s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = 256
s.cycles.use_denoising = True
s.render.resolution_x = s.render.resolution_y = 360
s.render.film_transparent = True
s.view_settings.view_transform = 'Standard'

hdri = os.path.join(bpy.utils.system_resource('DATAFILES'), 'studiolights', 'world', 'forest.exr')
w = bpy.data.worlds.new('preview'); s.world = w; w.use_nodes = True
nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(hdri)
nt.links.new(env.outputs[0], nt.nodes['Background'].inputs[0])

bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1)
ball = bpy.context.object
bpy.ops.object.shade_smooth()
ball.data.materials.append(mat)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam); s.camera = cam
cam.data.lens = 85
cam.location = (0, -5.6, 1.2); cam.rotation_euler = (math.radians(78), 0, 0)

gpu()
bsdf = mat.node_tree.nodes['Principled BSDF']
os.makedirs(out, exist_ok=True)
for spec in range(11):
    bsdf.inputs[1].default_value = spec / 10.0               # metallic
    bsdf.inputs[2].default_value = 0.45 / 4 * (10 - spec)    # roughness
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.filepath = os.path.join(out, f'{spec}.png')
    bpy.ops.render.render(write_still=True)
