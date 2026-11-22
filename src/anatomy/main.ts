import './style.css';
import { CONFIG, TOTAL_WAVES, VESSEL_NAMES, NODE_TYPES, type NodeType, type PathogenType, type VesselId } from './config';
import { W, H, VESSELS, VESSEL_IDS, SITES, siteById, nearestOnVessel, dist } from './level';
import {
  type State, newGame, step, selectVessel, canStartWave, startWave, firePulse, pulseCheck, pulseTargets,
  aliveCells, wave, whenLabel, buildCheck, placeNode, nodeAt,
} from './sim';
import { draw, drawPathogen, drawWhiteCell, drawNodeIcon, vesselWidth, type View } from './draw';

let s: State = newGame();
const view: View = { hoverVessel: null, hoverSite: null, selectedSite: null, showPulseRadius: false, touch: matchMedia('(pointer: coarse)').matches };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const panel = $('panel');
const overlay = $('overlay');
const toastEl = $('toast');
const popover = $('popover');
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
function vesselAt(p: { x: number; y: number }): VesselId | null {
  let best: VesselId | null = null, bd = Infinity;
  for (const v of VESSEL_IDS) {
    const n = nearestOnVessel(VESSELS[v], p);
    const reach = vesselWidth(s, v) / 2 + (view.touch ? 40 : 24);
    if (n.d <= reach && n.d < bd) { bd = n.d; best = v; }
  }
  return best;
}
function siteAt(p: { x: number; y: number }): string | null {
  let best: string | null = null, bd = view.touch ? 52 : 40;
  for (const site of SITES) { const d = dist(p, site); if (d < bd) { bd = d; best = site.id; } }
  return best;
}

function choose(v: VesselId) {
  if (s.phase !== 'prep') { toast('Dilation is locked during a wave.'); return; }
  const had = s.dilated;
  selectVessel(s, v);
  if (had && had !== v) toast(`${VESSEL_NAMES[v]} dilated; the ${VESSEL_NAMES[had].toLowerCase()} relaxes.`);
  lastSig = '';
}

