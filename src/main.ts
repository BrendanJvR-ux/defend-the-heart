import './style.css';
import { CONFIG, LEVELS, NODE_TYPES, BACTERIA, type BacteriumType, type NodeType, type PathogenType, type VesselId } from './config';
import * as map from './level';
import { W, H, siteById, nearestOnVessel, dist } from './level';
import {
  type State, newGame, step, advance, nextSpeed, toggleRoute, dilateCheck, openNeed, canStartWave, startWave, firePulse, pulseCheck, pulseTargets, outCells,
  aliveCells, wave, resumeGame, leakSummary, nodeCost, retargetCost, buildCheck, placeNode, retargetNode, retargetCheck, nodeAt, levelDef, totalWaves, surging,
  hasTarget, borrowTarget, selectableTargets, aimedAt, openCost, pathogenPos,
} from './sim';
import { loadCareer, saveCareer, snapshot, onOrganEnd, lastPlace, unlockedCount, freshCareer, perksOf, buy, buyCheck, UPGRADES, organBacteria, missingTargets, type Career, type KV, type UpgradeId } from './career';
import { startTutorial, tutorialTick, tutorialNext, tutorialHolds, tutorialTarget, tutorialText, manualStep, type Tutorial } from './tutorial';
import { unlockAudio, isMuted, setMuted } from './sound';
import { playSounds } from './soundEvents';
import { pathogenAt, inspectHtml } from './inspect';
import { esc } from './text';
import { draw, drawPathogen, drawWhiteCell, drawNodeIcon, vesselWidth, prepareOrgan, type View } from './draw';

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
const view: View = { hoverVessel: null, hoverSite: null, selectedSite: null, popMode: 'main', dualFirst: null, coachAt: null, showPulseRadius: false, touch: matchMedia('(pointer: coarse)').matches };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const panel = $('panel');
const overlay = $('overlay');
const toastEl = $('toast');
const popover = $('popover');
const menuEl = $('menu');

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
  return best && onStem ? map.routeAtStem(map.entryOf(best), s.open.find((r) => map.entryOf(r) === map.entryOf(best)) ?? null) : best;
}

// ── Pathogen details: click one to see what it is and how it stands ──
const inspectEl = $('inspect');
function closeInspect() { view.inspectId = null; inspectEl.hidden = true; }
let inspectSig = '';
function updateInspect() {
  if (view.inspectId == null) return;
  const q = s.pathogens.find((x) => x.id === view.inspectId && x.hp > 0);
  if (!q || s.phase !== 'combat') { closeInspect(); return; }
  const html = inspectHtml(s, q);
  if (html !== inspectSig) { inspectEl.innerHTML = html; inspectSig = html; }
  // keep the card beside the pathogen, inside the map
  const r = canvas.getBoundingClientRect(), f = $('field').getBoundingClientRect(), pos = pathogenPos(q);
  const x = r.left - f.left + (pos.x / W) * r.width, y = r.top - f.top + (pos.y / H) * r.height;
  const w = inspectEl.offsetWidth, h = inspectEl.offsetHeight;
  inspectEl.style.left = `${Math.max(6, Math.min(f.width - w - 6, x + (x + w + 40 > f.width ? -w - 30 : 30)))}px`;
  inspectEl.style.top = `${Math.max(6, Math.min(f.height - h - 6, y - h / 2))}px`;
}
inspectEl.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act=closeInspect]')) closeInspect(); });

function siteAt(p: { x: number; y: number }): string | null {
  let best: string | null = null, bd = view.touch ? 52 : 40;
  for (const site of map.SITES) { const d = dist(p, site); if (d < bd) { bd = d; best = site.id; } }
  return best;
}

function choose(v: VesselId) {
  const was = [...s.open], c = dilateCheck(s, v), cost = openCost(s);
  if (!c.ok || !toggleRoute(s, v)) { toast(c.reason || 'Dilate during the wave.'); return; }
  const n = s.open.length, split = n > 1 ? ` Your white cells are split ${n} ways.` : '';
  if (was.includes(v)) toast(`The ${vesselName(v).toLowerCase()} relaxes; its white cells head home${n ? ' and on to the open vessels' : ''}.`);
  else {
    const closed = was.find((x) => !s.open.includes(x));
    toast(`${vesselName(v)} dilated (−${closed ? CONFIG.no.openCost : cost} NO)${closed ? `; the ${vesselName(closed).toLowerCase()} relaxes` : ''}.${split}`);
  }
  lastSig = '';
}

// ── Build popover ───────────────────────────────────────────────────────────
/** The target list for an IgG node: every bacterium with its icon, name and Gram/shape; locked or unusable ones greyed with the reason. */
function targetButtons(act: string, disabled: (b: BacteriumType) => string): string {
  const fee = CONFIG.borrowTargetGold;
  return `<div class="types targets">${BACTERIA.map((b) => {
    const st = CONFIG.pathogens[b];
    if (!hasTarget(s, b)) {
      // not unlocked: borrow it for this organ for a little gold
      const can = career.gold >= fee && s.phase === 'prep';
      return `<button data-act="borrow" data-target="${b}" ${can ? '' : 'disabled'} title="${can ? `Borrow for this organ: ${fee} gold` : `Needs ${fee} gold (you have ${career.gold})`}">${icon(b, 34)}<span><b><i>${esc(st.plural)}</i></b><small>Borrow for this organ · ${fee} gold</small></span></button>`;
    }
    const why = disabled(b), n = aimedAt(s, b, view.selectedSite ?? undefined);
    const count = `${n} of ${CONFIG.iggPerTarget} aimed`;
    return `<button data-act="${act}" data-target="${b}" ${why ? 'disabled' : ''} title="${esc(why)}">${icon(b, 34)}<span><b><i>${esc(st.plural)}</i></b><small>${esc(why && !why.startsWith('Already') ? why : count)}${s.borrowed.includes(b) ? ' · borrowed' : ''}</small></span></button>`;
  }).join('')}</div>`;
}

