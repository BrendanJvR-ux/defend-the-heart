// The 3D view of an organ: the same game state the 2D map draws, in three dimensions. It only reads the state;
// the rules stay in sim.ts. Used by the main game (its 3D view) and by the play3d prototype page.
//
// Map units (1600 × 1000) become world units at K = 0.01: the board is 16 × 10, x to the right, z towards the viewer.
// - the paper: the level's own inked background
// - the organ: its inked drawing raised into relief (height from distance inside its outline), cel-shaded
// - vessels: glass-walled tubes along each route's course, red cells drifting inside; they swell and turn blue when
//   dilated
// - pathogens and white cells: 3D models travelling inside the vessels; bosses: the game's drawing, standing up
// - lymph nodes: cel-shaded beans with ink outlines, a stalk to their vessel and their letter on a badge
// - kills pop; the organ flushes when hit; floating words and vessel names are drawn over the view
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG, type LevelDef, type NodeType, type PathogenType, type VesselId } from '../config';
import * as map from '../level';
import { W, H } from '../level';
import { type State, pathogenPos, cellPos, levelDef } from '../sim';
import { organArt, paperArt, drawPathogen, vesselWidth, NODE_COLORS } from '../draw';
import { lin, ramp, toon, inked, pathogenModel, whiteCellModel, redCellGeometry, nodeModel, pathogenColour } from './models';

export const K = 0.01;
/** A vessel's tube radius in the world, from its width on the map: a dilated vessel swells, but a little less than
 *  on the flat map, so it never folds over itself in a tight bend. */
const tubeR = (w: number) => (Math.min(w, 30 + (w - 30) * 0.7) / 2) * K * 1.15;
export const toWorld = (x: number, y: number, h = 0) => new THREE.Vector3((x - W / 2) * K, h, (y - H / 2) * K);
export const toMap = (v: THREE.Vector3) => ({ x: v.x / K + W / 2, y: v.z / K + H / 2 });
const FLAT = 0.85; // vessels are nearly round, resting on the paper

/** What the scene needs to know about the player's view of the game (hover, selection, the tutorial's pointer). */
export interface View3D { hoverSite?: string | null; selectedSite?: string | null; coachAt?: { x: number; y: number } | null; inspectId?: number | null }

/** A paper cut-out of one of the game's drawings, standing up and facing the camera (bosses, letters). */
const cutouts = new Map<string, THREE.SpriteMaterial>();
function cutout(key: string, draw: (x: CanvasRenderingContext2D) => void) {
  let m = cutouts.get(key);
  if (!m) {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = new THREE.SpriteMaterial({ map: t, alphaTest: 0.35 }); cutouts.set(key, m);
  }
  return new THREE.Sprite(m);
}
const letterBadge = (type: NodeType) => cutout('letter-' + type, (x) => {
  x.fillStyle = '#f2e9d4'; x.beginPath(); x.arc(80, 80, 46, 0, Math.PI * 2); x.fill(); x.lineWidth = 6; x.strokeStyle = '#231a14'; x.stroke();
  x.fillStyle = '#231a14'; x.font = 'italic 700 64px Palatino, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(type === 'igm' ? 'M' : type === 'igg' ? 'G' : type === 'iga' ? 'A' : 'E', 80, 84);
});

/** The course of a route as world points, a fork's second branch from the fork, carried on into the organ. */
function coursePoints(v: VesselId, L: LevelDef) {
  const ves = map.VESSELS[v], first = map.routesOf(map.entryOf(v))[0] === v, from = first ? 0 : map.forkAt(v);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < ves.cx.length; i += 3) if (ves.length * (i / (ves.cx.length - 1)) >= from - 4) pts.push(toWorld(ves.cx[i], ves.cy[i]));
  const end = pts[pts.length - 1], c = toWorld(L.map.center.x, L.map.center.y);
  pts.push(end.clone().lerp(c, 0.35), end.clone().lerp(c, 0.55));
  return pts;
}

