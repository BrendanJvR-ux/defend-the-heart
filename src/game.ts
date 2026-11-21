// Game state, rules (trace / pulse / bind / build) and the combat simulation.
// Pure logic: no DOM, so it runs in tests and in the browser alike.
import { BALANCE, TOTAL_WAVES, phaseRule, type EnemyType, type LaneId, type TowerType } from './balance';
import {
  LANES, LANE_IDS, NODE, FOUNDATION_IDS, branchOf, dist, nearestOnLane, pointAt, routePolyline,
  polylineLength, pointAlong, type BranchId, type Vec,
} from './map';

export type Phase = 'prep' | 'combat' | 'victory' | 'defeat';

export interface Tower {
  id: string;
  foundation: string;
  type: TowerType;
  cd: number;
  /** Prepared for the current/upcoming wave by a temporary trace. */
  traced: boolean;
  /** A pulse has been launched at this tower this wave. */
  committed: boolean;
  flash: number;
  /** Was this the royal reinforcement? */
  royal?: boolean;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  lane: LaneId;
  s: number;
  hp: number;
  maxHp: number;
  stun: number;
  hit: number;
  /** Small sideways offset so bunched enemies stay visible. */
  side: number;
  bob: number;
}

export interface Projectile {
  kind: TowerType;
  x: number; y: number;
  sx: number; sy: number;
  tx: number; ty: number;
  targetId: number | null;
  speed: number;
  damage: number;
  splash: number;
  t: number;
  dur: number;
}

export interface Hedge { towerId: string; at: Vec; angle: number; stops: { lane: LaneId; s: number }[]; t: number; dur: number }
export interface Fire { towerId: string; ranges: { lane: LaneId; s0: number; s1: number }[]; pts: Vec[]; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'bell' | 'toll' | 'splash' | 'arrive' | 'spawn' }
export interface PulseFlight { towerId: string; path: Vec[]; length: number; s: number }
export interface Warning { lane: LaneId; type: EnemyType; from: number; to: number; count: number }
export interface FadingThread { path: Vec[]; t: number; dur: number }
export interface Toast { text: string; kind: 'info' | 'good' | 'bad' | 'gold'; t: number }

export interface Spawn { type: EnemyType; lane: LaneId; at: number }

export interface GameState {
  phase: Phase;
  paused: boolean;
  speed: number;
  wave: number;
  castleHp: number;
  gold: number;
  leaves: number;
  towers: Tower[];
  /** Tower ids in the order they were traced (for undo). */
  traces: string[];
  pulsesLeft: number;
  bound: BranchId[];
  pendingGrant: boolean;
  enemies: Enemy[];
  projectiles: Projectile[];
  hedges: Hedge[];
  fires: Fire[];
  rings: Ring[];
  flights: PulseFlight[];
  spawns: Spawn[];
  warnings: Warning[];
  fading: FadingThread[];
  toasts: Toast[];
  waveTime: number;
  time: number;
  nextId: number;
  kills: number;
  leaked: number;
  leakLog: string[];
  /** Set for one preparation phase after a wave ends, so the reset is visible. */
  resetBanner: number;
}

export function newGame(): GameState {
  const s: GameState = {
    phase: 'prep', paused: false, speed: 1, wave: 1,
    castleHp: BALANCE.castleHp, gold: BALANCE.startGold, leaves: BALANCE.startLeaves,
    towers: [], traces: [], pulsesLeft: 0, bound: [], pendingGrant: false,
    enemies: [], projectiles: [], hedges: [], fires: [], rings: [], flights: [], spawns: [],
    warnings: [], fading: [], toasts: [], waveTime: 0, time: 0, nextId: 1, kills: 0, leaked: 0, leakLog: [], resetBanner: 0,
  };
  for (const t of BALANCE.startingTowers) addTower(s, t.foundation, t.type);
  return s;
}