/** Borrow an IgG target for the rest of this organ, paying gold from the career. */
function borrow(b: BacteriumType): boolean {
  const fee = CONFIG.borrowTargetGold;
  if (career.gold < fee || s.phase !== 'prep' || !borrowTarget(s, b)) return false;
  career.gold -= fee; career.run = snapshot(s); saveNow();
  toast(`${CONFIG.pathogens[b].plural} borrowed as an IgG target for this organ (−${fee} gold).`);
  lastSig = '';
  return true;
}
/** Bacteria names in italics, joined. */
const bugNames = (ts: BacteriumType[]) => ts.map((b) => `<i>${esc(CONFIG.pathogens[b].plural)}</i>`).join(', ');
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
    const dual = s.perks.dual && selectableTargets(s).length >= 2 ? `<p><button data-act="todual" ${buildCheck(s, id, 'igg', selectableTargets(s).slice(0, 2)).ok ? '' : 'disabled'}>Aim at two targets (${nodeCost(s, 'igg', ['saureus', 'ecoli'])} energy)</button></p>` : '';
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
    const dualNode = node.targets.length === 2, choices = selectableTargets(s).length;
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
  else if (act === 'borrow') { if (borrow(el.dataset.target as BacteriumType)) openSite(id, view.popMode); }
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

// every build (placing, re-aiming) is saved at once, so a reload keeps it
popover.addEventListener('click', () => { if (s.phase === 'prep' && gameShown) { career.run = snapshot(s); saveNow(); } });

canvas.addEventListener('pointerdown', (e) => {
  const p = toMap(e);
  if (s.phase === 'prep') {
    const site = siteAt(p);
    if (site) { openSite(site); return; }
    closeSite();
    if (vesselAt(p)) toast('Dilate during the wave: start it, then open a vessel with NO.');
  } else if (s.phase === 'combat') {
    const bug = pathogenAt(s, p, view.touch);
    if (bug) { view.inspectId = bug.id; inspectSig = ''; inspectEl.hidden = false; updateInspect(); return; }
    closeInspect();
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
  toast(`Immune pulse: ${hits} white cell${hits === 1 ? '' : 's'} gave ${hits === 1 ? 'its life' : 'their lives'} to destroy ${hits === 1 ? 'a pathogen' : `${hits} pathogens`}.`);
  lastSig = '';
}

function restart() { const sp = s.speed, borrowed = s.borrowed; s = newGame(s.level, perksOf(career), undefined, s.endless); s.borrowed = borrowed; lastPhase = ''; spentToasted = 0; if (tut) { wantTutorial = true; maybeTutorial(); } s.speed = sp; closeSite(); lastSig = ''; overlaySig = ''; toast(`A fresh start: the ${levelDef(s).organ.toLowerCase()} is at full health.`); }
/** A run worth asking about before it is thrown away: past the first wave, or with nodes built. */
const runInProgress = () => (s.phase === 'prep' || s.phase === 'combat' || s.phase === 'recall') && (s.wave > 1 || s.phase !== 'prep' || s.energy !== levelDef(s).startEnergy);
// ── The guided first wave on the heart ─────────────────────────────────────
let tut: Tutorial | null = null;
/** Set by the menu's Tutorial button: the next heart started runs the tutorial. */
let wantTutorial = false;
const coachEl = $('coach');
let coachSig = '';
/** Start the tutorial on a fresh heart if it is wanted (asked for, or never seen in this career). */
function maybeTutorial() {
  tut = s.level === 0 && s.wave === 1 && (wantTutorial || !career.tutorialSeen) ? startTutorial(s) : null;
  wantTutorial = false; coachSig = '';
}
function endTutorial() {
  tut = null; coachSig = ''; career.tutorialSeen = true; saveNow();
  coachEl.hidden = true; document.querySelectorAll('.coach-hl').forEach((el) => el.classList.remove('coach-hl'));
}
coachEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-coach]') as HTMLElement | null;
  if (!el || !tut) return;
  if (el.dataset.coach === 'skip') { endTutorial(); toast('Tutorial skipped. The menu can replay it.'); return; }
  tutorialNext(tut); coachSig = '';
  if (!tut.step) endTutorial();
});
/** Draw the coach: the callout box beside what it points at, and a highlight on panel controls. */
function renderCoach() {
  const text = tut && !menuPage ? tutorialText(tut, s) : null;
  const target = tut && text ? tutorialTarget(tut, s) : null;
  view.coachAt = target?.at ?? null;
  const sig = JSON.stringify([tut?.step, text?.title, target, panel.innerHTML.length]);
  if (sig === coachSig) return;
  coachSig = sig;
  document.querySelectorAll('.coach-hl').forEach((el) => el.classList.remove('coach-hl'));
  if (!tut || !text) { coachEl.hidden = true; return; }
  const sel = target?.panel === 'start' ? '[data-act=start]' : target?.panel === 'no' ? '.nogauge' : target?.panel === 'pulse' ? '[data-act=pulse]' : '';
  if (sel) panel.querySelector(sel)?.classList.add('coach-hl');
  coachEl.innerHTML = `<h3>${esc(text.title)}</h3><p>${esc(text.body)}</p><div class="coachButtons">${manualStep(tut) && text.button ? `<button data-coach="next" class="primary">${esc(text.button)}</button>` : ''}${tut.step !== 'done' ? '<button data-coach="skip">Skip tutorial</button>' : ''}</div>`;
  coachEl.hidden = false;
  // beside the map point it is about, else at the bottom of the map
  const field = canvas.parentElement!, fw = field.clientWidth, fh = field.clientHeight, cw = coachEl.offsetWidth, ch = coachEl.offsetHeight;
  if (target?.at) {
    const x = (target.at.x / W) * fw, y = (target.at.y / H) * fh;
    const left = target.at.x > W * 0.5 ? x - cw - 40 : x + 40;
    coachEl.style.left = `${Math.max(6, Math.min(fw - cw - 6, left))}px`;
    coachEl.style.top = `${Math.max(6, Math.min(fh - ch - 6, y - ch / 2))}px`;
  } else { coachEl.style.left = '12px'; coachEl.style.top = `${Math.max(6, fh - ch - 12)}px`; }
}

