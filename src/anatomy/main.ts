import './style.css';
import { CONFIG, TOTAL_WAVES, VESSEL_NAMES, type PathogenType, type VesselId } from './config';
import { W, H, VESSELS, VESSEL_IDS, nearestOnVessel } from './level';
import {
  type State, newGame, step, selectVessel, canStartWave, startWave, firePulse, pulseCheck, pulseTargets,
  aliveCells, wave, whenLabel,
} from './sim';
import { draw, drawPathogen, drawWhiteCell, vesselWidth, type View } from './draw';

let s: State = newGame();
const view: View = { hoverVessel: null, showPulseRadius: false, touch: matchMedia('(pointer: coarse)').matches };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const panel = $('panel');
const overlay = $('overlay');
const toastEl = $('toast');
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

let toastT = 0;
function toast(text: string) { toastEl.textContent = text; toastEl.classList.add('on'); toastT = 2.6; }

// ── Canvas sizing and input ─────────────────────────────────────────────────
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
}
new ResizeObserver(resize).observe(canvas);

function toMap(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
/** The vessel under a point, with a generous margin for fingers. */
function vesselAt(p: { x: number; y: number }): VesselId | null {
  let best: VesselId | null = null, bd = Infinity;
  for (const v of VESSEL_IDS) {
    const n = nearestOnVessel(VESSELS[v], p);
    const reach = vesselWidth(s, v) / 2 + (view.touch ? 40 : 24);
    if (n.d <= reach && n.d < bd) { bd = n.d; best = v; }
  }
  return best;
}

function choose(v: VesselId) {
  if (s.phase !== 'prep') { toast('Dilation is locked during a wave.'); return; }
  const had = s.dilated;
  selectVessel(s, v);
  if (had && had !== v) toast(`${VESSEL_NAMES[v]} dilated; the ${VESSEL_NAMES[had].toLowerCase()} relaxes.`);
  lastSig = '';
}

canvas.addEventListener('pointerdown', (e) => {
  const p = toMap(e);
  if (s.phase === 'prep') { const v = vesselAt(p); if (v) choose(v); }
  else if (s.phase === 'combat') { const v = vesselAt(p); if (v && v !== s.dilated) toast('Dilation is locked during a wave.'); }
});
canvas.addEventListener('pointermove', (e) => {
  const v = s.phase === 'prep' ? vesselAt(toMap(e)) : null;
  view.hoverVessel = v;
  canvas.style.cursor = v ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { view.hoverVessel = null; });

function pulse() {
  const c = pulseCheck(s);
  if (!c.ok) { if (c.reason) toast(c.reason); return; }
  const hits = firePulse(s);
  toast(hits > 0 ? `Immune pulse: ${hits} pathogen${hits === 1 ? '' : 's'} hit.` : 'Immune pulse fired, but nothing was close enough.');
  lastSig = '';
}

function restart() { const sp = s.speed; s = newGame(); s.speed = sp; lastSig = ''; toast('A fresh start: the heart is at full health.'); }
function togglePause() { if (s.phase === 'combat' || s.phase === 'prep' || s.phase === 'recall') { s.paused = !s.paused; lastSig = ''; } }

panel.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'dilate') choose(el.dataset.v as VesselId);
  if (a === 'start') { if (startWave(s)) lastSig = ''; }
  if (a === 'pulse') pulse();
});
panel.addEventListener('pointerover', (e) => { if ((e.target as HTMLElement).closest('[data-act=pulse]')) view.showPulseRadius = true; });
panel.addEventListener('pointerout', (e) => { if ((e.target as HTMLElement).closest('[data-act=pulse]')) view.showPulseRadius = false; });
panel.addEventListener('focusin', (e) => { view.showPulseRadius = !!(e.target as HTMLElement).closest('[data-act=pulse]'); });
panel.addEventListener('focusout', () => { view.showPulseRadius = false; });
overlay.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (a?.dataset.act === 'restart') restart();
  if (a?.dataset.act === 'resume') { s.paused = false; lastSig = ''; }
});
$('btnPause').addEventListener('click', togglePause);
$('btnSpeed').addEventListener('click', () => { s.speed = s.speed === 1 ? 2 : 1; });
$('btnRestart').addEventListener('click', restart);
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.key === '1' || e.key === 'l' || e.key === 'L') choose('left');
  else if (e.key === '2' || e.key === 'r' || e.key === 'R') choose('right');
  else if (e.key === 'Enter' && tag !== 'BUTTON' && s.phase === 'prep') { if (startWave(s)) lastSig = ''; }
  else if (e.key === ' ' && tag !== 'BUTTON' && s.phase === 'combat') { e.preventDefault(); pulse(); }
  else if (e.key === 'p' || e.key === 'P') togglePause();
});

