// The six named bacteria, drawn small enough to travel the vessels (about 36 × 22 at scale 1).
// Each reads by shape first (clusters, chains, bean pairs, rods), colour second; up close they show
// a cell-wall rim, the nucleoid and ribosomes inside, capsules, pili and beating flagella.
import type { BacteriumType } from './config';
import { inkify } from './ink';

const INK = '#2a1e18';

interface Look { base: string; dark: string; light: string; inner: string }
export const BACTERIA_LOOK: Record<BacteriumType, Look> = {
  saureus: { base: '#e0b030', dark: '#8a6410', light: '#fbe8a0', inner: '#a8781a' },
  spneumo: { base: '#9a6ad8', dark: '#4e2a8a', light: '#e0ccf6', inner: '#5e3a9a' },
  listeria: { base: '#3aa89a', dark: '#16584e', light: '#b0ece2', inner: '#1e6a60' },
  nmening: { base: '#e06a78', dark: '#8a2432', light: '#fbd0d6', inner: '#9a3040' },
  ecoli: { base: '#78b850', dark: '#3a6a22', light: '#d0eeb0', inner: '#4a7a2a' },
  kpneumo: { base: '#7a90b0', dark: '#34465e', light: '#d4dcec', inner: '#46587a' },
  mtb: { base: '#d0607a', dark: '#7a2038', light: '#f6c8d4', inner: '#9a3050' },
};

/** A fixed scatter of points (golden-angle spiral) so the inner speckle never shimmers between frames. */
function speckle(n: number, rx: number, ry: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = i * 2.39996, r = Math.sqrt((i + 0.5) / n); out.push([Math.cos(a) * r * rx, Math.sin(a) * r * ry]); }
  return out;
}

function bodyFill(ctx: CanvasRenderingContext2D, look: Look, hit: number, r: number) {
  if (hit > 0) return '#ffffff';
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 1, 0, 0, r * 1.25);
  g.addColorStop(0, look.light); g.addColorStop(0.5, look.base); g.addColorStop(1, look.dark);
  return g;
}

/** Ribosome speckle and a nucleoid smudge inside the current path's clip. */
function innards(ctx: CanvasRenderingContext2D, look: Look, rx: number, ry: number, dots: number) {
  ctx.fillStyle = look.inner; ctx.globalAlpha = 0.28;
  ctx.beginPath(); ctx.ellipse(rx * 0.05, ry * 0.05, rx * 0.45, ry * 0.32, 0.3, 0, Math.PI * 2); ctx.fill(); // nucleoid
  ctx.globalAlpha = 0.5;
  for (const [x, y] of speckle(dots, rx * 0.8, ry * 0.7)) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill(); } // ribosomes
  ctx.globalAlpha = 1;
}

/** One coccus: body, inner rim (the thick Gram-positive wall shows as a pale band), speckle, outline. */
function coccus(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, look: Look, hit: number, thickWall: boolean) {
  ctx.save(); ctx.translate(x, y);
  const shape = () => { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); };
  shape(); ctx.fillStyle = bodyFill(ctx, look, hit, Math.max(rx, ry)); ctx.fill();
  if (hit <= 0) {
    ctx.save(); shape(); ctx.clip(); innards(ctx, look, rx, ry, 5); ctx.restore();
    ctx.strokeStyle = thickWall ? 'rgba(255,250,230,0.55)' : 'rgba(255,240,240,0.35)'; ctx.lineWidth = thickWall ? 1.6 : 0.9;
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 1.2, ry - 1.2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

/** A rod: body with rounded poles, a wall rim, innards. */
function rod(ctx: CanvasRenderingContext2D, len: number, thick: number, look: Look, hit: number, thickWall: boolean) {
  const shape = () => { ctx.beginPath(); ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2); };
  shape(); ctx.fillStyle = bodyFill(ctx, look, hit, thick); ctx.fill();
  if (hit <= 0) {
    ctx.save(); shape(); ctx.clip(); innards(ctx, look, len / 2, thick / 2, 10);
    // a septum: a rod about to divide
    ctx.strokeStyle = look.dark; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(len * 0.12, -thick / 2); ctx.lineTo(len * 0.12, thick / 2); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = thickWall ? 'rgba(255,250,230,0.55)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = thickWall ? 1.6 : 0.9;
    ctx.beginPath(); ctx.roundRect(-len / 2 + 1.4, -thick / 2 + 1.4, len - 2.8, thick - 2.8, thick / 2 - 1.4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-len * 0.12, -thick * 0.22, len * 0.28, thick * 0.12, 0, 0, Math.PI * 2); ctx.fill(); // sheen
  }
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
}

