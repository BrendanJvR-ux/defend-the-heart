import './style.css';
import { CONFIG, LEVELS, NODE_TYPES, BACTERIA, type BacteriumType, type NodeType, type PathogenType, type VesselId } from './config';
import * as map from './level';
import { W, H, siteById, nearestOnVessel, dist } from './level';
import {
  type State, newGame, step, advance, nextSpeed, toggleRoute, dilateCheck, openNeed, canStartWave, startWave, firePulse, pulseCheck, pulseTargets, outCells,
  aliveCells, wave, whenLabel, resumeGame, nodeCost, retargetCost, buildCheck, placeNode, retargetNode, retargetCheck, nodeAt, levelDef, totalWaves, surging,
} from './sim';
import { loadCareer, saveCareer, snapshot, onOrganEnd, unlockedCount, freshCareer, perksOf, buy, buyCheck, UPGRADES, type Career, type KV, type UpgradeId } from './career';
import { draw, drawPathogen, drawWhiteCell, drawNodeIcon, vesselWidth, type View } from './draw';

// ── The career: organs cleared, the game in progress, saved in this browser ──
const store: KV = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode: progress lasts this visit */ } },
};
let career: Career = loadCareer(store);
let unlocked = unlockedCount(career);
const saveNow = () => saveCareer(store, career);
const vesselName = (v: VesselId) => map.VESSELS[v]?.name ?? v;
const organTitle = (i: number) => LEVELS[i].title.replace(/^The /, '');

let s: State = career.run ? resumeGame(career.run, perksOf(career)) : newGame(0, perksOf(career));
const view: View = { hoverVessel: null, hoverSite: null, selectedSite: null, popMode: 'main', dualFirst: null, showPulseRadius: false, touch: matchMedia('(pointer: coarse)').matches };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const panel = $('panel');
const overlay = $('overlay');
const toastEl = $('toast');
const popover = $('popover');
const menuEl = $('menu');
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
  let best: VesselId | null = null, bd = Infinity, onStem = false;
  for (const v of map.VESSEL_IDS) {
    const n = nearestOnVessel(map.VESSELS[v], p);
    const reach = vesselWidth(s, v) / 2 + (view.touch ? 40 : 24);
    if (n.d <= reach && n.d < bd) { bd = n.d; best = v; onStem = n.s < map.forkAt(v); }
  }
  // the shared stem of a fork belongs to both branches: act on the open one, else the first
  return best && onStem ? map.routeAtStem(map.entryOf(best), s.dilated) : best;
}
function siteAt(p: { x: number; y: number }): string | null {
  let best: string | null = null, bd = view.touch ? 52 : 40;
  for (const site of map.SITES) { const d = dist(p, site); if (d < bd) { bd = d; best = site.id; } }
  return best;
}

function choose(v: VesselId) {
  const had = s.dilated, c = dilateCheck(s, v);
  if (!c.ok || !toggleRoute(s, v)) { toast(c.reason || 'Dilate during the wave.'); return; }
  if (had === v) toast(`The ${vesselName(v).toLowerCase()} relaxes; your white cells head home.`);
  else if (had) toast(`${vesselName(v)} dilated (−${CONFIG.no.openCost} NO); the ${vesselName(had).toLowerCase()} relaxes.`);
  else toast(`${vesselName(v)} dilated (−${CONFIG.no.openCost} NO).`);
  lastSig = '';
}

// ── Build popover ───────────────────────────────────────────────────────────
/** The target list for an IgG node: every bacterium with its icon, name and Gram/shape; locked or unusable ones greyed with the reason. */
function targetButtons(act: string, disabled: (b: BacteriumType) => string): string {
  return `<div class="types targets">${BACTERIA.map((b) => {
    const st = CONFIG.pathogens[b], locked = !s.perks.targets.includes(b), why = locked ? 'Unlock in Upgrades' : disabled(b);
    return `<button data-act="${act}" data-target="${b}" ${why ? 'disabled' : ''} title="${esc(why)}">${icon(b, 34)}<span><b><i>${esc(st.plural)}</i></b><small>${locked ? 'Unlock in Upgrades' : esc(st.short ?? '')}</small></span></button>`;
  }).join('')}</div>`;
}
const targetNames = (ts: BacteriumType[]) => ts.map((b) => `<i>${esc(CONFIG.pathogens[b].plural)}</i>`).join(' and ');
const MULT_LINE = '×3 on its target, ×2.5 on the same shape, ×2 on the same Gram stain, ×0.5 on other bacteria, ×0.25 on viruses.';

