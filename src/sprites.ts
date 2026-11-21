// Painted sprites: towers and enemies in the manner of a Dutch Golden Age oil.
// Light falls from the upper left; shadows fall soft to the lower right.
import type { EnemyType, TowerType } from './balance';

export const P = {
  ink: '#1e1710',
  umber: '#3b2a18',
  shadow: 'rgba(30,18,6,0.42)',
  brick: '#8a3b24',
  brickDark: '#5c2414',
  brickLight: '#b65a37',
  slate: '#3b3f46',
  slateLight: '#6b7078',
  stone: '#b9ab8c',
  stoneDark: '#6e634d',
  stoneLight: '#e0d4b4',
  leaf: '#3c4a26',
  leafDark: '#1e2814',
  leafLight: '#8d9447',
  straw: '#cdb46c',
  strawDark: '#8f7638',
  cream: '#efe4c8',
  gold: '#c49a3a',
  goldLight: '#f0d27a',
  copper: '#a8683a',
  verdigris: '#4f9a83',
  verdigrisLight: '#9fd6bf',
  oxblood: '#7a2026',
};

/** Linear "lit from the upper left" gradient. */
export function litGrad(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, light: string, mid: string, dark: string) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

/** Soft cast shadow falling to the lower right. */
export function softShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.45) {
  const g = ctx.createRadialGradient(x + rx * 0.35, y + ry * 0.25, 0, x + rx * 0.35, y + ry * 0.25, rx);
  g.addColorStop(0, `rgba(25,14,4,${alpha})`);
  g.addColorStop(1, 'rgba(25,14,4,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x + rx * 0.35, y + ry * 0.25, rx, ry, 0.15, 0, Math.PI * 2); ctx.fill();
}

/** A small bright dab of impasto. */
function dab(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, -0.5, 0, Math.PI * 2); ctx.fill();
}

// ── Towers ──────────────────────────────────────────────────────────────────

export function drawTowerIcon(ctx: CanvasRenderingContext2D, type: TowerType, x: number, y: number, k: number, time = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  softShadow(ctx, 10, 2, 34, 12, 0.5);
  // plinth
  ctx.fillStyle = litGrad(ctx, -24, -6, 24, 8, P.stoneLight, P.stone, P.stoneDark);
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  if (type === 'bramble') bramble(ctx, time);
  else if (type === 'ember') ember(ctx, time);
  else if (type === 'bell') bell(ctx);
  else verdigris(ctx, time);
  ctx.restore();
}

function cylinder(ctx: CanvasRenderingContext2D, w: number, h: number, light: string, mid: string, dark: string) {
  ctx.fillStyle = litGrad(ctx, -w, 0, w, 0, light, mid, dark);
  ctx.beginPath();
  ctx.moveTo(-w, 0); ctx.lineTo(-w, -h); ctx.ellipse(0, -h, w, w * 0.35, 0, Math.PI, 0); ctx.lineTo(w, 0);
  ctx.ellipse(0, 0, w, w * 0.35, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,10,0.55)'; ctx.lineWidth = 1; ctx.stroke();
}

function bramble(ctx: CanvasRenderingContext2D, time: number) {
  cylinder(ctx, 14, 52, '#a59878', '#7a6e55', '#3f3828');
  // crenellations
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i < 0 ? '#a59878' : '#6e634d';
    ctx.fillRect(i * 6 - 2.5, -60, 5, 7);
  }
  // masonry courses
  ctx.strokeStyle = 'rgba(60,45,25,0.35)'; ctx.lineWidth = 0.8;
  for (let yy = -8; yy > -50; yy -= 7) { ctx.beginPath(); ctx.ellipse(0, yy, 14, 4.5, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
  // bramble masses climbing the tower
  const blobs: [number, number, number][] = [[-11, -8, 11], [10, -14, 10], [-2, -20, 9], [-10, -30, 10], [10, -34, 10], [0, -42, 9], [-8, -52, 9], [8, -56, 8], [0, -62, 7], [-15, -42, 6], [15, -46, 6]];
  for (const [bx, by, r] of blobs) {
    ctx.fillStyle = litGrad(ctx, bx - r, by - r, bx + r, by + r, '#a3a752', '#4b5a2a', '#1a230e');
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    dab(ctx, bx - r * 0.35, by - r * 0.4, r * 0.28, 'rgba(210,205,120,0.45)');
  }
  // thorns
  ctx.strokeStyle = P.leafDark; ctx.lineWidth = 1.4;
  for (const [tx, ty, a] of [[-14, -54, -2.4], [12, -62, -0.7], [0, -66, -1.6], [15, -34, 0.1], [-17, -24, 3.1]]) {
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a) * 8, ty + Math.sin(a) * 8); ctx.stroke();
  }
  // berries catching the light
  for (const [bx, by] of [[5, -16], [-9, -33], [9, -43], [-2, -55]]) {
    ctx.fillStyle = P.oxblood; ctx.beginPath(); ctx.arc(bx, by, 2.3, 0, Math.PI * 2); ctx.fill();
    dab(ctx, bx - 0.7, by - 0.8, 0.8, 'rgba(255,230,210,0.9)');
  }
  void time;
}