/** A glass tube along a route, whose radius changes (dilation) without rebuilding it. */
class Tube {
  readonly mesh: THREE.Mesh; readonly line: THREE.Mesh;
  private centres: Float32Array; private dirs: Float32Array; private r = -1;
  constructor(readonly pts: THREE.Vector3[], mat: THREE.Material, lineMat: THREE.Material, radial = 16) {
    const n = pts.length, vc = n * (radial + 1);
    this.centres = new Float32Array(vc * 3); this.dirs = new Float32Array(vc * 3);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = b.clone().sub(a).setY(0).normalize(), side = new THREE.Vector3(-t.z, 0, t.x);
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2, k = i * (radial + 1) + j;
        const d = side.clone().multiplyScalar(Math.cos(th)).add(new THREE.Vector3(0, Math.sin(th) * FLAT, 0));
        this.centres.set([pts[i].x, pts[i].y, pts[i].z], k * 3); this.dirs.set([d.x, d.y, d.z], k * 3);
        if (i < n - 1 && j < radial) { const a0 = k, b0 = k + radial + 1; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
      }
    }
    const make = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3)); g.setIndex(idx); return g; };
    this.mesh = new THREE.Mesh(make(), mat); this.mesh.renderOrder = 2;
    this.line = new THREE.Mesh(make(), lineMat); this.line.renderOrder = 1;
  }
  get radius() { return this.r; }
  setRadius(r: number) {
    if (Math.abs(r - this.r) < 0.0005) return;
    this.r = r;
    const p = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, q = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const P = p.array as Float32Array, Q = q.array as Float32Array, ro = r * 1.1 + 0.012;
    for (let i = 0; i < P.length; i += 3) {
      P[i] = this.centres[i] + this.dirs[i] * r; P[i + 1] = r * FLAT + this.dirs[i + 1] * r; P[i + 2] = this.centres[i + 2] + this.dirs[i + 2] * r;
      Q[i] = this.centres[i] + this.dirs[i] * ro; Q[i + 1] = r * FLAT + this.dirs[i + 1] * ro; Q[i + 2] = this.centres[i + 2] + this.dirs[i + 2] * ro;
    }
    p.needsUpdate = true; q.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere(); this.line.geometry.computeBoundingSphere();
  }
  /** A point a share `t` of the way along, offset across the tube by (u, v) in units of its radius. */
  at(t: number, u = 0, v = 0, out = new THREE.Vector3()) {
    const f = Math.max(0, Math.min(this.pts.length - 1.001, t * (this.pts.length - 1))), i = Math.floor(f), w = f - i;
    const a = this.pts[i], b = this.pts[i + 1];
    out.lerpVectors(a, b, w);
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    out.x += (-dz / l) * u * this.r; out.z += (dx / l) * u * this.r; out.y = this.r * FLAT + v * this.r * FLAT;
    return out;
  }
}

/** For each pixel of an N × N image, its distance (in pixels) inside the drawn shape to the outline; 0 outside. */
function reliefDistance(rgba: Uint8ClampedArray, N: number) {
  const d = new Float32Array(N * N), BIG = 1e6, A = 1, B = Math.SQRT2;
  for (let i = 0; i < N * N; i++) d[i] = rgba[i * 4 + 3] > 127 ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : d[y * N + x]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + A, at(x, y - 1) + A, at(x - 1, y - 1) + B, at(x + 1, y - 1) + B); }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + A, at(x, y + 1) + A, at(x + 1, y + 1) + B, at(x - 1, y + 1) + B); }
  return d;
}

interface Bug { obj: THREE.Object3D; size: number; boss: boolean; spin: number }