function addTower(s: GameState, foundation: string, type: TowerType, royal = false): Tower {
  const t: Tower = { id: `t${s.nextId++}`, foundation, type, cd: 0.4, traced: false, committed: false, flash: 0, royal };
  s.towers.push(t);
  return t;
}

export function toast(s: GameState, text: string, kind: Toast['kind'] = 'info') {
  s.toasts.push({ text, kind, t: 0 });
  if (s.toasts.length > 2) s.toasts.shift();
}

// ── Derived values ──────────────────────────────────────────────────────────

export const rule = (s: GameState) => phaseRule(s.wave);
export const builtCount = (s: GameState) => s.towers.length;
export const towerAt = (s: GameState, f: string) => s.towers.find((t) => t.foundation === f);
export const towerById = (s: GameState, id: string) => s.towers.find((t) => t.id === id);
export const posOf = (t: Tower): Vec => ({ x: NODE[t.foundation].x, y: NODE[t.foundation].y });
export const emptyFoundations = (s: GameState) => FOUNDATION_IDS.filter((f) => !towerAt(s, f));

export function isBound(s: GameState, foundation: string): boolean {
  const b = branchOf(foundation);
  return !!b && s.bound.includes(b);
}

/** Base attack damage, including the bound-path bonus (never stacks). */
export function towerDamage(s: GameState, t: Tower): number {
  const base = BALANCE.towers[t.type].damage;
  return isBound(s, t.foundation) ? base * (1 + BALANCE.bindDamageBonus) : base;
}

/** pulses < traces < built towers. */
export function invariantHolds(s: GameState): boolean {
  const r = rule(s);
  return r.pulses < r.traces && r.traces < builtCount(s);
}

// ── Preparation: tracing ────────────────────────────────────────────────────

export function traceCheck(s: GameState, towerId: string | null): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: 'Threads can only be traced between waves.' };
  if (s.pendingGrant) return { ok: false, reason: 'Place the royal reinforcement first.' };
  const t = towerId ? towerById(s, towerId) : undefined;
  if (!t) return { ok: false, reason: 'No tower stands there — nothing spent.' };
  if (t.traced) return { ok: false, reason: `${BALANCE.towers[t.type].name} is already prepared — nothing spent.` };
  const r = rule(s);
  if (s.traces.length >= r.traces) return { ok: false, reason: `All ${r.traces} traces drawn. Undo one to redraw.` };
  return { ok: true, reason: '' };
}

export function traceTower(s: GameState, towerId: string): boolean {
  const c = traceCheck(s, towerId);
  if (!c.ok) { toast(s, c.reason, 'bad'); return false; }
  const t = towerById(s, towerId)!;
  t.traced = true;
  s.traces.push(t.id);
  s.resetBanner = 0;
  return true;
}

export function untraceTower(s: GameState, towerId: string): boolean {
  if (s.phase !== 'prep') return false;
  const t = towerById(s, towerId);
  if (!t || !t.traced) return false;
  t.traced = false;
  s.traces = s.traces.filter((id) => id !== towerId);
  s.fading.push({ path: routePolyline(t.foundation), t: 0, dur: 0.6 });
  return true;
}

export function undoTrace(s: GameState): boolean {
  const last = s.traces[s.traces.length - 1];
  return last ? untraceTower(s, last) : false;
}

export function clearTraces(s: GameState) {
  for (const id of [...s.traces]) untraceTower(s, id);
}

// ── Preparation: building ───────────────────────────────────────────────────

export function buildCheck(s: GameState, foundation: string, type: TowerType, free = false): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: 'Building is locked during a wave.' };
  if (!NODE[foundation]?.foundation) return { ok: false, reason: 'That is not a foundation.' };
  if (towerAt(s, foundation)) return { ok: false, reason: 'A tower already stands there.' };
  if (free) return s.pendingGrant ? { ok: true, reason: '' } : { ok: false, reason: 'No reinforcement to place.' };
  if (s.pendingGrant) return { ok: false, reason: 'Place the royal reinforcement first.' };
  const cost = BALANCE.towers[type].cost;
  if (s.gold < cost) return { ok: false, reason: `Needs ${cost} gold.` };
  return { ok: true, reason: '' };
}

