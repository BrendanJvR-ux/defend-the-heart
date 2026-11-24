// Drawing for Defend the Heart: a stylised anatomy plate, kept calm so the white cells stand out.
import { CONFIG, LEVELS, type LevelDef, type BacteriumType, type BossType, type NodeType, type PathogenType, type VesselId } from './config';
import { drawBoss } from './bosses';
import { W, H, HEART, LEVEL, VESSELS, VESSEL_IDS, SITES, pointAt, entryOf, forkAt, routesOf, type Vec, type Vessel } from './level';
import { drawBacterium } from './bacteria';
import { hidden, wallLeft } from './sim';
import { organCacheKey, organImageScale, ORGAN_SPAN } from './organCache';
import { layoutLabels, type MapLabel } from './labels';
import { type State, cellPos, pathogenPos, pulseTargets, nodeAt, surging, activeBosses, openNeed } from './sim';
import { drawLungs, drawBrain, drawLiver, drawKidney, drawSpleen, drawGut, drawMarrow, drawStomach, drawLymphNode, drawSkin, drawEye } from './organs';
import { inkify, inkSprite, paper, hatchPattern, seeded } from './ink';

export interface View {
  hoverVessel: VesselId | null;
  hoverSite: string | null;
  selectedSite: string | null;
  /** Which page of the build popover is open. */
  popMode: 'main' | 'aim' | 'reaim' | 'dualA' | 'dualB' | 'addSecond' | 'reaimA' | 'reaimB';
  /** Dual-target IgG: the first target chosen. */
  dualFirst: BacteriumType | null;
  showPulseRadius: boolean;
  /** The tutorial's map pointer: a pulsing ring here. */
  coachAt: Vec | null;
  /** The pathogen whose details card is open (ringed on the map). */
  inspectId?: number | null;
  touch: boolean;
}

export const NODE_COLORS: Record<NodeType, { base: string; dark: string; light: string }> = {
  igm: { base: '#e0a33a', dark: '#8a5a12', light: '#f6d68a' },
  igg: { base: '#4a8ad8', dark: '#1e4a8a', light: '#a8ccf6' },
  iga: { base: '#4ab88a', dark: '#1e6a4a', light: '#a8e8c8' },
  ige: { base: '#c8508a', dark: '#6a1e4a', light: '#f0b8d8' },
};

const C = {
  paper: '#f4ead8', ink: '#2a1e18',
  wall: '#8a2a2a', wallLight: '#c86a5e', lumen: '#b8343a', lumenDeep: '#8a1e24',
  heart: '#c8554e', heartDark: '#7a2420',
  bacterium: '#6aa84a', bacteriumDark: '#2e5a22', virus: '#8a4ab8', virusDark: '#4a1e70',
  hijacker: '#e0702a', hijackerDark: '#8a3a10',
  cell: '#fdfcf8', nucleus: '#6a4aa8', pulse: '#4ab8d8',
};

// the map backgrounds made so far, by organ (the current one and one made ahead)
const BGS = new Map<string, HTMLCanvasElement>();
function background(L: LevelDef = LEVEL): HTMLCanvasElement {
  const have = BGS.get(L.id);
  if (have) return have;
  if (BGS.size >= 2) BGS.delete(BGS.keys().next().value!);
  const bg = document.createElement('canvas');
  BGS.set(L.id, bg);
  bg.width = W * 2; bg.height = H * 2;
  const ctx = bg.getContext('2d')!;
  ctx.scale(2, 2);
  paper(ctx, W, H, 3);
  // a faint warm wash where the organ sits
  const O = L.map.center;
  const g = ctx.createRadialGradient(O.x, O.y, 60, O.x, O.y, 420 + Math.max(L.map.rx, L.map.ry));
  g.addColorStop(0, 'rgba(230,170,150,0.18)'); g.addColorStop(1, 'rgba(230,170,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.lineWidth = 0.8; ctx.strokeRect(15, 15, W - 30, H - 30);
  if (L.id === 'liver') {
    // the gut, inked on its own image so the paper behind stays as it is
    const gut = document.createElement('canvas'); gut.width = 640; gut.height = 240;
    const x = gut.getContext('2d', { willReadFrequently: true })!; x.scale(2, 2); x.translate(0, -880); drawGut(x);
    inkify(gut, { px: 2 });
    ctx.drawImage(gut, 0, 880, 320, 120);
  }
  return bg;
}

/** A vessel's winding course, as a path. It carries on past its end, into the organ (which is drawn over it),
 *  so no vessel is ever seen stopping short of the organ's outline. */
function course(ctx: CanvasRenderingContext2D, v: Vessel) {
  ctx.beginPath(); ctx.moveTo(v.cx[0], v.cy[0]);
  for (let i = 2; i < v.cx.length; i += 2) ctx.lineTo(v.cx[i], v.cy[i]);
  const ex = v.cx[v.cx.length - 1], ey = v.cy[v.cy.length - 1];
  ctx.lineTo(ex, ey);
  ctx.lineTo(ex + (HEART.x - ex) * 0.6, ey + (HEART.y - ey) * 0.6);
}

export function vesselWidth(s: State, v: VesselId) {
  const k = s.width[v], e = k * k * (3 - 2 * k);
  return CONFIG.vesselRestWidth + (CONFIG.vesselDilatedWidth - CONFIG.vesselRestWidth) * e;
}

// ── Ink overlays: tags, bars and beads drawn as pen on paper with faint washes, to match the map ──
const WASH = { red: '#dc9a8e', blue: '#a8d4e6', gold: '#ecd38e', green: '#bcd6a8', violet: '#c8b4dc' };
const INKC = '#231a14', PAPERC = '#f2e9d4', INK_RED = '#6e2622', INK_BLUE = '#1e5a78';

/** A paper slip with a firm ink rule, a fine second rule inside it and a small offset shadow. */
function inkTag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wash: string | null = null, r = 6) {
  ctx.save();
  ctx.fillStyle = 'rgba(35,26,20,0.22)'; ctx.beginPath(); ctx.roundRect(x + 2.5, y + 3, w, h, r); ctx.fill();
  ctx.fillStyle = PAPERC; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  if (wash) {
    ctx.fillStyle = wash; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    const hp = hatchPattern(ctx); if (hp) { ctx.fillStyle = hp; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
  }
  ctx.strokeStyle = INKC; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(35,26,20,0.45)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 3)); ctx.stroke();
  ctx.restore();
}

