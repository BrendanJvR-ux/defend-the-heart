// The 3D models of the game's small things: every pathogen (by its shape and arrangement), white and red cells, and
// the lymph nodes. Cel-shaded, with ink outlines; each pathogen takes its colour from the game's own drawing of it.
import * as THREE from 'three';
import { CONFIG, type NodeType, type PathogenType } from '../config';
import { drawPathogen, NODE_COLORS } from '../draw';

export const lin = (hex: string | number | THREE.Color) => new THREE.Color(hex as THREE.ColorRepresentation).convertSRGBToLinear();

// cel shading: three flat tones, like the game's wash, hatching and ink
export const ramp = new THREE.DataTexture(new Uint8Array([160, 160, 160, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color: color instanceof THREE.Color ? color : lin(color as string), gradientMap: ramp, ...extra });
/** Ink: drawn on the inside of a slightly larger copy, so it shows only round the edge. */
export const inkMat = new THREE.MeshBasicMaterial({ color: 0x231a14, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 });

/** A solid with an ink outline. */
export function inked(geo: THREE.BufferGeometry, mat: THREE.Material, w = 0.08) {
  const g = new THREE.Group(), body = new THREE.Mesh(geo, mat), line = new THREE.Mesh(geo, inkMat);
  line.scale.setScalar(1 + w); body.castShadow = true; g.add(line, body);
  return g;
}

/** The colour of a pathogen, read off the game's own drawing of it (the average of its painted pixels). */
const colours = new Map<PathogenType, THREE.Color>();
export function pathogenColour(type: PathogenType): THREE.Color {
  let c = colours.get(type);
  if (!c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d', { willReadFrequently: true })!;
    drawPathogen(x, type, 32, 32, 0, 0, CONFIG.pathogens[type].taxon ? 1.3 : 1.6);
    const d = x.getImageData(0, 0, 64, 64).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      // the paint, not the ink: skip see-through and near-black pixels
      if (d[i + 3] < 200 || d[i] + d[i + 1] + d[i + 2] < 150) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    c = n ? new THREE.Color(r / n / 255, g / n / 255, b / n / 255) : new THREE.Color(0.7, 0.6, 0.8);
    // a little more saturated than the averaged wash, so it reads through a vessel wall
    const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.35 + 0.08), Math.min(0.72, hsl.l));
    c.convertSRGBToLinear(); colours.set(type, c);
  }
  return c;
}

// shared geometries
const geo = {
  coccus: new THREE.SphereGeometry(1, 16, 12),
  rod: new THREE.CapsuleGeometry(0.5, 1.6, 6, 12).rotateZ(Math.PI / 2),
  ico: new THREE.IcosahedronGeometry(1, 0),
  spike: new THREE.ConeGeometry(0.12, 0.45, 5),
  blob: (() => { const g = new THREE.IcosahedronGeometry(1, 3), p = g.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.09 * Math.sin(v.x * 7) * Math.cos(v.y * 6) + 0.05 * Math.sin(v.z * 9)); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; })(),
  disc: (() => { const g = new THREE.SphereGeometry(1, 20, 10), p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * (0.28 + 0.8 * (x * x + z * z))); }
    g.computeVertexNormals(); return g; })(),
};
const mats = new Map<string, THREE.Material>();
const matFor = (key: string, c: THREE.Color) => { let m = mats.get(key); if (!m) { m = toon(c.clone()); mats.set(key, m); } return m; };

function part(g: THREE.BufferGeometry, m: THREE.Material, s: [number, number, number], at: [number, number, number] = [0, 0, 0], ink = 0.12) {
  const o = inked(g, m, ink); o.scale.set(...s); o.position.set(...at); return o;
}
function flagellum(len: number, col: THREE.Color, from: number) {
  const pts = Array.from({ length: 14 }, (_, i) => new THREE.Vector3(from - i * len / 13, Math.sin(i * 1.3) * 0.25, Math.cos(i * 1.3) * 0.25));
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5), toon(col.clone().multiplyScalar(0.55)));
}