// ── Panel, HUD and overlays ─────────────────────────────────────────────────
const icons = new Map<string, string>();
function icon(kind: PathogenType | 'cell', size = 36): string {
  const key = kind + size;
  if (!icons.has(key)) {
    const c = document.createElement('canvas'); const dpr = 2; c.width = size * dpr; c.height = size * dpr;
    const x = c.getContext('2d')!; x.scale(dpr, dpr);
    if (kind === 'cell') drawWhiteCell(x, size / 2, size / 2, 0, 0, size / 60);
    else drawPathogen(x, kind, size / 2, size / 2, 0, 0, kind === 'bacterium' ? size / 40 : size / 30);
    icons.set(key, c.toDataURL());
  }
  return `<img class="ico" alt="" width="${size}" height="${size}" src="${icons.get(key)}">`;
}

let lastSig = '';
function signature() {
  return JSON.stringify([s.phase, s.paused, s.wave, s.dilated, s.pulsesLeft, aliveCells(s).length, s.phase === 'combat' ? pulseTargets(s).length : 0]);
}

function previewHtml(): string {
  const def = wave(s);
  return VESSEL_IDS.map((v) => {
    const groups = def.groups.filter((g) => g.vessel === v).sort((a, b) => a.start - b.start);
    const rows = groups.length
      ? groups.map((g) => `<li>${icon(g.type, 28)}<span><b>${g.count} ${g.count > 1 ? CONFIG.pathogens[g.type].plural.toLowerCase() : CONFIG.pathogens[g.type].name.toLowerCase()}</b> <small>${whenLabel(g.start)}${g.type === 'virus' ? ', fast, grouped' : ', slow, tough'}</small></span></li>`).join('')
      : '<li class="none">Nothing this wave</li>';
    return `<div class="lane lane-${v} ${s.dilated === v ? 'on' : ''}"><h4>${VESSEL_NAMES[v]}</h4><ul>${rows}</ul></div>`;
  }).join('');
}

function renderPanel() {
  const def = wave(s);
  let h = '';
  if (s.phase === 'prep') {
    const c = canStartWave(s);
    h = `<h2><small>Prepare · wave ${s.wave} of ${TOTAL_WAVES}</small>${esc(def.title)}</h2>
      <p class="hint">${esc(def.hint)}</p>
      ${s.message ? `<p class="notice">${esc(s.message)}</p>` : ''}
      <section class="card"><h3>Incoming threats</h3><div class="lanes">${previewHtml()}</div></section>
      <section class="card"><h3>Dilate vessel</h3>
        <p class="hint">Choose exactly one. White cells can only travel along the dilated vessel, and the immune pulse only works there. The other vessel relies on its lymph node.</p>
        <div class="choice">${VESSEL_IDS.map((v) => `<button data-act="dilate" data-v="${v}" aria-pressed="${s.dilated === v}" class="${s.dilated === v ? 'on' : ''}">${VESSEL_NAMES[v]}<small>${s.dilated === v ? 'dilated' : 'resting'}</small></button>`).join('')}</div>
        <p class="hint small">Click or tap a vessel on the map, or press 1 / 2.</p></section>
      <div class="start"><button data-act="start" class="primary" ${c.ok ? '' : 'disabled'}>Start wave ${s.wave}</button><p class="hint small">${c.ok ? 'Dilation locks once the wave begins.' : esc(c.reason)}</p></div>`;
  } else if (s.phase === 'combat') {
    const cells = aliveCells(s).length;
    const pc = pulseCheck(s);
    const would = pulseTargets(s).length;
    h = `<h2><small>Defend · wave ${s.wave} of ${TOTAL_WAVES}</small>${esc(def.title)}</h2>
      <section class="card"><h3>White cells <span class="count">${cells} of ${CONFIG.whiteCell.startingCount}</span></h3>
        <p class="cells">${Array.from({ length: CONFIG.whiteCell.startingCount }, (_, i) => `<span class="${i < cells ? '' : 'lost'}">${icon('cell', 30)}</span>`).join('')}</p>
        <p class="hint">Patrolling the ${esc(VESSEL_NAMES[s.dilated!].toLowerCase())}. They meet pathogens head-on and help its lymph node; they never leave this vessel.</p></section>
      <section class="card"><h3>Immune pulse <span class="count">${s.pulsesLeft} left</span></h3>
        <button data-act="pulse" class="pulse" ${pc.ok ? '' : 'disabled'}>${s.pulsesLeft > 0 ? 'Immune pulse' : 'Pulse used'}</button>
        <p class="hint">${s.pulsesLeft > 0 ? `A burst around each white cell, hitting pathogens on its vessel only. <b>Right now it would hit ${would}.</b> Best fired into a cluster. Space bar works too.` : 'One pulse per wave. It returns next wave.'}</p></section>`;
  } else if (s.phase === 'recall') {
    h = `<h2><small>Wave ${s.wave} cleared</small>Recalling white cells</h2><p class="hint">Survivors return to the heart, then the vessel contracts to its resting width.</p>`;
  } else {
    h = `<h2><small>${s.phase === 'victory' ? 'Level one complete' : 'The heart has stopped'}</small>${s.phase === 'victory' ? 'The heart is safe' : 'Defeat'}</h2><div class="start"><button data-act="restart" class="primary" onclick="">Restart</button></div>`;
  }
  panel.innerHTML = h;
  panel.querySelector('[data-act=restart]')?.addEventListener('click', restart);
}

