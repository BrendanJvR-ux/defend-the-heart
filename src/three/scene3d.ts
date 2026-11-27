// The 3D view of an organ: the same game state the 2D map draws, shown in three dimensions in the game's ink style.
// It only reads the state; the rules stay in sim.ts.
//
// Map units (1600 × 1000) become world units at K = 0.01: the board is 16 × 10, x to the right, z towards the viewer.
// - the paper: the level's own inked background, on the ground
// - the organ: its own inked drawing, raised into a puffed relief (height from the drawing's shape)
// - vessels: tubes along each route's winding course, flattened a little, widening as they dilate, blood scrolling in
// - pathogens and white cells: the game's drawings of them, standing up as paper cut-outs
// - lymph nodes, health beads: small cel-shaded solids with ink outlines
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG, type LevelDef, type NodeType, type PathogenType, type VesselId } from '../config';
import * as map from '../level';
import { W, H } from '../level';
import { type State, pathogenPos, cellPos, levelDef } from '../sim';
import { organArt, paperArt, drawPathogen, drawWhiteCell, vesselWidth, NODE_COLORS } from '../draw';

export const K = 0.01;
/** A vessel's tube radius in the world, from its width on the map: a dilated vessel swells, but a little less than
 *  on the flat map, so it never folds over itself in a tight bend. */
const tubeR = (w: number) => (Math.min(w, 30 + (w - 30) * 0.7) / 2) * K;
export const toWorld = (x: number, y: number) => new THREE.Vector3((x - W / 2) * K, 0, (y - H / 2) * K);
export const toMap = (v: THREE.Vector3) => ({ x: v.x / K + W / 2, y: v.z / K + H / 2 });

const FLAT = 0.6; // vessels are a little flatter than round, lying on the paper
const INK = 0x231a14;
const lin = (hex: string | number) => new THREE.Color(hex as THREE.ColorRepresentation).convertSRGBToLinear();

// cel shading: three flat tones, like the game's wash, hatching and ink
const ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const toon = (hex: string | number, extra: THREE.MeshToonMaterialParameters = {}) => new THREE.MeshToonMaterial({ color: lin(hex), gradientMap: ramp, ...extra });
// pushed back in depth, so where a tube bends tightly its outline never shows through the tube itself
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 });

/** A solid with an ink outline: the same shape a little larger, inside out, in black. */
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, w = 0.07) {
  const g = new THREE.Group(), body = new THREE.Mesh(geo, mat), line = new THREE.Mesh(geo, inkMat);
  line.scale.setScalar(1 + w); body.castShadow = true; g.add(line, body);
  return { group: g, body };
}

/** A paper cut-out of one of the game's drawings, standing up and always facing the camera. */
const cutouts = new Map<string, THREE.SpriteMaterial>();
function cutout(key: string, draw: (x: CanvasRenderingContext2D) => void) {
  let m = cutouts.get(key);
  if (!m) {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d')!; draw(x);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    m = new THREE.SpriteMaterial({ map: t, alphaTest: 0.35 });
    cutouts.set(key, m);
  }
  return new THREE.Sprite(m);
}
const bugSprite = (type: PathogenType) => {
  const st = CONFIG.pathogens[type];
  return cutout(type, (x) => drawPathogen(x, type, 80, 80, -Math.PI / 2, 0, st.boss ? 1.45 : st.taxon ? 2.9 : 3.5));
};
const cellSprite = () => cutout('cell', (x) => drawWhiteCell(x, 80, 80, 0, 0, 2.2));