/** Endless mode on a cleared organ: its waves come round again, stronger each time, until it falls. */
function playEndless(i: number, confirmed = false) {
  if (!career.cleared[i]) { toast('Clear this organ first to play it endlessly.'); return; }
  if (!confirmed && runInProgress()) { openMenu({ page: 'switch', level: i, endless: true }); return; }
  const sp = s.speed; s = newGame(i, perksOf(career), undefined, true); s.speed = sp;
  closeSite(); closeMenu(); lastSig = ''; overlaySig = ''; lastPhase = ''; spentToasted = 0; gameShown = true; s.paused = false; pausedBeforeMenu = false;
  const best = career.endless[LEVELS[i].id]?.[0]?.waves;
  toast(`Endless: the ${organTitle(i).toLowerCase()}. Waves keep coming, stronger each time${best != null ? `; your best is ${best} waves` : ''}.`);
}

function playLevel(i: number, confirmed = false) {
  if (i >= unlocked) { toast('Clear the previous organ to unlock this one.'); return; }
  if (!confirmed && runInProgress()) { openMenu({ page: 'switch', level: i }); return; }
  const sp = s.speed; s = newGame(i, perksOf(career)); s.speed = sp;
  closeSite(); closeMenu(); lastSig = ''; overlaySig = ''; lastPhase = ''; spentToasted = 0;
  maybeTutorial();
  const miss = missingTargets(i, s.perks);
  toast(miss.length ? `Level ${i + 1}: the ${organTitle(i).toLowerCase()} brings ${miss.map((b) => CONFIG.pathogens[b].plural).join(' and ')}, and you have no IgG target for ${miss.length > 1 ? 'them' : 'it'} yet.` : `Level ${i + 1}: defend the ${organTitle(i).toLowerCase()}.`);
}

// ── Saving: at the start of every build phase, and when an organ is won or lost ──
let lastPhase = '';
/** Gold paid for the organ just won (shown on the victory screen). */
let lastPaid = 0, lastFirstClear = false;
function autosave() {
  const key = `${s.level}:${s.wave}:${s.phase}`;
  if (!gameShown || key === lastPhase) return;
  lastPhase = key;
  if (s.phase === 'prep') { career.run = snapshot(s); saveNow(); }
  else if (s.phase === 'victory' || s.phase === 'defeat') { lastFirstClear = s.phase === 'victory' && !s.endless && !career.cleared[s.level]; lastPaid = onOrganEnd(career, s); unlocked = unlockedCount(career); saveNow(); lastSig = ''; }
}