function openSite(id: string, mode: View['popMode'] = 'main') {
  if (s.phase !== 'prep') { toast('Lymph nodes can only be placed between waves.'); return; }
  view.selectedSite = id; view.popMode = mode;
  const site = siteById(id);
  const node = nodeAt(s, id);
  const x = `<button class="x" data-act="close" aria-label="Close">×</button>`;
  const back = `<p><button data-act="back">Back</button></p>`;
  if (mode === 'aim') {
    const dual = s.perks.dual && s.perks.targets.length >= 2 ? `<p><button data-act="todual" ${buildCheck(s, id, 'igg', s.perks.targets.slice(0, 2)).ok ? '' : 'disabled'}>Aim at two targets (${nodeCost(s, 'igg', ['saureus', 'ecoli'])} energy)</button></p>` : '';
    popover.innerHTML = `${x}<h3>Aim the IgG node</h3><p class="sub">${MULT_LINE}</p>
      ${targetButtons('aim', (b) => buildCheck(s, id, 'igg', [b]).reason)}${dual}${back}`;
  } else if (mode === 'dualA' || mode === 'dualB') {
    const first = view.dualFirst;
    popover.innerHTML = `${x}<h3>${mode === 'dualA' ? 'First target' : 'Second target'}</h3><p class="sub">${mode === 'dualA' ? 'A dual-target IgG uses the better match of its two targets.' : `With ${targetNames([first!])}.`}</p>
      ${targetButtons(mode, (b) => mode === 'dualA' ? '' : b === first ? 'Already chosen.' : buildCheck(s, id, 'igg', [first!, b]).reason)}${back}`;
  } else if ((mode === 'reaimA' || mode === 'reaimB') && node) {
    const first = view.dualFirst;
    popover.innerHTML = `${x}<h3>Re-aim both targets: ${mode === 'reaimA' ? 'first' : 'second'}</h3><p class="sub">Now aimed at ${targetNames(node.targets)}. Re-aiming costs ${CONFIG.iggRetarget} energy.${mode === 'reaimB' ? ` First: ${targetNames([first!])}.` : ''}</p>
      ${targetButtons(mode, (b) => mode === 'reaimA' ? '' : b === first ? 'Already chosen.' : retargetCheck(s, id, [first!, b]).reason)}${back}`;
  } else if ((mode === 'reaim' || mode === 'addSecond') && node) {
    const adding = mode === 'addSecond';
    popover.innerHTML = `${x}<h3>${adding ? 'Add a second target' : 'Re-aim the IgG node'}</h3><p class="sub">Now aimed at ${targetNames(node.targets)}. ${adding ? `A second target costs ${retargetCost(node, ['saureus', 'ecoli'])} energy.` : `Re-aiming costs ${CONFIG.iggRetarget} energy.`}</p>
      ${targetButtons(mode, (b) => node.targets.includes(b) ? 'Already aimed here.' : retargetCheck(s, id, adding ? [node.targets[0], b] : [b]).reason)}${back}`;
  } else if (node) {
    const st = CONFIG.nodes[node.type];
    const life = st.burnsOutAfter ? `<p class="notice">Burns out after ${st.burnsOutAfter - node.wavesFought} more wave${st.burnsOutAfter - node.wavesFought === 1 ? '' : 's'}.</p>` : '';
    const dualNode = node.targets.length === 2, choices = s.perks.targets.length;
    // re-aiming needs somewhere else to aim: another unlocked target (or, for a dual node, a third)
    const reaim = choices > node.targets.length ? `<button data-act="${dualNode ? 'toreaimA' : 'toreaim'}">${dualNode ? 'Re-aim both' : 'Re-aim'} (${CONFIG.iggRetarget} energy)</button>` : '';
    const second = s.perks.dual && !dualNode && choices >= 2 ? ` <button data-act="toadd">Add a second target (${retargetCost(node, [node.targets[0], 'ecoli'])})</button>` : '';
    const aim = node.type === 'igg' ? `<p class="sub">Aimed at ${targetNames(node.targets)}.</p>${reaim || second ? `<p>${reaim}${second}</p>` : ''}` : '';
    const dmg = st.damage * s.perks.dmg[node.type];
    popover.innerHTML = `${x}<h3>${esc(st.name)}</h3><p class="sub">Guards the ${esc(vesselName(site.vessel).toLowerCase())}.</p><p>${esc(st.blurb)}</p><p class="sub">${Math.round(dmg * 10) / 10} damage${node.type === 'igg' ? ' × match' : ''} every ${st.cooldown}s${st.slow ? `, slows to ${Math.round(st.slow * 100)}% speed for ${st.slowSeconds}s` : ''}.</p>${aim}${life}`;
  } else {
    popover.innerHTML = `${x}<h3>Place a lymph node</h3><p class="sub">Beside the ${esc(vesselName(site.vessel).toLowerCase())}. You have <b>${s.energy}</b> energy.${s.perks.cheapFirst && !s.discountUsed ? ' Your first node this build costs half.' : ''}</p>
      <div class="types">${NODE_TYPES.map((t) => {
        const st = CONFIG.nodes[t];
        // IgG still needs a target: judge it with any unlocked target, the next step picks one
        const c = buildCheck(s, id, t, t === 'igg' ? [s.perks.targets[0]] : undefined);
        return `<button data-act="build" data-type="${t}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason)}"><img alt="" src="${nodeIcon(t)}" width="44" height="34"><span><b>${esc(st.short)}</b> · ${nodeCost(s, t)} energy<small>${esc(st.blurb)}</small></span></button>`;
      }).join('')}</div>`;
  }
  popover.hidden = false;
  // beside the site, on the side with more room, kept wholly inside the map
  const field = canvas.parentElement!, fw = field.clientWidth, fh = field.clientHeight;
  const pw = popover.offsetWidth, ph = popover.offsetHeight;
  const cx = (site.x / W) * fw, cy = (site.y / H) * fh;
  const left = site.x > W * 0.6 ? cx - pw - 30 : cx + 30;
  popover.style.left = `${Math.max(6, Math.min(fw - pw - 6, left))}px`;
  popover.style.top = `${Math.max(6, Math.min(fh - ph - 6, cy - ph / 2))}px`;
  (popover.querySelector('button:not([disabled]):not(.x)') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
function closeSite() {
  if (popover.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  popover.hidden = true; view.selectedSite = null; view.popMode = 'main';
}
popover.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  const id = view.selectedSite;
  if (!el || el.disabled || !id) { if (el?.dataset.act === 'close') closeSite(); return; }
  const act = el.dataset.act;
  if (act === 'close') closeSite();
  else if (act === 'back') openSite(id, 'main');
  else if (act === 'toreaim') openSite(id, 'reaim');
  else if (act === 'toadd') openSite(id, 'addSecond');
  else if (act === 'toreaimA') openSite(id, 'reaimA');
  else if (act === 'reaimA') { view.dualFirst = el.dataset.target as BacteriumType; openSite(id, 'reaimB'); }
  else if (act === 'reaimB') {
    const ts = [view.dualFirst!, el.dataset.target as BacteriumType];
    if (retargetNode(s, id, ts)) { toast(`IgG re-aimed at ${ts.map((b) => CONFIG.pathogens[b].plural).join(' and ')} (−${CONFIG.iggRetarget} energy).`); closeSite(); lastSig = ''; }
  }
  else if (act === 'todual') openSite(id, 'dualA');
  else if (act === 'dualA') { view.dualFirst = el.dataset.target as BacteriumType; openSite(id, 'dualB'); }
  else if (act === 'dualB') {
    const ts = [view.dualFirst!, el.dataset.target as BacteriumType];
    if (placeNode(s, id, 'igg', ts)) { toast(`Dual-target IgG placed: ${ts.map((b) => CONFIG.pathogens[b].plural).join(' and ')}.`); closeSite(); lastSig = ''; }
  } else if (act === 'addSecond') {
    const n = nodeAt(s, id)!, ts = [n.targets[0], el.dataset.target as BacteriumType], cost = retargetCost(n, ts);
    if (retargetNode(s, id, ts)) { toast(`IgG now aims at ${ts.map((b) => CONFIG.pathogens[b].plural).join(' and ')} (−${cost} energy).`); closeSite(); lastSig = ''; }
  }
  else if (act === 'build') {
    const type = el.dataset.type as NodeType;
    if (type === 'igg') { openSite(id, 'aim'); return; }
    if (placeNode(s, id, type)) { toast(`${CONFIG.nodes[type].name} placed.`); closeSite(); lastSig = ''; }
  } else if (act === 'aim') {
    const b = el.dataset.target as BacteriumType;
    if (placeNode(s, id, 'igg', [b])) { toast(`IgG lymph node placed, aimed at ${CONFIG.pathogens[b].plural}.`); closeSite(); lastSig = ''; }
  } else if (act === 'reaim') {
    const b = el.dataset.target as BacteriumType;
    if (retargetNode(s, id, [b])) { toast(`IgG re-aimed at ${CONFIG.pathogens[b].plural} (−${CONFIG.iggRetarget} energy).`); closeSite(); lastSig = ''; }
  }
});

canvas.addEventListener('pointerdown', (e) => {
  const p = toMap(e);
  if (s.phase === 'prep') {
    const site = siteAt(p);
    if (site) { openSite(site); return; }
    closeSite();
    if (vesselAt(p)) toast('Dilate during the wave: start it, then open a vessel with NO.');
  } else if (s.phase === 'combat') {
    const v = vesselAt(p);
    if (v) choose(v);
    else if (siteAt(p)) toast('Lymph nodes can only be placed between waves.');
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = toMap(e);
  view.hoverSite = siteAt(p);
  view.hoverVessel = s.phase === 'combat' ? vesselAt(p) : null;
  canvas.style.cursor = (s.phase === 'prep' && view.hoverSite) || view.hoverVessel ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => { view.hoverVessel = null; view.hoverSite = null; });

function pulse() {
  const c = pulseCheck(s);
  if (!c.ok) { if (c.reason) toast(c.reason); return; }
  const hits = firePulse(s);
  toast(hits > 0 ? `Immune pulse: ${hits} pathogen${hits === 1 ? '' : 's'} hit.` : 'Immune pulse fired, but nothing was close enough.');
  lastSig = '';
}

function restart() { const sp = s.speed; s = newGame(s.level, perksOf(career)); lastPhase = ''; spentToasted = 0; s.speed = sp; closeSite(); lastSig = ''; overlaySig = ''; toast(`A fresh start: the ${levelDef(s).organ.toLowerCase()} is at full health.`); }
/** A run worth asking about before it is thrown away: past the first wave, or with nodes built. */
const runInProgress = () => (s.phase === 'prep' || s.phase === 'combat' || s.phase === 'recall') && (s.wave > 1 || s.phase !== 'prep' || s.energy !== levelDef(s).startEnergy);
function playLevel(i: number, confirmed = false) {
  if (i >= unlocked) { toast('Clear the previous organ to unlock this one.'); return; }
  if (!confirmed && runInProgress()) { openMenu({ page: 'switch', level: i }); return; }
  const sp = s.speed; s = newGame(i, perksOf(career)); s.speed = sp;
  closeSite(); closeMenu(); lastSig = ''; overlaySig = ''; lastPhase = ''; spentToasted = 0;
  toast(`Level ${i + 1}: defend the ${organTitle(i).toLowerCase()}.`);
}

// ── Saving: at the start of every build phase, and when an organ is won or lost ──
let lastPhase = '';
/** Gold paid for the organ just won (shown on the victory screen). */
let lastPaid = 0;
function autosave() {
  const key = `${s.level}:${s.wave}:${s.phase}`;
  if (!gameShown || key === lastPhase) return;
  lastPhase = key;
  if (s.phase === 'prep') { career.run = snapshot(s); saveNow(); }
  else if (s.phase === 'victory' || s.phase === 'defeat') { lastPaid = onOrganEnd(career, s); unlocked = unlockedCount(career); saveNow(); lastSig = ''; }
}

// ── The menu ────────────────────────────────────────────────────────────────
type MenuPage = { page: 'main' } | { page: 'organs' } | { page: 'shop' } | { page: 'confirmNew' } | { page: 'switch'; level: number };
let menuPage: MenuPage | null = null;
let pausedBeforeMenu = false;
function openMenu(p: MenuPage = { page: 'main' }) {
  if (!menuPage) { pausedBeforeMenu = s.paused; s.paused = true; }
  menuPage = p; closeSite(); document.body.classList.add('menu-open'); renderMenu();
}
function closeMenu() {
  if (!menuPage) return;
  menuPage = null; s.paused = pausedBeforeMenu; document.body.classList.remove('menu-open'); menuEl.hidden = true; menuEl.innerHTML = ''; lastSig = ''; overlaySig = '';
}
const careerStarted = () => career.cleared.some(Boolean) || !!career.run || career.gold > 0;
function renderMenu() {
  if (!menuPage) return;
  const run = career.run, cleared = career.cleared.filter(Boolean).length;
  let h = '';
  if (menuPage.page === 'main') {
    h = `<h2>Defend the Heart</h2><p class="kicker">An anatomy tower defence</p>
      <p class="sub">${cleared ? `${cleared} of ${LEVELS.length} organs cleared.` : 'Five organs to defend, from the heart to the kidney.'}</p>
      <div class="menuButtons">
        ${run ? `<button data-menu="continue" class="primary">Continue<small>${esc(organTitle(run.level))} · wave ${run.wave} of ${LEVELS[run.level].waves.length}</small></button>` : ''}
        <button data-menu="new" ${run ? '' : 'class="primary"'}>New career</button>
        <button data-menu="organs">Organs<small>${unlocked} unlocked</small></button>
        <button data-menu="shop">Upgrades<small>${career.gold} gold</small></button>
        ${gameShown ? '<button data-menu="close">Back to the game</button>' : ''}
      </div>`;
  } else if (menuPage.page === 'organs') {
    h = `<h2>Organs</h2><p class="sub">Clear an organ to unlock the next. Cleared organs can be replayed.</p>
      <div class="menuButtons">${LEVELS.map((l, i) => `<button data-menu="level" data-level="${i}" ${i < unlocked ? '' : 'disabled'}>${i + 1}. ${esc(organTitle(i))}<small>${i >= unlocked ? 'locked' : career.cleared[i] ? `cleared · best ${career.best[i]}/${l.hp}` : esc(l.tagline)}</small></button>`).join('')}</div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'shop') {
    const row = (id: UpgradeId, iconHtml = '') => {
      const u = UPGRADES[id], have = career.bought[id] ?? 0, chk = buyCheck(career, id);
      const pips = u.prices.length > 1 ? `<span class="pips">${u.prices.map((_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<li>${iconHtml}<span><b>${esc(u.name)}</b> ${pips}<small>${esc(u.blurb)}</small></span><button data-menu="buy" data-up="${id}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.reason)}">${have >= u.prices.length ? (u.prices.length > 1 ? 'Maxed' : 'Owned') : `${chk.price} gold`}</button></li>`;
    };
    const nodeImg = (n: NodeType) => `<img alt="" src="${nodeIcon(n)}" width="40" height="31">`;
    h = `<h2>Upgrades</h2><p class="sub">You have <b>${career.gold}</b> gold. Clear organs to earn more (a quarter on a replay). Upgrades apply at once; an extra starting node from the next organ you start.</p>
      <div class="shop">
        <h3>Node damage</h3><ul>${(['igm', 'igg', 'iga', 'ige'] as NodeType[]).map((n) => row(`dmg-${n}` as UpgradeId, nodeImg(n))).join('')}</ul>
        <h3>IgG targets</h3><p class="sub"><i>S. aureus</i> is always unlocked.</p><ul>${BACTERIA.filter((b) => b !== 'saureus').map((b) => row(`target-${b}` as UpgradeId, icon(b, 34))).join('')}</ul>
        <h3>Special</h3><ul>${(['dual', 'no', 'extraNode', 'cheapFirst'] as UpgradeId[]).map((id) => row(id)).join('')}</ul>
      </div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'confirmNew') {
    h = `<h2>Start over?</h2><p>Your cleared organs${career.gold ? ', gold' : ''} and the game in progress will be lost.</p>
      <div class="menuButtons"><button data-menu="newYes" class="primary danger">Start a new career</button><button data-menu="back">Keep my career</button></div>`;
  } else {
    const L = levelDef(s), same = menuPage.level === s.level;
    h = same
      ? `<h2>Start the ${esc(L.organ.toLowerCase())} again?</h2><p>This ends your run at wave ${s.wave}.</p>
      <div class="menuButtons"><button data-menu="switchYes" data-level="${menuPage.level}">Start again from wave 1</button><button data-menu="close" class="primary">Carry on at wave ${s.wave}</button></div>`
      : `<h2>Leave the ${esc(L.organ.toLowerCase())}?</h2><p>This ends your ${esc(organTitle(s.level).toLowerCase())} run (wave ${s.wave}).</p>
      <div class="menuButtons"><button data-menu="switchYes" data-level="${menuPage.level}" class="primary">Play ${esc(LEVELS[menuPage.level].title)}</button><button data-menu="close">Stay</button></div>`;
  }
  menuEl.innerHTML = `<div class="plate">${h}</div>`;
  menuEl.hidden = false;
  (menuEl.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
/** Has the player got a game in front of them (so "Back to the game" makes sense)? */
let gameShown = false;
function togglePause() { if (s.phase === 'combat' || s.phase === 'prep' || s.phase === 'recall') { s.paused = !s.paused; lastSig = ''; } }

panel.addEventListener('click', (e) => {
  if (menuPage) return; // the menu is on top of the game
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'dilate') choose(el.dataset.v as VesselId);
  if (a === 'site') openSite(el.dataset.site!);
  if (a === 'start') { if (startWave(s)) { closeSite(); lastSig = ''; } }
  if (a === 'pulse') pulse();
  if (a === 'restart') restart();
  if (a === 'level') playLevel(Number(el.dataset.level));
});
panel.addEventListener('pointerover', (e) => { if ((e.target as HTMLElement).closest('[data-act=pulse]')) view.showPulseRadius = true; const site = (e.target as HTMLElement).closest('[data-site]') as HTMLElement | null; view.hoverSite = site?.dataset.site ?? view.hoverSite; });
panel.addEventListener('pointerout', (e) => { if ((e.target as HTMLElement).closest('[data-act=pulse]')) view.showPulseRadius = false; });
panel.addEventListener('focusin', (e) => { view.showPulseRadius = !!(e.target as HTMLElement).closest('[data-act=pulse]'); });
panel.addEventListener('focusout', () => { view.showPulseRadius = false; });
overlay.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (a?.dataset.act === 'restart') restart();
  if (a?.dataset.act === 'level') playLevel(Number(a.dataset.level));
  if (a?.dataset.act === 'resume') { s.paused = false; lastSig = ''; }
  if (a?.dataset.act === 'shop') openMenu({ page: 'shop' });
});
$('btnMenu').addEventListener('click', () => (menuPage ? closeMenu() : openMenu()));
menuEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-menu]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.menu;
  if (a === 'continue' && career.run) {
    const sp = s.speed; s = resumeGame(career.run, perksOf(career)); s.speed = sp; lastPhase = ''; spentToasted = 0; gameShown = true; closeMenu(); pausedBeforeMenu = false; s.paused = false;
    toast(`Welcome back: the ${organTitle(s.level).toLowerCase()}, wave ${s.wave}.`);
  } else if (a === 'new') { if (careerStarted()) openMenu({ page: 'confirmNew' }); else startCareer(); }
  else if (a === 'newYes') startCareer();
  else if (a === 'organs') openMenu({ page: 'organs' });
  else if (a === 'shop') openMenu({ page: 'shop' });
  else if (a === 'buy') {
    const id = el.dataset.up as UpgradeId, r = buy(career, id);
    if (r.ok) { saveNow(); s.perks = perksOf(career); toast(`${UPGRADES[id].name} bought.`); } else toast(r.reason);
    const y = menuEl.scrollTop; renderMenu(); menuEl.scrollTop = y;
  }
  else if (a === 'back') openMenu({ page: 'main' });
  else if (a === 'close') { gameShown = true; closeMenu(); }
  else if (a === 'level') { gameShown = true; playLevel(Number(el.dataset.level)); if (menuPage?.page !== 'switch') { s.paused = false; pausedBeforeMenu = false; } }
  else if (a === 'switchYes') { gameShown = true; pausedBeforeMenu = false; playLevel(Number(el.dataset.level), true); s.paused = false; }
});
function startCareer() {
  career = freshCareer(); unlocked = unlockedCount(career); saveNow();
  const sp = s.speed; s = newGame(0, perksOf(career)); s.speed = sp; lastPhase = ''; spentToasted = 0; gameShown = true;
  closeMenu(); pausedBeforeMenu = false; s.paused = false;
  toast('A new career: defend the heart.');
}
$('btnPause').addEventListener('click', togglePause);
$('btnSpeed').addEventListener('click', () => { s.speed = nextSpeed(s.speed); });
$('btnRestart').addEventListener('click', restart);
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  const keyed = /^[1-9]$/.test(e.key) ? map.VESSEL_IDS[Number(e.key) - 1] : undefined;
  if (menuPage) { if (e.key === 'Escape' && gameShown && menuPage.page !== 'switch') { if (menuPage.page === 'main') closeMenu(); else openMenu({ page: 'main' }); } return; }
  if (keyed) choose(keyed);
  // Esc steps back from the IgG target list, then closes
  else if (e.key === 'Escape') { if (view.selectedSite && view.popMode !== 'main') openSite(view.selectedSite, 'main'); else closeSite(); }
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
    else drawPathogen(x, kind, size / 2, size / 2, 0, 0, CONFIG.pathogens[kind].boss ? size / 100 : CONFIG.pathogens[kind].taxon ? size / 44 : size / 36);
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
  return JSON.stringify([s.level, unlocked, s.phase, s.paused, s.wave, s.phase === 'combat' && surging(s), s.dilated, s.no >= openNeed(), s.cells.map((c) => c.mode).join(), s.pulsesLeft, s.energy, s.nodes.length, aliveCells(s).length, s.infections, s.phase === 'combat' ? pulseTargets(s).length : 0]);
}

function previewHtml(): string {
  const def = wave(s);
  return map.ENTRY_IDS.map((v) => {
    const groups = def.groups.filter((g) => g.vessel === v).sort((a, b) => a.start - b.start);
    const forks = map.routesOf(v).length > 1;
    if (!groups.length) return '';
    const rows = groups.map((g) => {
      const st = CONFIG.pathogens[g.type];
      const traits = st.boss ? `<b class="bossTag">BOSS</b> ${esc(st.blurb ?? '')}` : st.taxon ? esc(st.short ?? '') : g.type === 'virus' ? 'fast, grouped' : 'infects white cells';
      return `<li>${icon(g.type, st.boss ? 40 : 28)}<span><b>${g.count} ${(g.count > 1 ? st.plural : st.name).toLowerCase()}</b> <small>${whenLabel(g.start)}, ${traits}</small></span></li>`;
    }).join('');
    return `<div class="lane"><h4>${esc(map.entryDef(v).name)}${forks ? ' <small>· forks</small>' : ''}</h4><ul>${rows}</ul></div>`;
  }).join('');
}

function lungsLine(): string {
  const sg = levelDef(s).surge;
  if (!sg) return '';
  if (surging(s)) return '<p class="notice">Inhaling: everything in the vessels surges forward.</p>';
  const next = sg.every - sg.length - (s.waveTime % sg.every);
  return `<p class="hint small">Next breath in ${Math.ceil(next)}s.</p>`;
}

function renderPanel() {
  const def = wave(s);
  let h = '';
  if (s.phase === 'prep') {
    const c = canStartWave(s);
    const empties = map.SITES.filter((x) => !nodeAt(s, x.id));
    const L = levelDef(s);
    h = `<section class="card organ"><h3>Level ${s.level + 1} · ${esc(L.title)}</h3><p class="hint small"><b>${esc(L.tagline)}</b> ${esc(L.twist)}</p>
        <div class="levels">${LEVELS.map((l, i) => `<button data-act="level" data-level="${i}" class="${i === s.level ? 'on' : ''}" ${i < unlocked ? '' : 'disabled'} title="${i < unlocked ? (i === s.level ? 'Restart this organ' : `Play ${esc(l.title)}`) : 'Locked: clear the previous organ'}">${i + 1}<small>${i < unlocked ? esc(organTitle(i)) : 'locked'}</small></button>`).join('')}</div></section>
      <h2><small>Prepare · wave ${s.wave} of ${totalWaves(s)}</small>${esc(def.title)}</h2>
      <p class="hint">${esc(def.hint)}</p>
      ${s.message ? `<p class="notice">${esc(s.message)}</p>` : ''}
      <section class="card"><h3>Incoming threats</h3><div class="lanes">${previewHtml()}</div></section>
      <section class="card"><h3>Dilation <span class="count"><span data-no>${Math.floor(s.no)}</span> NO</span></h3>
        <p class="hint">During the wave, open one vessel at a time with NO. Opening costs ${CONFIG.no.openCost}; an open vessel drains NO; closed, it refills.</p></section>
      <section class="card"><h3>Lymph nodes <span class="count">${s.energy} energy</span></h3>
        <p class="hint">Click a + site beside a vessel to place a node. Each fires its immunoglobulin at pathogens on its own vessel.</p>
        <ul class="key">${NODE_TYPES.map((t) => `<li><img alt="" src="${nodeIcon(t)}" width="40" height="31"><span><b>${CONFIG.nodes[t].short}</b> · ${CONFIG.nodes[t].cost}<small>${esc(CONFIG.nodes[t].blurb)}</small></span></li>`).join('')}</ul>
        <details><summary>Place by list (keyboard)</summary><div class="flist">${empties.map((x) => `<button data-act="site" data-site="${x.id}">${esc(vesselName(x.vessel))} · ${map.siteLabel(x)}</button>`).join('') || '<em>Every site has a node.</em>'}</div></details></section>
      <div class="start"><button data-act="start" class="primary" ${c.ok ? '' : 'disabled'}>Start wave ${s.wave}</button><p class="hint small">${c.ok ? 'Building locks once the wave begins.' : esc(c.reason)}</p></div>`;
  } else if (s.phase === 'combat') {
    const cells = aliveCells(s).length;
    const pc = pulseCheck(s);
    const would = pulseTargets(s).length;
    const out = outCells(s).length, returning = aliveCells(s).some((c) => c.mode === 'returning');
    const organ = esc(levelDef(s).organ.toLowerCase());
    const where = s.dilated ? (out ? `Patrolling the ${esc(vesselName(s.dilated).toLowerCase())}.` : `Heading home before setting out along the ${esc(vesselName(s.dilated).toLowerCase())}.`) : returning ? `Returning to the ${organ}.` : `Waiting at the ${organ}: open a vessel to send them out.`;
    const noLow = s.no < openNeed() && !s.dilated;
    h = `<h2><small>Defend · wave ${s.wave} of ${totalWaves(s)}</small>${esc(def.title)}</h2>
      <section class="card"><h3>Dilate <span class="count"><span data-no>${Math.floor(s.no)}</span> / ${s.perks.noMax} NO</span></h3>
        <p class="nogauge ${noLow ? 'low' : ''}"><i data-nobar style="width:${(s.no / s.perks.noMax) * 100}%"></i></p>
        <div class="choice">${map.VESSEL_IDS.map((v, i) => `<button data-act="dilate" data-v="${v}" aria-pressed="${s.dilated === v}" class="${s.dilated === v ? 'on' : ''}" ${s.dilated === v || s.no >= openNeed() ? '' : 'disabled'}>${vesselName(v)}<small>${s.dilated === v ? `open · key ${i + 1} closes` : `resting · key ${i + 1}`}</small></button>`).join('')}</div>
        <p class="hint">Opening costs ${CONFIG.no.openCost} NO (you need ${openNeed()} to open), an open vessel drains ${CONFIG.no.drainPerSec} a second, and while all are closed NO refills ${CONFIG.no.regenPerSec} a second. When NO runs out the vessel closes.</p></section>
      <section class="card"><h3>White cells <span class="count">${cells} of ${levelDef(s).cells}</span></h3>
        <p class="cells">${Array.from({ length: levelDef(s).cells }, (_, i) => `<span class="${i < cells ? '' : 'lost'}">${icon('cell', 30)}</span>`).join('')}</p>
        <p class="hint">${where}${s.infections ? ` <b>${s.infections} infected</b> by hijacker viruses: they now head for the ${esc(levelDef(s).organ.toLowerCase())}.` : ' Keep them clear of hijacker viruses.'}</p></section>
      <section class="card"><h3>Immune pulse <span class="count">${s.pulsesLeft} left</span></h3>
        <button data-act="pulse" class="pulse" ${pc.ok ? '' : 'disabled'}>${s.pulsesLeft > 0 ? 'Immune pulse' : 'Pulse used'}</button>
        ${lungsLine()}
        <p class="hint">${s.pulsesLeft > 0 ? `A burst around each white cell, hitting pathogens on its vessel only. <b>Right now it would hit ${would}.</b> Space bar works too.` : 'One pulse per wave. It returns next wave.'}</p></section>`;
  } else if (s.phase === 'recall') {
    h = `<h2><small>Wave ${s.wave} cleared</small>Recalling white cells</h2><p class="hint">Survivors return to the ${esc(levelDef(s).organ.toLowerCase())}, then the vessel contracts.</p>`;
  } else {
    const L = levelDef(s), next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    h = `<h2><small>${s.phase === 'victory' ? 'Level complete' : `The ${L.organ.toLowerCase()} has failed`}</small>${s.phase === 'victory' ? `The ${esc(organTitle(s.level).toLowerCase())} ${s.level === 1 ? 'are' : 'is'} safe` : 'Defeat'}</h2><div class="start">${s.phase === 'victory' && next >= 0 ? `<button data-act="level" data-level="${next}" class="primary">Next: ${esc(LEVELS[next].title)}</button> ` : ''}<button data-act="restart" ${s.phase === 'victory' && next >= 0 ? '' : 'class="primary"'}>${s.phase === 'victory' ? 'Play again' : 'Restart'}</button></div>`;
  }
  panel.innerHTML = h;
}

function renderHud() {
  const L = levelDef(s);
  $('title').textContent = `Defend the ${organTitle(s.level)}`;
  $('levelName').textContent = `Level ${s.level + 1} of ${LEVELS.length}`;
  $('hpLabel').textContent = `${L.organ} health`;
  document.title = `Defend the ${organTitle(s.level)}`;
  $('hp').textContent = `${s.heartHp}/${levelDef(s).hp}`;
  $('hpbar').style.width = `${(s.heartHp / levelDef(s).hp) * 100}%`;
  $('wave').textContent = `${Math.min(s.wave, totalWaves(s))}/${totalWaves(s)}`;
  $('energy').textContent = String(s.energy);
  $('cells').textContent = s.phase === 'combat' || s.phase === 'recall' ? `${aliveCells(s).length}/${levelDef(s).cells}` : `${levelDef(s).cells} ready`;
  // the NO figure and bar change every frame: update them in place rather than redrawing the panel
  const noText = String(Math.floor(s.no));
  for (const el of panel.querySelectorAll<HTMLElement>('[data-no]')) if (el.textContent !== noText) el.textContent = noText;
  const bar = panel.querySelector<HTMLElement>('[data-nobar]'); if (bar) bar.style.width = `${(s.no / s.perks.noMax) * 100}%`;
  // IgE nodes that burnt out: say so once, and close a popover left open on their site
  if (s.phase === 'prep' && s.spent.length && spentToasted !== s.wave) {
    spentToasted = s.wave;
    if (view.selectedSite && s.spent.some((x) => x.site === view.selectedSite)) closeSite();
    toast(s.spent.length === 1 ? `IgE spent: the site beside the ${vesselName(siteById(s.spent[0].site).vessel).toLowerCase()} is free again.` : `${s.spent.length} IgE nodes spent: their sites are free again.`);
  }
  if (s.noOuts !== lastNoOuts) { if (s.noOuts > lastNoOuts) toast('NO ran out: the vessel contracts and your white cells return.'); lastNoOuts = s.noOuts; }
  $('pulseStat').textContent = s.phase === 'combat' ? (s.pulsesLeft > 0 ? 'Ready' : 'Used') : s.phase === 'prep' ? 'Next wave' : '—';
  $('btnPause').textContent = s.paused ? 'Resume' : 'Pause';
  $('btnSpeed').textContent = `Speed ×${s.speed}`;
  document.body.dataset.phase = s.phase;
}

let lastNoOuts = 0, spentToasted = 0;
let overlaySig = '';
function renderOverlay() {
  const sig = `${s.phase}|${s.paused}`;
  if (sig === overlaySig) return;
  overlaySig = sig;
  const L = levelDef(s), org = organTitle(s.level).toLowerCase(), plural = s.level === 1 ? 'are' : 'is';
  if (s.phase === 'victory') {
    lastSig = '';
    const next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    overlay.hidden = false; overlay.className = 'victory';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Level ${s.level + 1} complete</p><h2>The ${esc(org)} ${plural} safe</h2><p>${esc(L.organ)} health ${s.heartHp}/${L.hp} · ${s.killed} pathogens destroyed</p>${lastPaid ? `<p class="gold">+${lastPaid} gold · ${career.gold} in all <button data-act="shop">Upgrades</button></p>` : ''}${next >= 0 ? `<p>Unlocked: <b>${esc(LEVELS[next].title)}</b>. ${esc(LEVELS[next].tagline)}</p><button data-act="level" data-level="${next}" class="primary">Next organ</button> <button data-act="restart">Play again</button>` : '<p><b>Every organ is safe.</b> The whole body has been defended.</p><button data-act="restart" class="primary">Play again</button>'}</div>`;
  } else if (s.phase === 'defeat') {
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Wave ${s.wave}</p><h2>The ${esc(L.organ.toLowerCase())} has failed</h2><p>Too many pathogens reached the ${esc(L.organ.toLowerCase())}. Place nodes where your white cells are not, aim IgG at the bacteria that are coming, use IgA on fast swarms, and keep the cells away from hijackers.</p><button data-act="restart" class="primary">Restart</button></div>`;
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
  if (!s.paused) advance(s, dt);
  autosave();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  refresh(now);
  requestAnimationFrame(frame);
}
resize();
openMenu();
refresh(performance.now());
requestAnimationFrame(frame);

Object.assign(window, {
  __heart: () => s,
  __level: (i: number) => { unlocked = Math.max(unlocked, i + 1); playLevel(i); return levelDef(s).id; },
  __advance: (sec: number) => { for (let t = 0; t < sec && !s.paused; t += 1 / 30) { step(s, 1 / 30); autosave(); } refresh(performance.now()); return { phase: s.phase, wave: s.wave, hp: s.heartHp }; },
  __refresh: () => refresh(performance.now()),
});