export function buildTower(s: GameState, foundation: string, type: TowerType): boolean {
  const c = buildCheck(s, foundation, type);
  if (!c.ok) { toast(s, c.reason, 'bad'); return false; }
  s.gold -= BALANCE.towers[type].cost;
  addTower(s, foundation, type);
  toast(s, `${BALANCE.towers[type].name} raised at ${NODE[foundation].foundation!.name}.`, 'good');
  return true;
}

export function placeGrant(s: GameState, foundation: string, type: TowerType): boolean {
  const c = buildCheck(s, foundation, type, true);
  if (!c.ok) { toast(s, c.reason, 'bad'); return false; }
  addTower(s, foundation, type, true);
  s.pendingGrant = false;
  toast(s, `The Crown’s ${BALANCE.towers[type].name} stands at ${NODE[foundation].foundation!.name}.`, 'gold');
  return true;
}

// ── Preparation: binding ────────────────────────────────────────────────────

export function bindCheck(s: GameState, b: BranchId): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: 'Binding is locked during a wave.' };
  if (s.bound.includes(b)) return { ok: false, reason: 'That branch is already bound in gold.' };
  if (s.leaves < BALANCE.bindCost) return { ok: false, reason: `Needs ${BALANCE.bindCost} Gilded Leaves (you have ${s.leaves}).` };
  return { ok: true, reason: '' };
}

export function bindBranch(s: GameState, b: BranchId): boolean {
  const c = bindCheck(s, b);
  if (!c.ok) { toast(s, c.reason, 'bad'); return false; }
  s.leaves -= BALANCE.bindCost;
  s.bound.push(b);
  toast(s, 'A path is bound in gold leaf. Its towers strike harder for the rest of the siege.', 'gold');
  return true;
}

// ── Starting a wave ─────────────────────────────────────────────────────────

export function canStartWave(s: GameState): { ok: boolean; reason: string } {
  if (s.phase !== 'prep') return { ok: false, reason: '' };
  if (s.pendingGrant) return { ok: false, reason: 'Place the royal reinforcement.' };
  const r = rule(s);
  if (!invariantHolds(s)) return { ok: false, reason: `Needs more than ${r.traces} towers.` };
  if (s.traces.length !== r.traces) return { ok: false, reason: `Trace exactly ${r.traces} towers (${s.traces.length} of ${r.traces}).` };
  return { ok: true, reason: '' };
}

export function waveSpawns(wave: number): Spawn[] {
  const def = BALANCE.waves[wave - 1];
  const out: Spawn[] = [];
  for (const g of def.groups) for (let i = 0; i < g.count; i++) out.push({ type: g.type, lane: g.lane, at: g.start + i * g.interval });
  return out.sort((a, b) => a.at - b.at);
}

export function startWave(s: GameState): boolean {
  const c = canStartWave(s);
  if (!c.ok) { if (c.reason) toast(s, c.reason, 'bad'); return false; }
  s.phase = 'combat';
  s.pulsesLeft = rule(s).pulses;
  s.waveTime = 0;
  s.spawns = waveSpawns(s.wave);
  s.resetBanner = 0;
  s.warnings = BALANCE.waves[s.wave - 1].groups
    .filter((g) => g.type === 'wolf' || g.type === 'ram')
    .map((g) => ({ lane: g.lane, type: g.type, from: Math.max(0, g.start - BALANCE.wolfWarning), to: g.start + 1.5, count: g.count }));
  for (const t of s.towers) { t.committed = false; t.cd = 0.3; }
  return true;
}

// ── Combat: pulses ──────────────────────────────────────────────────────────

