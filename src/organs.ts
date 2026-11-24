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

/** The spleen: a tilted, crimson-plum wedge, its upper border cut by deep notches, its cut face speckled with the
 *  pale nodules of white pulp, a thin pale capsule round it, and the splenic vessels fanning in at its hilum. */
export function drawSpleen(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell); ctx.rotate(-0.32);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.15, -ry);
    // the convex diaphragmatic surface
    ctx.bezierCurveTo(rx * 0.7, -ry * 0.98, rx * 1.12, -ry * 0.4, rx * 0.95, ry * 0.25);
    ctx.bezierCurveTo(rx * 0.85, ry * 0.75, rx * 0.4, ry * 1.04, -rx * 0.12, ry * 0.96);
    // the flatter visceral face, with the hilum
    ctx.bezierCurveTo(-rx * 0.62, ry * 0.88, -rx * 0.72, ry * 0.5, -rx * 0.5, ry * 0.22);
    ctx.lineTo(-rx * 0.62, ry * 0.12); ctx.lineTo(-rx * 0.48, -ry * 0.02); // the hilum
    // the upper border, cut by three deep notches
    ctx.lineTo(-rx * 0.66, -ry * 0.16); ctx.lineTo(-rx * 0.5, -ry * 0.26);
    ctx.lineTo(-rx * 0.74, -ry * 0.42); ctx.lineTo(-rx * 0.55, -ry * 0.52);
    ctx.lineTo(-rx * 0.76, -ry * 0.68); ctx.lineTo(-rx * 0.55, -ry * 0.76);
    ctx.bezierCurveTo(-rx * 0.55, -ry * 0.92, -rx * 0.4, -ry * 1.0, -rx * 0.15, -ry);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(-rx, -ry, rx, ry);
  g.addColorStop(0, '#d26a7e'); g.addColorStop(0.5, '#9a2a4a'); g.addColorStop(1, '#4e0e26');
  shape(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { shape(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); shape(); ctx.clip();
  const T = seeded(61);
  // red pulp: a dark, fine speckle all over
  ctx.fillStyle = 'rgba(70,10,30,0.4)';
  for (let i = 0; i < 260; i++) { ctx.beginPath(); ctx.arc((T() - 0.5) * rx * 2.2, (T() - 0.5) * ry * 2.1, 1 + T() * 1.6, 0, Math.PI * 2); ctx.fill(); }
  // white pulp: many pale nodules, each round a small central artery (the spleen's tell-tale speckle)
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 46), x = Math.cos(a) * r * rx * 0.8 + rx * 0.08, y = Math.sin(a) * r * ry * 0.85;
    const rr = 5 + T() * 5;
    ctx.fillStyle = 'rgba(250,236,226,0.85)'; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.8, a, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,30,50,0.9)'; ctx.beginPath(); ctx.arc(x + rr * 0.2, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  // trabeculae: fibrous strands running in from the capsule
  ctx.strokeStyle = 'rgba(250,220,220,0.45)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 18; i++) {
    const a = -1.6 + i * 0.19, x0 = rx * 0.15 + Math.cos(a) * rx * 0.95, y0 = Math.sin(a) * ry * 0.98;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 * 0.75 + (T() - 0.5) * 18, y0 * 0.75, x0 * (0.5 + T() * 0.15), y0 * (0.5 + T() * 0.15)); ctx.stroke();
  }
  // branches of the splenic artery fanning in from the hilum
  ctx.globalAlpha = 0.6;
  for (const a of [-0.7, -0.2, 0.3, 0.75]) vesselTree(ctx, -rx * 0.45, ry * 0.08, a, rx * 0.32, 4, 3, '#5e0e22', T);
  ctx.globalAlpha = 1;
  ctx.restore();
  // a thin pale capsule just inside the outline
  ctx.save(); shape(); ctx.clip(); shape(); ctx.strokeStyle = 'rgba(250,225,225,0.7)'; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
  // splenic artery and vein at the hilum, and the short gastric vessels
  ctx.lineCap = 'round';
  for (const [col, dy] of [['#b8433a', -12], ['#4a6aa8', 14]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-rx * 0.5, ry * 0.06 + dy); ctx.quadraticCurveTo(-rx * 0.85, ry * 0.1 + dy * 2, -rx * 1.08, ry * 0.18 + dy * 3); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.stroke();
  }
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

// ── Bone marrow ─────────────────────────────────────────────────────────────
/** A long bone cut open along its length: ivory cortex, red marrow in the shaft, spongy bone in each head,
 *  and a nutrient artery entering through its foramen. */
