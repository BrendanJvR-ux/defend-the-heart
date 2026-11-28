// Attack mode: the player is the infection. Within a budget they choose which pathogens to send, up which vessels,
// how many and when; the organ is defended by the scripted defender (it builds lymph nodes without seeing the attack,
// then dilates and pulses as the wave comes). The attack wins if the organ's health reaches 0. Pure logic, no DOM.
// Nothing here reads or writes the career or its saves.
import { CONFIG, LEVELS, BACTERIA, type BacteriumType, type PathogenType, type VesselId } from './config';
import { NO_PERKS, organBacteria, type Perks } from './career';
import { routesOf, entryOf, VESSEL_IDS, VESSELS } from './level';
import { newGame, startWave, step, buyNo, toggleRoute, pulseTargets, firePulse, type Spawn, type State } from './sim';
import { blindBuild, buildOn, guardsOn, danger } from './defender';

export interface AttackGroup {
  type: PathogenType;
  /** The vessel it comes up (as it enters the map). */
  vessel: VesselId;
  count: number;
  /** Seconds after the wave starts that the first one enters. */
  delay: number;
}

export const ATTACK = {
  maxGroups: 8,
  maxCount: 20,
  maxDelay: 40,
  /** Seconds between pathogens of one group: fast viruses close together, bacteria further apart. */
  spacing: { virus: 0.7, bacterium: 1.3 },
  /** Bosses: at most this many in one attack (each group of one). */
  maxBosses: 1,
  /** At most this many pathogens up any one vessel in an attack (a boss counts as one; a small virus, frail and quick,
   *  as half). */
  maxPerVessel: 12,
  /** Health is priced a little more than in proportion (a tough pathogen outlasts several hits): (health / 10) to this power. */
  toughness: 1.25,
  /** A boss's traits make it dearer than its stats alone, by this factor. */
  bossPremium: 1,
  /** Each organ's budget, scaled to give an attack an even chance against it (tuned on simulated matches). */
  scale: { heart: 1.07, lungs: 0.73, liver: 0.82, kidney: 1.21, spleen: 0.7, marrow: 0.89, stomach: 0.98, lymphnode: 0.8, skin: 0.83, eye: 0.76 } as Record<string, number>,
  /** The budget: this much per point of the organ's health and per point of its defender's starting energy. */
  budget: { perHp: 8, perEnergy: 0.5 },
  /** A match is the best of three attacks on one organ. */
  rounds: 3,
  /** How strongly the defender reinforces the vessels earlier attacks came up: a vessel that took all of them gets
   *  its nodes counted at 1 / (1 + learn × the number of vessels), so far more of them. */
  learn: 0.5,
  /** The defender learns kinds too: after an attack it aims IgG at the bacteria it has met (most of the budget first),
   *  up to this many kinds besides its organ's own. */
  learnKinds: 2,
  /** A big group of viruses is a swarm: from `from` in a group, each one more adds speed and a share of every hit it
   *  shrugs off, up to the caps. */
  swarm: { from: 8, speedPer: 0.02, speedMax: 0.15, guardPer: 0.02, guardMax: 0.2 },
  /** The defender is slow to change its mind: it switches the vessel it is dilating only once another has been in
   *  more danger for this many seconds (opening the first is immediate). */
  switchDelay: 3,
  /** The defender holds its pulse for a boss until the boss is this share of the way in (anything else: past 85%
   *  with 40+ health left, as in the campaign's scripted player). */
  bossPulseAt: 0.7,
  /** A boss sent in an attack comes alone (not one up every vessel), so it does this times a boss-wave share's harm
   *  when it arrives (1 / 0.55: the boss's full harm). */
  bossHarm: 1 / CONFIG.bossEveryVessel.hpShare,
};

/** What the attacker may send: the bacteria, the small viruses, and the bosses (one at most). */
export const ATTACK_TYPES: PathogenType[] = [
  ...BACTERIA, 'virus', 'jumper', 'hijacker',
  ...(Object.keys(CONFIG.pathogens) as PathogenType[]).filter((t) => CONFIG.pathogens[t].boss),
];
export const isBoss = (t: PathogenType) => !!CONFIG.pathogens[t].boss;

