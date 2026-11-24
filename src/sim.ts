// Defend the Heart: state, rules and simulation. Pure logic, no DOM, so it runs in tests too.
import { CONFIG, LEVELS, NODE_TYPES, type BacteriumType, type LevelDef, type NodeType, type PathogenType, type VesselId } from './config';
import { NO_PERKS, type Perks, type RunSave } from './career';
import { VESSELS, VESSEL_IDS, ENTRY_IDS, SITES, nearestOnVessel, siteById, HEART, LEVEL_INDEX, loadLevel, pointAt, dist, entryOf, forkAt, routesOf, type Vec } from './level';

export type Phase = 'prep' | 'combat' | 'recall' | 'victory' | 'defeat';

export interface Pathogen {
  /** `vessel` is the route it travels. On a forked vessel it is the first branch until it reaches the fork
   *  (`committed` false); there it picks a branch for good. */
  id: number; type: PathogenType; vessel: VesselId; committed: boolean; s: number; hp: number; maxHp: number; hit: number; side: number; wob: number;
  /** IgA: speed multiplier and how long it lasts. */
  slow: number; slowT: number;
  /** A walled boss: antibody strikes its wall has taken. */
  wallHits?: number;
  /** Bosses that shed: seconds until the next one. */
  shedT?: number;
}
/** home: waiting at the organ; out: travelling and fighting along the open vessel; returning: heading home, not fighting. */
export type CellMode = 'home' | 'out' | 'returning';
export interface WhiteCell { id: number; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; targetId: number | null; mode: CellMode; infected: boolean }
/** `targets`: what an IgG node is aimed at (one, or two with the dual-target upgrade); empty for other types.
 *  `wavesFought`: cleared waves since it was placed (IgE burns out). */
export interface LymphNode {
  id: number; site: string; vessel: VesselId; type: NodeType; cd: number; flash: number; targets: BacteriumType[]; wavesFought: number;
  /** Lymph node organ: its damage this wave (1 = full), worn down by pathogens reaching the organ on its vessel. */
  power?: number;
  /** Switched off by HIV for the rest of the wave. */
  off?: boolean;
}
export interface Shot { type: NodeType; targets: BacteriumType[]; power: number; vessel: VesselId; x: number; y: number; sx: number; sy: number; targetId: number; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'pulse' | 'pop' | 'cellDown' | 'heart' | 'infect' | 'build' | 'sacrifice' | 'struck' }
export interface Floater { x: number; y: number; text: string; t: number; color: string; size?: number }
export interface Spawn { type: PathogenType; vessel: VesselId; at: number }

export interface State {
  /** Index into LEVELS: which organ is being defended. */
  level: number;
  /** IgG targets borrowed for this organ only (bought with gold; gone when the organ ends). */
  borrowed: BacteriumType[];
  /** Liver: where the gallbladder's bile destroyed lymph nodes (empty until it bursts; it bursts once). */
  bile: Vec[];
  phase: Phase;
  paused: boolean;
  speed: number;
  wave: number;
  heartHp: number;
  energy: number;
  /** Vessels open (dilated) right now; each drains NO and takes a share of the white cells. */
  open: VesselId[];
  /** Nitric oxide left: opening a vessel costs it, an open vessel drains it. */
  no: number;
  /** Times NO has run dry (the UI toasts when it changes). */
  noOuts: number;
  width: Record<VesselId, number>;
  /** Per forked entry vessel: how many undecided pathogens have alternated at its fork. */
  forkFlip: Record<VesselId, number>;
  /** IgE nodes that burnt out at the end of the last wave (their sites are free again). Cleared when a wave starts. */
  spent: { site: string; at: Vec }[];
  /** What the career's upgrades do in this game. */
  perks: Perks;
  /** The cheaper-first-node discount has been used this build phase. */
  discountUsed: boolean;
  /** State of the game's own random source (seeded, so the same game always plays the same way). */
  rng: number;
  /** Spleen: wave times at which lost white cells come back. */
  respawns: number[];
  /** Organ health lost, by the vessel it came up (as it enters the map) and by pathogen. */
  leaks: { byVessel: Record<VesselId, number>; byType: Partial<Record<PathogenType, number>>; remade?: number };
  nodes: LymphNode[];
  pathogens: Pathogen[];
  cells: WhiteCell[];
  shots: Shot[];
  rings: Ring[];
  floaters: Floater[];
  spawns: Spawn[];
  pulsesLeft: number;
  waveTime: number;
  time: number;
  heartKick: number;
  nextId: number;
  leaked: number;
  killed: number;
  infections: number;
  recallTime: number;
  lastPulseHits: number;
  message: string;
}

const zeroWidths = () => Object.fromEntries(VESSEL_IDS.map((v) => [v, 0])) as Record<VesselId, number>;

/** A fresh game on the given organ (default: the one already loaded). Loads that organ's map. */
export function newGame(level = LEVEL_INDEX, perks: Perks = NO_PERKS, seed = 1 + level): State {
  loadLevel(level);
  const L = LEVELS[level];
  const s: State = {
    level, phase: 'prep', paused: false, speed: 1, wave: 1, heartHp: L.hp, energy: L.startEnergy, open: [], no: perks.noMax, noOuts: 0,
    perks, borrowed: [], bile: [], discountUsed: false, rng: seed >>> 0, respawns: [], leaks: { byVessel: {}, byType: {} },
    width: zeroWidths(), forkFlip: {}, spent: [], nodes: [], pathogens: [], cells: [], shots: [], rings: [], floaters: [], spawns: [],
    pulsesLeft: 0, waveTime: 0, time: 0, heartKick: 0, nextId: 1, leaked: 0, killed: 0, infections: 0, recallTime: 0, lastPulseHits: 0, message: '',
  };
  for (const n of L.startingNodes ?? []) {
    const site = SITES.find((x) => x.vessel === n.vessel && x.index === n.site);
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0, targets: n.type === 'igg' ? ['saureus'] : [], wavesFought: 0 });
  }
  giveFreeNodes(s);
  if (perks.extraNode) {
    // one more IgM, on the first free site guarding the vessel bringing the most into wave 1
    const hp = new Map<VesselId, number>();
    for (const sp of waveSpawns(1, level)) hp.set(sp.vessel, (hp.get(sp.vessel) ?? 0) + CONFIG.pathogens[sp.type].hp);
    const busiest = [...hp].sort((a, b) => b[1] - a[1])[0]?.[0] ?? VESSEL_IDS[0];
    const site = SITES.find((x) => (x.vessel === busiest || (x.stem && entryOf(x.vessel) === entryOf(busiest))) && !s.nodes.some((n) => n.site === x.id))
      ?? SITES.find((x) => !s.nodes.some((n) => n.site === x.id));
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: 'igm', cd: 0, flash: 0, targets: [], wavesFought: 0 });
  }
  return s;
}

