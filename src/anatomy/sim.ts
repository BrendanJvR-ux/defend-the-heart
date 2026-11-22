// Defend the Heart: state, rules and simulation. Pure logic, no DOM, so it runs in tests too.
import { CONFIG, TOTAL_WAVES, NODE_TYPES, type NodeType, type PathogenType, type VesselId } from './config';
import { VESSELS, VESSEL_IDS, SITES, siteById, HEART, pointAt, dist, type Vec } from './level';

export type Phase = 'prep' | 'combat' | 'recall' | 'victory' | 'defeat';

export interface Pathogen {
  id: number; type: PathogenType; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; wob: number;
  /** IgG: armour stripped, and for how long. */
  shred: number; shredT: number;
  /** IgA: speed multiplier and how long it lasts. */
  slow: number; slowT: number;
}
export interface WhiteCell { id: number; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; targetId: number | null; home: boolean; infected: boolean }
export interface LymphNode { id: number; site: string; vessel: VesselId; type: NodeType; cd: number; flash: number }
export interface Shot { type: NodeType; vessel: VesselId; x: number; y: number; sx: number; sy: number; targetId: number; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'pulse' | 'pop' | 'cellDown' | 'heart' | 'infect' | 'build' }
export interface Floater { x: number; y: number; text: string; t: number; color: string }
export interface Spawn { type: PathogenType; vessel: VesselId; at: number }

export interface State {
  phase: Phase;
  paused: boolean;
  speed: number;
  wave: number;
  heartHp: number;
  energy: number;
  dilated: VesselId | null;
  width: Record<VesselId, number>;
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

export function newGame(): State {
  const s: State = {
    phase: 'prep', paused: false, speed: 1, wave: 1, heartHp: CONFIG.heartHp, energy: CONFIG.startEnergy, dilated: null,
    width: zeroWidths(), nodes: [], pathogens: [], cells: [], shots: [], rings: [], floaters: [], spawns: [],
    pulsesLeft: 0, waveTime: 0, time: 0, heartKick: 0, nextId: 1, leaked: 0, killed: 0, infections: 0, recallTime: 0, lastPulseHits: 0, message: '',
  };
  for (const n of CONFIG.startingNodes) {
    const site = SITES.find((x) => x.vessel === n.vessel && x.index === n.site);
    if (site) s.nodes.push({ id: s.nextId++, site: site.id, vessel: site.vessel, type: n.type, cd: 0, flash: 0 });
  }
  return s;
}

export const wave = (s: State) => CONFIG.waves[s.wave - 1];
export const aliveCells = (s: State) => s.cells.filter((c) => c.hp > 0 && !c.infected);
export const nodeAt = (s: State, site: string) => s.nodes.find((n) => n.site === site);

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

/** Choose the one vessel to dilate. Selecting another replaces the choice. Locked during combat. */
export function selectVessel(s: State, v: VesselId): boolean {
  if (s.phase !== 'prep') return false;
  s.dilated = v;
  return true;
}

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
  if (!s.dilated) return { ok: false, reason: 'Dilate one vessel first.' };
  return { ok: true, reason: '' };
}

export function waveSpawns(n: number): Spawn[] {
  const out: Spawn[] = [];
  for (const g of CONFIG.waves[n - 1].groups) for (let i = 0; i < g.count; i++) out.push({ type: g.type, vessel: g.vessel, at: g.start + i * g.interval });
  return out.sort((a, b) => a.at - b.at);
}

export function startWave(s: State): boolean {
  if (!canStartWave(s).ok) return false;
  const v = s.dilated!;
  s.phase = 'combat';
  s.waveTime = 0;
  s.spawns = waveSpawns(s.wave);
  s.pulsesLeft = CONFIG.immunePulse.perWave;
  s.lastPulseHits = 0;
  for (const n of s.nodes) n.cd = 0.3;
  const L = VESSELS[v].length;
  s.cells = [];
  for (let i = 0; i < CONFIG.whiteCell.startingCount; i++) {
    s.cells.push({ id: s.nextId++, vessel: v, s: L - 8 - i * 30, hp: CONFIG.whiteCell.hp, maxHp: CONFIG.whiteCell.hp, hit: 0, side: (i % 2 ? 1 : -1) * 11, targetId: null, home: false, infected: false });
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
  return { ok: true, reason: '' };
}

/** Pathogens a pulse would hit right now: inside the radius of a living cell AND on that cell's vessel. */
export function pulseTargets(s: State): Pathogen[] {
  const R = CONFIG.immunePulse.radius;
  const hit = new Set<Pathogen>();
  for (const c of aliveCells(s)) {
    const cp = cellPos(c);
    for (const p of s.pathogens) if (p.hp > 0 && p.vessel === c.vessel && dist(pathogenPos(p), cp) <= R) hit.add(p);
  }
  return [...hit];
}

/** Fire the one pulse of this wave. Spends the charge first, so a double tap cannot fire twice. */
export function firePulse(s: State): number {
  if (!pulseCheck(s).ok) return -1;
  s.pulsesLeft -= 1;
  const targets = pulseTargets(s);
  for (const c of aliveCells(s)) { const p = cellPos(c); s.rings.push({ x: p.x, y: p.y, r: CONFIG.immunePulse.radius, t: 0, dur: CONFIG.immunePulse.ringSeconds, kind: 'pulse' }); }
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
    s.killed++;
    s.energy += CONFIG.pathogens[p.type].bounty;
    const q = pathogenPos(p);
    s.rings.push({ x: q.x, y: q.y, r: 18, t: 0, dur: 0.35, kind: 'pop' });
  }
}

