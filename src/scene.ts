import * as THREE from 'three';
import { helio } from './ephemeris';

export const PLANET_DEF = [
  { id: 'Mercury', nombre: 'Mercurio', a: 0.387, size: 0.55, color: '#a9a39b', tilt: 0.03, spin: 0.4, tex: 'rock' },
  { id: 'Venus', nombre: 'Venus', a: 0.723, size: 0.95, color: '#e3c08a', tilt: 3.1, spin: -0.2, tex: 'haze' },
  { id: 'Earth', nombre: 'Tierra', a: 1.0, size: 1.0, color: '#4f86c6', tilt: 0.41, spin: 1.6, tex: 'earth' },
  { id: 'Mars', nombre: 'Marte', a: 1.524, size: 0.7, color: '#c4694a', tilt: 0.44, spin: 1.5, tex: 'rock' },
  { id: 'Jupiter', nombre: 'Júpiter', a: 5.203, size: 2.6, color: '#d1a97a', tilt: 0.05, spin: 2.6, tex: 'bands' },
  { id: 'Saturn', nombre: 'Saturno', a: 9.537, size: 2.2, color: '#dcc592', tilt: 0.47, spin: 2.3, tex: 'bands', ring: true },
  { id: 'Uranus', nombre: 'Urano', a: 19.19, size: 1.5, color: '#9bd0d6', tilt: 1.7, spin: -1.4, tex: 'haze' },
  { id: 'Neptune', nombre: 'Neptuno', a: 30.07, size: 1.45, color: '#4a6fd0', tilt: 0.5, spin: 1.4, tex: 'haze' },
] as const;

