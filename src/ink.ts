// The pen-and-ink look: drawings are made in colour as before, then "inked" — their colour thinned to a
// faint watercolour wash on cream paper, their shadows hatched, cross-hatched and stippled by how dark they
// were, and their edges drawn in with the pen. Inking is a pixel pass, so it is only ever run on an
// offscreen image that is kept and reused (organs, sprites) — never on the whole screen each frame.

export const INK = '#231a14';
const INK_RGB = [35, 26, 20];
export const PAPER = '#f2e9d4';
const PAPER_RGB = [242, 233, 212];

export function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

/** A fixed hash of up to three integers to [0, 1): the same stroke breaks in the same place every time. */
function hash(a: number, b: number, c: number) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface InkOpts {
  /** Image pixels per drawing unit. */
  px: number;
  /** Hatch spacing and half line width, in drawing units. */
  gap?: number;
  lw?: number;
  /** How much of the original colour survives (0 = bare paper, 1 = unchanged). */
  wash?: number;
  /** Shift the tone: positive darkens (more hatching), negative lightens. */
  tone?: number;
  /** Draw pen lines along sharp changes of colour. */
  edges?: boolean;
  /** Shade the form: a hatched band this many units wide inside the edges facing away from the light (top left). */
  form?: number;
  /** Lighten a dark drawing so its average tone is about this (never darkens). */
  level?: number;
}

// hatch layers: direction across the lines, and how dark the drawing must be for each to appear
const LDX = new Float64Array([Math.SQRT1_2, Math.SQRT1_2, 0.984]);
const LDY = new Float64Array([Math.SQRT1_2, -Math.SQRT1_2, 0.177]);
const LTH = new Float64Array([0.4, 0.62, 0.82]);
const SIN = new Float64Array(1024);
for (let i = 0; i < 1024; i++) SIN[i] = Math.sin((i / 1024) * Math.PI * 2);
// tone from brightness: 0 for pale, rising to 1 for dark (a lookup, as this runs per pixel)
const BASE = new Float64Array(1025);
for (let i = 0; i <= 1024; i++) BASE[i] = Math.pow(Math.min(1, Math.max(0, (0.7 - i / 1024) / 0.55)), 1.25);

