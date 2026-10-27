// Thin three.js wrapper: lazy init when visible, Blender z-up -> three y-up, orbit + gentle auto-rotate.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

export function geometryFrom(v, f) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(f);
  g.computeVertexNormals();
  return g;
}

export class Viewer {
  constructor(host, { autoRotate = true, env = true } = {}) {
    this.host = host;
    host.__viewer = this; // handy for debugging from devtools
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    if (env) {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    }
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    this.makeControls(autoRotate);
    // Blender is z-up; everything added to `root` keeps Blender coordinates
    this.root = new THREE.Group();
    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x202530, 0.6));
    this.tickers = [];
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.visible = false;
    new IntersectionObserver(([e]) => (this.visible = e.isIntersecting)).observe(host);
    this.renderer.setAnimationLoop((t) => {
      if (!this.visible) return;
      for (const fn of this.tickers) fn(t);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  /** frame the given objects (or root) from a direction given in three's y-up space */
  frame(objs = [this.root], dir = new THREE.Vector3(1, 0.7, 1.2), pad = 1.25) {
    const box = new THREE.Box3();
    this.root.updateMatrixWorld(true);
    objs.forEach((o) => box.expandByObject(o));
    const c = box.getCenter(new THREE.Vector3()), r = box.getBoundingSphere(new THREE.Sphere()).radius;
    const d = (r * pad) / Math.sin((this.camera.fov * Math.PI) / 360);
    this.camera.position.copy(c).addScaledVector(dir.normalize(), d);
    this.camera.near = d / 100; this.camera.far = d * 10;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.controls.update();
  }
  onTick(fn) { this.tickers.push(fn); }
  // OrbitControls caches camera.up when constructed, so they are rebuilt whenever the up vector changes
  makeControls(autoRotate) {
    this.controls?.dispose();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = autoRotate;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.enableZoom = true;
    this.controls.addEventListener('start', () => (this.controls.autoRotate = false));
  }
  /** look at objs the way a Blender camera does (m: its 4x4 world matrix, row-major), tilted by `tilt` degrees
   *  about the image's horizontal axis so depth stays visible; screen-up matches the camera's image-up */
  alignToBlenderCamera(m, objs, pad = 1.1, tilt = 18) {
    const col = (i) => new THREE.Vector3(m[i], m[4 + i], m[8 + i]);
    this.alignAxes(col(0), col(1), objs, pad, tilt);
  }
  /** view with screen-right / screen-up along the given Blender-space directions (tilted as above) */
  alignAxes(rightB, upB, objs, pad = 1.1, tilt = 18) {
    const toThree = (v) => new THREE.Vector3(v.x, v.z, -v.y).normalize();
    const right = toThree(rightB), up0 = toThree(upB), a = (-tilt * Math.PI) / 180;
    const back = right.clone().cross(up0).normalize().applyAxisAngle(right, a);   // points toward the viewer
    this.camera.up.copy(up0.applyAxisAngle(right, a));
    this.makeControls(false);
    this.frame(objs, back, pad);
  }
}

/** tiny tween helper: animate(ms, t => ...) with ease-in-out */
export function animate(ms, step, done) {
  const t0 = performance.now();
  const frame = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    step(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    if (k < 1) requestAnimationFrame(frame); else done?.();
  };
  requestAnimationFrame(frame);
}
