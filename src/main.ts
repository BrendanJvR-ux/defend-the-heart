import './style.css';
import { CONFIG, LEVELS, NODE_TYPES, BACTERIA, DIFFICULTIES, type BacteriumType, type Difficulty, type NodeType, type PathogenType, type VesselId } from './config';
import * as map from './level';
import { W, H, siteById, nearestOnVessel, dist } from './level';
import {
  type State, newGame, step, advance, nextSpeed, toggleRoute, dilateCheck, openNeed, canStartWave, startWave, firePulse, pulseCheck, pulseTargets, outCells,
  aliveCells, wave, resumeGame, leakSummary, nodeCost, buildCheck, placeNode, retargetNode, retargetCheck, nodeAt, levelDef, totalWaves, surging,
  hasTarget, borrowTarget, selectableTargets, aimedAt, openCost, pathogenPos, cancelCheck, cancelNode, igeLife, buyNo, buyNoCheck, buyCell, buyCellCheck,
  cellCount, lodgeCost, stageLevel,
} from './sim';
import { exportCareer, importCareer, loadCareer, saveCareer, snapshot, onOrganEnd, lastPlace, recordEndless, unlockedCount, freshCareer, perksOf, buy, buyCheck, UPGRADES, organBacteria, missingTargets, endlessOpen, type Career, type KV, type UpgradeId } from './career';
import { startTutorial, tutorialTick, tutorialNext, tutorialHolds, tutorialTarget, tutorialText, manualStep, type Tutorial } from './tutorial';
import { unlockAudio, isMuted, setMuted, sfx } from './sound';
import { playSounds } from './soundEvents';
import { pathogenAt, inspectHtml } from './inspect';
import { esc } from './text';
import { ROUTE_KEYS } from './labels';
import { draw, vesselWidth, prepareOrgan, type View } from './draw';
import { icon, nodeIcon } from './icons';
import { setUpLandscape } from './orientation';
import { loadSettings, saveSettings, applySettings, watchSystemMotion, settingsHtml, type Settings } from './settings';
import { howToPlayHtml } from './howto';
import { createNotices } from './notices';

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
const view: View = { hoverVessel: null, hoverSite: null, selectedSite: null, popMode: 'main', broadPick: false, coachAt: null, showPulseRadius: false, touch: matchMedia('(pointer: coarse)').matches };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const panel = $('panel');
const infoEl = $('info'), infoBody = $('infoBody');
const overlay = $('overlay');
const toastEl = $('toast');
const popover = $('popover');
const menuEl = $('menu');

const noticesEl = $('notices');
const notices = createNotices(noticesEl, toastEl, $('bossBar'));
const toast = notices.toast;

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
/** Map units in this many screen pixels: a finger's reach stays the same size however small the map is drawn. */
const px = (n: number) => (n * W) / Math.max(1, canvas.clientWidth);
function vesselAt(p: { x: number; y: number }): VesselId | null {
  let best: VesselId | null = null, bd = Infinity, onStem = false;
  for (const v of map.VESSEL_IDS) {
    const n = nearestOnVessel(map.VESSELS[v], p);
    const reach = vesselWidth(s, v) / 2 + (view.touch ? Math.max(40, px(18)) : 24);
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
  // keep the card beside the pathogen, inside the map (in the map's own coordinates, so it scrolls with a zoomed map)
  const fw = canvas.clientWidth, fh = canvas.clientHeight, pos = pathogenPos(q);
  const x = (pos.x / W) * fw, y = (pos.y / H) * fh;
  const w = inspectEl.offsetWidth, h = inspectEl.offsetHeight;
  inspectEl.style.left = `${Math.max(6, Math.min(fw - w - 6, x + (x + w + 40 > fw ? -w - 30 : 30)))}px`;
  inspectEl.style.top = `${Math.max(6, Math.min(fh - h - 6, y - h / 2))}px`;
}
inspectEl.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act=closeInspect]')) closeInspect(); });

