// Defend the Heart: state, rules and simulation. Pure logic, no DOM, so it runs in tests too.
import { CONFIG, LEVELS, NODE_TYPES, type LevelDef, type NodeType, type PathogenType, type VesselId } from './config';
import { VESSELS, VESSEL_IDS, SITES, siteById, HEART, LEVEL_INDEX, loadLevel, pointAt, dist, entryOf, forkAt, routesOf, type Vec } from './level';

export type Phase = 'prep' | 'combat' | 'recall' | 'victory' | 'defeat';

export interface Pathogen {
  /** `vessel` is the route it travels. On a forked vessel it is the first branch until it reaches the fork
   *  (`committed` false); there it picks a branch for good. */
  id: number; type: PathogenType; vessel: VesselId; committed: boolean; s: number; hp: number; maxHp: number; hit: number; side: number; wob: number;
  /** IgG: armour stripped, and for how long. */
  shred: number; shredT: number;
  /** IgA: speed multiplier and how long it lasts. */
  slow: number; slowT: number;
  /** Bosses that shed: seconds until the next one. */
  shedT?: number;
}
/** home: waiting at the organ; out: travelling and fighting along the open vessel; returning: heading home, not fighting. */
export type CellMode = 'home' | 'out' | 'returning';
export interface WhiteCell { id: number; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; targetId: number | null; mode: CellMode; infected: boolean }
export interface LymphNode { id: number; site: string; vessel: VesselId; type: NodeType; cd: number; flash: number }
export interface Shot { type: NodeType; vessel: VesselId; x: number; y: number; sx: number; sy: number; targetId: number; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'pulse' | 'pop' | 'cellDown' | 'heart' | 'infect' | 'build' }
export interface Floater { x: number; y: number; text: string; t: number; color: string }
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
export function newGame(level = LEVEL_INDEX): State {
  loadLevel(level);
  const L = LEVELS[level];
  const s: State = {
    level, phase: 'prep', paused: false, speed: 1, wave: 1, heartHp: L.hp, energy: L.startEnergy, dilated: null, no: CONFIG.no.max, noOuts: 0,
    width: zeroWidths(), forkFlip: {}, nodes: [], pathogens: [], cells: [], shots: [], rings: [], floaters: [], spawns: [],
    pulsesLeft: 0, waveTime: 0, time: 0, heartKick: 0, nextId: 1, leaked: 0, killed: 0, infections: 0, recallTime: 0, lastPulseHits: 0, message: '',
  };
  for (const n of L.startingNodes) {
    const site = SITES.find((x) => x.vessel === n.vessel && x.index === n.site);
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0 });
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

export function effectiveArmour(p: Pathogen): number { return Math.max(0, CONFIG.pathogens[p.type].armour - p.shred); }

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


export function buildCheck(s: State, siteId: string, type: NodeType): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: 'Lymph nodes can only be placed between waves.' };
  if (!SITES.some((x) => x.id === siteId)) return { ok: false, reason: 'Not a site for a lymph node.' };
  if (nodeAt(s, siteId)) return { ok: false, reason: 'A lymph node is already there.' };
  const cost = CONFIG.nodes[type].cost;
  if (s.energy < cost) return { ok: false, reason: `Needs ${cost} energy (you have ${s.energy}).` };
  return { ok: true, reason: '' };
}

export function placeNode(s: State, siteId: string, type: NodeType): boolean {
  if (!buildCheck(s, siteId, type).ok) return false;
  const site = siteById(siteId);
  s.energy -= CONFIG.nodes[type].cost;
  s.nodes.push({ id: s.nextId++, site: siteId, vessel: site.vessel, type, cd: 0.3, flash: 1 });
  s.rings.push({ x: site.x, y: site.y, r: 40, t: 0, dur: 0.5, kind: 'build' });
  return true;
}

export function canStartWave(s: State): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: '' };
  return { ok: true, reason: '' };
}

// ── Combat: dilation, paid for with NO ──────────────────────────────────────