/** Ink an image in place. */
export function inkify(c: HTMLCanvasElement, o: InkOpts) {
  const w = c.width, h = c.height;
  if (!w || !h) return;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const im = g.getImageData(0, 0, w, h), d = im.data;
  const px = o.px, gap = Math.max(2.2, (o.gap ?? 3.4) * px), lw = Math.max(0.45, (o.lw ?? 0.42) * px);
  const wash = o.wash ?? 0.42, edges = o.edges ?? true, eK = Math.min(2, px);
  let shift = o.tone ?? 0;
  const seg = Math.max(4, 9 * px), wobF = (0.06 / px) * (1024 / (Math.PI * 2)), wobA = 0.6 * px, reach = lw + 0.6;
  const cell = Math.max(2, Math.round(2.4 * px));
  const fo = o.form ? Math.round(o.form * px * Math.SQRT1_2) : 0, f2 = fo >> 1, f4 = fo >> 2;
  const L = new Float32Array(w * h);
  // brightness as seen over paper, so faint or soft-edged parts count as pale, not as their full colour
  const PL = (0.3 * PAPER_RGB[0] + 0.59 * PAPER_RGB[1] + 0.11 * PAPER_RGB[2]) / 255;
  for (let i = 0, j = 0; i < L.length; i++, j += 4) {
    const k = d[j + 3] / 255;
    L[i] = ((0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]) / 255) * k + PL * (1 - k);
  }
  if (o.level != null) {
    let sum = 0, n = 0;
    for (let i = 0; i < L.length; i += 7) if (d[i * 4 + 3] > 200 && L[i] > 0.22) { sum += BASE[(L[i] * 1024) | 0]; n++; }
    if (n) shift += Math.min(0, o.level - sum / n);
  }
  const opaque = (x: number, y: number) => x < w && y < h && d[(y * w + x) * 4 + 3] >= 40;
  const pr = PAPER_RGB[0], pg = PAPER_RGB[1], pb = PAPER_RGB[2];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (d[j + 3] === 0) continue;
      const l = L[i];
      let tone = BASE[(l * 1024) | 0] + shift;
      if (fo) tone += ((opaque(x + f4, y + f4) ? 0 : 1) + (opaque(x + f2, y + f2) ? 0 : 1) + (opaque(x + fo, y + fo) ? 0 : 1)
        + (opaque(x + fo, y) ? 0 : 1) + (opaque(x, y + fo) ? 0 : 1)) * 0.13;
      if (tone > 1) tone = 1; else if (tone < 0) tone = 0;
      // lines that were already dark ink stay ink
      let ink = l < 0.22 ? 1 - (l / 0.22) * 0.35 : 0;
      // pen lines where the colour changes sharply, only on the darker side (a dark stroke becomes one line)
      if (edges && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const a1 = L[i - w - 1], a2 = L[i - w + 1], a3 = L[i + w - 1], a4 = L[i + w + 1];
        const gx = L[i + 1] - L[i - 1] + 0.5 * (a2 - a1 + a4 - a3);
        const gy = L[i + w] - L[i - w] + 0.5 * (a3 - a1 + a4 - a2);
        const gr = ((gx < 0 ? -gx : gx) + (gy < 0 ? -gy : gy)) * eK;
        if (gr > 0.42 && l * 4 <= L[i - 1] + L[i + 1] + L[i - w] + L[i + w]) { const e = (gr - 0.42) * 2.4; if (e > ink) ink = e > 0.85 ? 0.85 : e; }
      }
      // hatching: each layer's lines break into strokes, each stroke switched on by tone with a little chance
      for (let k = 0; k < 3; k++) {
        const th = LTH[k];
        if (tone < th - 0.1) break;
        const dx = LDX[k], dy = LDY[k], along = y * dx - x * dy;
        const u = (x * dx + y * dy + SIN[((along * wobF + k * 163) | 0) & 1023] * wobA) / gap;
        const line = Math.floor(u), dist = (u - line - 0.5 < 0 ? line + 0.5 - u : u - line - 0.5) * gap;
        if (dist > reach) continue;
        if (tone < th + (hash(line, Math.floor(along / seg), k) - 0.5) * 0.2) continue;
        let v = lw + 0.5 - dist; if (v > 1) v = 1; v *= 0.8;
        if (v > ink) ink = v;
      }
      // stipple in the half-tones before the hatching starts
      if (tone > 0.14 && tone < 0.5 && x % cell === 0 && y % cell === 0 && hash((x / cell) | 0, (y / cell) | 0, 7) < (tone - 0.12) * 0.55 && ink < 0.75) ink = 0.75;
      const a = 1 - ink;
      d[j] = (pr + (d[j] - pr) * wash) * a + INK_RGB[0] * ink;
      d[j + 1] = (pg + (d[j + 1] - pg) * wash) * a + INK_RGB[1] * ink;
      d[j + 2] = (pb + (d[j + 2] - pb) * wash) * a + INK_RGB[2] * ink;
    }
  }
  g.putImageData(im, 0, 0);
}

/** Inked sprites, kept and reused: a drawing made once per key and on-screen size. */
const SPRITES = new Map<string, HTMLCanvasElement>();
const MAX_SPRITES = 220;

/** Draw `draw` (centred on the origin, `half` units each way) inked, at the current transform's origin.
 *  Without a document (tests) it draws directly. */
export function inkSprite(ctx: CanvasRenderingContext2D, key: string, half: number, draw: (x: CanvasRenderingContext2D) => void, o: Omit<InkOpts, 'px'> = {}, maxPx = 6) {
  if (typeof document === 'undefined') { draw(ctx); return; }
  const m = ctx.getTransform(), px = Math.min(maxPx, Math.max(1, Math.round(Math.hypot(m.a, m.b) * 2) / 2));
  const k = `${key}@${px}`;
  let c = SPRITES.get(k);
  if (c) { SPRITES.delete(k); SPRITES.set(k, c); } // most recently used last
  else {
    if (SPRITES.size >= MAX_SPRITES) SPRITES.delete(SPRITES.keys().next().value!);
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(half * 2 * px);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.scale(px, px); x.translate(half, half); draw(x);
    inkify(c, { px, ...o });
    SPRITES.set(k, c);
  }
  ctx.drawImage(c, -half, -half, half * 2, half * 2);
}