function siteAt(p: { x: number; y: number }): string | null {
  let best: string | null = null, bd = view.touch ? Math.max(52, px(24)) : 40;
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
  career.gold -= fee; sfx.coin(); career.run = snapshot(s); saveNow();
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
    // with the Broad upgrade, the node can be made broad before its target is chosen
    const broad = s.perks.broad ? `<p><button data-act="toggleBroad" aria-pressed="${view.broadPick}" class="${view.broadPick ? 'on' : ''}">Broad: ${view.broadPick ? 'on' : 'off'}<small>${view.broadPick ? `every bacterium of its target's Gram stain counts as the same shape (×2.5) · ${nodeCost(s, 'igg', true)} energy` : `make it broad: ${nodeCost(s, 'igg', true)} energy instead of ${nodeCost(s, 'igg')}`}</small></button></p>` : '';
    popover.innerHTML = `${x}<h3>Aim the IgG node</h3><p class="sub">${MULT_LINE}</p>${broad}
      ${targetButtons('aim', (b) => buildCheck(s, id, 'igg', [b], view.broadPick && s.perks.broad).reason)}${back}`;
  } else if (mode === 'reaim' && node) {
    popover.innerHTML = `${x}<h3>Re-aim the IgG node</h3><p class="sub">Now aimed at ${targetNames(node.targets)}${node.broad ? ', broadly' : ''}. Re-aiming costs ${CONFIG.iggRetarget} energy.</p>
      ${targetButtons('reaim', (b) => node.targets.includes(b) ? 'Already aimed here.' : retargetCheck(s, id, [b]).reason)}${back}`;
  } else if (node) {
    const st = CONFIG.nodes[node.type];
    const left = igeLife(s) - node.wavesFought;
    const life = node.type === 'ige' ? `<p class="notice">Burns out after ${left} more wave${left === 1 ? '' : 's'}.</p>` : '';
    const reaim = selectableTargets(s).length > 1 ? `<button data-act="toreaim">Re-aim (${CONFIG.iggRetarget} energy)</button>` : '';
    const aim = node.type === 'igg' ? `<p class="sub">Aimed at ${targetNames(node.targets)}${node.broad ? ', broadly: every bacterium of its Gram stain counts as the same shape' : ''}.</p>${reaim ? `<p>${reaim}</p>` : ''}` : '';
    const dmg = st.damage * s.perks.dmg[node.type];
    // a node placed since the last wave can be taken back, for everything paid for it
    const cancel = cancelCheck(s, id).ok ? `<p><button data-act="cancel" class="danger">Cancel this node<small>+${node.paid} energy back</small></button></p>` : '';
    popover.innerHTML = `${x}<h3>${esc(st.name)}</h3><p class="sub">Guards the ${esc(vesselName(site.vessel).toLowerCase())}.</p><p>${esc(st.blurb)}</p><p class="sub">${Math.round(dmg * 10) / 10} damage${node.type === 'igg' ? ' × match' : ''} every ${st.cooldown}s${st.slow ? `, slows to ${Math.round(st.slow * 100)}% speed for ${st.slowSeconds}s` : ''}.</p>${aim}${life}${cancel}`;
  } else {
    popover.innerHTML = `${x}<h3>Place a lymph node</h3><p class="sub">Beside the ${esc(vesselName(site.vessel).toLowerCase())}. You have <b>${s.energy}</b> energy.${s.perks.cheapFirst && !s.discountUsed ? ' Your first node this build costs half.' : ''} You can cancel it, for all of it back, until the wave starts.</p>
      <div class="types">${NODE_TYPES.map((t) => {
        const st = CONFIG.nodes[t];
        // IgG still needs a target: judge it with any unlocked target, the next step picks one
        const c = buildCheck(s, id, t, t === 'igg' ? [s.perks.targets[0]] : undefined);
        return `<button data-act="build" data-type="${t}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason)}"><img alt="" src="${nodeIcon(t)}" width="44" height="34"><span><b>${esc(st.short)}</b> · ${nodeCost(s, t)} energy<small>${esc(t === 'ige' ? st.blurb.replace('three waves', `${igeLife(s)} wave${igeLife(s) === 1 ? '' : 's'}`) : st.blurb)}</small></span></button>`;
      }).join('')}</div>`;
  }
  popover.hidden = false;
  // beside the site, on the side with more room, kept wholly inside the map (its own coordinates: a zoomed map scrolls)
  const fw = canvas.clientWidth, fh = canvas.clientHeight;
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
  else if (act === 'toggleBroad') { view.broadPick = !view.broadPick; openSite(id, 'aim'); }
  else if (act === 'borrow') { if (borrow(el.dataset.target as BacteriumType)) openSite(id, view.popMode); }
  else if (act === 'cancel') {
    const type = nodeAt(s, id)?.type, back = cancelNode(s, id);
    if (back) { toast(`${CONFIG.nodes[type!].short} node cancelled: +${back} energy back.`); closeSite(); lastSig = ''; }
  } else if (act === 'build') {
    const type = el.dataset.type as NodeType;
    if (type === 'igg') { openSite(id, 'aim'); return; }
    if (placeNode(s, id, type)) { toast(`${CONFIG.nodes[type].name} placed.`); closeSite(); lastSig = ''; }
  } else if (act === 'aim') {
    const b = el.dataset.target as BacteriumType, broad = view.broadPick && s.perks.broad;
    if (placeNode(s, id, 'igg', [b], broad)) { toast(`${broad ? 'Broad IgG' : 'IgG'} lymph node placed, aimed at ${CONFIG.pathogens[b].plural}.`); closeSite(); lastSig = ''; }
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
    const bug = pathogenAt(s, p, view.touch ? Math.max(8, px(14) - 16) : 0);
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

function restart() { const sp = s.speed, borrowed = s.borrowed, endless = s.endless; s = endless ? newGame(stageLevel(1), perksOf(career), undefined, 1) : newGame(s.level, perksOf(career)); if (!endless) s.borrowed = borrowed; lastPhase = ''; spentToasted = 0; if (tut) { wantTutorial = true; maybeTutorial(); } s.speed = sp; closeSite(); lastSig = ''; overlaySig = ''; toast(endless ? 'A new endless run, from the heart.' : `A fresh start: the ${levelDef(s).organ.toLowerCase()} is at full health.`); }
/** A run worth asking about before it is thrown away: past the first wave, or with nodes built. */
const runInProgress = () => (s.phase === 'prep' || s.phase === 'combat' || s.phase === 'recall') && (s.wave > 1 || s.stage > 1 || s.phase !== 'prep' || s.energy !== Math.round(levelDef(s).startEnergy * CONFIG.difficulty[s.perks.mode].energy));
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
  const fw = canvas.clientWidth, fh = canvas.clientHeight, cw = coachEl.offsetWidth, ch = coachEl.offsetHeight;
  if (target?.at) {
    const x = (target.at.x / W) * fw, y = (target.at.y / H) * fh;
    const left = target.at.x > W * 0.5 ? x - cw - 40 : x + 40;
    coachEl.style.left = `${Math.max(6, Math.min(fw - cw - 6, left))}px`;
    coachEl.style.top = `${Math.max(6, Math.min(fh - ch - 6, y - ch / 2))}px`;
  } else { coachEl.style.left = '12px'; coachEl.style.top = `${Math.max(6, fh - ch - 12)}px`; }
}

/** Leaving an endless run still in play (for another organ, a new run, or Restart): it goes on the board, as if it
 *  had fallen where it was. */
function closeEndlessRun() {
  if (!s.endless || s.phase === 'defeat') return; // a run that has fallen is on the board already
  // at a stage-cleared screen the run has cleared this stage too (the next is saved, waiting)
  if (s.phase === 'victory') recordEndless(career, s.stage, 0, new Date().toISOString());
  else recordEndless(career, s.stage - 1, Math.max(0, s.wave - 1), new Date().toISOString());
  career.run = null; saveNow();
}

/** Endless (once the eye is cleared): a run through organ after organ, from the heart, each stage bigger. */
function playEndless(confirmed = false) {
  if (!endlessOpen(career)) { toast('Clear the eye, the last organ, to open endless.'); return; }
  if (!confirmed && (runInProgress() || (s.endless && s.stage > 1 && s.phase !== 'defeat'))) { openMenu({ page: 'switch', level: 0, endless: true }); return; }
  closeEndlessRun();
  const sp = s.speed; s = newGame(stageLevel(1), perksOf(career), undefined, 1); s.speed = sp;
  closeSite(); closeMenu(); lastSig = ''; overlaySig = ''; lastPhase = ''; spentToasted = 0; gameShown = true; s.paused = false; pausedBeforeMenu = false; organTagFor = '';
  const best = career.endless[career.difficulty]?.[0];
  toast(`Endless: organ after organ, each stage with longer vessels, more sites and bosses at random${best ? `; your best is ${best.stages} stage${best.stages === 1 ? '' : 's'}` : ''}.`);
}
/** Endless: on to the next stage, the next organ, its map grown. */
function nextStage() {
  if (!s.endless || s.phase !== 'victory') return;
  const k = s.stage + 1, sp = s.speed;
  s = newGame(stageLevel(k), perksOf(career), undefined, k); s.speed = sp;
  closeSite(); lastSig = ''; overlaySig = ''; lastPhase = ''; spentToasted = 0; organTagFor = '';
  toast(`Stage ${k}: the ${organTitle(s.level).toLowerCase()}. Longer vessels${map.SITES.length ? `, ${map.SITES.length} build sites` : ''}.`);
}