/** Every vessel without a lymph node gets one free IgM: on its second site out (its first if it has only one),
 *  on the shared stem of a fork. */
function giveFreeNodes(s: State) {
  for (const e of ENTRY_IDS) {
    if (s.nodes.some((n) => entryOf(n.vessel) === e)) continue;
    const all = SITES.filter((x) => entryOf(x.vessel) === e), stem = all.filter((x) => x.stem);
    const mine = (stem.length ? stem : all).sort((a, b) => a.index - b.index);
    const site = mine.find((x) => x.index === 1 && !s.nodes.some((n) => n.site === x.id)) ?? mine.find((x) => !s.nodes.some((n) => n.site === x.id));
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: 'igm', cd: 0, flash: 0, targets: [], wavesFought: 0 });
  }
}

/** Put a saved build phase back: the organ, wave, health, energy, NO and nodes. Nodes on sites this
 *  organ no longer has are dropped; an organ that does not exist starts a fresh heart. */
export function resumeGame(run: RunSave, perks: Perks = NO_PERKS): State {
  if (!(run.level >= 0 && run.level < LEVELS.length)) return newGame(0, perks);
  const s = newGame(run.level, perks);
  const L = LEVELS[run.level];
  s.wave = Math.max(1, Math.min(L.waves.length, Math.floor(run.wave)));
  s.heartHp = Math.max(1, Math.min(L.hp, run.heartHp));
  s.energy = Math.max(0, Math.floor(run.energy));
  s.no = Math.max(0, Math.min(perks.noMax, run.no));
  s.borrowed = (run.borrowed ?? []).filter((b, i, a) => CONFIG.pathogens[b]?.taxon && a.indexOf(b) === i);
  s.bile = (run.bile ?? []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).slice(0, 8);
  s.nodes = [];
  for (const n of run.nodes) {
    const site = SITES.find((x) => x.id === n.site);
    if (!site || !CONFIG.nodes[n.type] || s.nodes.some((x) => x.site === n.site)) continue;
    // IgG targets: only ones this career has unlocked, two only with dual-target, S. aureus if none are left
    let targets = n.type === 'igg' ? n.targets.filter((b) => hasTarget(s, b)).slice(0, perks.dual ? 2 : 1) : [];
    if (n.type === 'igg' && !targets.length) targets = ['saureus'];
    s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0, targets, wavesFought: n.wavesFought | 0 });
  }
  // a save from before every vessel started with a free IgM gets the ones it is missing
  if (!run.freeNodes) giveFreeNodes(s);
  return s;
}

export const levelDef = (s: State): LevelDef => LEVELS[s.level];
export const totalWaves = (s: State) => LEVELS[s.level].waves.length;
export const wave = (s: State) => LEVELS[s.level].waves[s.wave - 1];
/** Lungs: true while the lungs are inhaling and the blood surges. */
export function surging(s: State): boolean {
  const sg = LEVELS[s.level].surge;
  if (!sg || s.phase !== 'combat') return false;
  return s.waveTime % sg.every >= sg.every - sg.length;
}
/** Kidney: true when a pathogen is in the filtered last stretch of its vessel. */
export function filtered(s: State, p: { vessel: VesselId; s: number }): boolean {
  const f = LEVELS[s.level].filtration;
  return !!f && p.s >= VESSELS[p.vessel].length * (1 - f.fraction);
}
/** Speed multiplier from the organ itself (surges, filtration). */
/** Stomach: true when a pathogen is in the acid on the last stretch of its vessel. */
export function inAcid(s: State, p: { vessel: VesselId; s: number }): boolean {
  const a = LEVELS[s.level].acid;
  return !!a && p.s >= VESSELS[p.vessel].length * (1 - a.fraction);
}

export function organFlow(s: State, p: Pathogen): number {
  let k = 1;
  const b = CONFIG.pathogens[p.type].burrows;
  if (b && hidden(s, p)) k *= b.speed; // tunnelling through the lining
  if (surging(s)) k *= LEVELS[s.level].surge!.factor;
  if (filtered(s, p)) k *= LEVELS[s.level].filtration!.factor;
  return k;
}
/** The boss currently in play, if any. */
export const activeBoss = (s: State) => s.pathogens.find((p) => p.hp > 0 && CONFIG.pathogens[p.type].boss);
/** Every boss still alive (the last wave sends one up each vessel). */
export const activeBosses = (s: State) => s.pathogens.filter((p) => p.hp > 0 && CONFIG.pathogens[p.type].boss);
export const aliveCells = (s: State) => s.cells.filter((c) => c.hp > 0 && !c.infected);
/** Living cells out on the open vessel: the only ones that fight, pulse or can be infected. */
export const outCells = (s: State) => aliveCells(s).filter((c) => c.mode === 'out');
export const nodeAt = (s: State, site: string) => s.nodes.find((n) => n.site === site);

/** Does something on `route` (a cell, a node's site) share the stretch of vessel `p` is on?
 *  Same route; or p is still undecided on the shared stem; or a stem site, which guards the whole fork. */
export function covers(route: VesselId, p: Pathogen, stemSite = false): boolean {
  if (entryOf(p.vessel) !== entryOf(route)) return false;
  return p.vessel === route || !p.committed || stemSite;
}

/** IgG match: the best single match between any of the node's targets and the pathogen (never multiplied together). */
export function iggMultiplier(targets: BacteriumType[], type: PathogenType): number {
  const M = CONFIG.iggMatch, tx = CONFIG.pathogens[type].taxon;
  if (!tx) return M.nonBacterium;
  let best = M.unrelated;
  for (const g of targets) {
    const gt = CONFIG.pathogens[g].taxon!;
    const m = gt.species === tx.species ? M.species : gt.shape === tx.shape ? M.shape : gt.gram === tx.gram ? M.gram : M.unrelated;
    best = Math.max(best, m);
  }
  return best;
}

/** One antibody's damage from a node of `type` (aimed at `targets`) against a pathogen of `ptype`. */
export function antibodyDamage(type: NodeType, targets: BacteriumType[], ptype: PathogenType): number {
  return CONFIG.nodes[type].damage * (type === 'igg' ? iggMultiplier(targets, ptype) : 1);
}
export function nodeDamage(s: State, n: LymphNode, ptype: PathogenType): number { return antibodyDamage(n.type, n.targets, ptype) * s.perks.dmg[n.type]; }