// ── The menu ────────────────────────────────────────────────────────────────
type MenuPage = { page: 'main' } | { page: 'organs' } | { page: 'endless' } | { page: 'shop' } | { page: 'confirmNew' } | { page: 'switch'; level: number; endless?: boolean };
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
        ${run ? `<button data-menu="continue" class="primary">Continue<small>${esc(organTitle(run.level))} · ${run.endless ? `endless, wave ${run.wave}` : `wave ${run.wave} of ${LEVELS[run.level].waves.length}`}</small></button>` : ''}
        <button data-menu="new" ${run ? '' : 'class="primary"'}>New career</button>
        <button data-menu="organs">Organs<small>${unlocked} unlocked</small></button>
        <button data-menu="endless" ${cleared ? '' : 'disabled'}>Endless<small>${cleared ? 'cleared organs, waves without end · your leaderboard' : 'clear an organ first'}</small></button>
        <button data-menu="tutorial">Tutorial<small>a guided first wave on the heart</small></button>
        <button data-menu="shop">Upgrades<small>${career.gold} gold</small></button>
        ${gameShown ? '<button data-menu="close">Back to the game</button>' : ''}
      </div>`;
  } else if (menuPage.page === 'organs') {
    h = `<h2>Organs</h2><p class="sub">Clear an organ to unlock the next. Cleared organs can be replayed.</p>
      <div class="menuButtons">${LEVELS.map((l, i) => `<button data-menu="level" data-level="${i}" ${i < unlocked ? '' : 'disabled'}>${i + 1}. ${esc(organTitle(i))}<small>${i >= unlocked ? 'locked' : career.cleared[i] ? `cleared · best ${career.best[i]}/${l.hp}` : esc(l.tagline)}${i < unlocked && missingTargets(i, perksOf(career)).length ? `<br><b class="needs">no IgG target yet for ${missingTargets(i, perksOf(career)).map((b) => CONFIG.pathogens[b].plural).join(', ')}</b>` : ''}</small></button>`).join('')}</div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'endless') {
    const E = CONFIG.endless;
    h = `<h2>Endless</h2><p class="sub">A cleared organ, its waves coming round again and again: ${Math.round(E.countGrowth * 100)}% more pathogens and ${Math.round(E.hpGrowth * 100)}% more health each wave, a boss up every vessel every ${E.bossEvery} waves. Hold out as long as you can: ${E.goldPerWave} gold a wave cleared, and your ${E.boardSize} best runs on each organ are kept below.</p>
      <div class="endlessList">${LEVELS.map((l, i) => {
        const board = career.endless[l.id] ?? [], open = career.cleared[i];
        return `<section class="card"><h3>${i + 1}. ${esc(organTitle(i))} <span class="count">${board.length ? `best ${board[0].waves} waves` : open ? 'no runs yet' : 'locked'}</span></h3>
          ${board.length ? `<ol class="board">${board.map((r, k) => `<li><b>${r.waves}</b> wave${r.waves === 1 ? '' : 's'} <small>${esc(r.date)}</small>${k === 0 ? ' <span class="bossTag">BEST</span>' : ''}</li>`).join('')}</ol>` : ''}
          <button data-menu="playEndless" data-level="${i}" ${open ? '' : 'disabled'}>${open ? 'Play endless' : 'Clear it first'}</button></section>`;
      }).join('')}</div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'shop') {
    const row = (id: UpgradeId, iconHtml = '', extra = '') => {
      const u = UPGRADES[id], have = career.bought[id] ?? 0, chk = buyCheck(career, id);
      const pips = u.prices.length > 1 ? `<span class="pips">${u.prices.map((_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<li>${iconHtml}<span><b>${esc(u.name)}</b> ${pips}<small>${esc(u.blurb)}${extra ? ` ${esc(extra)}` : ''}</small></span><button data-menu="buy" data-up="${id}" ${chk.ok ? '' : 'disabled'} title="${esc(chk.reason)}">${have >= u.prices.length ? (u.prices.length > 1 ? 'Maxed' : 'Owned') : `${chk.price} gold`}</button></li>`;
    };
    const where = (b: BacteriumType) => LEVELS.map((_, i) => (organBacteria(i).includes(b) ? organTitle(i) : '')).filter(Boolean).join(', ');
    const nodeImg = (n: NodeType) => `<img alt="" src="${nodeIcon(n)}" width="40" height="31">`;
    h = `<h2>Upgrades</h2><p class="sub">You have <b>${career.gold}</b> gold. Clear organs to earn more (a quarter on a replay). Upgrades apply at once; an extra starting node from the next organ you start.</p>
      <div class="shop">
        <h3>Node damage</h3><ul>${(['igm', 'igg', 'iga', 'ige'] as NodeType[]).map((n) => row(`dmg-${n}` as UpgradeId, nodeImg(n))).join('')}</ul>
        <h3>IgG targets</h3><p class="sub"><i>S. aureus</i> is always unlocked.</p><ul>${BACTERIA.filter((b) => b !== 'saureus').map((b) => row(`target-${b}` as UpgradeId, icon(b, 34), `Comes in: ${where(b)}.`)).join('')}</ul>
        <h3>Special</h3><ul>${(['dual', 'no', 'extraNode', 'cheapFirst'] as UpgradeId[]).map((id) => row(id)).join('')}</ul>
      </div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'confirmNew') {
    h = `<h2>Start over?</h2><p>Your cleared organs${career.gold ? ', gold' : ''} and the game in progress will be lost.</p>
      <div class="menuButtons"><button data-menu="newYes" class="primary danger">Start a new career</button><button data-menu="back">Keep my career</button></div>`;
  } else {
    const L = levelDef(s), same = menuPage.level === s.level && !menuPage.endless && !s.endless;
    if (menuPage.endless) h = `<h2>Leave the ${esc(L.organ.toLowerCase())}?</h2><p>This ends your ${esc(organTitle(s.level).toLowerCase())} run (wave ${s.wave}).</p>
      <div class="menuButtons"><button data-menu="switchEndless" data-level="${menuPage.level}" class="primary">Play the ${esc(organTitle(menuPage.level).toLowerCase())} endlessly</button><button data-menu="close">Stay</button></div>`;
    else h = same
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
  if (a === 'shop') openMenu({ page: 'shop' });
  if (a === 'borrow') borrow(el.dataset.target as BacteriumType);
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
  if (a?.dataset.act === 'endlessBoard') openMenu({ page: 'endless' });
});
$('btnMenu').addEventListener('click', () => (menuPage ? closeMenu() : openMenu()));
menuEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-menu]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.menu;
  if (a === 'continue' && career.run) {
    const sp = s.speed; s = resumeGame(career.run, perksOf(career)); s.speed = sp; lastPhase = ''; maybeTutorial(); spentToasted = 0; gameShown = true; closeMenu(); pausedBeforeMenu = false; s.paused = false;
    toast(`Welcome back: the ${organTitle(s.level).toLowerCase()}, wave ${s.wave}.`);
  } else if (a === 'new') { if (careerStarted()) openMenu({ page: 'confirmNew' }); else startCareer(); }
  else if (a === 'newYes') startCareer();
  else if (a === 'organs') openMenu({ page: 'organs' });
  else if (a === 'endless') openMenu({ page: 'endless' });
  else if (a === 'playEndless') playEndless(Number(el.dataset.level));
  else if (a === 'switchEndless') playEndless(Number(el.dataset.level), true);
  else if (a === 'shop') openMenu({ page: 'shop' });
  else if (a === 'buy') {
    const id = el.dataset.up as UpgradeId, r = buy(career, id);
    if (r.ok) { saveNow(); s.perks = perksOf(career); toast(`${UPGRADES[id].name} bought.`); } else toast(r.reason);
    const y = menuEl.scrollTop; renderMenu(); menuEl.scrollTop = y;
  }
  else if (a === 'back') openMenu({ page: 'main' });
  else if (a === 'close') { gameShown = true; closeMenu(); }
  else if (a === 'level') { gameShown = true; playLevel(Number(el.dataset.level)); if (menuPage?.page !== 'switch') { s.paused = false; pausedBeforeMenu = false; } }
  else if (a === 'tutorial') { wantTutorial = true; gameShown = true; playLevel(0); if (menuPage?.page !== 'switch') { s.paused = false; pausedBeforeMenu = false; } }
  else if (a === 'switchYes') { gameShown = true; pausedBeforeMenu = false; playLevel(Number(el.dataset.level), true); s.paused = false; }
});
function startCareer() {
  // a new career starts over, but someone who has seen the tutorial needn't see it again
  const seen = career.tutorialSeen; career = freshCareer(); career.tutorialSeen = seen; unlocked = unlockedCount(career); saveNow();
  const sp = s.speed; s = newGame(0, perksOf(career)); s.speed = sp; lastPhase = ''; spentToasted = 0; gameShown = true;
  closeMenu(); pausedBeforeMenu = false; s.paused = false;
  maybeTutorial();
  toast('A new career: defend the heart.');
}
$('btnPause').addEventListener('click', togglePause);
$('btnSpeed').addEventListener('click', () => { s.speed = nextSpeed(s.speed); });
const toggleSound = () => { unlockAudio(); setMuted(!isMuted()); toast(isMuted() ? 'Sound off.' : 'Sound on.'); };
$('btnSound').addEventListener('click', toggleSound);
// browsers only allow sound after the player has touched the page
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
$('btnRestart').addEventListener('click', restart);
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  const keyed = /^[1-9]$/.test(e.key) ? map.VESSEL_IDS[Number(e.key) - 1] : undefined;
  if ((e.key === 'm' || e.key === 'M') && tag !== 'INPUT') { toggleSound(); return; }
  if (menuPage) { if (e.key === 'Escape' && gameShown && menuPage.page !== 'switch') { if (menuPage.page === 'main') closeMenu(); else openMenu({ page: 'main' }); } return; }
  if (keyed) choose(keyed);
  // Esc closes a pathogen's details first, then steps back from the IgG target list, then closes the build menu
  else if (e.key === 'Escape') { if (view.inspectId != null) closeInspect(); else if (view.selectedSite && view.popMode !== 'main') openSite(view.selectedSite, 'main'); else closeSite(); }
  // I steps through the pathogens on the map, the one nearest the organ first, showing each one's details
  else if ((e.key === 'i' || e.key === 'I') && s.phase === 'combat') {
    const on = s.pathogens.filter((p) => p.hp > 0 && p.s > 0).sort((a, b) => b.s / map.VESSELS[b.vessel].length - a.s / map.VESSELS[a.vessel].length);
    if (!on.length) { toast('No pathogens on the map yet.'); return; }
    const i = on.findIndex((p) => p.id === view.inspectId), next = on[(i + 1) % on.length];
    view.inspectId = next.id; inspectSig = ''; inspectEl.hidden = false; updateInspect();
  }
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
  return JSON.stringify([s.level, unlocked, s.phase, s.paused, s.wave, s.phase === 'combat' && surging(s), s.open.join(), s.no >= openNeed(), s.cells.map((c) => c.mode).join(), s.pulsesLeft, s.energy, s.nodes.length, aliveCells(s).length, s.infections, s.phase === 'combat' ? pulseTargets(s).length : 0]);
}


