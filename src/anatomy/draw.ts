// Drawing for Defend the Heart: a stylised anatomy plate, kept calm so the two white cells stand out.
import { CONFIG, type PathogenType, type VesselId } from './config';
import { W, H, HEART, HEART_R, VESSELS, VESSEL_IDS, NODES, pointAt, type Vec } from './level';
import { type State, cellPos, pathogenPos, aliveCells, pulseTargets, waveSpawns } from './sim';

export interface View {
  hoverVessel: VesselId | null;
  /** The pulse button is hovered or focused: show the pulse radius around each cell. */
  showPulseRadius: boolean;
  touch: boolean;
}

const C = {
  paper: '#f4ead8', tissue: '#efd6c8', ink: '#2a1e18', inkSoft: 'rgba(42,30,24,0.55)',
  wall: '#8a2a2a', wallLight: '#c86a5e', lumen: '#b8343a', lumenDeep: '#8a1e24',
  node: '#9cc49a', nodeDark: '#4e7a52', heart: '#c8554e', heartDark: '#7a2420',
  bacterium: '#6aa84a', bacteriumDark: '#2e5a22', virus: '#8a4ab8', virusDark: '#4a1e70',
  cell: '#fdfcf8', nucleus: '#6a4aa8', pulse: '#4ab8d8',
};