// ── Build popover ───────────────────────────────────────────────────────────
function openSite(id: string) {
  if (s.phase !== 'prep') { toast('Lymph nodes can only be placed between waves.'); return; }
  view.selectedSite = id;
  const site = siteById(id);
  const node = nodeAt(s, id);
  popover.style.left = `${(site.x / W) * 100}%`;
  popover.style.top = `${(site.y / H) * 100}%`;
  popover.classList.toggle('flip-x', site.x > W * 0.6);
  popover.classList.toggle('flip-y', site.y > H * 0.55);
  if (node) {
    const st = CONFIG.nodes[node.type];
    popover.innerHTML = `<button class="x" data-act="close" aria-label="Close">×</button><h3>${esc(st.name)}</h3><p class="sub">Guards the ${esc(VESSEL_NAMES[site.vessel].toLowerCase())}.</p><p>${esc(st.blurb)}</p><p class="sub">${st.damage} damage every ${st.cooldown}s${st.shred ? `, strips ${st.shred} armour for ${st.shredSeconds}s` : ''}${st.slow ? `, slows to ${Math.round(st.slow * 100)}% speed for ${st.slowSeconds}s` : ''}.</p>`;
  } else {
    popover.innerHTML = `<button class="x" data-act="close" aria-label="Close">×</button><h3>Place a lymph node</h3><p class="sub">Beside the ${esc(VESSEL_NAMES[site.vessel].toLowerCase())}. You have <b>${s.energy}</b> energy.</p>
      <div class="types">${NODE_TYPES.map((t) => { const st = CONFIG.nodes[t]; const c = buildCheck(s, id, t); return `<button data-act="build" data-type="${t}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason)}"><img alt="" src="${nodeIcon(t)}" width="44" height="34"><span><b>${esc(st.short)}</b> · ${st.cost} energy<small>${esc(st.blurb)}</small></span></button>`; }).join('')}</div>`;
  }
  popover.hidden = false;
  (popover.querySelector('button:not([disabled]):not(.x)') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
function closeSite() {
  if (popover.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  popover.hidden = true; view.selectedSite = null;
}
popover.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  if (el.dataset.act === 'close') closeSite();
  if (el.dataset.act === 'build' && view.selectedSite) {
    const type = el.dataset.type as NodeType;
    if (placeNode(s, view.selectedSite, type)) { toast(`${CONFIG.nodes[type].name} placed.`); closeSite(); lastSig = ''; }
  }
});

canvas.addEventListener('pointerdown', (e) => {
  const p = toMap(e);
  if (s.phase === 'prep') {
    const site = siteAt(p);
    if (site) { openSite(site); return; }
    closeSite();
    const v = vesselAt(p); if (v) choose(v);
  } else if (s.phase === 'combat') {
    const v = vesselAt(p); if (v && v !== s.dilated) toast('Dilation is locked during a wave.');
    if (siteAt(p)) toast('Lymph nodes can only be placed between waves.');
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = toMap(e);
  view.hoverSite = siteAt(p);
  view.hoverVessel = s.phase === 'prep' && !view.hoverSite ? vesselAt(p) : null;
  canvas.style.cursor = s.phase === 'prep' && (view.hoverSite || view.hoverVessel) ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { view.hoverVessel = null; view.hoverSite = null; });

function pulse() {
  const c = pulseCheck(s);
  if (!c.ok) { if (c.reason) toast(c.reason); return; }
  const hits = firePulse(s);
  toast(hits > 0 ? `Immune pulse: ${hits} pathogen${hits === 1 ? '' : 's'} hit.` : 'Immune pulse fired, but nothing was close enough.');
  lastSig = '';
}

function restart() { const sp = s.speed; s = newGame(); s.speed = sp; closeSite(); lastSig = ''; toast('A fresh start: the heart is at full health.'); }
function togglePause() { if (s.phase === 'combat' || s.phase === 'prep' || s.phase === 'recall') { s.paused = !s.paused; lastSig = ''; } }

panel.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'dilate') choose(el.dataset.v as VesselId);
  if (a === 'site') openSite(el.dataset.site!);
  if (a === 'start') { if (startWave(s)) { closeSite(); lastSig = ''; } }
  if (a === 'pulse') pulse();
  if (a === 'restart') restart();
});
panel.addEventListener('pointerover', (e) => { if ((e.target as HTMLElement).closest('[data-act=pulse]')) view.showPulseRadius = true; const site = (e.target as HTMLElement).closest('[data-site]') as HTMLElement | null; view.hoverSite = site?.dataset.site ?? view.hoverSite; });
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
  const keyVessel: Record<string, VesselId> = { '1': 'left', '2': 'right', '3': 'lower', '4': 'upper' };
  if (keyVessel[e.key]) choose(keyVessel[e.key]);
  else if (e.key === 'Escape') closeSite();
  else if (e.key === 'Enter' && tag !== 'BUTTON' && s.phase === 'prep') { if (startWave(s)) { closeSite(); lastSig = ''; } }
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
    else drawPathogen(x, kind, size / 2, size / 2, 0, 0, kind === 'bacterium' ? size / 44 : size / 36);
    icons.set(key, c.toDataURL());
  }
  return `<img class="ico" alt="" width="${size}" height="${size}" src="${icons.get(key)}">`;
}
function nodeIcon(t: NodeType): string {
  const key = 'node-' + t;
  if (!icons.has(key)) {
    const c = document.createElement('canvas'); c.width = 88; c.height = 68;
    const x = c.getContext('2d')!; x.scale(2, 2); drawNodeIcon(x, t, 22, 18, 0.48);
    icons.set(key, c.toDataURL());
  }
  return icons.get(key)!;
}

let lastSig = '';
function signature() {
  return JSON.stringify([s.phase, s.paused, s.wave, s.dilated, s.pulsesLeft, s.energy, s.nodes.length, aliveCells(s).length, s.infections, s.phase === 'combat' ? pulseTargets(s).length : 0]);
}

function previewHtml(): string {
  const def = wave(s);
  return VESSEL_IDS.map((v) => {
    const groups = def.groups.filter((g) => g.vessel === v).sort((a, b) => a.start - b.start);
    if (!groups.length) return '';
    const rows = groups.map((g) => {
      const st = CONFIG.pathogens[g.type];
      const traits = g.type === 'bacterium' ? 'slow, armoured' : g.type === 'virus' ? 'fast, grouped' : 'infects white cells';
      return `<li>${icon(g.type, 28)}<span><b>${g.count} ${(g.count > 1 ? st.plural : st.name).toLowerCase()}</b> <small>${whenLabel(g.start)}, ${traits}</small></span></li>`;
    }).join('');
    return `<div class="lane ${s.dilated === v ? 'on' : ''}"><h4>${VESSEL_NAMES[v]}</h4><ul>${rows}</ul></div>`;
  }).join('');
}

