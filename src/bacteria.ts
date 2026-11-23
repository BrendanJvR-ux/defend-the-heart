// The six named bacteria, drawn small enough to travel the vessels (about 36 × 22 at scale 1).
// Each reads by shape first (clusters, pairs, rods), colour second.
import type { BacteriumType } from './config';

const INK = '#2a1e18';

interface Look { base: string; dark: string; light: string }
export const BACTERIA_LOOK: Record<BacteriumType, Look> = {
  saureus: { base: '#e0b030', dark: '#8a6410', light: '#f8e08a' },
  spneumo: { base: '#9a6ad8', dark: '#4e2a8a', light: '#d8c0f4' },
  listeria: { base: '#3aa89a', dark: '#16584e', light: '#a8e8dc' },
  nmening: { base: '#e06a78', dark: '#8a2432', light: '#f8c0c8' },
  ecoli: { base: '#78b850', dark: '#3a6a22', light: '#c8eaa8' },
  kpneumo: { base: '#7a90b0', dark: '#34465e', light: '#ccd8ea' },
};

function fillFor(ctx: CanvasRenderingContext2D, look: Look, hit: number, r: number) {
  if (hit > 0) return '#ffffff';
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r * 1.2);
  g.addColorStop(0, look.light); g.addColorStop(0.55, look.base); g.addColorStop(1, look.dark);
  return g;
}

function coccus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, hit: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = fillFor(ctx, look, hit, r); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
}

function rod(ctx: CanvasRenderingContext2D, len: number, thick: number, look: Look, hit: number) {
  ctx.fillStyle = fillFor(ctx, look, hit, thick); ctx.beginPath(); ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
}

function flagella(ctx: CanvasRenderingContext2D, look: Look, around: boolean, t: number) {
  ctx.strokeStyle = look.dark; ctx.lineWidth = 1.2;
  const wave = Math.sin(t * 6) * 2;
  const tails = around ? [[-12, -6, -1], [-12, 6, 1], [0, -7, -1], [0, 7, 1], [10, -6, -1], [10, 6, 1]] : [[-12, 0, 0], [-11, -3, -1]];
  for (const [x, y, d] of tails) {
    ctx.beginPath(); ctx.moveTo(x, y);
    if (around && d !== 0) ctx.bezierCurveTo(x - 2, y + d * 3 + wave * 0.5, x + 3, y + d * 5 - wave * 0.5, x - 1, y + d * 8);
    else ctx.bezierCurveTo(x - 4, y - 3 + wave * 0.5, x - 6, y + 3 - wave * 0.5, x - 10, y + d * 2);
    ctx.stroke();
  }
}

export function drawBacterium(ctx: CanvasRenderingContext2D, type: BacteriumType, x: number, y: number, angle: number, hit: number, scale = 1, t = 0) {
  const look = BACTERIA_LOOK[type];
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(angle);
  if (type === 'saureus') {
    // a grape-like cluster of cocci
    for (const [cx, cy] of [[-8, -4], [0, -7], [8, -3], [-5, 4], [4, 4], [-1, -1], [10, 5]]) coccus(ctx, cx, cy, 5.4, look, hit);
  } else if (type === 'spneumo') {
    // lancet-shaped diplococci in a short chain
    for (const cx of [-12, -4, 4, 12]) {
      ctx.save(); ctx.translate(cx, 0); ctx.scale(1, 0.78);
      ctx.fillStyle = fillFor(ctx, look, hit, 5); ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    }
  } else if (type === 'nmening') {
    // a kidney-bean pair: two plump cocci pressed together, flat where they meet
    for (const side of [-1, 1]) {
      ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? -20 : 1, -12, 19, 24); ctx.clip();
      ctx.fillStyle = fillFor(ctx, look, hit, 8); ctx.beginPath(); ctx.ellipse(side * 4.5, 0, 8, 8.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
  } else if (type === 'listeria') {
    // a short rod with a tumbling tail
    flagella(ctx, look, false, t);
    rod(ctx, 24, 11, look, hit);
  } else if (type === 'ecoli') {
    // a rod with flagella all round
    flagella(ctx, look, true, t);
    rod(ctx, 32, 14, look, hit);
    ctx.fillStyle = 'rgba(30,60,20,0.4)'; for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.arc(dx, 1, 1.6, 0, Math.PI * 2); ctx.fill(); }
  } else {
    // Klebsiella: a fat rod inside a thick mucoid capsule
    ctx.fillStyle = 'rgba(220,228,240,0.75)'; ctx.beginPath(); ctx.roundRect(-21, -12, 42, 24, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(52,70,94,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    rod(ctx, 30, 15, look, hit);
  }
  ctx.restore();
}