/** Flagella that beat: a sine wave travelling down each one. `around` = all over (peritrichous), else one tail. */
function flagella(ctx: CanvasRenderingContext2D, _look: Look, around: boolean, t: number, len: number, thick: number) {
  ctx.strokeStyle = INK; ctx.globalAlpha = 0.8; ctx.lineWidth = 1; ctx.lineCap = 'round';
  const roots: [number, number, number][] = around
    ? [[-len * 0.35, -thick / 2, -Math.PI / 2], [len * 0.05, -thick / 2, -Math.PI / 2], [len * 0.35, -thick / 2, -Math.PI / 2],
       [-len * 0.3, thick / 2, Math.PI / 2], [len * 0.1, thick / 2, Math.PI / 2], [len * 0.38, thick / 2, Math.PI / 2], [-len / 2, 0, Math.PI]]
    : [[-len / 2, 0, Math.PI], [-len / 2 + 2, -2, Math.PI + 0.3]];
  for (const [x0, y0, dir] of roots) {
    const L = around ? 9 : 13, dx = Math.cos(dir), dy = Math.sin(dir), nx = -dy, ny = dx;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i <= 8; i++) { const u = i / 8, w = Math.sin(u * 7 - t * 14 + x0) * 2.2 * u; ctx.lineTo(x0 + dx * L * u + nx * w, y0 + dy * L * u + ny * w); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Short straight pili bristling from a Gram-negative's surface. */
function pili(ctx: CanvasRenderingContext2D, rx: number, ry: number, n: number) {
  ctx.strokeStyle = 'rgba(42,30,24,0.55)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * 1.22, y * 1.22); ctx.stroke();
  }
}

/** A polysaccharide capsule: a translucent halo with a soft dotted edge. */
function capsule(ctx: CanvasRenderingContext2D, rx: number, ry: number, tint: string) {
  ctx.fillStyle = tint; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(60,70,90,0.45)'; ctx.lineWidth = 1.1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
}

/** The bacterium itself, without its flagella: drawn at the origin, unscaled, unrotated. */
function drawBody(ctx: CanvasRenderingContext2D, type: BacteriumType, hit: number) {
  const look = BACTERIA_LOOK[type];
  ctx.save();
  if (type === 'saureus') {
    // a grape-like cluster of cocci, thick Gram-positive walls
    for (const [cx, cy] of [[-9, -4], [0, -7.5], [9, -3], [-5, 4.5], [4, 4.5], [-1, -0.5], [11, 5], [-12, 4]]) coccus(ctx, cx, cy, 5.4, 5.4, look, hit, true);
  } else if (type === 'spneumo') {
    // lancet-shaped diplococci in a short chain, inside a thin capsule
    capsule(ctx, 21, 9.5, 'rgba(225,215,245,0.6)');
    for (const cx of [-12.5, -4.2, 4.2, 12.5]) coccus(ctx, cx, 0, 4.4, 5.6, look, hit, true);
  } else if (type === 'nmening') {
    // a kidney-bean pair, flat sides pressed together, in a capsule bristling with pili
    capsule(ctx, 17, 13, 'rgba(250,225,228,0.55)');
    pili(ctx, 15, 11, 14);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? -20 : 0.8, -14, 19.2, 28); ctx.clip();
      coccus(ctx, side * 4.4, 0, 8, 8.8, look, hit, false);
      ctx.restore();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.lineTo(0, 7.5); ctx.stroke();
  } else if (type === 'listeria') {
    // a short Gram-positive rod (its tumbling tail is drawn live)
    rod(ctx, 24, 11, look, hit, true);
  } else if (type === 'ecoli') {
    // a Gram-negative rod with fine pili (its flagella all round are drawn live)
    pili(ctx, 17, 8, 12);
    rod(ctx, 32, 14, look, hit, false);
  } else if (type === 'mtb') {
    // M. tuberculosis: slender, slightly bent, beaded rods lying side by side in a cord, inside a waxy coat
    ctx.strokeStyle = 'rgba(120,40,70,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([1.5, 2.5]);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (const [dy, rot, len] of [[-4.5, -0.08, 30], [4.5, 0.05, 34]] as const) {
      ctx.save(); ctx.translate(0, dy); ctx.rotate(rot);
      rod(ctx, len, 8, look, hit, true);
      if (hit <= 0) { ctx.fillStyle = look.dark; for (let k = -len / 2 + 4; k < len / 2 - 2; k += 4.2) { ctx.beginPath(); ctx.arc(k, 0, 1.1, 0, Math.PI * 2); ctx.fill(); } } // beads
      ctx.restore();
    }
  } else {
    // Klebsiella: a fat rod inside a thick mucoid capsule
    capsule(ctx, 22, 13.5, 'rgba(214,224,240,0.8)');
    ctx.strokeStyle = 'rgba(120,140,170,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 18 + i * 1.3, 10.5 + i * 1, 0, 0, Math.PI * 2); ctx.stroke(); } // mucus layers
    rod(ctx, 30, 15, look, hit, false);
  }
  ctx.restore();
}