function renderPanel() {
  const def = wave(s);
  let h = '';
  if (s.phase === 'prep') {
    const c = canStartWave(s);
    const empties = SITES.filter((x) => !nodeAt(s, x.id));
    h = `<h2><small>Prepare · wave ${s.wave} of ${TOTAL_WAVES}</small>${esc(def.title)}</h2>
      <p class="hint">${esc(def.hint)}</p>
      ${s.message ? `<p class="notice">${esc(s.message)}</p>` : ''}
      <section class="card"><h3>Incoming threats</h3><div class="lanes">${previewHtml()}</div></section>
      <section class="card"><h3>Dilate vessel</h3>
        <p class="hint">Choose exactly one. White cells travel only along the dilated vessel, and the immune pulse only works there.</p>
        <div class="choice">${VESSEL_IDS.map((v, i) => `<button data-act="dilate" data-v="${v}" aria-pressed="${s.dilated === v}" class="${s.dilated === v ? 'on' : ''}">${VESSEL_NAMES[v]}<small>${s.dilated === v ? 'dilated' : `resting · key ${i + 1}`}</small></button>`).join('')}</div></section>
      <section class="card"><h3>Lymph nodes <span class="count">${s.energy} energy</span></h3>
        <p class="hint">Click a + site beside a vessel to place a node. Each fires its immunoglobulin at pathogens on its own vessel.</p>
        <ul class="key">${NODE_TYPES.map((t) => `<li><img alt="" src="${nodeIcon(t)}" width="40" height="31"><span><b>${CONFIG.nodes[t].short}</b> · ${CONFIG.nodes[t].cost}<small>${esc(CONFIG.nodes[t].blurb)}</small></span></li>`).join('')}</ul>
        <details><summary>Place by list (keyboard)</summary><div class="flist">${empties.map((x) => `<button data-act="site" data-site="${x.id}">${esc(VESSEL_NAMES[x.vessel])} · ${['outer', 'middle', 'inner'][x.index]}</button>`).join('') || '<em>Every site has a node.</em>'}</div></details></section>
      <div class="start"><button data-act="start" class="primary" ${c.ok ? '' : 'disabled'}>Start wave ${s.wave}</button><p class="hint small">${c.ok ? 'Dilation and building lock once the wave begins.' : esc(c.reason)}</p></div>`;
  } else if (s.phase === 'combat') {
    const cells = aliveCells(s).length;
    const pc = pulseCheck(s);
    const would = pulseTargets(s).length;
    h = `<h2><small>Defend · wave ${s.wave} of ${TOTAL_WAVES}</small>${esc(def.title)}</h2>
      <section class="card"><h3>White cells <span class="count">${cells} of ${CONFIG.whiteCell.startingCount}</span></h3>
        <p class="cells">${Array.from({ length: CONFIG.whiteCell.startingCount }, (_, i) => `<span class="${i < cells ? '' : 'lost'}">${icon('cell', 30)}</span>`).join('')}</p>
        <p class="hint">Patrolling the ${esc(VESSEL_NAMES[s.dilated!].toLowerCase())}.${s.infections ? ` <b>${s.infections} infected</b> by hijacker viruses: they now head for the heart.` : ' Keep them clear of hijacker viruses.'}</p></section>
      <section class="card"><h3>Immune pulse <span class="count">${s.pulsesLeft} left</span></h3>
        <button data-act="pulse" class="pulse" ${pc.ok ? '' : 'disabled'}>${s.pulsesLeft > 0 ? 'Immune pulse' : 'Pulse used'}</button>
        <p class="hint">${s.pulsesLeft > 0 ? `A burst around each white cell, hitting pathogens on its vessel only. <b>Right now it would hit ${would}.</b> Space bar works too.` : 'One pulse per wave. It returns next wave.'}</p></section>`;
  } else if (s.phase === 'recall') {
    h = `<h2><small>Wave ${s.wave} cleared</small>Recalling white cells</h2><p class="hint">Survivors return to the heart, then the vessel contracts.</p>`;
  } else {
    h = `<h2><small>${s.phase === 'victory' ? 'Level complete' : 'The heart has stopped'}</small>${s.phase === 'victory' ? 'The heart is safe' : 'Defeat'}</h2><div class="start"><button data-act="restart" class="primary">Restart</button></div>`;
  }
  panel.innerHTML = h;
}

function renderHud() {
  $('hp').textContent = `${s.heartHp}/${CONFIG.heartHp}`;
  $('hpbar').style.width = `${(s.heartHp / CONFIG.heartHp) * 100}%`;
  $('wave').textContent = `${Math.min(s.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`;
  $('energy').textContent = String(s.energy);
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
    overlay.innerHTML = `<div class="plate"><p class="kicker">Level complete</p><h2>The heart is safe</h2><p>Heart health ${s.heartHp}/${CONFIG.heartHp} · ${s.killed} pathogens destroyed</p><button data-act="restart" class="primary">Play again</button></div>`;
  } else if (s.phase === 'defeat') {
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Wave ${s.wave}</p><h2>The heart has stopped</h2><p>Too many pathogens reached the heart. Place nodes where your white cells are not, match IgG to armour and IgA to speed, and keep the cells away from hijackers.</p><button data-act="restart" class="primary">Restart</button></div>`;
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
  if (s.phase !== 'prep' && !popover.hidden) closeSite();
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

Object.assign(window, {
  __heart: () => s,
  __advance: (sec: number) => { for (let t = 0; t < sec && !s.paused; t += 1 / 30) step(s, 1 / 30); refresh(performance.now()); return { phase: s.phase, wave: s.wave, hp: s.heartHp }; },
  __refresh: () => refresh(performance.now()),
});
