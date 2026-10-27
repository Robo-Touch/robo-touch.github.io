import bpy, os, sys, time


def args():
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == kind
                break
        except TypeError:
            continue
    s = bpy.context.scene
    s.cycles.device = 'GPU'
    print('GPU:', prefs.compute_device_type, [d.name for d in prefs.devices if d.use])


def render(path_noext, exr=True, png=True):
    """Render once; save PNG (view transform applied) and EXR (linear) from the same result."""
    s = bpy.context.scene
    os.makedirs(os.path.dirname(path_noext), exist_ok=True)
    t = time.time()
    bpy.ops.render.render()
    img = bpy.data.images['Render Result']
    if png:
        s.render.image_settings.file_format = 'PNG'
        s.render.image_settings.color_mode = 'RGB'
        img.save_render(path_noext + '.png', scene=s)
    if exr:
        s.render.image_settings.file_format = 'OPEN_EXR'
        s.render.image_settings.color_mode = 'RGB'
        img.save_render(path_noext + '.exr', scene=s)
    print(f'RENDERED {path_noext} in {time.time() - t:.1f}s', flush=True)


def set_lattice(name, params):
    pts = bpy.data.objects[name].data.points
    assert len(pts) == len(params)
    for p, v in zip(pts, params):
        p.co_deform = v


def load_cage(d):
    import numpy as np
    lo = np.loadtxt(os.path.join(d, 'shape_min.txt'), delimiter=',', skiprows=1)
    hi = np.loadtxt(os.path.join(d, 'shape_max.txt'), delimiter=',', skiprows=1)
    return lo, hi
