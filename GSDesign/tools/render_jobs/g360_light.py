# GelSight360 light-configuration sweep (logic from the embedded "light_variation" script).
# usage: blender -b scene.blend -P g360_light.py -- OUTDIR CONF [CONF ...]   (CONF="all"/"allrev" -> every valid code)
# NO_CONTACT=1 renders the no-contact background of each configuration (for background subtraction).
# BASE=R|G|B overrides the base (lower) LEDs of all four arms with one colour; output files get a _b<colour> suffix.
# Without it the base takes the colour missing from the arm's pair, as in the paper's codes.
import bpy, os, sys, itertools
sys.path.insert(0, os.path.dirname(__file__))
from common import args, gpu, render

CONFMAP = {"RG": "RBG", "GR": "GBR", "RB": "RGB", "BR": "BGR", "BG": "BRG", "GB": "GRB"}
LIGHTMAP = {"G": "green", "R": "red", "B": "blue"}


def coating_mat(mat_ball, mat_coat):
    for num in range(8):
        bpy.data.objects["Indenter_" + str(num)].data.materials[0] = bpy.data.materials[mat_ball]
    bpy.data.objects["coating"].data.materials[0] = bpy.data.materials[mat_coat]


def apply_conf(conf):
    for i in range(4):
        sl = CONFMAP[conf[2 * i:2 * i + 2]]
        objs = ("light_%i l1_%i l2_%i l3_%i light_%i" % (2 * i + 1, i + 1, i + 1, i + 1, 2 * i + 2)).split()
        base = os.environ.get('BASE') or sl[1]
        mats = ("%s_up %s_down %s_down %s_down %s_up" % (LIGHTMAP[sl[0]], LIGHTMAP[base], LIGHTMAP[base],
                                                       LIGHTMAP[base], LIGHTMAP[sl[2]])).split()
        for o, m in zip(objs, mats):
            bpy.data.objects[o].data.materials[0] = bpy.data.materials[m]


def setup():
    s = bpy.context.scene
    s.view_settings.view_transform = 'Standard'
    s.view_settings.exposure = -0.5
    s.cycles.glossy_bounces = 4
    bpy.data.collections["script"].hide_render = False
    coating_mat('AL_coating', 'AL_coating')
    for k in range(8):
        bpy.data.objects["Indenter_" + str(k)].hide_render = os.environ.get('NO_CONTACT') == '1'


if __name__ == '__main__':
    a = args()
    out, confs = a[0], a[1:]
    if confs in (['all'], ['allrev']):  # "allrev": same set in reverse, for a second parallel worker
        confs = [''.join(p) for p in itertools.product(CONFMAP.keys(), repeat=4)][::1 if confs == ['all'] else -1]
    gpu(); setup()
    suffix = f"_b{os.environ['BASE']}" if os.environ.get('BASE') else ''
    for c in confs:
        if os.path.exists(os.path.join(out, c + suffix + '.png')):
            continue
        apply_conf(c)
        render(os.path.join(out, c + suffix))