export function pathogenPos(p: Pathogen): Vec & { angle: number } {
  const q = pointAt(VESSELS[p.vessel], p.s);
  const off = p.side * 0.6 + Math.sin(p.wob) * 2;
  return { x: q.x - Math.sin(q.angle) * off, y: q.y + Math.cos(q.angle) * off, angle: q.angle };
}
export function cellPos(c: WhiteCell): Vec & { angle: number } {
  const q = pointAt(VESSELS[c.vessel], c.s);
  return { x: q.x - Math.sin(q.angle) * c.side, y: q.y + Math.cos(q.angle) * c.side, angle: q.angle };
}

// ── Preparation ─────────────────────────────────────────────────────────────


export function buildCheck(s: State, siteId: string, type: NodeType, targets?: BacteriumType[]): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: 'Lymph nodes can only be placed between waves.' };
  if (!SITES.some((x) => x.id === siteId)) return { ok: false, reason: 'Not a site for a lymph node.' };
  if (nodeAt(s, siteId)) return { ok: false, reason: 'A lymph node is already there.' };
  if (type === 'igg') {
    const t = targetsCheck(s, targets ?? []);
    if (t) return { ok: false, reason: t };
  }
  const cost = nodeCost(s, type, targets);
  if (s.energy < cost) return { ok: false, reason: `Needs ${cost} energy (you have ${s.energy}).` };
  return { ok: true, reason: '' };
}

/** Why these IgG targets can't be used ('' if they can). */
/** Can IgG be aimed at this bacterium here: unlocked for the career, or borrowed for this organ. */
export const hasTarget = (s: State, b: BacteriumType) => s.perks.targets.includes(b) || s.borrowed.includes(b);

/** Borrow an IgG target for the rest of this organ (the caller pays the gold). */
export function borrowTarget(s: State, b: BacteriumType): boolean {
  if (hasTarget(s, b) || !CONFIG.pathogens[b]?.taxon) return false;
  s.borrowed.push(b);
  return true;
}

/** How many IgG nodes are aimed at this bacterium (leaving out the one on `except`). */
export const aimedAt = (s: State, b: BacteriumType, except?: string) => s.nodes.filter((n) => n.type === 'igg' && n.site !== except && n.targets.includes(b)).length;

function targetsCheck(s: State, targets: BacteriumType[], except?: string): string {
  if (!targets.length) return 'Choose what this IgG targets.';
  if (targets.length > 2 || new Set(targets).size !== targets.length) return 'Choose one target, or two different ones.';
  if (targets.length === 2 && !s.perks.dual) return 'Dual-target IgG is an upgrade.';
  if (targets.some((b) => !hasTarget(s, b))) return 'Unlock this target in Upgrades, or borrow it for this organ.';
  const full = targets.find((b) => aimedAt(s, b, except) >= CONFIG.iggPerTarget);
  if (full) return `Already ${CONFIG.iggPerTarget} IgG nodes aimed at ${CONFIG.pathogens[full].plural} on this organ.`;
  return '';
}

/** Energy to place a node: a dual-target IgG costs more; the first node of a build phase may be half price. */
export function nodeCost(s: State, type: NodeType, targets?: BacteriumType[]): number {
  const base = type === 'igg' && (targets?.length ?? 0) > 1 ? CONFIG.dualIggCost : CONFIG.nodes[type].cost;
  return s.perks.cheapFirst && !s.discountUsed ? Math.floor(base / 2) : base;
}

export function placeNode(s: State, siteId: string, type: NodeType, targets?: BacteriumType[]): boolean {
  if (!buildCheck(s, siteId, type, targets).ok) return false;
  const site = siteById(siteId);
  s.energy -= nodeCost(s, type, targets);
  s.discountUsed = true;
  s.nodes.push({ id: s.nextId++, site: siteId, vessel: site.vessel, type, cd: 0.3, flash: 1, targets: type === 'igg' ? [...targets!] : [], wavesFought: 0 });
  s.rings.push({ x: site.x, y: site.y, r: 40, t: 0, dur: 0.5, kind: 'build' });
  return true;
}

/** The IgG targets this player can choose (Stage 3 limits them to the career's unlocks). */
export const selectableTargets = (s: State): BacteriumType[] => [...new Set([...s.perks.targets, ...s.borrowed])];

/** Re-aim a placed IgG node between waves. */
export function retargetCheck(s: State, siteId: string, targets: BacteriumType[]): { ok: boolean; reason: string } {
  const n = nodeAt(s, siteId);
  if (s.phase !== 'prep') return { ok: false, reason: 'Lymph nodes can only be changed between waves.' };
  if (!n || n.type !== 'igg') return { ok: false, reason: 'Only an IgG node can be re-aimed.' };
  const t = targetsCheck(s, targets, siteId);
  if (t) return { ok: false, reason: t };
  const cost = retargetCost(n, targets);
  if (s.energy < cost) return { ok: false, reason: `Needs ${cost} energy (you have ${s.energy}).` };
  return { ok: true, reason: '' };
}
/** Re-aiming costs 20; giving a single-target node a second target costs the 30 difference to a dual node. */
export function retargetCost(n: LymphNode, targets: BacteriumType[]): number {
  return n.targets.length === 1 && targets.length === 2 ? CONFIG.dualIggCost - CONFIG.nodes.igg.cost : CONFIG.iggRetarget;
}
export function retargetNode(s: State, siteId: string, targets: BacteriumType[]): boolean {
  if (!retargetCheck(s, siteId, targets).ok) return false;
  s.energy -= retargetCost(nodeAt(s, siteId)!, targets);
  nodeAt(s, siteId)!.targets = [...targets];
  return true;
}

export function canStartWave(s: State): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: '' };
  return { ok: true, reason: '' };
}

// ── Combat: dilation, paid for with NO ──────────────────────────────────────

/** NO needed to open a vessel: its cost, plus enough to hold it open for a moment. */
export const openNeed = () => CONFIG.no.openCost + CONFIG.no.drainPerSec * CONFIG.no.minOpenSeconds;

/** Can vessel r be opened (or, if it is open, closed) right now? Each open vessel needs a white cell of its own. */
export function dilateCheck(s: State, r: VesselId): { ok: boolean; reason: string } {
  if (s.phase !== 'combat') return { ok: false, reason: 'Dilate during the wave.' };
  if (s.paused) return { ok: false, reason: 'Paused.' };
  if (!VESSELS[r]) return { ok: false, reason: 'Not a vessel of this organ.' };
  if (s.open.includes(r)) return { ok: true, reason: '' };
  if (s.no < openNeed()) return { ok: false, reason: `Not enough NO to open the ${VESSELS[r].name.toLowerCase()}.` };
  const sibling = s.open.find((x) => x !== r && entryOf(x) === entryOf(r)); // the other branch of a fork: switching
  // one vessel may always be open (even with no cells left, it still turns pathogens at a fork); more need a cell each
  if (!sibling && s.open.length >= Math.max(1, aliveCells(s).length)) return { ok: false, reason: 'Every white cell already has a vessel: close one first.' };
  return { ok: true, reason: '' };
}

