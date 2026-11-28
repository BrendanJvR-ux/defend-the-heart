// Simulated attackers for Attack mode: players of different skill drawing up plans within the budget and the
// per-vessel limit, playing best-of-three matches and changing their plan between attacks. Used by the attack
// balance check and the report (npx vite-node tests/balance/attackReport.ts).
import { CONFIG, LEVELS, BACTERIA, type PathogenType, type VesselId } from '../../src/config';
import { organBacteria } from '../../src/career';
import {
  ATTACK, ATTACK_TYPES, attackBudget, attackVessels, checkPlan, isBoss, pathogenCost, perVessel, planCost, room, freshMatch, matchWinner,
  recordAttack, simulateAttack, type AttackGroup, type AttackMatch,
} from '../../src/attack';
import { rng } from './population';
import { loadLevel, VESSELS, routesOf } from '../../src/level';

type Style = 'swarm' | 'bacteria' | 'mixed' | 'boss';
export interface Attacker { u: number; style: Style; spread: number; adapts: boolean }

/** An attacker from the population: skill 0 (new) to 1 (strong) and a favourite style. */
export function makeAttacker(seed: number): Attacker {
  const r = rng(seed * 7717 + 5), u = r(), styles: Style[] = ['swarm', 'bacteria', 'mixed', 'boss'];
  return { u, style: styles[Math.floor(r() * 4)], spread: 1 + Math.floor(r() * 3), adapts: r() < 0.3 + 0.6 * u };
}

/** Kinds this attacker might pick for its style; a skilled one avoids the bacteria the organ's IgG is aimed at. */
function kinds(level: number, a: Attacker, r: () => number): PathogenType[] {
  const aimed = new Set<PathogenType>(['saureus', ...organBacteria(level)]);
  const bact = BACTERIA.filter((b) => (r() < a.u ? !aimed.has(b) : true));
  const viruses: PathogenType[] = ['virus', 'jumper', 'hijacker'];
  if (a.style === 'swarm') return viruses;
  if (a.style === 'bacteria') return bact;
  return [...viruses, ...bact];
}

/** A plan: `spread` (or more, if the per-vessel limit needs it) of the organ's vessels, avoiding the ones `avoid`
 *  names first, filled with groups up to the limit until the budget runs out. */
export function makePlan(level: number, a: Attacker, seed: number, avoid: Record<VesselId, number> = {}): AttackGroup[] {
  const r = rng(seed), B = attackBudget(level), vs = attackVessels(level).map((v) => v.id);
  const order = [...vs].sort((x, y) => (avoid[x] ?? 0) - (avoid[y] ?? 0) || r() - 0.5);
  const pool = kinds(level, a, r), plan: AttackGroup[] = [];
  const left = () => B - planCost(plan);
  if (a.style === 'boss') {
    const bosses = ATTACK_TYPES.filter(isBoss).filter((t) => pathogenCost(t) <= B * 0.6);
    if (bosses.length) plan.push({ type: bosses[Math.floor(r() * bosses.length)], vessel: order[0], count: 1, delay: 4 });
  }
  let used = Math.min(vs.length, a.spread);
  for (let guard = 0; guard < 40 && plan.length < ATTACK.maxGroups; guard++) {
    const affordable = pool.filter((t) => pathogenCost(t) <= left());
    if (!affordable.length) break;
    // hijackers lead (they take the white cells), others follow
    const t = a.style === 'mixed' && plan.length === 0 ? 'hijacker' : affordable[Math.floor(r() * affordable.length)];
    let v = order.slice(0, used).find((x) => perVessel(plan, x) < ATTACK.maxPerVessel);
    if (!v) { if (used >= vs.length) break; used++; v = order[used - 1]; }
    const space = Math.floor((ATTACK.maxPerVessel - perVessel(plan, v)) / room(t));
    if (space < 1) break;
    // a virus group: a swarm-minded or skilled attacker fills the vessel's room, for the swarm boost
    const big = !CONFIG.pathogens[t].taxon && (a.style === 'swarm' || r() < a.u);
    const count = Math.max(1, Math.min(space, ATTACK.maxCount, Math.floor(left() / pathogenCost(t)), big ? 99 : 2 + Math.floor(r() * 10)));
    if (pathogenCost(t) * count > left()) break;
    plan.push({ type: t, vessel: v, count, delay: Math.min(ATTACK.maxDelay, t === 'hijacker' ? 0 : Math.round(r() * 8) * 2) });
  }
  // top up: spend what is left on viruses where there is room
  for (const v of order) {
    if (plan.length >= ATTACK.maxGroups) break;
    const n = Math.min(Math.floor((ATTACK.maxPerVessel - perVessel(plan, v)) / room('virus')), ATTACK.maxCount, Math.floor(left() / pathogenCost('virus')));
    if (n > 0 && a.u > 0.3) plan.push({ type: 'virus', vessel: v, count: n, delay: 6 });
  }
  // timing: a skilled attacker sends each vessel's leaders to arrive at once (the defender dilates one at a time);
  // the others send groups whenever
  if (r() < a.u) {
    loadLevel(level);
    const travel = (g: AttackGroup) => VESSELS[routesOf(g.vessel)[0]].length / CONFIG.pathogens[g.type].speed;
    const T = Math.max(...plan.map(travel));
    for (const g of plan) if (g.type !== 'hijacker') g.delay = Math.max(0, Math.min(ATTACK.maxDelay, Math.round(T - travel(g))));
  }
  return checkPlan(level, plan).ok ? plan : plan.slice(0, 1);
}