function newPathogen(s: State, type: PathogenType, vessel: VesselId, at = 0): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: (Math.random() * 2 - 1) * 7, wob: Math.random() * 6, shred: 0, shredT: 0, slow: 1, slowT: 0 };
  s.pathogens.push(p);
  return p;
}

/** A hijacker virus enters a white cell: the cell is lost and rises again as an infected cell heading for the heart. */
export function infect(s: State, c: WhiteCell, virus: Pathogen) {
  virus.hp = 0;
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
    const open = s.dilated === v && (s.phase === 'prep' || s.phase === 'combat' || (s.phase === 'recall' && s.cells.some((c) => !c.home)));
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

  // Pathogens drift with the blood towards the heart (IgA slows them).
  for (const p of s.pathogens) {
    p.hit = Math.max(0, p.hit - dt);
    p.wob += dt * 4;
    if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) p.slow = 1; }
    if (p.shredT > 0) { p.shredT -= dt; if (p.shredT <= 0) p.shred = 0; }
    p.s += CONFIG.pathogens[p.type].speed * p.slow * dt;
  }

  // Lymph nodes: each fires its immunoglobulin at the most advanced pathogen on its own vessel within reach.
  for (const n of s.nodes) {
    n.cd -= dt;
    if (n.cd > 0) continue;
    const st = CONFIG.nodes[n.type];
    const site = siteById(n.site);
    let best: Pathogen | null = null;
    for (const p of s.pathogens) if (p.hp > 0 && p.vessel === n.vessel && p.s > 0 && dist(pathogenPos(p), site) <= st.range && (!best || p.s > best.s)) best = p;
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
      hurt(s, p, st.damage, true);
      if (st.shred) { p.shred = Math.min(CONFIG.pathogens[p.type].armour, st.shred); p.shredT = st.shredSeconds ?? 3; }
      if (st.slow) { p.slow = Math.min(p.slow, st.slow); p.slowT = st.slowSeconds ?? 2; }
    }
  }
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);

  // White cells: only ever on their own (dilated) vessel; they move against the flow to meet pathogens.
  const WC = CONFIG.whiteCell;
  for (const c of aliveCells(s)) {
    c.hit = Math.max(0, c.hit - dt);
    const L = VESSELS[c.vessel].length;
    const mine = s.pathogens.filter((p) => p.hp > 0 && p.vessel === c.vessel && p.s > 0);
    const target = mine.reduce<Pathogen | null>((b, p) => (!b || p.s > b.s ? p : b), null);
    c.targetId = target?.id ?? null;
    const rank = aliveCells(s).indexOf(c);
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
      s.rings.push({ x: HEART.x, y: HEART.y, r: 130, t: 0, dur: 0.6, kind: 'heart' });
      s.floaters.push({ x: HEART.x, y: HEART.y - 150, text: `−${dmg} heart health`, t: 0, color: '#c8202a' });
    }
  }
  s.pathogens = s.pathogens.filter((p) => p.hp > 0);

  if (s.heartHp <= 0) { s.phase = 'defeat'; s.shots = []; return; }
  if (!s.spawns.length && !s.pathogens.length) {
    s.phase = 'recall';
    s.recallTime = 0;
    s.shots = [];
    for (const c of s.cells) c.home = c.hp <= 0;
  }
}

/** End of wave: surviving white cells return to the heart, then the vessel contracts. */
function recall(s: State, dt: number) {
  s.recallTime += dt;
  for (const c of s.cells) {
    if (c.home) continue;
    const L = VESSELS[c.vessel].length;
    c.s = Math.min(L, c.s + CONFIG.whiteCell.recallSpeed * dt);
    if (c.s >= L - 1 || s.recallTime > 6) c.home = true;
  }
  const allHome = s.cells.every((c) => c.home);
  const contracted = VESSEL_IDS.every((v) => s.width[v] <= 0.001);
  if (allHome && contracted) {
    s.cells = [];
    s.dilated = null;
    s.pulsesLeft = 0;
    if (s.wave >= TOTAL_WAVES) { s.phase = 'victory'; return; }
    const bonus = CONFIG.waveClearEnergy(s.wave);
    s.energy += bonus;
    s.wave += 1;
    s.phase = 'prep';
    s.message = `Wave cleared: +${bonus} energy. The vessel has contracted; choose again for the next wave.`;
  }
}

export function whenLabel(start: number): string { return start < 4 ? 'at once' : start < 12 ? 'soon' : start < 20 ? 'later' : 'late'; }

export { HEART, NODE_TYPES };
