// Defend the Heart: state, rules and simulation. Pure logic, no DOM, so it runs in tests too.
import { CONFIG, TOTAL_WAVES, type PathogenType, type VesselId } from './config';
import { VESSELS, VESSEL_IDS, NODES, HEART, pointAt, dist, type Vec } from './level';

export type Phase = 'prep' | 'combat' | 'recall' | 'victory' | 'defeat';

export interface Pathogen { id: number; type: PathogenType; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; wob: number }
export interface WhiteCell { id: number; vessel: VesselId; s: number; hp: number; maxHp: number; hit: number; side: number; targetId: number | null; home: boolean }
export interface Shot { vessel: VesselId; x: number; y: number; sx: number; sy: number; targetId: number; t: number; dur: number }
export interface Ring { x: number; y: number; r: number; t: number; dur: number; kind: 'pulse' | 'pop' | 'cellDown' | 'heart' }
export interface Floater { x: number; y: number; text: string; t: number; color: string }
export interface Spawn { type: PathogenType; vessel: VesselId; at: number }

export interface State {
  phase: Phase;
  paused: boolean;
  speed: number;
  wave: number;
  heartHp: number;
  /** The one vessel chosen for this wave (null until chosen). */
  dilated: VesselId | null;
  /** Visual and gameplay dilation of each vessel, 0 = resting, 1 = fully dilated. */
  width: Record<VesselId, number>;
  pathogens: Pathogen[];
  cells: WhiteCell[];
  shots: Shot[];
  rings: Ring[];
  floaters: Floater[];
  spawns: Spawn[];
  nodeCd: Record<VesselId, number>;
  pulsesLeft: number;
  waveTime: number;
  time: number;
  heartKick: number;
  nextId: number;
  leaked: number;
  killed: number;
  recallTime: number;
  /** Total pathogens hit by the last pulse (for feedback and tests). */
  lastPulseHits: number;
  message: string;
}

export function newGame(): State {
  return {
    phase: 'prep', paused: false, speed: 1, wave: 1, heartHp: CONFIG.heartHp, dilated: null,
    width: { left: 0, right: 0 }, pathogens: [], cells: [], shots: [], rings: [], floaters: [], spawns: [],
    nodeCd: { left: 0, right: 0 }, pulsesLeft: 0, waveTime: 0, time: 0, heartKick: 0, nextId: 1,
    leaked: 0, killed: 0, recallTime: 0, lastPulseHits: 0, message: '',
  };
}

export const wave = (s: State) => CONFIG.waves[s.wave - 1];
export const aliveCells = (s: State) => s.cells.filter((c) => c.hp > 0);

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

