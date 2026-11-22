// The five boss pathogens, one per organ. Drawn at about three times a normal pathogen's size,
// each with a pulsing aura so it reads as a boss at a glance.
import type { BossType } from './config';

const INK = '#2a1e18';

function aura(ctx: CanvasRenderingContext2D, r: number, t: number, col: string) {
  const k = 1 + Math.sin(t * 4) * 0.08;
  const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6 * k);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6 * k, 0, Math.PI * 2); ctx.fill();
}

export function drawBoss(ctx: CanvasRenderingContext2D, type: BossType, x: number, y: number, angle: number, hit: number, scale: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const flash = hit > 0;
  if (type === 'colony') {
    // Staphylococcus: a golden grape-bunch of cocci inside a thick capsule
    aura(ctx, 36, t, 'rgba(200,64,42,0.4)');
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(240,236,200,0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const cells: [number, number][] = [[0, 0], [-20, -8], [-14, 15], [8, 18], [21, 3], [13, -16], [-6, -21], [-26, 8], [26, -12]];
    for (const [cx, cy] of cells) {
      const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 12);
      g.addColorStop(0, '#fbe6a0'); g.addColorStop(0.6, '#e0b040'); g.addColorStop(1, '#8a6418');
      ctx.fillStyle = flash ? '#ffffff' : g; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    }
  } else if (type === 'flu') {
    // a mother virus: a big spiked capsid, with buds of new virions on its surface
    aura(ctx, 30, t, 'rgba(138,74,184,0.45)');
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke();
      ctx.fillStyle = i % 2 ? '#ff7ab8' : '#ffd0e8'; ctx.beginPath(); ctx.arc(Math.cos(a) * 35, Math.sin(a) * 35, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 26); g.addColorStop(0, '#d8b0f0'); g.addColorStop(1, '#4a1e70');
    ctx.fillStyle = flash ? '#ffffff' : g; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,240,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 4, i, i + 2.4); ctx.stroke(); }
    for (let i = 0; i < 3; i++) {
      const a = t * 1.3 + i * 2.1, bud = 0.6 + 0.4 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#b07ad8'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 7 * bud, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (type === 'meningo') {
    // Neisseria meningitidis: a diplococcus, two beans face to face in a heavy capsule
    aura(ctx, 32, t, 'rgba(184,52,58,0.4)');
    ctx.rotate(angle + Math.PI / 2);
    ctx.strokeStyle = 'rgba(250,245,235,0.95)'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 30, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 44.5, 34.5, 0, 0, Math.PI * 2); ctx.stroke();
    for (const sg of [-1, 1]) {
      const g = ctx.createRadialGradient(sg * 16 - 4, -6, 2, sg * 16, 0, 26); g.addColorStop(0, '#f0a0a0'); g.addColorStop(0.6, '#c8505a'); g.addColorStop(1, '#6a1e28');
      ctx.fillStyle = flash ? '#ffffff' : g;
      ctx.beginPath(); ctx.moveTo(sg * 3, -22); ctx.bezierCurveTo(sg * 40, -30, sg * 40, 30, sg * 3, 22); ctx.bezierCurveTo(sg * 9, 8, sg * 9, -8, sg * 3, -22); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = 'rgba(80,20,30,0.45)'; for (const dy of [-9, 0, 9]) { ctx.beginPath(); ctx.arc(sg * 20, dy, 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (type === 'hepatitis') {
    // a giant icosahedral virus, healing: green sparks of regrowth circle it
    aura(ctx, 32, t, 'rgba(78,160,82,0.45)');
    ctx.save(); ctx.rotate(t * 0.4);
    const hex = (r: number) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 32); g.addColorStop(0, '#f6d08a'); g.addColorStop(0.6, '#d0862e'); g.addColorStop(1, '#7a4410');
    hex(32); ctx.fillStyle = flash ? '#ffffff' : g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); ctx.stroke(); }
    hex(14); ctx.fillStyle = '#5a2a10'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3a9a4a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = -t * 1.5 + i * (Math.PI / 2), r = 44, px = Math.cos(a) * r, py = Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke();
    }
  } else {
    // sepsis: a giant hijacker, barbed and spinning, in a blood-red haze
    aura(ctx, 34, t, 'rgba(160,20,30,0.55)');
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 33 + Math.cos(a + 1.6) * 6, Math.sin(a) * 33 + Math.sin(a + 1.6) * 6); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.lineTo(Math.cos(a) * 33 - Math.cos(a + 1.6) * 6, Math.sin(a) * 33 - Math.sin(a + 1.6) * 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 24); g.addColorStop(0, '#ff9a6a'); g.addColorStop(0.6, '#b8302a'); g.addColorStop(1, '#4a0a0a');
    ctx.fillStyle = flash ? '#ffffff' : g;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.8; ctx.stroke();
    ctx.fillStyle = '#1a0404'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
