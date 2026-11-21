// Live drawing on top of the painted spread.
import { BALANCE, phaseRule } from './balance';
import { MAP_W, MAP_H, LANES, POND, BRIDGE, INKWELL, NODE, FOUNDATION_IDS, routePolyline, pointAt, type Vec } from './map';
import { type GameState, type Tower, enemyPos, posOf, towerAt, flightPoint } from './game';
import { buildStatic, stroke, roundRect, drawGoose, SERIF } from './paint';
import { P, drawTowerIcon, drawEnemy, drawNameStone, litGrad, softShadow } from './sprites';

export { towerIconCanvas, enemyIconCanvas } from './sprites';

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
  touch: boolean;
  /** Enemy being inspected. */
  inspectId: number | null;
}

const INK = '#15131f';
let staticLayer: HTMLCanvasElement | null = null;
function base(ctx: CanvasRenderingContext2D) {
  if (!staticLayer) staticLayer = buildStatic(2);
  ctx.drawImage(staticLayer, 0, 0, MAP_W, MAP_H);
}

/** Iron-gall ink: tapering, wobbly, soaked into the paint, with a wet sheen while fresh. */
function inkThread(ctx: CanvasRenderingContext2D, path: Vec[], time: number, alpha = 1, mode: 'wet' | 'dry' | 'fading' = 'wet') {
  if (path.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = mode === 'dry' ? 'rgba(40,25,10,0.2)' : 'rgba(10,8,20,0.28)';
  ctx.lineWidth = 15;
  stroke(ctx, path);
  const col = mode === 'dry' ? '#4a3626' : mode === 'fading' ? '#3a3640' : INK;
  ctx.strokeStyle = col; ctx.fillStyle = col;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
    const w = (mode === 'dry' ? 3.4 : 6) + 1.8 * Math.sin(acc * 0.045) + 1 * Math.sin(acc * 0.13 + 1.7);
    ctx.lineWidth = Math.max(1.6, w);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let i = 0; i < path.length; i += Math.max(1, Math.floor(path.length / 9))) {
    const p = path[i];
    ctx.beginPath(); ctx.arc(p.x + ((i * 13) % 5) - 2, p.y + ((i * 7) % 5) - 2, 3.2 + ((i * 37) % 5) * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  if (mode === 'wet') {
    ctx.strokeStyle = 'rgba(170,185,235,0.6)'; ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 26]); ctx.lineDashOffset = -time * 60;
    stroke(ctx, path);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Permanent gold leaf along a bound tower's route, or a dashed preview. */
function goldRoute(ctx: CanvasRenderingContext2D, foundation: string, preview: boolean, time: number) {
  const path = routePolyline(foundation);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (preview) {
    ctx.strokeStyle = `rgba(90,60,10,${0.55 + 0.3 * Math.sin(time * 5)})`; ctx.lineWidth = 16; stroke(ctx, path);
    ctx.strokeStyle = P.goldLight; ctx.lineWidth = 10; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 30; stroke(ctx, path);
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = '#5e4210'; ctx.lineWidth = 15; stroke(ctx, path);
    ctx.strokeStyle = P.gold; ctx.lineWidth = 11; stroke(ctx, path);
    ctx.strokeStyle = P.goldLight; ctx.lineWidth = 4; ctx.setLineDash([2, 6]); stroke(ctx, path); ctx.setLineDash([]);
    ctx.fillStyle = P.goldLight; ctx.strokeStyle = '#5e4210'; ctx.lineWidth = 1;
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

function drawFoundation(ctx: CanvasRenderingContext2D, f: string, selected: boolean, hovered: boolean, bound: boolean, preview: boolean, built: boolean, time: number) {
  const n = NODE[f];
  ctx.save(); ctx.translate(n.x, n.y);
  if (!built) {
    softShadow(ctx, 3, 3, 32, 13, 0.45);
    ctx.fillStyle = litGrad(ctx, -30, -12, 30, 12, P.stoneLight, P.stone, P.stoneDark);
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,30,15,0.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(240,228,200,0.8)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
  }
  if (bound) { ctx.strokeStyle = P.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (preview) {
    ctx.strokeStyle = `rgba(240,210,122,${0.6 + 0.4 * Math.sin(time * 6)})`; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(0, 0, 42, 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (selected || hovered) {
    ctx.strokeStyle = selected ? P.goldLight : 'rgba(240,228,200,0.7)'; ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawTowerState(ctx: CanvasRenderingContext2D, s: GameState, t: Tower, time: number) {
  const p = posOf(t);
  if (t.flash > 0) {
    ctx.save(); ctx.globalAlpha = t.flash * 0.7;
    const g = ctx.createRadialGradient(p.x, p.y - 34, 2, p.x, p.y - 34, 50);
    g.addColorStop(0, P.goldLight); g.addColorStop(1, 'rgba(240,210,122,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 34, 50, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  drawTowerIcon(ctx, t.type, p.x, p.y, 1, time + p.x);
  const markX = p.x + 24, markY = p.y - 66;
  if (t.traced) {
    const ready = s.phase === 'combat' && !t.committed && s.pulsesLeft > 0;
    ctx.save(); ctx.translate(markX, markY);
    if (t.committed) {
      ctx.fillStyle = '#4a3626'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8dcbc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 4); ctx.lineTo(5, -4); ctx.stroke();
    } else {
      const k = ready ? 1 + 0.15 * Math.sin(time * 7) : 1;
      ctx.scale(k, k);
      ctx.shadowColor = 'rgba(160,180,255,0.8)'; ctx.shadowBlur = ready ? 12 : 0;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(9, 0, 7, 5); ctx.arc(0, 4, 7.2, 0.15, Math.PI - 0.15); ctx.quadraticCurveTo(-9, 0, 0, -13); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(220,230,255,0.85)'; ctx.beginPath(); ctx.ellipse(-2.5, 2, 1.8, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (t.bound) {
    const ready = s.phase === 'combat' && !t.committed;
    ctx.save(); ctx.translate(markX, markY);
    const k = ready ? 1 + 0.15 * Math.sin(time * 7) : 1;
    ctx.scale(k, k);
    ctx.shadowColor = 'rgba(240,210,122,0.9)'; ctx.shadowBlur = ready ? 14 : 0;
    ctx.fillStyle = t.committed && s.phase === 'combat' ? '#8a7a52' : litGrad(ctx, -10, -10, 10, 10, '#fff0b8', P.gold, '#6b4c12');
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#3c4a26';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.6, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (t.royal) {
    ctx.save(); ctx.translate(p.x - 26, p.y - 60);
    ctx.fillStyle = litGrad(ctx, -8, -6, 8, 4, '#fff0b8', P.gold, '#6b4c12');
    ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawHedge(ctx: CanvasRenderingContext2D, h: GameState['hedges'][number], time: number) {
  const life = Math.min(1, h.t / 0.35, (h.dur - h.t) / 0.5);
  ctx.save(); ctx.translate(h.at.x, h.at.y); ctx.rotate(h.angle + Math.PI / 2);
  ctx.scale(1, Math.max(0.05, life));
  softShadow(ctx, 4, 4, 34, 12, 0.5);
  for (let i = -3; i <= 3; i++) {
    const x = i * 8, y = -2 + (i % 2) * 2;
    ctx.fillStyle = litGrad(ctx, x - 9, y - 9, x + 9, y + 9, P.leafLight, P.leaf, P.leafDark);
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = P.leafDark; ctx.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 8, -8); ctx.lineTo(i * 8 + 3, -16); ctx.stroke(); }
  for (let i = -2; i <= 2; i++) { ctx.fillStyle = P.oxblood; ctx.beginPath(); ctx.arc(i * 10, -6 + Math.sin(time * 3 + i), 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawFire(ctx: CanvasRenderingContext2D, f: GameState['fires'][number], time: number) {
  const life = Math.min(1, f.t / 0.3, (f.dur - f.t) / 0.6);
  ctx.save();
  ctx.globalAlpha = Math.max(0, life);
  for (let i = 0; i < f.pts.length; i++) {
    const p = f.pts[i];
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 20);
    g.addColorStop(0, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(200,70,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < f.pts.length; i += 2) {
    const p = f.pts[i];
    const fl = Math.sin(time * 12 + i * 1.7);
    ctx.fillStyle = litGrad(ctx, p.x, p.y - 22, p.x, p.y + 4, '#fff1b0', i % 4 === 0 ? '#f08a2e' : '#f6b544', '#a3301a');
    ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 4);
    ctx.quadraticCurveTo(p.x - 6, p.y - 10 - fl * 3, p.x, p.y - 22 - fl * 4);
    ctx.quadraticCurveTo(p.x + 6, p.y - 10, p.x + 7, p.y + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Barrow Hounds: horn rings and a banner at the bridge shortly before the pack arrives. */
function drawHoundWarnings(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  if (s.phase !== 'combat') return;
  for (const w of s.warnings) {
    if (s.waveTime < w.from || s.waveTime > w.to) continue;
    const entry = LANES.king.pts[2]; // the bridge's southern approach
    const k = 0.6 + 0.4 * Math.abs(Math.sin(time * 5));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 4;
    for (let r = 22; r < 80; r += 18) { ctx.beginPath(); ctx.arc(entry.x, entry.y, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const bx = 548, by = 722;
    ctx.fillStyle = 'rgba(25,12,6,0.88)'; roundRect(ctx, bx, by - 24, 258, 36, 7); ctx.fill();
    ctx.strokeStyle = P.gold; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = litGrad(ctx, bx + 8, by - 16, bx + 32, by + 2, '#f0d27a', '#b07a32', '#5e3d14');
    ctx.beginPath(); ctx.moveTo(bx + 10, by - 2); ctx.quadraticCurveTo(bx + 18, by - 20, bx + 34, by - 16); ctx.lineTo(bx + 34, by - 4); ctx.quadraticCurveTo(bx + 20, by - 8, bx + 14, by + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4e6c0'; ctx.font = `600 17px ${SERIF}`; ctx.textAlign = 'left';
    ctx.fillText('Horns! Hounds at the bridge', bx + 42, by);
    ctx.restore();
  }
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, v: ViewState, time: number) {
  base(ctx);

  for (const t of s.towers) if (t.bound) goldRoute(ctx, t.foundation, false, time);
  if (v.bindPreview && !towerAt(s, v.bindPreview)?.bound) goldRoute(ctx, v.bindPreview, true, time);
  for (const f of s.fading) inkThread(ctx, f.path, time, 1 - f.t / f.dur, 'fading');
  for (const t of s.towers) if (t.traced) inkThread(ctx, routePolyline(t.foundation), time, 1, t.committed ? 'dry' : 'wet');
  if (v.gesture.active && v.gesture.path.length > 1) {
    inkThread(ctx, v.gesture.path, time, v.gesture.slipping > 0 ? 0.45 : 1, 'wet');
    const end = v.gesture.path[v.gesture.path.length - 1];
    ctx.save(); ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(end.x, end.y, 7 + Math.sin(time * 10), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(10,8,20,0.2)'; ctx.beginPath(); ctx.arc(end.x, end.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (s.phase === 'prep' && !s.pendingGrant && s.traces.length < phaseRule(s.wave).traces) {
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.save(); ctx.strokeStyle = `rgba(245,232,200,${0.35 + 0.45 * k})`; ctx.lineWidth = 3; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.arc(INKWELL.x, INKWELL.y - 4, 56 + k * 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  for (const f of s.fires) drawFire(ctx, f, time);
  for (const st of s.stones) { const p = pointAt(LANES[st.lane], st.s); drawNameStone(ctx, p.x + 14, p.y + 4, time); }

  for (const f of FOUNDATION_IDS) {
    const t = towerAt(s, f);
    drawFoundation(ctx, f, v.selectedFoundation === f, v.hoverFoundation === f, !!t?.bound, v.bindPreview === f, !!t, time);
  }

  const hf = v.hoverFoundation ?? v.selectedFoundation;
  const ht = hf ? towerAt(s, hf) : undefined;
  if (ht) {
    const p = posOf(ht);
    ctx.save(); ctx.strokeStyle = 'rgba(245,232,200,0.55)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, BALANCE.towers[ht.type].range, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  type Sprite = { y: number; draw: () => void };
  const sprites: Sprite[] = [];
  for (const t of s.towers) sprites.push({ y: posOf(t).y, draw: () => drawTowerState(ctx, s, t, time) });
  for (const e of s.enemies) {
    const p = enemyPos(e);
    const dir = Math.cos(p.angle) >= -0.1 ? 1 : -1;
    const k = e.type === 'cairn' ? 1 : e.type === 'hound' ? 1.05 : 1.15;
    sprites.push({
      y: p.y, draw: () => {
        drawEnemy(ctx, e.type, p.x, p.y, dir, e.bob, e.hit, k, { kneel: e.mode === 'kneel', alpha: e.mode === 'leave' ? e.fade ?? 1 : 1 });
        const top = e.type === 'cairn' ? (e.mode === 'kneel' ? 70 : 84) : e.type === 'bearer' ? 70 : 36;
        if (e.vulnT > 0 || e.shred > 0) {
          ctx.fillStyle = e.vulnT > 0 ? 'rgba(120,220,180,0.9)' : 'rgba(120,200,170,0.6)';
          for (let i = 0; i < 4; i++) { const a = time * 3 + i * 1.6; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 12, p.y - top / 2 + Math.sin(a) * 6, 1.8, 0, Math.PI * 2); ctx.fill(); }
        }
        if (e.stun > 0) {
          ctx.fillStyle = P.goldLight;
          for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 10, p.y - top + 4 + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
        }
        if (e.hp < e.maxHp && e.mode !== 'leave') {
          const w = e.type === 'cairn' ? 50 : 26;
          ctx.fillStyle = 'rgba(20,12,6,0.75)'; ctx.fillRect(p.x - w / 2, p.y - top - 6, w, 5);
          ctx.fillStyle = '#c0392b'; ctx.fillRect(p.x - w / 2, p.y - top - 6, w * Math.max(0, e.hp / e.maxHp), 5);
        }
        if (v.inspectId === e.id) {
          ctx.save(); ctx.strokeStyle = P.goldLight; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -time * 20;
          const r = e.type === 'cairn' ? 40 : 18;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      },
    });
  }
  for (const h of s.hedges) sprites.push({ y: h.at.y + 1, draw: () => drawHedge(ctx, h, time) });
  sprites.sort((a, b) => a.y - b.y);
  for (const sp of sprites) sp.draw();

  for (const p of s.projectiles) {
    const a = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    if (p.kind === 'castle') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#ccc6b8'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f1e3bd'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -3); ctx.moveTo(-10, 0); ctx.lineTo(-14, 3); ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'bramble') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.fillStyle = '#2e3a1c'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'verdigris') {
      const g = ctx.createRadialGradient(p.x - 1, p.y - 1, 0, p.x, p.y, 6);
      g.addColorStop(0, '#d8fff0'); g.addColorStop(0.5, P.verdigris); g.addColorStop(1, 'rgba(40,90,75,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      const k = Math.min(1, p.t / p.dur);
      const arc = Math.sin(k * Math.PI) * 60;
      ctx.save();
      softShadow(ctx, p.x, p.y + 30 * (1 - k), 6, 2.5, 0.4);
      ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.shadowBlur = 10;
      const g = ctx.createRadialGradient(p.x - 1, p.y - arc - 1, 0, p.x, p.y - arc, 5);
      g.addColorStop(0, '#fff1b0'); g.addColorStop(1, '#d0541c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - arc, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  for (const r of s.rings) {
    const k = r.t / r.dur;
    ctx.save();
    if (r.kind === 'bell' || r.kind === 'toll') {
      ctx.strokeStyle = r.kind === 'toll' ? `rgba(240,210,122,${1 - k})` : `rgba(245,232,200,${0.45 * (1 - k)})`;
      ctx.lineWidth = r.kind === 'toll' ? 6 : 2;
      for (const f of [0.6, 1]) { ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k) * f, 0, Math.PI * 2); ctx.stroke(); }
    } else if (r.kind === 'splash') {
      ctx.fillStyle = `rgba(240,140,50,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.5 + 0.5 * k), 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === 'tarnish') {
      const rr = r.r * (0.4 + 0.6 * k);
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rr);
      g.addColorStop(0, `rgba(140,230,190,${0.45 * (1 - k)})`); g.addColorStop(1, 'rgba(80,160,130,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.fill();
    } else if (r.kind === 'corrode') {
      ctx.fillStyle = `rgba(120,220,180,${0.7 * (1 - k)})`;
      for (let i = 0; i < 5; i++) { const a = i * 1.3; ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * k * 0.6, 1.8, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = `rgba(15,12,25,${0.8 * (1 - k)})`;
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + 0.3, d = r.r * (0.4 + k) * (0.6 + (i % 3) * 0.25);
        ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * d, r.y - 30 + Math.sin(a) * d * 0.7, 4 - (i % 3), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  for (const f of s.flights) {
    const p = flightPoint(f);
    const gold = !!s.towers.find((x) => x.id === f.towerId)?.bound;
    const back = flightPoint({ ...f, s: Math.max(0, f.s - 40) });
    ctx.save();
    ctx.strokeStyle = gold ? P.gold : INK; ctx.lineCap = 'round'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.shadowColor = gold ? 'rgba(240,210,122,1)' : 'rgba(120,140,230,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = gold ? P.goldLight : INK;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(230,236,255,0.8)';
    ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawHoundWarnings(ctx, s, time);
  drawGoose(ctx, POND.x - 30 + Math.sin(time * 0.4) * 10, POND.y - 6, 1, 1);
  drawGoose(ctx, POND.x + 26 + Math.sin(time * 0.3 + 2) * 8, POND.y + 14, 0.9, -1);
  drawGoose(ctx, BRIDGE.x + 26, BRIDGE.y - 40, 0.8, 1);
}

/** The victory plate: the battlefield as a finished, varnished painting. */
export function renderVictory(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  base(ctx);
  for (const t of s.towers) if (t.bound) goldRoute(ctx, t.foundation, false, time);
  for (const f of FOUNDATION_IDS) drawFoundation(ctx, f, false, false, !!towerAt(s, f)?.bound, false, !!towerAt(s, f), time);
  for (const t of [...s.towers].sort((a, b) => posOf(a).y - posOf(b).y)) drawTowerIcon(ctx, t.type, posOf(t).x, posOf(t).y, 1, time);
  ctx.save();
  ctx.fillStyle = 'rgba(200,140,50,0.16)'; ctx.fillRect(0, 0, MAP_W, MAP_H);
  const g = ctx.createRadialGradient(800, 450, 300, 800, 500, 950);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.strokeStyle = litGrad(ctx, 0, 0, MAP_W, MAP_H, '#fff0b8', P.gold, '#6b4c12'); ctx.lineWidth = 16; ctx.strokeRect(22, 22, MAP_W - 44, MAP_H - 44);
  ctx.strokeStyle = '#140c04'; ctx.lineWidth = 3; ctx.strokeRect(12, 12, MAP_W - 24, MAP_H - 24); ctx.strokeRect(34, 34, MAP_W - 68, MAP_H - 68);
  ctx.restore();
  ctx.save(); ctx.fillStyle = P.oxblood;
  for (const y of [420, 620]) { ctx.beginPath(); ctx.moveTo(1450, y); ctx.lineTo(1450, y + 70); ctx.lineTo(1462, y + 58); ctx.lineTo(1474, y + 70); ctx.lineTo(1474, y); ctx.closePath(); ctx.fill(); }
  ctx.restore();
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