/** Open r (paying NO), or close r if it is already open. Opening a branch of a fork closes its other branch.
 *  The white cells are then shared out evenly among the open vessels. */
export function toggleRoute(s: State, r: VesselId): boolean {
  if (!dilateCheck(s, r).ok) return false;
  if (s.open.includes(r)) { closeRoute(s, r); return true; }
  const sibling = s.open.find((x) => x !== r && entryOf(x) === entryOf(r));
  if (sibling) closeRoute(s, sibling);
  s.no -= CONFIG.no.openCost;
  s.open.push(r);
  // cells still heading home along this vessel turn round where they are
  for (const c of aliveCells(s)) if (c.mode === 'returning' && c.vessel === r) c.mode = 'out';
  shareCells(s);
  return true;
}

/** Close vessel r (or every open vessel): its cells head home, then out along any vessel still open. */
export function closeRoute(s: State, r?: VesselId) {
  const closing = r ? [r] : [...s.open];
  s.open = s.open.filter((x) => !closing.includes(x));
  for (const c of aliveCells(s)) if (c.mode === 'out' && closing.includes(c.vessel)) { c.mode = 'returning'; c.targetId = null; }
  shareCells(s);
}

/** How many cells each open vessel should have: as even as can be, the first-opened vessels getting any extra. */
function shares(s: State): Map<VesselId, number> {
  const n = aliveCells(s).length, k = s.open.length, out = new Map<VesselId, number>();
  s.open.forEach((v, i) => out.set(v, Math.floor(n / k) + (i < n % k ? 1 : 0)));
  return out;
}

/** Share the white cells out: a vessel with more than its share sends the extra home (to be sent on), and cells
 *  waiting at the organ set out along the vessels short of theirs. */
function shareCells(s: State) {
  if (!s.open.length) return;
  const want = shares(s);
  for (const v of s.open) {
    const mine = outCells(s).filter((c) => c.vessel === v).sort((a, b) => b.s - a.s); // nearest the organ first
    for (const c of mine.slice(0, Math.max(0, mine.length - (want.get(v) ?? 0)))) { c.mode = 'returning'; c.targetId = null; }
  }
  deployHome(s);
}

/** Cells waiting at the organ set out along the open vessels that are short of their share. */
function deployHome(s: State) {
  if (!s.open.length) return;
  const want = shares(s);
  for (const c of aliveCells(s)) {
    if (c.mode !== 'home') continue;
    const v = s.open.find((x) => outCells(s).filter((o) => o.vessel === x).length < (want.get(x) ?? 0));
    if (!v) break;
    const i = outCells(s).filter((o) => o.vessel === v).length, L = VESSELS[v].length;
    c.vessel = v; c.s = L - 8 - i * 30; c.mode = 'out'; c.targetId = null;
  }
}