function renderHud() {
  $('hp').textContent = `${s.heartHp}/${CONFIG.heartHp}`;
  $('hpbar').style.width = `${(s.heartHp / CONFIG.heartHp) * 100}%`;
  $('wave').textContent = `${Math.min(s.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`;
  $('cells').textContent = s.phase === 'combat' || s.phase === 'recall' ? `${aliveCells(s).length}/${CONFIG.whiteCell.startingCount}` : `${CONFIG.whiteCell.startingCount} ready`;
  $('pulseStat').textContent = s.phase === 'combat' ? (s.pulsesLeft > 0 ? 'Ready' : 'Used') : s.phase === 'prep' ? 'Next wave' : '—';
  $('btnPause').textContent = s.paused ? 'Resume' : 'Pause';
  $('btnSpeed').textContent = `Speed ×${s.speed}`;
  document.body.dataset.phase = s.phase;
}

let overlaySig = '';
function renderOverlay() {
  const sig = `${s.phase}|${s.paused}`;
  if (sig === overlaySig) return;
  overlaySig = sig;
  if (s.phase === 'victory') {
    overlay.hidden = false; overlay.className = 'victory';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Level one</p><h2>The heart is safe</h2><p>Heart health ${s.heartHp}/${CONFIG.heartHp} · ${s.killed} pathogens destroyed</p><button data-act="restart" class="primary">Play again</button></div>`;
  } else if (s.phase === 'defeat') {
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Wave ${s.wave}</p><h2>The heart has stopped</h2><p>Too many pathogens reached the heart. Try dilating the vessel under more pressure, and save the pulse for a cluster.</p><button data-act="restart" class="primary">Restart</button></div>`;
  } else if (s.paused) {
    overlay.hidden = false; overlay.className = 'paused';
    overlay.innerHTML = `<div class="plate"><h2>Paused</h2><button data-act="resume" class="primary">Resume</button> <button data-act="restart">Restart</button></div>`;
  } else { overlay.hidden = true; overlay.innerHTML = ''; }
}

function refresh(now: number) {
  const sig = signature();
  if (sig !== lastSig) { lastSig = sig; renderPanel(); }
  renderHud();
  renderOverlay();
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  draw(ctx, s, view, now / 1000);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!s.paused) for (let i = 0; i < s.speed; i++) step(s, dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  refresh(now);
  requestAnimationFrame(frame);
}
resize();
refresh(performance.now());
requestAnimationFrame(frame);

// Hooks for automated checks (harmless in play).
Object.assign(window, {
  __heart: () => s,
  __advance: (sec: number) => { for (let t = 0; t < sec && !s.paused; t += 1 / 30) step(s, 1 / 30); refresh(performance.now()); return { phase: s.phase, wave: s.wave, hp: s.heartHp }; },
  __refresh: () => refresh(performance.now()),
});