/** A tube along a route, whose radius can change (dilation) without rebuilding it. */
class Tube {
  readonly mesh: THREE.Mesh; readonly line: THREE.Mesh;
  private centres: Float32Array; private dirs: Float32Array; private r = -1;
  constructor(pts: THREE.Vector3[], mat: THREE.Material, radial = 14) {
    const n = pts.length, vc = n * (radial + 1);
    this.centres = new Float32Array(vc * 3); this.dirs = new Float32Array(vc * 3);
    const uv = new Float32Array(vc * 2), idx: number[] = [];
    let run = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = b.clone().sub(a).setY(0).normalize(), side = new THREE.Vector3(-t.z, 0, t.x);
      if (i) run += pts[i].distanceTo(pts[i - 1]);
      for (let j = 0; j <= radial; j++) {
        const th = (j / radial) * Math.PI * 2, k = i * (radial + 1) + j;
        const d = side.clone().multiplyScalar(Math.cos(th)).add(new THREE.Vector3(0, Math.sin(th) * FLAT, 0));
        this.centres.set([pts[i].x, pts[i].y, pts[i].z], k * 3); this.dirs.set([d.x, d.y, d.z], k * 3);
        uv.set([run * 2.2, j / radial], k * 2);
        if (i < n - 1 && j < radial) { const a0 = k, b0 = k + radial + 1; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3)); lineGeo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.line = new THREE.Mesh(lineGeo, inkMat);
  }
  setRadius(r: number) {
    if (Math.abs(r - this.r) < 0.0005) return;
    this.r = r;
    const p = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, q = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const P = p.array as Float32Array, Q = q.array as Float32Array, ro = r * 1.13 + 0.012;
    for (let i = 0; i < P.length; i += 3) {
      // lying on the paper: the centre rides at the height of the (flattened) radius
      P[i] = this.centres[i] + this.dirs[i] * r; P[i + 1] = r * FLAT + this.dirs[i + 1] * r; P[i + 2] = this.centres[i + 2] + this.dirs[i + 2] * r;
      Q[i] = this.centres[i] + this.dirs[i] * ro; Q[i + 1] = r * FLAT + this.dirs[i + 1] * ro; Q[i + 2] = this.centres[i + 2] + this.dirs[i + 2] * ro;
    }
    p.needsUpdate = true; q.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere(); this.line.geometry.computeBoundingSphere();
  }
}

/** For each pixel of an N × N image, its distance (in pixels) inside the drawn shape to the shape's outline;
 *  0 outside it. A two-pass chamfer distance transform on the alpha. */
function reliefDistance(rgba: Uint8ClampedArray, N: number) {
  const d = new Float32Array(N * N), BIG = 1e6, A = 1, B = Math.SQRT2;
  for (let i = 0; i < N * N; i++) d[i] = rgba[i * 4 + 3] > 127 ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : d[y * N + x]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + A, at(x, y - 1) + A, at(x - 1, y - 1) + B, at(x + 1, y - 1) + B);
  }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
    const i = y * N + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + A, at(x, y + 1) + A, at(x + 1, y + 1) + B, at(x - 1, y + 1) + B);
  }
  return d;
}