export function drawMarrow(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell * rx / 260, swell * ry / 120);
  const bone = () => {
    ctx.beginPath();
    ctx.moveTo(-130, -60); ctx.lineTo(130, -60);
    ctx.bezierCurveTo(165, -60, 170, -116, 215, -116); ctx.bezierCurveTo(265, -116, 270, -40, 258, 0);
    ctx.bezierCurveTo(270, 40, 265, 116, 215, 116); ctx.bezierCurveTo(170, 116, 165, 60, 130, 60);
    ctx.lineTo(-130, 60);
    ctx.bezierCurveTo(-165, 60, -170, 116, -215, 116); ctx.bezierCurveTo(-265, 116, -270, 40, -258, 0);
    ctx.bezierCurveTo(-270, -40, -265, -116, -215, -116); ctx.bezierCurveTo(-170, -116, -165, -60, -130, -60);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, -120, 0, 120);
  g.addColorStop(0, '#f2e8d0'); g.addColorStop(0.6, '#dccbaa'); g.addColorStop(1, '#a8956e');
  bone(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { bone(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); bone(); ctx.clip();
  const R = seeded(77);
  // spongy bone in each head: a net of struts with red marrow between them
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#c86a6e';
    ctx.beginPath(); ctx.ellipse(sx * 205, 0, 50, 92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const x = sx * 205 + (R() - 0.5) * 96, y = (R() - 0.5) * 178, a = (R() - 0.5) * 1.6 + (sx > 0 ? 0.3 : -0.3);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (10 + R() * 14), y + Math.sin(a) * (10 + R() * 14)); ctx.stroke();
    }
    // the growth plate: a wavy line where the head meets the shaft
    ctx.strokeStyle = 'rgba(60,40,30,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let y = -88; y <= 88; y += 8) { const x = sx * (152 + Math.sin(y * 0.2) * 4); y === -88 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  }
  // the shaft's cortex: longitudinal lamellae; the marrow cavity inside it
  ctx.strokeStyle = 'rgba(120,100,70,0.45)'; ctx.lineWidth = 1;
  for (const y0 of [-56, -50, -44, 44, 50, 56]) { ctx.beginPath(); ctx.moveTo(-150, y0 + (R() - 0.5) * 2); ctx.bezierCurveTo(-50, y0 + 2, 50, y0 - 2, 150, y0); ctx.stroke(); }
  ctx.fillStyle = '#c0505a'; ctx.beginPath(); ctx.roundRect(-152, -38, 304, 76, 30); ctx.fill();
  // red marrow: blood-forming cells in clusters, and pale fat cells among them
  for (let i = 0; i < 170; i++) {
    const x = -146 + R() * 292, y = -34 + R() * 68;
    ctx.fillStyle = R() < 0.18 ? 'rgba(250,236,190,0.9)' : R() < 0.5 ? 'rgba(130,30,50,0.55)' : 'rgba(230,150,160,0.6)';
    ctx.beginPath(); ctx.arc(x, y, R() < 0.18 ? 4 : 1.6 + R() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  // a nutrient artery running along the cavity
  ctx.globalAlpha = 0.7;
  vesselTree(ctx, -10, -52, 2.0, 50, 3.2, 3, '#8a1e2a', R);
  vesselTree(ctx, -10, -52, 1.2, 50, 3.2, 3, '#8a1e2a', R);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-60, -78, 80, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // the nutrient foramen, with its artery entering the bone
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-10, -60); ctx.quadraticCurveTo(-30, -84, -60, -92); ctx.stroke();
  ctx.strokeStyle = '#b8433a'; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-10, -60, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  bone(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

// ── Stomach ─────────────────────────────────────────────────────────────────
/** The stomach: a J of muscle from the oesophagus to the pylorus, its lining thrown into folds (rugae), a pool of
 *  acid in its lower curve, and the gastric arteries along both curvatures. */
export function drawStomach(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell * rx / 200, swell * ry / 150);
  const R = seeded(91);
  // the oesophagus coming in from above, the duodenum leaving to the lower right
  ctx.lineCap = 'round';
  for (const [pts, w] of [[[[-10, -140], [-20, -175], [-5, -215]], 34], [[[196, 5], [230, 30], [250, 85], [235, 140]], 30]] as [number[][], number][]) {
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
    path(); ctx.strokeStyle = INK; ctx.lineWidth = w + 5; ctx.lineJoin = 'round'; ctx.stroke();
    path(); ctx.strokeStyle = '#e0a090'; ctx.lineWidth = w; ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(150,60,50,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
  }
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -140);
    ctx.bezierCurveTo(-130, -178, -210, -90, -188, -10); // the fundus
    ctx.bezierCurveTo(-170, 92, -60, 156, 40, 142); // the greater curvature
    ctx.bezierCurveTo(122, 130, 172, 78, 198, 22); // the antrum
    ctx.lineTo(200, -12); // the pylorus
    ctx.bezierCurveTo(130, -22, 62, 12, 12, -22); // the lesser curvature
    ctx.bezierCurveTo(-14, -42, 6, -118, 22, -140);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(-60, -60, 10, 0, 0, 220);
  g.addColorStop(0, '#f0b8a0'); g.addColorStop(0.6, '#d88a78'); g.addColorStop(1, '#a8584a');
  shape(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { shape(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); shape(); ctx.clip();
  // a pool of acid in the lower curve
  ctx.fillStyle = 'rgba(200,210,90,0.45)';
  ctx.beginPath(); ctx.moveTo(-200, 40); ctx.bezierCurveTo(-80, 30, 60, 60, 210, 30); ctx.lineTo(210, 200); ctx.lineTo(-200, 200); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,130,40,0.6)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(-150 + R() * 320, 60 + R() * 70, 2 + R() * 4, 0, Math.PI * 2); ctx.stroke(); }
  // rugae: the lining's long folds, running from the fundus round to the pylorus
  ctx.strokeStyle = 'rgba(110,40,40,0.55)'; ctx.lineWidth = 2.2;
  for (let k = 0; k < 7; k++) {
    const off = -40 + k * 16;
    ctx.beginPath();
    for (let u = 0; u <= 1.0001; u += 0.04) {
      const x = -160 + u * 340, base = -30 + Math.sin(u * Math.PI) * 70 + off * (1 - u * 0.6);
      const y = base + Math.sin(u * 22 + k) * 5;
      u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // gastric arteries along both curvatures
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 6; i++) vesselTree(ctx, -150 + i * 55, 120 - Math.sin(i * 0.6) * 30, -1.6 + (R() - 0.5) * 0.4, 30, 2.4, 2, '#9a2a2a', R);
  for (let i = 0; i < 4; i++) vesselTree(ctx, 20 + i * 45, -12 + i * 4, 1.5, 24, 2.2, 2, '#9a2a2a', R);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-110, -90, 30, 14, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // the pyloric sphincter: a ring of muscle
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(199, 5, 6, 18, 0, 0, Math.PI * 2); ctx.stroke();
  shape(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

// ── Lymph node ──────────────────────────────────────────────────────────────
/** A lymph node cut open: a bean in a thin capsule, follicles with pale germinal centres in its cortex, cords and
 *  sinuses in its medulla, afferent lymphatics with their valves along its convex border, and the artery, vein and
 *  efferent lymphatic at its hilum. */
export function drawLymphNode(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  const R = seeded(53);
  const bean = () => {
    ctx.beginPath();
    ctx.moveTo(rx * 0.1, -ry);
    ctx.bezierCurveTo(rx * 0.75, -ry * 1.02, rx * 1.05, -ry * 0.45, rx * 1.0, 0);
    ctx.bezierCurveTo(rx * 1.02, ry * 0.5, rx * 0.7, ry * 1.02, rx * 0.05, ry);
    ctx.bezierCurveTo(-rx * 0.6, ry * 1.0, -rx * 1.0, ry * 0.55, -rx * 0.98, ry * 0.25);
    // the hilum: a notch on the left
    ctx.bezierCurveTo(-rx * 0.7, ry * 0.15, -rx * 0.7, -ry * 0.15, -rx * 0.98, -ry * 0.25);
    ctx.bezierCurveTo(-rx * 1.0, -ry * 0.6, -rx * 0.55, -ry * 1.0, rx * 0.1, -ry);
    ctx.closePath();
  };
  // afferent lymphatics arriving on the convex border, each with a small valve
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = -1.25 + i * 0.42, x0 = Math.cos(a) * rx * 0.98, y0 = Math.sin(a) * ry * 0.98, x1 = Math.cos(a) * rx * 1.25, y1 = Math.sin(a) * ry * 1.25;
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#e8e0c0'; ctx.lineWidth = 4.5; ctx.stroke();
    const vx = (x0 + x1) / 2, vy = (y0 + y1) / 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(vx - Math.sin(a) * 4, vy + Math.cos(a) * 4); ctx.lineTo(vx + Math.cos(a) * 4, vy + Math.sin(a) * 4); ctx.lineTo(vx + Math.sin(a) * 4, vy - Math.cos(a) * 4); ctx.stroke();
  }
  const g = ctx.createRadialGradient(rx * 0.2, -ry * 0.3, 10, 0, 0, rx * 1.1);
  g.addColorStop(0, '#f0d0c0'); g.addColorStop(0.6, '#d8a890'); g.addColorStop(1, '#a8705a');
  bean(); ctx.fillStyle = g; ctx.fill();
  if (kick > 0) { bean(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); bean(); ctx.clip();
  // the medulla: a paler core of cords and sinuses opening towards the hilum
  ctx.fillStyle = 'rgba(245,225,210,0.75)'; ctx.beginPath(); ctx.ellipse(-rx * 0.25, 0, rx * 0.5, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(150,80,70,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const a = -1.3 + i * 0.24; ctx.beginPath(); ctx.moveTo(-rx * 0.75, 0); ctx.quadraticCurveTo(-rx * 0.3 + Math.cos(a) * rx * 0.2, Math.sin(a) * ry * 0.3, -rx * 0.25 + Math.cos(a) * rx * 0.5, Math.sin(a) * ry * 0.45); ctx.stroke(); }
  // the cortex: a ring of follicles, each with a pale germinal centre
  for (let i = 0; i < 13; i++) {
    const a = -1.45 + i * 0.245, x = Math.cos(a) * rx * 0.72, y = Math.sin(a) * ry * 0.72, rr = 20 + R() * 6;
    ctx.fillStyle = 'rgba(120,60,90,0.55)'; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(250,235,220,0.85)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, rr * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,40,70,0.6)';
    for (let k = 0; k < 10; k++) { const b = R() * Math.PI * 2, d = rr * (0.6 + R() * 0.35); ctx.beginPath(); ctx.arc(x + Math.cos(b) * d, y + Math.sin(b) * d, 1.3, 0, Math.PI * 2); ctx.fill(); }
  }
  // the subcapsular sinus: a thin pale channel just inside the capsule
  bean(); ctx.strokeStyle = 'rgba(250,240,225,0.8)'; ctx.lineWidth = 9; ctx.stroke();
  ctx.restore();
  // at the hilum: artery, vein and the efferent lymphatic leaving
  for (const [col, dy, w] of [['#b8433a', -16, 7], ['#4a6aa8', 0, 7], ['#e8e0c0', 16, 6]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(-rx * 0.8, dy * 0.6); ctx.quadraticCurveTo(-rx * 1.05, dy * 1.4, -rx * 1.25, dy * 2.2); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  }
  bean(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

// ── Skin ────────────────────────────────────────────────────────────────────
/** A block of skin in cross-section: the layered epidermis with its scaly top, the dermis with a hair follicle,
 *  sweat gland and capillary loops, the pale fat beneath, and a cut through it all. */
export function drawSkin(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  const R = seeded(71), w = rx * 1.9, h = ry * 1.75, x0 = -w / 2, y0 = -h / 2;
  const block = () => { ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 18); };
  block(); ctx.fillStyle = '#f0d8c4'; ctx.fill();
  if (kick > 0) { block(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); block(); ctx.clip();
  // fat (hypodermis): pale lobules at the bottom
  ctx.fillStyle = '#f6e8b8'; ctx.fillRect(x0, y0 + h * 0.66, w, h * 0.34);
  ctx.strokeStyle = 'rgba(150,120,60,0.55)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) { const x = x0 + 14 + (i % 13) * (w / 13), y = y0 + h * 0.74 + Math.floor(i / 13) * h * 0.13; ctx.beginPath(); ctx.ellipse(x + (R() - 0.5) * 8, y, w / 28, h * 0.06, 0, 0, Math.PI * 2); ctx.stroke(); }
  // dermis: pinker, with collagen fibres
  ctx.fillStyle = '#e8b4a4'; ctx.fillRect(x0, y0 + h * 0.2, w, h * 0.46);
  ctx.strokeStyle = 'rgba(150,70,60,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) { const x = x0 + R() * w, y = y0 + h * 0.25 + R() * h * 0.38; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 12, y - 5, x + 24, y + 5, x + 36, y); ctx.stroke(); }
  // the epidermis: a wavy band of cell layers, with the dead scaly layer on top
  const wave = (yy: number, amp: number) => { ctx.beginPath(); ctx.moveTo(x0, yy); for (let x = x0; x <= x0 + w; x += 8) ctx.lineTo(x, yy + Math.sin(x * 0.08) * amp); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0, y0); ctx.closePath(); };
  wave(y0 + h * 0.22, 6); ctx.fillStyle = '#d89a8a'; ctx.fill();
  wave(y0 + h * 0.08, 2); ctx.fillStyle = '#f2e4cc'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,60,0.5)'; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let x = x0; x <= x0 + w; x += 8) { const yy = y0 + h * (0.04 + k * 0.016) + Math.sin(x * 0.05 + k) * 1.2; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
  // a hair follicle with its hair, and a sebaceous gland beside it
  const hx = x0 + w * 0.3;
  ctx.fillStyle = '#c87a6a'; ctx.beginPath(); ctx.ellipse(hx, y0 + h * 0.45, 9, h * 0.25, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx + 4, y0 + h * 0.66); ctx.quadraticCurveTo(hx, y0 + h * 0.2, hx + 30, y0 - 20); ctx.stroke();
  ctx.fillStyle = '#f0e0a0'; ctx.beginPath(); ctx.ellipse(hx + 18, y0 + h * 0.36, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  // a coiled sweat gland and its duct
  const sx = x0 + w * 0.68;
  ctx.strokeStyle = '#8a5a7a'; ctx.lineWidth = 3;
  ctx.beginPath(); for (let k = 0; k < 30; k++) { const a = k * 0.7; ctx.lineTo(sx + Math.cos(a) * (8 + k * 0.2), y0 + h * 0.6 + Math.sin(a) * 6); } ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx, y0 + h * 0.55); ctx.bezierCurveTo(sx - 6, y0 + h * 0.35, sx + 6, y0 + h * 0.2, sx, y0 + h * 0.04); ctx.stroke();
  // capillary loops reaching up into the dermal papillae
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 9; i++) vesselTree(ctx, x0 + 30 + i * (w - 60) / 8, y0 + h * 0.62, -Math.PI / 2 + (R() - 0.5) * 0.4, h * 0.2, 2.2, 1, '#9a2a2a', R);
  ctx.globalAlpha = 1;
  ctx.restore();
  // a cut: a dark wedge through the epidermis into the dermis
  ctx.fillStyle = 'rgba(110,20,25,0.85)';
  ctx.beginPath(); ctx.moveTo(x0 + w * 0.47, y0 - 2); ctx.lineTo(x0 + w * 0.53, y0 - 2); ctx.lineTo(x0 + w * 0.505, y0 + h * 0.4); ctx.closePath(); ctx.fill();
  block(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}

// ── Eye ─────────────────────────────────────────────────────────────────────
/** The eye cut in half from front to back: the bulging cornea, the iris and lens, the clear vitreous, the retina
 *  lining the back with its vessels fanning from the optic disc, and the optic nerve leaving behind. */
export function drawEye(ctx: CanvasRenderingContext2D, c: Vec, rx: number, ry: number, swell: number, kick: number) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(swell, swell);
  const R = seeded(83), r = Math.min(rx, ry) * 1.05;
  // the optic nerve, behind
  ctx.strokeStyle = INK; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.quadraticCurveTo(10, r * 1.2, 0, r * 1.5); ctx.stroke();
  ctx.strokeStyle = '#f0e0b0'; ctx.lineWidth = 28; ctx.stroke();
  const ball = () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); };
  // the sclera: the white of the eye
  ball(); ctx.fillStyle = '#f6efe2'; ctx.fill();
  if (kick > 0) { ball(); ctx.fillStyle = `rgba(255,60,50,${kick * 0.4})`; ctx.fill(); }
  ctx.save(); ball(); ctx.clip();
  // the retina and choroid lining the back, with vessels fanning from the optic disc
  ctx.fillStyle = '#e09a7a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2e8d8'; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fill(); // the vitreous
  ctx.globalAlpha = 0.6;
  for (const a of [-2.2, -1.6, -1.0, -0.4]) vesselTree(ctx, 0, r * 0.88, a, r * 0.45, 2.6, 3, '#9a2a2a', R);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f8f0c8'; ctx.beginPath(); ctx.ellipse(0, r * 0.86, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); // the optic disc
  ctx.restore();
  // the cornea bulging at the front (top), the iris, and the lens behind the pupil
  ctx.fillStyle = 'rgba(200,225,240,0.6)'; ctx.beginPath(); ctx.ellipse(0, -r * 0.92, r * 0.5, r * 0.22, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#5a7a9a'; ctx.lineWidth = 9; ctx.lineCap = 'butt';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.55, -r * 0.78); ctx.lineTo(sx * r * 0.16, -r * 0.78); ctx.stroke(); }
  ctx.fillStyle = 'rgba(240,230,200,0.85)'; ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.32, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ball(); ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.restore();
}