/** A pathogen's price, from its stats: its health (a boss sends a share of its full health, as in a boss wave),
 *  (a little more than in proportion) weighted by its speed, plus the harm it does on arrival, plus its tricks (infecting cells, jumping, lodging);
 *  a boss's traits make it dearer by `ATTACK.bossPremium`. */
export function pathogenCost(t: PathogenType): number {
  const st = CONFIG.pathogens[t], share = st.boss ? CONFIG.bossEveryVessel.hpShare : 1;
  let c = ((st.hp * share) / 10) ** ATTACK.toughness * (0.5 + st.speed / 60) + st.heartDamage * share * (st.boss ? ATTACK.bossHarm : 1) * 1.5;
  if (st.infects) c += 3;
  if (st.jumps) c += 1;
  if (st.lodges) c += 2 * st.lodges.perWave;
  if (st.boss) c *= ATTACK.bossPremium;
  return Math.max(1, Math.round(c));
}

/** The attack budget for an organ: more for an organ with more health and a stronger defence (its starting energy). */
export const attackBudget = (level: number) => {
  const L = LEVELS[level];
  return Math.round(((L.hp * ATTACK.budget.perHp + L.startEnergy * ATTACK.budget.perEnergy) * (ATTACK.scale[L.id] ?? 1)) / 5) * 5;
};

export const groupCost = (g: AttackGroup) => pathogenCost(g.type) * g.count;
export const planCost = (plan: AttackGroup[]) => plan.reduce((a, g) => a + groupCost(g), 0);
/** The vessels pathogens can come up on this organ (as they enter the map). */
export const attackVessels = (level: number) => LEVELS[level].map.vessels.map((v) => ({ id: v.id, name: v.name }));

/** Is this plan allowed? Every group a known type up one of the organ's vessels, sensible numbers, one boss at most,
 *  and the whole of it within the budget. */
export function checkPlan(level: number, plan: AttackGroup[]): { ok: boolean; reason: string; cost: number; budget: number } {
  const budget = attackBudget(level), cost = planCost(plan), A = ATTACK;
  const no = (reason: string) => ({ ok: false, reason, cost, budget });
  if (!LEVELS[level]) return no('Choose an organ.');
  if (!plan.length) return no('Add a group of pathogens to send.');
  if (plan.length > A.maxGroups) return no(`At most ${A.maxGroups} groups.`);
  const vessels = attackVessels(level).map((v) => v.id);
  for (const g of plan) {
    if (!ATTACK_TYPES.includes(g.type)) return no('That pathogen cannot be sent.');
    if (!vessels.includes(g.vessel)) return no('Choose one of this organ\'s vessels.');
    if (!Number.isInteger(g.count) || g.count < 1) return no('Every group needs at least one pathogen.');
    if (g.count > (isBoss(g.type) ? 1 : A.maxCount)) return no(isBoss(g.type) ? 'A boss comes alone.' : `At most ${A.maxCount} in a group.`);
    if (!(g.delay >= 0 && g.delay <= A.maxDelay)) return no(`Send delays run from 0 to ${A.maxDelay} s.`);
  }
  for (const v of vessels) {
    const n = perVessel(plan, v);
    if (n > A.maxPerVessel) return no(`At most ${A.maxPerVessel} pathogens up one vessel (a virus counts as half): the ${attackVessels(level).find((x) => x.id === v)!.name.toLowerCase()} has ${n}.`);
  }
  if (plan.filter((g) => isBoss(g.type)).length > A.maxBosses) return no(`At most ${A.maxBosses} boss in an attack.`);
  if (cost > budget) return no(`Over budget: ${cost} of ${budget}.`);
  return { ok: true, reason: '', cost, budget };
}

/** The plan as the wave's spawns (the organ's map must be loaded: a forked vessel sends them up its first branch). */
/** A group's swarm boost (null below the swarm size, or for anything but the small viruses). */
export function swarmOf(g: AttackGroup): { speed: number; guard: number } | null {
  const S = ATTACK.swarm, k = g.count - S.from + 1;
  if (CONFIG.pathogens[g.type].taxon || isBoss(g.type) || k <= 0) return null;
  return { speed: 1 + Math.min(S.speedMax, S.speedPer * k), guard: Math.min(S.guardMax, S.guardPer * k) };
}