function lungsLine(): string {
  const sg = levelDef(s).surge;
  if (!sg) return '';
  if (surging(s)) return '<p class="notice">Inhaling: everything in the vessels surges forward.</p>';
  const next = sg.every - sg.length - (s.waveTime % sg.every);
  return `<p class="hint small">Next breath in ${Math.ceil(next)}s.</p>`;
}

/** After a wave: what came up each vessel, and what it cost, so the next build can learn from it. */
function lastWaveHtml(): string {
  const log = s.waveLog;
  if (!log || s.phase !== 'prep') return '';
  const rows = map.ENTRY_IDS.map((e) => {
    const mine = log.came.filter((x) => x.entry === e);
    if (!mine.length) return '';
    const cost = log.cost[e] ?? 0;
    return `<li><b>${esc(map.entryDef(e).name)}</b>: ${mine.map((x) => `${x.n} ${esc(x.n === 1 ? CONFIG.pathogens[x.type].name : CONFIG.pathogens[x.type].plural)}`).join(', ')}${cost ? ` <span class="needs">· cost ${cost} health</span>` : ''}</li>`;
  }).join('');
  return `<section class="card"><h3>Last wave</h3><ul class="lastwave">${rows}</ul></section>`;
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
      ${(() => { const miss = missingTargets(s.level, s.perks).filter((b) => !s.borrowed.includes(b)); return miss.length ? `<p class="notice">Bacteria here you have no IgG target for: ${bugNames(miss)}. An IgG aimed at something else hits them at only ×0.5 to ×2. <button data-act="shop">Upgrades (${career.gold} gold)</button></p>
        <details class="borrow"><summary>Borrow a target for this organ · ${CONFIG.borrowTargetGold} gold each</summary><div class="flist">${miss.map((b) => `<button data-act="borrow" data-target="${b}" ${career.gold >= CONFIG.borrowTargetGold ? '' : 'disabled'}><i>${esc(CONFIG.pathogens[b].plural)}</i></button>`).join('')}</div></details>` : ''; })()}
      ${s.borrowed.length ? `<p class="hint small">Borrowed for this organ: ${bugNames(s.borrowed)}. At most ${CONFIG.iggPerTarget} IgG nodes may aim at each bacterium.</p>` : `<p class="hint small">At most ${CONFIG.iggPerTarget} IgG nodes may aim at each bacterium on an organ.</p>`}
      <h2><small>Prepare · ${s.endless ? `endless, wave ${s.wave}` : `wave ${s.wave} of ${totalWaves(s)}`}</small>${esc(def.title)}</h2>
      <p class="hint">What comes, and up which vessels, you will see once the wave begins: build for anything.</p>
      ${s.message ? `<p class="notice">${esc(s.message)}</p>` : ''}
      ${lastWaveHtml()}
      <section class="card"><h3>Dilation <span class="count"><span data-no>${Math.floor(s.no)}</span> NO</span></h3>
        <p class="hint">During the wave, open vessels with NO, as many as you have white cells. Opening costs ${CONFIG.no.openCost}; each open vessel drains NO; all closed, it refills.</p></section>
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
    const openNames = s.open.map((v) => esc(vesselName(v).toLowerCase()));
    const where = s.open.length ? (out ? `Patrolling the ${openNames.join(' and the ')}${s.open.length > 1 ? `, split ${s.open.length} ways` : ''}.` : `Heading home before setting out along the ${openNames.join(' and the ')}.`) : returning ? `Returning to the ${organ}.` : `Waiting at the ${organ}: open a vessel to send them out.`;
    const noLow = s.no < openNeed() && !s.open.length;
    h = `<h2><small>Defend · ${s.endless ? `endless, wave ${s.wave}` : `wave ${s.wave} of ${totalWaves(s)}`}</small>${esc(def.title)}</h2><p class="hint">${esc(def.hint)}</p>
      <section class="card"><h3>Dilate <span class="count"><span data-no>${Math.floor(s.no)}</span> / ${s.perks.noMax} NO</span></h3>
        <p class="nogauge ${noLow ? 'low' : ''}" role="img" aria-label="NO ${Math.floor(s.no)} of ${s.perks.noMax}${noLow ? ', too low to open a vessel' : ''}"><i data-nobar style="width:${(s.no / s.perks.noMax) * 100}%"></i></p>${noLow ? '<p class="hint small needs">NO is too low to open a vessel: it refills while every vessel is closed.</p>' : ''}
        <div class="choice">${map.VESSEL_IDS.map((v, i) => `<button data-act="dilate" data-v="${v}" aria-pressed="${s.open.includes(v)}" class="${s.open.includes(v) ? 'on' : ''}" ${dilateCheck(s, v).ok ? '' : 'disabled'} title="${esc(dilateCheck(s, v).reason)}">${vesselName(v)}<small>${s.open.includes(v) ? `open · key ${i + 1} closes` : `resting · key ${i + 1}`}</small></button>`).join('')}</div>
        <p class="hint">Open as many vessels as you have white cells: they are split evenly among them. Opening costs ${CONFIG.no.openCost} NO (you need ${openNeed()} to open), and an open vessel drains ${CONFIG.no.drainPerSec} a second; each more vessel costs only ${CONFIG.no.extraOpenCost} to open and drains ${CONFIG.no.extraDrainPerSec} more a second, and while all are closed NO refills ${CONFIG.no.regenPerSec} a second. When NO runs out every vessel closes.</p></section>
      <section class="card"><h3>White cells <span class="count">${cells} of ${levelDef(s).cells}</span></h3>
        <p class="cells">${Array.from({ length: levelDef(s).cells }, (_, i) => `<span class="${i < cells ? '' : 'lost'}">${icon('cell', 30)}</span>`).join('')}</p>
        <p class="hint">${where}${s.infections ? ` <b>${s.infections} infected</b> by hijacker viruses: they now head for the ${esc(levelDef(s).organ.toLowerCase())}.` : ' Keep them clear of hijacker viruses.'}</p></section>
      <section class="card"><h3>Immune pulse <span class="count">${s.pulsesLeft} left</span></h3>
        <button data-act="pulse" class="pulse" ${pc.ok ? '' : 'disabled'}>${s.pulsesLeft > 0 ? 'Immune pulse' : 'Pulse used'}</button>
        ${lungsLine()}
        <p class="hint">${s.pulsesLeft > 0 ? `Each white cell touching a pathogen destroys it (a boss loses a third of its health) and dies doing it; lost cells return next wave. <b>Right now ${would ? `${would} cell${would === 1 ? '' : 's'} would strike` : 'no cell is touching a pathogen'}.</b> Space bar works too.` : 'One pulse per wave. It returns next wave.'}</p></section>`;
  } else if (s.phase === 'recall') {
    h = `<h2><small>Wave ${s.wave} cleared</small>Recalling white cells</h2><p class="hint">Survivors return to the ${esc(levelDef(s).organ.toLowerCase())}, then the vessel contracts.</p>`;
  } else {
    const L = levelDef(s), next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    h = `<h2><small>${s.phase === 'victory' ? 'Level complete' : s.endless ? 'Endless run over' : `The ${L.organ.toLowerCase()} has failed`}</small>${s.phase === 'victory' ? `The ${esc(organTitle(s.level).toLowerCase())} ${s.level === 1 ? 'are' : 'is'} safe` : s.endless ? `${Math.max(0, s.wave - 1)} wave${s.wave === 2 ? '' : 's'} held` : 'Defeat'}</h2><div class="start">${s.phase === 'victory' && next >= 0 ? `<button data-act="level" data-level="${next}" class="primary">Next: ${esc(LEVELS[next].title)}</button> ` : ''}<button data-act="restart" ${s.phase === 'victory' && next >= 0 ? '' : 'class="primary"'}>${s.phase === 'victory' ? 'Play again' : s.endless ? 'Again' : 'Restart'}</button></div>`;
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
  $('wave').textContent = s.endless ? `${s.wave} · endless` : `${Math.min(s.wave, totalWaves(s))}/${totalWaves(s)}`;
  $('energy').textContent = String(s.energy);
  $('gold').textContent = String(career.gold);
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
  $('btnSound').textContent = isMuted() ? 'Sound off' : 'Sound on';
  document.body.dataset.phase = s.phase;
}