/** A gauge: paper, a hatched wash filled to `frac`, ink outline and an ink line at the level. */
function inkBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, wash: string) {
  const f = Math.max(0, Math.min(1, frac));
  ctx.save();
  ctx.fillStyle = PAPERC; ctx.fillRect(x, y, w, h);
  if (f > 0) {
    ctx.fillStyle = wash; ctx.fillRect(x, y, w * f, h);
    const hp = hatchPattern(ctx); if (hp) { ctx.fillStyle = hp; ctx.globalAlpha = 0.45; ctx.fillRect(x, y, w * f, h); ctx.globalAlpha = 1; }
    ctx.strokeStyle = INKC; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + w * f, y); ctx.lineTo(x + w * f, y + h); ctx.stroke();
  }
  ctx.strokeStyle = INKC; ctx.lineWidth = h > 6 ? 1.5 : 1.1; ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** Floating words in ink, with a paper edge so they read over anything. */
function inkText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, size = 24) {
  ctx.save(); ctx.font = `italic 700 ${size}px Palatino, Georgia, serif`; ctx.textAlign = 'center';
  ctx.lineJoin = 'round'; ctx.strokeStyle = PAPERC; ctx.lineWidth = 5; ctx.strokeText(text, x, y);
  ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.restore();
}

function drawVessel(ctx: CanvasRenderingContext2D, s: State, v: VesselId, view: View, t: number, flowT: number) {
  const ves = VESSELS[v], w = vesselWidth(s, v), open = s.width[v];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (view.hoverVessel === v && s.phase === 'combat') { ctx.strokeStyle = 'rgba(74,184,216,0.35)'; ctx.lineWidth = w + 34; course(ctx, ves); ctx.stroke(); }
  // pen-and-ink: a firm outline, a pale rose wash, the walls hatched, a paler lumen down the middle
  ctx.strokeStyle = C.ink; ctx.lineWidth = w + 14; course(ctx, ves); ctx.stroke();
  ctx.strokeStyle = '#e6c2b6'; ctx.lineWidth = w + 9.5; course(ctx, ves); ctx.stroke();
  const hp = hatchPattern(ctx);
  if (hp) { ctx.globalAlpha = 0.6; ctx.strokeStyle = hp; ctx.lineWidth = w + 9.5; course(ctx, ves); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.strokeStyle = 'rgba(35,26,20,0.55)'; ctx.lineWidth = w + 1.2; course(ctx, ves); ctx.stroke();
  ctx.strokeStyle = '#efd2c6'; ctx.lineWidth = w; course(ctx, ves); ctx.stroke();
  ctx.strokeStyle = '#f2ddd2'; ctx.lineWidth = w * 0.55; course(ctx, ves); ctx.stroke();
  if (open > 0.02) {
    ctx.globalAlpha = Math.min(1, open * 1.4) * 0.85;
    ctx.strokeStyle = 'rgba(35,26,20,0.5)'; ctx.lineWidth = 1.6;
    const step = 46, off = (t * 70) % step;
    for (let d = off; d < ves.length; d += step) {
      const p = pointAt(ves, d), a = p.angle, sz = w * 0.28;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * sz - Math.sin(a) * sz, p.y - Math.sin(a) * sz + Math.cos(a) * sz);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(a) * sz + Math.sin(a) * sz, p.y - Math.sin(a) * sz - Math.cos(a) * sz);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const acid = LEVEL.acid;
  if (acid) {
    // the acid stretch: a yellow-green wash in the lumen, with bubbles ringed in ink drifting along it
    const from = ves.length * (1 - acid.fraction);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,210,90,0.5)'; ctx.lineWidth = w * 0.8; ctx.beginPath();
    for (let d = from; d <= ves.length; d += 8) { const p = pointAt(ves, d); d === from ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,90,20,0.6)'; ctx.lineWidth = 1;
    for (let d = from + ((t * 18) % 16); d < ves.length; d += 16) {
      const p = pointAt(ves, d), side = Math.sin(d * 0.37) * w * 0.25;
      ctx.beginPath(); ctx.arc(p.x - Math.sin(p.angle) * side, p.y + Math.cos(p.angle) * side, 2 + Math.abs(Math.sin(d)) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  const filt = LEVEL.filtration;
  if (filt) {
    // the filtered stretch: a pale sieve across the vessel
    ctx.strokeStyle = 'rgba(255,236,170,0.75)'; ctx.lineWidth = 2.2;
    for (let d = ves.length * (1 - filt.fraction); d < ves.length; d += 11) {
      const p = pointAt(ves, d), nx = -Math.sin(p.angle) * (w / 2 + 2), ny = Math.cos(p.angle) * (w / 2 + 2);
      ctx.beginPath(); ctx.moveTo(p.x - nx, p.y - ny); ctx.lineTo(p.x + nx, p.y + ny); ctx.stroke();
    }
  }
  // red cells drifting with the blood: a rose wash ringed in fine ink
  ctx.fillStyle = 'rgba(200,90,90,0.35)'; ctx.strokeStyle = 'rgba(35,26,20,0.55)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 12; i++) {
    const d = ((flowT * 40 + i * 71) % ves.length);
    const p = pointAt(ves, d), side = ((i * 37) % 9 - 4) * (w / 12);
    ctx.beginPath(); ctx.ellipse(p.x - Math.sin(p.angle) * side, p.y + Math.cos(p.angle) * side, 4.5, 3, p.angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** Where a vessel forks: a rounded knot in the vessel wall so the split reads as one vessel becoming two. */
function drawJunction(ctx: CanvasRenderingContext2D, s: State, v: VesselId) {
  const q = pointAt(VESSELS[v], forkAt(v));
  const sib = routesOf(entryOf(v)).find((r) => r !== v)!;
  const w = Math.max(vesselWidth(s, v), vesselWidth(s, sib));
  ctx.save();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(q.x, q.y, w / 2 + 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e6c2b6'; ctx.beginPath(); ctx.arc(q.x, q.y, w / 2 + 6.5, 0, Math.PI * 2); ctx.fill();
  const hp = hatchPattern(ctx);
  if (hp) { ctx.globalAlpha = 0.45; ctx.fillStyle = hp; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(35,26,20,0.55)'; ctx.beginPath(); ctx.arc(q.x, q.y, w / 2 + 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#efd2c6'; ctx.beginPath(); ctx.arc(q.x, q.y, w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2ddd2'; ctx.beginPath(); ctx.arc(q.x, q.y, w * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** The heart at rest, at the origin: great vessels, auricles, chambers, coronary arteries and veins,
 *  fat along the grooves. Drawn once into the organ image; the beat scales it. */
function drawHeartBody(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.scale(1.15, 1.15);
  const heart = () => { ctx.beginPath(); ctx.moveTo(0, 105); ctx.bezierCurveTo(-95, 30, -100, -70, -42, -92); ctx.bezierCurveTo(-14, -104, 0, -80, 4, -66); ctx.bezierCurveTo(22, -104, 92, -96, 92, -30); ctx.bezierCurveTo(92, 34, 30, 80, 0, 105); ctx.closePath(); };
  // the great vessels: aorta and pulmonary arteries (red), superior vena cava (blue), with their walls
  for (const [vx, vw, col] of [[-26, 24, '#b8433a'], [4, 20, '#4a6aa8'], [30, 18, '#b8433a']] as const) {
    ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(vx - vw / 2, -150, vw, 70, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(vx - vw / 2 + 3, -146, 4, 60);
    ctx.fillStyle = 'rgba(30,10,10,0.55)'; ctx.beginPath(); ctx.ellipse(vx, -148, vw / 2 - 3, 4, 0, 0, Math.PI * 2); ctx.fill(); // the open lumen
  }
  // the auricles: small ear-like flaps of the atria
  for (const [ax, ay, sx] of [[-60, -78, -1], [64, -74, 1]] as const) {
    ctx.fillStyle = '#b8504a'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.bezierCurveTo(ax + sx * 22, ay - 18, ax + sx * 30, ay + 4, ax + sx * 14, ay + 14); ctx.bezierCurveTo(ax + sx * 6, ay + 10, ax, ay + 6, ax, ay); ctx.fill(); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, 120);
  g.addColorStop(0, '#e08a7e'); g.addColorStop(0.6, C.heart); g.addColorStop(1, C.heartDark);
  heart(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); heart(); ctx.clip();
  // the right ventricle a shade lighter than the thick left one
  ctx.fillStyle = 'rgba(255,200,190,0.12)'; ctx.beginPath(); ctx.ellipse(-40, 10, 50, 80, 0.2, 0, Math.PI * 2); ctx.fill();
  // fat along the coronary and interventricular grooves
  ctx.strokeStyle = 'rgba(250,220,140,0.75)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(4, -64); ctx.bezierCurveTo(-18, -14, -20, 40, -2, 100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-88, -36); ctx.quadraticCurveTo(0, -58, 90, -40); ctx.stroke();
  // coronary arteries (red) in the grooves, branching over the ventricles; cardiac veins (blue) beside them
  const branch = (x: number, y: number, a: number, len: number, w: number, d: number, col: string) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.35) * len * 0.5, y + Math.sin(a + 0.35) * len * 0.5, x2, y2); ctx.stroke();
    if (d > 0) { branch(x2, y2, a - 0.55, len * 0.66, w * 0.7, d - 1, col); branch(x2, y2, a + 0.45, len * 0.62, w * 0.7, d - 1, col); }
  };
  ctx.strokeStyle = '#a8202a'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(4, -64); ctx.bezierCurveTo(-18, -14, -20, 40, -2, 100); ctx.stroke(); // left anterior descending
  ctx.beginPath(); ctx.moveTo(-6, -58); ctx.quadraticCurveTo(-60, -52, -90, -30); ctx.stroke(); // right coronary
  ctx.beginPath(); ctx.moveTo(8, -60); ctx.quadraticCurveTo(50, -54, 90, -34); ctx.stroke(); // circumflex
  for (const [x, y, a] of [[-8, -30, 2.3], [-12, 10, 2.5], [-10, 50, 2.4], [-6, -20, 0.6], [-10, 20, 0.7], [-6, 60, 0.6], [50, -50, 1.5], [-55, -48, 1.7]] as const) branch(x, y, a, 24, 2.2, 2, '#a8202a');
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#3a5a9a'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(14, -62); ctx.bezierCurveTo(-8, -14, -10, 40, 8, 98); ctx.stroke(); // great cardiac vein
  for (const [x, y, a] of [[4, -20, 0.5], [0, 30, 0.6]] as const) branch(x, y, a, 22, 1.8, 1, '#3a5a9a');
  ctx.globalAlpha = 1;
  ctx.restore();
  heart(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-50, -50, 14, 24, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Organ images: each organ's still drawing is made once and reused every frame ──
const ORGAN_HALF = ORGAN_SPAN / 2; // map units around the organ's centre that the image covers
// organ images made so far (the current organ, and one made ahead of time)
const ORGANS = new Map<string, { img: HTMLCanvasElement; red: HTMLCanvasElement }>();
function organImages(px: number, L: LevelDef = LEVEL) {
  const m = L.map, key = organCacheKey(L.id, m.rx, m.ry, px);
  const have = ORGANS.get(key);
  if (have) return have;
  if (ORGANS.size >= 2) ORGANS.delete(ORGANS.keys().next().value!);
  const size = Math.ceil(ORGAN_HALF * 2 * px);
  const img = document.createElement('canvas'); img.width = img.height = size;
  const x = img.getContext('2d')!; x.scale(px, px);
  const c = { x: ORGAN_HALF, y: ORGAN_HALF };
  if (L.id === 'heart') { x.translate(c.x, c.y); drawHeartBody(x); }
  else if (L.id === 'lungs') drawLungs(x, c, 1, 0);
  else if (L.id === 'brain') drawBrain(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'liver') drawLiver(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'spleen') drawSpleen(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'marrow') drawMarrow(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'stomach') drawStomach(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'lymphnode') drawLymphNode(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'skin') drawSkin(x, c, m.rx, m.ry, 1, 0);
  else if (L.id === 'eye') drawEye(x, c, m.rx, m.ry, 1, 0);
  else drawKidney(x, c, m.rx, m.ry, 1, 0);
  // darker organs are lifted to a common lightness, so none is solid cross-hatching
  inkify(img, { px, form: 44, level: 0.3 });
  // a red copy of the same shape, laid over it when the organ is hit
  const red = document.createElement('canvas'); red.width = red.height = size;
  const r = red.getContext('2d')!; r.drawImage(img, 0, 0); r.globalCompositeOperation = 'source-atop'; r.fillStyle = 'rgb(255,60,50)'; r.fillRect(0, 0, size, size);
  const made = { img, red };
  ORGANS.set(key, made);
  return made;
}

let lastPx = 1;
/** Make an organ's background and inked image ahead of time (when the browser is idle), so opening it later doesn't
 *  pause while it is inked. */
export function prepareOrgan(index: number) {
  const L = LEVELS[index];
  if (!L || typeof document === 'undefined') return;
  const idle = (f: () => void) => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(f) : setTimeout(f, 200));
  idle(() => { background(L); idle(() => organImages(lastPx, L)); });
}

/** Draw the organ from its image, scaled by its beat or breath, with the hit flash over it. */
function drawOrganImage(ctx: CanvasRenderingContext2D, scale: number, kick: number) {
  // the image is made at the on-screen scale (rounded to a half, so resizing only rebuilds it at each step),
  // and never more than 4096 pixels across
  const m = ctx.getTransform(), px = organImageScale(Math.hypot(m.a, m.b));
  lastPx = px;
  const { img, red } = organImages(px), c = LEVEL.map.center;
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(scale, scale);
  ctx.drawImage(img, -ORGAN_HALF, -ORGAN_HALF, ORGAN_HALF * 2, ORGAN_HALF * 2);
  if (kick > 0) { ctx.globalAlpha = kick * 0.42; ctx.drawImage(red, -ORGAN_HALF, -ORGAN_HALF, ORGAN_HALF * 2, ORGAN_HALF * 2); }
  ctx.restore();
}

/** Organ health as a ring of beads around the organ. */
function drawHealthBeads(ctx: CanvasRenderingContext2D, s: State) {
  const n = LEVEL.hp, heart = LEVEL.id === 'heart';
  const rx = heart ? 159 : LEVEL.map.rx + 50, ry = heart ? 159 : LEVEL.map.ry + 50;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = HEART.x + Math.cos(a) * rx, y = HEART.y + 4 + Math.sin(a) * ry;
    // a bead of health: a hatched rose wash ringed in ink; a lost one is an empty pen circle
    ctx.fillStyle = PAPERC; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2); ctx.fill();
    if (i < s.heartHp) {
      ctx.fillStyle = WASH.red; ctx.fill();
      const hp = hatchPattern(ctx); if (hp) { ctx.fillStyle = hp; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = INKC; ctx.lineWidth = 1.6; ctx.stroke();
    } else { ctx.strokeStyle = 'rgba(35,26,20,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
  }
  // the liver's gallbladder: a green drop on the ring at the health where it bursts, pulsing as health nears it
  const gb = LEVEL.gallbladder;
  if (gb && !s.bile.length) {
    const at = Math.floor(n * gb.at), a = -Math.PI / 2 + ((at - 0.5) / n) * Math.PI * 2;
    const x = HEART.x + Math.cos(a) * (rx + 22), y = HEART.y + 4 + Math.sin(a) * (ry + 22);
    const near = s.heartHp - at <= 3, k = near ? 1 + 0.25 * Math.abs(Math.sin(performance.now() / 160)) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(7, -2, 8, 4, 0, 8); ctx.bezierCurveTo(-8, 4, -7, -2, 0, -11); ctx.closePath();
    ctx.fillStyle = near ? 'rgba(120,170,40,0.95)' : 'rgba(150,190,80,0.8)'; ctx.fill(); ctx.strokeStyle = INKC; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
    if (near) inkText(ctx, 'gallbladder', x, y - 16, '#3e6a1e', 14);
  }
}

function drawOrgan(ctx: CanvasRenderingContext2D, s: State, t: number) {
  const m = LEVEL.map, kick = s.heartKick;
  if (LEVEL.id === 'heart') {
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.15)), 8) * 0.035;
    drawOrganImage(ctx, 1 + beat + kick * 0.08, kick);
  } else if (LEVEL.id === 'lungs') {
    const breath = surging(s) ? 1.05 : 1 + 0.012 * Math.sin(t * 1.6);
    drawOrganImage(ctx, breath + kick * 0.03, kick);
    if (surging(s)) {
      ctx.save(); ctx.font = '900 30px Palatino, Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,234,216,0.92)'; ctx.fillRect(m.center.x - 90, m.center.y - 395, 180, 44);
      ctx.fillStyle = '#1e6a8a'; ctx.fillText('INHALE', m.center.x, m.center.y - 362); ctx.restore();
    }
  } else {
    const swell = 1 + Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.5)), 6) * 0.012 + kick * 0.04;
    drawOrganImage(ctx, swell, kick);
  }
  drawHealthBeads(ctx, s);
  drawNoGauge(ctx, s, t);
}

/** The NO gauge: a small bar under the organ, flashing when too low to open a vessel. */
function drawNoGauge(ctx: CanvasRenderingContext2D, s: State, t: number) {
  if (s.phase !== 'combat') return;
  const heart = LEVEL.id === 'heart', y = HEART.y + (heart ? 159 : LEVEL.map.ry + 50) + 30, w = 150;
  const low = s.no < openNeed() && !s.open.length, k = s.no / s.perks.noMax;
  ctx.save();
  ctx.globalAlpha = low ? 0.55 + 0.45 * Math.abs(Math.sin(t * 5)) : 1;
  inkTag(ctx, HEART.x - w / 2 - 44, y - 14, w + 96, 28, null, 8);
  ctx.fillStyle = INK_BLUE; ctx.font = 'italic 700 16px Palatino, Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('NO', HEART.x - w / 2 - 34, y + 6);
  inkBar(ctx, HEART.x - w / 2, y - 5, w, 10, k, low ? WASH.red : WASH.blue);
  ctx.fillStyle = INKC; ctx.font = '700 16px Palatino, Georgia, serif'; ctx.fillText(String(Math.floor(s.no)), HEART.x + w / 2 + 8, y + 6);
  ctx.restore();
}

/** A lymph node in its type colour, with a letter badge (M / G / A). */
export function drawNodeIcon(ctx: CanvasRenderingContext2D, type: NodeType, x: number, y: number, k = 1, flash = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k * (1 + flash * 0.12), k * (1 + flash * 0.12));
  inkSprite(ctx, `node:${type}`, 46, (c) => nodeBody(c, type), { gap: 2.4, lw: 0.38, wash: 0.55 });
  // the letter is set after inking, so it stays crisp
  ctx.fillStyle = NODE_COLORS[type].dark; ctx.font = 'italic 900 17px Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(type === 'igm' ? 'M' : type === 'igg' ? 'G' : type === 'iga' ? 'A' : 'E', 0, 3);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function nodeBody(ctx: CanvasRenderingContext2D, type: NodeType) {
  const col = NODE_COLORS[type];
  const bean = () => { ctx.beginPath(); ctx.moveTo(-38, 0); ctx.bezierCurveTo(-44, -36, 44, -36, 40, 0); ctx.bezierCurveTo(36, 28, 6, 14, 0, 20); ctx.bezierCurveTo(-10, 28, -36, 24, -38, 0); ctx.closePath(); };
  const g = ctx.createRadialGradient(-12, -12, 4, 0, 0, 44); g.addColorStop(0, col.light); g.addColorStop(1, col.base);
  bean(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; ctx.fillStyle = col.dark; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -4 + Math.sin(a) * 15, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 2, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (type === 'ige') {
    // a heavy hitter that burns out: spark ticks around the badge
    ctx.strokeStyle = col.dark; ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 15, 2 + Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * 21, 2 + Math.sin(a) * 21); ctx.stroke(); }
  }
}