function playLevel(i: number, confirmed = false) {
  if (i >= unlocked) { toast('Clear the previous organ to unlock this one.'); return; }
  if (!confirmed && (runInProgress() || (s.endless && s.stage > 1))) { openMenu({ page: 'switch', level: i }); return; }
  closeEndlessRun();
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
type MenuPage = { page: 'main' } | { page: 'howto' } | { page: 'settings' } | { page: 'backup' } | { page: 'importConfirm' } | { page: 'organs' } | { page: 'endless' } | { page: 'shop' } | { page: 'confirmNew' } | { page: 'difficulty' } | { page: 'abandon' } | { page: 'switch'; level: number; endless?: boolean };
let menuPage: MenuPage | null = null;
let pendingImport: Career | null = null;
let settings: Settings = loadSettings();
applySettings(settings); watchSystemMotion(() => settings);
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
    // the way on is the highlighted button: the game in progress, else the next organ to clear, else endless
    const next = LEVELS.findIndex((_, i) => i < unlocked && !career.cleared[i]), open = endlessOpen(career);
    const lead = run ? 'continue' : next >= 0 && careerStarted() ? 'next' : open ? 'endless' : 'new';
    h = `<h2>Defend the Heart</h2><p class="kicker">An anatomy tower defence</p>
      <p class="sub">${cleared ? `${cleared} of ${LEVELS.length} organs cleared` : `${LEVELS.length} organs to defend, from the heart to the eye`} · ${esc(CONFIG.difficulty[career.difficulty].name)}.</p>
      <div class="menuButtons">
        ${run ? `<button data-menu="continue" class="primary">Continue<small>${esc(organTitle(run.level))} · ${run.stage ? `endless stage ${run.stage}, wave ${run.wave}` : `wave ${run.wave} of ${LEVELS[run.level].waves.length}`}</small></button>` : ''}
        ${!run && lead === 'next' ? `<button data-menu="level" data-level="${next}" class="primary">Continue<small>next organ: ${esc(LEVELS[next].title)}</small></button>` : ''}
        <button data-menu="new" ${lead === 'new' ? 'class="primary"' : ''}>New career<small>${careerStarted() ? `starts over: a difficulty is kept for a whole career` : 'choose a difficulty'}</small></button>
        <button data-menu="organs">Organs<small>${unlocked} unlocked</small></button>
        <button data-menu="endless" ${open ? '' : 'disabled'} ${lead === 'endless' ? 'class="primary"' : ''}>Endless<small>${open ? 'organ after organ, ever bigger · your leaderboard' : 'clear the eye, the last organ, first'}</small></button>
        <button data-menu="tutorial">Tutorial<small>a guided first wave on the heart</small></button>
        <button data-menu="shop">Upgrades<small>${career.gold} gold</small></button>
        <button data-menu="howto">How to play<small>the whole game on one page</small></button>
        <button data-menu="settings">Settings<small>text size, motion, back up your career</small></button>
        ${gameShown ? '<button data-menu="close">Back to the game</button>' : ''}
      </div>`;
  } else if (menuPage.page === 'howto') {
    h = howToPlayHtml();
  } else if (menuPage.page === 'settings') {
    h = settingsHtml(settings);
  } else if (menuPage.page === 'backup') {
    h = `<h2>Back up or restore</h2>
      <p class="sub">Your career (organs cleared, gold, upgrades, endless runs, the game in progress) is kept in this browser only. Copy this code somewhere safe, or to another device, to bring it back there.</p>
      <textarea id="exportCode" class="code" readonly rows="4" aria-label="Your career as a code">${esc(exportCareer(career))}</textarea>
      <div class="menuButtons"><button data-menu="copyCode" class="primary">Copy the code</button></div>
      <h3>Restore</h3><p class="sub">Paste a code here to replace this career with it.</p>
      <textarea id="importCode" class="code" rows="4" placeholder="DTH1.…" aria-label="A career code to restore"></textarea>
      <div class="menuButtons"><button data-menu="importCode">Restore from this code</button><button data-menu="settings">Back</button></div>`;
  } else if (menuPage.page === 'importConfirm') {
    const c = pendingImport ?? career, n = c.cleared.filter(Boolean).length;
    h = `<h2>Replace your career?</h2><p>The code holds a career on <b>${esc(CONFIG.difficulty[c.difficulty].name)}</b>: ${n} of ${LEVELS.length} organs cleared, ${c.gold} gold${c.run ? `, a game in progress on the ${esc(organTitle(c.run.level).toLowerCase())}` : ''}.</p>
      <p>This career (${cleared} cleared, ${career.gold} gold) will be replaced. Back it up first if you might want it again.</p>
      <div class="menuButtons"><button data-menu="importYes" class="primary danger">Replace it</button><button data-menu="backup">Keep my career</button></div>`;
  } else if (menuPage.page === 'organs') {
    h = `<h2>Organs</h2><p class="sub">Clear an organ to unlock the next. Cleared organs can be replayed.</p>
      <div class="menuButtons">${LEVELS.map((l, i) => `<button data-menu="level" data-level="${i}" ${i < unlocked ? '' : 'disabled'}>${i + 1}. ${esc(organTitle(i))}<small>${i >= unlocked ? 'locked' : career.cleared[i] ? `cleared · best ${career.best[i]}/${l.hp}` : esc(l.tagline)}${i < unlocked && missingTargets(i, perksOf(career)).length ? `<br><b class="needs">no IgG target yet for ${missingTargets(i, perksOf(career)).map((b) => CONFIG.pathogens[b].plural).join(', ')}</b>` : ''}</small></button>`).join('')}</div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'endless') {
    const E = CONFIG.endless, board = career.endless[career.difficulty] ?? [], open = endlessOpen(career);
    h = `<h2>Endless</h2><p class="sub">Organ after organ, from the heart and round again, each one a stage. Every stage cleared, the vessels wind longer, every ${E.sitesEvery} stages each vessel gets another build site, pathogens come tougher and more of them, and bosses turn up at random, more as you go. Each organ starts at full health. ${Math.round(E.goldPerStage * CONFIG.difficulty[career.difficulty].gold)} gold a stage cleared.</p>
      <section class="card"><h3>Your best · ${esc(CONFIG.difficulty[career.difficulty].name)} <span class="count">${board.length ? `${board[0].stages} stage${board[0].stages === 1 ? '' : 's'}` : 'no runs yet'}</span></h3>
        ${board.length ? `<ol class="board">${board.map((r, k) => `<li><b>${r.stages}</b> stage${r.stages === 1 ? '' : 's'}${r.waves ? `, ${r.waves} wave${r.waves === 1 ? '' : 's'} into the next` : ''} <small>${esc(r.date)}</small>${k === 0 ? ' <span class="bossTag">BEST</span>' : ''}</li>`).join('')}</ol>` : ''}</section>
      <div class="menuButtons"><button data-menu="playEndless" class="primary" ${open ? '' : 'disabled'}>${open ? 'Start an endless run' : 'Clear the eye first'}</button><button data-menu="back">Back</button></div>`;
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
        <h3>Special</h3><ul>${(['broad', 'no', 'extraNode', 'cheapFirst'] as UpgradeId[]).map((id) => row(id)).join('')}</ul>
      </div>
      <p><button data-menu="back">Back</button></p>`;
  } else if (menuPage.page === 'confirmNew') {
    h = `<h2>Start over?</h2><p>Your cleared organs${career.gold ? ', gold' : ''} and the game in progress will be lost.</p>
      <div class="menuButtons"><button data-menu="newYes" class="primary danger">Start a new career</button><button data-menu="back">Keep my career</button></div>`;
  } else if (menuPage.page === 'abandon') {
    h = `<h2>End this endless run?</h2><p>You are on stage ${s.stage}, the ${esc(organTitle(s.level).toLowerCase())}, with ${s.stage - 1} stage${s.stage === 2 ? '' : 's'} cleared. Ending it puts it on your leaderboard and starts a new run from the heart.</p>
      <div class="menuButtons"><button data-menu="abandonYes" class="primary danger">End it and start again</button><button data-menu="close">Carry on</button></div>`;
  } else if (menuPage.page === 'difficulty') {
    h = `<h2>Choose a difficulty</h2><p class="sub">It stays for the whole career; to change it later, start a new one. Each keeps its own endless leaderboard. This career: ${esc(CONFIG.difficulty[career.difficulty].name)}.</p>
      <div class="menuButtons">${DIFFICULTIES.map((d) => `<button data-menu="newMode" data-mode="${d}" ${d === 'normal' ? 'class="primary"' : ''}>${esc(CONFIG.difficulty[d].name)}<small>${esc(CONFIG.difficulty[d].blurb)}</small></button>`).join('')}<button data-menu="back">Back</button></div>`;
  } else {
    const L = levelDef(s), same = menuPage.level === s.level && !menuPage.endless && !s.endless;
    // what leaving ends: an endless run (it goes on the board), or this organ's game
    const ends = !s.endless ? `This ends your ${esc(organTitle(s.level).toLowerCase())} run (wave ${s.wave}).`
      : s.phase === 'defeat' ? 'Your endless run is over (it is on your leaderboard).'
      : s.phase === 'victory' ? `This ends your endless run after stage ${s.stage}; it goes on your leaderboard.`
      : `This ends your endless run on stage ${s.stage} (${s.stage - 1} cleared); it goes on your leaderboard.`;
    if (menuPage.endless) h = `<h2>Leave the ${esc(L.organ.toLowerCase())}?</h2><p>${ends}</p>
      <div class="menuButtons"><button data-menu="switchEndless" class="primary">Start an endless run</button><button data-menu="close">Stay</button></div>`;
    else h = same
      ? `<h2>Start the ${esc(L.organ.toLowerCase())} again?</h2><p>This ends your run at wave ${s.wave}.</p>
      <div class="menuButtons"><button data-menu="switchYes" data-level="${menuPage.level}">Start again from wave 1</button><button data-menu="close" class="primary">Carry on at wave ${s.wave}</button></div>`
      : `<h2>Leave the ${esc(L.organ.toLowerCase())}?</h2><p>${ends}</p>
      <div class="menuButtons"><button data-menu="switchYes" data-level="${menuPage.level}" class="primary">Play ${esc(LEVELS[menuPage.level].title)}</button><button data-menu="close">Stay</button></div>`;
  }
  menuEl.innerHTML = `<div class="plate">${h}</div>`;
  menuEl.hidden = false;
  (menuEl.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
/** Has the player got a game in front of them (so "Back to the game" makes sense)? */
let gameShown = false;
function togglePause() { if (s.phase === 'combat' || s.phase === 'prep' || s.phase === 'recall') { s.paused = !s.paused; lastSig = ''; } }

// ── Info: everything worth reading but not needed to play, in a drawer the player opens and closes ──
function setInfo(open: boolean) {
  infoEl.hidden = !open; document.body.classList.toggle('info-open', open);
  panel.querySelector('[data-act=info]')?.setAttribute('aria-expanded', String(open));
  if (open) (infoEl.querySelector('.x') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
$('infoClose').addEventListener('click', () => setInfo(false));
infoEl.addEventListener('click', (e) => { if (e.target === infoEl) setInfo(false); });
function onAct(e: MouseEvent) {
  if (menuPage) return; // the menu is on top of the game
  const el = (e.target as HTMLElement).closest('[data-act]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.act;
  if (a === 'info') { setInfo(infoEl.hidden); return; }
  if (infoEl.contains(el) && a !== 'borrow') setInfo(false);
  if (a === 'dilate') choose(el.dataset.v as VesselId);
  if (a === 'site') openSite(el.dataset.site!);
  if (a === 'start') { if (startWave(s)) { closeSite(); lastSig = ''; } }
  if (a === 'pulse') pulse();
  if (a === 'restart') restart();
  if (a === 'level') playLevel(Number(el.dataset.level));
  if (a === 'shop') openMenu({ page: 'shop' });
  if (a === 'borrow') borrow(el.dataset.target as BacteriumType);
  if (a === 'buyNo') buyWithGold('no');
  if (a === 'buyCell') buyWithGold('cell');
  if (a === 'nextStage') nextStage();
}
panel.addEventListener('click', onAct);
infoBody.addEventListener('click', onAct);

/** Spend gold during an organ: NO at once, or a white cell for the rest of the organ. */
function buyWithGold(what: 'no' | 'cell') {
  const price = CONFIG.goldBuys[what].gold, chk = what === 'no' ? buyNoCheck(s) : buyCellCheck(s);
  if (!chk.ok) { toast(chk.reason); return; }
  if (career.gold < price) { toast(`Needs ${price} gold (you have ${career.gold}).`); return; }
  if (!(what === 'no' ? buyNo(s) : buyCell(s))) return;
  career.gold -= price; sfx.coin();
  if (s.phase === 'prep') career.run = snapshot(s);
  // mid-wave, the save is the build phase this wave began from: it gets what was paid for, so a reload loses nothing
  else if (career.run) {
    if (what === 'cell') career.run.extraCells = s.extraCells;
    else career.run.no = Math.min(s.perks.noMax + CONFIG.goldBuys.no.amount, career.run.no + CONFIG.goldBuys.no.amount);
  }
  saveNow(); lastSig = '';
  toast(what === 'no' ? `+${CONFIG.goldBuys.no.amount} NO (−${price} gold).` : `A white cell joins you for the rest of this organ (−${price} gold).`);
}
const goldButtons = (which: ('no' | 'cell')[]) => which.map((w) => {
  const price = CONFIG.goldBuys[w].gold, chk = w === 'no' ? buyNoCheck(s) : buyCellCheck(s), ok = chk.ok && career.gold >= price;
  const why = !chk.ok ? chk.reason : career.gold < price ? `Needs ${price} gold (you have ${career.gold}).` : '';
  return `<button data-act="${w === 'no' ? 'buyNo' : 'buyCell'}" class="gold" ${ok ? '' : 'disabled'} title="${esc(why)}">${w === 'no' ? `+${CONFIG.goldBuys.no.amount} NO` : '+1 white cell'}<small>${price} gold${w === 'cell' ? ' · this organ' : ''}</small></button>`;
}).join('');
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
  if (a?.dataset.act === 'nextStage') nextStage();
  if (a?.dataset.act === 'endlessStart') playEndless(true);
});
$('btnMenu').addEventListener('click', () => (menuPage ? closeMenu() : openMenu()));
menuEl.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-menu]') as HTMLButtonElement | null;
  if (!el || el.disabled) return;
  const a = el.dataset.menu;
  if (a === 'continue' && career.run) {
    const sp = s.speed; s = resumeGame(career.run, perksOf(career)); s.speed = sp; lastPhase = ''; maybeTutorial(); spentToasted = 0; gameShown = true; closeMenu(); pausedBeforeMenu = false; s.paused = false;
    toast(`Welcome back: the ${organTitle(s.level).toLowerCase()}, wave ${s.wave}.`);
  } else if (a === 'new') { if (careerStarted()) openMenu({ page: 'confirmNew' }); else openMenu({ page: 'difficulty' }); }
  else if (a === 'newYes') openMenu({ page: 'difficulty' });
  else if (a === 'newMode') startCareer(el.dataset.mode as Difficulty);
  else if (a === 'abandonYes') {
    // the run so far goes on the board, as if it had fallen here
    closeEndlessRun();
    gameShown = true; closeMenu(); pausedBeforeMenu = false; s.paused = false; restart();
  }
  else if (a === 'organs') openMenu({ page: 'organs' });
  else if (a === 'endless') openMenu({ page: 'endless' });
  else if (a === 'playEndless') playEndless();
  else if (a === 'switchEndless') playEndless(true);
  else if (a === 'shop') openMenu({ page: 'shop' });
  else if (a === 'buy') {
    const id = el.dataset.up as UpgradeId, r = buy(career, id);
    if (r.ok) { saveNow(); sfx.coin(); s.perks = perksOf(career); toast(`${UPGRADES[id].name} bought.`); } else toast(r.reason);
    const y = menuEl.scrollTop; renderMenu(); menuEl.scrollTop = y;
  }
  else if (a === 'back') openMenu({ page: 'main' });
  else if (a === 'howto') openMenu({ page: 'howto' });
  else if (a === 'settings') openMenu({ page: 'settings' });
  else if (a === 'set') {
    const k = el.dataset.key as keyof Settings, v = el.dataset.value!;
    settings = { ...settings, [k]: v }; saveSettings(settings); applySettings(settings); renderMenu();
  }
  else if (a === 'backup') openMenu({ page: 'backup' });
  else if (a === 'copyCode') {
    const t = menuEl.querySelector<HTMLTextAreaElement>('#exportCode')!;
    t.select();
    navigator.clipboard?.writeText(t.value).then(() => toast('Career code copied.'), () => toast('Select the code and copy it.')) ?? toast('Select the code and copy it.');
  }
  else if (a === 'importCode') {
    const c = importCareer(menuEl.querySelector<HTMLTextAreaElement>('#importCode')!.value);
    if (!c) toast('That is not a career code (it starts DTH1.).');
    else { pendingImport = c; openMenu({ page: 'importConfirm' }); }
  }
  else if (a === 'importYes' && pendingImport) {
    career = pendingImport; pendingImport = null; unlocked = unlockedCount(career); saveNow();
    const sp = s.speed; s = career.run ? resumeGame(career.run, perksOf(career)) : newGame(0, perksOf(career)); s.speed = sp;
    lastPhase = ''; spentToasted = 0; organTagFor = ''; prepareOrgan(s.level); lastSig = '';
    openMenu({ page: 'main' }); toast('Career restored.');
  }
  else if (a === 'close') { gameShown = true; closeMenu(); }
  else if (a === 'level') { gameShown = true; playLevel(Number(el.dataset.level)); if (menuPage?.page !== 'switch') { s.paused = false; pausedBeforeMenu = false; } }
  else if (a === 'tutorial') { wantTutorial = true; gameShown = true; playLevel(0); if (menuPage?.page !== 'switch') { s.paused = false; pausedBeforeMenu = false; } }
  else if (a === 'switchYes') { gameShown = true; pausedBeforeMenu = false; playLevel(Number(el.dataset.level), true); s.paused = false; }
});
function startCareer(mode: Difficulty = 'normal') {
  // a new career starts over, but someone who has seen the tutorial needn't see it again
  const seen = career.tutorialSeen; career = freshCareer(); career.tutorialSeen = seen; career.difficulty = mode; unlocked = unlockedCount(career); saveNow();
  const sp = s.speed; s = newGame(0, perksOf(career)); s.speed = sp; lastPhase = ''; spentToasted = 0; gameShown = true;
  closeMenu(); pausedBeforeMenu = false; s.paused = false;
  maybeTutorial();
  toast(`A new career on ${CONFIG.difficulty[mode].name.toLowerCase()}: defend the heart.`);
}
$('btnPause').addEventListener('click', togglePause);
// switching away mid-wave (another tab, a phone call) pauses the game, so it waits rather than carrying on on return
document.addEventListener('visibilitychange', () => { if (document.hidden && !menuPage && s.phase === 'combat' && !s.paused) { s.paused = true; lastSig = ''; } });
// phones: zoom the map to twice its size inside its frame, and swipe to move around it (remembered)
const mapScroll = $('mapScroll'), btnZoom = $('btnZoom');
function setZoom(on: boolean) {
  mapScroll.classList.toggle('zoomed', on); btnZoom.setAttribute('aria-pressed', String(on)); btnZoom.textContent = on ? 'Zoom out' : 'Zoom';
  try { localStorage.setItem('dth-zoom', on ? 'on' : 'off'); } catch { /* no storage */ }
  // centre on the organ
  if (on) requestAnimationFrame(() => mapScroll.scrollTo({ left: (map.HEART.x / W) * canvas.clientWidth - mapScroll.clientWidth / 2, top: (map.HEART.y / H) * canvas.clientHeight - mapScroll.clientHeight / 2 }));
  closeSite();
}
btnZoom.addEventListener('click', () => setZoom(!mapScroll.classList.contains('zoomed')));
try { if (localStorage.getItem('dth-zoom') === 'on' && matchMedia('(max-width: 760px)').matches) setZoom(true); } catch { /* no storage */ }
$('btnSpeed').addEventListener('click', () => { s.speed = nextSpeed(s.speed); });
setUpLandscape($<HTMLButtonElement>('btnLandscape'));
const toggleSound = () => { unlockAudio(); setMuted(!isMuted()); toast(isMuted() ? 'Sound off.' : 'Sound on.'); };
$('btnSound').addEventListener('click', toggleSound);
// browsers only allow sound after the player has touched the page
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
// Restart mid-way through an endless run would throw the run away: ask first, and put it on the board if it goes
$('btnRestart').addEventListener('click', () => { const live = s.phase === 'prep' || s.phase === 'combat' || s.phase === 'recall'; if (s.endless && live && (s.stage > 1 || runInProgress())) openMenu({ page: 'abandon' }); else restart(); });
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  const keyed = e.key.length === 1 && ROUTE_KEYS.includes(e.key) ? map.VESSEL_IDS[ROUTE_KEYS.indexOf(e.key)] : undefined;
  if ((e.key === 'm' || e.key === 'M') && tag !== 'INPUT' && tag !== 'TEXTAREA') { toggleSound(); return; }
  if (menuPage) { if (e.key === 'Escape' && gameShown && menuPage.page !== 'switch') { if (menuPage.page === 'main') closeMenu(); else openMenu({ page: 'main' }); } return; }
  if (keyed) choose(keyed);
  // Esc closes a pathogen's details first, then steps back from the IgG target list, then closes the build menu
  else if (e.key === 'Escape' && !infoEl.hidden) setInfo(false);
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
let lastSig = '';
function signature() {
  return JSON.stringify([career.gold, s.extraCells, lodgeCost(s), s.stage, s.level, unlocked, s.phase, s.paused, s.wave, s.phase === 'combat' && surging(s), s.open.join(), s.no >= openNeed(), s.cells.map((c) => c.mode).join(), s.pulsesLeft, s.energy, s.nodes.length, aliveCells(s).length, s.infections, s.phase === 'combat' ? pulseTargets(s).length : 0]);
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

/** Infections lodged in the organ, and what they cost at every wave's end. */
function lodgedHtml(): string {
  const rows = (Object.entries(s.lodged) as [PathogenType, number][]).filter(([, n]) => n > 0);
  if (!rows.length) return '';
  return `<p class="notice">Lodged in the ${esc(levelDef(s).organ.toLowerCase())}: ${rows.map(([t, n]) => `${n} <i>${esc(CONFIG.pathogens[t].plural)}</i>`).join(', ')}. They cost <b>${lodgeCost(s)}</b> health at the end of every wave until the organ ends.</p>`;
}

// ── The organ's label: its unique feature and its slight disadvantage, at its start ──
const organTag = document.createElement('div');
organTag.id = 'organTag'; organTag.hidden = true; organTag.setAttribute('role', 'note');
noticesEl.append(organTag);
organTag.addEventListener('click', () => { organTag.hidden = true; organTagFor = `${s.level}:${s.stage}:shut`; });
let organTagFor = '';
function renderOrganTag() {
  const key = `${s.level}:${s.stage}`, L = levelDef(s);
  // shown through the first build and the first seconds of wave 1; a click puts it away
  const want = gameShown && !menuPage && !tut && s.wave === 1 && (s.phase === 'prep' || (s.phase === 'combat' && s.waveTime < 8)) && organTagFor !== `${key}:shut`;
  if (!want) { organTag.hidden = true; return; }
  if (organTagFor !== key) {
    organTagFor = key;
    organTag.innerHTML = `<b>${esc(L.title)}</b>${s.endless ? ` <small>· stage ${s.stage}</small>` : ''}<span>${esc(L.feature)}</span><small class="needs">${esc(L.handicap.text)}</small>`;
  }
  organTag.hidden = false;
}

function renderPanel() {
  const def = wave(s);
  let h = '', info = '';
  if (s.phase === 'prep') {
    const c = canStartWave(s);
    const empties = map.SITES.filter((x) => !nodeAt(s, x.id));
    const L = levelDef(s);
    // Start wave first, where it is seen without scrolling; then the organ, what you can buy, and the build
    // the column keeps what you act on: start the wave, what you can afford, last wave's report; the rest is in Info
    h = `<div class="start top"><button data-act="start" class="primary" ${c.ok ? '' : 'disabled'}>Start wave ${s.wave}</button><span class="hint small">${s.endless ? `Stage ${s.stage} · ` : ''}wave ${s.wave} of ${totalWaves(s)} · ${esc(def.title.replace(/^Stage \d+: /, ''))}</span></div>
      ${lodgedHtml()}
      ${(() => { const miss = missingTargets(s.level, s.perks).filter((b) => !s.borrowed.includes(b)); return miss.length ? `<p class="notice">No IgG target for ${bugNames(miss)}. <button data-act="shop">Upgrades (${career.gold} gold)</button></p>
        <details class="borrow"><summary>Borrow a target for this organ · ${CONFIG.borrowTargetGold} gold each</summary><div class="flist">${miss.map((b) => `<button data-act="borrow" data-target="${b}" ${career.gold >= CONFIG.borrowTargetGold ? '' : 'disabled'}><i>${esc(CONFIG.pathogens[b].plural)}</i></button>`).join('')}</div></details>` : ''; })()}
      ${s.message ? `<p class="notice">${esc(s.message)}</p>` : ''}
      <section class="card"><h3>Lymph nodes <span class="count">${s.energy} energy</span></h3>
        <ul class="key compact">${NODE_TYPES.map((t) => `<li title="${esc(CONFIG.nodes[t].blurb)}"><img alt="" src="${nodeIcon(t)}" width="34" height="26"><b>${CONFIG.nodes[t].short}</b> ${CONFIG.nodes[t].cost + (L.handicap.nodeCost ?? 0)}</li>`).join('')}</ul>
        <p class="hint small">${view.touch ? 'Tap' : 'Click'} a + site to build; ${view.touch ? 'tap' : 'click'} a new node to cancel it.</p></section>
      <section class="card"><h3>Gold <span class="count">${career.gold}</span></h3><div class="flist goldBuys">${goldButtons(['no', 'cell'])}</div></section>
      ${lastWaveHtml()}`;
    info = `<section class="card organ"><h3>Level ${s.level + 1} · ${esc(L.title)}</h3><p class="hint small"><b>${esc(L.tagline)}</b> ${esc(L.twist)}</p><p class="hint small needs">${esc(L.handicap.text)}</p>
        <div class="levels">${LEVELS.map((l, i) => `<button data-act="level" data-level="${i}" class="${i === s.level ? 'on' : ''}" ${i < unlocked ? '' : 'disabled'} title="${i < unlocked ? (i === s.level ? 'Restart this organ' : `Play ${esc(l.title)}`) : 'Locked: clear the previous organ'}">${i + 1}<small>${i < unlocked ? esc(organTitle(i)) : 'locked'}</small></button>`).join('')}</div></section>
      <h2><small>Prepare · ${s.endless ? `stage ${s.stage}, wave ${s.wave} of ${totalWaves(s)}` : `wave ${s.wave} of ${totalWaves(s)}`}</small>${esc(def.title)}</h2>
      <p class="hint">What comes, and up which vessels, you will see once the wave begins: build for anything. Building locks once the wave begins.</p>
      ${s.borrowed.length ? `<p class="hint small">Borrowed for this organ: ${bugNames(s.borrowed)}. At most ${CONFIG.iggPerTarget} IgG nodes may aim at each bacterium.</p>` : `<p class="hint small">At most ${CONFIG.iggPerTarget} IgG nodes may aim at each bacterium on an organ.</p>`}
      <section class="card"><h3>Lymph nodes</h3>
        <p class="hint">Click a + site beside a vessel to place a node. Each fires its immunoglobulin at pathogens on its own vessel.</p>
        <ul class="key">${NODE_TYPES.map((t) => `<li><img alt="" src="${nodeIcon(t)}" width="40" height="31"><span><b>${CONFIG.nodes[t].short}</b> · ${CONFIG.nodes[t].cost + (L.handicap.nodeCost ?? 0)}<small>${esc(CONFIG.nodes[t].blurb)}</small></span></li>`).join('')}</ul>
        <p class="hint small">A node placed since the last wave can be cancelled, for everything paid back: click it.</p>
        <details><summary>Place by list (keyboard)</summary><div class="flist">${empties.map((x) => `<button data-act="site" data-site="${x.id}">${esc(vesselName(x.vessel))} · ${map.siteLabel(x)}</button>`).join('') || '<em>Every site has a node.</em>'}</div></details></section>
      <section class="card"><h3>Dilation <span class="count">${Math.floor(s.no)} NO · ${cellCount(s)} white cell${cellCount(s) === 1 ? '' : 's'}</span></h3>
        <p class="hint">During the wave, open vessels with NO, as many as you have white cells. Opening costs ${CONFIG.no.openCost}; each open vessel drains NO; all closed, it refills.</p></section>`;
  } else if (s.phase === 'combat') {
    const cells = aliveCells(s).length;
    const pc = pulseCheck(s);
    const would = pulseTargets(s).length;
    const out = outCells(s).length, returning = aliveCells(s).some((c) => c.mode === 'returning');
    const organ = esc(levelDef(s).organ.toLowerCase());
    const openNames = s.open.map((v) => esc(vesselName(v).toLowerCase()));
    const where = s.open.length ? (out ? `Patrolling the ${openNames.join(' and the ')}${s.open.length > 1 ? `, split ${s.open.length} ways` : ''}.` : `Heading home before setting out along the ${openNames.join(' and the ')}.`) : returning ? `Returning to the ${organ}.` : `Waiting at the ${organ}: open a vessel to send them out.`;
    const noLow = s.no < openNeed() && !s.open.length;
    h = `<h2 class="waveTitle"><small>${s.endless ? `Stage ${s.stage} · ` : ''}Wave ${s.wave} of ${totalWaves(s)}</small>${esc(def.title)}</h2>${lodgedHtml()}
      <section class="card"><h3>Dilate <span class="count"><span data-no>${Math.floor(s.no)}</span> / ${s.perks.noMax} NO</span></h3>
        <p class="nogauge ${noLow ? 'low' : ''}" role="img" aria-label="NO ${Math.floor(s.no)} of ${s.perks.noMax}${noLow ? ', too low to open a vessel' : ''}"><i data-nobar style="width:${Math.min(100, (s.no / s.perks.noMax) * 100)}%"></i></p>${noLow ? '<p class="hint small needs">Too low to open: it refills while all are closed.</p>' : ''}
        <div class="choice">${map.VESSEL_IDS.map((v, i) => `<button data-act="dilate" data-v="${v}" aria-pressed="${s.open.includes(v)}" class="${s.open.includes(v) ? 'on' : ''}" ${dilateCheck(s, v).ok ? '' : 'disabled'} title="${esc(dilateCheck(s, v).reason)}">${vesselName(v)}<small>${s.open.includes(v) ? (view.touch ? 'open · tap to close' : `open · key ${ROUTE_KEYS[i]}`) : (view.touch ? 'resting' : `key ${ROUTE_KEYS[i]}`)}</small></button>`).join('')}</div>
        <p class="hint small tapHint">Tap a vessel on the map to open or close it.</p>
        <div class="flist goldBuys">${goldButtons(['no'])}</div>
        ${lungsLine()}</section>
      <section class="card"><h3>Immune pulse <span class="count">${s.pulsesLeft} left</span></h3>
        <button data-act="pulse" class="pulse" ${pc.ok ? '' : 'disabled'}>${s.pulsesLeft > 0 ? `Immune pulse${would ? ` · ${would} strike` : ''}` : 'Pulse used'}</button></section>
      <section class="card"><h3>White cells <span class="count">${cells} of ${cellCount(s)}</span></h3>
        <p class="cells">${Array.from({ length: cellCount(s) }, (_, i) => `<span class="${i < cells ? '' : 'lost'}">${icon('cell', 26)}</span>`).join('')}</p>
        ${levelDef(s).cells ? `<div class="flist goldBuys">${goldButtons(['cell'])}</div>` : ''}
        <p class="hint small">${where}${s.infections ? ` <b>${s.infections} infected.</b>` : ''}</p></section>`;
    info = `<h2><small>Defend · ${s.endless ? `stage ${s.stage}, wave ${s.wave} of ${totalWaves(s)}` : `wave ${s.wave} of ${totalWaves(s)}`}</small>${esc(def.title)}</h2><p class="hint">${esc(def.hint)}</p>
      <section class="card"><h3>Dilating</h3><p class="hint">Open as many vessels as you have white cells: they are split evenly among them. Opening costs ${CONFIG.no.openCost} NO (you need ${openNeed()} to open), and an open vessel drains ${CONFIG.no.drainPerSec} a second; each more vessel costs only ${CONFIG.no.extraOpenCost} to open and drains ${CONFIG.no.extraDrainPerSec} more a second, and while all are closed NO refills ${CONFIG.no.regenPerSec} a second. When NO runs out every vessel closes.</p></section>
      <section class="card"><h3>White cells</h3><p class="hint">${s.infections ? `${s.infections} infected by hijacker viruses: each goes for the nearest lymph node on its vessel, and knocks it out for the rest of the wave if it gets there.` : 'Keep them clear of hijacker viruses: an infected cell knocks out the first lymph node it reaches.'}</p></section>
      <section class="card"><h3>Immune pulse</h3><p class="hint">${s.pulsesLeft > 0 ? `Each white cell touching a pathogen destroys it (a boss loses a third of its health) and dies doing it; lost cells return next wave. <b>Right now ${would ? `${would} cell${would === 1 ? '' : 's'} would strike` : 'no cell is touching a pathogen'}.</b> Space bar works too.` : 'One pulse per wave. It returns next wave.'}</p></section>`;
  } else if (s.phase === 'recall') {
    h = `<h2><small>Wave ${s.wave} cleared</small>Recalling white cells</h2><p class="hint">Survivors return to the ${esc(levelDef(s).organ.toLowerCase())}, then the vessel contracts.</p>`;
  } else {
    const L = levelDef(s), next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    if (s.endless && s.phase === 'victory') h = `<h2><small>Stage ${s.stage} cleared</small>The ${esc(organTitle(s.level).toLowerCase())} ${s.level === 1 ? 'are' : 'is'} safe</h2><div class="start"><button data-act="nextStage" class="primary">Stage ${s.stage + 1}: ${esc(LEVELS[stageLevel(s.stage + 1)].title)}</button></div>`;
    else h = `<h2><small>${s.phase === 'victory' ? 'Level complete' : s.endless ? 'Endless run over' : `The ${L.organ.toLowerCase()} has failed`}</small>${s.phase === 'victory' ? `The ${esc(organTitle(s.level).toLowerCase())} ${s.level === 1 ? 'are' : 'is'} safe` : s.endless ? `${s.stage - 1} stage${s.stage === 2 ? '' : 's'} cleared` : 'Defeat'}</h2><div class="start">${s.phase === 'victory' && next >= 0 ? `<button data-act="level" data-level="${next}" class="primary">Next: ${esc(LEVELS[next].title)}</button> ` : ''}<button data-act="restart" ${s.phase === 'victory' && next >= 0 ? '' : 'class="primary"'}>${s.phase === 'victory' ? 'Play again' : s.endless ? 'Again' : 'Restart'}</button></div>`;
  }
  panel.innerHTML = h + (info ? `<button data-act="info" class="infoBtn" aria-expanded="${!infoEl.hidden}" aria-controls="info">Info: ${s.phase === 'prep' ? 'organ, levels, how to build' : 'this wave, how it works'}</button>` : '');
  infoBody.innerHTML = info;
  if (!info && !infoEl.hidden) setInfo(false);
}

function renderHud() {
  const L = levelDef(s);
  $('title').textContent = `Defend the ${organTitle(s.level)}`;
  $('levelName').textContent = `Level ${s.level + 1} of ${LEVELS.length} · ${CONFIG.difficulty[career.difficulty].name}`;
  $('hpLabel').textContent = `${L.organ} health`;
  document.title = `Defend the ${organTitle(s.level)}`;
  $('hp').textContent = `${s.heartHp}/${levelDef(s).hp}`;
  $('hpbar').style.width = `${(s.heartHp / levelDef(s).hp) * 100}%`;
  $('wave').textContent = s.endless ? `${Math.min(s.wave, totalWaves(s))}/${totalWaves(s)} · stage ${s.stage}` : `${Math.min(s.wave, totalWaves(s))}/${totalWaves(s)}`;
  $('energy').textContent = String(s.energy);
  $('gold').textContent = String(career.gold);
  $('cells').textContent = s.phase === 'combat' || s.phase === 'recall' ? `${aliveCells(s).length}/${cellCount(s)}` : `${cellCount(s)} ready`;
  // the NO figure and bar change every frame: update them in place rather than redrawing the panel
  const noText = String(Math.floor(s.no));
  for (const el of panel.querySelectorAll<HTMLElement>('[data-no]')) if (el.textContent !== noText) el.textContent = noText;
  const bar = panel.querySelector<HTMLElement>('[data-nobar]'); if (bar) bar.style.width = `${Math.min(100, (s.no / s.perks.noMax) * 100)}%`;
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
  if (s.phase === 'victory' && !s.endless) {
    lastSig = '';
    const next = s.level + 1 < LEVELS.length ? s.level + 1 : -1;
    overlay.hidden = false; overlay.className = 'victory';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Level ${s.level + 1} complete</p><h2>The ${esc(org)} ${plural} safe</h2><p>${esc(L.organ)} health ${s.heartHp}/${L.hp} · ${s.killed} pathogens destroyed</p>${lastPaid ? `<p class="gold">+${lastPaid} gold · ${career.gold} in all <button data-act="shop">Upgrades</button></p>` : ''}${next >= 0 ? `<p>${lastFirstClear ? 'Unlocked' : 'Next'}: <b>${esc(LEVELS[next].title)}</b>. ${esc(LEVELS[next].tagline)}</p><button data-act="level" data-level="${next}" class="primary">Next organ</button> <button data-act="restart">Play again</button>` : `<p><b>Every organ is safe.</b> The whole body has been defended.${lastFirstClear ? ' <b>Endless is open</b>: organ after organ, each bigger than the last.' : ''}</p><button data-act="endlessStart" class="primary">Start endless</button> <button data-act="restart">Play again</button>`}</div>`;
  } else if (s.phase === 'defeat' && s.endless) {
    // an endless run ends here: how far it got, and where that puts it on the board
    const stages = s.stage - 1, board = career.endless[career.difficulty] ?? [], best = board[0]?.stages ?? stages;
    overlay.hidden = false; overlay.className = 'defeat';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Endless · fell on stage ${s.stage}, the ${esc(org)}</p><h2>${stages} stage${stages === 1 ? '' : 's'} cleared</h2>
      <p>${lastPlace === 1 ? '<b>A new best!</b>' : lastPlace ? `<b>#${lastPlace}</b> on your ${esc(CONFIG.difficulty[career.difficulty].name.toLowerCase())} board (best: ${best} stages).` : `Not in your top ${CONFIG.endless.boardSize} (best: ${best} stages).`}</p>
      ${defeatAdvice()}
      <button data-act="restart" class="primary">Again</button> <button data-act="endlessBoard">Leaderboard</button></div>`;
  } else if (s.phase === 'victory' && s.endless) {
    lastSig = '';
    const k = s.stage + 1, nl = stageLevel(k);
    overlay.hidden = false; overlay.className = 'victory';
    overlay.innerHTML = `<div class="plate"><p class="kicker">Endless · stage ${s.stage} cleared</p><h2>The ${esc(org)} ${plural} safe</h2><p>${esc(L.organ)} health ${s.heartHp}/${L.hp}${lastPaid ? ` · <span class="gold">+${lastPaid} gold</span>` : ''}</p>
      <p>Next, stage ${k}: <b>${esc(LEVELS[nl].title)}</b>, with longer vessels, tougher pathogens and bosses at random.</p>
      <button data-act="nextStage" class="primary">Stage ${k}</button></div>`;
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
  renderOrganTag();
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
    body: 'A wave\'s pathogens, and the vessels they take, show only once it starts. After each wave, the side panel lists what came up each vessel and what it cost: build for the next from that.' },
  { id: 'inspect', when: () => s.phase === 'combat' && s.pathogens.some((p) => p.s > 0), title: 'What is that?',
    body: 'Click or tap any pathogen (or press I) to see its details: its health, speed, how hard your IgG hits it, and its tricks.' },
  { id: 'borrow', when: () => s.phase === 'prep' && missingTargets(s.level, s.perks).some((b) => !s.borrowed.includes(b)), title: 'Borrow an IgG target',
    body: 'Bacteria come here that you have no IgG target for. Buy one for good in Upgrades (120 gold), or borrow it for this organ only for 30 gold, from the panel. At most two IgG nodes may aim at any one bacterium.' },
  { id: 'multi', when: () => s.phase === 'combat' && s.level > 0 && aliveCells(s).length >= 2 && s.open.length === 1, title: 'Open more than one vessel',
    body: 'You can open as many vessels as you have white cells: they split evenly between them. Each more vessel is cheap to open and drains NO only a little faster.' },
  { id: 'gallbladder', when: () => s.phase === 'prep' && !!levelDef(s).gallbladder, title: 'Mind the gallbladder',
    body: 'If the liver falls to half health, its gallbladder bursts and bile destroys two of your lymph nodes. The green drop on the health ring marks the point.' },
  { id: 'jumper', when: () => s.phase === 'combat' && s.pathogens.some((p) => p.type === 'jumper' && p.s > 0), title: 'Jumping viruses',
    body: 'A third of the way in, each jumping virus leaps once to another vessel, landing as far along it. Guard more than the vessel they come up.' },
  { id: 'lodged', when: () => lodgeCost(s) > 0, title: 'Lodged in the organ',
    body: 'M. tuberculosis that reaches an organ lodges there, and costs 2 health at the end of every wave until the organ ends. In the stomach, so does H. pylori (1 each), and it starts a small cancer.' },
  { id: 'infectedNode', when: () => s.pathogens.some((p) => p.goalSite), title: 'An infected cell is after your node',
    body: 'A white cell taken over by a hijacker virus goes for the nearest lymph node on its vessel, and knocks it out for the rest of the wave if it gets there. Kill it on the way.' },
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
  notices.tick(s, dt, !!tut);
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

// test hooks for driving the game from the console: the dev server only, never the published game
// installable and playable offline (the published site only: the dev server changes its files all the time)
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* still plays online */ }); });

if (import.meta.env.DEV) Object.assign(window, {
  __heart: () => s,
  __level: (i: number) => { unlocked = Math.max(unlocked, i + 1); playLevel(i); return levelDef(s).id; },
  __advance: (sec: number) => { for (let t = 0; t < sec && !s.paused; t += 1 / 30) { if (tut) tutorialTick(tut, s); if (tut && tutorialHolds(tut, s)) break; step(s, 1 / 30); autosave(); } refresh(performance.now()); return { phase: s.phase, wave: s.wave, hp: s.heartHp }; },
  __refresh: () => refresh(performance.now()),
});