let bg: HTMLCanvasElement | null = null;
function background(): HTMLCanvasElement {
  if (bg) return bg;
  bg = document.createElement('canvas');
  bg.width = W * 2; bg.height = H * 2;
  const ctx = bg.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  let seed = 3; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // faint connective tissue: cells with nuclei and a few fibres
  for (let i = 0; i < 1500; i++) {
    const x = R() * W, y = R() * H;
    ctx.strokeStyle = 'rgba(170,110,95,0.16)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, 7 + R() * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,80,140,0.22)'; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(170,110,95,0.14)'; ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = R() * W, y = R() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 40, y - 10, x + 80, y + 12, x + 130, y); ctx.stroke(); }
  // soft tissue tint around the heart and a page vignette
  const g = ctx.createRadialGradient(HEART.x, HEART.y, 60, HEART.x, HEART.y, 520);
  g.addColorStop(0, 'rgba(230,170,150,0.35)'); g.addColorStop(1, 'rgba(230,170,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 980);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,50,30,0.22)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(10, 10, W - 20, H - 20);
  return bg;
}

function smooth(ctx: CanvasRenderingContext2D, pts: Vec[], r = 70) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

export function vesselWidth(s: State, v: VesselId) {
  const k = s.width[v], e = k * k * (3 - 2 * k);
  return CONFIG.vesselRestWidth + (CONFIG.vesselDilatedWidth - CONFIG.vesselRestWidth) * e;
}

function drawVessel(ctx: CanvasRenderingContext2D, s: State, v: VesselId, view: View, t: number) {
  const ves = VESSELS[v], w = vesselWidth(s, v), open = s.width[v];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (view.hoverVessel === v && s.phase === 'prep') { ctx.strokeStyle = 'rgba(74,184,216,0.35)'; ctx.lineWidth = w + 34; smooth(ctx, ves.pts); ctx.stroke(); }
  // the wall: an outer dark line and a pale inner edge; as the lumen widens, the walls visibly part
  ctx.strokeStyle = C.ink; ctx.lineWidth = w + 14; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.wall; ctx.lineWidth = w + 11; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.wallLight; ctx.lineWidth = w + 3; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.lumenDeep; ctx.lineWidth = w; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.lumen; ctx.lineWidth = w * 0.7; smooth(ctx, ves.pts); ctx.stroke();
  // flow animation: chevrons streaming towards the heart, only in the dilated vessel
  if (open > 0.02) {
    ctx.globalAlpha = Math.min(1, open * 1.4) * 0.85;
    ctx.strokeStyle = '#ffd8d0'; ctx.lineWidth = 3;
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
  // a few subdued red cells drifting with the flow in both vessels
  ctx.fillStyle = 'rgba(240,120,110,0.35)';
  for (let i = 0; i < 14; i++) {
    const d = ((t * 40 + i * 71) % ves.length);
    const p = pointAt(ves, d), side = ((i * 37) % 9 - 4) * (w / 12);
    ctx.beginPath(); ctx.ellipse(p.x - Math.sin(p.angle) * side, p.y + Math.cos(p.angle) * side, 4.5, 3, p.angle, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, s: State, t: number) {
  // a subtle resting heartbeat, and a hard kick when a pathogen gets through
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.15)), 8) * 0.035;
  const k = (1 + beat + s.heartKick * 0.08) * 1.22;
  ctx.save(); ctx.translate(HEART.x, HEART.y); ctx.scale(k, k);
  const x = 0, y = 0;
  const heart = () => { ctx.beginPath(); ctx.moveTo(x, y + 105); ctx.bezierCurveTo(x - 95, y + 30, x - 100, y - 70, x - 42, y - 92); ctx.bezierCurveTo(x - 14, y - 104, x, y - 80, x + 4, y - 66); ctx.bezierCurveTo(x + 22, y - 104, x + 92, y - 96, x + 92, y - 30); ctx.bezierCurveTo(x + 92, y + 34, x + 30, y + 80, x, y + 105); ctx.closePath(); };
  // great vessels
  for (const [vx, vw, col] of [[-26, 24, '#b8433a'], [4, 20, '#4a6aa8'], [30, 18, '#b8433a']] as const) {
    ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(vx - vw / 2, -150, vw, 70, 9); ctx.fill(); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, 120);
  g.addColorStop(0, '#e08a7e'); g.addColorStop(0.6, C.heart); g.addColorStop(1, C.heartDark);
  heart(); ctx.fillStyle = g; ctx.fill();
  if (s.heartKick > 0) { heart(); ctx.fillStyle = `rgba(255,60,50,${s.heartKick * 0.45})`; ctx.fill(); }
  heart(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  // coronary arteries and the interventricular groove
  ctx.strokeStyle = '#7a2420'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -64); ctx.bezierCurveTo(-18, -14, -20, 40, -2, 100); ctx.stroke();
  ctx.lineWidth = 1.6; for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) { const yy = -30 + i * 36; ctx.beginPath(); ctx.moveTo(-10, yy); ctx.quadraticCurveTo(-10 + sgn * 24, yy + 8, -10 + sgn * 40, yy + 22); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-50, -50, 14, 24, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // health shown as a ring of beads around the heart
  const n = CONFIG.heartHp;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, r = HEART_R * 1.22 + 46;
    ctx.fillStyle = i < s.heartHp ? '#d8343a' : 'rgba(60,40,40,0.18)';
    ctx.beginPath(); ctx.arc(HEART.x + Math.cos(a) * r, HEART.y + 4 + Math.sin(a) * r, 7, 0, Math.PI * 2); ctx.fill();
  }
}

function drawNode(ctx: CanvasRenderingContext2D, v: VesselId, s: State, t: number) {
  const n = NODES[v];
  // reach into the bloodstream
  ctx.save();
  ctx.fillStyle = 'rgba(78,122,82,0.07)'; ctx.beginPath(); ctx.arc(n.x, n.y, CONFIG.lymphNode.range, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(78,122,82,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 10;
  ctx.beginPath(); ctx.arc(n.x, n.y, CONFIG.lymphNode.range, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // a small lymph vessel tying the node to its blood vessel (so the lane it guards is clear)
  ctx.strokeStyle = 'rgba(78,122,82,0.7)'; ctx.lineWidth = 3;
  const ves = VESSELS[v]; let best = ves.pts[0]; let bd = Infinity;
  for (let d = 0; d < ves.length; d += 10) { const p = pointAt(ves, d); const dd = Math.hypot(p.x - n.x, p.y - n.y); if (dd < bd) { bd = dd; best = p; } }
  ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(best.x, best.y); ctx.stroke();
  // the bean-shaped node with follicles
  ctx.translate(n.x, n.y);
  const beat = 1 + 0.03 * Math.sin(t * 3 + (v === 'left' ? 0 : 1.5)) + (s.nodeCd[v] > CONFIG.lymphNode.cooldown - 0.12 ? 0.06 : 0);
  ctx.scale(beat * 1.35, beat * 1.35);
  const bean = () => { ctx.beginPath(); ctx.moveTo(-38, 0); ctx.bezierCurveTo(-44, -36, 44, -36, 40, 0); ctx.bezierCurveTo(36, 28, 6, 14, 0, 20); ctx.bezierCurveTo(-10, 28, -36, 24, -38, 0); ctx.closePath(); };
  const g = ctx.createRadialGradient(-12, -12, 4, 0, 0, 44); g.addColorStop(0, '#c4e0c0'); g.addColorStop(1, C.node);
  bean(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * Math.PI; ctx.fillStyle = '#7aa878'; ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -4 + Math.sin(a) * 16, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = C.nodeDark; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = C.ink; ctx.font = '700 24px Palatino, Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('Lymph node', n.x, n.y + 66);
}

export function drawPathogen(ctx: CanvasRenderingContext2D, type: PathogenType, x: number, y: number, angle: number, hit: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (type === 'bacterium') {
    ctx.rotate(angle);
    ctx.strokeStyle = C.bacteriumDark; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-16, -3 + i * 2); ctx.bezierCurveTo(-22, -8 + i * 4, -26, 4 + i * 2, -32, -2 + i * 3); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#a8d888'); g.addColorStop(0.5, C.bacterium); g.addColorStop(1, C.bacteriumDark);
    ctx.fillStyle = hit > 0 ? '#ffffff' : g; ctx.beginPath(); ctx.roundRect(-17, -8, 34, 16, 8); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(30,60,20,0.45)'; for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(dx, 1, 1.8, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke(); ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.arc(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 2, 0, Math.PI * 2); ctx.fill(); }
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8); g.addColorStop(0, '#c89ae8'); g.addColorStop(1, C.virusDark);
    ctx.fillStyle = hit > 0 ? '#ffffff' : g; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
  }
  ctx.restore();
}

export function drawWhiteCell(ctx: CanvasRenderingContext2D, x: number, y: number, hit: number, t: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  // a pale halo so the two defenders are always easy to find
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255,255,255,0.9)'); halo.addColorStop(1, 'rgba(120,210,240,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  // a slightly wobbling membrane
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2; const r = 15 + Math.sin(a * 3 + t * 4) * 1.2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath();
  ctx.fillStyle = hit > 0 ? '#ffe0e0' : C.cell; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.stroke();
  // multi-lobed nucleus
  ctx.fillStyle = C.nucleus;
  for (const [dx, dy] of [[-5, -3], [1, 4], [6, -3]]) { ctx.beginPath(); ctx.arc(dx, dy, 4.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string) {
  ctx.fillStyle = 'rgba(30,20,20,0.6)'; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
}

/** Next-wave preview at each vessel's mouth: which pathogens, how many, roughly when. */
function drawPreview(ctx: CanvasRenderingContext2D, s: State) {
  if (s.phase !== 'prep') return;
  const sp = waveSpawns(s.wave);
  for (const v of VESSEL_IDS) {
    const mine = sp.filter((x) => x.vessel === v);
    const ves = VESSELS[v], p = pointAt(ves, 60);
    void p;
    const bx = v === 'left' ? 30 : W - 400, by = v === 'left' ? 372 : 430;
    ctx.fillStyle = 'rgba(244,234,216,0.95)'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, 370, 96, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = '700 22px Palatino, Georgia, serif'; ctx.textAlign = 'left';
    ctx.fillText(`Incoming: ${v === 'left' ? 'left' : 'right'} vessel`, bx + 16, by + 32);
    if (!mine.length) { ctx.font = 'italic 21px Palatino, Georgia, serif'; ctx.fillText('nothing this wave', bx + 16, by + 70); continue; }
    const counts: Record<PathogenType, number> = { bacterium: 0, virus: 0 };
    for (const m of mine) counts[m.type]++;
    let x = bx + 34;
    for (const type of ['bacterium', 'virus'] as PathogenType[]) {
      if (!counts[type]) continue;
      drawPathogen(ctx, type, x, by + 64, 0, 0, 1.3);
      ctx.fillStyle = C.ink; ctx.font = '700 21px Palatino, Georgia, serif';
      ctx.fillText(`×${counts[type]} ${type === 'bacterium' ? 'bacteria' : 'viruses'}`, x + 28, by + 71);
      x += 170;
    }
  }
}

export function draw(ctx: CanvasRenderingContext2D, s: State, view: View, t: number) {
  ctx.drawImage(background(), 0, 0, W, H);
  for (const v of VESSEL_IDS) drawVessel(ctx, s, v, view, t);
  // vessel labels and a "dilated" tag
  for (const v of VESSEL_IDS) {
    const p = pointAt(VESSELS[v], 120);
    ctx.font = '700 26px Palatino, Georgia, serif'; ctx.textAlign = 'center';
    const label = v === 'left' ? 'Left vessel' : 'Right vessel';
    const ly = p.y - 56;
    ctx.fillStyle = 'rgba(244,234,216,0.9)'; const tw = ctx.measureText(label).width;
    ctx.fillRect(p.x - tw / 2 - 10, ly - 25, tw + 20, 34);
    ctx.fillStyle = C.ink; ctx.fillText(label, p.x, ly);
    if (s.dilated === v) {
      ctx.fillStyle = C.pulse; ctx.beginPath(); ctx.roundRect(p.x - 62, ly + 14, 124, 30, 15); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '700 18px Palatino, Georgia, serif'; ctx.fillText('DILATED', p.x, ly + 35);
    }
  }
  for (const v of VESSEL_IDS) drawNode(ctx, v, s, t);
  drawHeart(ctx, s, t);

  // antibodies from the lymph nodes
  for (const sh of s.shots) {
    const a = Math.atan2(sh.y - sh.sy, sh.x - sh.sx);
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(a + Math.PI / 2);
    ctx.strokeStyle = C.nodeDark; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 0); ctx.lineTo(-4, -5); ctx.moveTo(0, 0); ctx.lineTo(4, -5); ctx.stroke();
    ctx.restore();
  }

  const eligible = s.phase === 'combat' && s.pulsesLeft > 0 ? new Set(pulseTargets(s).map((p) => p.id)) : new Set<number>();
  for (const p of s.pathogens) {
    const q = pathogenPos(p);
    if (eligible.has(p.id) && (view.touch || view.showPulseRadius)) {
      ctx.strokeStyle = 'rgba(74,184,216,0.95)'; ctx.lineWidth = 2.4; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(q.x, q.y, p.type === 'bacterium' ? 30 : 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    drawPathogen(ctx, p.type, q.x, q.y, q.angle, p.hit, 1.4);
    if (p.hp < p.maxHp) bar(ctx, q.x, q.y - 26, p.type === 'bacterium' ? 40 : 26, p.hp / p.maxHp, '#c8402a');
  }

  for (const c of s.cells) {
    if (c.hp <= 0 || (s.phase === 'recall' && c.home)) continue;
    const q = cellPos(c);
    if (view.showPulseRadius && s.phase === 'combat' && s.pulsesLeft > 0) {
      ctx.fillStyle = 'rgba(74,184,216,0.12)'; ctx.strokeStyle = C.pulse; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(q.x, q.y, CONFIG.immunePulse.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    drawWhiteCell(ctx, q.x, q.y, c.hit, t + c.id, 1.45);
    bar(ctx, q.x, q.y - 38, 40, c.hp / c.maxHp, '#4ab8d8');
  }

  for (const r of s.rings) {
    const k = r.t / r.dur;
    ctx.save();
    if (r.kind === 'pulse') {
      ctx.strokeStyle = `rgba(74,184,216,${1 - k})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.2 + 0.8 * k), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(160,230,250,${0.25 * (1 - k)})`; ctx.fill();
    } else if (r.kind === 'heart') {
      ctx.strokeStyle = `rgba(216,52,58,${0.8 * (1 - k)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.8 + 0.4 * k), 0, Math.PI * 2); ctx.stroke();
    } else if (r.kind === 'cellDown') {
      ctx.strokeStyle = `rgba(200,64,42,${1 - k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.5 + k), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255,240,200,${0.7 * (1 - k)})`;
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * k, 2.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    ctx.fillStyle = f.color; ctx.font = '700 28px Palatino, Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y - f.t * 30);
    ctx.globalAlpha = 1;
  }
  drawPreview(ctx, s);
  void aliveCells;
}

export { C as COLORS };
