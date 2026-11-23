// Defend the Heart: state, rules and simulation. Pure logic, no DOM, so it runs in tests too.
import { CONFIG, LEVELS, NODE_TYPES, type BacteriumType, type LevelDef, type NodeType, type PathogenType, type VesselId } from './config';
import { NO_PERKS, type Perks, type RunSave } from './career';
import { VESSELS, VESSEL_IDS, SITES, siteById, HEART, LEVEL_INDEX, loadLevel, pointAt, dist, entryOf, forkAt, routesOf, type Vec } from './level';

export type Phase = 'prep' | 'combat' | 'recall' | 'victory' | 'defeat';

export interface Pathogen {
  /** `vessel` is the route it travels. On a forked vessel it is the first branch until it reaches the fork
   *  (`committed` false); there it picks a branch for good. */
  id: number; type: PathogenType; vessel: VesselId; committed: boolean; s: number; hp: number; maxHp: number; hit: number; side: number; wob: number;
  /** IgA: speed multiplier and how long it lasts. */
  slow: number; slowT: number;
  /** Bosses that shed: seconds until the next one. */
  shedT?: number;
}
/** home: waiting at the organ; out: travelling and fighting along the open vessel; returning: heading home, not fighting. */
export type CellMode = 'home' | 'out' | 'returning';
export interface WhiteCell { id: number; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; targetId: number | null; mode: CellMode; infected: boolean }
/** `targets`: what an IgG node is aimed at (one, or two with the dual-target upgrade); empty for other types.
 *  `wavesFought`: cleared waves since it was placed (IgE burns out). */
export interface LymphNode { id: number; site: string; vessel: VesselId; type: NodeType; cd: number; flash: number; targets: BacteriumType[]; wavesFought: number }
export interface Shot { type: NodeType; targets: BacteriumType[]; vessel: VesselId; x: number; y: number; sx: number; sy: number; targetId: number; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'pulse' | 'pop' | 'cellDown' | 'heart' | 'infect' | 'build' }
export interface Floater { x: number; y: number; text: string; t: number; color: string; size?: number }
export interface Spawn { type: PathogenType; vessel: VesselId; at: number }