function drawSites(ctx: CanvasRenderingContext2D, s: State, view: View, t: number) {
  for (const site of SITES) {
    const node = nodeAt(s, site.id);
    // tether to the section of vessel it guards
    ctx.strokeStyle = node ? 'rgba(42,30,24,0.55)' : 'rgba(42,30,24,0.22)'; ctx.lineWidth = 2.4; ctx.setLineDash(node ? [] : [4, 5]);
    ctx.beginPath(); ctx.moveTo(site.x, site.y); ctx.lineTo(site.anchor.x, site.anchor.y); ctx.stroke(); ctx.setLineDash([]);
    const hot = view.hoverSite === site.id || view.selectedSite === site.id;
    if (node) {
      const st = CONFIG.nodes[node.type];
      if (hot || s.phase === 'prep') {
        ctx.fillStyle = 'rgba(42,30,24,0.05)'; ctx.strokeStyle = hot ? 'rgba(42,30,24,0.6)' : 'rgba(42,30,24,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
        ctx.beginPath(); ctx.arc(site.x, site.y, st.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      if (node.off) ctx.globalAlpha = 0.4;
      drawNodeIcon(ctx, node.type, site.x, site.y, 1.05, node.flash);
      ctx.globalAlpha = 1;
      if (node.off) {
        // switched off by HIV: struck through in violet ink
        ctx.save(); ctx.strokeStyle = 'rgba(90,40,120,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(site.x - 26, site.y - 20); ctx.lineTo(site.x + 26, site.y + 20); ctx.moveTo(site.x + 26, site.y - 20); ctx.lineTo(site.x - 26, site.y + 20); ctx.stroke(); ctx.restore();
        inkText(ctx, 'off', site.x, site.y + 42, '#5a2878', 15);
      } else if ((node.power ?? 1) < 1) inkText(ctx, `${Math.round((node.power ?? 1) * 100)}%`, site.x, site.y + 42, INK_RED, 15);
    } else if (s.phase === 'prep') {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + site.index);
      ctx.fillStyle = hot ? 'rgba(74,184,216,0.25)' : 'rgba(255,255,255,0.55)';
      ctx.strokeStyle = hot ? '#1e6a8a' : `rgba(42,30,24,${0.4 + 0.25 * k})`; ctx.lineWidth = 2.4; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(site.x, site.y, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = hot ? '#1e6a8a' : 'rgba(42,30,24,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(site.x - 9, site.y); ctx.lineTo(site.x + 9, site.y); ctx.moveTo(site.x, site.y - 9); ctx.lineTo(site.x, site.y + 9); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(42,30,24,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(site.x, site.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

export function drawPathogen(ctx: CanvasRenderingContext2D, type: PathogenType, x: number, y: number, angle: number, hit: number, scale = 1, t = 0) {
  if (CONFIG.pathogens[type].boss) { drawBoss(ctx, type as BossType, x, y, angle, hit, scale, t); return; }
  if (CONFIG.pathogens[type].taxon) { drawBacterium(ctx, type as BacteriumType, x, y, angle, hit, scale, t); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const h = hit > 0 ? 'hit' : '';
  if (type === 'virus') inkSprite(ctx, `virus${h}`, 17, (c) => drawSmall(c, type, hit, 0), { gap: 1.8, lw: 0.3, wash: 0.5 });
  else if (type === 'hijacker') { ctx.rotate(t * 2); inkSprite(ctx, `hijacker${h}`, 21, (c) => drawSmall(c, type, hit, 0), { gap: 1.8, lw: 0.3, wash: 0.5 }); }
  else {
    // the membrane ripples: a few dozen frames of it, inked once each
    const step = Math.PI / 24, tq = Math.round((((t % Math.PI) + Math.PI) % Math.PI) / step) % 24;
    inkSprite(ctx, `infected${h}:${tq}`, 20, (c) => drawSmall(c, type, hit, tq * step), { gap: 1.8, lw: 0.3, wash: 0.5 });
  }
  ctx.restore();
}

/** A virus, hijacker or infected cell at the origin, in colour (inked by the caller). */
function drawSmall(ctx: CanvasRenderingContext2D, type: PathogenType, hit: number, t: number) {
  if (type === 'virus') {
    // a virion: a faceted icosahedral capsid with glycoprotein spikes, each tipped with a knob
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 12.5, Math.sin(a) * 12.5); ctx.stroke();
      ctx.fillStyle = i % 2 ? '#ff7ab8' : '#ffb0d8'; ctx.beginPath(); ctx.arc(Math.cos(a) * 13.2, Math.sin(a) * 13.2, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#e6ccf8'); g.addColorStop(0.55, '#a878d8'); g.addColorStop(1, C.virusDark);
    const facets = (r: number) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.26; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    facets(9); ctx.fillStyle = hit > 0 ? '#ffffff' : g; ctx.fill();
    if (hit <= 0) {
      // the capsid's triangular faces, and the coiled genome glimpsed inside
      ctx.strokeStyle = 'rgba(60,20,90,0.45)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,230,250,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0.4, 5.4); ctx.stroke();
    }
    facets(9); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.7; ctx.stroke();
  } else if (type === 'hijacker') {
    // a hijacker: a spinning hexagonal envelope with barbed docking spikes and a dark injection core
    ctx.rotate(t * 2);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14 + Math.cos(a + 1.6) * 3.2, Math.sin(a) * 14 + Math.sin(a + 1.6) * 3.2); ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); ctx.lineTo(Math.cos(a) * 14 - Math.cos(a + 1.6) * 3.2, Math.sin(a) * 14 - Math.sin(a + 1.6) * 3.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      // a smaller barb between each pair of spikes
      const b = a + Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(b) * 9, Math.sin(b) * 9); ctx.lineTo(Math.cos(b) * 12.5, Math.sin(b) * 12.5); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10); g.addColorStop(0, '#ffd8a8'); g.addColorStop(0.6, '#e08a3a'); g.addColorStop(1, C.hijackerDark);
    ctx.fillStyle = hit > 0 ? '#ffffff' : g;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,50,10,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); } ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#2a1008'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
  } else {
    // an infected white cell: a sickly, rippling membrane; its lobed nucleus; new virions crowding inside; a red glare
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; const r = 15 + Math.sin(a * 5 + t * 6) * 1.8 + Math.sin(a * 9 - t * 4) * 0.8; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 17); g.addColorStop(0, '#e2d0ee'); g.addColorStop(0.7, '#b89ad0'); g.addColorStop(1, '#7a5a98');
    ctx.fillStyle = hit > 0 ? '#ffffff' : g; ctx.fill(); ctx.strokeStyle = '#4a1e70'; ctx.lineWidth = 2.4; ctx.stroke();
    if (hit <= 0) {
      ctx.fillStyle = 'rgba(80,40,110,0.55)'; // a lobed nucleus, pushed aside
      for (const [dx, dy, r] of [[-6, 3, 4.2], [-2, 7, 3.6], [-8, -2, 3.4]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#7a3a0a'; ctx.lineWidth = 0.8;
      for (const [dx, dy] of [[4, -3], [7, 3], [2, 4], [6, -8], [9, -2]]) { ctx.fillStyle = '#e0702a'; ctx.beginPath(); ctx.arc(dx, dy, 2.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(-3, -9, 1.9, 0, Math.PI * 2); ctx.arc(4, -9, 1.9, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawWhiteCell(ctx: CanvasRenderingContext2D, x: number, y: number, hit: number, t: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  // a soft blue halo so the player's cells stand out, then the cell itself, inked (its membrane ripples: 12 frames)
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
  halo.addColorStop(0, 'rgba(190,225,245,0.55)'); halo.addColorStop(1, 'rgba(160,210,240,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  const step = Math.PI / 24, tq = Math.round((((t % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) / step) % 12;
  inkSprite(ctx, `cell${hit > 0 ? 'hit' : ''}:${tq}`, 19, (c) => cellBody(c, hit, tq * step), { gap: 1.8, lw: 0.3, wash: 0.6, tone: -0.1 });
  ctx.restore();
}

function cellBody(ctx: CanvasRenderingContext2D, hit: number, t: number) {
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2; const r = 15 + Math.sin(a * 3 + t * 4) * 1.2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath();
  ctx.fillStyle = hit > 0 ? '#ffc8c8' : '#c4dcee'; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = C.nucleus;
  for (const [dx, dy] of [[-5, -3], [1, 4], [6, -3]]) { ctx.beginPath(); ctx.arc(dx, dy, 4.4, 0, Math.PI * 2); ctx.fill(); }
}

/** An immunoglobulin in flight: IgM a five-armed pentamer, IgG a single Y, IgA a paired dimer. */
function drawAntibody(ctx: CanvasRenderingContext2D, type: NodeType, x: number, y: number, a: number) {
  const col = NODE_COLORS[type];
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // each Y in pen, with a thin line of its node's colour down the middle
  const Y = (rot: number, k: number) => {
    ctx.save(); ctx.rotate(rot); ctx.scale(k, k);
    const path = () => { ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 0); ctx.lineTo(-4, -5); ctx.moveTo(0, 0); ctx.lineTo(4, -5); };
    const lw = ctx.lineWidth; ctx.strokeStyle = INKC; path(); ctx.stroke();
    ctx.strokeStyle = col.base; ctx.lineWidth = lw * 0.4; path(); ctx.stroke(); ctx.lineWidth = lw;
    ctx.restore();
  };
  ctx.lineWidth = 2.6;
  if (type === 'igm') { for (let i = 0; i < 5; i++) Y((i / 5) * Math.PI * 2, 0.9); ctx.fillStyle = col.light; ctx.strokeStyle = INKC; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  else if (type === 'igg') { ctx.lineWidth = 3; Y(0, 1.3); }
  else if (type === 'ige') {
    // IgE: a heavy, long-stemmed Y in a glow, like a harpoon
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, 'rgba(240,180,215,0.5)'); g.addColorStop(1, 'rgba(240,180,215,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INKC; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, 0); ctx.stroke();
    Y(0, 1.7);
  }
  else { Y(-0.5, 1); Y(Math.PI - 0.5, 1); ctx.fillStyle = col.light; ctx.strokeStyle = INKC; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string) {
  inkBar(ctx, x - w / 2, y, w, 5, frac, col);
}


let flowT = 0, lastT = 0;
let labelCache: { level: unknown; labels: MapLabel[] } = { level: null, labels: [] };
export function draw(ctx: CanvasRenderingContext2D, s: State, view: View, t: number) {
  const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
  flowT += dt * (surging(s) ? LEVEL.surge!.factor * 1.6 : 1);
  ctx.drawImage(background(), 0, 0, W, H);
  // the open route last, so its widened stem lies over its sibling's
  const order = [...VESSEL_IDS].sort((a, b) => (s.open.includes(a) ? 1 : 0) - (s.open.includes(b) ? 1 : 0));
  for (const v of order) drawVessel(ctx, s, v, view, t, flowT);
  for (const v of VESSEL_IDS) if (isFinite(forkAt(v)) && routesOf(entryOf(v))[0] === v) drawJunction(ctx, s, v);
  // vessel names, laid out once per organ to clear the sites, the organ, the next-wave tags and each other
  ctx.font = '700 24px Palatino, Georgia, serif'; ctx.textAlign = 'center';
  if (labelCache.level !== LEVEL) labelCache = { level: LEVEL, labels: layoutLabels((text) => ctx.measureText(text).width) };
  const avoid: { x: number; y: number; w: number; h: number }[] = [];
  for (const { v, lx, ly, text, branch } of labelCache.labels) {
    ctx.font = '700 24px Palatino, Georgia, serif';
    const tw = ctx.measureText(text).width;
    avoid.push({ x: lx - tw / 2 - 10, y: ly - 23, w: tw + 20, h: s.open.includes(v) ? 66 : 32 });
    ctx.fillStyle = 'rgba(244,234,216,0.9)'; ctx.fillRect(lx - tw / 2 - 10, ly - 23, tw + 20, 32);
    ctx.fillStyle = C.ink; ctx.fillText(text, lx, ly);
    // the DILATED tag goes on the open route's own label: a branch's, or an unforked vessel's
    if (s.open.includes(v) && (branch || routesOf(entryOf(v)).length === 1)) {
      inkTag(ctx, lx - 58, ly + 13, 116, 30, WASH.blue, 8);
      ctx.fillStyle = INK_BLUE; ctx.font = 'italic 700 17px Palatino, Georgia, serif'; ctx.fillText('DILATED', lx, ly + 34);
    }
  }
  // skin wounds: a dark cut across the vessel where pathogens have come in, kept for the rest of the organ
  for (const w of s.wounds) {
    if (!VESSELS[w.vessel]) continue;
    const q = pointAt(VESSELS[w.vessel], w.at), nx = -Math.sin(q.angle), ny = Math.cos(q.angle), tx = Math.cos(q.angle), ty = Math.sin(q.angle);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = INKC; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(q.x - nx * 28 - tx * 6, q.y - ny * 28 - ty * 6); ctx.lineTo(q.x + nx * 28 + tx * 6, q.y + ny * 28 + ty * 6); ctx.stroke();
    ctx.strokeStyle = '#8a1e24'; ctx.lineWidth = 4; ctx.stroke();
    inkText(ctx, 'wound', q.x + nx * 40, q.y + ny * 40, '#6e2622', 14);
    ctx.restore();
  }
  // bile from the burst gallbladder: green stains where its lymph nodes were destroyed
  for (const b of s.bile) {
    const R = seeded(Math.round(b.x * 3 + b.y * 7));
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2, r = 30 + (R() - 0.5) * 16; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(140,176,60,0.55)'; ctx.fill();
    const hp = hatchPattern(ctx); if (hp) { ctx.fillStyle = hp; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(50,70,20,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(110,150,40,0.7)';
    for (let i = 0; i < 7; i++) { const a = R() * Math.PI * 2, r = 36 + R() * 14; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.8, 2 + R() * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  drawSites(ctx, s, view, t);
  drawOrgan(ctx, s, t);

  for (const sh of s.shots) drawAntibody(ctx, sh.type, sh.x, sh.y, Math.atan2(sh.y - sh.sy, sh.x - sh.sx));

  const eligible = s.phase === 'combat' && s.pulsesLeft > 0 ? new Set(pulseTargets(s).map((p) => p.id)) : new Set<number>();
  for (const p of s.pathogens) {
    const q = pathogenPos(p);
    if (eligible.has(p.id) && (view.touch || view.showPulseRadius)) {
      ctx.strokeStyle = INK_BLUE; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(q.x, q.y, CONFIG.pathogens[p.type].boss ? 62 : CONFIG.pathogens[p.type].taxon ? 30 : 24, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (view.inspectId === p.id) {
      ctx.save(); ctx.strokeStyle = INKC; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 12;
      ctx.beginPath(); ctx.arc(q.x, q.y, CONFIG.pathogens[p.type].boss ? 70 : 34, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (p.slowT > 0) { ctx.fillStyle = 'rgba(160,200,140,0.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, Math.PI * 2); ctx.fill(); }
    // a boss hiding in a red blood cell is shown faded, with a dashed ring: nothing can touch it now
    const hide = hidden(s, p);
    if (hide) ctx.globalAlpha = 0.45;
    drawPathogen(ctx, p.type, q.x, q.y, q.angle, p.hit, CONFIG.pathogens[p.type].boss ? 1.2 : p.type === 'infected' ? 1.35 : 1.4, t + p.id);
    if (hide) {
      // a thick dashed ring that slowly turns, and a HIDING tag: nothing can hit it until it shows again
      ctx.globalAlpha = 1; ctx.strokeStyle = INK_RED; ctx.lineWidth = 3.5; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(q.x, q.y, 62, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.font = '900 26px Palatino, Georgia, serif'; ctx.textAlign = 'center';
      const tag = (p.dormantT ?? 0) > 0 ? 'DORMANT' : CONFIG.pathogens[p.type].burrows ? 'BURROWED' : 'HIDING';
      const tw = ctx.measureText(tag).width;
      // above the boss, or below it when it is near the top edge (where the boss banner is)
      const ty = q.y - 107 < 96 ? q.y + 72 : q.y - 107;
      inkTag(ctx, q.x - tw / 2 - 12, ty, tw + 24, 36, WASH.red, 6);
      ctx.fillStyle = INK_RED; ctx.fillText(tag, q.x, ty + 27);
    }
    const wl = wallLeft(p);
    if (wl > 0) {
      // the granuloma's wall: a ring of stone blocks, one fewer for each share of the strikes it has taken
      const total = CONFIG.pathogens[p.type].walled!.hits, n = 20, standing = Math.ceil((n * wl) / total);
      ctx.save();
      for (let i = 0; i < standing; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        ctx.save(); ctx.translate(q.x + Math.cos(a) * 55, q.y + Math.sin(a) * 55); ctx.rotate(a + Math.PI / 2);
        ctx.beginPath(); ctx.roundRect(-7.5, -5, 15, 10, 2.5);
        ctx.fillStyle = '#e4d6b8'; ctx.fill();
        const hp = hatchPattern(ctx); if (hp) { ctx.fillStyle = hp; ctx.globalAlpha = 0.4; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.strokeStyle = INKC; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      inkText(ctx, `wall ${wl}`, q.x, q.y + 86, INK_RED, 18);
    }
    if (CONFIG.pathogens[p.type].boss) bar(ctx, q.x, q.y - 66, 80, p.hp / p.maxHp, WASH.red);
    else if (p.hp < p.maxHp) bar(ctx, q.x, q.y - 30, CONFIG.pathogens[p.type].taxon || p.type === 'infected' ? 40 : 26, p.hp / p.maxHp, WASH.red);
  }

  for (const c of s.cells) {
    if (c.hp <= 0 || c.infected || c.mode === 'home') continue;
    const q = cellPos(c);
    if (view.showPulseRadius && s.phase === 'combat' && s.pulsesLeft > 0) {
      ctx.fillStyle = 'rgba(168,212,230,0.25)'; ctx.strokeStyle = INK_BLUE; ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(q.x, q.y, CONFIG.whiteCell.attackRange + 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    drawWhiteCell(ctx, q.x, q.y, c.hit, t + c.id, 1.45);
    bar(ctx, q.x, q.y - 38, 40, c.hp / c.maxHp, WASH.blue);
  }

  if (view.coachAt) {
    // the tutorial points here
    const k = 0.5 + 0.5 * Math.sin(t * 5), q = view.coachAt;
    ctx.save(); ctx.strokeStyle = `rgba(232,160,40,${0.55 + 0.45 * k})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(q.x, q.y, 40 + 8 * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  for (const r of s.rings) {
    const k = r.t / r.dur;
    ctx.save();
    if (r.kind === 'pulse') {
      ctx.strokeStyle = `rgba(30,90,120,${1 - k})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.2 + 0.8 * k), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(168,212,230,${0.3 * (1 - k)})`; ctx.fill();
    } else if (r.kind === 'sacrifice') {
      // the cell bursts: ink spatters outward, blots land and fade
      const R = seeded(Math.round(r.x * 7 + r.y * 13)), e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = INKC; ctx.fillStyle = INKC; ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const a = R() * Math.PI * 2, len = r.r * (0.5 + R() * 0.7), w = 1.3 + R() * 2;
        ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(r.x + Math.cos(a) * len * 0.25 * e, r.y + Math.sin(a) * len * 0.25 * e); ctx.lineTo(r.x + Math.cos(a) * len * e, r.y + Math.sin(a) * len * e); ctx.stroke();
        ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * len * e * 1.08, r.y + Math.sin(a) * len * e * 1.08, w * 1.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = WASH.blue; ctx.globalAlpha = 0.6 * (1 - k); ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.6 * e, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INKC; ctx.globalAlpha = 0.8 * (1 - k); ctx.beginPath(); ctx.arc(r.x, r.y, 5 * (1 - e * 0.6), 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === 'struck') {
      // the struck pathogen crossed out with two quick pen strokes
      const a = Math.min(1, k * 3), b = Math.min(1, Math.max(0, k * 3 - 1)), z = r.r;
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3; ctx.strokeStyle = INK_RED; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x - z, r.y - z); ctx.lineTo(r.x - z + 2 * z * a, r.y - z + 2 * z * a); ctx.stroke();
      if (b > 0) { ctx.beginPath(); ctx.moveTo(r.x + z, r.y - z); ctx.lineTo(r.x + z - 2 * z * b, r.y - z + 2 * z * b); ctx.stroke(); }
    } else if (r.kind === 'heart') {
      ctx.strokeStyle = `rgba(110,38,34,${0.8 * (1 - k)})`; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.8 + 0.4 * k), 0, Math.PI * 2); ctx.stroke();
    } else if (r.kind === 'cellDown' || r.kind === 'infect') {
      ctx.strokeStyle = r.kind === 'infect' ? `rgba(90,40,120,${1 - k})` : `rgba(110,38,34,${1 - k})`; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.5 + k), 0, Math.PI * 2); ctx.stroke();
    } else if (r.kind === 'build') {
      ctx.strokeStyle = `rgba(35,26,20,${1 - k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.6 + k), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(35,26,20,${0.6 * (1 - k)})`;
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * k, 2.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  // floating words: in ink, nudged up until they clear the vessel names and each other
  ctx.font = 'italic 700 24px Palatino, Georgia, serif';
  for (const f of s.floaters) {
    const size = f.size ?? 24;
    ctx.font = `italic 700 ${size}px Palatino, Georgia, serif`;
    const tw = ctx.measureText(f.text).width;
    let y = f.y - f.t * 30;
    for (let tries = 0; tries < 8; tries++) {
      const hit = avoid.find((b) => f.x + tw / 2 > b.x && f.x - tw / 2 < b.x + b.w && y > b.y && y - 24 < b.y + b.h);
      if (!hit) break;
      y = hit.y - 4;
    }
    avoid.push({ x: f.x - tw / 2, y: y - 24, w: tw, h: 30 });
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    inkText(ctx, f.text, f.x, y, f.color, size);
    ctx.globalAlpha = 1;
  }
  drawBossBanner(ctx, s);
}

/** While a boss is in play: its name and health across the top of the map. */
function drawBossBanner(ctx: CanvasRenderingContext2D, s: State) {
  const bs = activeBosses(s), b = bs[0];
  if (!b || s.phase !== 'combat') return;
  const st = CONFIG.pathogens[b.type];
  // one boss comes up each vessel: the banner counts them and sums their health, with those still to come
  const coming = s.spawns.filter((x) => CONFIG.pathogens[x.type].boss).length, n = bs.length + coming;
  const hp = bs.reduce((a, p) => a + p.hp, 0) + coming * b.maxHp, max = n * b.maxHp;
  const w = 460, x = W / 2 - w / 2, y = 22;
  ctx.save();
  inkTag(ctx, x, y, w, 64, null, 8);
  ctx.fillStyle = INK_RED; ctx.font = '900 15px Palatino, Georgia, serif'; ctx.textAlign = 'left';
  ctx.fillText('BOSS', x + 18, y + 25);
  ctx.fillStyle = C.ink; ctx.font = 'italic 700 22px Palatino, Georgia, serif'; ctx.fillText(n > 1 ? `${st.name} ×${n}` : st.name, x + 70, y + 26);
  ctx.textAlign = 'right'; ctx.font = '700 16px Palatino, Georgia, serif'; ctx.fillStyle = 'rgba(42,30,24,0.7)';
  ctx.fillText(`${Math.ceil(hp)} / ${max}`, x + w - 18, y + 25);
  inkBar(ctx, x + 18, y + 38, w - 36, 12, hp / max, WASH.red);
  ctx.restore();
}
