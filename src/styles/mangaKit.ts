// Shared tools for the coloured-manga studies: bold ink lines, cel shadows with
// screentone, speed lines, sound-effect lettering, and a site checker for scenery.
import { MAP_W, MAP_H, rng, type Vec } from './scene';
import { LANES, LANE_IDS, RIVER, POND, LEY_EDGES, NODE, FOUNDATION_IDS, MILL, INKWELL, pointAt } from '../map';

export const INK = '#141414';
export const JP_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif';

/** Dots of screentone inside the current clip. */
export function tone(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, gap = 5, r = 1.1, color = 'rgba(0,0,0,0.32)') {
  ctx.fillStyle = color;
  for (let y = y0; y < y1; y += gap) {
    const off = (Math.round((y - y0) / gap) % 2) * gap / 2;
    for (let x = x0 + off; x < x1; x += gap) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
}

/**
 * Manga cel fill: flat base colour, a hard shadow on the right half with screentone,
 * a thin white rim on the lit edge, then a bold ink outline.
 */
export function inked(ctx: CanvasRenderingContext2D, build: () => void, box: [number, number, number, number], base: string, shade: string, lw = 2.4, shadowFrom = 0.55) {
  const [x, y, w, h] = box;
  ctx.save(); build(); ctx.fillStyle = base; ctx.fill(); ctx.clip();
  const sx = x + w * shadowFrom;
  ctx.fillStyle = shade; ctx.fillRect(sx, y - 4, w, h + 8);
  ctx.save(); ctx.beginPath(); ctx.rect(sx, y - 4, w, h + 8); ctx.clip(); tone(ctx, sx, y - 4, x + w + 4, y + h + 4, 4.5, 0.9); ctx.restore();
  ctx.restore();
  ctx.save(); build(); ctx.clip(); ctx.translate(-2, -2); build(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  ctx.save(); build(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}

/** Radiating speed lines around a point. */
export function speedLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, n: number, seed = 1, color = INK) {
  const R = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.1, w = 0.012 + R() * 0.02, rr = r0 + R() * (r1 - r0) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1);
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.lineTo(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1);
    ctx.closePath(); ctx.fill();
  }
}

/** Sound-effect lettering: heavy, outlined, slightly rotated. */
export function sfx(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, rot: number, fill: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `900 ${size}px ${JP_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * 0.32; ctx.strokeText(text, 0, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = size * 0.14; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill; ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Thick manga panel border with a white gutter. */
export function panel(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 22; ctx.strokeRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(11, 11, MAP_W - 22, MAP_H - 22);
}

/** Hard manga drop shadow: an offset shape filled with screentone. */
export function hardShadow(ctx: CanvasRenderingContext2D, build: () => void, dx: number, dy: number, box: [number, number, number, number]) {
  ctx.save(); ctx.translate(dx, dy); build(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(box[0] - 10, box[1] - 10, box[2] + 20, box[3] + 20);
  tone(ctx, box[0] - 10, box[1] - 10, box[0] + box[2] + 10, box[1] + box[3] + 10, 4, 1, 'rgba(0,0,0,0.35)');
  ctx.restore();
}

// ── Where scenery may go ────────────────────────────────────────────────────
const ROAD_PTS: Vec[] = [];
for (const id of LANE_IDS) for (let s = 0; s < LANES[id].length; s += 12) ROAD_PTS.push(pointAt(LANES[id], s));
const LEY_PTS: Vec[] = LEY_EDGES.flatMap((e) => e.pts);
const RIVER_PTS: Vec[] = [];
for (let i = 1; i < RIVER.length; i++) for (let t = 0; t <= 1; t += 0.04) RIVER_PTS.push({ x: RIVER[i - 1].x + (RIVER[i].x - RIVER[i - 1].x) * t, y: RIVER[i - 1].y + (RIVER[i].y - RIVER[i - 1].y) * t });

/** True if a rectangle of scenery centred at (x, y) keeps clear of the playing pieces. */
export function clearSite(x: number, y: number, rx: number, ry: number, pad = 0): boolean {
  const r = Math.max(rx, ry);
  if (x - rx < 18 || x + rx > MAP_W - 18 || y - ry < 18 || y + ry > MAP_H - 18) return false;
  if (x > 1380 && y > 330 && y < 880) return false;
  if (Math.hypot(x - MILL.x, y - MILL.y) < r + 80) return false;
  if (Math.hypot(x - INKWELL.x, y - INKWELL.y) < r + 90) return false;
  if (ROAD_PTS.some((p) => Math.abs(p.x - x) < rx + 30 + pad && Math.abs(p.y - y) < ry + 30 + pad)) return false;
  if (LEY_PTS.some((p) => Math.abs(p.x - x) < rx + 10 && Math.abs(p.y - y) < ry + 10)) return false;
  if (RIVER_PTS.some((p) => Math.abs(p.x - x) < rx + 24 && Math.abs(p.y - y) < ry + 24)) return false;
  if (Math.hypot((x - POND.x) / (100 + rx), (y - POND.y) / (66 + ry)) < 1) return false;
  if (FOUNDATION_IDS.some((f) => Math.abs(NODE[f].x - x) < rx + 46 && Math.abs(NODE[f].y - y) < ry + 46)) return false;
  return true;
}
