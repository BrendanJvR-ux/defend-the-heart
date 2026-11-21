// Canvas renderer: the open storybook spread, drawn procedurally.
import { BALANCE, type EnemyType, type TowerType } from './balance';
import {
  MAP_W, MAP_H, GUTTER_X, LANES, LANE_IDS, RIVER, POND, MILL, BRIDGE, INKWELL, GATE, CASTLE,
  LEY_EDGES, NODE, FOUNDATION_IDS, routePolyline, pointAt, type Vec,
} from './map';
import { type GameState, type Tower, enemyPos, posOf, towerAt, flightPoint } from './game';

export const C = {
  paper: '#f3e5c5',
  paperDeep: '#e6d1a2',
  paperEdge: '#d4bb86',
  ink: '#2a1f17',
  inkSoft: 'rgba(42,31,23,0.55)',
  forest: '#2f5a3a',
  forestLight: '#5f8a4f',
  forestPale: '#9fb781',
  oxblood: '#7a2026',
  oxbloodLight: '#a3423f',
  gold: '#bf9433',
  goldLight: '#ebcb6c',
  water: '#8fb2aa',
  waterDeep: '#5f8c86',
  dirt: '#cfae7c',
  dirtDark: '#a8865a',
  cobble: '#c2b291',
  stone: '#d9ccb0',
  stoneDark: '#9c8f75',
  ley: 'rgba(110,88,62,0.75)',
  thread: '#1c1d33',
  threadWet: '#2b3566',
  threadCore: '#e9f0ff',
  shadow: 'rgba(70,45,20,0.28)',
};

export interface Gesture {
  active: boolean;
  path: Vec[];
  pointer: Vec;
  slipping: number;
}

export interface ViewState {
  hoverFoundation: string | null;
  selectedFoundation: string | null;
  /** Foundation whose tower is being previewed for a bind. */
  bindPreview: string | null;
  gesture: Gesture;
  /** Pointer is coarse (touch): draw larger hit hints. */
  touch: boolean;
}

// ── tiny seeded RNG for stable scenery ──────────────────────────────────────
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

let staticLayer: HTMLCanvasElement | null = null;

function stroke(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

/** Smooth a polyline with rounded corners (for roads). */
function smoothPath(ctx: CanvasRenderingContext2D, pts: Vec[], r = 60) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

function nearRoad(p: Vec, margin: number): boolean {
  for (const id of LANE_IDS) {
    const L = LANES[id];
    for (let s = 0; s < L.length; s += 14) {
      const q = pointAt(L, s);
      if (Math.hypot(q.x - p.x, q.y - p.y) < margin) return true;
    }
  }
  return false;
}
function nearLey(p: Vec, margin: number): boolean {
  for (const e of LEY_EDGES) for (const q of e.pts) if (Math.hypot(q.x - p.x, q.y - p.y) < margin) return true;
  return false;
}
function nearRiver(p: Vec, margin: number): boolean {
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1], b = RIVER[i];
    for (let t = 0; t <= 1; t += 0.05) {
      const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (Math.hypot(q.x - p.x, q.y - p.y) < margin) return true;
    }
  }
  return Math.hypot(POND.x - p.x, (POND.y - p.y) * 1.4) < margin + 70;
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: number) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = C.shadow;
  ctx.beginPath(); ctx.ellipse(4, r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = C.ink;
  if (kind < 0.55) {
    // round broadleaf
    ctx.fillStyle = kind < 0.3 ? C.forest : C.forestLight;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.45 - r * 0.2, r * 0.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.95, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(0, r * 0.8); ctx.stroke();
  } else {
    // pine
    ctx.fillStyle = C.forest;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.75, r * 0.6); ctx.lineTo(-r * 0.75, r * 0.6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.1); ctx.lineTo(r * 0.4, -r * 0.1); ctx.stroke();
  }
  ctx.restore();
}

