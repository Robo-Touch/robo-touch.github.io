# Render the whole "Build your own sensor" grid (tools/render_server/custom_grid.py) with the procedural builder.
# usage: blender -b --factory-startup -P custom_grid_job.py -- OUTDIR WORKER NWORKERS
import bpy, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'render_server'))
from common import args, gpu
import custom_grid, sensor_builder

out, worker, n = args()[0], int(args()[1]), int(args()[2])
os.makedirs(out, exist_ok=True)
gpu()
jobs = [(i, c) for i in custom_grid.all_indices() for c in custom_grid.CONTACTS]
for k, (idx, contact) in enumerate(jobs):
    if k % n != worker:
        continue
    path = os.path.join(out, custom_grid.name(idx, contact) + '.png')
    if os.path.exists(path):
        continue
    sensor_builder.build(custom_grid.params(idx, contact))
    gpu()  # build() resets the scene; keep the GPU device
    s = bpy.context.scene
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGB'
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if k % 200 == worker:
        print('PROGRESS', k, len(jobs), flush=True)