export function waveSpawns(n: number, level = LEVEL_INDEX): Spawn[] {
  const out: Spawn[] = [], L = LEVELS[level];
  for (const g of L.waves[n - 1].groups) for (let i = 0; i < g.count; i++) out.push({ type: g.type, vessel: routesOf(g.vessel)[0], at: g.start + i * g.interval });
  // the last wave's boss comes up every vessel, one after another
  if (n === L.waves.length) {
    for (const g of L.waves[n - 1].groups.filter((x) => CONFIG.pathogens[x.type].boss)) {
      L.map.vessels.filter((v) => v.id !== g.vessel).forEach((v, k) => out.push({ type: g.type, vessel: routesOf(v.id)[0], at: g.start + (k + 1) * CONFIG.bossEveryVessel.gap }));
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function startWave(s: State): boolean {
  if (!canStartWave(s).ok) return false;
  const v = VESSEL_IDS[0];
  s.phase = 'combat';
  s.open = [];
  s.waveTime = 0;
  s.spawns = waveSpawns(s.wave, s.level);
  s.respawns = [];
  s.pulsesLeft = CONFIG.immunePulse.perWave;
  s.lastPulseHits = 0;
  s.spent = [];
  for (const n of s.nodes) { n.cd = 0.3; n.power = 1; n.off = false; } // worn-down and switched-off nodes recover
  const L = VESSELS[v].length;
  s.cells = [];
  const grow = LEVELS[s.level].cellGrowth, cells = grow ? Math.min(grow.max, LEVELS[s.level].cells + grow.perWave * (s.wave - 1)) : LEVELS[s.level].cells;
  for (let i = 0; i < cells; i++) {
    s.cells.push({ id: s.nextId++, vessel: v, s: L, hp: CONFIG.whiteCell.hp, maxHp: CONFIG.whiteCell.hp, hit: 0, side: (i % 2 ? 1 : -1) * 11, targetId: null, mode: 'home', infected: false });
  }
  s.message = '';
  return true;
}

// ── Combat: the immune pulse ────────────────────────────────────────────────

export function pulseCheck(s: State): { ok: boolean; reason: string } {
  if (s.phase !== 'combat') return { ok: false, reason: 'The immune pulse is used during a wave.' };
  if (s.paused) return { ok: false, reason: 'Paused.' };
  if (s.pulsesLeft <= 0) return { ok: false, reason: 'Immune pulse already used this wave.' };
  if (!aliveCells(s).length) return { ok: false, reason: 'No white cells left to pulse.' };
  if (!outCells(s).length) return { ok: false, reason: 'Open a vessel to send your white cells out first.' };
  if (!pulsePairs(s).length) return { ok: false, reason: 'None of your white cells is touching a pathogen yet.' };
  return { ok: true, reason: '' };
}

/** Each white cell out on a vessel and touching a pathogen there, with the one it would destroy: the one furthest in,
 *  and never one another cell has already taken. */
export function pulsePairs(s: State): { cell: WhiteCell; target: Pathogen }[] {
  const taken = new Set<Pathogen>(), out: { cell: WhiteCell; target: Pathogen }[] = [];
  for (const c of outCells(s)) {
    let best: Pathogen | null = null;
    for (const p of s.pathogens) {
      if (p.hp <= 0 || taken.has(p) || hidden(s, p) || CONFIG.pathogens[p.type].ignoresCells || !covers(c.vessel, p) || p.s <= 0) continue;
      if (Math.abs(p.s - c.s) > CONFIG.whiteCell.attackRange) continue;
      if (!best || p.s > best.s) best = p;
    }
    if (best) { taken.add(best); out.push({ cell: c, target: best }); }
  }
  return out;
}

/** Pathogens the pulse would strike right now. */
export function pulseTargets(s: State): Pathogen[] { return pulsePairs(s).map((x) => x.target); }

/** Fire the one pulse of this wave: every white cell touching a pathogen destroys it (a boss loses a third of its
 *  health) and is lost. Spends the charge first, so a double tap cannot fire twice. Returns how many were struck. */
export function firePulse(s: State): number {
  if (!pulseCheck(s).ok) return -1;
  s.pulsesLeft -= 1;
  const pairs = pulsePairs(s);
  for (const { cell, target } of pairs) {
    const q = cellPos(cell), tq = pathogenPos(target), boss = !!CONFIG.pathogens[target.type].boss;
    // the cell bursts in a splash of ink; the pathogen it struck is crossed out
    s.rings.push({ x: q.x, y: q.y, r: 44, t: 0, dur: 0.9, kind: 'sacrifice' });
    s.rings.push({ x: tq.x, y: tq.y, r: boss ? 46 : 24, t: 0, dur: 0.9, kind: 'struck' });
    const wall = CONFIG.pathogens[target.type].walled;
    if (wall && (target.wallHits ?? 0) < wall.hits) { target.wallHits = wall.hits; wallBroken(s, target); } // the pulse breaks a wall at once
    hurt(s, target, boss ? target.maxHp * CONFIG.immunePulse.bossShare : target.hp);
    cell.hp = 0;
    s.floaters.push({ x: q.x, y: q.y - 34, text: 'Gave its life', t: 0, color: '#1e5a78' });
    loseCell(s);
  }
  s.lastPulseHits = pairs.length;
  return pairs.length;
}

// ── Simulation ──────────────────────────────────────────────────────────────

/** How many more antibody strikes a walled boss's wall can take (0: broken, or no wall). */
export function wallLeft(p: Pathogen): number {
  const w = CONFIG.pathogens[p.type].walled;
  return w ? Math.max(0, w.hits - (p.wallHits ?? 0)) : 0;
}

function wallBroken(s: State, p: Pathogen) {
  const q = pathogenPos(p);
  s.rings.push({ x: q.x, y: q.y, r: 80, t: 0, dur: 0.9, kind: 'pop' });
  s.floaters.push({ x: q.x, y: q.y - 70, text: 'The wall is broken!', t: 0, color: '#6e2622' });
}

/** Damage a pathogen. `struck`: an antibody hit (it chips a walled boss's wall); white cells' steady fighting is not. */
export function hurt(s: State, p: Pathogen, dmg: number, struck = false) {
  if (p.hp <= 0) return;
  const wall = CONFIG.pathogens[p.type].walled;
  if (wall && (p.wallHits ?? 0) < wall.hits) {
    dmg *= wall.factor;
    if (struck) { p.wallHits = (p.wallHits ?? 0) + 1; if (p.wallHits >= wall.hits) wallBroken(s, p); }
  }
  p.hp -= dmg;
  p.hit = 0.15;
  if (p.hp <= 0) {
    const st = CONFIG.pathogens[p.type];
    s.killed++;
    s.energy += Math.round(st.bounty * (LEVELS[s.level].income ?? 1));
    const q = pathogenPos(p);
    s.rings.push({ x: q.x, y: q.y, r: st.boss ? 70 : 18, t: 0, dur: st.boss ? 0.9 : 0.35, kind: 'pop' });
    if (st.boss) s.floaters.push({ x: q.x, y: q.y - 50, text: `${st.name} destroyed!`, t: 0, color: '#1e6a8a' });
    if (st.splitInto) {
      // the colony bursts: its bacteria spill out around where it died
      for (let i = 0; i < st.splitInto.count; i++) {
        const b = newPathogen(s, st.splitInto.type, p.vessel, Math.max(0, p.s - 10 + i * 8));
        if (p.committed) b.committed = true; // spilled just behind a parent past the fork: same branch
        b.side = (i % 2 ? 1 : -1) * (4 + i * 2);
        b.hp = b.maxHp = Math.round(b.maxHp * (st.splitInto.hpFactor ?? 1));
      }
    }
  }
}

function newPathogen(s: State, type: PathogenType, vessel: VesselId, at = 0): Pathogen {
  const st = CONFIG.pathogens[type];
  const grow = LEVELS[s.level].waveHpGrowth;
  let hp = grow ? Math.round(st.hp * (1 + grow * (s.wave - 1))) : st.hp;
  if (st.boss) hp = Math.round(hp * CONFIG.bossEveryVessel.hpShare); // one comes up every vessel
  const p: Pathogen = { id: s.nextId++, type, vessel, committed: at >= forkAt(vessel), s: at, hp, maxHp: hp, hit: 0, side: st.boss ? 0 : (rand(s) * 2 - 1) * 7, wob: rand(s) * 6, slow: 1, slowT: 0, shedT: st.sheds?.every };
  s.pathogens.push(p);
  // announce the first boss of the wave only (the others follow up the other vessels)
  if (st.boss && s.pathogens.filter((x) => CONFIG.pathogens[x.type].boss).length === 1) {
    const m = pointAt(VESSELS[vessel], 90);
    s.floaters.push({ x: Math.max(160, Math.min(1440, m.x)), y: Math.max(80, m.y - 40), text: `Boss: ${st.name}!`, t: 0, color: '#8a1e24' });
  }
  return p;
}

/** A white cell has been lost (killed or infected). The spleen will remake it later; the health is paid when it does,
 *  so a cell lost too late in a wave to come back costs nothing. */
function loseCell(s: State) {
  const r = LEVELS[s.level].respawn;
  if (!r) return;
  s.respawns.push(s.waveTime + r.after);
  s.floaters.push({ x: HEART.x, y: HEART.y - LEVELS[s.level].map.ry - 50, text: `The spleen will remake it in ${r.after} s`, t: 0, color: '#1e6a8a' });
}

/** Liver: the first time its health falls to the threshold, the gallbladder bursts and bile destroys lymph nodes
 *  at random (chosen with the game's seeded random source), leaving green stains where they stood. */
export function burstGallbladder(s: State) {
  const gb = LEVELS[s.level].gallbladder;
  if (!gb || s.bile.length || s.heartHp <= 0 || s.heartHp > LEVELS[s.level].hp * gb.at) return;
  const pool = [...s.nodes];
  for (let i = 0; i < gb.nodes && pool.length; i++) {
    const n = pool.splice(Math.floor(rand(s) * pool.length), 1)[0], site = siteById(n.site);
    s.nodes = s.nodes.filter((x) => x !== n);
    s.bile.push({ x: site.x, y: site.y });
    s.rings.push({ x: site.x, y: site.y, r: 40, t: 0, dur: 0.9, kind: 'pop' });
  }
  if (!s.bile.length) s.bile.push({ x: HEART.x, y: HEART.y }); // nothing to destroy: it has still burst
  s.floaters.push({ x: HEART.x, y: HEART.y - LEVELS[s.level].map.ry - 50, text: 'The gallbladder bursts! Bile destroys lymph nodes', t: 0, color: '#3e6a1e' });
  s.heartKick = 1;
}

/** A hiding boss inside a red blood cell: nothing can target or hit it. */
export function hidden(s: State, p: Pathogen): boolean {
  const h = CONFIG.pathogens[p.type].hides ?? CONFIG.pathogens[p.type].burrows;
  return !!h && s.phase === 'combat' && s.waveTime % h.every >= h.every - h.for;
}

/** A hijacker virus enters a white cell: the cell is lost and rises again as an infected cell heading for the heart.
 *  An ordinary hijacker is used up; the sepsis boss keeps going. */
export function infect(s: State, c: WhiteCell, virus: Pathogen) {
  if (!CONFIG.pathogens[virus.type].infectsMany) virus.hp = 0;
  c.hp = 0;
  c.infected = true;
  s.infections++;
  loseCell(s);
  const q = cellPos(c);
  const enemy = newPathogen(s, 'infected', c.vessel, c.s);
  enemy.side = c.side;
  s.rings.push({ x: q.x, y: q.y, r: 34, t: 0, dur: 0.8, kind: 'infect' });
  s.floaters.push({ x: q.x, y: q.y - 30, text: 'White cell infected!', t: 0, color: '#8a2ab8' });
}

function easeWidths(s: State, dt: number) {
  for (const v of VESSEL_IDS) {
    const open = s.open.includes(v) && s.phase === 'combat';
    const target = open ? 1 : 0;
    const k = CONFIG.dilateRate * dt;
    s.width[v] = s.width[v] < target ? Math.min(target, s.width[v] + k) : Math.max(target, s.width[v] - k);
  }
}

/** The game's random source: a small seeded generator (mulberry32), so a game can be replayed exactly. */
export function rand(s: State): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let x = s.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export type LeakSummary =
  | { kind: 'leak'; vessel: VesselId; type: PathogenType; share: number; advice: string }
  | { kind: 'remake'; share: number; advice: string };

/** What cost the most organ health, and what would have helped: for the defeat screen. Null if nothing was lost. */
export function leakSummary(s: State): LeakSummary | null {
  const leaked = Object.values(s.leaks.byVessel).reduce((a, n) => a + n, 0), remade = s.leaks.remade ?? 0, total = leaked + remade;
  if (!total) return null;
  const top = <K extends string>(r: Partial<Record<K, number>>) => (Object.entries(r) as [K, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const type = top(s.leaks.byType);
  if (!leaked || remade >= (s.leaks.byType[type!] ?? 0)) {
    return { kind: 'remake', share: remade / total, advice: 'Every white cell the spleen remade cost it 1 health: keep your cells away from hijackers, and close a vessel before its cells are overwhelmed.' };
  }
  const vessel = top(s.leaks.byVessel)!, st = CONFIG.pathogens[type!];
  const name = st.taxon ? CONFIG.pathogens[st.taxon.species].plural : st.name;
  let advice: string;
  if (type === 'sepsis') advice = 'The sepsis hijacker infects every white cell it touches: keep your cells off its vessel and let IgM and IgE nodes kill it.';
  else if (st.taxon) advice = `An IgG aimed at ${name} hits it three times as hard${st.boss ? '' : ', and other bacteria of the same shape two and a half times'}.`
    + (hasTarget(s, st.taxon.species) ? '' : ` Unlock the ${name} target in Upgrades first (or borrow it for this organ): you don't have it yet.`);
  else if (type === 'hiv') advice = 'HIV switches off every lymph node it passes and white cells can\'t touch it: stack IgM and IgE far out on its vessel, so it dies before it gets far.';
  else if (type === 'burrower') advice = 'The swarm is acid-proof and burrows out of reach every few seconds: put many nodes on its vessel, IgG aimed at H. pylori first, so it is worn down in the moments it is out.';
  else if (type === 'granuloma') advice = 'The granuloma\'s wall soaks up three quarters of every hit until enough antibodies have struck it: build many fast-firing nodes on its vessel, or break it at once with the pulse.';
  else if (type === 'plasmodium') advice = 'Plasmodium is a parasite, not a bacterium: IgM and IgE wear it down, and time the pulse for when it comes out of its red blood cell.';
  else if (st.boss) advice = `${st.name}: IgM and IgE hit it hardest; IgG barely scratches a virus.`;
  else if (type === 'virus') advice = 'Viruses are fast and come in groups: an IgA node slows them so your other nodes can land their hits.';
  else advice = 'Hijacker viruses turned your white cells against you: kill them before they reach your cells, or keep the cells on another vessel.';
  return { kind: 'leak', vessel, type: type!, share: (s.leaks.byVessel[vessel] ?? 0) / total, advice };
}

/** Game speeds the Speed button steps through. */
export const SPEEDS = [1, 1.5, 2, 3];
export const nextSpeed = (sp: number) => SPEEDS[(SPEEDS.indexOf(sp) + 1) % SPEEDS.length] ?? 1;

/** Move the game on by one frame of real time at the game's speed, in equal sub-steps no longer than a real frame. */
export function advance(s: State, dt: number) {
  const n = Math.max(1, Math.ceil(s.speed));
  for (let i = 0; i < n; i++) step(s, (dt * s.speed) / n);
}

export function step(s: State, dtRaw: number) {
  const dt = Math.min(dtRaw, 0.1);
  s.time += dt;
  for (const r of s.rings) r.t += dt;
  s.rings = s.rings.filter((r) => r.t < r.dur);
  for (const f of s.floaters) f.t += dt;
  s.floaters = s.floaters.filter((f) => f.t < 1.4);
  for (const n of s.nodes) n.flash = Math.max(0, n.flash - dt * 2);
  s.heartKick = Math.max(0, s.heartKick - dt * 2.5);
  easeWidths(s, dt);
  if (s.phase === 'recall') { recall(s, dt); return; }
  if (s.phase !== 'combat') return;

  s.waveTime += dt;
  while (s.spawns.length && s.spawns[0].at <= s.waveTime) { const sp = s.spawns.shift()!; newPathogen(s, sp.type, sp.vessel); }

  // Pathogens drift with the blood towards the heart (IgA slows them). Bosses heal or shed as they go.
  const shed: [PathogenType, VesselId, number, boolean][] = [];
  for (const p of s.pathogens) {
    p.hit = Math.max(0, p.hit - dt);
    p.wob += dt * 4;
    if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) p.slow = 1; }
    p.s += CONFIG.pathogens[p.type].speed * p.slow * organFlow(s, p) * dt;
    const st = CONFIG.pathogens[p.type];
    if (st.regen && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);
    const acid = LEVELS[s.level].acid;
    if (acid && p.hp > 0 && p.s > 0 && inAcid(s, p)) {
      if (st.acidProof) p.hp = Math.min(p.maxHp, p.hp + acid.dps * dt); // H. pylori feeds on the acid
      else hurt(s, p, acid.dps * dt);
    }
    if (st.sheds && p.hp > 0 && p.s > 0) {
      p.shedT = (p.shedT ?? st.sheds.every) - dt;
      if (p.shedT <= 0) { p.shedT += st.sheds.every; shed.push([st.sheds.type, p.vessel, Math.max(0, p.s - 6), p.committed]); }
    }
  }
  // HIV switches off every lymph node guarding its route as it passes
  for (const p of s.pathogens) {
    if (p.hp <= 0 || !CONFIG.pathogens[p.type].switchesOffNodes) continue;
    for (const n of s.nodes) {
      if (n.off) continue;
      const site = siteById(n.site);
      if (!covers(n.vessel, p, site.stem) || p.s < nearestOnVessel(VESSELS[p.vessel], site.anchor).s) continue;
      n.off = true;
      s.rings.push({ x: site.x, y: site.y, r: 36, t: 0, dur: 0.7, kind: 'infect' });
      s.floaters.push({ x: site.x, y: site.y - 34, text: 'Switched off by HIV', t: 0, color: '#5a2878', size: 18 });
    }
  }
  for (const [type, v, at, committed] of shed) { const q = newPathogen(s, type, v, at); if (committed) q.committed = true; }
  for (const p of s.pathogens) if (!p.committed && p.s >= forkAt(p.vessel)) chooseBranch(s, p);

  // Lymph nodes: each fires its immunoglobulin at the most advanced pathogen on its own vessel within reach.
  for (const n of s.nodes) {
    n.cd -= dt;
    if (n.cd > 0 || n.off) continue;
    const st = CONFIG.nodes[n.type];
    const site = siteById(n.site);
    // the most advanced pathogen in reach
    let best: Pathogen | null = null;
    for (const p of s.pathogens) if (p.hp > 0 && !hidden(s, p) && covers(n.vessel, p, site.stem) && p.s > 0 && dist(pathogenPos(p), site) <= st.range && (!best || p.s > best.s)) best = p;
    if (!best) continue;
    n.cd = st.cooldown;
    n.flash = 0.4;
    const tp = pathogenPos(best);
    s.shots.push({ type: n.type, targets: n.targets, power: n.power ?? 1, vessel: n.vessel, x: site.x, y: site.y, sx: site.x, sy: site.y, targetId: best.id, t: 0, dur: Math.max(0.08, dist(site, tp) / st.shotSpeed) });
  }
  for (const sh of s.shots) {
    sh.t += dt;
    const p = s.pathogens.find((x) => x.id === sh.targetId && x.hp > 0);
    const k = Math.min(1, sh.t / sh.dur);
    if (p) { const q = pathogenPos(p); sh.x = sh.sx + (q.x - sh.sx) * k; sh.y = sh.sy + (q.y - sh.sy) * k; }
    // a shot that arrives while its boss is hiding in a red cell misses
    if (k >= 1 && p && !hidden(s, p)) {
      const st = CONFIG.nodes[sh.type];
      const dmg = antibodyDamage(sh.type, sh.targets, p.type) * s.perks.dmg[sh.type] * sh.power;
      if (sh.type === 'igg') {
        // show how well the IgG matched: big and bright for a good match, small and grey for a poor one
        const m = iggMultiplier(sh.targets, p.type), q = pathogenPos(p);
        if (m >= 2.5) s.floaters.push({ x: q.x, y: q.y - 26, text: `${Math.round(dmg)}`, t: 0, color: '#1e5fa8', size: 22 });
        else if (m <= 0.5) s.floaters.push({ x: q.x, y: q.y - 22, text: `${dmg}`, t: 0, color: 'rgba(90,80,75,0.8)', size: 14 });
      }
      hurt(s, p, dmg, true);
      if (st.slow && !CONFIG.pathogens[p.type].slowImmune) { p.slow = Math.min(p.slow, st.slow); p.slowT = st.slowSeconds ?? 2; }
    }
  }
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);

  // NO: every open vessel drains it; when it runs dry they all close. All closed, it slowly refills.
  if (s.open.length) {
    s.no -= CONFIG.no.drainPerSec * s.open.length * dt;
    if (s.no <= 0) { s.no = 0; s.noOuts++; closeRoute(s); }
  } else s.no = Math.min(s.perks.noMax, s.no + CONFIG.no.regenPerSec * dt);

  // White cells: returning ones head home (then out again along any open vessel); only cells out fight.
  const WC = CONFIG.whiteCell;
  returnHome(s, dt);
  // the spleen remakes lost white cells: they appear at home, then set out along any open vessel
  while (s.respawns.length && s.respawns[0] <= s.waveTime) {
    s.respawns.shift();
    const cost = LEVELS[s.level].respawn!.cost;
    s.heartHp = Math.max(0, s.heartHp - cost);
    s.leaks.remade = (s.leaks.remade ?? 0) + cost;
    s.floaters.push({ x: HEART.x, y: HEART.y - LEVELS[s.level].map.ry - 50, text: `−${cost} to remake a white cell`, t: 0, color: '#8a1e24' });
    const v = VESSEL_IDS[0];
    const lean = aliveCells(s).reduce((a, x) => a + Math.sign(x.side), 0); // take the side the living cells use less
    s.cells.push({ id: s.nextId++, vessel: v, s: VESSELS[v].length, hp: CONFIG.whiteCell.hp, maxHp: CONFIG.whiteCell.hp, hit: 0, side: (lean > 0 ? -1 : 1) * 11, targetId: null, mode: 'home', infected: false });
  }
  deployHome(s);
  for (const c of outCells(s)) {
    c.hit = Math.max(0, c.hit - dt);
    const L = VESSELS[c.vessel].length;
    const mine = s.pathogens.filter((p) => p.hp > 0 && !hidden(s, p) && !CONFIG.pathogens[p.type].ignoresCells && covers(c.vessel, p) && p.s > 0);
    const target = mine.reduce<Pathogen | null>((b, p) => (!b || p.s > b.s ? p : b), null);
    c.targetId = target?.id ?? null;
    const rank = outCells(s).filter((x) => x.vessel === c.vessel).indexOf(c);
    let goal = (target ? target.s : L * WC.guardAt) + rank * 22;
    goal = Math.max(L * WC.minReach, Math.min(L - 4, goal));
    const gap = goal - c.s;
    if (!target || Math.abs(gap) > WC.attackRange * 0.8) c.s += Math.sign(gap) * Math.min(Math.abs(gap), WC.speed * dt);
    const near = mine.filter((p) => Math.abs(p.s - c.s) <= WC.attackRange);
    // a hijacker that reaches a white cell gets inside it
    const hijacker = near.find((p) => CONFIG.pathogens[p.type].infects);
    if (hijacker) { infect(s, c, hijacker); continue; }
    if (near.length) {
      // a white cell fights everything it touches at once
      for (const p of near) hurt(s, p, WC.dps * dt);
      for (const p of near) { c.hp -= CONFIG.pathogens[p.type].contactDps * dt; c.hit = 0.12; }
      if (c.hp <= 0) { const q = cellPos(c); s.rings.push({ x: q.x, y: q.y, r: 30, t: 0, dur: 0.6, kind: 'cellDown' }); s.floaters.push({ x: q.x, y: q.y - 24, text: 'White cell lost', t: 0, color: '#c8402a' }); loseCell(s); }
    }
  }

  // Reaching the heart
  for (const p of s.pathogens) {
    if (p.hp > 0 && p.s >= VESSELS[p.vessel].length) {
      p.hp = 0;
      const dmg = CONFIG.pathogens[p.type].heartDamage;
      s.heartHp = Math.max(0, s.heartHp - dmg);
      const entry = entryOf(p.vessel);
      s.leaks.byVessel[entry] = (s.leaks.byVessel[entry] ?? 0) + dmg;
      s.leaks.byType[p.type] = (s.leaks.byType[p.type] ?? 0) + dmg;
      const wk = LEVELS[s.level].weakens;
      if (wk) for (const n of s.nodes) if (covers(n.vessel, p, siteById(n.site).stem)) n.power = Math.max(wk.min, (n.power ?? 1) - wk.per);
      s.leaked++;
      s.heartKick = 1;
      s.rings.push({ x: HEART.x, y: HEART.y, r: Math.max(LEVELS[s.level].map.rx, LEVELS[s.level].map.ry) + 30, t: 0, dur: 0.6, kind: 'heart' });
      s.floaters.push({ x: HEART.x, y: HEART.y - LEVELS[s.level].map.ry - 50, text: `−${dmg} ${LEVELS[s.level].organ.toLowerCase()} health`, t: 0, color: '#c8202a' });
    }
  }
  s.pathogens = s.pathogens.filter((p) => p.hp > 0);

  burstGallbladder(s);
  if (s.heartHp <= 0) { s.phase = 'defeat'; s.shots = []; return; }
  if (!s.spawns.length && !s.pathogens.length) {
    closeRoute(s);
    s.phase = 'recall';
    s.recallTime = 0;
    s.shots = [];
  }
}

/** An undecided pathogen reaches its vessel's fork: it takes the branch that is not dilated;
 *  with neither open, the vessel's pathogens alternate, first branch first. */
function chooseBranch(s: State, p: Pathogen) {
  const entry = entryOf(p.vessel), [a, b] = routesOf(entry);
  if (s.open.includes(a) && !s.open.includes(b)) p.vessel = b;
  else if (s.open.includes(b) && !s.open.includes(a)) p.vessel = a;
  else { const n = s.forkFlip[entry] ?? 0; p.vessel = n % 2 ? b : a; s.forkFlip[entry] = n + 1; }
  p.committed = true;
}

/** Returning cells travel back to the organ, fast and without fighting. */
function returnHome(s: State, dt: number) {
  for (const c of aliveCells(s)) {
    if (c.mode !== 'returning') continue;
    const L = VESSELS[c.vessel].length;
    c.s = Math.min(L, c.s + CONFIG.whiteCell.recallSpeed * dt);
    if (c.s >= L - 1) c.mode = 'home';
  }
}

/** End of wave: surviving white cells return to the heart, then the vessel contracts. */
function recall(s: State, dt: number) {
  s.recallTime += dt;
  returnHome(s, dt);
  if (s.recallTime > 6) for (const c of aliveCells(s)) c.mode = 'home';
  const allHome = aliveCells(s).every((c) => c.mode === 'home');
  const contracted = VESSEL_IDS.every((v) => s.width[v] <= 0.001);
  if (allHome && contracted) {
    s.cells = [];
    s.open = [];
    s.pulsesLeft = 0;
    // every node has fought one more wave; IgE nodes burn out after their last
    for (const n of s.nodes) n.wavesFought++;
    for (const n of s.nodes.filter((x) => CONFIG.nodes[x.type].burnsOutAfter && x.wavesFought >= CONFIG.nodes[x.type].burnsOutAfter!)) {
      const site = siteById(n.site);
      s.spent.push({ site: n.site, at: { x: site.x, y: site.y } });
      s.rings.push({ x: site.x, y: site.y, r: 46, t: 0, dur: 0.7, kind: 'pop' });
      s.floaters.push({ x: site.x, y: site.y - 34, text: 'IgE spent', t: 0, color: '#6a1e4a' });
    }
    s.nodes = s.nodes.filter((x) => !s.spent.some((sp) => sp.site === x.site));
    if (s.wave >= totalWaves(s)) { s.phase = 'victory'; return; }
    const bonus = Math.round(CONFIG.waveClearEnergy(s.wave) * (LEVELS[s.level].income ?? 1));
    s.energy += bonus;
    s.no = Math.min(s.perks.noMax, s.no + CONFIG.no.waveTopUp);
    s.discountUsed = false;
    const L = LEVELS[s.level];
    const regen = L.regenPerWave ? Math.min(L.regenPerWave, L.hp - s.heartHp) : 0;
    s.heartHp += regen;
    s.wave += 1;
    s.phase = 'prep';
    s.message = `Wave cleared: +${bonus} energy${regen > 0 ? `, the ${L.organ.toLowerCase()} regrows +${regen} health` : ''}. Every vessel is resting again; dilate during the next wave.`;
  }
}

export function whenLabel(start: number): string { return start < 4 ? 'at once' : start < 12 ? 'soon' : start < 20 ? 'later' : 'late'; }

export { HEART, NODE_TYPES };
