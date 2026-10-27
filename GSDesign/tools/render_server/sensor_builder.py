"""Procedural GelSight-style sensor for the "Make your own sensor" panel (units: mm, z up).

Stack, bottom to top:  camera (below)  |  acrylic support  |  silicone elastomer  |  opaque coating (gel top)
Three shaped surfaces, each flat / cylindrical / spherical with its own crown (sagitta, mm; > 0 convex, < 0 concave):
  acrylic   - bottom face of the acrylic, bulging down toward the camera (a lens)
  interface - acrylic/silicone boundary, bulging up into the silicone
  gel       - the coated sensing surface: z = acrylic thickness + silicone thickness + crown - min(0, crown_centre),
              i.e. the silicone thickness is the thinnest silicone above a flat interface for convex and concave
              coatings alike (the interface crown is capped so it stays below the coating)
Indenters are spheres pressed INDENT_D deep at their contact site; the coating follows the sphere inside the contact.
Optical surfaces follow the OptiSense modelling: each interface is a surface with a dielectric BSDF whose IOR is the
ratio of the media on its two sides (normal points out of the denser/inside medium), and the coating is an opaque
RoughConductor stand-in (Principled: metallic = s, roughness = 0.1125 (10 - 10 s), as in the paper's Cycles scenes).

The same geometry is re-built in the browser (assets/js/custom.js for the 3D preview, assets/js/pathtracer.js for the
in-browser path tracer); keep the three in sync.
"""
import math
import bpy

W, D = 22.0, 16.0            # sensing footprint (x, y)
NX, NY = 176, 128            # grid resolution of the curved surfaces
N_ACR, N_SIL = 1.49, 1.41    # acrylic, PDMS
INDENT_R, INDENT_D = 1.5, 0.5  # paper default indenter radius; press depth
COLORS = {'R': (1, 0.05, 0.02), 'G': (0.05, 1, 0.1), 'B': (0.05, 0.25, 1)}

DEFAULTS = {
    'spec': 0.2, 'exposure': 0.0, 'contact': 'grid',
    'gel': {'shape': 'flat', 'height': 0.0, 'thickness': 1.5},
    'interface': {'shape': 'flat', 'height': 0.0},
    'acrylic': {'shape': 'flat', 'height': 0.0, 'thickness': 3.0},
    'camera': {'distance': 16.0, 'tilt': 0.0, 'fov': 70.0},
    'lights': [
        {'color': 'R', 'side': 'left', 'height': 1.5, 'tilt': 0.0, 'size': 10.0, 'power': 1.0},
        {'color': 'G', 'side': 'bottom', 'height': 1.5, 'tilt': 0.0, 'size': 10.0, 'power': 1.0},
        {'color': 'B', 'side': 'right', 'height': 1.5, 'tilt': 0.0, 'size': 10.0, 'power': 1.0},
    ],
}


def merged(p):
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in (p or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k].update(v)
        else:
            out[k] = v
    return out


def crown(shape, h, x, y):
    """sagitta-h cap over the footprint: 'cyl' is a circular arc across x (0 on the two x edges, constant along y);
    'sph' is a true spherical cap whose rim passes through the four corners (no flat region, no crease)"""
    if shape == 'flat' or abs(h) <= 1e-6:
        return 0.0
    if h < 0:                                   # concave: mirror image of the convex cap
        return -crown(shape, -h, x, y)
    if shape == 'cyl':
        c2, r2 = (W / 2) ** 2, x * x
    else:
        c2, r2 = (W / 2) ** 2 + (D / 2) ** 2, x * x + y * y
    R = (h * h + c2) / (2 * h)
    return math.sqrt(max(0.0, R * R - r2)) - (R - h)


def indents(contact):
    if contact == 'none':
        return []
    if contact == 'center':
        return [(0.0, 0.0)]
    return [(x, y) for y in (-4.5, 0.0, 4.5) for x in (-6.0, 0.0, 6.0)]


def top_crown_z(p, x, y):
    g = p['gel']
    return p['acrylic']['thickness'] + g['thickness'] + crown(g['shape'], g['height'], x, y) - min(0.0, g['height'])


def indenter_centres(p):
    """sphere centres, pressed INDENT_D below the undeformed coating at each contact site"""
    return [(cx, cy, top_crown_z(p, cx, cy) + INDENT_R - INDENT_D) for cx, cy in indents(p['contact'])]


def interface_height(p):
    """interface crown, reduced if needed so the interface stays >= 0.25 mm below the coating"""
    h = p['interface']['height']
    pts = [(-W / 2 + W * i / 8, -D / 2 + D * j / 8) for i in range(9) for j in range(9)]
    while h > 0 and min(top_crown_z(p, x, y) - p['acrylic']['thickness'] - crown(p['interface']['shape'], h, x, y)
                        for x, y in pts) < 0.25:
        h = max(0.0, h - 0.05)
    return h


def bottom_z(p, x, y):
    return -crown(p['acrylic']['shape'], p['acrylic']['height'], x, y)


def interface_z(p, x, y):
    return p['acrylic']['thickness'] + crown(p['interface']['shape'], p['_ih'], x, y)


def gel_z(p, x, y, pts):
    z = top_crown_z(p, x, y)
    for cx, cy, cz in pts:
        r2 = (x - cx) ** 2 + (y - cy) ** 2
        if r2 < INDENT_R ** 2:
            z = min(z, cz - math.sqrt(INDENT_R ** 2 - r2))
    return z