function ember(ctx: CanvasRenderingContext2D, time: number) {
  // bottle kiln in brick
  ctx.fillStyle = litGrad(ctx, -24, 0, 24, 0, P.brickLight, P.brick, P.brickDark);
  ctx.beginPath();
  ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-30, -26, -10, -42); ctx.lineTo(-7, -62); ctx.lineTo(7, -62);
  ctx.lineTo(10, -42); ctx.quadraticCurveTo(30, -26, 22, 0); ctx.ellipse(0, 0, 22, 7, 0, 0, Math.PI); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,12,6,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  // brick courses
  ctx.strokeStyle = 'rgba(40,15,8,0.35)'; ctx.lineWidth = 0.8;
  for (let yy = -5; yy > -40; yy -= 5) {
    const w = yy > -26 ? 22 + (yy + 26) * 0.05 : 10 + (yy + 42) * 0.7;
    ctx.beginPath(); ctx.moveTo(-w, yy); ctx.quadraticCurveTo(0, yy + 2.5, w, yy); ctx.stroke();
  }
  // rim
  ctx.fillStyle = P.brickDark; ctx.beginPath(); ctx.ellipse(0, -62, 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  // glowing mouth
  const glow = 0.7 + 0.3 * Math.sin(time * 6);
  const g = ctx.createRadialGradient(0, -8, 1, 0, -8, 12);
  g.addColorStop(0, `rgba(255,${200 + 40 * glow},120,1)`); g.addColorStop(0.6, 'rgba(230,110,30,0.95)'); g.addColorStop(1, 'rgba(120,30,10,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -9, 8, Math.PI, 0); ctx.lineTo(8, 0); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
  // warm light spilling on the ground
  const spill = ctx.createRadialGradient(0, 2, 2, 0, 2, 26);
  spill.addColorStop(0, `rgba(255,170,60,${0.35 * glow})`); spill.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = spill; ctx.beginPath(); ctx.ellipse(0, 4, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  // smoke
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.5 + i / 3) % 1;
    ctx.fillStyle = `rgba(120,110,100,${0.35 * (1 - t)})`;
    ctx.beginPath(); ctx.arc(5 * Math.sin(t * 6), -66 - t * 30, 4 + t * 8, 0, Math.PI * 2); ctx.fill();
  }
}

function bell(ctx: CanvasRenderingContext2D) {
  // slender brick tower with white stone dressing
  ctx.fillStyle = litGrad(ctx, -11, 0, 11, 0, P.brickLight, P.brick, P.brickDark);
  ctx.fillRect(-11, -52, 22, 52);
  ctx.strokeStyle = 'rgba(30,12,6,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(-11, -52, 22, 52);
  ctx.fillStyle = P.cream; ctx.fillRect(-12, -54, 24, 4); ctx.fillRect(-12, -22, 24, 3);
  // belfry arch with gold bell
  ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(-6, -40); ctx.arc(0, -40, 6, Math.PI, 0); ctx.lineTo(6, -26); ctx.closePath(); ctx.fill();
  const bg = ctx.createLinearGradient(-5, -40, 5, -28); bg.addColorStop(0, P.goldLight); bg.addColorStop(1, '#7a5a18');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-5, -29); ctx.quadraticCurveTo(-5, -40, 0, -40); ctx.quadraticCurveTo(5, -40, 5, -29); ctx.closePath(); ctx.fill();
  // Dutch spire in slate with a gilt weathervane
  ctx.fillStyle = litGrad(ctx, -13, -60, 13, -60, P.slateLight, P.slate, '#1e2024');
  ctx.beginPath(); ctx.moveTo(-13, -54); ctx.lineTo(-6, -66); ctx.lineTo(0, -92); ctx.lineTo(6, -66); ctx.lineTo(13, -54); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  ctx.strokeStyle = P.gold; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(0, -100); ctx.stroke();
  ctx.fillStyle = P.goldLight; ctx.beginPath(); ctx.moveTo(0, -100); ctx.lineTo(8, -98); ctx.lineTo(0, -96); ctx.fill();
  // windows
  ctx.fillStyle = '#1a120a'; ctx.fillRect(-3, -14, 6, 8);
}

