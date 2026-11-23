// The organs other than the heart, drawn as anatomy-plate figures: lungs, brain, liver, kidney.
// Each takes the organ's centre and size from the level map; `swell` is a small breathing/pulse factor.
import type { Vec } from './level';

const INK = '#2a1e18';

/** A thin branching vessel (artery or vein) drawn as a tapering tree. */
function vesselTree(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, w: number, depth: number, col: string, R: () => number) {
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x2, y2); ctx.stroke();
  if (depth > 0) for (const da of [-0.5 - R() * 0.3, 0.4 + R() * 0.3]) vesselTree(ctx, x2, y2, a + da, len * (0.62 + R() * 0.15), w * 0.68, depth - 1, col, R);
}

function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

// ── Lungs ───────────────────────────────────────────────────────────────────
export function drawLungs(ctx: CanvasRenderingContext2D, c: Vec, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y);
  // trachea and bronchi (behind the lobes' inner edges)
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(0, -330); ctx.lineTo(0, -150); ctx.stroke();
  ctx.strokeStyle = '#e8d2c0'; ctx.lineWidth = 34; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,80,60,0.45)'; ctx.lineWidth = 2;
  for (let y = -320; y < -160; y += 14) { ctx.beginPath(); ctx.moveTo(-15, y); ctx.quadraticCurveTo(0, y + 4, 15, y); ctx.stroke(); }
  ctx.scale(swell, swell);
  for (const sg of [-1, 1]) {
    const lobe = () => {
      ctx.beginPath();
      ctx.moveTo(sg * 40, -150);
      ctx.bezierCurveTo(sg * 70, -200, sg * 150, -190, sg * 180, -80);
      ctx.bezierCurveTo(sg * 215, 30, sg * 215, 130, sg * 190, 170);
      ctx.bezierCurveTo(sg * 150, 200, sg * 70, 190, sg * 30, 160);
      ctx.bezierCurveTo(sg * 50, 90, sg * 20, 40, sg * 28, -10);
      ctx.bezierCurveTo(sg * 30, -70, sg * 20, -120, sg * 40, -150);
      ctx.closePath();
    };
    const g = ctx.createRadialGradient(sg * 100, -40, 20, sg * 110, 20, 220);
    g.addColorStop(0, '#f6c4bc'); g.addColorStop(0.6, '#e0908a'); g.addColorStop(1, '#a8504c');
    lobe(); ctx.fillStyle = g; ctx.fill();
    if (kick > 0) { lobe(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
    ctx.save(); lobe(); ctx.clip();
    const R = seeded(sg > 0 ? 11 : 7);
    ctx.strokeStyle = 'rgba(140,60,60,0.28)'; ctx.lineWidth = 1;
    for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc(sg * (30 + R() * 190), -190 + R() * 380, 5 + R() * 5, 0, Math.PI * 2); ctx.stroke(); }
    // fissures between lobes
    ctx.strokeStyle = 'rgba(90,30,30,0.6)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sg * 40, -40); ctx.bezierCurveTo(sg * 100, 0, sg * 150, 40, sg * 215, 60); ctx.stroke();
    if (sg > 0) { ctx.beginPath(); ctx.moveTo(sg * 60, 80); ctx.quadraticCurveTo(sg * 140, 90, sg * 210, 130); ctx.stroke(); }
    // pulmonary arteries and veins fanning out from the hilum, faint under the pleura
    const V = seeded(sg > 0 ? 5 : 9);
    ctx.globalAlpha = 0.45;
    vesselTree(ctx, sg * 45, -60, sg > 0 ? 0.2 : Math.PI - 0.2, 50, 4, 4, '#8a2a3a', V);
    vesselTree(ctx, sg * 45, -20, sg > 0 ? 0.7 : Math.PI - 0.7, 48, 4, 4, '#3a4a8a', V);
    ctx.globalAlpha = 1;
    // the pleura's sheen along the outer edge
    ctx.strokeStyle = 'rgba(255,240,236,0.45)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(sg * 150, -160); ctx.bezierCurveTo(sg * 200, -80, sg * 215, 40, sg * 195, 150); ctx.stroke();
    ctx.restore();
    lobe(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    // bronchial tree
    ctx.strokeStyle = '#7a3a30'; ctx.lineCap = 'round';
    const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (d > 0) { branch(x2, y2, a - 0.45, len * 0.7, w * 0.7, d - 1); branch(x2, y2, a + 0.45, len * 0.7, w * 0.7, d - 1); }
    };
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(sg * 40, -110); ctx.stroke();
    // cartilage rings on the main bronchus
    ctx.save(); ctx.strokeStyle = 'rgba(240,220,200,0.85)'; ctx.lineWidth = 1.6;
    // three rings across the bronchus, which runs from (0, -150) to (sg × 40, -110)
    const ux = sg * 40 / 56.6, uy = 40 / 56.6, px = -uy, py = ux;
    for (let k = 1; k <= 3; k++) { const x = ux * 14 * k, y = -150 + uy * 14 * k; ctx.beginPath(); ctx.moveTo(x - px * 4.5, y - py * 4.5); ctx.lineTo(x + px * 4.5, y + py * 4.5); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = '#7a3a30';
    branch(sg * 40, -110, sg > 0 ? 0.9 : Math.PI - 0.9, 46, 7, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(sg * 120, -110, 18, 34, sg * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ── Brain ───────────────────────────────────────────────────────────────────
export function drawBrain(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y);
  // brainstem
  ctx.fillStyle = '#d8a8a0'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-26, ry - 40); ctx.bezierCurveTo(-30, ry + 60, -20, ry + 150, -12, ry + 230); ctx.lineTo(12, ry + 230); ctx.bezierCurveTo(20, ry + 150, 30, ry + 60, 26, ry - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
  // the cerebellum, tucked under the back of the cerebrum: two lobes with fine parallel folia
  for (const sg of [-1, 1]) {
    const cx = sg * rx * 0.28, cy = ry * 0.86, w = rx * 0.32, h = ry * 0.3;
    const cg = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, w);
    cg.addColorStop(0, '#eebcb6'); cg.addColorStop(1, '#b4706e');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(122,46,56,0.55)'; ctx.lineWidth = 1.4;
    for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.ellipse(cx, cy + k * 7, w * 1.05, h * 0.45, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.scale(swell, swell);
  const shape = () => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      // domed top, flatter base, the temporal lobes bulging a little low on each side
      const bump = 1 + 0.012 * Math.sin(a * 9) + (Math.sin(a) > 0 ? -0.1 * Math.pow(Math.sin(a), 3) : 0.02) + 0.05 * Math.pow(Math.max(0, Math.sin(a) * Math.abs(Math.cos(a))), 1) ;
      const x = Math.cos(a) * rx * bump, y = Math.sin(a) * ry * bump;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(-60, -60, 20, 0, 0, rx * 1.1);
  g.addColorStop(0, '#f6d4d0'); g.addColorStop(0.65, '#e4a8a8'); g.addColorStop(1, '#b4706e');
  shape(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { shape(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); shape(); ctx.clip();
  // gyri: long meandering folds, each a dark groove with a pale ridge beside it
  const R = seeded(29);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const folds: Vec[][] = [];
  for (let i = 0; i < 70; i++) {
    let x = (R() * 2 - 1) * rx, y = (R() * 2 - 1) * ry, a = R() * Math.PI * 2;
    const pts: Vec[] = [{ x, y }];
    for (let k = 0; k < 9; k++) { a += (R() - 0.5) * 2.2; x += Math.cos(a) * 20; y += Math.sin(a) * 20; pts.push({ x, y }); }
    folds.push(pts);
  }
  const trace = (pts: Vec[], dx: number, dy: number) => {
    ctx.beginPath(); ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
    for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k].x + dx, pts[k].y + dy, (pts[k].x + pts[k + 1].x) / 2 + dx, (pts[k].y + pts[k + 1].y) / 2 + dy);
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(255,236,232,0.55)'; ctx.lineWidth = 5; for (const f of folds) trace(f, -3, -3);
  ctx.strokeStyle = 'rgba(122,46,56,0.62)'; ctx.lineWidth = 2.8; for (const f of folds) trace(f, 0, 0);
  // the middle cerebral arteries, running out of each lateral sulcus over the cortex
  const A = seeded(17);
  ctx.globalAlpha = 0.7;
  for (const sg of [-1, 1]) vesselTree(ctx, sg * rx * 0.3, ry * 0.45, sg > 0 ? -0.5 : Math.PI + 0.5, rx * 0.22, 4, 4, '#a8283a', A);
  ctx.globalAlpha = 1;
  // a soft shadow where the frontal and temporal lobes curve away
  const sh = ctx.createRadialGradient(0, -ry * 0.2, rx * 0.4, 0, 0, rx * 1.05);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(90,30,40,0.25)');
  ctx.fillStyle = sh; ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
  ctx.restore();
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  // the longitudinal fissure and the lateral sulcus
  ctx.strokeStyle = '#6a2830'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(0, -ry * 0.98); ctx.bezierCurveTo(-8, -ry * 0.4, 8, ry * 0.2, 0, ry * 0.62); ctx.stroke();
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sg * rx * 0.25, ry * 0.55); ctx.bezierCurveTo(sg * rx * 0.45, ry * 0.2, sg * rx * 0.7, ry * 0.1, sg * rx * 0.88, -ry * 0.05); ctx.stroke(); }
  ctx.restore();
}

// ── Liver ───────────────────────────────────────────────────────────────────
export function drawLiver(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  // a wedge: the broad right lobe on the viewer's left, tapering to a thin left lobe
  const X = rx / 300, Y = ry / 150;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-290 * X, -20 * Y);
    ctx.bezierCurveTo(-300 * X, -120 * Y, -180 * X, -160 * Y, -40 * X, -150 * Y);
    ctx.bezierCurveTo(100 * X, -145 * Y, 230 * X, -120 * Y, 300 * X, -60 * Y);
    ctx.bezierCurveTo(322 * X, -42 * Y, 312 * X, -18 * Y, 270 * X, 0);
    ctx.bezierCurveTo(180 * X, 60 * Y, 100 * X, 125 * Y, 30 * X, 150 * Y);
    ctx.bezierCurveTo(-40 * X, 165 * Y, -120 * X, 158 * Y, -200 * X, 125 * Y);
    ctx.bezierCurveTo(-270 * X, 92 * Y, -290 * X, 40 * Y, -290 * X, -20 * Y);
    ctx.closePath();
  };
  // gallbladder peeking out underneath
  ctx.fillStyle = '#6aa04a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.ellipse(175 * X, 62 * Y, 34, 20, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const g = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, 20, 0, 0, rx * 1.05);
  g.addColorStop(0, '#d88a6e'); g.addColorStop(0.6, '#a84a3a'); g.addColorStop(1, '#6a2a22');
  shape(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { shape(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); shape(); ctx.clip();
  const R = seeded(41);
  // lobules: a faint hexagonal texture
  ctx.strokeStyle = 'rgba(60,20,16,0.22)'; ctx.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    const x = (R() * 2 - 1) * rx, y = (R() * 2 - 1) * ry, r = 9 + R() * 4;
    ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + r, y); } ctx.stroke();
  }
  // the falciform ligament dividing the lobes
  ctx.strokeStyle = 'rgba(250,220,200,0.75)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(rx * 0.05, -ry * 1.05); ctx.bezierCurveTo(rx * 0.12, -ry * 0.3, rx * 0.02, ry * 0.3, rx * 0.15, ry); ctx.stroke();
  // hepatic veins showing through the capsule, draining up towards the vena cava
  const HV = seeded(53);
  ctx.globalAlpha = 0.35;
  vesselTree(ctx, rx * 0.02, -ry * 0.95, Math.PI / 2 + 0.5, ry * 0.4, 6, 4, '#3a3a7a', HV);
  vesselTree(ctx, -rx * 0.1, -ry * 0.95, Math.PI / 2 - 0.2, ry * 0.45, 6, 4, '#3a3a7a', HV);
  vesselTree(ctx, -rx * 0.3, -ry * 0.9, Math.PI / 2 + 0.9, ry * 0.4, 5, 3, '#3a3a7a', HV);
  ctx.globalAlpha = 1;
  // the round ligament at the falciform's free edge
  ctx.strokeStyle = 'rgba(240,210,190,0.9)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rx * 0.12, ry * 0.7); ctx.lineTo(rx * 0.15, ry * 1.02); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-rx * 0.45, -ry * 0.5, 60, 22, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.ellipse(rx * 0.35, -ry * 0.55, 70, 14, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

/** Loops of small intestine where the portal vein begins (bottom-left corner). */
export function drawGut(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath(); ctx.moveTo(24, 948);
    for (let i = 0; i < 6; i++) { const x = 40 + i * 44; ctx.bezierCurveTo(x, 900, x + 30, 900, x + 22, 948); ctx.bezierCurveTo(x + 14, 990, x + 40, 992, x + 44, 950); }
  };
  ctx.strokeStyle = INK; ctx.lineWidth = 26; path(); ctx.stroke();
  ctx.strokeStyle = '#e8b0a0'; ctx.lineWidth = 20; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,80,70,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); path(); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ── Kidney ──────────────────────────────────────────────────────────────────
export function drawKidney(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  const bean = () => {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.2, -ry);
    ctx.bezierCurveTo(rx * 0.7, -ry * 1.08, rx * 1.05, -ry * 0.5, rx, 0);
    ctx.bezierCurveTo(rx * 1.05, ry * 0.5, rx * 0.7, ry * 1.08, -rx * 0.2, ry);
    ctx.bezierCurveTo(-rx * 0.95, ry * 0.92, -rx * 0.9, ry * 0.3, -rx * 0.62, ry * 0.14);
    ctx.bezierCurveTo(-rx * 0.55, ry * 0.05, -rx * 0.55, -ry * 0.05, -rx * 0.62, -ry * 0.14);
    ctx.bezierCurveTo(-rx * 0.9, -ry * 0.3, -rx * 0.95, -ry * 0.92, -rx * 0.2, -ry);
    ctx.closePath();
  };
  // the renal artery and vein entering the hilum, and the ureter leaving it, drawn behind the kidney
  ctx.lineCap = 'round';
  for (const [col, w, x2, y2, dy] of [['#b8433a', 10, -rx * 1.0, -ry * 0.2, -ry * 0.08], ['#4a6aa8', 12, -rx * 1.0, ry * 0.02, ry * 0.04], ['#e8d090', 8, -rx * 0.75, ry * 1.08, ry * 0.12]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = w + 4;
    ctx.beginPath(); ctx.moveTo(-rx * 0.4, dy); ctx.quadraticCurveTo(-rx * 0.95, dy + (y2 - dy) * 0.3, x2, y2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  }
  // adrenal gland cap
  ctx.fillStyle = '#e0b85a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-rx * 0.75, -ry * 0.8); ctx.quadraticCurveTo(-rx * 0.5, -ry * 1.3, -rx * 0.05, -ry * 1.02); ctx.quadraticCurveTo(-rx * 0.4, -ry * 0.92, -rx * 0.75, -ry * 0.8); ctx.fill(); ctx.stroke();
  const g = ctx.createRadialGradient(rx * 0.2, -ry * 0.3, 10, 0, 0, ry * 1.1);
  g.addColorStop(0, '#c87a6a'); g.addColorStop(0.6, '#9a3e36'); g.addColorStop(1, '#5e2420');
  bean(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { bean(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); bean(); ctx.clip();
  // cortex: the glomeruli as fine dark dots in a band under the capsule
  ctx.fillStyle = 'rgba(70,16,16,0.45)';
  for (let i = 0; i < 220; i++) { const a = i * 2.39996, r = 0.78 + (i % 7) * 0.025; ctx.beginPath(); ctx.arc(rx * 0.12 + Math.cos(a) * rx * r * 0.92, Math.sin(a) * ry * r * 0.92, 1.4, 0, Math.PI * 2); ctx.fill(); }
  // medulla: pyramids fanning from the pelvis, with striations
  ctx.fillStyle = '#7a2a28'; ctx.strokeStyle = 'rgba(255,200,180,0.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = -1.25 + (i / 6) * 2.5, px = Math.cos(a), py = Math.sin(a);
    const bx = -rx * 0.25 + px * rx * 0.85, by = py * ry * 0.82;
    ctx.beginPath(); ctx.moveTo(-rx * 0.2 + px * rx * 0.3, py * ry * 0.3);
    ctx.lineTo(bx - py * 28, by + px * 28); ctx.lineTo(bx + py * 28, by - px * 28); ctx.closePath(); ctx.fill();
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-rx * 0.2 + px * rx * 0.32, py * ry * 0.32); ctx.lineTo(bx + py * k * 9, by - px * k * 9); ctx.stroke(); }
  }
  // the renal pelvis and calyces
  ctx.fillStyle = '#f0dca0'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-rx * 0.62, -ry * 0.1);
  for (let i = 0; i < 5; i++) { const a = -1 + (i / 4) * 2; ctx.quadraticCurveTo(-rx * 0.3 + Math.cos(a) * 20, Math.sin(a) * ry * 0.3, -rx * 0.12 + Math.cos(a) * rx * 0.2, Math.sin(a) * ry * 0.42); ctx.lineTo(-rx * 0.22 + Math.cos(a) * rx * 0.1, Math.sin(a) * ry * 0.3 + 10); }
  ctx.lineTo(-rx * 0.62, ry * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(rx * 0.45, -ry * 0.45, 18, 44, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // the fibrous capsule: a thin pale line just inside the outline
  ctx.save(); ctx.translate(rx * 0.03, 0); ctx.scale(0.965, 0.975); bean(); ctx.strokeStyle = 'rgba(255,230,220,0.5)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  bean(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

/** The spleen: a purple crescent with a notched upper border and the splenic vessels at its hilum. */
export function drawSpleen(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.1, -ry);
    // convex outer border, notched near the top
    ctx.bezierCurveTo(rx * 0.55, -ry * 1.02, rx * 1.05, -ry * 0.55, rx * 0.98, -ry * 0.05);
    ctx.bezierCurveTo(rx * 1.02, ry * 0.55, rx * 0.6, ry * 1.02, -rx * 0.05, ry);
    // concave inner (hilar) border
    ctx.bezierCurveTo(-rx * 0.75, ry * 0.95, -rx * 1.02, ry * 0.4, -rx * 0.55, ry * 0.1);
    ctx.bezierCurveTo(-rx * 0.4, 0, -rx * 0.4, -ry * 0.1, -rx * 0.55, -ry * 0.2);
    ctx.lineTo(-rx * 0.72, -ry * 0.3); ctx.lineTo(-rx * 0.58, -ry * 0.38); // a notch
    ctx.bezierCurveTo(-rx * 1.0, -ry * 0.55, -rx * 0.85, -ry * 0.98, -rx * 0.1, -ry);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(rx * 0.25, -ry * 0.3, 10, 0, 0, ry * 1.1);
  g.addColorStop(0, '#b87aa8'); g.addColorStop(0.55, '#7e3a6e'); g.addColorStop(1, '#4a1e40');
  shape(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { shape(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); shape(); ctx.clip();
  // red pulp: a soft speckle; white pulp: pale nodules along the arteries
  ctx.fillStyle = 'rgba(200,90,120,0.35)';
  for (let i = 0; i < 90; i++) { const a = i * 2.39996, r = Math.sqrt(i / 90); ctx.beginPath(); ctx.arc(Math.cos(a) * r * rx * 0.95, Math.sin(a) * r * ry * 0.95, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(245,232,220,0.75)';
  for (let i = 0; i < 14; i++) { const a = -1.2 + i * 0.18, r = 0.35 + (i % 3) * 0.18; ctx.beginPath(); ctx.arc(-rx * 0.35 + Math.cos(a) * r * rx, Math.sin(a) * r * ry, 5, 0, Math.PI * 2); ctx.fill(); }
  // trabeculae: fibrous partitions running in from the capsule
  ctx.strokeStyle = 'rgba(70,20,60,0.35)'; ctx.lineWidth = 1.6;
  const T = seeded(61);
  for (let i = 0; i < 16; i++) {
    const a = -1.3 + i * 0.17, x0 = Math.cos(a) * rx * 0.95, y0 = Math.sin(a) * ry * 0.95;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 * 0.7 + (T() - 0.5) * 20, y0 * 0.7, x0 * (0.45 + T() * 0.15), y0 * (0.45 + T() * 0.15)); ctx.stroke();
  }
  // branches of the splenic artery fanning in from the hilum
  ctx.globalAlpha = 0.5;
  vesselTree(ctx, -rx * 0.45, -10, -0.5, rx * 0.35, 4, 3, '#a8283a', T);
  vesselTree(ctx, -rx * 0.45, 10, 0.4, rx * 0.35, 4, 3, '#a8283a', T);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(rx * 0.45, -ry * 0.45, 16, 46, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // short gastric vessels leaving the upper pole
  ctx.lineCap = 'round';
  for (const [dx, col] of [[-12, '#b8433a'], [6, '#4a6aa8']] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-rx * 0.2 + dx, -ry * 0.96); ctx.quadraticCurveTo(-rx * 0.4 + dx, -ry * 1.12, -rx * 0.7 + dx, -ry * 1.15); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
  }
  // splenic artery and vein at the hilum
  for (const [col, dy] of [['#b8433a', -14], ['#4a6aa8', 14]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-rx * 0.45, dy); ctx.quadraticCurveTo(-rx * 0.85, dy * 2, -rx * 1.05, dy * 3); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.stroke();
  }
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}