/** A slightly wobbly ink line through points; the wobble is seeded so it never shimmers. */
export function penLine(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], w: number, alpha: number, R: () => number, col = INK) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => { const x = p.x + (R() - 0.5) * 0.8, y = p.y + (R() - 0.5) * 0.8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke(); ctx.restore();
}

/** Cream paper with faint fibres, soft watercolour washes, and tissue lightly drawn in ink behind everything. */
export function paper(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number) {
  const R = seeded(seed);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(120,96,60,${0.03 + R() * 0.04})`; ctx.fillRect(R() * W, R() * H, 1 + R() * 2, 0.6); }
  const spots: [number, number, number, string][] = [[300, 250, 420, '#e8b4a8'], [1300, 300, 460, '#b8c8e0'], [800, 850, 520, '#e8d49a'], [150, 850, 360, '#c8d8b8'], [1500, 900, 380, '#e0b8c8']];
  for (const [x, y, r, col] of spots) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(242,233,212,0)');
    ctx.globalAlpha = 0.32; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  // loose cells of the tissue: faint outlines, a stippled nucleus, a little hatching on one side
  for (let i = 0; i < 90; i++) {
    const x = R() * W, y = R() * H, r = 26 + R() * 34, pts = [];
    for (let a = 0; a <= Math.PI * 2 + 0.2; a += 0.35) { const q = r * (1 + Math.sin(a * 3 + i) * 0.1 + (R() - 0.5) * 0.08); pts.push({ x: x + Math.cos(a) * q, y: y + Math.sin(a) * q * 0.8 }); }
    penLine(ctx, pts, 0.8, 0.19, R);
    ctx.fillStyle = 'rgba(35,26,20,0.26)';
    for (let k = 0; k < 40; k++) if (R() < 0.5) { ctx.beginPath(); ctx.arc(x - r * 0.25 + R() * r * 0.5, y - r * 0.2 + R() * r * 0.4, 0.4 + R() * 0.4, 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 6; k++) { const a = 0.4 + k * 0.12; penLine(ctx, [{ x: x + Math.cos(a) * r * 0.6, y: y + Math.sin(a) * r * 0.5 }, { x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.72 }], 0.5, 0.15, R); }
  }
  // fibres drifting across, like wood grain
  for (let i = 0; i < 34; i++) {
    let x = R() * W, y = R() * H, a = R() * Math.PI; const pts = [{ x, y }];
    for (let k = 0; k < 40; k++) { a += (R() - 0.5) * 0.25; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push({ x, y }); }
    penLine(ctx, pts, 0.7, 0.17, R);
    penLine(ctx, pts.map((p) => ({ x: p.x + 4, y: p.y + 3 })), 0.5, 0.12, R);
  }
  // fine capillaries branching in from the edges like roots
  const root = (x: number, y: number, a: number, len: number, d: number) => {
    const pts = [{ x, y }];
    for (let k = 0; k < 8; k++) { a += (R() - 0.5) * 0.4; x += Math.cos(a) * len / 8; y += Math.sin(a) * len / 8; pts.push({ x, y }); }
    penLine(ctx, pts, 0.4 + d * 0.25, 0.23, R, '#7a2a2a');
    if (d > 0) { root(x, y, a - 0.5, len * 0.7, d - 1); root(x, y, a + 0.45, len * 0.65, d - 1); }
  };
  for (const [x, y, a] of [[60, 120, 0.4], [1550, 120, 2.6], [80, 960, -0.5], [1520, 980, -2.4], [800, -10, 1.5]]) root(x, y, a, 110, 4);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,60,30,0.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

let hatchTile: CanvasPattern | null = null;
/** A small repeating tile of diagonal pen hatching, for live drawings (vessel walls). */
export function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (hatchTile || typeof document === 'undefined') return hatchTile;
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const x = c.getContext('2d')!;
  x.strokeStyle = INK; x.lineWidth = 1; x.lineCap = 'square';
  for (const o of [-12, 0, 12]) { x.beginPath(); x.moveTo(o, 12); x.lineTo(o + 12, 0); x.stroke(); }
  hatchTile = ctx.createPattern(c, 'repeat');
  return hatchTile;
}