export class Board3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  readonly controls: OrbitControls;
  private overlay: HTMLCanvasElement;
  private builtFor: unknown = null;
  private board = new THREE.Group();
  private tubes = new Map<VesselId, { tube: Tube; mat: THREE.MeshToonMaterial; rbc: THREE.InstancedMesh; rbcT: Float32Array; rbcUV: Float32Array }>();
  private nodes = new Map<number, THREE.Group>();
  private sites = new Map<string, THREE.Object3D>();
  private bugs = new Map<number, Bug>();
  private cells = new Map<number, THREE.Object3D>();
  private shots: THREE.Mesh[] = [];
  private pops: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  private seenRings = new WeakSet<object>();
  private beads: { obj: THREE.Mesh; mat: THREE.MeshToonMaterial }[] = [];
  private organ: THREE.Mesh | null = null;
  private organMat: THREE.MeshToonMaterial | null = null;
  private wallMat = toon('#f0b4aa', { transparent: true, opacity: 0.5, depthWrite: false });
  private openMat = toon('#c4e6f4', { transparent: true, opacity: 0.45, depthWrite: false });
  private rimMat = new THREE.MeshBasicMaterial({ color: lin('#a0524a'), side: THREE.BackSide, transparent: true, opacity: 0.5, depthWrite: false });
  private rimOpenMat = new THREE.MeshBasicMaterial({ color: lin('#3a7a9a'), side: THREE.BackSide, transparent: true, opacity: 0.55, depthWrite: false });
  private hover: THREE.Mesh; private coach: THREE.Mesh; private target: THREE.Mesh;
  private clock = 0;
  private moved = false;
  private dummy = new THREE.Object3D();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.innerWidth < 900 ? 1.5 : 2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(lin('#d9ccb0'));
    const el = this.renderer.domElement; el.classList.add('board3d');
    host.prepend(el);
    // floating words and vessel names, drawn over the 3D view
    this.overlay = document.createElement('canvas'); this.overlay.className = 'board3d-overlay'; host.insertBefore(this.overlay, el.nextSibling);
    this.controls = new OrbitControls(this.camera, el);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 6, maxDistance: 24, minPolarAngle: 0.05, maxPolarAngle: 1.05, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9 });
    this.controls.target.set(0, 0, 0.4); this.camera.position.set(0, 14.2, 10.4);
    this.controls.addEventListener('start', () => { this.moved = true; });

    this.scene.add(new THREE.HemisphereLight(0xfff8ec, 0xc8b490, 1.55));
    const sun = new THREE.DirectionalLight(0xfff2de, 2.1);
    sun.position.set(-6, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8 }); sun.shadow.bias = -0.0006; sun.shadow.radius = 3;
    this.scene.add(sun);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: lin('#cdbd9c') }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.02; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.add(this.board);

    const ring = (col: string, r0: number, r1: number) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40), new THREE.MeshBasicMaterial({ color: lin(col), transparent: true, opacity: 0.9, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m); return m; };
    this.hover = ring('#e8a028', 0.3, 0.37); this.coach = ring('#e8a028', 0.42, 0.52); this.target = ring('#2f7fa0', 0.3, 0.36);
    new ResizeObserver(() => this.resize()).observe(host); this.resize();
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight, a = w / Math.max(1, h);
    this.renderer.setSize(w, h, false);
    const dpr = Math.min(2, window.devicePixelRatio || 1); this.overlay.width = Math.round(w * dpr); this.overlay.height = Math.round(h * dpr);
    this.overlay.style.width = `${w}px`; this.overlay.style.height = `${h}px`;
    this.camera.aspect = a; this.camera.fov = a < 1.2 ? 46 : a > 1.8 ? 30 : 34;
    // until the player turns the view: placed back just far enough for the whole board to fit the frame, looking down
    // more steeply on a wide, short screen (a phone held sideways)
    if (!this.moved) {
      const dir = new THREE.Vector3(0, a > 1.8 ? 18.2 : 14.2, a > 1.8 ? 6.4 : 10.4).normalize(), elev = Math.asin(dir.y);
      const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * a);
      const dist = Math.max(8.5 / Math.tan(hf / 2), (5.2 * Math.sin(elev) + 0.5) / Math.tan(vf / 2)) * 0.97;
      this.controls.target.set(0, 0, a > 1.8 ? 0.2 : 0.3);
      this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    }
    this.camera.updateProjectionMatrix();
  }
  /** Put the camera back where it starts. */
  resetView() { this.moved = false; this.resize(); }

  /** Everything that stays put for this map: paper, organ, vessels, sites, beads. */
  private build(s: State) {
    this.board.clear(); this.tubes.clear(); this.nodes.clear(); this.sites.clear(); this.beads = [];
    for (const b of this.bugs.values()) this.scene.remove(b.obj);
    for (const o of [...this.cells.values(), ...this.shots]) this.scene.remove(o);
    for (const p of this.pops) this.scene.remove(p.m);
    this.bugs.clear(); this.cells.clear(); this.shots = []; this.pops = [];
    const L: LevelDef = levelDef(s);
    this.builtFor = map.VESSELS;

    const pt = new THREE.CanvasTexture(paperArt(L)); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(W * K, H * K), new THREE.MeshLambertMaterial({ map: pt }));
    plate.rotation.x = -Math.PI / 2; plate.receiveShadow = true; this.board.add(plate);

    // the organ: its drawing raised into relief, each point by its distance inside the outline
    const art = organArt(L, 1.2), img = art.img, N = 200;
    const probe = document.createElement('canvas'); probe.width = probe.height = N;
    const pc = probe.getContext('2d', { willReadFrequently: true })!; pc.drawImage(img, 0, 0, N, N);
    const d = reliefDistance(pc.getImageData(0, 0, N, N).data, N), R = N * 0.2;
    const span = art.half * 2 * K, geo = new THREE.PlaneGeometry(span, span, N - 1, N - 1); geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute, peak = Math.min(L.map.rx, L.map.ry) * K * 0.6;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin((Math.min(1, d[i] / R) * Math.PI) / 2) * peak);
    geo.computeVertexNormals();
    const ot = new THREE.CanvasTexture(img); ot.colorSpace = THREE.SRGBColorSpace; ot.anisotropy = 8;
    this.organMat = new THREE.MeshToonMaterial({ map: ot, gradientMap: ramp, alphaTest: 0.5, side: THREE.DoubleSide });
    this.organ = new THREE.Mesh(geo, this.organMat);
    this.organ.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ot, alphaTest: 0.5 });
    this.organ.castShadow = true; this.organ.receiveShadow = true;
    this.organ.position.copy(toWorld(L.map.center.x, L.map.center.y)); this.organ.position.y = 0.01;
    this.board.add(this.organ);

    // vessels: glass tubes, red cells drifting inside them
    for (const v of map.VESSEL_IDS) {
      const pts = coursePoints(v, L), mat = this.wallMat;
      const tube = new Tube(pts, mat, this.rimMat);
      this.board.add(tube.line, tube.mesh);
      const n = Math.max(5, Math.round(map.VESSELS[v].length / 80));
      const rbc = new THREE.InstancedMesh(redCellGeometry, toon('#d0483f'), n); rbc.renderOrder = 1;
      const rbcT = new Float32Array(n), rbcUV = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { rbcT[i] = Math.random(); rbcUV.set([(Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 0.9, Math.random() * 6], i * 3); }
      this.board.add(rbc);
      this.tubes.set(v, { tube, mat, rbc, rbcT, rbcUV });
    }

    // empty build sites: a dashed ring with a cross on the paper
    for (const site of map.SITES) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: lin('#7a6a58'), transparent: true, opacity: 0.75 });
      for (let i = 0; i < 12; i++) g.add(new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 4, 1, (i / 12) * Math.PI * 2, Math.PI / 12), m));
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.04), m), bar2 = bar.clone(); bar2.rotation.z = Math.PI / 2; g.add(bar, bar2);
      g.rotation.x = -Math.PI / 2; g.position.copy(toWorld(site.x, site.y, 0.02));
      this.board.add(g); this.sites.set(site.id, g);
    }

    // health beads in a ring round the organ
    const n = L.hp, heart = L.id === 'heart', rx = heart ? 159 : L.map.rx + 50, ry = heart ? 159 : L.map.ry + 50;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, mat = toon('#d8615a');
      const g = inked(new THREE.SphereGeometry(0.085, 16, 10), mat, 0.2);
      g.position.copy(toWorld(L.map.center.x + Math.cos(a) * rx, L.map.center.y + 4 + Math.sin(a) * ry, 0.09));
      this.board.add(g); this.beads.push({ obj: g.children[1] as THREE.Mesh, mat });
    }
  }

  private makeNode(n: { type: NodeType; site: string }) {
    const site = map.siteById(n.site), g = new THREE.Group();
    g.add(nodeModel(n.type));
    const badge = letterBadge(n.type); badge.scale.setScalar(0.3); badge.position.y = 0.33; g.add(badge);
    g.position.copy(toWorld(site.x, site.y, 0.22));
    // a stalk of ink down to the vessel it guards
    const a = site.anchor ?? site, from = toWorld(site.x, site.y, 0.18), to = toWorld(a.x, a.y, 0.12);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, from.distanceTo(to), 6), new THREE.MeshBasicMaterial({ color: lin('#4a3a30') }));
    stalk.position.copy(from).add(to).multiplyScalar(0.5).sub(g.position); stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    g.add(stalk);
    return g;
  }

  private makeBug(type: PathogenType): Bug {
    const st = CONFIG.pathogens[type];
    if (st.boss) {
      const sp = cutout(type, (x) => drawPathogen(x, type, 80, 80, -Math.PI / 2, 0, 1.45)); sp.scale.set(1.6, 1.6, 1);
      return { obj: sp, size: 1.6, boss: true, spin: 0 };
    }
    return { obj: pathogenModel(type), size: 1, boss: false, spin: Math.random() * 6 };
  }

  /** Show the state as it is now. */
  update(s: State, dt: number, view: View3D = {}) {
    if (this.builtFor !== map.VESSELS || !this.organ) this.build(s);
    this.clock += dt;
    const L = levelDef(s);

    // vessels: width from dilation, glass blue when open, red cells drifting towards the organ
    for (const [v, t] of this.tubes) {
      const open = s.open.includes(v);
      t.tube.setRadius(tubeR(vesselWidth(s, v)));
      t.tube.mesh.material = open ? this.openMat : this.wallMat; t.tube.line.material = open ? this.rimOpenMat : this.rimMat;
      const n = t.rbcT.length, speed = (open ? 1.4 : 0.8) / Math.max(1, t.tube.pts.length * 0.03);
      for (let i = 0; i < n; i++) {
        t.rbcT[i] = (t.rbcT[i] + dt * speed * 0.05) % 0.97;
        t.tube.at(t.rbcT[i], t.rbcUV[i * 3] * 0.8, t.rbcUV[i * 3 + 1] * 0.8, this.dummy.position);
        const sc = t.tube.radius * 0.32; this.dummy.scale.set(sc, sc, sc);
        this.dummy.rotation.set(this.clock * 0.6 + t.rbcUV[i * 3 + 2], t.rbcUV[i * 3 + 2], 0.4); this.dummy.updateMatrix();
        t.rbc.setMatrixAt(i, this.dummy.matrix);
      }
      t.rbc.instanceMatrix.needsUpdate = true;
    }

    // lymph nodes, and the sites without one
    const live = new Set<number>();
    for (const n of s.nodes) {
      live.add(n.id);
      let g = this.nodes.get(n.id);
      if (!g) { g = this.makeNode(n); this.board.add(g); this.nodes.set(n.id, g); }
      g.scale.setScalar(1 + n.flash * 0.25); g.visible = !n.off;
      g.position.y = 0.22 + Math.sin(this.clock * 1.6 + n.id) * 0.015;
    }
    for (const [id, g] of this.nodes) if (!live.has(id)) { this.board.remove(g); this.nodes.delete(id); }
    const taken = new Set(s.nodes.map((n) => n.site));
    for (const [id, g] of this.sites) g.visible = s.phase === 'prep' && !taken.has(id);
    const ringAt = (m: THREE.Mesh, id: string | null | undefined) => { const st = id ? map.SITES.find((x) => x.id === id) : null; m.visible = !!st; if (st) m.position.copy(toWorld(st.x, st.y, 0.03)); };
    ringAt(this.hover, s.phase === 'prep' ? view.hoverSite : null);
    ringAt(this.target, view.selectedSite);
    this.coach.visible = !!view.coachAt;
    if (view.coachAt) { this.coach.position.copy(toWorld(view.coachAt.x, view.coachAt.y, 0.04)); this.coach.scale.setScalar(1 + 0.15 * Math.sin(this.clock * 5)); }

    // pathogens: 3D models travelling inside their vessels (bosses, too big for a vessel, ride on top)
    const alive = new Set<number>();
    for (const p of s.pathogens) {
      if (p.hp <= 0 || p.s < 0) continue;
      alive.add(p.id);
      let b = this.bugs.get(p.id);
      if (!b) { b = this.makeBug(p.type); this.scene.add(b.obj); this.bugs.set(p.id, b); }
      const q = pathogenPos(p), r = tubeR(vesselWidth(s, p.vessel));
      if (b.boss) {
        b.obj.position.copy(toWorld(q.x, q.y, r * FLAT * 2 + b.size * 0.36));
      } else {
        const st = CONFIG.pathogens[p.type], scale = r * (st.taxon ? 1.25 : 1.35) * (p.type === 'infected' ? 1.3 : 1);
        b.obj.scale.setScalar(scale);
        b.obj.position.copy(toWorld(q.x, q.y, r * FLAT + Math.sin(this.clock * 3 + b.spin) * r * 0.12));
        b.obj.rotation.set(Math.sin(this.clock * 1.7 + b.spin) * 0.25, -q.angle, st.taxon ? 0 : this.clock * 0.8 + b.spin);
      }
      b.obj.visible = (p.dormantT ?? 0) <= 0 || Math.sin(this.clock * 6) > 0;
    }
    for (const [id, b] of this.bugs) if (!alive.has(id)) { this.scene.remove(b.obj); this.bugs.delete(id); }

    // white cells out on their vessels
    const out = new Set<number>();
    for (const c of s.cells) {
      if (c.hp <= 0 || c.infected || c.mode === 'home') continue;
      out.add(c.id);
      let o = this.cells.get(c.id);
      if (!o) { o = whiteCellModel(); this.scene.add(o); this.cells.set(c.id, o); }
      const q = cellPos(c), r = tubeR(vesselWidth(s, c.vessel)), sq = 1 + Math.sin(this.clock * 4 + c.id) * 0.06;
      o.scale.set(r * 1.25 * sq, r * 1.25 / sq, r * 1.25 * sq);
      o.position.copy(toWorld(q.x, q.y, r * FLAT)); o.rotation.y = this.clock * 0.7 + c.id;
    }
    for (const [id, o] of this.cells) if (!out.has(id)) { this.scene.remove(o); this.cells.delete(id); }

    // antibodies in flight: beads in the node's colour
    while (this.shots.length < s.shots.length) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial()); this.scene.add(m); this.shots.push(m); }
    this.shots.forEach((m, i) => {
      const sh = s.shots[i]; m.visible = !!sh;
      if (sh) { m.position.copy(toWorld(sh.x, sh.y, 0.32)); (m.material as THREE.MeshBasicMaterial).color.copy(lin(NODE_COLORS[sh.type].base)); }
    });

    // kills pop: a burst of beads in the pathogen's colour (white for a cell given in the pulse)
    for (const r of s.rings) {
      if (this.seenRings.has(r)) continue;
      this.seenRings.add(r);
      if (r.kind !== 'pop' && r.kind !== 'sacrifice' && r.kind !== 'cellDown') continue;
      const near = [...s.pathogens].sort((a, b) => Math.hypot(pathogenPos(a).x - r.x, pathogenPos(a).y - r.y) - Math.hypot(pathogenPos(b).x - r.x, pathogenPos(b).y - r.y))[0];
      const col = r.kind === 'pop' && near ? pathogenColour(near.type) : lin('#fbf8f0');
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(toWorld(r.x, r.y, 0.3)); this.scene.add(m);
        this.pops.push({ m, v: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).multiplyScalar(2.4), t: 0 });
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.t += dt; p.v.y -= dt * 6; p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(Math.max(0.01, 1 - p.t * 1.7));
      if (p.t > 0.6) { this.scene.remove(p.m); this.pops.splice(i, 1); }
    }

    // the organ: a breath of movement, a red flush when it is hit; its health beads
    if (this.organ && this.organMat) {
      const beat = L.id === 'heart' ? Math.pow(Math.max(0, Math.sin(this.clock * Math.PI * 2 * 1.15)), 8) * 0.06 : Math.sin(this.clock * 1.3) * 0.015;
      this.organ.scale.set(1 + s.heartKick * 0.03, 1 + beat + s.heartKick * 0.15, 1 + s.heartKick * 0.03);
      this.organMat.color.setRGB(1, 1 - s.heartKick * 0.45, 1 - s.heartKick * 0.5);
    }
    this.beads.forEach((b, i) => { const on = i < s.heartHp; b.mat.color.copy(lin(on ? '#d8615a' : '#e8dcc6')); b.obj.parent!.scale.setScalar(on ? 1 : 0.8); });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(s);
  }

  /** Floating words (damage, notes at a place) and the vessels' names, in ink, over the 3D view. */
  private drawOverlay(s: State) {
    const c = this.overlay.getContext('2d')!, dpr = this.overlay.width / Math.max(1, this.host.clientWidth);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, this.overlay.width, this.overlay.height);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ink = (text: string, x: number, y: number, col: string, size: number, alpha = 1) => {
      c.globalAlpha = alpha; c.font = `italic 700 ${size}px Palatino, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(242,233,212,0.9)'; c.strokeText(text, x, y); c.fillStyle = col; c.fillText(text, x, y); c.globalAlpha = 1;
    };
    const scale = Math.max(0.65, Math.min(1, rect.width / 1100));
    // vessel names near where each vessel enters the map
    for (const v of map.ENTRY_IDS) {
      const ves = map.VESSELS[v]; if (!ves) continue;
      const i = Math.min(ves.cx.length - 1, Math.round(ves.cx.length * 0.06)), p = this.screenOf(ves.cx[i], ves.cy[i], 0.4);
      if (p.x < rect.left || p.x > rect.right || p.y < rect.top || p.y > rect.bottom) continue;
      ink(map.entryDef(v)?.name ?? ves.name, p.x - rect.left, p.y - rect.top - 18 * scale, '#231a14', 14 * scale, 0.85);
    }
    for (const f of s.floaters) {
      const p = this.screenOf(f.x, f.y, 0.5);
      ink(f.text, p.x - rect.left, p.y - rect.top - f.t * 26, f.color, Math.round((f.size ?? 24) * 0.75 * scale), Math.max(0, 1 - f.t / (f.life ?? 1.4)));
    }
  }

  /** Where on the paper (in map units) a point on the screen lands, or null off the board. */
  pick(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15), hit) ? toMap(hit) : null;
  }

  /** Where on the screen (client pixels) a map point at height `h` is drawn. */
  screenOf(x: number, y: number, h = 0.3) {
    const v = toWorld(x, y, h); v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  dispose() { this.renderer.setAnimationLoop(null); this.renderer.dispose(); this.renderer.domElement.remove(); this.overlay.remove(); }
}