export function pulseCheck(s: GameState, towerId: string): { ok: boolean; reason: string } {
  if (s.phase !== 'combat') return { ok: false, reason: '' };
  if (s.paused) return { ok: false, reason: 'Paused.' };
  const t = towerById(s, towerId);
  if (!t) return { ok: false, reason: '' };
  if (!t.traced) return { ok: false, reason: `${BALANCE.towers[t.type].name} has no thread this wave — no pulse spent.` };
  if (t.committed) return { ok: false, reason: 'Already pulsed this wave — no pulse spent.' };
  if (s.pulsesLeft <= 0) return { ok: false, reason: 'No pulses left this wave.' };
  return { ok: true, reason: '' };
}

/** Launch a pulse. Marks the tower committed immediately so a double-click cannot spend two charges. */
export function pulseTower(s: GameState, towerId: string): boolean {
  const c = pulseCheck(s, towerId);
  if (!c.ok) { if (c.reason) toast(s, c.reason, 'bad'); return false; }
  const t = towerById(s, towerId)!;
  t.committed = true;
  s.pulsesLeft -= 1;
  const path = routePolyline(t.foundation);
  s.flights.push({ towerId, path, length: polylineLength(path), s: 0 });
  return true;
}

function applyPulse(s: GameState, t: Tower) {
  const p = posOf(t);
  const P = BALANCE.pulses;
  t.flash = 1;
  s.rings.push({ x: p.x, y: p.y, r: 40, t: 0, dur: 0.5, kind: 'arrive' });
  if (t.type === 'bramble') {
    // Nearest road point; on the shared stretch the hedge blocks both lanes.
    let best: { lane: LaneId; s: number; d: number; point: Vec } | null = null;
    for (const id of LANE_IDS) {
      const n = nearestOnLane(LANES[id], p);
      if (!best || n.d < best.d) best = { lane: id, ...n };
    }
    const lane = LANES[best!.lane];
    const stops: Hedge['stops'] = [];
    if (best!.s >= lane.junctionS) {
      const fromGate = lane.length - best!.s;
      for (const id of LANE_IDS) stops.push({ lane: id, s: LANES[id].length - fromGate });
    } else stops.push({ lane: best!.lane, s: best!.s });
    const at = pointAt(lane, best!.s);
    s.hedges.push({ towerId: t.id, at, angle: at.angle, stops, t: 0, dur: P.hedgeDuration });
  } else if (t.type === 'ember') {
    const ranges: Fire['ranges'] = [];
    const pts: Vec[] = [];
    for (const id of LANE_IDS) {
      const L = LANES[id];
      let s0 = -1;
      for (let x = 0; x <= L.length; x += 8) {
        const q = pointAt(L, x);
        const inside = dist(q, p) <= P.fireRadius;
        if (inside) {
          if (s0 < 0) s0 = x;
          // Don't draw the shared stretch twice.
          if (id === 'mill' || x < L.junctionS) pts.push(q);
        }
        if ((!inside || x + 8 > L.length) && s0 >= 0) { ranges.push({ lane: id, s0, s1: x }); s0 = -1; }
      }
    }
    s.fires.push({ towerId: t.id, ranges, pts, t: 0, dur: P.fireDuration });
  } else {
    s.rings.push({ x: p.x, y: p.y, r: P.tollRadius, t: 0, dur: 0.9, kind: 'toll' });
    for (const e of s.enemies) {
      const ep = enemyPos(e);
      if (dist(ep, p) <= P.tollRadius) {
        e.s = Math.max(0, e.s - P.tollKnockback);
        e.stun = Math.max(e.stun, P.tollStun);
        hurt(s, e, P.tollDamage, true);
      }
    }
  }
}

// ── Combat simulation ───────────────────────────────────────────────────────

export function enemyPos(e: Enemy): Vec & { angle: number } {
  const p = pointAt(LANES[e.lane], e.s);
  // Sideways offset (perpendicular to the road).
  return { x: p.x - Math.sin(p.angle) * e.side, y: p.y + Math.cos(p.angle) * e.side, angle: p.angle };
}

