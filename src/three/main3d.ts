// The 3D prototype: one organ played on the real rules (sim.ts), shown by Board3D. A sandbox: every IgG target is
// unlocked, nothing is saved, and the 2D game is untouched. Choose the organ with #0 … #10 in the address (default: the liver).
import '../style.css';
import './play3d.css';
import { CONFIG, LEVELS, BACTERIA, NODE_TYPES, type NodeType, type VesselId } from '../config';
import * as map from '../level';
import { dist, nearestOnVessel } from '../level';
import { type State, newGame, advance, startWave, canStartWave, toggleRoute, dilateCheck, firePulse, pulseCheck, placeNode, buildCheck, nodeCost, nodeAt, cancelCheck, cancelNode, nextSpeed, levelDef, totalWaves, aliveCells, cellCount } from '../sim';
import { NO_PERKS, organBacteria, type Perks } from '../career';
import { Board3D } from './scene3d';
import { vesselWidth } from '../draw';
import { esc } from '../text';

const $ = (id: string) => document.getElementById(id)!;
const PERKS: Perks = { ...NO_PERKS, targets: [...BACTERIA] };
const levelFromHash = () => { const h = location.hash.slice(1), n = h === '' ? NaN : Number(h); return Number.isInteger(n) && n >= 0 && n < LEVELS.length ? n : 3; };
let s: State = newGame(levelFromHash(), PERKS);
const board = new Board3D($('stage'));
let hoverSite: string | null = null, buildFor: string | null = null;

let toastT = 0;
function toast(t: string) { const el = $('toast'); el.textContent = t; el.hidden = false; toastT = 2.6; }

// ── what is under a tap: a build site (between waves) or a vessel (during one), as on the 2D map ──
function siteAt(p: { x: number; y: number }) {
  let best: string | null = null, bd = 46;
  for (const site of map.SITES) { const d = dist(p, site); if (d < bd) { bd = d; best = site.id; } }
  return best;
}
function vesselAt(p: { x: number; y: number }): VesselId | null {
  let best: VesselId | null = null, bd = Infinity, onStem = false;
  for (const v of map.VESSEL_IDS) {
    const n = nearestOnVessel(map.VESSELS[v], p), reach = vesselWidth(s, v) / 2 + 34;
    if (n.d <= reach && n.d < bd) { bd = n.d; best = v; onStem = n.s < map.forkAt(v); }
  }
  return best && onStem ? map.routeAtStem(map.entryOf(best), s.open.find((r) => map.entryOf(r) === map.entryOf(best!)) ?? null) : best;
}