/** Still bodies, drawn once per bacterium and size into an offscreen image and reused every frame. */
const SPRITES = new Map<string, HTMLCanvasElement>();
const HALF_W = 26, HALF_H = 18, OVERSAMPLE = 2;
function sprite(type: BacteriumType, px: number): HTMLCanvasElement {
  const key = `${type}:${px}`;
  let c = SPRITES.get(key);
  if (!c) {
    if (SPRITES.size > 48) SPRITES.clear(); // sizes change with the window: keep the store small
    c = document.createElement('canvas');
    c.width = Math.ceil(HALF_W * 2 * px); c.height = Math.ceil(HALF_H * 2 * px);
    const x = c.getContext('2d')!; x.scale(px, px); x.translate(HALF_W, HALF_H);
    drawBody(x, type, 0);
    inkify(c, { px, gap: 1.9, lw: 0.32, wash: 0.5 });
    SPRITES.set(key, c);
  }
  return c;
}

export function drawBacterium(ctx: CanvasRenderingContext2D, type: BacteriumType, x: number, y: number, angle: number, hit: number, scale = 1, t = 0) {
  const look = BACTERIA_LOOK[type];
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(angle);
  // flagella beat, so they are drawn live, under the body
  if (type === 'listeria') flagella(ctx, look, false, t, 24, 11);
  else if (type === 'ecoli') flagella(ctx, look, true, t, 32, 14);
  if (hit > 0 || typeof document === 'undefined') drawBody(ctx, type, hit); // the white hit-flash is rare: draw it directly
  else {
    // pick a sprite resolution from the on-screen size (rounded, so only a few sizes are ever made)
    const m = ctx.getTransform(), px = Math.max(1, Math.round(Math.hypot(m.a, m.b) * OVERSAMPLE * 2) / 2);
    ctx.drawImage(sprite(type, px), -HALF_W, -HALF_H, HALF_W * 2, HALF_H * 2);
  }
  ctx.restore();
}