def grid_mesh(name, zfun, flip=False):
    xs = [-W / 2 + W * i / NX for i in range(NX + 1)]
    ys = [-D / 2 + D * j / NY for j in range(NY + 1)]
    verts = [(x, y, zfun(x, y)) for y in ys for x in xs]
    faces = []
    for j in range(NY):
        for i in range(NX):
            a = j * (NX + 1) + i
            q = (a, a + 1, a + NX + 2, a + NX + 1)
            faces.append(q[::-1] if flip else q)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.shade_smooth() if hasattr(me, 'shade_smooth') else [setattr(f, 'use_smooth', True) for f in me.polygons]
    return me


def wall_mesh(name, lo, hi, n=64):
    """four side walls between z=lo(x,y) and z=hi(x,y) along the footprint boundary, normals outward"""
    verts, faces = [], []
    edges = [((-W / 2, -D / 2), (W / 2, -D / 2)), ((W / 2, -D / 2), (W / 2, D / 2)),
             ((W / 2, D / 2), (-W / 2, D / 2)), ((-W / 2, D / 2), (-W / 2, -D / 2))]
    for (x0, y0), (x1, y1) in edges:
        base = len(verts)
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            verts += [(x, y, lo(x, y)), (x, y, hi(x, y))]
        for k in range(n):
            a = base + 2 * k
            faces.append((a, a + 2, a + 3, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    return me


def glass(name, ior):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    g = nt.nodes.new('ShaderNodeBsdfGlass')
    g.inputs['IOR'].default_value = ior
    g.inputs['Roughness'].default_value = 0.0
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(g.outputs[0], o.inputs[0])
    return m


def coating(spec):
    m = bpy.data.materials.new('coating')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    b.inputs['Metallic'].default_value = spec
    b.inputs['Roughness'].default_value = min(1.0, 0.1125 * (10 - 10 * spec))
    return m


def light_pose(l, p):
    """(location, rotation_euler) of an LED bar on a side of the footprint; tilt rotates it to aim up at the gel"""
    off = 0.8
    side, h, t = l['side'], l['height'], math.radians(l['tilt'])
    if side == 'left':
        loc, inward, along = (-W / 2 - off, 0, h), (1, 0, 0), (0, 1, 0)
    elif side == 'right':
        loc, inward, along = (W / 2 + off, 0, h), (-1, 0, 0), (0, 1, 0)
    elif side == 'bottom':
        loc, inward, along = (0, -D / 2 - off, h), (0, 1, 0), (1, 0, 0)
    else:
        loc, inward, along = (0, D / 2 + off, h), (0, -1, 0), (1, 0, 0)
    d = tuple(inward[i] * math.cos(t) + (0, 0, 1)[i] * math.sin(t) for i in range(3))
    return loc, d, along


def build(params):
    from mathutils import Vector, Matrix
    p = merged(params)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for b in list(coll):
            coll.remove(b)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    s = bpy.context.scene
    col = s.collection
    p['_ih'] = interface_height(p)
    pts = indenter_centres(p)

    def add(name, me, mat):
        me.materials.append(mat)
        o = bpy.data.objects.new(name, me)
        col.objects.link(o)
        return o

    acr = glass('acrylic', N_ACR)
    add('acrylic_bottom', grid_mesh('acr_bot', lambda x, y: bottom_z(p, x, y), flip=True), acr)
    add('acrylic_walls', wall_mesh('acr_wall', lambda x, y: bottom_z(p, x, y), lambda x, y: interface_z(p, x, y)), acr)
    add('interface', grid_mesh('iface', lambda x, y: interface_z(p, x, y), flip=True), glass('interface', N_SIL / N_ACR))
    add('silicone_walls', wall_mesh('sil_wall', lambda x, y: interface_z(p, x, y), lambda x, y: gel_z(p, x, y, pts)),
        glass('silicone', N_SIL))
    add('coating', grid_mesh('gel', lambda x, y: gel_z(p, x, y, pts)), coating(p['spec']))

    for i, l in enumerate(p['lights']):
        if l.get('power', 1) <= 0:
            continue
        ld = bpy.data.lights.new(f'L{i}', 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = l['size'], 1.2
        ld.color = COLORS[l['color']]
        ld.energy = 1500.0 * l.get('power', 1.0) * l['size'] / 10
        lo = bpy.data.objects.new(f'L{i}', ld)
        col.objects.link(lo)
        loc, d, along = light_pose(l, p)
        z = -Vector(d).normalized()
        x = Vector(along)
        m = Matrix((x, z.cross(x), z)).transposed().to_4x4()
        m.translation = Vector(loc)
        lo.matrix_world = m

    cd = bpy.data.cameras.new('cam')
    cd.angle = math.radians(p['camera']['fov'])
    cd.clip_start, cd.clip_end = 0.1, 500
    cam = bpy.data.objects.new('cam', cd)
    col.objects.link(cam)
    cam.location = (0, 0, -p['camera']['distance'])
    cam.rotation_euler = (math.pi + math.radians(p['camera']['tilt']), 0, 0)   # look up +z
    s.camera = cam

    s.render.engine = 'CYCLES'
    s.cycles.samples = 96
    s.cycles.use_denoising = True
    s.cycles.sample_clamp_indirect = 10
    s.cycles.max_bounces, s.cycles.glossy_bounces, s.cycles.transmission_bounces = 16, 4, 16
    s.cycles.caustics_refractive = s.cycles.caustics_reflective = True
    s.render.resolution_x, s.render.resolution_y = p.get('resolution', (320, 240))
    s.render.resolution_percentage = 100
    s.view_settings.view_transform = 'Standard'
    s.view_settings.exposure = p['exposure']
    if not s.world:
        s.world = bpy.data.worlds.new('world')
    s.world.use_nodes = True
    s.world.node_tree.nodes['Background'].inputs[0].default_value = (0, 0, 0, 1)
    return p
