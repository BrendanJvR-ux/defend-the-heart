// Drawing for Defend the Heart: a stylised anatomy plate, kept calm so the white cells stand out.
import { CONFIG, type NodeType, type PathogenType, type VesselId } from './config';
import { W, H, HEART, HEART_R, VESSELS, VESSEL_IDS, SITES, siteById, pointAt, type Vec } from './level';
import { type State, cellPos, pathogenPos, pulseTargets, waveSpawns, nodeAt } from './sim';

export interface View {
  hoverVessel: VesselId | null;
  hoverSite: string | null;
  selectedSite: string | null;
  showPulseRadius: boolean;
  touch: boolean;
}

export const NODE_COLORS: Record<NodeType, { base: string; dark: string; light: string }> = {
  igm: { base: '#e0a33a', dark: '#8a5a12', light: '#f6d68a' },
  igg: { base: '#4a8ad8', dark: '#1e4a8a', light: '#a8ccf6' },
  iga: { base: '#4ab88a', dark: '#1e6a4a', light: '#a8e8c8' },
};

const C = {
  paper: '#f4ead8', ink: '#2a1e18',
  wall: '#8a2a2a', wallLight: '#c86a5e', lumen: '#b8343a', lumenDeep: '#8a1e24',
  heart: '#c8554e', heartDark: '#7a2420',
  bacterium: '#6aa84a', bacteriumDark: '#2e5a22', virus: '#8a4ab8', virusDark: '#4a1e70',
  hijacker: '#e0702a', hijackerDark: '#8a3a10',
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
  for (let i = 0; i < 1500; i++) {
    const x = R() * W, y = R() * H;
    ctx.strokeStyle = 'rgba(170,110,95,0.16)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, 7 + R() * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,80,140,0.22)'; ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(170,110,95,0.14)'; ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = R() * W, y = R() * H; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 40, y - 10, x + 80, y + 12, x + 130, y); ctx.stroke(); }
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
  ctx.strokeStyle = C.ink; ctx.lineWidth = w + 14; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.wall; ctx.lineWidth = w + 11; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.wallLight; ctx.lineWidth = w + 3; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.lumenDeep; ctx.lineWidth = w; smooth(ctx, ves.pts); ctx.stroke();
  ctx.strokeStyle = C.lumen; ctx.lineWidth = w * 0.7; smooth(ctx, ves.pts); ctx.stroke();
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
  ctx.fillStyle = 'rgba(240,120,110,0.35)';
  for (let i = 0; i < 12; i++) {
    const d = ((t * 40 + i * 71) % ves.length);
    const p = pointAt(ves, d), side = ((i * 37) % 9 - 4) * (w / 12);
    ctx.beginPath(); ctx.ellipse(p.x - Math.sin(p.angle) * side, p.y + Math.cos(p.angle) * side, 4.5, 3, p.angle, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, s: State, t: number) {
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.15)), 8) * 0.035;
  const k = (1 + beat + s.heartKick * 0.08) * 1.15;
  ctx.save(); ctx.translate(HEART.x, HEART.y); ctx.scale(k, k);
  const heart = () => { ctx.beginPath(); ctx.moveTo(0, 105); ctx.bezierCurveTo(-95, 30, -100, -70, -42, -92); ctx.bezierCurveTo(-14, -104, 0, -80, 4, -66); ctx.bezierCurveTo(22, -104, 92, -96, 92, -30); ctx.bezierCurveTo(92, 34, 30, 80, 0, 105); ctx.closePath(); };
  for (const [vx, vw, col] of [[-26, 24, '#b8433a'], [4, 20, '#4a6aa8'], [30, 18, '#b8433a']] as const) {
    ctx.fillStyle = col; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(vx - vw / 2, -150, vw, 70, 9); ctx.fill(); ctx.stroke();
  }
  const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, 120);
  g.addColorStop(0, '#e08a7e'); g.addColorStop(0.6, C.heart); g.addColorStop(1, C.heartDark);
  heart(); ctx.fillStyle = g; ctx.fill();
  if (s.heartKick > 0) { heart(); ctx.fillStyle = `rgba(255,60,50,${s.heartKick * 0.45})`; ctx.fill(); }
  heart(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#7a2420'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -64); ctx.bezierCurveTo(-18, -14, -20, 40, -2, 100); ctx.stroke();
  ctx.lineWidth = 1.6; for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) { const yy = -30 + i * 36; ctx.beginPath(); ctx.moveTo(-10, yy); ctx.quadraticCurveTo(-10 + sgn * 24, yy + 8, -10 + sgn * 40, yy + 22); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-50, -50, 14, 24, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const n = CONFIG.heartHp;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, r = HEART_R * 1.15 + 44;
    ctx.fillStyle = i < s.heartHp ? '#d8343a' : 'rgba(60,40,40,0.18)';
    ctx.beginPath(); ctx.arc(HEART.x + Math.cos(a) * r, HEART.y + 4 + Math.sin(a) * r, 7, 0, Math.PI * 2); ctx.fill();
  }
}

