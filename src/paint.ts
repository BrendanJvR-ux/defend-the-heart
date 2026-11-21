// The static painted spread: an open storybook whose pages are painted in oils,
// after the Dutch landscape masters: umber ground, olive woods, dark water,
// warm light from the upper left, deep shadow at the edges, varnish and craquelure.
import {
  MAP_W, MAP_H, GUTTER_X, LANES, LANE_IDS, RIVER, POND, MILL, BRIDGE, INKWELL, CASTLE,
  LEY_EDGES, NODE, FOUNDATION_IDS, pointAt, type Vec,
} from './map';
import { P, litGrad, softShadow } from './sprites';

export const SERIF = 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';

export function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

export function stroke(ctx: CanvasRenderingContext2D, pts: Vec[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export function smoothPath(ctx: CanvasRenderingContext2D, pts: Vec[], r = 60) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
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

/** Short loaded brushstrokes scattered over an area. */
function brushwork(ctx: CanvasRenderingContext2D, R: () => number, n: number, colors: string[], area = { x: 0, y: 0, w: MAP_W, h: MAP_H }, len = [5, 16], width = [1.5, 4]) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = area.x + R() * area.w, y = area.y + R() * area.h;
    const a = -0.3 + R() * 0.6 + (R() < 0.2 ? Math.PI / 2 : 0);
    const l = len[0] + R() * (len[1] - len[0]);
    ctx.strokeStyle = colors[Math.floor(R() * colors.length)];
    ctx.lineWidth = width[0] + R() * (width[1] - width[0]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
}

/** A Ruisdael-like tree: dark olive masses lit on the upper left. */
function drawTree(ctx: CanvasRenderingContext2D, R: () => number, x: number, y: number, r: number, kind: number) {
  softShadow(ctx, x + r * 0.3, y + r * 0.5, r * 1.25, r * 0.5, 0.45);
  // trunk
  ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.55); ctx.lineTo(x + r * 0.05, y - r * 0.1); ctx.stroke();
  if (kind > 0.72) {
    // poplar / pine: tall dark spire
    ctx.fillStyle = litGrad(ctx, x - r, y - r * 1.6, x + r, y + r * 0.4, '#5d6a34', '#2e3a1c', '#141b0c');
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.7); ctx.quadraticCurveTo(x + r * 0.75, y - r * 0.2, x + r * 0.5, y + r * 0.35);
    ctx.lineTo(x - r * 0.5, y + r * 0.35); ctx.quadraticCurveTo(x - r * 0.75, y - r * 0.2, x, y - r * 1.7); ctx.fill();
    ctx.fillStyle = 'rgba(180,170,90,0.35)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.22, y - r * 0.7, r * 0.15, r * 0.5, 0.2, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const blobs = 5 + Math.floor(R() * 3);
  // shadow side first, then the lit masses, then highlights
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + R() * 0.5;
    const bx = x + Math.cos(a) * r * 0.55, by = y - r * 0.25 + Math.sin(a) * r * 0.42;
    const br = r * (0.48 + R() * 0.22);
    ctx.fillStyle = litGrad(ctx, bx - br, by - br, bx + br, by + br, kind < 0.35 ? '#7c8440' : '#5f6a32', '#34411f', '#151d0c');
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const hx = x - r * 0.35 + R() * r * 0.4, hy = y - r * 0.7 + R() * r * 0.4;
    ctx.fillStyle = `rgba(${170 + R() * 40},${165 + R() * 30},${80 + R() * 30},${0.35 + R() * 0.25})`;
    ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.16, r * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, R: () => number, pts: Vec[], kind: 'dirt' | 'cobble') {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // trodden verge, darker
  ctx.strokeStyle = 'rgba(70,48,22,0.55)'; ctx.lineWidth = 46; smoothPath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = kind === 'dirt' ? '#8f6a3e' : '#857660'; ctx.lineWidth = 38; smoothPath(ctx, pts); ctx.stroke();
  ctx.strokeStyle = kind === 'dirt' ? '#b08955' : '#a39478'; ctx.lineWidth = 24; smoothPath(ctx, pts); ctx.stroke();
  const lane = kind === 'dirt' ? LANES.mill : LANES.king;
  if (kind === 'dirt') {
    // ruts and puddles catching the sky
    for (const off of [-8, 8]) {
      ctx.strokeStyle = 'rgba(70,46,20,0.55)'; ctx.lineWidth = 2.2; ctx.setLineDash([22, 7]);
      const sh = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: p.x - ((b.y - a.y) / len) * off, y: p.y + ((b.x - a.x) / len) * off };
      });
      smoothPath(ctx, sh); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let s = 40; s < lane.length; s += 90 + R() * 120) {
      const p = pointAt(lane, s);
      ctx.fillStyle = 'rgba(120,140,140,0.5)';
      ctx.beginPath(); ctx.ellipse(p.x + (R() - 0.5) * 12, p.y + (R() - 0.5) * 8, 7 + R() * 5, 3, p.angle, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,210,0.45)';
      ctx.beginPath(); ctx.ellipse(p.x - 2, p.y - 1, 3, 1, p.angle, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    for (let s = 0; s < lane.length; s += 10) {
      const p = pointAt(lane, s);
      for (const off of [-12, -4, 4, 12]) {
        const j = (R() - 0.5) * 3;
        const x = p.x - Math.sin(p.angle) * (off + j), y = p.y + Math.cos(p.angle) * (off + j);
        ctx.fillStyle = litGrad(ctx, x - 4, y - 3, x + 4, y + 3, '#d1c4a6', '#9c8e72', '#5a4f3c');
        ctx.beginPath(); ctx.ellipse(x, y, 4, 3, p.angle, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // stray stones and tufts at the edges
  for (let s = 0; s < lane.length; s += 18) {
    const p = pointAt(lane, s);
    const side = R() < 0.5 ? -1 : 1;
    const off = side * (20 + R() * 6);
    ctx.fillStyle = R() < 0.5 ? 'rgba(80,90,40,0.7)' : 'rgba(150,135,100,0.7)';
    ctx.beginPath(); ctx.arc(p.x - Math.sin(p.angle) * off, p.y + Math.cos(p.angle) * off, 1.5 + R() * 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBridge(ctx: CanvasRenderingContext2D) {
  const a = pointAt(LANES.king, LANES.king.cum[3]);
  ctx.save();
  ctx.translate(BRIDGE.x, BRIDGE.y);
  ctx.rotate(a.angle - 0.15);
  softShadow(ctx, 8, 10, 60, 34, 0.55);
  ctx.fillStyle = litGrad(ctx, -46, -26, 46, 26, P.stoneLight, P.stone, P.stoneDark);
  ctx.fillRect(-46, -26, 92, 52);
  ctx.strokeStyle = 'rgba(50,40,25,0.5)'; ctx.lineWidth = 1;
  for (let x = -40; x < 46; x += 10) { ctx.beginPath(); ctx.moveTo(x, -23); ctx.lineTo(x, 23); ctx.stroke(); }
  for (const yy of [-30, 23]) {
    ctx.fillStyle = litGrad(ctx, -48, yy, 48, yy + 7, '#efe4c8', '#a59878', '#5e553f');
    ctx.fillRect(-48, yy, 96, 7);
  }
  ctx.restore();
}

export function drawGoose(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, flying = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k * dir, k);
  ctx.fillStyle = litGrad(ctx, -10, -8, 10, 8, '#fffdf5', '#ece4d2', '#a99d84');
  ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 0.8;
  if (flying) {
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-4, -14, 0, -2); ctx.quadraticCurveTo(4, -14, 14, 0);
    ctx.quadraticCurveTo(4, -4, 0, 2); ctx.quadraticCurveTo(-4, -4, -14, 0); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  softShadow(ctx, 2, 5, 12, 4, 0.35);
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ece4d2'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(7, -3); ctx.quadraticCurveTo(12, -16, 9, -18); ctx.stroke();
  ctx.fillStyle = '#d98b2b'; ctx.beginPath(); ctx.moveTo(9, -19); ctx.lineTo(15, -17); ctx.lineTo(9, -16); ctx.fill();
  ctx.restore();
}

/** Dutch brick house body with a stepped gable. */
function gableHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, steps: number) {
  softShadow(ctx, x + w * 0.2, y + 6, w * 0.9, 14, 0.5);
  ctx.fillStyle = litGrad(ctx, x - w / 2, y - h, x + w / 2, y, P.brickLight, P.brick, P.brickDark);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h);
  const sw = w / 2 / (steps + 0.5), sh = 9;
  let cx = x - w / 2, cy = y - h;
  for (let i = 0; i < steps; i++) { cy -= sh; ctx.lineTo(cx, cy); cx += sw; ctx.lineTo(cx, cy); }
  ctx.lineTo(x - sw / 2, cy - sh); ctx.lineTo(x + sw / 2, cy - sh); ctx.lineTo(x + sw / 2, cy);
  cx = x + sw / 2;
  for (let i = 0; i < steps; i++) { cx += sw; ctx.lineTo(cx, cy); cy += sh; ctx.lineTo(cx, cy); }
  ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,12,6,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  // mortar courses
  ctx.strokeStyle = 'rgba(230,200,170,0.15)'; ctx.lineWidth = 0.7;
  for (let yy = y - 5; yy > y - h; yy -= 5) { ctx.beginPath(); ctx.moveTo(x - w / 2 + 1, yy); ctx.lineTo(x + w / 2 - 1, yy); ctx.stroke(); }
  // whitewashed window frames
  for (const [wx, wy] of [[x - w * 0.25, y - h * 0.6], [x + w * 0.2, y - h * 0.6], [x, y - h - 12]]) {
    ctx.fillStyle = P.cream; ctx.fillRect(wx - 5, wy - 6, 10, 12);
    ctx.fillStyle = '#20262a'; ctx.fillRect(wx - 3.6, wy - 4.6, 7.2, 9.2);
    ctx.fillStyle = 'rgba(200,220,230,0.5)'; ctx.fillRect(wx - 3, wy - 4, 2.4, 3);
  }
}

function drawMill(ctx: CanvasRenderingContext2D) {
  const { x, y } = MILL;
  gableHouse(ctx, x, y + 22, 74, 46, 3);
  ctx.fillStyle = '#20160c'; ctx.fillRect(x - 6, y + 4, 13, 18);
  // water wheel, dark oak
  ctx.save(); ctx.translate(x - 50, y + 10);
  ctx.fillStyle = litGrad(ctx, -24, -24, 24, 24, '#8c6a3c', '#5c4022', '#2a1b0c');
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c1208'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke();
  }
  ctx.restore();
  label(ctx, 'the Old Mill', x, y + 54, 14);
}

function drawCastle(ctx: CanvasRenderingContext2D) {
  const x = CASTLE.x, y = CASTLE.y;
  ctx.save(); ctx.translate(x, y);
  softShadow(ctx, 20, 20, 110, 150, 0.55);
  // curtain wall in pale stone
  ctx.fillStyle = litGrad(ctx, -66, -126, 64, 126, '#c2b490', '#8e8064', '#4e4534');
  ctx.fillRect(-66, -126, 130, 252);
  ctx.strokeStyle = 'rgba(50,40,25,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(-66, -126, 130, 252);
  ctx.strokeStyle = 'rgba(60,45,25,0.25)';
  for (let yy = -120; yy < 126; yy += 9) { ctx.beginPath(); ctx.moveTo(-66, yy); ctx.lineTo(64, yy); ctx.stroke(); }
  for (let i = -126; i < 126; i += 18) {
    ctx.fillStyle = i < 0 ? '#b3a582' : '#7e7158'; ctx.fillRect(-74, i, 10, 10);
  }
  ctx.restore();
  // keep: brick with a stepped gable
  gableHouse(ctx, x + 12, y + 70, 64, 96, 4);
  // corner towers with slate cones
  for (const ty of [y - 126, y + 126]) {
    ctx.fillStyle = litGrad(ctx, x - 84, ty - 26, x - 32, ty + 26, P.stoneLight, P.stone, P.stoneDark);
    ctx.beginPath(); ctx.arc(x - 58, ty, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = litGrad(ctx, x - 86, ty - 44, x - 30, ty, P.slateLight, P.slate, '#1d1f22');
    ctx.beginPath(); ctx.moveTo(x - 86, ty); ctx.lineTo(x - 58, ty - 50); ctx.lineTo(x - 30, ty); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.gold; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 58, ty - 50); ctx.lineTo(x - 58, ty - 70); ctx.stroke();
    ctx.fillStyle = P.oxblood; ctx.beginPath(); ctx.moveTo(x - 58, ty - 70); ctx.lineTo(x - 38, ty - 64); ctx.lineTo(x - 58, ty - 58); ctx.fill();
  }
  // gate arch, deep shadow
  ctx.fillStyle = '#120c06'; ctx.beginPath(); ctx.moveTo(x - 76, y + 22); ctx.lineTo(x - 76, y - 10); ctx.arc(x - 66, y - 10, 10, Math.PI, 0); ctx.lineTo(x - 56, y + 22); ctx.closePath(); ctx.fill();
  label(ctx, 'Goosebridge Castle', x + 4, y + 168, 15);
}

function drawInkwell(ctx: CanvasRenderingContext2D) {
  const { x, y } = INKWELL;
  ctx.save(); ctx.translate(x, y);
  softShadow(ctx, 8, 28, 40, 12, 0.55);
  // Delft-blue glazed pot
  ctx.fillStyle = litGrad(ctx, -34, -14, 34, 26, '#6d86b8', '#22355f', '#0b1428');
  ctx.beginPath(); ctx.moveTo(-30, 26); ctx.quadraticCurveTo(-38, -6, -16, -14); ctx.lineTo(16, -14); ctx.quadraticCurveTo(38, -6, 30, 26); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(230,235,250,0.6)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-18, 4); ctx.quadraticCurveTo(0, -4, 18, 4); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 10, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = litGrad(ctx, -18, -22, 18, -13, P.goldLight, P.gold, '#6b4c12');
  ctx.fillRect(-18, -22, 36, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-20, 4, 3, 9, 0.3, 0, Math.PI * 2); ctx.fill();
  // goose quill
  ctx.fillStyle = litGrad(ctx, -36, -92, 2, -18, '#fffef8', '#e8e0cc', '#a49a84');
  ctx.beginPath(); ctx.moveTo(2, -18); ctx.quadraticCurveTo(-10, -60, -36, -92); ctx.quadraticCurveTo(-6, -74, 2, -18); ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
  label(ctx, 'the Inkwell', x, y + 54, 14);
}

function drawLeylines(ctx: CanvasRenderingContext2D) {
  // Silverpoint guides: a pale line with a dark underline so it reads on the painted ground.
  ctx.lineCap = 'round';
  for (const e of LEY_EDGES) {
    ctx.strokeStyle = 'rgba(40,28,14,0.35)'; ctx.lineWidth = 4.5; ctx.setLineDash([]);
    stroke(ctx, e.pts);
    ctx.strokeStyle = 'rgba(236,224,190,0.8)'; ctx.lineWidth = 1.8; ctx.setLineDash([3, 5]);
    stroke(ctx, e.pts);
  }
  ctx.setLineDash([]);
  for (const n of Object.values(NODE)) {
    if (n.foundation || n.id === 'ink') continue;
    ctx.fillStyle = 'rgba(236,224,190,0.9)'; ctx.strokeStyle = 'rgba(40,28,14,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(n.x, n.y, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 16, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.font = `italic ${size}px ${SERIF}`; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(25,15,5,0.6)'; ctx.fillText(text, 1, 1.2);
  ctx.fillStyle = '#f1e3bd'; ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Thin dark cracks in old varnish. */
function craquelure(ctx: CanvasRenderingContext2D, R: () => number) {
  ctx.strokeStyle = 'rgba(30,18,6,0.12)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 520; i++) {
    let x = R() * MAP_W, y = R() * MAP_H;
    let a = R() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    const n = 3 + Math.floor(R() * 5);
    for (let k = 0; k < n; k++) {
      a += (R() - 0.5) * 1.6;
      x += Math.cos(a) * (6 + R() * 12); y += Math.sin(a) * (6 + R() * 12);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export function buildStatic(scale = 2): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * scale; cv.height = MAP_H * scale;
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  const R = rng(11);

  // Imprimatura: a warm umber ground
  ctx.fillStyle = '#8c7244';
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  // broad fields and meadows, glazed in
  const fieldCols = ['rgba(120,128,60,0.35)', 'rgba(160,140,70,0.3)', 'rgba(95,105,50,0.35)', 'rgba(185,160,90,0.25)'];
  for (let i = 0; i < 46; i++) {
    const cx = R() * MAP_W, cy = R() * MAP_H;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.2 + R() * 0.4);
    ctx.fillStyle = fieldCols[i % fieldCols.length];
    const w = 120 + R() * 220, h = 60 + R() * 110;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // polder ditch along one edge
    ctx.strokeStyle = 'rgba(60,70,60,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.stroke();
    ctx.restore();
  }
  brushwork(ctx, R, 9000, ['rgba(70,80,35,0.18)', 'rgba(150,130,70,0.16)', 'rgba(200,180,110,0.12)', 'rgba(60,45,25,0.15)', 'rgba(110,120,60,0.18)']);

  // Water: river and pond, dark with silvery reflections
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(40,30,15,0.6)'; ctx.lineWidth = 40; smoothPath(ctx, RIVER, 80); ctx.stroke();
  ctx.strokeStyle = '#3e4c46'; ctx.lineWidth = 32; smoothPath(ctx, RIVER, 80); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,140,130,0.5)'; ctx.lineWidth = 14; smoothPath(ctx, RIVER, 80); ctx.stroke();
  const pg = ctx.createRadialGradient(POND.x - 30, POND.y - 20, 10, POND.x, POND.y, 100);
  pg.addColorStop(0, '#8fa39a'); pg.addColorStop(0.5, '#4d5f57'); pg.addColorStop(1, '#2a3530');
  ctx.fillStyle = 'rgba(40,30,15,0.6)'; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, 96, 62, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(POND.x, POND.y, 90, 56, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(230,235,225,0.5)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    const x = POND.x - 60 + R() * 110, y = POND.y - 35 + R() * 70;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + R() * 14, y); ctx.stroke();
  }
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1], b = RIVER[i];
    for (let t = 0.15; t < 1; t += 0.22) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke();
    }
  }
  // reeds and rushes
  ctx.strokeStyle = 'rgba(70,80,30,0.9)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 40; i++) {
    const a = R() * Math.PI * 2;
    const x = POND.x + Math.cos(a) * (92 + R() * 6), y = POND.y + Math.sin(a) * (58 + R() * 4);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 4, y - 10 - R() * 8); ctx.stroke();
  }

  // Trees (kept off roads, leylines, foundations, water and buildings)
  const trees: { x: number; y: number; r: number; k: number }[] = [];
  for (let i = 0; i < 1400 && trees.length < 175; i++) {
    const p = { x: 20 + R() * (MAP_W - 40), y: 20 + R() * (MAP_H - 40) };
    if (p.x > 1400 && p.y > 330 && p.y < 720) continue;
    if (Math.hypot(p.x - MILL.x, p.y - MILL.y) < 95) continue;
    if (Math.hypot(p.x - INKWELL.x, p.y - INKWELL.y) < 110) continue;
    if (Math.abs(p.x - GUTTER_X) < 18) continue;
    if (p.x < 360 && p.y > 860) continue; // title cartouche
    if (nearRoad(p, 52) || nearLey(p, 30) || nearRiver(p, 34)) continue;
    if (FOUNDATION_IDS.some((f) => Math.hypot(NODE[f].x - p.x, NODE[f].y - p.y) < 64)) continue;
    if (trees.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 26)) continue;
    trees.push({ ...p, r: 11 + R() * 9, k: R() });
  }
  trees.sort((a, b) => a.y - b.y);

  drawRoad(ctx, R, LANES.mill.pts, 'dirt');
  drawRoad(ctx, R, LANES.king.pts, 'cobble');
  drawBridge(ctx);
  for (const t of trees) drawTree(ctx, R, t.x, t.y, t.r, t.k);
  drawMill(ctx);
  drawCastle(ctx);
  label(ctx, 'The Mill Road', 300, 112, 17);
  label(ctx, 'The King’s Road', 1000, 772, 17, -0.33);
  label(ctx, 'Goosebridge Pond', POND.x, POND.y + 84, 15);
  drawLeylines(ctx);
  drawInkwell(ctx);

  // Chiaroscuro: warm light from the upper left of each page, deep shadow towards the edges
  for (const x0 of [0, GUTTER_X]) {
    const lg = ctx.createRadialGradient(x0 + 260, 220, 40, x0 + 360, 420, 720);
    lg.addColorStop(0, 'rgba(255,225,150,0.3)');
    lg.addColorStop(0.55, 'rgba(255,220,150,0)');
    lg.addColorStop(1, 'rgba(15,8,0,0.72)');
    ctx.fillStyle = lg; ctx.fillRect(x0, 0, 800, MAP_H);
  }
  // gutter: the fold of the book, faint, beneath play
  const gg = ctx.createLinearGradient(GUTTER_X - 46, 0, GUTTER_X + 46, 0);
  gg.addColorStop(0, 'rgba(20,10,0,0)'); gg.addColorStop(0.5, 'rgba(20,10,0,0.28)'); gg.addColorStop(1, 'rgba(20,10,0,0)');
  ctx.fillStyle = gg; ctx.fillRect(GUTTER_X - 46, 0, 92, MAP_H);
  // amber varnish and its cracks
  ctx.fillStyle = 'rgba(190,130,40,0.10)'; ctx.fillRect(0, 0, MAP_W, MAP_H);
  craquelure(ctx, R);

  // Title cartouche, gilt frame
  ctx.fillStyle = 'rgba(30,20,10,0.72)';
  roundRect(ctx, 40, 880, 300, 78, 8); ctx.fill();
  ctx.strokeStyle = P.gold; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `600 25px ${SERIF}`; ctx.textAlign = 'left'; ctx.fillStyle = '#f0d27a';
  ctx.fillText('The Siege of Goosebridge', 56, 918);
  ctx.font = `italic 14px ${SERIF}`; ctx.fillStyle = '#e8dcbc';
  ctx.fillText('in oils, after the masters of the Low Countries', 58, 942);
  // page border
  ctx.strokeStyle = 'rgba(196,154,58,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 14, MAP_W - 28, MAP_H - 28);
  void softShadow;
  return cv;
}
