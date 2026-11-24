// The six boss pathogens, one per organ. Drawn at about three times a normal pathogen's size,
// each with a pulsing aura so it reads as a boss at a glance.
import type { BossType } from './config';
import { inkSprite } from './ink';

const INK = '#2a1e18';

function aura(ctx: CanvasRenderingContext2D, r: number, t: number, col: string) {
  const k = 1 + Math.sin(t * 4) * 0.08;
  const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6 * k);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6 * k, 0, Math.PI * 2); ctx.fill();
}

/** A boss's animation repeats every LOOP seconds, so its inked frames (PHASES of them) are made once and reused. */
const LOOP = Math.PI * 4, PHASES = 64;

/** A boss, inked. The frame is chosen by where it is in its animation loop; the boss is turned to face its way and
 *  a hit flashes over it, so neither needs frames of its own. */
export function drawBoss(ctx: CanvasRenderingContext2D, type: BossType, x: number, y: number, angle: number, hit: number, scale: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(angle);
  const phase = Math.floor(((((t % LOOP) + LOOP) % LOOP) / LOOP) * PHASES) % PHASES, tq = (phase / PHASES) * LOOP;
  inkSprite(ctx, `boss:${type}:${phase}`, 66, (c) => drawBossColour(c, type, 0, 0, 0, 0, 1, tq), { gap: 2.2, lw: 0.36, wash: 0.5 }, 2);
  if (hit > 0) { ctx.globalAlpha = Math.min(1, hit / 0.15) * 0.45; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawBossColour(ctx: CanvasRenderingContext2D, type: BossType, x: number, y: number, angle: number, hit: number, scale: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const flash = hit > 0;
  if (type === 'necrotizer') {
    // necrotising fasciitis: chains of S. pyogenes tearing through a ragged, darkened patch of tissue
    aura(ctx, 34, t, 'rgba(160,40,30,0.4)');
    const rag = () => { ctx.beginPath(); for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, r = 32 + (i % 2 ? -5 : 3) + Math.sin(a * 3 + t * 2) * 2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    const g = ctx.createRadialGradient(-6, -6, 4, 0, 0, 36); g.addColorStop(0, '#e8a090'); g.addColorStop(0.6, '#a8403a'); g.addColorStop(1, '#4a1a18');
    rag(); ctx.fillStyle = flash ? '#ffffff' : g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    // dead (necrotic) blotches
    ctx.fillStyle = 'rgba(40,20,15,0.55)';
    for (const [x, y, r] of [[-10, 8, 7], [12, -10, 5], [6, 14, 4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    // chains of cocci winding through it
    for (let c = 0; c < 4; c++) {
      ctx.save(); ctx.rotate(c * 1.6 + t * 0.5);
      for (let i = 0; i < 6; i++) { const x = -18 + i * 6.5, y = Math.sin(i * 0.9 + c) * 4 + 6; ctx.fillStyle = flash ? '#ffffff' : '#f0b0a8'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    }
  } else if (type === 'herpes') {
    // herpes simplex: a hexagonal (icosahedral) capsid in a thick tegument, inside a spiked envelope
    aura(ctx, 32, t, 'rgba(120,70,160,0.35)');
    ctx.rotate(t * 0.5);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * 37, Math.sin(a) * 37); ctx.stroke(); }
    const env = ctx.createRadialGradient(-8, -8, 3, 0, 0, 32); env.addColorStop(0, '#f0e0f6'); env.addColorStop(1, '#a888c0');
    ctx.fillStyle = flash ? '#ffffff' : env; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(200,170,220,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); // tegument
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); } ctx.closePath();
    ctx.fillStyle = flash ? '#ffffff' : '#7a5a9a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(240,220,250,0.7)'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke(); }
    // its DNA, coiled inside
    ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let k = 0; k < 40; k++) { const a = k * 0.5, r = 2 + k * 0.2; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(2, 0); } ctx.stroke();
  } else if (type === 'hiv') {
    // HIV: a round virion studded with knobbed spikes (gp120), a cone-shaped capsid inside holding its RNA
    aura(ctx, 32, t, 'rgba(110,60,150,0.4)');
    ctx.rotate(t * 0.5);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#c8a0e0'; ctx.beginPath(); ctx.arc(Math.cos(a) * 38, Math.sin(a) * 38, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    }
    const g = ctx.createRadialGradient(-8, -8, 3, 0, 0, 30); g.addColorStop(0, '#ecdcf6'); g.addColorStop(0.7, '#a880c8'); g.addColorStop(1, '#5a3a7a');
    ctx.fillStyle = flash ? '#ffffff' : g; ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    // the matrix just inside the envelope
    ctx.strokeStyle = 'rgba(60,30,90,0.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // the cone-shaped capsid, and two strands of RNA within it
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(13, -11); ctx.lineTo(15, 9); ctx.lineTo(-14, 5); ctx.closePath();
    ctx.fillStyle = flash ? '#ffffff' : '#e8c46a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = '#8a2a4a'; ctx.lineWidth = 1.4;
    for (const dy of [-2, 2]) { ctx.beginPath(); for (let x = -10; x <= 11; x += 1.5) { const y = dy + Math.sin(x * 0.9 + dy) * 1.5; x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  } else if (type === 'burrower') {
    // an H. pylori swarm: curved rods crowded in a blob of mucus, a drill-like spiral at its front
    aura(ctx, 34, t, 'rgba(160,150,50,0.35)');
    ctx.rotate(angle);
    const blob = () => { ctx.beginPath(); for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI * 2, r = 33 + Math.sin(a * 5 + t * 3) * 2.5 + Math.sin(a * 2) * 3; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    const mg = ctx.createRadialGradient(-6, -6, 3, 0, 0, 36); mg.addColorStop(0, '#f4f0c8'); mg.addColorStop(1, '#c8c070');
    blob(); ctx.fillStyle = flash ? '#ffffff' : mg; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    // the swarm: curved rods at every angle
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996, r = 6 + Math.sqrt(i / 16) * 20, x = Math.cos(a) * r, y = Math.sin(a) * r, o = a * 1.7;
      ctx.save(); ctx.translate(x, y); ctx.rotate(o);
      const c = () => { ctx.beginPath(); ctx.moveTo(-5, 1.5); ctx.bezierCurveTo(-2, -3, 2, 3, 5, -1.5); };
      c(); ctx.strokeStyle = INK; ctx.lineWidth = 4.6; ctx.stroke();
      c(); ctx.strokeStyle = flash ? '#ffffff' : '#b8a838'; ctx.lineWidth = 2.8; ctx.stroke();
      ctx.restore();
    }
    // a spiral drill at the front, turning
    ctx.save(); ctx.translate(36, 0); ctx.rotate(t * 6);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); for (let k = 0; k < 30; k++) { const a = k * 0.5, r = 1 + k * 0.28; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); } ctx.stroke();
    ctx.restore();
  } else if (type === 'granuloma') {
    // a tuberculous granuloma: a cheesy (caseous) core full of acid-fast rods, ringed by a Langhans giant cell
    // with its horseshoe of nuclei, palisades of epithelioid cells, and a cuff of small dark lymphocytes
    aura(ctx, 34, t, 'rgba(150,70,60,0.35)');
    ctx.rotate(angle * 0.15);
    const R = 36;
    ctx.fillStyle = flash ? '#ffffff' : '#c8a098'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // the lymphocyte cuff
    ctx.fillStyle = '#4a3a6a';
    for (let i = 0; i < 46; i++) { const a = i * 2.39996, r = R - 3 - (i % 3) * 1.6; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2); ctx.fill(); }
    // epithelioid cells: long pale cells standing like a palisade around the core
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      ctx.save(); ctx.rotate(a); ctx.translate(24, 0);
      ctx.fillStyle = flash ? '#ffffff' : '#ecc8bc'; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a4a6a'; ctx.beginPath(); ctx.ellipse(0.5, 0, 2.4, 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // the caseous core
    const cg = ctx.createRadialGradient(-3, -3, 2, 0, 0, 17);
    cg.addColorStop(0, '#fbf0d0'); cg.addColorStop(1, '#e8d49a');
    ctx.fillStyle = flash ? '#ffffff' : cg; ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    // a Langhans giant cell: nuclei in a horseshoe
    ctx.fillStyle = '#5a3a7a';
    for (let i = 0; i < 9; i++) { const a = 2.2 + i * 0.26; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 2, 1.4, a, 0, Math.PI * 2); ctx.fill(); }
    // acid-fast rods: small red-pink strokes scattered in the core
    ctx.strokeStyle = '#c0405a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * 1.7, r = 3 + (i % 4) * 2.2, x = Math.cos(a) * r, y = Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(x - 2.4, y - 0.8); ctx.lineTo(x + 2.4, y + 0.8); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
  } else if (type === 'plasmodium') {
    // malaria: an infected red blood cell, its rim scalloped (crenated) and stippled with Maurer's dots,
    // the parasite inside as a ring form with a chromatin dot, and a second, younger ring
    aura(ctx, 32, t, 'rgba(160,40,90,0.35)');
    ctx.rotate(angle * 0.2);
    const rim = () => { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, r = 32 + Math.sin(a * 9) * 0.6; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    const rbc = ctx.createRadialGradient(-8, -8, 4, 0, 0, 34);
    rbc.addColorStop(0, '#f6a090'); rbc.addColorStop(0.65, '#c8443a'); rbc.addColorStop(1, '#8a2420');
    rim(); ctx.fillStyle = flash ? '#ffffff' : rbc; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    if (!flash) {
      // the pale biconcave centre
      const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 18); cg.addColorStop(0, 'rgba(255,220,210,0.75)'); cg.addColorStop(1, 'rgba(255,220,210,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      // Maurer's dots: fine stippling over the cell
      ctx.fillStyle = 'rgba(120,30,40,0.55)';
      for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 8 + Math.sqrt(i / 26) * 20; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.9, 0, Math.PI * 2); ctx.fill(); }
    }
    // the main ring form: blue cytoplasm ring, thickest opposite its chromatin dot
    ctx.strokeStyle = '#3a4aa8'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.arc(6, -4, 11, 0.6, 5.6); ctx.stroke();
    ctx.lineWidth = 5.4; ctx.beginPath(); ctx.arc(6, -4, 11, 2.4, 3.8); ctx.stroke();
    ctx.fillStyle = '#8a1e5a'; ctx.beginPath(); ctx.arc(15.5, -7.5, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    // a younger ring
    ctx.strokeStyle = '#3a4aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-13, 12, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8a1e5a'; ctx.beginPath(); ctx.arc(-9, 9, 2, 0, Math.PI * 2); ctx.fill();
    // haemozoin pigment
    for (const [dx, dy] of [[-16, -6], [-4, 20], [18, 12]]) { ctx.fillStyle = 'rgba(70,40,20,0.7)'; ctx.beginPath(); ctx.arc(dx, dy, 1.6, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'colony') {
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
      if (!flash) {
        // the thick Gram-positive wall as a pale inner band, and the ribosome speckle
        ctx.strokeStyle = 'rgba(255,250,225,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(150,110,40,0.3)';
        for (let i = 0; i < 7; i++) { const a = i * 2.39996 + cx, r = 1.5 + (i % 3) * 2.2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    }
    // the capsule's slime, beaded at its edge
    ctx.fillStyle = 'rgba(160,140,90,0.45)';
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 38.5, Math.sin(a) * 32.5, 1.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'flu') {
    // a mother virus: a big spiked capsid, with buds of new virions on its surface
    aura(ctx, 30, t, 'rgba(138,74,184,0.45)');
    ctx.rotate(t * 0.5);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, ha = i % 3 !== 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 33, Math.sin(a) * 33); ctx.stroke();
      if (ha) {
        // haemagglutinin: a lollipop spike
        ctx.fillStyle = i % 2 ? '#ff7ab8' : '#ffd0e8'; ctx.beginPath(); ctx.arc(Math.cos(a) * 34.5, Math.sin(a) * 34.5, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        // neuraminidase: a box-headed spike
        ctx.save(); ctx.translate(Math.cos(a) * 34.5, Math.sin(a) * 34.5); ctx.rotate(a);
        ctx.fillStyle = '#f0c84a'; ctx.beginPath(); ctx.rect(-2.6, -3.6, 5.2, 7.2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 26); g.addColorStop(0, '#d8b0f0'); g.addColorStop(1, '#4a1e70');
    ctx.fillStyle = flash ? '#ffffff' : g; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2.6; ctx.stroke();
    // the eight genome segments, coiled inside the envelope
    if (!flash) {
      ctx.strokeStyle = 'rgba(255,200,240,0.7)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, cx = Math.cos(a) * 11, cy = Math.sin(a) * 11;
        ctx.beginPath(); for (let k = 0; k <= 10; k++) { const u = k / 10, r = 2.2 + Math.sin(u * 12) * 1.2; ctx.lineTo(cx + Math.cos(a) * (u * 8 - 4) - Math.sin(a) * r, cy + Math.sin(a) * (u * 8 - 4) + Math.cos(a) * r); } ctx.stroke();
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + i * 2.1, bud = 0.6 + 0.4 * Math.sin(t * 2 + i);
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
    // type IV pili bristling from the capsule
    ctx.strokeStyle = 'rgba(42,30,24,0.6)'; ctx.lineWidth = 1.1;
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.1, x = Math.cos(a) * 44.5, y = Math.sin(a) * 34.5, k = 1.12 + (i % 3) * 0.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x * k, y * k); ctx.stroke(); }
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
    ctx.save(); ctx.rotate(t * 0.5);
    const hex = (r: number) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
    const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 32); g.addColorStop(0, '#f6d08a'); g.addColorStop(0.6, '#d0862e'); g.addColorStop(1, '#7a4410');
    hex(32); ctx.fillStyle = flash ? '#ffffff' : g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); ctx.stroke(); }
    hex(14); ctx.fillStyle = '#5a2a10'; ctx.fill();
    if (!flash) {
      // capsomeres: the protein subunits tiling each face
      ctx.fillStyle = 'rgba(255,230,180,0.55)';
      for (let k = 0; k < 6; k++) for (const [u, v] of [[0.55, 0.2], [0.75, 0.12], [0.62, 0.4], [0.85, 0.32]]) {
        const a = (k / 6) * Math.PI * 2, b = ((k + 1) / 6) * Math.PI * 2;
        const x = Math.cos(a) * 32 * u + (Math.cos(b) - Math.cos(a)) * 32 * v, y = Math.sin(a) * 32 * u + (Math.sin(b) - Math.sin(a)) * 32 * v;
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#3a9a4a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = -t * 1.5 + i * (Math.PI / 2), r = 44, px = Math.cos(a) * r, py = Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py); ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke();
    }
  } else {
    // sepsis: a giant hijacker, barbed and spinning, in a blood-red haze
    aura(ctx, 34, t, 'rgba(160,20,30,0.55)');
    ctx.rotate(t * 1.5);
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
    if (!flash) {
      // the envelope's lipid texture and inner capsid outline
      ctx.strokeStyle = 'rgba(255,170,120,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(80,10,10,0.5)';
      for (let i = 0; i < 14; i++) { const a = i * 2.39996, r = 10 + (i % 4) * 2.5; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = '#1a0404'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