function verdigris(ctx: CanvasRenderingContext2D, time: number) {
  // stone pedestal
  ctx.fillStyle = litGrad(ctx, -9, 0, 9, 0, P.stoneLight, P.stone, P.stoneDark);
  ctx.fillRect(-8, -30, 16, 30);
  ctx.fillRect(-12, -34, 24, 5);
  // copper font with patina
  ctx.fillStyle = litGrad(ctx, -22, -50, 22, -34, P.verdigrisLight, P.verdigris, '#21493f');
  ctx.beginPath(); ctx.moveTo(-22, -50); ctx.quadraticCurveTo(-20, -32, 0, -33); ctx.quadraticCurveTo(20, -32, 22, -50); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(15,35,30,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  // bare copper rim
  ctx.fillStyle = litGrad(ctx, -22, -52, 22, -48, '#e6a56c', P.copper, '#5e3418');
  ctx.beginPath(); ctx.ellipse(0, -50, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f4a40'; ctx.beginPath(); ctx.ellipse(0, -50, 18, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  // drips
  ctx.fillStyle = P.verdigrisLight;
  for (const dx of [-14, -3, 9]) { ctx.beginPath(); ctx.ellipse(dx, -40 + (dx % 5), 1.4, 3.4, 0, 0, Math.PI * 2); ctx.fill(); }
  // vapour
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.4 + i / 3) % 1;
    ctx.fillStyle = `rgba(150,220,190,${0.35 * (1 - t)})`;
    ctx.beginPath(); ctx.arc(-6 + i * 6 + 3 * Math.sin(t * 5 + i), -54 - t * 22, 3 + t * 5, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Enemies ─────────────────────────────────────────────────────────────────

export interface EnemyLook { kneel?: boolean; alpha?: number; marked?: boolean }

export function drawEnemy(ctx: CanvasRenderingContext2D, type: EnemyType, x: number, y: number, dir: number, bob: number, hit: number, k = 1, look: EnemyLook = {}) {
  ctx.save();
  ctx.globalAlpha = look.alpha ?? 1;
  ctx.translate(x, y + Math.sin(bob) * 1.1);
  ctx.scale(k, k);
  if (type === 'levy') levy(ctx, dir, bob, false);
  else if (type === 'bearer') levy(ctx, dir, bob, true);
  else if (type === 'hound') hound(ctx, dir, bob);
  else cairn(ctx, dir, bob, !!look.kneel);
  if (hit > 0) {
    // a flash of light on the figure
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,240,200,${Math.min(0.5, hit * 3)})`;
    const r = type === 'cairn' ? 30 : 12;
    ctx.beginPath(); ctx.ellipse(0, type === 'cairn' ? -30 : -8, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function levy(ctx: CanvasRenderingContext2D, dir: number, bob: number, bearer: boolean) {
  softShadow(ctx, 3, 9, 11, 3.5, 0.5);
  ctx.save(); ctx.scale(dir, 1);
  // legs mid-stride
  const st = Math.sin(bob * 2) * 2.5;
  ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2, 2); ctx.lineTo(-3 - st, 9); ctx.moveTo(2, 2); ctx.lineTo(3 + st, 9); ctx.stroke();
  // jerkin
  ctx.fillStyle = litGrad(ctx, -7, -12, 7, 4, '#9b8358', '#6b5636', '#3a2d1a');
  ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-7, -9); ctx.quadraticCurveTo(0, -14, 7, -9); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
  if (bearer) {
    // oxblood sash marks the bearer
    ctx.strokeStyle = P.oxblood; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(6, 1); ctx.stroke();
  }
  // face and kettle helmet
  ctx.fillStyle = '#c89a76'; ctx.beginPath(); ctx.arc(0, -15, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = litGrad(ctx, -7, -21, 7, -15, '#a7a49a', '#5d5a54', '#2a2826');
  ctx.beginPath(); ctx.ellipse(0, -17, 7.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -18, 4.4, Math.PI, 0); ctx.fill();
  dab(ctx, -2, -20, 1.2, 'rgba(255,250,230,0.8)');
  if (!bearer) {
    // spear
    ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(-5, -30); ctx.stroke();
    ctx.fillStyle = '#c8c4b8'; ctx.beginPath(); ctx.moveTo(-5, -35); ctx.lineTo(-3, -29); ctx.lineTo(-7, -29); ctx.closePath(); ctx.fill();
    // reed shield, carried forward, with the white flood line
    ctx.fillStyle = litGrad(ctx, 3, -14, 12, 6, '#e6d391', P.straw, P.strawDark);
    ctx.beginPath(); ctx.moveTo(4, -13); ctx.quadraticCurveTo(13, -14, 13, -4); ctx.quadraticCurveTo(13, 6, 4, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,30,0.6)'; ctx.lineWidth = 0.7;
    for (let xx = 6; xx <= 12; xx += 2) { ctx.beginPath(); ctx.moveTo(xx, -12.5); ctx.lineTo(xx, 5.5); ctx.stroke(); }
    ctx.strokeStyle = '#f8f6ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(12.8, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,15,0.7)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(4, -13); ctx.quadraticCurveTo(13, -14, 13, -4); ctx.quadraticCurveTo(13, 6, 4, 6); ctx.stroke();
  } else {
    // the stolen name-stone, held up in both arms
    const sy = -12;
    ctx.strokeStyle = '#6b5636'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-8, -22 + sy); ctx.moveTo(6, -8); ctx.lineTo(8, -22 + sy); ctx.stroke();
    ctx.fillStyle = litGrad(ctx, -9, -34 + sy, 9, -20 + sy, '#d8d4c6', '#8d8a80', '#45433d');
    ctx.beginPath(); ctx.moveTo(-9, -22 + sy); ctx.lineTo(-8, -33 + sy); ctx.quadraticCurveTo(0, -38 + sy, 8, -33 + sy); ctx.lineTo(9, -22 + sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(240,210,120,0.95)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-3, -31 + sy); ctx.lineTo(0, -25 + sy); ctx.lineTo(3, -31 + sy); ctx.moveTo(0, -25 + sy); ctx.lineTo(0, -22.5 + sy); ctx.stroke();
  }
  ctx.restore();
  if (bearer) {
    // a gilt marker hovering over the bearer so it reads at a glance
    ctx.fillStyle = P.goldLight; ctx.strokeStyle = '#6b4c12'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(4, -57); ctx.lineTo(0, -52); ctx.lineTo(-4, -57); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function hound(ctx: CanvasRenderingContext2D, dir: number, bob: number) {
  softShadow(ctx, 2, 7, 20, 4, 0.55);
  ctx.save(); ctx.scale(dir, 1);
  const st = Math.sin(bob * 2.4) * 3;
  // legs
  ctx.strokeStyle = '#0e0c0a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 0); ctx.lineTo(13 + st, 8); ctx.moveTo(7, 0); ctx.lineTo(5 - st, 8);
  ctx.moveTo(-9, 0); ctx.lineTo(-7 + st, 8); ctx.moveTo(-12, 0); ctx.lineTo(-15 - st, 8);
  ctx.stroke();
  // lean black body with a dull sheen along the back
  ctx.fillStyle = litGrad(ctx, 0, -12, 0, 4, '#4a4640', '#1c1a17', '#080706');
  ctx.beginPath();
  ctx.moveTo(-20, -7); ctx.quadraticCurveTo(-26, -12, -28, -9); // tail
  ctx.quadraticCurveTo(-22, -8, -16, -5);
  ctx.quadraticCurveTo(-4, -11, 10, -7);
  ctx.lineTo(14, -13); ctx.lineTo(16, -8); // ear
  ctx.lineTo(25, -6); ctx.lineTo(22, -2); ctx.lineTo(13, 0);
  ctx.quadraticCurveTo(0, 3, -15, 1); ctx.closePath();
  ctx.fill();
  dab(ctx, -4, -9, 4, 'rgba(160,150,130,0.25)');
  // bronze burial collar
  ctx.strokeStyle = litGrad(ctx, 8, -9, 13, -2, '#f0c27a', '#b5833f', '#5e3d14') as unknown as string;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(9, -9); ctx.lineTo(11.5, -1); ctx.stroke();
  ctx.fillStyle = '#e3b05f'; ctx.beginPath(); ctx.arc(11.5, 0, 1.5, 0, Math.PI * 2); ctx.fill();
  // pale eye
  ctx.fillStyle = '#d9e8c0'; ctx.beginPath(); ctx.arc(18, -7, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function cairn(ctx: CanvasRenderingContext2D, dir: number, bob: number, kneel: boolean) {
  softShadow(ctx, 6, 10, 38, 10, 0.6);
  ctx.save(); ctx.scale(dir, 1);
  const lower = kneel ? 16 : 0;
  const stone = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    ctx.fillStyle = litGrad(ctx, x - rx, y - ry, x + rx, y + ry, '#b6b2a4', '#7c7a70', '#3a3934');
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,16,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  };
  const st = kneel ? 0 : Math.sin(bob * 1.2) * 3;
  // legs
  if (kneel) { stone(-12, 4, 13, 7, 0.2); stone(14, 2, 12, 8, -0.3); }
  else { stone(-10, -2 + st, 8, 12); stone(10, -2 - st, 8, 12); }
  // torso of piled boulders
  stone(0, -34 + lower, 26, 22);
  stone(-14, -52 + lower, 12, 9, 0.4);
  stone(15, -51 + lower, 12, 9, -0.4);
  // moss on the shoulders
  ctx.fillStyle = 'rgba(95,110,50,0.8)';
  ctx.beginPath(); ctx.ellipse(-16, -57 + lower, 7, 3, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, -56 + lower, 5, 2.4, -0.4, 0, Math.PI * 2); ctx.fill();
  // arms
  stone(-27, -28 + lower + (kneel ? 14 : st), 7, 16, 0.15);
  stone(27, -28 + lower + (kneel ? 14 : -st), 7, 16, -0.15);
  // head
  stone(2, -66 + lower, 9, 8);
  ctx.fillStyle = 'rgba(255,190,90,0.85)';
  ctx.fillRect(3, -68 + lower, 5, 1.6);
  // the empty recess where its name-stone belongs
  const rg = ctx.createRadialGradient(0, -34 + lower, 1, 0, -34 + lower, 10);
  rg.addColorStop(0, '#000'); rg.addColorStop(0.7, '#141210'); rg.addColorStop(1, 'rgba(40,38,34,0.9)');
  ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(-8, -26 + lower); ctx.lineTo(-7, -40 + lower); ctx.quadraticCurveTo(0, -45 + lower, 7, -40 + lower); ctx.lineTo(8, -26 + lower); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** The fallen name-stone lying on the road. */
export function drawNameStone(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.save(); ctx.translate(x, y);
  softShadow(ctx, 2, 4, 12, 4, 0.5);
  ctx.fillStyle = litGrad(ctx, -9, -16, 9, 2, '#d8d4c6', '#8d8a80', '#45433d');
  ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-8, -12); ctx.quadraticCurveTo(0, -17, 8, -12); ctx.lineTo(9, 2); ctx.closePath(); ctx.fill();
  const k = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.strokeStyle = `rgba(240,210,120,${k})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-3, -10); ctx.lineTo(0, -4); ctx.lineTo(3, -10); ctx.moveTo(0, -4); ctx.lineTo(0, -1); ctx.stroke();
  ctx.restore();
}

export function enemyIconCanvas(type: EnemyType, size = 44): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const k = type === 'cairn' ? size / 90 : type === 'hound' ? size / 60 : size / 52;
  drawEnemy(ctx, type, size / 2, type === 'cairn' ? size - 6 : size * 0.72, 1, 0, 0, k);
  return cv;
}

export function towerIconCanvas(type: TowerType, size = 48): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawTowerIcon(ctx, type, size / 2, size - 6, size / 104);
  return cv;
}
