# Export evaluated, decimated meshes (+ area lights) as compact JSON for the three.js viewer.
# usage: blender -b scene.blend -P export_mesh.py -- OUT.json MAXFACES name[=alias] ...
# Scenes modelled in metres are written in millimetres (scale 1000) so 3-decimal rounding keeps detail.
import bpy, bmesh, json, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
out, maxf, names = a[0], int(a[1]), a[2:]
from mathutils import Matrix
k = 1000.0 if max(bpy.data.objects[n.split('=')[0]].dimensions.length for n in names) < 1 else 1.0
S = Matrix.Scale(k, 4)
dg = bpy.context.evaluated_depsgraph_get()
res = {'meshes': {}, 'lights': []}
for spec in names:
    name, alias = (spec.split('=') + [None])[:2]
    o = bpy.data.objects[name]
    ev = o.evaluated_get(dg)
    m = ev.to_mesh()
    bm = bmesh.new(); bm.from_mesh(m); ev.to_mesh_clear()
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    nf = len(bm.faces)
    if nf > maxf:
        tmp = bpy.data.meshes.new('tmp'); bm.to_mesh(tmp); bm.free()
        tobj = bpy.data.objects.new('tmp', tmp); bpy.context.scene.collection.objects.link(tobj)
        mod = tobj.modifiers.new('d', 'DECIMATE'); mod.ratio = maxf / nf
        dg.update(); e2 = tobj.evaluated_get(dg); m2 = e2.to_mesh()
        bm = bmesh.new(); bm.from_mesh(m2); e2.to_mesh_clear()
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mw = o.matrix_basis if o.parent is None else o.matrix_world
    res['meshes'][alias or name] = {
        'v': [round(c, 3) for v in bm.verts for c in (S @ mw @ v.co)],
        'f': [v.index for f in bm.faces for v in f.verts]}
    print('MESH', name, len(bm.verts), len(bm.faces))
    bm.free()
for o in bpy.data.objects:
    if o.type == 'LIGHT' and o.data.type == 'AREA':
        res['lights'].append({'name': o.name, 'coll': [c.name for c in o.users_collection],
                              'm': [round(x, 4) for r in (S @ o.matrix_basis) for x in r],
                              'size': [k * o.data.size, k * (o.data.size_y if o.data.shape in ('RECTANGLE', 'ELLIPSE') else o.data.size)],
                              'color': list(o.data.color)})
cam = bpy.context.scene.camera
res['camera'] = {'m': [round(x, 4) for r in (S @ cam.matrix_world) for x in r], 'fov': cam.data.angle}
json.dump(res, open(out, 'w'))