/** Can vessel r be opened (or, if it is the open one, closed) right now? */
export function dilateCheck(s: State, r: VesselId): { ok: boolean; reason: string } {
  if (s.phase !== 'combat') return { ok: false, reason: 'Dilate during the wave.' };
  if (!VESSELS[r]) return { ok: false, reason: 'Not a vessel of this organ.' };
  if (s.dilated === r) return { ok: true, reason: '' };
  if (s.no < CONFIG.no.openCost) return { ok: false, reason: `Not enough NO to open the ${VESSELS[r].name.toLowerCase()}.` };
  return { ok: true, reason: '' };
}

/** Open r (paying NO; any other open vessel relaxes), or close r if it is already open. */
export function toggleRoute(s: State, r: VesselId): boolean {
  if (!dilateCheck(s, r).ok) return false;
  if (s.dilated === r) { closeRoute(s); return true; }
  closeRoute(s);
  s.no -= CONFIG.no.openCost;
  s.dilated = r;
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
  s.pulsesLeft = CONFIG.immunePulse.perWave;
  s.lastPulseHits = 0;
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
    for (const p of s.pathogens) if (p.hp > 0 && covers(c.vessel, p) && dist(pathogenPos(p), cp) <= R) hit.add(p);
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

/** Damage a pathogen. Antibodies are reduced by armour; white cells and the pulse are not. */
export function hurt(s: State, p: Pathogen, dmg: number, armoured = false) {
  if (p.hp <= 0) return;
  p.hp -= armoured ? Math.max(1, dmg - effectiveArmour(p)) : dmg;
  p.hit = 0.15;
  if (p.hp <= 0) {
    const st = CONFIG.pathogens[p.type];
    s.killed++;
    s.energy += st.bounty;
    const q = pathogenPos(p);
    s.rings.push({ x: q.x, y: q.y, r: st.boss ? 70 : 18, t: 0, dur: st.boss ? 0.9 : 0.35, kind: 'pop' });
    if (st.boss) s.floaters.push({ x: q.x, y: q.y - 50, text: `${st.name} destroyed!`, t: 0, color: '#1e6a8a' });
    if (st.splitInto) {
      // the colony bursts: its bacteria spill out around where it died
      for (let i = 0; i < st.splitInto.count; i++) {
        const b = newPathogen(s, st.splitInto.type, p.vessel, Math.max(0, p.s - 10 + i * 8));
        b.side = (i % 2 ? 1 : -1) * (4 + i * 2);
        b.hp = b.maxHp = Math.round(b.maxHp * (st.splitInto.hpFactor ?? 1));
      }
    }
  }
}

function newPathogen(s: State, type: PathogenType, vessel: VesselId, at = 0): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, committed: at >= forkAt(vessel), s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: st.boss ? 0 : (Math.random() * 2 - 1) * 7, wob: Math.random() * 6, shred: 0, shredT: 0, slow: 1, slowT: 0, shedT: st.sheds?.every };
  s.pathogens.push(p);
  if (st.boss) {
    const m = pointAt(VESSELS[vessel], 90);
    s.floaters.push({ x: Math.max(160, Math.min(1440, m.x)), y: Math.max(80, m.y - 40), text: `Boss: ${st.name}!`, t: 0, color: '#8a1e24' });
  }
  return p;
}

/** A hijacker virus enters a white cell: the cell is lost and rises again as an infected cell heading for the heart.
 *  An ordinary hijacker is used up; the sepsis boss keeps going. */