function hurt(s: GameState, e: Enemy, raw: number, ignoreArmour = false) {
  if (e.hp <= 0) return;
  const armour = ignoreArmour ? 0 : BALANCE.enemies[e.type].armour;
  e.hp -= Math.max(1, raw - armour);
  e.hit = 0.15;
  if (e.hp <= 0) {
    s.gold += BALANCE.enemies[e.type].bounty;
    s.kills += 1;
  }
}

function spawnEnemy(s: GameState, sp: Spawn) {
  const st = BALANCE.enemies[sp.type];
  s.enemies.push({
    id: s.nextId++, type: sp.type, lane: sp.lane, s: 0, hp: st.hp, maxHp: st.hp, stun: 0, hit: 0,
    side: (Math.random() * 2 - 1) * 7, bob: Math.random() * 6,
  });
}

function pickTarget(s: GameState, from: Vec, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestLeft = Infinity;
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.s <= 0) continue;
    if (dist(enemyPos(e), from) > range) continue;
    const left = LANES[e.lane].length - e.s;
    if (left < bestLeft) { bestLeft = left; best = e; }
  }
  return best;
}

export function step(s: GameState, dtRaw: number) {
  const dt = Math.min(dtRaw, 0.1);
  s.time += dt;
  for (const t of s.toasts) t.t += dt;
  s.toasts = s.toasts.filter((t) => t.t < 3.5);
  for (const f of s.fading) f.t += dt;
  s.fading = s.fading.filter((f) => f.t < f.dur);
  for (const r of s.rings) r.t += dt;
  s.rings = s.rings.filter((r) => r.t < r.dur);
  for (const t of s.towers) t.flash = Math.max(0, t.flash - dt * 1.5);
  if (s.phase === 'prep' && s.resetBanner > 0) s.resetBanner = Math.max(0, s.resetBanner - dt);
  if (s.phase !== 'combat') return;

  s.waveTime += dt;

  // Spawns
  while (s.spawns.length && s.spawns[0].at <= s.waveTime) spawnEnemy(s, s.spawns.shift()!);

  // Pulses travelling along their threads
  for (const f of s.flights) {
    f.s += BALANCE.pulseSpeed * dt;
    if (f.s >= f.length) {
      const t = towerById(s, f.towerId);
      if (t) applyPulse(s, t);
    }
  }
  s.flights = s.flights.filter((f) => f.s < f.length);

  // Hedges and fires
  for (const h of s.hedges) h.t += dt;
  s.hedges = s.hedges.filter((h) => h.t < h.dur);
  for (const f of s.fires) f.t += dt;
  s.fires = s.fires.filter((f) => f.t < f.dur);

  // Enemy movement
  for (const e of s.enemies) {
    e.hit = Math.max(0, e.hit - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    const st = BALANCE.enemies[e.type];
    let ns = e.s + st.speed * dt;
    for (const h of s.hedges) {
      for (const stop of h.stops) {
        if (stop.lane === e.lane && e.s <= stop.s - 2 && ns > stop.s - 10) ns = Math.min(ns, Math.max(e.s, stop.s - 10));
      }
    }
    e.s = ns;
    e.bob += dt * st.speed * 0.15;
  }

  // Burning road
  for (const f of s.fires) {
    for (const e of s.enemies) {
      if (f.ranges.some((r) => r.lane === e.lane && e.s >= r.s0 && e.s <= r.s1)) hurt(s, e, BALANCE.pulses.fireDps * dt, true);
    }
  }

  // Towers attack automatically (traced or not)
  for (const t of s.towers) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    const st = BALANCE.towers[t.type];
    const p = posOf(t);
    const target = pickTarget(s, p, st.range);
    if (!target) continue;
    t.cd = st.cooldown;
    const dmg = towerDamage(s, t);
    if (t.type === 'bell') {
      s.rings.push({ x: p.x, y: p.y, r: st.range, t: 0, dur: 0.55, kind: 'bell' });
      for (const e of s.enemies) if (e.hp > 0 && e.s > 0 && dist(enemyPos(e), p) <= st.range) hurt(s, e, dmg);
    } else {
      const ep = enemyPos(target);
      let tx = ep.x, ty = ep.y;
      const flight = dist(p, ep) / st.projectileSpeed;
      if (t.type === 'ember' && target.stun <= 0) {
        const fut = enemyPos({ ...target, s: target.s + BALANCE.enemies[target.type].speed * flight * 0.8 });
        tx = fut.x; ty = fut.y;
      }
      s.projectiles.push({
        kind: t.type, x: p.x, y: p.y - 30, sx: p.x, sy: p.y - 30, tx, ty,
        targetId: t.type === 'bramble' ? target.id : null, speed: st.projectileSpeed, damage: dmg, splash: st.splash,
        t: 0, dur: Math.max(0.12, flight),
      });
    }
  }

  // Projectiles
  for (const pr of s.projectiles) {
    pr.t += dt;
    if (pr.targetId !== null) {
      const e = s.enemies.find((x) => x.id === pr.targetId && x.hp > 0);
      if (e) { const ep = enemyPos(e); pr.tx = ep.x; pr.ty = ep.y; }
    }
    const k = Math.min(1, pr.t / pr.dur);
    pr.x = pr.sx + (pr.tx - pr.sx) * k;
    pr.y = pr.sy + (pr.ty - pr.sy) * k;
    if (k >= 1) {
      if (pr.splash > 0) {
        s.rings.push({ x: pr.tx, y: pr.ty, r: pr.splash, t: 0, dur: 0.35, kind: 'splash' });
        for (const e of s.enemies) if (e.hp > 0 && dist(enemyPos(e), { x: pr.tx, y: pr.ty }) <= pr.splash) hurt(s, e, pr.damage);
      } else {
        const e = s.enemies.find((x) => x.id === pr.targetId && x.hp > 0);
        if (e) hurt(s, e, pr.damage);
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.t < p.dur);

  // Reaching the gate
  for (const e of s.enemies) {
    if (e.hp > 0 && e.s >= LANES[e.lane].length) {
      e.hp = 0;
      s.castleHp = Math.max(0, s.castleHp - BALANCE.enemies[e.type].castleDamage);
      s.leaked += 1;
      s.leakLog.push(`${e.type}@${e.lane}`);
      s.rings.push({ x: LANES[e.lane].pts.at(-1)!.x, y: 520, r: 50, t: 0, dur: 0.5, kind: 'splash' });
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);

  if (s.castleHp <= 0) {
    s.phase = 'defeat';
    s.flights = [];
    return;
  }
  if (s.spawns.length === 0 && s.enemies.length === 0) endWave(s);
}

function endWave(s: GameState) {
  const survived = s.wave;
  const gold = BALANCE.waveClearGold(survived);
  s.gold += gold;
  s.leaves += BALANCE.leavesPerWave;
  // Every temporary trace fades, pulsed or not. Unspent pulses vanish.
  for (const t of s.towers) {
    if (t.traced) s.fading.push({ path: routePolyline(t.foundation), t: 0, dur: 1.6 });
    t.traced = false;
    t.committed = false;
  }
  s.traces = [];
  s.pulsesLeft = 0;
  s.flights = [];
  s.hedges = [];
  s.fires = [];
  s.projectiles = [];
  s.warnings = [];
  if (survived >= TOTAL_WAVES) { s.phase = 'victory'; return; }
  s.wave = survived + 1;
  s.phase = 'prep';
  s.resetBanner = 6;
  toast(s, `Wave ${survived} held! +${gold} gold, +${BALANCE.leavesPerWave} Gilded Leaf.`, 'gold');
  toast(s, 'The ink fades: every temporary thread is cleared.', 'info');
  if (s.wave === BALANCE.reinforcementWave && builtCount(s) <= BALANCE.reinforcementIfTowersAtMost) {
    s.pendingGrant = true;
  }
}

/** Pulse flight progress for rendering: point along the thread. */
export function flightPoint(f: PulseFlight): Vec { return pointAlong(f.path, f.s); }