export interface State {
  /** Index into LEVELS: which organ is being defended. */
  level: number;
  phase: Phase;
  paused: boolean;
  speed: number;
  wave: number;
  heartHp: number;
  energy: number;
  dilated: VesselId | null;
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
    level, phase: 'prep', paused: false, speed: 1, wave: 1, heartHp: L.hp, energy: L.startEnergy, dilated: null, no: perks.noMax, noOuts: 0,
    perks, discountUsed: false, rng: seed >>> 0, respawns: [], leaks: { byVessel: {}, byType: {} },
    width: zeroWidths(), forkFlip: {}, spent: [], nodes: [], pathogens: [], cells: [], shots: [], rings: [], floaters: [], spawns: [],
    pulsesLeft: 0, waveTime: 0, time: 0, heartKick: 0, nextId: 1, leaked: 0, killed: 0, infections: 0, recallTime: 0, lastPulseHits: 0, message: '',
  };
  for (const n of L.startingNodes) {
    const site = SITES.find((x) => x.vessel === n.vessel && x.index === n.site);
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0, targets: n.type === 'igg' ? ['saureus'] : [], wavesFought: 0 });
  }
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
  s.nodes = [];
  for (const n of run.nodes) {
    const site = SITES.find((x) => x.id === n.site);
    if (!site || !CONFIG.nodes[n.type] || s.nodes.some((x) => x.site === n.site)) continue;
    // IgG targets: only ones this career has unlocked, two only with dual-target, S. aureus if none are left
    let targets = n.type === 'igg' ? n.targets.filter((b) => perks.targets.includes(b)).slice(0, perks.dual ? 2 : 1) : [];
    if (n.type === 'igg' && !targets.length) targets = ['saureus'];
    s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0, targets, wavesFought: n.wavesFought | 0 });
  }
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
export function organFlow(s: State, p: Pathogen): number {
  let k = 1;
  if (surging(s)) k *= LEVELS[s.level].surge!.factor;
  if (filtered(s, p)) k *= LEVELS[s.level].filtration!.factor;
  return k;
}
/** The boss currently in play, if any. */
export const activeBoss = (s: State) => s.pathogens.find((p) => p.hp > 0 && CONFIG.pathogens[p.type].boss);
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
function targetsCheck(s: State, targets: BacteriumType[]): string {
  if (!targets.length) return 'Choose what this IgG targets.';
  if (targets.length > 2 || new Set(targets).size !== targets.length) return 'Choose one target, or two different ones.';
  if (targets.length === 2 && !s.perks.dual) return 'Dual-target IgG is an upgrade.';
  if (targets.some((b) => !s.perks.targets.includes(b))) return 'Unlock this target in Upgrades.';
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
export const selectableTargets = (s: State): BacteriumType[] => [...s.perks.targets];

/** Re-aim a placed IgG node between waves. */
export function retargetCheck(s: State, siteId: string, targets: BacteriumType[]): { ok: boolean; reason: string } {
  const n = nodeAt(s, siteId);
  if (s.phase !== 'prep') return { ok: false, reason: 'Lymph nodes can only be changed between waves.' };
  if (!n || n.type !== 'igg') return { ok: false, reason: 'Only an IgG node can be re-aimed.' };
  const t = targetsCheck(s, targets);
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

/** Can vessel r be opened (or, if it is the open one, closed) right now? */
export function dilateCheck(s: State, r: VesselId): { ok: boolean; reason: string } {
  if (s.phase !== 'combat') return { ok: false, reason: 'Dilate during the wave.' };
  if (s.paused) return { ok: false, reason: 'Paused.' };
  if (!VESSELS[r]) return { ok: false, reason: 'Not a vessel of this organ.' };
  if (s.dilated === r) return { ok: true, reason: '' };
  if (s.no < openNeed()) return { ok: false, reason: `Not enough NO to open the ${VESSELS[r].name.toLowerCase()}.` };
  return { ok: true, reason: '' };
}

/** Open r (paying NO; any other open vessel relaxes), or close r if it is already open. */
export function toggleRoute(s: State, r: VesselId): boolean {
  if (!dilateCheck(s, r).ok) return false;
  if (s.dilated === r) { closeRoute(s); return true; }
  closeRoute(s);
  s.no -= CONFIG.no.openCost;
  s.dilated = r;
  // cells still heading home along this vessel turn round where they are
  for (const c of aliveCells(s)) if (c.mode === 'returning' && c.vessel === r) c.mode = 'out';
  deployHome(s);
  return true;
}

/** Close the open vessel: cells out on it head home. */
export function closeRoute(s: State) {
  s.dilated = null;
  for (const c of aliveCells(s)) if (c.mode === 'out') { c.mode = 'returning'; c.targetId = null; }
}

/** Cells waiting at the organ set out along the open vessel. */
function deployHome(s: State) {
  if (!s.dilated) return;
  const L = VESSELS[s.dilated].length;
  let i = outCells(s).length;
  for (const c of aliveCells(s)) if (c.mode === 'home') { c.vessel = s.dilated; c.s = L - 8 - i * 30; c.mode = 'out'; c.targetId = null; i++; }
}

export function waveSpawns(n: number, level = LEVEL_INDEX): Spawn[] {
  const out: Spawn[] = [];
  for (const g of LEVELS[level].waves[n - 1].groups) for (let i = 0; i < g.count; i++) out.push({ type: g.type, vessel: routesOf(g.vessel)[0], at: g.start + i * g.interval });
  return out.sort((a, b) => a.at - b.at);
}

export function startWave(s: State): boolean {
  if (!canStartWave(s).ok) return false;
  const v = VESSEL_IDS[0];
  s.phase = 'combat';
  s.dilated = null;
  s.waveTime = 0;
  s.spawns = waveSpawns(s.wave, s.level);
  s.respawns = [];
  s.pulsesLeft = CONFIG.immunePulse.perWave;
  s.lastPulseHits = 0;
  s.spent = [];
  for (const n of s.nodes) n.cd = 0.3;
  const L = VESSELS[v].length;
  s.cells = [];
  for (let i = 0; i < LEVELS[s.level].cells; i++) {
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
  return { ok: true, reason: '' };
}

/** Pathogens a pulse would hit right now: inside the radius of a living cell AND on that cell's vessel. */
export function pulseTargets(s: State): Pathogen[] {
  const R = CONFIG.immunePulse.radius;
  const hit = new Set<Pathogen>();
  for (const c of outCells(s)) {
    const cp = cellPos(c);
    for (const p of s.pathogens) if (p.hp > 0 && !hidden(s, p) && covers(c.vessel, p) && dist(pathogenPos(p), cp) <= R) hit.add(p);
  }
  return [...hit];
}

/** Fire the one pulse of this wave. Spends the charge first, so a double tap cannot fire twice. */
export function firePulse(s: State): number {
  if (!pulseCheck(s).ok) return -1;
  s.pulsesLeft -= 1;
  const targets = pulseTargets(s);
  for (const c of outCells(s)) { const p = cellPos(c); s.rings.push({ x: p.x, y: p.y, r: CONFIG.immunePulse.radius, t: 0, dur: CONFIG.immunePulse.ringSeconds, kind: 'pulse' }); }
  for (const p of targets) hurt(s, p, CONFIG.immunePulse.damage);
  s.lastPulseHits = targets.length;
  return targets.length;
}

// ── Simulation ──────────────────────────────────────────────────────────────

/** Damage a pathogen. */
export function hurt(s: State, p: Pathogen, dmg: number) {
  if (p.hp <= 0) return;
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
  const p: Pathogen = { id: s.nextId++, type, vessel, committed: at >= forkAt(vessel), s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: st.boss ? 0 : (rand(s) * 2 - 1) * 7, wob: rand(s) * 6, slow: 1, slowT: 0, shedT: st.sheds?.every };
  s.pathogens.push(p);
  if (st.boss) {
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

/** A hiding boss inside a red blood cell: nothing can target or hit it. */
export function hidden(s: State, p: Pathogen): boolean {
  const h = CONFIG.pathogens[p.type].hides;
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
    const open = s.dilated === v && s.phase === 'combat';
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
    + (s.perks.targets.includes(st.taxon.species) ? '' : ` Unlock the ${name} target in Upgrades first: you don't have it yet.`);
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
    if (st.sheds && p.hp > 0 && p.s > 0) {
      p.shedT = (p.shedT ?? st.sheds.every) - dt;
      if (p.shedT <= 0) { p.shedT += st.sheds.every; shed.push([st.sheds.type, p.vessel, Math.max(0, p.s - 6), p.committed]); }
    }
  }
  for (const [type, v, at, committed] of shed) { const q = newPathogen(s, type, v, at); if (committed) q.committed = true; }
  for (const p of s.pathogens) if (!p.committed && p.s >= forkAt(p.vessel)) chooseBranch(s, p);

  // Lymph nodes: each fires its immunoglobulin at the most advanced pathogen on its own vessel within reach.
  for (const n of s.nodes) {
    n.cd -= dt;
    if (n.cd > 0) continue;
    const st = CONFIG.nodes[n.type];
    const site = siteById(n.site);
    // the most advanced pathogen in reach
    let best: Pathogen | null = null;
    for (const p of s.pathogens) if (p.hp > 0 && !hidden(s, p) && covers(n.vessel, p, site.stem) && p.s > 0 && dist(pathogenPos(p), site) <= st.range && (!best || p.s > best.s)) best = p;
    if (!best) continue;
    n.cd = st.cooldown;
    n.flash = 0.4;
    const tp = pathogenPos(best);
    s.shots.push({ type: n.type, targets: n.targets, vessel: n.vessel, x: site.x, y: site.y, sx: site.x, sy: site.y, targetId: best.id, t: 0, dur: Math.max(0.08, dist(site, tp) / st.shotSpeed) });
  }
  for (const sh of s.shots) {
    sh.t += dt;
    const p = s.pathogens.find((x) => x.id === sh.targetId && x.hp > 0);
    const k = Math.min(1, sh.t / sh.dur);
    if (p) { const q = pathogenPos(p); sh.x = sh.sx + (q.x - sh.sx) * k; sh.y = sh.sy + (q.y - sh.sy) * k; }
    // a shot that arrives while its boss is hiding in a red cell misses
    if (k >= 1 && p && !hidden(s, p)) {
      const st = CONFIG.nodes[sh.type];
      const dmg = antibodyDamage(sh.type, sh.targets, p.type) * s.perks.dmg[sh.type];
      if (sh.type === 'igg') {
        // show how well the IgG matched: big and bright for a good match, small and grey for a poor one
        const m = iggMultiplier(sh.targets, p.type), q = pathogenPos(p);
        if (m >= 2.5) s.floaters.push({ x: q.x, y: q.y - 26, text: `${Math.round(dmg)}`, t: 0, color: '#1e5fa8', size: 22 });
        else if (m <= 0.5) s.floaters.push({ x: q.x, y: q.y - 22, text: `${dmg}`, t: 0, color: 'rgba(90,80,75,0.8)', size: 14 });
      }
      hurt(s, p, dmg);
      if (st.slow && !CONFIG.pathogens[p.type].slowImmune) { p.slow = Math.min(p.slow, st.slow); p.slowT = st.slowSeconds ?? 2; }
    }
  }
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);

  // NO: an open vessel drains it; when it runs dry the vessel closes. Closed, it slowly refills.
  if (s.dilated) {
    s.no -= CONFIG.no.drainPerSec * dt;
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
    const mine = s.pathogens.filter((p) => p.hp > 0 && !hidden(s, p) && covers(c.vessel, p) && p.s > 0);
    const target = mine.reduce<Pathogen | null>((b, p) => (!b || p.s > b.s ? p : b), null);
    c.targetId = target?.id ?? null;
    const rank = outCells(s).indexOf(c);
    let goal = (target ? target.s : L * WC.guardAt) + rank * 22;
    goal = Math.max(L * WC.minReach, Math.min(L - 4, goal));
    const gap = goal - c.s;
    if (!target || Math.abs(gap) > WC.attackRange * 0.8) c.s += Math.sign(gap) * Math.min(Math.abs(gap), WC.speed * dt);
    const near = mine.filter((p) => Math.abs(p.s - c.s) <= WC.attackRange);
    // a hijacker that reaches a white cell gets inside it
    const hijacker = near.find((p) => CONFIG.pathogens[p.type].infects);
    if (hijacker) { infect(s, c, hijacker); continue; }
    if (near.length) {
      const victim = near.reduce((b, p) => (p.s > b.s ? p : b));
      hurt(s, victim, WC.dps * dt);
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
      s.leaked++;
      s.heartKick = 1;
      s.rings.push({ x: HEART.x, y: HEART.y, r: Math.max(LEVELS[s.level].map.rx, LEVELS[s.level].map.ry) + 30, t: 0, dur: 0.6, kind: 'heart' });
      s.floaters.push({ x: HEART.x, y: HEART.y - LEVELS[s.level].map.ry - 50, text: `−${dmg} ${LEVELS[s.level].organ.toLowerCase()} health`, t: 0, color: '#c8202a' });
    }
  }
  s.pathogens = s.pathogens.filter((p) => p.hp > 0);

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
  if (s.dilated === a) p.vessel = b;
  else if (s.dilated === b) p.vessel = a;
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
    s.dilated = null;
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