export class Board3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  readonly controls: OrbitControls;
  private level = -1;
  private board = new THREE.Group();
  private tubes = new Map<VesselId, { tube: Tube; mat: THREE.MeshToonMaterial; rest: THREE.Texture; open: THREE.Texture }>();
  private nodes = new Map<number, THREE.Group>();
  private sites = new Map<string, THREE.Object3D>();
  private bugs = new Map<number, THREE.Sprite>();
  private cells = new Map<number, THREE.Sprite>();
  private shots: THREE.Mesh[] = [];
  private beads: { obj: THREE.Mesh; mat: THREE.MeshToonMaterial }[] = [];
  private organ: THREE.Mesh | null = null;
  private organMat: THREE.MeshToonMaterial | null = null;
  private blood: THREE.CanvasTexture;
  private bloodOpen: THREE.CanvasTexture;
  private hover: THREE.Mesh;
  private clock = 0;
  private moved = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(lin('#d9ccb0'));
    host.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 6, maxDistance: 24, minPolarAngle: 0.05, maxPolarAngle: 1.05, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9, screenSpacePanning: false });
    this.controls.target.set(0, 0, 0.4);
    this.camera.position.set(0, 14.2, 10.4);
    this.controls.addEventListener('start', () => { this.moved = true; });

    this.scene.add(new THREE.HemisphereLight(0xfff8ec, 0xb8a47e, 1.4));
    const sun = new THREE.DirectionalLight(0xfff2de, 2.2);
    sun.position.set(-6, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8 }); sun.shadow.bias = -0.0006; sun.shadow.radius = 3;
    this.scene.add(sun);
    // the desk the plate lies on
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: lin('#cdbd9c') }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.02; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.add(this.board);

    // blood: soft red cells on a pink wash, scrolled along every vessel towards the organ
    // (and a pale blue wash for a dilated vessel, as on the 2D map)
    const wash = (bg: string, cell: string, line: string) => {
      const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64;
      const b = bc.getContext('2d')!; b.fillStyle = bg; b.fillRect(0, 0, 128, 64);
      for (let i = 0; i < 9; i++) { b.fillStyle = cell; b.beginPath(); b.ellipse((i * 37) % 128, 10 + ((i * 23) % 44), 8, 5, i, 0, Math.PI * 2); b.fill(); }
      b.strokeStyle = line; b.lineWidth = 1; for (let i = 0; i < 12; i++) { b.beginPath(); b.moveTo(i * 11, 0); b.lineTo(i * 11 + 30, 64); b.stroke(); }
      const t = new THREE.CanvasTexture(bc); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    };
    this.blood = wash('#e9a39a', 'rgba(200,70,62,0.55)', 'rgba(110,38,34,0.25)');
    this.bloodOpen = wash('#bfe0ef', 'rgba(200,80,72,0.5)', 'rgba(30,90,120,0.25)');

    this.hover = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: lin('#e8a028'), transparent: true, opacity: 0.9 }));
    this.hover.rotation.x = -Math.PI / 2; this.hover.position.y = 0.03; this.hover.visible = false; this.scene.add(this.hover);

    new ResizeObserver(() => this.resize()).observe(host); this.resize();
  }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(1, h);
    const a = w / Math.max(1, h);
    this.camera.fov = a < 1.2 ? 46 : a > 1.8 ? 30 : 34;
    // until the player turns the view themselves: a wide, short screen (a phone held sideways) looks down more
    // steeply, so the whole board fits its height
    if (!this.moved) { if (a > 1.8) this.camera.position.set(0, 18.2, 6.4); else this.camera.position.set(0, 14.2, 10.4); this.controls.target.set(0, 0, a > 1.8 ? 0.2 : 0.4); } this.camera.updateProjectionMatrix();
  }

  /** Build everything that stays put for this organ: the paper, the organ, the vessels, the empty sites. */
  private build(s: State) {
    this.board.clear(); this.tubes.clear(); this.nodes.clear(); this.sites.clear(); this.beads = [];
    for (const o of [...this.bugs.values(), ...this.cells.values(), ...this.shots]) this.scene.remove(o);
    this.bugs.clear(); this.cells.clear(); this.shots = [];
    const L: LevelDef = levelDef(s);
    this.level = s.level;

    // the paper: the level's own background, drawn as on the 2D map
    const pt = new THREE.CanvasTexture(paperArt(L)); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(W * K, H * K), new THREE.MeshLambertMaterial({ map: pt }));
    plate.rotation.x = -Math.PI / 2; plate.receiveShadow = true; this.board.add(plate);

    // the organ: its inked drawing, raised into relief. Height comes from the drawing's own shape (its alpha,
    // blurred), so the 3D form follows the outline exactly, for every organ.
    const art = organArt(L, 1.2), img = art.img, N = 220;
    const probe = document.createElement('canvas'); probe.width = probe.height = N;
    const pc = probe.getContext('2d', { willReadFrequently: true })!;
    pc.drawImage(img, 0, 0, N, N);
    const alpha = pc.getImageData(0, 0, N, N).data;
    const span = art.half * 2 * K, geo = new THREE.PlaneGeometry(span, span, N - 1, N - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute, peak = Math.min(L.map.rx, L.map.ry) * K * 0.55;
    const d = reliefDistance(alpha, N), R = N * 0.2;
    for (let i = 0; i < pos.count; i++) {
      // a rounded profile: every edge slopes down to the paper (about 45°, so the drawing's ink never smears down a
      // sheer wall), narrow parts become rounded ridges, broad ones a dome with a gentle top
      const t = Math.min(1, d[i] / R);
      pos.setY(i, Math.sin((t * Math.PI) / 2) * peak);
    }
    geo.computeVertexNormals();
    const ot = new THREE.CanvasTexture(img); ot.colorSpace = THREE.SRGBColorSpace; ot.anisotropy = 8;
    this.organMat = new THREE.MeshToonMaterial({ map: ot, gradientMap: ramp, alphaTest: 0.5, side: THREE.DoubleSide });
    this.organ = new THREE.Mesh(geo, this.organMat);
    this.organ.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ot, alphaTest: 0.5 });
    this.organ.castShadow = true; this.organ.receiveShadow = true;
    this.organ.position.copy(toWorld(L.map.center.x, L.map.center.y)); this.organ.position.y = 0.01;
    this.board.add(this.organ);

    // vessels: a tube along each route (a fork's second branch starts at the fork, so the stem is drawn once)
    for (const v of map.VESSEL_IDS) {
      const ves = map.VESSELS[v], entry = map.entryOf(v), first = map.routesOf(entry)[0] === v;
      const from = first ? 0 : map.forkAt(v);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < ves.cx.length; i += 3) {
        const cum = ves.length * (i / (ves.cx.length - 1));
        if (cum >= from - 4) pts.push(toWorld(ves.cx[i], ves.cy[i]));
      }
      // carried on into the organ, as on the map, so no vessel stops short of it
      const end = pts[pts.length - 1], c = toWorld(L.map.center.x, L.map.center.y);
      pts.push(end.clone().lerp(c, 0.35), end.clone().lerp(c, 0.55));
      const rest = this.blood.clone(), open = this.bloodOpen.clone(); rest.needsUpdate = open.needsUpdate = true;
      const mat = toon('#ffffff', { map: rest });
      const tube = new Tube(pts, mat);
      this.board.add(tube.line, tube.mesh);
      this.tubes.set(v, { tube, mat, rest, open });
    }

    // empty build sites: a dashed ring with a cross on the paper
    for (const site of map.SITES) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: lin('#7a6a58'), transparent: true, opacity: 0.75 });
      for (let i = 0; i < 12; i++) { const seg = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 4, 1, (i / 12) * Math.PI * 2, Math.PI / 12), m); g.add(seg); }
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.04), m), bar2 = bar.clone(); bar2.rotation.z = Math.PI / 2; g.add(bar, bar2);
      g.rotation.x = -Math.PI / 2; g.position.copy(toWorld(site.x, site.y)); g.position.y = 0.02;
      this.board.add(g); this.sites.set(site.id, g);
    }

    // health beads in a ring round the organ, as on the map
    const n = L.hp, heart = L.id === 'heart', rx = heart ? 159 : L.map.rx + 50, ry = heart ? 159 : L.map.ry + 50;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, mat = toon('#d8615a');
      const { group, body } = inked(new THREE.SphereGeometry(0.085, 16, 10), mat, 0.2);
      group.position.copy(toWorld(L.map.center.x + Math.cos(a) * rx, L.map.center.y + 4 + Math.sin(a) * ry)); group.position.y = 0.09;
      this.board.add(group); this.beads.push({ obj: body, mat });
    }
  }

  private nodeMesh(type: NodeType) {
    const g = new THREE.SphereGeometry(0.26, 28, 18), p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {   // a bean, with its dimple
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, x * 1.3, y * 0.7, z * 0.95 - 0.06 * Math.exp(-(x * x) / 0.02) * Math.max(0, -z));
    }
    g.computeVertexNormals();
    const { group } = inked(g, new THREE.MeshToonMaterial({ color: lin(NODE_COLORS[type].base).lerp(lin(NODE_COLORS[type].light), 0.4), gradientMap: ramp }), 0.08);
    const letter = cutout('letter-' + type, (x) => {
      x.fillStyle = '#f2e9d4'; x.beginPath(); x.arc(80, 80, 46, 0, Math.PI * 2); x.fill(); x.lineWidth = 6; x.strokeStyle = '#231a14'; x.stroke();
      x.fillStyle = '#231a14'; x.font = 'italic 700 64px Palatino, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(type === 'igm' ? 'M' : type === 'igg' ? 'G' : type === 'iga' ? 'A' : 'E', 80, 84);
    });
    letter.scale.setScalar(0.3); letter.position.y = 0.3; group.add(letter);
    return group;
  }

  /** Show the state as it is now. */
  update(s: State, dt: number, hoverSite: string | null) {
    if (s.level !== this.level || !this.organ) this.build(s);
    this.clock += dt;
    const L = levelDef(s);

    // vessels: width from dilation, blood flowing in, the open ones washed blue
    for (const [v, t] of this.tubes) {
      const w = vesselWidth(s, v), open = s.open.includes(v);
      t.tube.setRadius(tubeR(w));
      const want = open ? t.open : t.rest;
      if (t.mat.map !== want) { t.mat.map = want; t.mat.needsUpdate = true; }
      want.offset.x = (want.offset.x - dt * (open ? 0.9 : 0.5)) % 1;
    }

    // lymph nodes, and the sites without one
    const live = new Set<number>();
    for (const n of s.nodes) {
      live.add(n.id);
      let g = this.nodes.get(n.id);
      if (!g) {
        g = this.nodeMesh(n.type); const site = map.siteById(n.site);
        g.position.copy(toWorld(site.x, site.y)); g.position.y = 0.2; this.board.add(g); this.nodes.set(n.id, g);
      }
      g.scale.setScalar(1 + n.flash * 0.25); g.visible = !n.off;
    }
    for (const [id, g] of this.nodes) if (!live.has(id)) { this.board.remove(g); this.nodes.delete(id); }
    const taken = new Set(s.nodes.map((n) => n.site));
    for (const [id, g] of this.sites) g.visible = s.phase === 'prep' && !taken.has(id);
    const hs = hoverSite && s.phase === 'prep' ? map.siteById(hoverSite) : null;
    this.hover.visible = !!hs; if (hs) { this.hover.position.copy(toWorld(hs.x, hs.y)); this.hover.position.y = 0.03; }

    // pathogens: the game's drawings, standing on their vessel
    const alive = new Set<number>();
    for (const p of s.pathogens) {
      if (p.hp <= 0 || p.s < 0) continue;
      alive.add(p.id);
      let sp = this.bugs.get(p.id);
      if (!sp) {
        sp = bugSprite(p.type); const st = CONFIG.pathogens[p.type];
        const size = st.boss ? 1.5 : st.taxon ? 0.62 : 0.5; sp.scale.set(size, size, 1); sp.userData.size = size;
        this.scene.add(sp); this.bugs.set(p.id, sp);
      }
      const q = pathogenPos(p), r = tubeR(vesselWidth(s, p.vessel)), size = sp.userData.size as number;
      sp.position.copy(toWorld(q.x, q.y)); sp.position.y = r * FLAT * 2 + size * 0.32 + Math.sin(this.clock * 4 + p.id) * 0.02;
      (sp.material as THREE.SpriteMaterial).rotation = 0;
    }
    for (const [id, sp] of this.bugs) if (!alive.has(id)) { this.scene.remove(sp); this.bugs.delete(id); }

    // white cells out on their vessels
    const out = new Set<number>();
    for (const c of s.cells) {
      if (c.hp <= 0 || c.infected || c.mode === 'home') continue;
      out.add(c.id);
      let sp = this.cells.get(c.id);
      if (!sp) { sp = cellSprite(); sp.scale.set(0.62, 0.62, 1); this.scene.add(sp); this.cells.set(c.id, sp); }
      const q = cellPos(c), r = tubeR(vesselWidth(s, c.vessel));
      sp.position.copy(toWorld(q.x, q.y)); sp.position.y = r * FLAT * 2 + 0.22;
    }
    for (const [id, sp] of this.cells) if (!out.has(id)) { this.scene.remove(sp); this.cells.delete(id); }

    // antibodies in flight: small beads in the node's colour
    while (this.shots.length < s.shots.length) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial()); this.scene.add(m); this.shots.push(m);
    }
    this.shots.forEach((m, i) => {
      const sh = s.shots[i];
      m.visible = !!sh;
      if (sh) { m.position.copy(toWorld(sh.x, sh.y)); m.position.y = 0.42; (m.material as THREE.MeshBasicMaterial).color.copy(lin(NODE_COLORS[sh.type].base)); }
    });

    // the organ: a breath of movement, a red flash when it is hit; its health beads
    if (this.organ && this.organMat) {
      const beat = L.id === 'heart' ? Math.pow(Math.max(0, Math.sin(this.clock * Math.PI * 2 * 1.15)), 8) * 0.06 : Math.sin(this.clock * 1.3) * 0.015;
      this.organ.scale.set(1 + s.heartKick * 0.03, 1 + beat + s.heartKick * 0.15, 1 + s.heartKick * 0.03);
      this.organMat.color.setRGB(1, 1 - s.heartKick * 0.45, 1 - s.heartKick * 0.5);
    }
    this.beads.forEach((b, i) => { const on = i < s.heartHp; b.mat.color.copy(lin(on ? '#d8615a' : '#e8dcc6')); b.obj.scale.setScalar(on ? 1 : 0.8); });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Where on the paper (in map units) a point on the screen lands. */
  pick(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    // the plane a little above the paper, about where the vessels' tops and the nodes are
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15), hit) ? toMap(hit) : null;
  }

  /** Where on the screen a map point (at node height) is drawn, for placing menus beside it. */
  screenOf(x: number, y: number) {
    const v = toWorld(x, y); v.y = 0.3; v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }
}