/** A pathogen, about 1 unit long (scaled to fit its vessel by the scene), facing +x along its vessel. */
export function pathogenModel(type: PathogenType): THREE.Group {
  const st = CONFIG.pathogens[type], col = pathogenColour(type), m = matFor(type, col), g = new THREE.Group();
  const sp = st.taxon?.species, shape = st.taxon?.shape;
  if (shape === 'coccus') {
    // the arrangement is the species' signature: clusters, pairs, chains
    const r = 0.26;
    const at: [number, number, number][] =
      sp === 'saureus' ? [[0, 0, 0], [0.4, 0.1, 0.1], [-0.38, 0.08, -0.12], [0.1, 0.3, -0.3], [0.05, -0.05, 0.42], [-0.2, 0.32, 0.25], [0.3, -0.1, -0.38]]
      : sp === 'spyogenes' ? [[-0.75, 0, 0], [-0.25, 0.06, 0], [0.25, 0, 0], [0.75, -0.06, 0]]
      : sp === 'chlamydia' ? [[0, 0, 0], [0.3, 0.12, 0.2], [-0.28, 0.1, -0.18], [0.05, 0.2, -0.32]]
      : [[-0.27, 0, 0], [0.27, 0, 0]];   // pairs: pneumococci (lancet-shaped), meningococci (beans face to face)
    for (const p of at) g.add(part(geo.coccus, m, sp === 'spneumo' ? [r * 1.3, r * 0.85, r * 0.85] : sp === 'nmening' ? [r * 0.85, r, r] : sp === 'chlamydia' ? [r * 0.75, r * 0.75, r * 0.75] : [r, r, r], p));
  } else if (shape === 'rod') {
    const slender = sp === 'mtb', short = sp === 'listeria' || sp === 'chlamydia';
    const body = part(geo.rod, m, [slender ? 0.32 : short ? 0.42 : 0.5, slender ? 0.32 : 0.5, slender ? 0.32 : 0.5]);
    if (sp === 'hpylori') body.scale.set(0.5, 0.42, 0.42);
    g.add(body);
    if (sp === 'hpylori') { const b2 = part(geo.rod, m, [0.32, 0.4, 0.4], [0.5, 0.15, 0]); b2.rotation.z = 0.6; g.add(b2); }
    if (sp === 'ecoli' || sp === 'salmonella' || sp === 'paeruginosa' || sp === 'hpylori' || sp === 'listeria') g.add(flagellum(0.9, col, -0.6));
    if (sp === 'kpneumo') { const cap = new THREE.Mesh(geo.rod, toon(col.clone().lerp(new THREE.Color(1, 1, 1), 0.6), { transparent: true, opacity: 0.45, depthWrite: false })); cap.scale.set(0.66, 0.66, 0.66); g.add(cap); }
  } else if (type === 'infected') {
    g.add(part(geo.blob, m, [0.55, 0.5, 0.55], [0, 0, 0], 0.08));
    g.add(part(geo.coccus, matFor('infected-n', lin('#8a2ab8')), [0.2, 0.2, 0.2], [0.12, 0.28, 0.1], 0.1));
  } else if (type === 'plasmodium') {
    g.add(part(geo.disc, matFor('rbc', lin('#d8504a')), [0.5, 0.5, 0.5]));
    g.add(part(geo.coccus, m, [0.14, 0.14, 0.14], [0.1, 0.16, 0.05], 0.15));
  } else if (type === 'hijacker') {
    // a phage: faceted head on a tail, with legs
    g.add(part(geo.ico, m, [0.34, 0.34, 0.34], [0, 0.32, 0]));
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), toon(col.clone().multiplyScalar(0.6))); tail.position.y = -0.05; g.add(tail);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 5), tail.material); leg.position.set(Math.cos(a) * 0.15, -0.32, Math.sin(a) * 0.15); leg.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(leg); }
  } else {
    // viruses: a faceted capsid studded with spikes (HIV and herpes rounder, the jumper with springier spikes)
    const round = type === 'hiv' || type === 'herpes';
    g.add(part(round ? geo.coccus : geo.ico, m, [0.36, 0.36, 0.36]));
    const spikeM = matFor(type + '-s', col.clone().multiplyScalar(0.62));
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 1.7), Math.cos(i * 2.4), Math.sin(i * 2.4) * Math.sin(i * 1.7)).normalize();
      const s = new THREE.Mesh(geo.spike, spikeM); s.position.copy(d).multiplyScalar(0.42); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      if (type === 'jumper') s.scale.set(1, 1.6, 1);
      g.add(s);
    }
  }
  return g;
}

/** A white cell: a soft, ruffled blob with its lobed nucleus. */
export function whiteCellModel(): THREE.Group {
  const g = new THREE.Group();
  g.add(part(geo.blob, matFor('wbc', lin('#fbf8f0')), [0.5, 0.46, 0.5], [0, 0, 0], 0.07));
  const n = matFor('wbc-n', lin('#8a6ab0'));
  for (const p of [[0.12, 0.2, 0.1], [-0.12, 0.2, 0.05], [0, 0.22, -0.13]] as [number, number, number][]) g.add(part(geo.coccus, n, [0.15, 0.13, 0.15], p, 0.12));
  return g;
}

/** A red blood cell: a disc dimpled on both faces (no outline: there are many). */
export const redCellGeometry = geo.disc;

/** A lymph node: a bean in its type's colour; its letter and stalk are added by the scene. */
export function nodeModel(type: NodeType): THREE.Group {
  const g = new THREE.SphereGeometry(0.26, 28, 18), p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x * 1.3, y * 0.72, z * 0.95 - 0.06 * Math.exp(-(x * x) / 0.02) * Math.max(0, -z));
  }
  g.computeVertexNormals();
  const c = NODE_COLORS[type];
  return inked(g, toon(lin(c.base).lerp(lin(c.light), 0.45)), 0.08);
}