export const scaleR = (au: number) => 6.5 * Math.pow(au, 0.55) + 2;

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function makeTexture(kind: string, color: string, seed: number, size = 512) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const g = c.getContext('2d')!;
  const r = rng(seed * 997 + 13);
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  if (kind === 'bands') {
    for (let y = 0; y < c.height; y += 3) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,240,220' : '70,40,20'},${0.05 + r() * 0.16})`;
      g.fillRect(0, y, c.width, 2 + r() * 8);
    }
  } else if (kind === 'earth') {
    g.fillStyle = '#2a5da0'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${70 + r() * 40},${120 + r() * 50},${60 + r() * 30},0.9)`;
      g.beginPath(); g.ellipse(r() * c.width, 30 + r() * (c.height - 60), 10 + r() * 38, 6 + r() * 20, r() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.ellipse(r() * c.width, r() * c.height, 16 + r() * 50, 3 + r() * 6, 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(240,248,255,.9)'; g.fillRect(0, 0, c.width, 10); g.fillRect(0, c.height - 10, c.width, 10);
  } else {
    for (let i = 0; i < (kind === 'rock' ? 90 : 25); i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.1})`;
      g.beginPath(); g.ellipse(r() * c.width, r() * c.height, 8 + r() * 40, 4 + r() * 20, r() * 3, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(0.25, 'rgba(255,200,110,.45)'); gr.addColorStop(1, 'rgba(255,180,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

export interface PlanetObj { def: (typeof PLANET_DEF)[number]; mesh: THREE.Mesh; group: THREE.Group; radius: number }

export class Orrery {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  planets: PlanetObj[] = [];
  sun!: THREE.Mesh;
  stars: THREE.Points[] = [];
  moon!: THREE.Mesh;
  baseDate = new Date();
  dayOffset = 0;
  /** control de cámara */
  cam = { pos: new THREE.Vector3(0, 150, 1), target: new THREE.Vector3() };
  mode: 'hero' | 'scroll' | 'focus' = 'hero';
  scrollP = 0;
  mouse = new THREE.Vector2();
  idleOrbit = 0;
  focused: PlanetObj | null = null;
  running = true;
  frozen = false;
  mobile: boolean;
  private last = performance.now();
  private ray = new THREE.Raycaster();
  private t = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.mobile = matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2));
    this.renderer.setClearColor(0x05060f, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 2000);
    this.scene.fog = new THREE.FogExp2(0x05060f, 0.0016);
    this.build();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private build() {
    const s = this.scene;
    s.add(new THREE.AmbientLight(0x2a2f5a, 0.9));
    const sunLight = new THREE.PointLight(0xfff0cf, 6, 0, 0.6);
    s.add(sunLight);
    // Sol
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 48, 48),
      new THREE.MeshBasicMaterial({ map: makeTexture('haze', '#f5b948', 5), color: 0xffe2a0 }),
    );
    s.add(this.sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    glow.scale.setScalar(22);
    this.sun.add(glow);

    // Planetas + órbitas
    PLANET_DEF.forEach((d, i) => {
      const radius = d.size * 0.55;
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ map: makeTexture(d.tex, d.color, i + 1), roughness: 0.85, metalness: 0 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 40), mat);
      mesh.rotation.z = d.tilt;
      group.add(mesh);
      if ('ring' in d && d.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius * 1.35, radius * 2.3, 96),
          new THREE.MeshBasicMaterial({ color: 0xd9c9a0, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }),
        );
        ring.rotation.x = Math.PI / 2 - 0.1 + d.tilt * 0.3;
        group.add(ring);
      }
      if (d.id === 'Earth') {
        const atm = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 32, 32), new THREE.MeshBasicMaterial({ color: 0x7fb3ff, transparent: true, opacity: 0.16, side: THREE.BackSide }));
        group.add(atm);
        this.moon = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.27, 20, 20), new THREE.MeshStandardMaterial({ color: 0xd8dbe6, roughness: 1 }));
        group.add(this.moon);
      }
      s.add(group);
      this.planets.push({ def: d, mesh, group, radius });

      const pts: THREE.Vector3[] = [];
      const rr = scaleR(d.a);
      for (let k = 0; k < 256; k++) pts.push(new THREE.Vector3(Math.cos((k / 256) * Math.PI * 2) * rr, 0, Math.sin((k / 256) * Math.PI * 2) * rr));
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.38 }));
      s.add(orbit);
    });

    // Estrellas (2 capas para parallax)
    const n = this.mobile ? 1400 : 4200;
    for (let layer = 0; layer < 2; layer++) {
      const g = new THREE.BufferGeometry();
      const count = layer === 0 ? n : Math.floor(n / 3);
      const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count);
      const rnd = rng(42 + layer);
      for (let i = 0; i < count; i++) {
        const r = 380 + rnd() * (layer === 0 ? 500 : 200), th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
        pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
        const warm = rnd();
        const c = new THREE.Color().setHSL(warm > 0.7 ? 0.12 : 0.62, 0.4, 0.75 + rnd() * 0.25);
        col.set([c.r, c.g, c.b], i * 3);
        sz[i] = (layer === 0 ? 1.1 : 2.4) * (0.5 + rnd());
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
        uniforms: { uT: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: `attribute float size; varying vec3 vC; varying float vT; uniform float uT; uniform float uPx;
          void main(){ vC=color; vT=0.65+0.35*sin(uT*1.4+position.x*0.37+position.y*0.11);
          vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uPx*(1.0+0.0*mv.z); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying vec3 vC; varying float vT; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vC,a*vT); }`,
      });
      const p = new THREE.Points(g, m);
      this.stars.push(p);
      s.add(p);
    }
    this.setDate(new Date());
  }

  setDate(d: Date, offsetDays = 0) {
    this.baseDate = d;
    this.dayOffset = offsetDays;
    this.place();
  }

  private place() {
    const date = new Date(this.baseDate.getTime() + this.dayOffset * 86400000);
    for (const p of this.planets) {
      const h = helio(p.def.id, date);
      const rr = scaleR(p.def.a);
      const a = (h.lon * Math.PI) / 180;
      p.group.position.set(Math.cos(a) * rr, 0, -Math.sin(a) * rr);
    }
  }

  planet(id: string) { return this.planets.find((p) => p.def.id === id)!; }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 62 : 48;
    this.camera.updateProjectionMatrix();
  }

  heroPose(t: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const ang = this.idleOrbit + t * 0.02;
    const R = this.mobile ? 78 : 62;
    return { pos: new THREE.Vector3(Math.sin(ang) * R * 0.35, 30 + Math.sin(t * 0.15) * 3, Math.cos(ang) * R), target: new THREE.Vector3(0, 0, 0) };
  }

  /** Pose de cámara para el viaje por scroll (0..1) */
  scrollPose(p: number): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const order = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Neptune', 'Earth'];
    const stops = [{ over: true as const }, ...order.map((id) => ({ id }))];
    const f = Math.min(Math.max(p, 0), 0.9999) * (stops.length - 1);
    const i = Math.floor(f);
    const k = f - i;
    const e = k * k * (3 - 2 * k);
    const poseOf = (s: (typeof stops)[number]) => {
      if ('over' in s) return this.heroPose(this.t);
      const pl = this.planet(s.id);
      const pos = pl.group.position.clone();
      const out = pos.clone().normalize();
      if (!out.lengthSq()) out.set(1, 0, 0);
      const dist = pl.radius * (s.id === 'Earth' ? 2.6 : 5.5);
      const tan = new THREE.Vector3(-out.z, 0, out.x);
      // de costado y algo hacia el Sol, para ver la cara iluminada
      return { pos: pos.clone().add(tan.multiplyScalar(dist * 0.9)).add(out.multiplyScalar(-dist * 0.45)).add(new THREE.Vector3(0, pl.radius * 1.2, 0)), target: pos };
    };
    const a = poseOf(stops[i]), b = poseOf(stops[Math.min(i + 1, stops.length - 1)]);
    return { pos: a.pos.clone().lerp(b.pos, e), target: a.target.clone().lerp(b.target, e) };
  }

  focusPlanet(pl: PlanetObj | null) {
    this.focused = pl;
    this.mode = pl ? 'focus' : 'hero';
  }

  pick(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hits = this.ray.intersectObjects(this.planets.map((p) => p.mesh), false);
    return hits.length ? this.planets.find((p) => p.mesh === hits[0].object) ?? null : null;
  }

  private smoothPos = new THREE.Vector3(0, 150, 1);
  private smoothTarget = new THREE.Vector3();
  onFrame?: (dt: number) => void;
  /** nombre del planeta más cercano durante el viaje */
  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.t += dt;
      this.tick(dt);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  tick(dt: number) {
    for (const s of this.stars) (s.material as THREE.ShaderMaterial).uniforms.uT.value = this.t;
    this.stars[0].rotation.y += dt * 0.002;
    this.stars[1].rotation.y -= dt * 0.004;
    this.sun.rotation.y += dt * 0.05;
    // traslación en vivo: el tiempo corre lento en el hero para que se note
    if (this.mode !== 'scroll' && !this.frozen) this.dayOffset += dt * 6;
    this.place();
    for (const p of this.planets) p.mesh.rotation.y += dt * p.def.spin * 0.6;
    const earth = this.planet('Earth');
    if (this.moon) { const a = this.t * 0.9; this.moon.position.set(Math.cos(a) * earth.radius * 2.1, 0, Math.sin(a) * earth.radius * 2.1); }

    let pose: { pos: THREE.Vector3; target: THREE.Vector3 };
    if (this.mode === 'scroll') pose = this.scrollPose(this.scrollP);
    else if (this.mode === 'focus' && this.focused) {
      const pl = this.focused, c = pl.group.position;
      const out = c.clone().normalize();
      pose = { pos: c.clone().add(out.multiplyScalar(pl.radius * 5.5)).add(new THREE.Vector3(0, pl.radius * 1.5, 0)), target: c.clone() };
    } else pose = this.heroPose(this.t);

    const k = this.mode === 'scroll' ? 1 - Math.pow(0.0005, dt) : 1 - Math.pow(0.04, dt);
    this.smoothPos.lerp(pose.pos, k);
    this.smoothTarget.lerp(pose.target, k);
    this.camera.position.copy(this.smoothPos);
    // parallax del cursor
    this.camera.position.x += this.mouse.x * 2.2;
    this.camera.position.y += this.mouse.y * 1.4;
    this.camera.lookAt(this.smoothTarget);
    this.onFrame?.(dt);
  }

  /** Salta la cámara de entrada: empieza desde muy arriba, sobre el centro. */
  snapCamera(pos: THREE.Vector3, target = new THREE.Vector3()) {
    this.smoothPos.copy(pos);
    this.smoothTarget.copy(target);
  }
  get time() { return this.t; }
  get pose() { return this.smoothPos; }
  set smooth(v: number) { this.smoothPos.y = v; }
}
