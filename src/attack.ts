// Attack mode: the player is the infection. Within a budget they choose which pathogens to send, up which vessels,
// how many and when; the organ is defended by the scripted defender (it builds lymph nodes without seeing the attack,
// then dilates and pulses as the wave comes). The attack wins if the organ's health reaches 0. Pure logic, no DOM.
// Nothing here reads or writes the career or its saves.
import { CONFIG, LEVELS, BACTERIA, type PathogenType, type VesselId } from './config';
import { NO_PERKS, organBacteria, type Perks } from './career';
import { routesOf } from './level';
import { newGame, startWave, step, buyNo, type Spawn, type State } from './sim';
import { blindBuild, sensibleDilate, pulseAtCluster } from './defender';

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
  /** The budget: this much per point of the organ's health and per point of its defender's starting energy. */
  budget: { perHp: 8, perEnergy: 0.5 },
};

/** What the attacker may send: the bacteria, the small viruses, and the bosses (one at most). */
export const ATTACK_TYPES: PathogenType[] = [
  ...BACTERIA, 'virus', 'jumper', 'hijacker',
  ...(Object.keys(CONFIG.pathogens) as PathogenType[]).filter((t) => CONFIG.pathogens[t].boss),
];
export const isBoss = (t: PathogenType) => !!CONFIG.pathogens[t].boss;

/** A pathogen's price, from its stats: its health (a boss sends a share of its full health, as in a boss wave),
 *  weighted by its speed, plus the harm it does on arrival, plus its tricks (infecting cells, jumping, lodging);
 *  a boss's traits make it half as dear again. */
export function pathogenCost(t: PathogenType): number {
  const st = CONFIG.pathogens[t], share = st.boss ? CONFIG.bossEveryVessel.hpShare : 1;
  let c = ((st.hp * share) / 10) * (0.5 + st.speed / 60) + st.heartDamage * share * 1.5;
  if (st.infects) c += 3;
  if (st.jumps) c += 1;
  if (st.lodges) c += 2 * st.lodges.perWave;
  if (st.boss) c *= 1.5;
  return Math.max(1, Math.round(c));
}

/** The attack budget for an organ: more for an organ with more health and a stronger defence (its starting energy). */
export const attackBudget = (level: number) => {
  const L = LEVELS[level];
  return Math.round((L.hp * ATTACK.budget.perHp + L.startEnergy * ATTACK.budget.perEnergy) / 5) * 5;
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
  if (plan.filter((g) => isBoss(g.type)).length > A.maxBosses) return no(`At most ${A.maxBosses} boss in an attack.`);
  if (cost > budget) return no(`Over budget: ${cost} of ${budget}.`);
  return { ok: true, reason: '', cost, budget };
}

/** The plan as the wave's spawns (the organ's map must be loaded: a forked vessel sends them up its first branch). */
export function attackSpawns(plan: AttackGroup[]): Spawn[] {
  const out: Spawn[] = [];
  for (const g of plan) {
    const gap = CONFIG.pathogens[g.type].taxon ? ATTACK.spacing.bacterium : ATTACK.spacing.virus;
    for (let i = 0; i < g.count; i++) out.push({ type: g.type, vessel: routesOf(g.vessel)[0], at: g.delay + i * gap });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The defender's upgrades: IgG targets for S. aureus and for the bacteria this organ usually meets, nothing else. */
export const defenderPerks = (level: number): Perks => ({ ...NO_PERKS, targets: [...new Set(['saureus' as const, ...organBacteria(level)])] });

/** Set up an attack: the organ, its defender's build (made without seeing the plan, all its energy spent), and the
 *  wave started with the plan. Returns null if the plan is not allowed. */
export function launchAttack(level: number, plan: AttackGroup[]): State | null {
  if (!checkPlan(level, plan).ok) return null;
  const s = newGame(level, defenderPerks(level));
  defenderBuild(s);
  s.plan = attackSpawns(plan);
  startWave(s);
  return s;
}

/** The defender spends its energy on lymph nodes, round after round, until nothing more can be placed. */
export function defenderBuild(s: State) {
  for (let i = 0; i < 20; i++) { const before = s.energy; blindBuild(s); if (s.energy === before) break; }
}

const defenderPulse = pulseAtCluster(3);
/** The defender's moves during the wave: dilate where the danger is, pulse at a boss or a tough one near the organ,
 *  buy NO with its energy when it runs low. */
export function defenderTick(s: State) {
  if (s.phase !== 'combat') return;
  if (s.no < 25) buyNo(s);
  sensibleDilate(s);
  defenderPulse(s);
}

/** Where an attack stands: still going, the organ fell (the attacker wins), or the organ held. */
export function attackOutcome(s: State): 'running' | 'won' | 'held' {
  if (s.phase === 'defeat') return 'won';
  if (s.phase === 'prep' || s.phase === 'victory') return 'held';
  return 'running';
}

/** Play an attack through to its end (for tests and balance checks). */
export function simulateAttack(level: number, plan: AttackGroup[]) {
  const s = launchAttack(level, plan);
  if (!s) return null;
  let n = 0;
  while (attackOutcome(s) === 'running' && n++ < 30 * 600) { defenderTick(s); step(s, 1 / 30); }
  return { outcome: attackOutcome(s), hp: s.heartHp, maxHp: LEVELS[level].hp, s };
}