export interface MatchRecord { level: number; seed: number; u: number; style: Style; results: ('won' | 'held')[]; winner: 'attacker' | 'defender' }

/** A best-of-three match: after each attack an attacker who adapts moves its weight away from where the defender has
 *  learnt to look; one who doesn't redraws its plan the same way. */
export function playMatch(level: number, seed: number): MatchRecord {
  const a = makeAttacker(seed), m: AttackMatch = freshMatch(level);
  for (let k = 0; k < ATTACK.rounds && !matchWinner(m); k++) {
    const plan = makePlan(level, a, seed * 101 + k * 17, a.adapts ? m.seen : {});
    const r = simulateAttack(level, plan, m)!;
    recordAttack(m, plan, r.outcome === 'won' ? 'won' : 'held');
  }
  return { level, seed, u: a.u, style: a.style, results: m.results, winner: matchWinner(m)! };
}

export function attackSummary(rs: MatchRecord[]) {
  const pct = (a: MatchRecord[], f: (x: MatchRecord) => boolean) => (a.length ? a.filter(f).length / a.length : NaN);
  const won = (x: MatchRecord) => x.winner === 'attacker';
  const attacks = rs.flatMap((x) => x.results);
  return {
    matches: rs.length, match: pct(rs, won), attack: attacks.filter((x) => x === 'won').length / attacks.length,
    weak: pct(rs.filter((x) => x.u < 1 / 3), won), mid: pct(rs.filter((x) => x.u >= 1 / 3 && x.u < 2 / 3), won), strong: pct(rs.filter((x) => x.u >= 2 / 3), won),
    styles: Object.fromEntries((['swarm', 'bacteria', 'mixed', 'boss'] as Style[]).map((st) => [st, pct(rs.filter((x) => x.style === st), won)])),
    organs: LEVELS.map((L, i) => ({ id: L.id, match: pct(rs.filter((x) => x.level === i), won), n: rs.filter((x) => x.level === i).length })),
    rounds: pct(rs, (x) => x.results.length === 3),
  };
}
void CONFIG;
if (process.env.ATTACK_SET) Object.assign(ATTACK, JSON.parse(process.env.ATTACK_SET));
if (process.env.ATTACK_TOUGH) ATTACK.toughness = Number(process.env.ATTACK_TOUGH);
if (process.env.ATTACK_SCALE) Object.assign(ATTACK.scale, JSON.parse(process.env.ATTACK_SCALE));