export function infect(s: State, c: WhiteCell, virus: Pathogen) {
  if (!CONFIG.pathogens[virus.type].infectsMany) virus.hp = 0;
  c.hp = 0;
  c.infected = true;
  s.infections++;
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
  const shed: [PathogenType, VesselId, number][] = [];
  for (const p of s.pathogens) {
    p.hit = Math.max(0, p.hit - dt);
    p.wob += dt * 4;
    if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) p.slow = 1; }
    if (p.shredT > 0) { p.shredT -= dt; if (p.shredT <= 0) p.shred = 0; }
    p.s += CONFIG.pathogens[p.type].speed * p.slow * organFlow(s, p) * dt;
    const st = CONFIG.pathogens[p.type];
    if (st.regen && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);
    if (st.sheds && p.hp > 0 && p.s > 0) {
      p.shedT = (p.shedT ?? st.sheds.every) - dt;
      if (p.shedT <= 0) { p.shedT += st.sheds.every; shed.push([st.sheds.type, p.vessel, Math.max(0, p.s - 6)]); }
    }
  }
  for (const [type, v, at] of shed) newPathogen(s, type, v, at);
  for (const p of s.pathogens) if (!p.committed && p.s >= forkAt(p.vessel)) chooseBranch(s, p);

  // Lymph nodes: each fires its immunoglobulin at the most advanced pathogen on its own vessel within reach.
  for (const n of s.nodes) {
    n.cd -= dt;
    if (n.cd > 0) continue;
    const st = CONFIG.nodes[n.type];
    const site = siteById(n.site);
    // most advanced pathogen in reach; an IgE node takes any boss in reach first
    const rank = (p: Pathogen) => p.s + (st.bossDamage && CONFIG.pathogens[p.type].boss ? 1e6 : 0);
    let best: Pathogen | null = null;
    for (const p of s.pathogens) if (p.hp > 0 && covers(n.vessel, p, site.stem) && p.s > 0 && dist(pathogenPos(p), site) <= st.range && (!best || rank(p) > rank(best))) best = p;
    if (!best) continue;
    n.cd = st.cooldown;
    n.flash = 0.4;
    const tp = pathogenPos(best);
    s.shots.push({ type: n.type, vessel: n.vessel, x: site.x, y: site.y, sx: site.x, sy: site.y, targetId: best.id, t: 0, dur: Math.max(0.08, dist(site, tp) / st.shotSpeed) });
  }
  for (const sh of s.shots) {
    sh.t += dt;
    const p = s.pathogens.find((x) => x.id === sh.targetId && x.hp > 0);
    const k = Math.min(1, sh.t / sh.dur);
    if (p) { const q = pathogenPos(p); sh.x = sh.sx + (q.x - sh.sx) * k; sh.y = sh.sy + (q.y - sh.sy) * k; }
    if (k >= 1 && p) {
      const st = CONFIG.nodes[sh.type];
      if (st.bossDamage && CONFIG.pathogens[p.type].boss) hurt(s, p, st.bossDamage, false);
      else hurt(s, p, st.damage, true);
      if (st.shred) { p.shred = Math.min(CONFIG.pathogens[p.type].armour, st.shred); p.shredT = st.shredSeconds ?? 3; }
      if (st.slow && !CONFIG.pathogens[p.type].slowImmune) { p.slow = Math.min(p.slow, st.slow); p.slowT = st.slowSeconds ?? 2; }
    }
  }
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);

  // NO: an open vessel drains it; when it runs dry the vessel closes. Closed, it slowly refills.
  if (s.dilated) {
    s.no -= CONFIG.no.drainPerSec * dt;
    if (s.no <= 0) { s.no = 0; s.noOuts++; closeRoute(s); }
  } else s.no = Math.min(CONFIG.no.max, s.no + CONFIG.no.regenPerSec * dt);

  // White cells: returning ones head home (then out again along any open vessel); only cells out fight.
  const WC = CONFIG.whiteCell;
  returnHome(s, dt);
  deployHome(s);
  for (const c of outCells(s)) {
    c.hit = Math.max(0, c.hit - dt);
    const L = VESSELS[c.vessel].length;
    const mine = s.pathogens.filter((p) => p.hp > 0 && covers(c.vessel, p) && p.s > 0);
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
      if (c.hp <= 0) { const q = cellPos(c); s.rings.push({ x: q.x, y: q.y, r: 30, t: 0, dur: 0.6, kind: 'cellDown' }); s.floaters.push({ x: q.x, y: q.y - 24, text: 'White cell lost', t: 0, color: '#c8402a' }); }
    }
  }

  // Reaching the heart
  for (const p of s.pathogens) {
    if (p.hp > 0 && p.s >= VESSELS[p.vessel].length) {
      p.hp = 0;
      const dmg = CONFIG.pathogens[p.type].heartDamage;
      s.heartHp = Math.max(0, s.heartHp - dmg);
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
    if (s.wave >= totalWaves(s)) { s.phase = 'victory'; return; }
    const bonus = CONFIG.waveClearEnergy(s.wave);
    s.energy += bonus;
    s.no = Math.min(CONFIG.no.max, s.no + CONFIG.no.waveTopUp);
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