let lastNoOuts = 0, spentToasted = 0;
let overlaySig = '';
/** The defeat screen's explanation: where the damage came from, and what would have helped. */
function defeatAdvice(): string {
  const sum = leakSummary(s), organ = esc(levelDef(s).organ.toLowerCase());
  if (!sum) return `<p>Too many pathogens reached the ${organ}.</p>`;
  if (sum.kind === 'remake') return `<p>${Math.round(sum.share * 100)}% of the damage was the ${organ} remaking lost white cells.</p><p class="tip"><b>Next time:</b> ${esc(sum.advice)}</p>`;
  const st = CONFIG.pathogens[sum.type], who = st.boss ? `the ${esc(st.name.toLowerCase())}` : st.taxon ? `<i>${esc(st.plural)}</i>` : esc(st.plural.toLowerCase());
  const where = `${Math.round(sum.share * 100)}% of the damage came up the ${esc(map.entryDef(sum.vessel).name.toLowerCase())}`;
  return `<p>${where}, and ${who} did the most harm.</p><p class="tip"><b>Next time:</b> ${esc(sum.advice)}</p>${/Upgrades/.test(sum.advice) ? `<p><button data-act="shop">Upgrades (${career.gold} gold)</button></p>` : ''}`;
}
function renderOverlay() {
  const sig = `${s.phase}|${s.paused}`;
  if (sig === overlaySig) return;
  overlaySig = sig;
  const L = levelDef(s), org = organTitle(s.level).toLowerCase(), plural = s.level === 1 ? 'are' : 'is';
  if (s.phase === 'victory') {
    lastSig = '';
    const next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    overlay.hidden = false; overlay.className = 'victory';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Level ${s.level + 1} complete</p><h2>The ${esc(org)} ${plural} safe</h2><p>${esc(L.organ)} health ${s.heartHp}/${L.hp} · ${s.killed} pathogens destroyed</p>${lastPaid ? `<p class="gold">+${lastPaid} gold · ${career.gold} in all <button data-act="shop">Upgrades</button></p>` : ''}${next >= 0 ? `<p>${lastFirstClear ? 'Unlocked' : 'Next'}: <b>${esc(LEVELS[next].title)}</b>. ${esc(LEVELS[next].tagline)}</p><button data-act="level" data-level="${next}" class="primary">Next organ</button> <button data-act="restart">Play again</button>` : '<p><b>Every organ is safe.</b> The whole body has been defended.</p><button data-act="restart" class="primary">Play again</button>'}</div>`;
  } else if (s.phase === 'defeat' && s.endless) {
    // an endless run ends here: how far it got, and where that puts it on the board
    const waves = Math.max(0, s.wave - 1), board = career.endless[L.id] ?? [];
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Endless · the ${esc(org)}</p><h2>${waves} wave${waves === 1 ? '' : 's'} held</h2>
      <p>${lastPlace === 1 ? '<b>A new best!</b>' : lastPlace ? `<b>#${lastPlace}</b> on your ${esc(org)} board (best: ${board[0]?.waves ?? waves} waves).` : `Not in your top ${CONFIG.endless.boardSize} (best: ${board[0]?.waves ?? 0} waves).`}</p>
      ${lastPaid ? `<p class="gold">+${lastPaid} gold · ${career.gold} in all</p>` : ''}${defeatAdvice()}
      <button data-act="restart" class="primary">Again</button> <button data-act="endlessBoard">Leaderboard</button></div>`;
  } else if (s.phase === 'defeat') {
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Wave ${s.wave}</p><h2>The ${esc(L.organ.toLowerCase())} has failed</h2>${defeatAdvice()}<button data-act="restart" class="primary">Restart</button></div>`;
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
  renderCoach();
  if (s.phase !== 'prep' && !popover.hidden) closeSite();
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  draw(ctx, s, view, now / 1000);
}

let last = performance.now(), preparedFor = -1;

// ── A text description of the map for screen readers, updated as the wave goes ──
let mapSig = '';
function describeMap() {
  const L = levelDef(s), on = s.pathogens.filter((p) => p.hp > 0 && p.s > 0);
  const byEntry = map.ENTRY_IDS.map((e) => [map.entryDef(e).name, on.filter((p) => map.entryOf(p.vessel) === e).length] as const).filter(([, n]) => n);
  const text = `${L.title}, wave ${s.wave} of ${L.waves.length}, ${s.phase === 'combat' ? 'under attack' : s.phase === 'prep' ? 'building' : s.phase}. ${L.organ} health ${s.heartHp} of ${L.hp}. `
    + (s.phase === 'combat' ? `${on.length} pathogens on the map${byEntry.length ? `: ${byEntry.map(([n, k]) => `${k} on the ${n.toLowerCase()}`).join(', ')}` : ''}. ${s.open.length ? `Open: ${s.open.map((v) => vesselName(v).toLowerCase()).join(', ')}.` : 'Every vessel is resting.'}` : `${s.nodes.length} lymph nodes placed.`);
  // only when something a listener would care about changes, not every frame
  const sig = text.replace(/\d+ pathogens/, (m) => `${Math.round(parseInt(m) / 5) * 5}`);
  if (sig === mapSig) return;
  mapSig = sig; canvas.setAttribute('aria-label', text);
}

// ── One-time tips: each new rule explained once, the first time it matters ──
const tipEl = $('tip');
let tipShown: string | null = null;
const TIPS: { id: string; when: () => boolean; title: string; body: string }[] = [
  { id: 'hidden', when: () => s.phase === 'prep' && s.level > 0, title: 'You won\'t see what is coming',
    body: 'A wave\'s pathogens, and the vessels they take, show only once it starts. After each wave, the panel lists what came up each vessel and what it cost: build for the next from that.' },
  { id: 'inspect', when: () => s.phase === 'combat' && s.pathogens.some((p) => p.s > 0), title: 'What is that?',
    body: 'Click or tap any pathogen (or press I) to see its details: its health, speed, how hard your IgG hits it, and its tricks.' },
  { id: 'borrow', when: () => s.phase === 'prep' && missingTargets(s.level, s.perks).some((b) => !s.borrowed.includes(b)), title: 'Borrow an IgG target',
    body: 'Bacteria come here that you have no IgG target for. Buy one for good in Upgrades (120 gold), or borrow it for this organ only for 30 gold, from the panel. At most two IgG nodes may aim at any one bacterium.' },
  { id: 'multi', when: () => s.phase === 'combat' && s.level > 0 && aliveCells(s).length >= 2 && s.open.length === 1, title: 'Open more than one vessel',
    body: 'You can open as many vessels as you have white cells: they split evenly between them. Each more vessel is cheap to open and drains NO only a little faster.' },
  { id: 'gallbladder', when: () => s.phase === 'prep' && !!levelDef(s).gallbladder, title: 'Mind the gallbladder',
    body: 'If the liver falls to half health, its gallbladder bursts and bile destroys two of your lymph nodes. The green drop on the health ring marks the point.' },
  { id: 'hiv', when: () => s.phase === 'prep' && levelDef(s).id === 'lymphnode' && s.wave === levelDef(s).waves.length, title: 'HIV is coming',
    body: 'The last wave sends HIV up every vessel. White cells can\'t touch it, and every lymph node it passes is switched off for the rest of the wave: kill it far out, with IgM and IgE.' },
];
function tips() {
  if (tut || menuPage || !gameShown) { tipEl.hidden = true; return; }
  if (tipShown) return;
  const t = TIPS.find((x) => !career.tips.includes(x.id) && x.when());
  if (!t) return;
  tipShown = t.id;
  tipEl.innerHTML = `<h3>${esc(t.title)}</h3><p>${esc(t.body)}</p><button data-act="tipOk">Got it</button>`;
  tipEl.hidden = false;
}
tipEl.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-act=tipOk]') || !tipShown) return;
  career.tips.push(tipShown); saveNow(); tipShown = null; tipEl.hidden = true;
});

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (tut) { tutorialTick(tut, s); if (!tut.step) endTutorial(); }
  // the tutorial stops time at the moments that can't wait, until the player acts
  if (!s.paused && !(tut && tutorialHolds(tut, s))) advance(s, dt);
  autosave();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  refresh(now);
  updateInspect();
  describeMap();
  playSounds(s, dt);
  tips();
  // once an organ is won, ink the next one while the player reads the result, so it opens without a pause
  if (s.phase === 'victory' && preparedFor !== s.level + 1) { preparedFor = s.level + 1; prepareOrgan(s.level + 1); }
  requestAnimationFrame(frame);
}
resize();
openMenu();
// the game in progress is what Continue opens: make it ready while the menu is up
if (career.run) prepareOrgan(career.run.level);
refresh(performance.now());
requestAnimationFrame(frame);

Object.assign(window, {
  __heart: () => s,
  __level: (i: number) => { unlocked = Math.max(unlocked, i + 1); playLevel(i); return levelDef(s).id; },
  __advance: (sec: number) => { for (let t = 0; t < sec && !s.paused; t += 1 / 30) { if (tut) tutorialTick(tut, s); if (tut && tutorialHolds(tut, s)) break; step(s, 1 / 30); autosave(); } refresh(performance.now()); return { phase: s.phase, wave: s.wave, hp: s.heartHp }; },
  __refresh: () => refresh(performance.now()),
});