function buildStatic(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = MAP_W; cv.height = MAP_H;
  const ctx = cv.getContext('2d')!;
  const R = rng(7);

  // Parchment
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = `rgba(150,110,60,${R() * 0.06})`;
    ctx.fillRect(R() * MAP_W, R() * MAP_H, 1 + R() * 3, 1 + R() * 3);
  }
  // Page vignette per page
  for (const x0 of [0, GUTTER_X]) {
    const g = ctx.createRadialGradient(x0 + 400, 500, 200, x0 + 400, 500, 640);
    g.addColorStop(0, 'rgba(255,248,225,0.25)');
    g.addColorStop(1, 'rgba(150,105,50,0.18)');
    ctx.fillStyle = g; ctx.fillRect(x0, 0, 800, MAP_H);
  }
  // Gutter: a soft fold, very faint, drawn beneath everything so it never hides play.
  const gg = ctx.createLinearGradient(GUTTER_X - 40, 0, GUTTER_X + 40, 0);
  gg.addColorStop(0, 'rgba(120,80,35,0)');
  gg.addColorStop(0.5, 'rgba(120,80,35,0.13)');
  gg.addColorStop(1, 'rgba(120,80,35,0)');
  ctx.fillStyle = gg; ctx.fillRect(GUTTER_X - 40, 0, 80, MAP_H);

  // Meadow tint patches
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(110,140,80,${0.04 + R() * 0.05})`;
    ctx.beginPath(); ctx.ellipse(R() * MAP_W, R() * MAP_H, 60 + R() * 120, 30 + R() * 60, R() * 3, 0, Math.PI * 2); ctx.fill();
  }

  // River + pond
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink; ctx.lineWidth = 34; smoothPath(ctx, RIVER, 80); ctx.stroke();
  ctx.strokeStyle = C.water; ctx.lineWidth = 30; smoothPath(ctx, RIVER, 80); ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(POND.x, POND.y, 92, 58, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath(); ctx.ellipse(POND.x, POND.y, 89, 55, -0.15, 0, Math.PI * 2); ctx.fill();
  // water hatching
  ctx.strokeStyle = 'rgba(42,60,70,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    const x = POND.x - 60 + R() * 110, y = POND.y - 35 + R() * 70;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y); ctx.stroke();
  }
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1], b = RIVER[i];
    for (let t = 0.2; t < 1; t += 0.35) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 4, x + 7, y); ctx.stroke();
    }
  }
  // reeds
  ctx.strokeStyle = C.forest; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const a = R() * Math.PI * 2;
    const x = POND.x + Math.cos(a) * 95, y = POND.y + Math.sin(a) * 60;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 12); ctx.stroke();
  }

  // Trees (avoiding roads, leylines, foundations, river, buildings)
  const trees: { x: number; y: number; r: number; k: number }[] = [];
  for (let i = 0; i < 900 && trees.length < 150; i++) {
    const p = { x: 20 + R() * (MAP_W - 40), y: 20 + R() * (MAP_H - 40) };
    if (p.x > 1400 && p.y > 330 && p.y < 720) continue; // castle
    if (Math.hypot(p.x - MILL.x, p.y - MILL.y) < 90) continue;
    if (Math.hypot(p.x - INKWELL.x, p.y - INKWELL.y) < 110) continue;
    if (Math.abs(p.x - GUTTER_X) < 18) continue;
    if (nearRoad(p, 52) || nearLey(p, 30) || nearRiver(p, 34)) continue;
    if (FOUNDATION_IDS.some((f) => Math.hypot(NODE[f].x - p.x, NODE[f].y - p.y) < 62)) continue;
    if (trees.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 26)) continue;
    trees.push({ ...p, r: 11 + R() * 8, k: R() });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) drawTree(ctx, t.x, t.y, t.r, t.k);

  // Roads
  drawRoad(ctx, LANES.mill.pts, 'dirt');
  drawRoad(ctx, LANES.king.pts, 'cobble');
  // Bridge over the river on the King's Road
  drawBridge(ctx);
  // Junction plaque
  ctx.fillStyle = C.ink; ctx.font = 'italic 15px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';
  ctx.textAlign = 'center';

  drawMill(ctx);
  drawCastle(ctx);
  // Road labels, lettered like a map
  roadLabel(ctx, 'The Mill Road', { x: 300, y: 118 }, 0);
  roadLabel(ctx, 'The King’s Road', { x: 1000, y: 770 }, -0.33);
  roadLabel(ctx, 'Goosebridge Pond', { x: POND.x, y: POND.y + 82 }, 0);

  // Leylines (plain stitch; gold for bound branches is drawn live on top)
  drawLeylines(ctx);
  drawInkwell(ctx);

  // Page edges and ornamental border
  ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, MAP_W - 16, MAP_H - 16);
  ctx.strokeStyle = 'rgba(191,148,51,0.55)'; ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, MAP_W - 32, MAP_H - 32);

  // Title cartouche on the left page
  ctx.fillStyle = 'rgba(243,229,197,0.85)';
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  roundRect(ctx, 40, 880, 300, 78, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.oxblood; ctx.font = '600 26px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'left';
  ctx.fillText('The Siege of Goosebridge', 58, 918);
  ctx.fillStyle = C.inkSoft; ctx.font = 'italic 15px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';
  ctx.fillText('a map of the last ward', 60, 942);
  return cv;
}

function roadLabel(ctx: CanvasRenderingContext2D, text: string, p: Vec, angle: number) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
  ctx.font = 'italic 17px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(243,229,197,0.8)';
  const w = ctx.measureText(text).width;
  ctx.fillRect(-w / 2 - 4, -14, w + 8, 19);
  ctx.fillStyle = C.ink; ctx.fillText(text, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawRoad(ctx: CanvasRenderingContext2D, pts: Vec[], kind: 'dirt' | 'cobble') {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink; ctx.lineWidth = 40; smoothPath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = kind === 'dirt' ? C.dirt : C.cobble; ctx.lineWidth = 36; smoothPath(ctx, pts); ctx.stroke();
  if (kind === 'dirt') {
    // wheel ruts
    ctx.strokeStyle = C.dirtDark; ctx.lineWidth = 2; ctx.setLineDash([16, 9]);
    for (const off of [-8, 8]) {
      ctx.save(); ctx.translate(0, 0);
      const shifted = offsetPolyline(pts, off);
      smoothPath(ctx, shifted); ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);
  } else {
    // cobblestones
    const R = rng(3);
    ctx.strokeStyle = 'rgba(60,45,30,0.5)'; ctx.lineWidth = 1;
    ctx.fillStyle = '#d6c7a7';
    const lane = LANES.king;
    for (let s = 0; s < lane.length; s += 11) {
      const p = pointAt(lane, s);
      for (const off of [-11, 0, 11]) {
        const x = p.x - Math.sin(p.angle) * (off + (R() - 0.5) * 3), y = p.y + Math.cos(p.angle) * (off + (R() - 0.5) * 3);
        ctx.beginPath(); ctx.ellipse(x, y, 4.2, 3.2, p.angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
  }
}

function offsetPolyline(pts: Vec[], off: number): Vec[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * off, y: p.y + ((b.x - a.x) / len) * off };
  });
}

function drawBridge(ctx: CanvasRenderingContext2D) {
  const a = pointAt(LANES.king, LANES.king.cum[3]);
  ctx.save();
  ctx.translate(BRIDGE.x, BRIDGE.y);
  ctx.rotate(a.angle - 0.15);
  ctx.fillStyle = C.shadow; ctx.fillRect(-42, -22, 92, 52);
  ctx.fillStyle = C.stone; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.fillRect(-46, -26, 92, 52); ctx.strokeRect(-46, -26, 92, 52);
  // parapets
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(-48, -30, 96, 7); ctx.strokeRect(-48, -30, 96, 7);
  ctx.fillRect(-48, 23, 96, 7); ctx.strokeRect(-48, 23, 96, 7);
  ctx.strokeStyle = 'rgba(42,31,23,0.45)'; ctx.lineWidth = 1;
  for (let x = -40; x < 46; x += 12) { ctx.beginPath(); ctx.moveTo(x, -23); ctx.lineTo(x, 23); ctx.stroke(); }
  ctx.restore();
  // a goose on the parapet
  drawGoose(ctx, BRIDGE.x + 26, BRIDGE.y - 40, 0.8, 1);
}

export function drawGoose(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, flying = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k * dir, k);
  ctx.fillStyle = '#fbf6ea'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  if (flying) {
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-4, -14, 0, -2); ctx.quadraticCurveTo(4, -14, 14, 0);
    ctx.quadraticCurveTo(4, -4, 0, 2); ctx.quadraticCurveTo(-4, -4, -14, 0); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(12, -16, 9, -18); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.lineWidth = 2.4; ctx.strokeStyle = '#fbf6ea'; ctx.stroke();
  ctx.fillStyle = '#d98b2b'; ctx.beginPath(); ctx.moveTo(9, -19); ctx.lineTo(15, -17); ctx.lineTo(9, -16); ctx.fill();
  ctx.restore();
}

function drawMill(ctx: CanvasRenderingContext2D) {
  const { x, y } = MILL;
  ctx.save(); ctx.translate(x, y);
  // shadow
  ctx.fillStyle = C.shadow; ctx.fillRect(-36, -28, 82, 62);
  // body
  ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.fillRect(-42, -34, 78, 60); ctx.strokeRect(-42, -34, 78, 60);
  // roof
  ctx.fillStyle = C.oxblood;
  ctx.beginPath(); ctx.moveTo(-50, -32); ctx.lineTo(-3, -70); ctx.lineTo(44, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
  // door + window
  ctx.fillStyle = C.ink; ctx.fillRect(-10, -2, 14, 28);
  ctx.fillRect(14, -20, 10, 10);
  // water wheel
  ctx.translate(-50, 10);
  ctx.fillStyle = '#b9925c';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = C.ink; ctx.font = 'italic 15px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('the Old Mill', x, y + 46);
}

function drawCastle(ctx: CanvasRenderingContext2D) {
  const x = CASTLE.x, y = CASTLE.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
  // shadow
  ctx.fillStyle = C.shadow; ctx.fillRect(-60, -120, 140, 250);
  // curtain wall
  ctx.fillStyle = C.stone; ctx.fillRect(-66, -126, 130, 252); ctx.strokeRect(-66, -126, 130, 252);
  // crenellations
  for (let i = -126; i < 126; i += 18) { ctx.fillStyle = C.stone; ctx.fillRect(-74, i, 10, 10); ctx.strokeRect(-74, i, 10, 10); }
  // keep
  ctx.fillStyle = '#e4d8bd'; ctx.fillRect(-20, -70, 64, 140); ctx.strokeRect(-20, -70, 64, 140);
  ctx.fillStyle = C.oxblood;
  ctx.beginPath(); ctx.moveTo(-28, -70); ctx.lineTo(12, -118); ctx.lineTo(52, -70); ctx.closePath(); ctx.fill(); ctx.stroke();
  // corner towers
  for (const ty of [-126, 126]) {
    ctx.fillStyle = C.stone; ctx.beginPath(); ctx.arc(-58, ty, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.oxblood; ctx.beginPath(); ctx.moveTo(-86, ty); ctx.lineTo(-58, ty - 44); ctx.lineTo(-30, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    // pennant
    ctx.beginPath(); ctx.moveTo(-58, ty - 44); ctx.lineTo(-58, ty - 64); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-58, ty - 64); ctx.lineTo(-40, ty - 58); ctx.lineTo(-58, ty - 52); ctx.fill(); ctx.stroke();
  }
  // gate arch facing the road
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.moveTo(-68, 22); ctx.lineTo(-68, -8); ctx.arc(-68, -8, 0, 0, 0); ctx.lineTo(-52, -26); ctx.lineTo(-52, 22); ctx.closePath();
  ctx.beginPath(); ctx.rect(-74, -20, 22, 40); ctx.fill();
  ctx.fillStyle = C.gold; ctx.font = '600 15px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
  ctx.restore();
  ctx.fillStyle = C.ink; ctx.font = 'italic 16px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Goosebridge Castle', x + 4, y + 168);
}

function drawInkwell(ctx: CanvasRenderingContext2D) {
  const { x, y } = INKWELL;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(6, 30, 40, 12, 0, 0, Math.PI * 2); ctx.fill();
  // pot
  ctx.fillStyle = '#26324f'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-30, 26); ctx.quadraticCurveTo(-38, -6, -16, -14); ctx.lineTo(16, -14); ctx.quadraticCurveTo(38, -6, 30, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.gold; ctx.fillRect(-18, -22, 36, 9); ctx.strokeRect(-18, -22, 36, 9);
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-20, 14); ctx.quadraticCurveTo(-24, 0, -14, -6); ctx.stroke();
  // quill
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.fillStyle = '#fbf6ea';
  ctx.beginPath(); ctx.moveTo(2, -18); ctx.quadraticCurveTo(-10, -60, -36, -92); ctx.quadraticCurveTo(-6, -74, 2, -18); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.ink; ctx.font = 'italic 15px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('the Inkwell', x, y + 52);
}

function drawLeylines(ctx: CanvasRenderingContext2D) {
  // A faint pencil guide: fine dotted double line. Ink is laid over it when you trace.
  ctx.lineCap = 'round';
  for (const e of LEY_EDGES) {
    ctx.strokeStyle = 'rgba(110,88,62,0.28)'; ctx.lineWidth = 7; ctx.setLineDash([]);
    stroke(ctx, e.pts);
    ctx.strokeStyle = C.paper; ctx.lineWidth = 4.5;
    stroke(ctx, e.pts);
    ctx.strokeStyle = C.ley; ctx.lineWidth = 2; ctx.setLineDash([2, 5]);
    stroke(ctx, e.pts);
  }
  ctx.setLineDash([]);
  for (const n of Object.values(NODE)) {
    if (n.foundation || n.id === 'ink') continue;
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.ley; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(n.x, n.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

// ── Tower / enemy art ───────────────────────────────────────────────────────

function towerShape(ctx: CanvasRenderingContext2D, type: TowerType) {
  ctx.beginPath();
  if (type === 'bramble') {
    ctx.moveTo(-17, 0); ctx.lineTo(-13, -44); ctx.lineTo(-20, -50); ctx.lineTo(-9, -56); ctx.lineTo(-6, -70);
    ctx.lineTo(0, -58); ctx.lineTo(7, -72); ctx.lineTo(9, -56); ctx.lineTo(20, -52); ctx.lineTo(13, -44); ctx.lineTo(17, 0);
  } else if (type === 'ember') {
    ctx.moveTo(-23, 0); ctx.quadraticCurveTo(-30, -26, -12, -40); ctx.lineTo(-7, -60); ctx.lineTo(7, -60);
    ctx.lineTo(12, -40); ctx.quadraticCurveTo(30, -26, 23, 0);
  } else {
    ctx.moveTo(-12, 0); ctx.lineTo(-10, -56); ctx.lineTo(-15, -56); ctx.lineTo(0, -88); ctx.lineTo(15, -56);
    ctx.lineTo(10, -56); ctx.lineTo(12, 0);
  }
  ctx.closePath();
}

export function drawTowerIcon(ctx: CanvasRenderingContext2D, type: TowerType, x: number, y: number, k: number, time = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  // paper-cutout offset shadow
  ctx.save(); ctx.translate(5, 4); ctx.fillStyle = C.shadow; towerShape(ctx, type); ctx.fill(); ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  if (type === 'bramble') {
    ctx.fillStyle = C.forest; towerShape(ctx, type); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.forestPale; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(10, -18, -8, -28); ctx.quadraticCurveTo(12, -36, -6, -44); ctx.stroke();
    ctx.fillStyle = C.oxbloodLight;
    for (const [bx, by] of [[6, -14], [-8, -34], [9, -40]]) { ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = C.ink; ctx.fillRect(-4, -20, 8, 10);
  } else if (type === 'ember') {
    ctx.fillStyle = C.oxblood; towerShape(ctx, type); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(42,31,23,0.5)'; ctx.lineWidth = 1;
    for (let yy = -8; yy > -38; yy -= 8) { ctx.beginPath(); ctx.moveTo(-20, yy); ctx.lineTo(20, yy); ctx.stroke(); }
    const glow = 0.7 + 0.3 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(255,${140 + 60 * glow},60,1)`;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -10, 8, Math.PI, 0); ctx.lineTo(8, 0); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // smoke puffs
    ctx.fillStyle = 'rgba(120,110,100,0.35)';
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.6 + i / 3) % 1;
      ctx.beginPath(); ctx.arc(4 * Math.sin(t * 6), -64 - t * 26, 4 + t * 6, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = C.stone; towerShape(ctx, type); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.oxblood;
    ctx.beginPath(); ctx.moveTo(-15, -56); ctx.lineTo(0, -88); ctx.lineTo(15, -56); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-7, -26); ctx.lineTo(-7, -44); ctx.arc(0, -44, 7, Math.PI, 0); ctx.lineTo(7, -26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-5, -30); ctx.quadraticCurveTo(-5, -42, 0, -42); ctx.quadraticCurveTo(5, -42, 5, -30); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, type: EnemyType, x: number, y: number, dir: number, bob: number, hit: number, k = 1) {
  ctx.save(); ctx.translate(x, y + Math.sin(bob) * 1.2); ctx.scale(dir * k, k);
  ctx.lineWidth = 1.6; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round';
  const flash = hit > 0;
  if (type === 'goblin') {
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(2, 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    // spear
    ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(12, -18); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(12, -18); ctx.lineTo(16, -24); ctx.lineTo(10, -21); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#7d9a55';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head with ears
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-13, -16); ctx.lineTo(-5, -16); ctx.arc(0, -13, 5.5, Math.PI, 0); ctx.lineTo(13, -16); ctx.lineTo(6, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.oxblood; ctx.fillRect(-6, -2, 12, 4);
  } else if (type === 'wolf') {
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(2, 9, 16, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#7d7a78';
    ctx.beginPath();
    ctx.moveTo(-18, -4); ctx.lineTo(-24, -10); ctx.lineTo(-14, -8); // tail
    ctx.quadraticCurveTo(-4, -12, 8, -8); ctx.lineTo(12, -14); ctx.lineTo(14, -9); ctx.lineTo(22, -6); ctx.lineTo(16, -2);
    ctx.lineTo(12, 0); ctx.lineTo(12, 8); ctx.lineTo(8, 8); ctx.lineTo(7, 1);
    ctx.lineTo(-10, 1); ctx.lineTo(-11, 8); ctx.lineTo(-15, 8); ctx.lineTo(-15, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(14, -7, 1.3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(2, 13, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#efe4cc';
    // woolly body
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.arc(-14 + i * 5.5, -6 + (i % 2) * 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2, -2, 18, 11, 0, 0, Math.PI * 2); ctx.stroke();
    // iron barding
    ctx.fillStyle = flash ? '#fff' : '#8c8d8f';
    ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(10, -12); ctx.lineTo(12, 2); ctx.lineTo(-16, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; for (const rx of [-10, -2, 6]) { ctx.beginPath(); ctx.arc(rx, -5, 1.4, 0, Math.PI * 2); ctx.fill(); }
    // legs
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(-12, 13); ctx.moveTo(8, 7); ctx.lineTo(8, 13); ctx.stroke();
    ctx.lineWidth = 1.6;
    // head and curled horn
    ctx.fillStyle = '#5a4a3c'; ctx.beginPath(); ctx.ellipse(18, -6, 7, 6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d4b98a'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(15, -10, 5, Math.PI * 0.9, Math.PI * 2.5); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(15, -10, 7, Math.PI * 0.9, Math.PI * 2.5); ctx.stroke();
  }
  ctx.restore();
}

export function enemyIconCanvas(type: EnemyType, size = 44): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawEnemy(ctx, type, size / 2, size / 2 + 4, 1, 0, 0, size / 44);
  return cv;
}

export function towerIconCanvas(type: TowerType, size = 48): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawTowerIcon(ctx, type, size / 2, size - 4, size / 96);
  return cv;
}

// ── Live drawing ────────────────────────────────────────────────────────────

/** A stroke of real ink: tapering, slightly wobbly, with a soaked-in halo and a wet sheen that flows. */
function inkThread(ctx: CanvasRenderingContext2D, path: Vec[], time: number, alpha = 1, mode: 'wet' | 'dry' | 'fading' = 'wet') {
  if (path.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // soaked halo in the paper
  ctx.strokeStyle = mode === 'dry' ? 'rgba(60,45,35,0.12)' : 'rgba(28,29,51,0.16)';
  ctx.lineWidth = 15;
  stroke(ctx, path);
  // body: variable width like a nib under pressure
  const col = mode === 'dry' ? '#5a4a40' : mode === 'fading' ? '#4a4a5c' : C.thread;
  ctx.strokeStyle = col; ctx.fillStyle = col;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    const w = (mode === 'dry' ? 3.4 : 6) + 1.8 * Math.sin(acc * 0.045) + 1 * Math.sin(acc * 0.13 + 1.7);
    ctx.lineWidth = Math.max(1.6, w);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // blots where the nib paused at each knot
  for (let i = 0; i < path.length; i += Math.max(1, Math.floor(path.length / 9))) {
    const p = path[i];
    const r = 3.2 + ((i * 37) % 5) * 0.55;
    ctx.beginPath(); ctx.arc(p.x + ((i * 13) % 5) - 2, p.y + ((i * 7) % 5) - 2, r, 0, Math.PI * 2); ctx.fill();
  }
  if (mode === 'wet') {
    // a wet sheen running down the stroke
    ctx.strokeStyle = 'rgba(150,170,230,0.55)'; ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 26]); ctx.lineDashOffset = -time * 60;
    stroke(ctx, path);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Permanent gold leaf along the route of a bound tower (or a dashed preview). */
function goldRoute(ctx: CanvasRenderingContext2D, foundation: string, preview: boolean, time: number) {
  const path = routePolyline(foundation);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (preview) {
    ctx.strokeStyle = `rgba(125,92,23,${0.55 + 0.3 * Math.sin(time * 5)})`; ctx.lineWidth = 16;
    stroke(ctx, path);
    ctx.strokeStyle = C.goldLight; ctx.lineWidth = 10; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 30;
    stroke(ctx, path);
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = '#7d5c17'; ctx.lineWidth = 15; stroke(ctx, path);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 11; stroke(ctx, path);
    ctx.strokeStyle = C.goldLight; ctx.lineWidth = 4; ctx.setLineDash([2, 6]); stroke(ctx, path); ctx.setLineDash([]);
    // gilt leaves
    ctx.fillStyle = C.goldLight; ctx.strokeStyle = '#7d5c17'; ctx.lineWidth = 1;
    for (let i = 6; i < path.length - 2; i += 7) {
      const p = path[i], q = path[i + 1];
      const a = Math.atan2(q.y - p.y, q.x - p.x) + (i % 2 ? 0.9 : -0.9);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(11, 0, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawFoundation(ctx: CanvasRenderingContext2D, f: string, selected: boolean, hovered: boolean, bound: boolean, preview: boolean, time: number) {
  const n = NODE[f];
  ctx.save(); ctx.translate(n.x, n.y);
  ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(4, 5, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = bound ? '#e9d6a0' : C.stone; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(42,31,23,0.35)'; ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 13); ctx.stroke(); }
  if (bound) { ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (preview) {
    ctx.strokeStyle = `rgba(191,148,51,${0.6 + 0.4 * Math.sin(time * 6)})`; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(0, 0, 42, 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (selected || hovered) {
    ctx.strokeStyle = selected ? C.oxblood : C.inkSoft; ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawEmptyMarker(ctx: CanvasRenderingContext2D, f: string) {
  const n = NODE[f];
  ctx.save(); ctx.translate(n.x, n.y);
  ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.restore();
}

function drawTowerState(ctx: CanvasRenderingContext2D, s: GameState, t: Tower, time: number) {
  const p = posOf(t);
  if (t.flash > 0) {
    ctx.save(); ctx.globalAlpha = t.flash; ctx.fillStyle = C.goldLight;
    ctx.beginPath(); ctx.arc(p.x, p.y - 34, 46, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  drawTowerIcon(ctx, t.type, p.x, p.y, 1, time + p.x);
  // prepared knot / spent seal
  if (t.traced) {
    const ready = s.phase === 'combat' && !t.committed && s.pulsesLeft > 0;
    ctx.save(); ctx.translate(p.x + 22, p.y - 64);
    if (t.committed) {
      ctx.fillStyle = C.inkSoft; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 4); ctx.lineTo(5, -4); ctx.stroke();
    } else {
      const k = ready ? 1 + 0.15 * Math.sin(time * 7) : 1;
      ctx.scale(k, k);
      // an ink drop
      ctx.shadowColor = 'rgba(40,50,110,0.8)'; ctx.shadowBlur = ready ? 12 : 0;
      ctx.fillStyle = C.thread; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(9, 0, 7, 5); ctx.arc(0, 4, 7.2, 0.15, Math.PI - 0.15); ctx.quadraticCurveTo(-9, 0, 0, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(220,230,255,0.85)'; ctx.beginPath(); ctx.ellipse(-2.5, 2, 1.8, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (t.royal) {
    ctx.save(); ctx.translate(p.x - 24, p.y - 58);
    ctx.fillStyle = C.gold; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  if (t.bound) {
    // gilt seal: bright and pulsing while its free pulse is ready
    const ready = s.phase === 'combat' && !t.committed;
    ctx.save(); ctx.translate(p.x + 22, p.y - 64);
    const k = ready ? 1 + 0.15 * Math.sin(time * 7) : 1;
    ctx.scale(k, k);
    ctx.shadowColor = 'rgba(235,203,108,0.9)'; ctx.shadowBlur = ready ? 14 : 0;
    ctx.fillStyle = t.committed && s.phase === 'combat' ? '#a08a5a' : C.goldLight; ctx.strokeStyle = '#7d5c17'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.forest;
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.6, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawHedge(ctx: CanvasRenderingContext2D, h: GameState['hedges'][number], time: number) {
  const life = Math.min(1, h.t / 0.35, (h.dur - h.t) / 0.5);
  ctx.save(); ctx.translate(h.at.x, h.at.y); ctx.rotate(h.angle + Math.PI / 2);
  ctx.scale(1, Math.max(0.05, life));
  ctx.fillStyle = C.shadow; ctx.fillRect(-26, -6, 56, 16);
  ctx.fillStyle = C.forest; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) ctx.arc(i * 8, -2 + (i % 2) * 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(-30, 6); for (let i = -3; i <= 3; i++) { ctx.lineTo(i * 8 + 4, -14 - (i % 2 ? 4 : 0)); ctx.lineTo(i * 8 + 8, 6); } ctx.stroke();
  ctx.fillStyle = C.oxbloodLight;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 10, -6 + Math.sin(time * 3 + i) * 1, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawFire(ctx: CanvasRenderingContext2D, f: GameState['fires'][number], time: number) {
  const life = Math.min(1, f.t / 0.3, (f.dur - f.t) / 0.6);
  ctx.save();
  ctx.globalAlpha = Math.max(0, life);
  for (let i = 0; i < f.pts.length; i++) {
    const p = f.pts[i];
    const fl = Math.sin(time * 12 + i * 1.7);
    ctx.fillStyle = 'rgba(200,70,30,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
    if (i % 2 === 0) {
      ctx.fillStyle = i % 4 === 0 ? '#e5762f' : '#f2b13c';
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 4);
      ctx.quadraticCurveTo(p.x - 6, p.y - 10 - fl * 3, p.x, p.y - 20 - fl * 4);
      ctx.quadraticCurveTo(p.x + 6, p.y - 10, p.x + 7, p.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Enemy entrance markers: preview arrows in preparation, warnings during combat. */
function drawEntrances(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  const marks: Record<string, Vec> = { mill: { x: 40, y: 150 }, king: { x: 582, y: 975 } };
  const def = BALANCE.waves[s.wave - 1];
  if (!def) return;
  if (s.phase === 'prep') {
    for (const id of LANE_IDS) {
      const groups = def.groups.filter((g) => g.lane === id);
      if (!groups.length) continue;
      const m = marks[id];
      ctx.save();
      ctx.fillStyle = 'rgba(122,32,38,0.9)'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      const bob = Math.sin(time * 3) * 3;
      const ox = id === 'mill' ? 0 : 30;
      ctx.beginPath();
      if (id === 'mill') { ctx.moveTo(m.x + 30 + bob, m.y - 46); ctx.lineTo(m.x + 46 + bob, m.y - 38); ctx.lineTo(m.x + 30 + bob, m.y - 30); }
      else { ctx.moveTo(m.x + ox - 8, m.y - 56 - bob); ctx.lineTo(m.x + ox, m.y - 72 - bob); ctx.lineTo(m.x + ox + 8, m.y - 56 - bob); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // enemy icons in order
      let x = id === 'mill' ? m.x + 60 : m.x - 40 - groups.length * 46;
      const y = id === 'mill' ? m.y - 40 : m.y - 40;
      ctx.fillStyle = 'rgba(243,229,197,0.9)'; ctx.strokeStyle = C.oxblood; ctx.lineWidth = 1.5;
      roundRect(ctx, x - 16, y - 24, groups.length * 46 + 8, 40, 8); ctx.fill(); ctx.stroke();
      for (const g of groups) {
        drawEnemy(ctx, g.type, x + 8, y + 2, 1, 0, 0, 1);
        ctx.fillStyle = C.ink; ctx.font = '600 13px Georgia, serif'; ctx.textAlign = 'left';
        ctx.fillText(`×${g.count}`, x + 18, y + 12);
        x += 46;
      }
      ctx.restore();
    }
  } else if (s.phase === 'combat') {
    for (const w of s.warnings) {
      if (s.waveTime < w.from || s.waveTime > w.to) continue;
      const m = marks[w.lane];
      const k = 0.6 + 0.4 * Math.abs(Math.sin(time * 6));
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = C.oxblood; ctx.lineWidth = 4;
      for (let r = 26; r < 70; r += 18) { ctx.beginPath(); ctx.arc(m.x + (w.lane === 'mill' ? 10 : 0), m.y, r, -0.9, 0.9); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const bx = w.lane === 'mill' ? m.x + 30 : m.x - 290, by = w.lane === 'mill' ? m.y + 44 : m.y - 30;
      ctx.fillStyle = C.oxblood; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      roundRect(ctx, bx - 8, by - 22, 236, 34, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff6e0'; ctx.font = '600 17px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif'; ctx.textAlign = 'left';
      const what = w.type === 'wolf' ? `Howls! ${w.count} wolves` : `${w.count} armoured ram${w.count > 1 ? 's' : ''}`;
      ctx.fillText(`${what} → ${w.lane === 'mill' ? 'Mill Rd' : 'King’s Rd'}`, bx + 2, by);
      ctx.restore();
    }
  }
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, v: ViewState, time: number) {
  if (!staticLayer) staticLayer = buildStatic();
  ctx.drawImage(staticLayer, 0, 0);

  // Bound towers' routes in permanent gold leaf
  for (const t of s.towers) if (t.bound) goldRoute(ctx, t.foundation, false, time);
  if (v.bindPreview && !towerAt(s, v.bindPreview)?.bound) goldRoute(ctx, v.bindPreview, true, time);

  // Fading threads (the reset, made visible)
  for (const f of s.fading) inkThread(ctx, f.path, time, 1 - f.t / f.dur, 'fading');
  // Temporary traces: wet ink; once pulsed, dried ink
  for (const t of s.towers) if (t.traced) inkThread(ctx, routePolyline(t.foundation), time, 1, t.committed ? 'dry' : 'wet');
  // Live gesture: the nib being drawn
  if (v.gesture.active && v.gesture.path.length > 1) {
    inkThread(ctx, v.gesture.path, time, v.gesture.slipping > 0 ? 0.45 : 1, 'wet');
    const end = v.gesture.path[v.gesture.path.length - 1];
    ctx.save(); ctx.fillStyle = C.thread;
    ctx.beginPath(); ctx.arc(end.x, end.y, 7 + Math.sin(time * 10), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(28,29,51,0.18)'; ctx.beginPath(); ctx.arc(end.x, end.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Inkwell invitation
  if (s.phase === 'prep' && !s.pendingGrant && s.traces.length < (BALANCE.phaseRules.filter((r) => s.wave >= r.fromWave).at(-1)!.traces)) {
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.save(); ctx.strokeStyle = `rgba(28,29,51,${0.25 + 0.4 * k})`; ctx.lineWidth = 3; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.arc(INKWELL.x, INKWELL.y - 4, 56 + k * 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  for (const f of s.fires) drawFire(ctx, f, time);

  // Foundations
  for (const f of FOUNDATION_IDS) {
    drawFoundation(ctx, f, v.selectedFoundation === f, v.hoverFoundation === f, !!towerAt(s, f)?.bound, v.bindPreview === f, time);
    if (!towerAt(s, f)) drawEmptyMarker(ctx, f);
  }

  // Range hint on hover
  const hf = v.hoverFoundation ?? v.selectedFoundation;
  const ht = hf ? towerAt(s, hf) : undefined;
  if (ht) {
    const p = posOf(ht);
    ctx.save(); ctx.strokeStyle = 'rgba(42,31,23,0.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, BALANCE.towers[ht.type].range, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  // Sorted sprites: towers, enemies, hedges
  type Sprite = { y: number; draw: () => void };
  const sprites: Sprite[] = [];
  for (const t of s.towers) sprites.push({ y: posOf(t).y, draw: () => drawTowerState(ctx, s, t, time) });
  for (const e of s.enemies) {
    const p = enemyPos(e);
    const dir = Math.cos(p.angle) >= -0.1 ? 1 : -1;
    sprites.push({
      y: p.y, draw: () => {
        drawEnemy(ctx, e.type, p.x, p.y, dir, e.bob, e.hit, 1.3);
        if (e.stun > 0) {
          ctx.fillStyle = C.gold;
          for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 10, p.y - 26 + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
        }
        if (e.hp < e.maxHp) {
          const w = e.type === 'ram' ? 40 : 26;
          ctx.fillStyle = 'rgba(42,31,23,0.7)'; ctx.fillRect(p.x - w / 2, p.y - 32 - (e.type === 'ram' ? 4 : 0), w, 5);
          ctx.fillStyle = C.oxbloodLight; ctx.fillRect(p.x - w / 2, p.y - 32 - (e.type === 'ram' ? 4 : 0), w * Math.max(0, e.hp / e.maxHp), 5);
        }
      },
    });
  }
  for (const h of s.hedges) sprites.push({ y: h.at.y + 1, draw: () => drawHedge(ctx, h, time) });
  sprites.sort((a, b) => a.y - b.y);
  for (const sp of sprites) sp.draw();

  // Projectiles
  for (const p of s.projectiles) {
    if (p.kind === 'castle') {
      const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.oxblood; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.moveTo(-10, 0); ctx.lineTo(-14, 3); ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'bramble') {
      const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.fillStyle = C.forest; ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      const k = Math.min(1, p.t / p.dur);
      const arc = Math.sin(k * Math.PI) * 60;
      ctx.save();
      ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(p.x, p.y + 30 * (1 - k), 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#f08a2e'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y - arc, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // Rings
  for (const r of s.rings) {
    const k = r.t / r.dur;
    ctx.save();
    if (r.kind === 'bell' || r.kind === 'toll') {
      ctx.strokeStyle = r.kind === 'toll' ? `rgba(191,148,51,${1 - k})` : `rgba(42,31,23,${0.45 * (1 - k)})`;
      ctx.lineWidth = r.kind === 'toll' ? 6 : 2;
      for (const f of [0.6, 1]) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k) * f, 0, Math.PI * 2); ctx.stroke(); }
    } else if (r.kind === 'splash') {
      ctx.fillStyle = `rgba(229,118,47,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.5 + 0.5 * k), 0, Math.PI * 2); ctx.fill();
    } else {
      // ink splatter
      ctx.fillStyle = `rgba(28,29,51,${0.8 * (1 - k)})`;
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 0.3, d = r.r * (0.4 + k) * (0.6 + (i % 3) * 0.25);
        ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * d, r.y - 30 + Math.sin(a) * d * 0.7, 4 - (i % 3), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Pulses travelling from the inkwell
  for (const f of s.flights) {
    const p = flightPoint(f);
    ctx.save();
    const t = s.towers.find((x) => x.id === f.towerId);
    const gold = !!t?.bound;
    // a fat droplet with a trailing smear
    const back = flightPoint({ ...f, s: Math.max(0, f.s - 40) });
    ctx.strokeStyle = gold ? C.gold : C.thread; ctx.lineCap = 'round'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.shadowColor = gold ? 'rgba(235,203,108,1)' : 'rgba(60,80,170,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = gold ? C.goldLight : C.thread; ctx.strokeStyle = gold ? '#7d5c17' : C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(230,236,255,0.8)';
    ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawEntrances(ctx, s, time);

  // Geese idling on the pond
  drawGoose(ctx, POND.x - 30 + Math.sin(time * 0.4) * 10, POND.y - 6, 1, 1);
  drawGoose(ctx, POND.x + 26 + Math.sin(time * 0.3 + 2) * 8, POND.y + 14, 0.9, -1);

  // Gate marker (castle damage flash)
  void GATE;
}


/** The finished illustration for the victory screen. */
export function renderVictory(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  if (!staticLayer) staticLayer = buildStatic();
  ctx.drawImage(staticLayer, 0, 0);
  for (const t of s.towers) if (t.bound) goldRoute(ctx, t.foundation, false, time);
  for (const f of FOUNDATION_IDS) drawFoundation(ctx, f, false, false, !!towerAt(s, f)?.bound, false, time);
  for (const t of [...s.towers].sort((a, b) => posOf(a).y - posOf(b).y)) drawTowerIcon(ctx, t.type, posOf(t).x, posOf(t).y, 1, time);
  // Sepia wash and gilt frame turn the battlefield into a finished plate.
  ctx.save();
  ctx.fillStyle = 'rgba(214,170,100,0.22)'; ctx.fillRect(0, 0, MAP_W, MAP_H);
  const g = ctx.createRadialGradient(800, 500, 300, 800, 500, 900);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,55,20,0.4)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 14; ctx.strokeRect(22, 22, MAP_W - 44, MAP_H - 44);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(12, 12, MAP_W - 24, MAP_H - 24); ctx.strokeRect(34, 34, MAP_W - 68, MAP_H - 68);
  // corner flourishes
  ctx.fillStyle = C.oxblood;
  for (const [x, y] of [[34, 34], [MAP_W - 34, 34], [34, MAP_H - 34], [MAP_W - 34, MAP_H - 34]]) {
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Banners on the castle
  ctx.save(); ctx.fillStyle = C.oxblood; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  for (const y of [420, 620]) { ctx.beginPath(); ctx.moveTo(1450, y); ctx.lineTo(1450, y + 70); ctx.lineTo(1462, y + 58); ctx.lineTo(1474, y + 70); ctx.lineTo(1474, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // The geese, taking the credit
  for (let i = 0; i < 9; i++) {
    const x = 1500 - ((time * 60 + i * 70) % 1700);
    const y = 230 + Math.abs(i - 4) * 26 + Math.sin(time * 2 + i) * 6;
    drawGoose(ctx, x, y, 1.4, -1, true);
  }
  drawGoose(ctx, POND.x - 30, POND.y - 6, 1.2, 1);
  drawGoose(ctx, POND.x + 26, POND.y + 14, 1.1, -1);
  drawGoose(ctx, 1380, 520, 1.6, -1);
  drawGoose(ctx, 1330, 540, 1.4, 1);
}