export function attackSpawns(plan: AttackGroup[]): Spawn[] {
  const out: Spawn[] = [];
  for (const g of plan) {
    const gap = CONFIG.pathogens[g.type].taxon ? ATTACK.spacing.bacterium : ATTACK.spacing.virus, swarm = swarmOf(g);
    for (let i = 0; i < g.count; i++) out.push({ type: g.type, vessel: routesOf(g.vessel)[0], at: g.delay + i * gap, ...(swarm ? { swarm } : {}), ...(isBoss(g.type) ? { harm: ATTACK.bossHarm } : {}) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The bacteria the defender has learnt to aim at, most of the budget first, beyond its organ's own. */
export function learntKinds(level: number, kinds: Partial<Record<PathogenType, number>> = {}): BacteriumType[] {
  const own = new Set<PathogenType>(['saureus', ...organBacteria(level)]);
  return (Object.entries(kinds) as [PathogenType, number][]).filter(([t]) => (BACTERIA as PathogenType[]).includes(t) && !own.has(t))
    .sort((a, b) => b[1] - a[1]).slice(0, ATTACK.learnKinds).map(([t]) => t as BacteriumType);
}
/** The defender's upgrades: IgG targets for S. aureus, for the bacteria this organ usually meets, and (in a match) for
 *  the ones it has learnt; nothing else. */
export const defenderPerks = (level: number, kinds: Partial<Record<PathogenType, number>> = {}): Perks =>
  ({ ...NO_PERKS, targets: [...new Set(['saureus' as const, ...organBacteria(level), ...learntKinds(level, kinds)])] });

/** How much of a vessel's room a pathogen takes: a small virus half, anything else one. */
export const room = (t: PathogenType) => (CONFIG.pathogens[t].taxon || isBoss(t) ? 1 : 0.5);
/** How much of a vessel's room a plan uses (towards `ATTACK.maxPerVessel`). */
export const perVessel = (plan: AttackGroup[], v: VesselId) => plan.filter((g) => g.vessel === v).reduce((a, g) => a + g.count * room(g.type), 0);

/** A match: the best of three attacks on one organ. `seen` is what the defender has learnt: for each vessel, how much
 *  of the earlier attacks' budget came up it. */
export interface Learnt { seen: Record<VesselId, number>; kinds?: Partial<Record<PathogenType, number>> }
export interface AttackMatch extends Learnt { level: number; results: ('won' | 'held')[]; kinds: Partial<Record<PathogenType, number>> }
export const freshMatch = (level: number): AttackMatch => ({ level, results: [], seen: {}, kinds: {} });
export const matchScore = (m: AttackMatch) => ({ attacker: m.results.filter((r) => r === 'won').length, defender: m.results.filter((r) => r === 'held').length });
/** Who has taken the match (two of three), or null while it is still open. */
export function matchWinner(m: AttackMatch): 'attacker' | 'defender' | null {
  const { attacker, defender } = matchScore(m), need = Math.floor(ATTACK.rounds / 2) + 1;
  return attacker >= need ? 'attacker' : defender >= need ? 'defender' : null;
}
/** The number of the next attack in the match (1 to 3). */
export const matchRound = (m: AttackMatch) => m.results.length + 1;
/** Record a finished attack: its result, and what the defender learns from it (where its budget came). */
export function recordAttack(m: AttackMatch, plan: AttackGroup[], outcome: 'won' | 'held') {
  if (matchWinner(m)) return;
  m.results.push(outcome);
  for (const g of plan) { m.seen[g.vessel] = (m.seen[g.vessel] ?? 0) + groupCost(g); m.kinds[g.type] = (m.kinds[g.type] ?? 0) + groupCost(g); }
}
/** The defender's weight for a route, from what it has seen: 1 everywhere before the first attack. */
export function learntWeight(level: number, seen: Record<VesselId, number>) {
  const total = Object.values(seen).reduce((a, x) => a + x, 0), n = LEVELS[level].map.vessels.length;
  return (r: VesselId) => (total ? 1 + ATTACK.learn * n * ((seen[entryOf(r)] ?? 0) / total) : 1);
}

/** Set up an attack: the organ, its defender's build (made without seeing the plan, all its energy spent; in a match,
 *  heavier on the vessels earlier attacks came up), and the wave started with the plan. Null if the plan is not allowed. */
export function launchAttack(level: number, plan: AttackGroup[], learnt: Learnt = { seen: {} }): State | null {
  if (!checkPlan(level, plan).ok) return null;
  const s = newGame(level, defenderPerks(level, learnt.kinds));
  defenderBuild(s, learnt.seen, learntKinds(level, learnt.kinds));
  s.plan = attackSpawns(plan);
  startWave(s);
  return s;
}

/** The defender spends its energy on lymph nodes, round after round, until nothing more can be placed. */
export function defenderBuild(s: State, seen: Record<VesselId, number> = {}, learnt: BacteriumType[] = []) {
  // IgG for the kinds it has learnt first, then its organ's own
  const bugs = [...learnt, ...organBacteria(s.level)];
  if (!Object.keys(seen).length) { for (let i = 0; i < 20; i++) { const before = s.energy; blindBuild(s); if (s.energy === before) break; } return; }
  // having seen earlier attacks: one node at a time, on the route with the fewest nodes for its weight
  const w = learntWeight(s.level, seen), full = new Set<VesselId>();
  for (let i = 0; i < 200 && full.size < VESSEL_IDS.length; i++) {
    const v = VESSEL_IDS.filter((r) => !full.has(r)).sort((a, b) => guardsOn(s, a) / w(a) - guardsOn(s, b) / w(b))[0];
    if (!buildOn(s, v, bugs)) full.add(v);
  }
}

/** The defender's pulse: at a boss once it is `ATTACK.bossPulseAt` of the way in, or at a tough one (40+ health left)
 *  about to arrive. */
function defenderPulse(s: State) {
  if (s.pulsesLeft <= 0) return;
  const near = (p: { s: number; vessel: VesselId }, at: number) => p.s > at * VESSELS[p.vessel].length;
  if (pulseTargets(s).some((p) => (isBoss(p.type) ? near(p, ATTACK.bossPulseAt) : p.hp >= 40 && near(p, 0.85)))) firePulse(s);
}
/** The defender's dilation, as `sensibleDilate` but slow to change its mind: it keeps one vessel open at a time, opens
 *  the first at once, and switches only once another has been in clearly more danger for `ATTACK.switchDelay` s. */
const waiting = new WeakMap<State, { v: VesselId; since: number }>();
function slowDilate(s: State) {
  const N = CONFIG.no, best = [...VESSEL_IDS].sort((a, b) => danger(s, b) - danger(s, a))[0], cur = s.open[0];
  const spare = s.no >= N.openCost + 2 * N.drainPerSec;
  if (danger(s, best) === 0) { if (cur) toggleRoute(s, cur); waiting.delete(s); return; }
  if (!cur) { if (spare) toggleRoute(s, best); waiting.delete(s); return; }
  if (best === cur || danger(s, best) <= 2 * danger(s, cur)) { waiting.delete(s); return; }
  const w = waiting.get(s);
  if (!w || w.v !== best) { waiting.set(s, { v: best, since: s.waveTime }); return; }
  if (s.waveTime - w.since >= ATTACK.switchDelay && spare) { toggleRoute(s, cur); toggleRoute(s, best); waiting.delete(s); }
}
/** The defender's moves during the wave: dilate where the danger is (slow to switch), pulse at a boss or a tough one
 *  near the organ, buy NO with its energy when it runs low. */
export function defenderTick(s: State) {
  if (s.phase !== 'combat') return;
  if (s.no < 25) buyNo(s);
  slowDilate(s);
  defenderPulse(s);
}

/** Where an attack stands: still going, the organ fell (the attacker wins), or the organ held. */
export function attackOutcome(s: State): 'running' | 'won' | 'held' {
  if (s.phase === 'defeat') return 'won';
  if (s.phase === 'prep' || s.phase === 'victory') return 'held';
  return 'running';
}

/** Play an attack through to its end (for tests and balance checks). */
export function simulateAttack(level: number, plan: AttackGroup[], learnt: Learnt = { seen: {} }) {
  const s = launchAttack(level, plan, learnt);
  if (!s) return null;
  let n = 0;
  while (attackOutcome(s) === 'running' && n++ < 30 * 600) { defenderTick(s); step(s, 1 / 30); }
  return { outcome: attackOutcome(s), hp: s.heartHp, maxHp: LEVELS[level].hp, s };
}