/** Choose the one vessel to dilate. Selecting the other vessel replaces the choice. Locked during combat. */
export function selectVessel(s: State, v: VesselId): boolean {
  if (s.phase !== 'prep') return false;
  s.dilated = v;
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
  s.nodeCd = { left: 0.3, right: 0.3 };
  const L = VESSELS[v].length;
  s.cells = [];
  for (let i = 0; i < CONFIG.whiteCell.startingCount; i++) {
    s.cells.push({ id: s.nextId++, vessel: v, s: L - 8 - i * 30, hp: CONFIG.whiteCell.hp, maxHp: CONFIG.whiteCell.hp, hit: 0, side: (i % 2 ? 1 : -1) * 11, targetId: null, home: false });
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

function hurt(s: State, p: Pathogen, dmg: number) {
  if (p.hp <= 0) return;
  p.hp -= dmg; p.hit = 0.15;
  if (p.hp <= 0) { s.killed++; const q = pathogenPos(p); s.rings.push({ x: q.x, y: q.y, r: 18, t: 0, dur: 0.35, kind: 'pop' }); }
}

function spawn(s: State, sp: Spawn) {
  const st = CONFIG.pathogens[sp.type];
  s.pathogens.push({ id: s.nextId++, type: sp.type, vessel: sp.vessel, s: 0, hp: st.hp, maxHp: st.hp, hit: 0, side: (Math.random() * 2 - 1) * 7, wob: Math.random() * 6 });
}

function easeWidths(s: State, dt: number) {
  for (const v of VESSEL_IDS) {
    // The chosen vessel stays open through the wave and until the cells are home.
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
  s.heartKick = Math.max(0, s.heartKick - dt * 2.5);
  easeWidths(s, dt);
  if (s.phase === 'recall') { recall(s, dt); return; }
  if (s.phase !== 'combat') return;

  s.waveTime += dt;
  while (s.spawns.length && s.spawns[0].at <= s.waveTime) spawn(s, s.spawns.shift()!);

  // Pathogens drift with the blood towards the heart.
  for (const p of s.pathogens) {
    p.hit = Math.max(0, p.hit - dt);
    p.wob += dt * 4;
    p.s += CONFIG.pathogens[p.type].speed * dt;
  }

  // Lymph nodes: fire at the most advanced pathogen on their own vessel within reach.
  for (const v of VESSEL_IDS) {
    s.nodeCd[v] -= dt;
    if (s.nodeCd[v] > 0) continue;
    const node = NODES[v];
    let best: Pathogen | null = null;
    for (const p of s.pathogens) if (p.hp > 0 && p.vessel === v && p.s > 0 && dist(pathogenPos(p), node) <= CONFIG.lymphNode.range && (!best || p.s > best.s)) best = p;
    if (!best) continue;
    s.nodeCd[v] = CONFIG.lymphNode.cooldown;
    const tp = pathogenPos(best);
    s.shots.push({ vessel: v, x: node.x, y: node.y, sx: node.x, sy: node.y, targetId: best.id, t: 0, dur: Math.max(0.08, dist(node, tp) / CONFIG.lymphNode.shotSpeed) });
  }
  for (const sh of s.shots) {
    sh.t += dt;
    const p = s.pathogens.find((x) => x.id === sh.targetId && x.hp > 0);
    const k = Math.min(1, sh.t / sh.dur);
    if (p) { const q = pathogenPos(p); sh.x = sh.sx + (q.x - sh.sx) * k; sh.y = sh.sy + (q.y - sh.sy) * k; }
    if (k >= 1 && p) hurt(s, p, CONFIG.lymphNode.damage);
  }
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);

  // White cells: only ever on their own (dilated) vessel; they move against the flow to meet pathogens.
  const WC = CONFIG.whiteCell;
  for (const c of aliveCells(s)) {
    c.hit = Math.max(0, c.hit - dt);
    const L = VESSELS[c.vessel].length;
    const mine = s.pathogens.filter((p) => p.hp > 0 && p.vessel === c.vessel && p.s > 0);
    // the most advanced pathogen on this vessel is the greatest threat to the heart
    const target = mine.reduce<Pathogen | null>((b, p) => (!b || p.s > b.s ? p : b), null);
    c.targetId = target?.id ?? null;
    const rank = aliveCells(s).indexOf(c);
    let goal = (target ? target.s : L * WC.guardAt) + rank * 22;
    goal = Math.max(L * WC.minReach, Math.min(L - 4, goal));
    const gap = goal - c.s;
    if (!target || Math.abs(gap) > WC.attackRange * 0.8) c.s += Math.sign(gap) * Math.min(Math.abs(gap), WC.speed * dt);
    // contact attack on whatever pathogen of this vessel is within reach
    const near = mine.filter((p) => Math.abs(p.s - c.s) <= WC.attackRange);
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
      s.rings.push({ x: HEART.x, y: HEART.y, r: 120, t: 0, dur: 0.6, kind: 'heart' });
      s.floaters.push({ x: HEART.x, y: HEART.y - 120, text: `−${dmg} heart health`, t: 0, color: '#c8202a' });
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

/** End of wave: surviving white cells return along their vessel to the heart; then the vessel contracts. */
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
    s.wave += 1;
    s.phase = 'prep';
    s.message = 'The vessel has contracted. Choose again for the next wave.';
  }
}

/** Approximate timing word for the wave preview. */
export function whenLabel(start: number): string { return start < 4 ? 'at once' : start < 12 ? 'soon' : start < 20 ? 'later' : 'late'; }

export { HEART };