// ── the build menu, beside the site ──
const NAMES: Record<NodeType, string> = { igm: 'IgM', igg: 'IgG', iga: 'IgA', ige: 'IgE' };
function igTarget() { const bugs = organBacteria(s.level); return bugs[0] ?? 'saureus'; }
function openBuild(site: string) {
  buildFor = site;
  const menu = $('build'), node = nodeAt(s, site);
  if (node) {
    const c = cancelCheck(s, site);
    menu.innerHTML = `<h3>${NAMES[node.type]} node</h3><p>${c.ok ? 'Placed since the last wave: cancel it for everything back.' : esc(c.reason)}</p>${c.ok ? '<button data-cancel>Cancel this node</button>' : ''}`;
  } else {
    menu.innerHTML = `<h3>Place a lymph node</h3><p>${s.energy} energy</p>` + NODE_TYPES.map((t) => {
      const tg = t === 'igg' ? [igTarget()] : undefined, ok = buildCheck(s, site, t, tg).ok;
      return `<button data-type="${t}" ${ok ? '' : 'disabled'}><b>${NAMES[t]}</b> ${nodeCost(s, t)}<small>${esc(t === 'igg' ? `aimed at ${CONFIG.pathogens[igTarget()].plural}` : CONFIG.nodes[t].blurb)}</small></button>`;
    }).join('');
  }
  const p = board.screenOf(map.siteById(site).x, map.siteById(site).y), r = $('stage').getBoundingClientRect();
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(r.width - w - 8, p.x - r.left + 24))}px`;
  menu.style.top = `${Math.max(8, Math.min(r.height - h - 8, p.y - r.top - h / 2))}px`;
}
function closeBuild() { buildFor = null; $('build').hidden = true; }
$('build').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!b || b.disabled || !buildFor) return;
  if (b.dataset.type) { const t = b.dataset.type as NodeType; placeNode(s, buildFor, t, t === 'igg' ? [igTarget()] : undefined); }
  if (b.hasAttribute('data-cancel')) cancelNode(s, buildFor);
  closeBuild();
});

// ── taps on the board: a tap (not a drag that turns the camera) builds or dilates ──
const canvas = board.renderer.domElement;
let down: { x: number; y: number; t: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
  down = null;
  const p = board.pick(e.clientX, e.clientY);
  if (!p) return;
  if (!$('build').hidden) { closeBuild(); return; }
  if (s.phase === 'prep') { const site = siteAt(p); if (site) openBuild(site); else if (vesselAt(p)) toast('Vessels open during a wave: start it, then tap one.'); }
  else if (s.phase === 'combat') {
    const v = vesselAt(p);
    if (v) { const c = dilateCheck(s, v); if (!toggleRoute(s, v) && c.reason) toast(c.reason); }
  }
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const p = board.pick(e.clientX, e.clientY); hoverSite = p ? siteAt(p) : null; canvas.style.cursor = hoverSite && s.phase === 'prep' ? 'pointer' : 'grab'; });

// ── the controls ──
$('start').addEventListener('click', () => { const c = canStartWave(s); if (!startWave(s) && c.reason) toast(c.reason); closeBuild(); });
$('pulse').addEventListener('click', () => { const c = pulseCheck(s); if (!c.ok) { if (c.reason) toast(c.reason); return; } const n = firePulse(s); toast(n ? `The pulse: ${n} destroyed.` : 'No white cell was touching a pathogen.'); });
$('speed').addEventListener('click', () => { s.speed = nextSpeed(s.speed); });
$('again').addEventListener('click', () => { s = newGame(s.level, PERKS); closeBuild(); });
$('organ').addEventListener('change', (e) => { location.hash = (e.target as HTMLSelectElement).value; });
window.addEventListener('hashchange', () => { s = newGame(levelFromHash(), PERKS); closeBuild(); fillOrgans(); });
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); $('pulse').click(); }
  else if (e.key === 'Escape') closeBuild();
  else if (e.key === 'Enter' && s.phase === 'prep') $('start').click();
});
function fillOrgans() {
  ($('organ') as HTMLSelectElement).innerHTML = LEVELS.map((L, i) => `<option value="${i}" ${i === s.level ? 'selected' : ''}>${i + 1}. ${esc(L.title.replace(/^The /, ''))}</option>`).join('');
}
fillOrgans();

// ── the HUD ──
let sig = '';
function hud() {
  const L = levelDef(s);
  $('title').textContent = `Defend the ${L.title.replace(/^The /, '')}`;
  $('hp').textContent = `${s.heartHp}/${L.hp}`;
  $('wave').textContent = `${Math.min(s.wave, totalWaves(s))}/${totalWaves(s)}`;
  $('energy').textContent = String(s.energy);
  $('cells').textContent = `${s.phase === 'combat' ? aliveCells(s).length : cellCount(s)}/${cellCount(s)}`;
  ($('nobar') as HTMLElement).style.width = `${Math.min(100, (s.no / s.perks.noMax) * 100)}%`;
  $('notext').textContent = `${Math.floor(s.no)} NO`;
  ($('speed') as HTMLButtonElement).textContent = `×${s.speed}`;
  const next = `${s.phase}|${s.wave}|${s.pulsesLeft}|${canStartWave(s).ok}`;
  if (next !== sig) {
    sig = next;
    const st = $('start') as HTMLButtonElement, pu = $('pulse') as HTMLButtonElement;
    st.hidden = s.phase !== 'prep'; st.textContent = `Start wave ${s.wave}`;
    pu.hidden = s.phase !== 'combat'; pu.disabled = s.pulsesLeft <= 0; pu.textContent = s.pulsesLeft > 0 ? 'Immune pulse' : 'Pulse used';
    const end = $('end');
    end.hidden = s.phase !== 'victory' && s.phase !== 'defeat';
    $('endTitle').textContent = s.phase === 'victory' ? `The ${L.organ.toLowerCase()} is safe` : `The ${L.organ.toLowerCase()} has failed`;
    $('hint').textContent = s.phase === 'prep' ? 'Tap a + site to build a lymph node. Drag to turn the view, pinch or scroll to zoom.' : s.phase === 'combat' ? 'Tap a vessel to open it: your white cells set out along it. Space fires the pulse.' : '';
  }
  if (toastT <= 0) $('toast').hidden = true;
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (s.phase === 'combat' || s.phase === 'recall') advance(s, dt);
  if (s.notices.length) { toast(s.notices.join(' ')); s.notices = []; }
  toastT -= dt;
  board.update(s, dt, { hoverSite });
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// (a hidden tab gets no animation frames, so the game simply waits while you are away)
if (import.meta.env.DEV) Object.assign(window, { __s3d: () => s, __board: board, __advance3d: (sec: number) => { for (let t = 0; t < sec; t += 1 / 30) advance(s, 1 / 30); board.update(s, 1 / 30); hud(); } });
