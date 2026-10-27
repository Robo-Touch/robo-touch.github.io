"""Live render server for the page (runs inside headless Blender on the GPU machine).

  custom sensor:  blender -b --factory-startup -P server.py -- custom 8767
  GelBelt lights: blender -b roller_sim3.blend -P server.py -- belt 8766

Binds to 127.0.0.1 only; reach it through an SSH tunnel:  ssh -N -L 8766:localhost:8766 -L 8767:localhost:8767 sigma
POST /render  (JSON params)  ->  {"png": <base64>, "ms": <render ms>, "cached": bool}
GET  /health                 ->  {"ok": true, "kind": ...}
Single-threaded on purpose: every request is handled on Blender's main thread, where bpy is safe to call.
"""
import base64, hashlib, json, os, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'render_jobs'))
from common import gpu  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
KIND, PORT = argv[0], int(argv[1])
CACHE = os.path.join('/tmp/optisense/cache', KIND)
os.makedirs(CACHE, exist_ok=True)

if KIND == 'custom':
    import sensor_builder

    def build(params):
        sensor_builder.build(params)
else:
    import belt_basis as belt

    HOME = belt.setup()
    BASE_ENERGY = {k: bpy.data.objects[v[0]].data.energy for k, v in belt.BARS.items()}
    CONTACTS = {'none': [], 'screw': ['screw'], 'breadboard': ['protoboard'], 'rack': ['rack'],
                **{f'sph{i}': [f'sph{i}'] for i in range(1, 10)}}

    def build(params):
        belt.set_contact(CONTACTS.get(params.get('contact', 'sph5'), []))
        for key, (name, *_) in belt.BARS.items():
            l = params.get('lights', {}).get(key, {})
            o = bpy.data.objects[name]
            o.matrix_world = HOME[key]
            if 'height' in l:
                belt.pose(o, key, float(l['height']), float(l.get('tilt', 0)))
            o.data.energy = BASE_ENERGY[key] * float(l.get('power', 1.0))
            o.hide_render = float(l.get('power', 1.0)) <= 0


def render(params):
    key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
    path = os.path.join(CACHE, key + '.png')
    if os.path.exists(path):
        return path, 0, True
    t = time.time()
    build(params)
    bpy.context.view_layer.update()
    s = bpy.context.scene
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGB'
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path, int((time.time() - t) * 1000), False


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # lets an https page (e.g. GitHub Pages) call this localhost server through the SSH tunnel (Chrome PNA)
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        self._send(200, {'ok': True, 'kind': KIND}) if self.path.startswith('/health') else self._send(404, {})

    def do_POST(self):
        if not self.path.startswith('/render'):
            return self._send(404, {})
        try:
            params = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
            path, ms, cached = render(params)
            with open(path, 'rb') as f:
                self._send(200, {'png': base64.b64encode(f.read()).decode(), 'ms': ms, 'cached': cached})
        except Exception as e:  # report to the page instead of killing the server
            self._send(500, {'error': repr(e)})

    def log_message(self, fmt, *a):
        sys.stderr.write('[%s] %s\n' % (KIND, fmt % a))


gpu()
print(f'serving {KIND} on 127.0.0.1:{PORT}', flush=True)
HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