/** A lymph node in its type colour, with a letter badge (M / G / A). */
export function drawNodeIcon(ctx: CanvasRenderingContext2D, type: NodeType, x: number, y: number, k = 1, flash = 0) {
  const col = NODE_COLORS[type];
  ctx.save(); ctx.translate(x, y); ctx.scale(k * (1 + flash * 0.12), k * (1 + flash * 0.12));
  const bean = () => { ctx.beginPath(); ctx.moveTo(-38, 0); ctx.bezierCurveTo(-44, -36, 44, -36, 40, 0); ctx.bezierCurveTo(36, 28, 6, 14, 0, 20); ctx.bezierCurveTo(-10, 28, -36, 24, -38, 0); ctx.closePath(); };
  const g = ctx.createRadialGradient(-12, -12, 4, 0, 0, 44); g.addColorStop(0, col.light); g.addColorStop(1, col.base);
  bean(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; ctx.fillStyle = col.dark; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -4 + Math.sin(a) * 15, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 2, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col.dark; ctx.font = '900 16px Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(type === 'igm' ? 'M' : type === 'igg' ? 'G' : 'A', 0, 3);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawSites(ctx: CanvasRenderingContext2D, s: State, view: View, t: number) {
  for (const site of SITES) {
    const node = nodeAt(s, site.id);
    // tether to the section of vessel it guards
    ctx.strokeStyle = node ? 'rgba(42,30,24,0.55)' : 'rgba(42,30,24,0.22)'; ctx.lineWidth = 2.4; ctx.setLineDash(node ? [] : [4, 5]);
    ctx.beginPath(); ctx.moveTo(site.x, site.y); ctx.lineTo(site.anchor.x, site.anchor.y); ctx.stroke(); ctx.setLineDash([]);
    const hot = view.hoverSite === site.id || view.selectedSite === site.id;
    if (node) {
      const st = CONFIG.nodes[node.type];
      if (hot || s.phase === 'prep') {
        ctx.fillStyle = 'rgba(42,30,24,0.05)'; ctx.strokeStyle = hot ? 'rgba(42,30,24,0.6)' : 'rgba(42,30,24,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
        ctx.beginPath(); ctx.arc(site.x, site.y, st.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      drawNodeIcon(ctx, node.type, site.x, site.y, 1.05, node.flash);
    } else if (s.phase === 'prep') {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + site.index);
      ctx.fillStyle = hot ? 'rgba(74,184,216,0.25)' : 'rgba(255,255,255,0.55)';
      ctx.strokeStyle = hot ? '#1e6a8a' : `rgba(42,30,24,${0.4 + 0.25 * k})`; ctx.lineWidth = 2.4; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(site.x, site.y, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = hot ? '#1e6a8a' : 'rgba(42,30,24,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(site.x - 9, site.y); ctx.lineTo(site.x + 9, site.y); ctx.moveTo(site.x, site.y - 9); ctx.lineTo(site.x, site.y + 9); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(42,30,24,0.18)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(site.x, site.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

export function drawPathogen(ctx: CanvasRenderingContext2D, type: PathogenType, x: number, y: number, angle: number, hit: number, scale = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (type === 'bacterium') {
    ctx.rotate(angle);
    ctx.strokeStyle = C.bacteriumDark; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-16, -3 + i * 2); ctx.bezierCurveTo(-22, -8 + i * 4, -26, 4 + i * 2, -32, -2 + i * 3); ctx.stroke(); }
    // the capsule (armour) as a pale halo
    ctx.strokeStyle = 'rgba(220,240,200,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-19, -10, 38, 20, 10); ctx.stroke();
    const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#a8d888'); g.addColorStop(0.5, C.bacterium); g.addColorStop(1, C.bacteriumDark);
    ctx.fillStyle = hit > 0 ? '#ffffff' : g; ctx.beginPath(); ctx.roundRect(-17, -8, 34, 16, 8); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(30,60,20,0.45)'; for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(dx, 1, 1.8, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'virus' || type === 'hijacker') {
    const hij = type === 'hijacker';
    ctx.rotate(hij ? t * 2 : 0);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
    const n = hij ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * (hij ? 14 : 12), Math.sin(a) * (hij ? 14 : 12)); ctx.stroke();
      ctx.fillStyle = hij ? '#ffd24a' : '#ff7ab8';
      if (hij) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14 + Math.cos(a + 1.6) * 3, Math.sin(a) * 14 + Math.sin(a + 1.6) * 3); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 14 - Math.cos(a + 1.6) * 3, Math.sin(a) * 14 - Math.sin(a + 1.6) * 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8); g.addColorStop(0, hij ? '#ffc890' : '#c89ae8'); g.addColorStop(1, hij ? C.hijackerDark : C.virusDark);
    ctx.fillStyle = hit > 0 ? '#ffffff' : g;
    ctx.beginPath(); if (hij) { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); } ctx.closePath(); } else ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
    if (hij) { ctx.fillStyle = '#2a1008'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    // an infected white cell: a sickly purple membrane, the virus visible inside, red glare
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2; const r = 15 + Math.sin(a * 5 + t * 6) * 2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = hit > 0 ? '#ffffff' : '#b89ad0'; ctx.fill(); ctx.strokeStyle = '#4a1e70'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = '#e0702a'; for (const [dx, dy] of [[-5, -3], [4, 4], [6, -5]]) { ctx.beginPath(); ctx.arc(dx, dy, 3.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(-3, -8, 2, 0, Math.PI * 2); ctx.arc(4, -8, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawWhiteCell(ctx: CanvasRenderingContext2D, x: number, y: number, hit: number, t: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255,255,255,0.9)'); halo.addColorStop(1, 'rgba(120,210,240,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2; const r = 15 + Math.sin(a * 3 + t * 4) * 1.2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath();
  ctx.fillStyle = hit > 0 ? '#ffe0e0' : C.cell; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = C.nucleus;
  for (const [dx, dy] of [[-5, -3], [1, 4], [6, -3]]) { ctx.beginPath(); ctx.arc(dx, dy, 4.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** An immunoglobulin in flight: IgM a five-armed pentamer, IgG a single Y, IgA a paired dimer. */
function drawAntibody(ctx: CanvasRenderingContext2D, type: NodeType, x: number, y: number, a: number) {
  const col = NODE_COLORS[type];
  ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
  ctx.strokeStyle = col.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  const Y = (rot: number, k: number) => { ctx.save(); ctx.rotate(rot); ctx.scale(k, k); ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 0); ctx.lineTo(-4, -5); ctx.moveTo(0, 0); ctx.lineTo(4, -5); ctx.stroke(); ctx.restore(); };
  if (type === 'igm') { for (let i = 0; i < 5; i++) Y((i / 5) * Math.PI * 2, 0.9); ctx.fillStyle = col.base; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
  else if (type === 'igg') { ctx.lineWidth = 3; Y(0, 1.3); }
  else { Y(-0.5, 1); Y(Math.PI - 0.5, 1); ctx.fillStyle = col.base; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string) {
  ctx.fillStyle = 'rgba(30,20,20,0.6)'; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
}

/** Next-wave preview: a small tag at each vessel's mouth with what is coming up it. */
function drawPreview(ctx: CanvasRenderingContext2D, s: State) {
  if (s.phase !== 'prep') return;
  const sp = waveSpawns(s.wave);
  for (const v of VESSEL_IDS) {
    const mine = sp.filter((x) => x.vessel === v);
    if (!mine.length) continue;
    const counts = new Map<PathogenType, number>();
    for (const m of mine) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
    const p = pointAt(VESSELS[v], 70);
    const w = 70 + counts.size * 86;
    const bx = Math.max(24, Math.min(W - w - 24, p.x - w / 2)), by = Math.max(24, Math.min(H - 70, p.y + (v === 'upper' ? 40 : v === 'lower' ? -110 : 46)));
    ctx.fillStyle = 'rgba(244,234,216,0.95)'; ctx.strokeStyle = '#c8402a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.roundRect(bx, by, w, 48, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c8402a'; ctx.font = '900 22px Palatino, Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('IN', bx + 12, by + 32);
    let x = bx + 70;
    for (const [type, n] of counts) {
      drawPathogen(ctx, type, x, by + 24, 0, 0, type === 'bacterium' ? 1 : 1.2);
      ctx.fillStyle = C.ink; ctx.font = '700 20px Palatino, Georgia, serif'; ctx.fillText(`×${n}`, x + 24, by + 31);
      x += 86;
    }
  }
}

export function draw(ctx: CanvasRenderingContext2D, s: State, view: View, t: number) {
  ctx.drawImage(background(), 0, 0, W, H);
  for (const v of VESSEL_IDS) drawVessel(ctx, s, v, view, t);
  for (const v of VESSEL_IDS) {
    const p = pointAt(VESSELS[v], 150);
    ctx.font = '700 24px Palatino, Georgia, serif'; ctx.textAlign = 'center';
    const label = v[0].toUpperCase() + v.slice(1);
    const ly = p.y + (v === 'upper' ? 6 : -40);
    const lx = p.x + (v === 'upper' ? 70 : 0);
    ctx.fillStyle = 'rgba(244,234,216,0.9)'; const tw = ctx.measureText(label).width;
    ctx.fillRect(lx - tw / 2 - 10, ly - 23, tw + 20, 32);
    ctx.fillStyle = C.ink; ctx.fillText(label, lx, ly);
    if (s.dilated === v) {
      ctx.fillStyle = C.pulse; ctx.beginPath(); ctx.roundRect(lx - 58, ly + 14, 116, 28, 14); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '700 17px Palatino, Georgia, serif'; ctx.fillText('DILATED', lx, ly + 34);
    }
  }
  drawSites(ctx, s, view, t);
  drawHeart(ctx, s, t);

  for (const sh of s.shots) drawAntibody(ctx, sh.type, sh.x, sh.y, Math.atan2(sh.y - sh.sy, sh.x - sh.sx));

  const eligible = s.phase === 'combat' && s.pulsesLeft > 0 ? new Set(pulseTargets(s).map((p) => p.id)) : new Set<number>();
  for (const p of s.pathogens) {
    const q = pathogenPos(p);
    if (eligible.has(p.id) && (view.touch || view.showPulseRadius)) {
      ctx.strokeStyle = 'rgba(74,184,216,0.95)'; ctx.lineWidth = 2.4; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(q.x, q.y, p.type === 'bacterium' ? 30 : 24, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (p.slowT > 0) { ctx.fillStyle = 'rgba(74,184,138,0.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, Math.PI * 2); ctx.fill(); }
    drawPathogen(ctx, p.type, q.x, q.y, q.angle, p.hit, p.type === 'infected' ? 1.35 : 1.4, t + p.id);
    if (p.shredT > 0) {
      // IgG has opened the capsule: blue cracks
      ctx.strokeStyle = NODE_COLORS.igg.base; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q.x - 10, q.y - 14); ctx.lineTo(q.x - 4, q.y - 8); ctx.lineTo(q.x - 8, q.y - 2); ctx.moveTo(q.x + 10, q.y - 14); ctx.lineTo(q.x + 5, q.y - 7); ctx.stroke();
    }
    if (p.hp < p.maxHp) bar(ctx, q.x, q.y - 30, p.type === 'bacterium' || p.type === 'infected' ? 40 : 26, p.hp / p.maxHp, '#c8402a');
  }

  for (const c of s.cells) {
    if (c.hp <= 0 || c.infected || (s.phase === 'recall' && c.home)) continue;
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
    } else if (r.kind === 'cellDown' || r.kind === 'infect') {
      ctx.strokeStyle = r.kind === 'infect' ? `rgba(138,42,184,${1 - k})` : `rgba(200,64,42,${1 - k})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.5 + k), 0, Math.PI * 2); ctx.stroke();
    } else if (r.kind === 'build') {
      ctx.strokeStyle = `rgba(42,30,24,${1 - k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.6 + k), 0, Math.PI * 2); ctx.stroke();
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
  void siteById;
}
