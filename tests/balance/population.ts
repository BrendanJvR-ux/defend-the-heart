// The balance lab: a population of simulated players of different skill, each playing a whole career the way people
// do — organs in order, upgrades between them, retries after a loss, and replays of an earlier organ for gold when
// stuck. Used by the lab tests in this folder (run with BALANCE_LAB=1); not part of the normal test run.
import { CONFIG, LEVELS, type BacteriumType, type NodeType, type VesselId } from '../../src/config';
import * as M from '../../src/level';
import {
  type State, newGame, startWave, step, placeNode, nodeAt, toggleRoute, dilateCheck, covers, hasTarget, aimedAt, firePulse, pulseTargets, abxAvailable, abxCheck,
  deployAntibiotic, buyCell, buyCellCheck, outCells,
} from '../../src/sim';
import { freshCareer, perksOf, buy, onOrganEnd, organBacteria, type UpgradeId, type Career } from '../../src/career';
import { guarding, organSpecies } from '../players';

/** How a simulated player plays. `u` is its skill, 0 (new) to 1 (strong); the rest follow from it, with some noise. */
export interface Skill {
  u: number;
  /** Share of its energy it spends building in a build phase (the rest it keeps, often without meaning to). */
  budget: number;
  /** Chance a node it means to aim (IgG) or slow with (IgA) ends up a plain IgM instead. */
  slips: number;
  /** How far in (share of the vessel) the leading pathogen must be before it opens that vessel. */
  watch: number;
  /** Seconds between its decisions during a wave (slower players react late). */
  react: number;
  /** Uses the pulse (on bosses and tough pathogens about to arrive). */
  pulses: boolean;
  /** Uses the newer tools: an extra white cell when its cells are few, the antibiotic on a crowded bacterial vessel. */
  extras: boolean;
}

/** A small seeded random source, so every simulated career can be played again exactly. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A player from the population: skill spread evenly from new to strong, with noise in each trait. */
export function makeSkill(seed: number): Skill {
  const r = rng(seed * 9973 + 17), u = r();
  const jitter = (x: number, k: number) => Math.min(1, Math.max(0, x + (r() - 0.5) * k));
  return {
    u,
    budget: jitter(0.72 + 0.28 * u, 0.1),
    slips: jitter(0.35 * (1 - u), 0.1),
    watch: jitter(0.82 - 0.25 * u, 0.08),
    react: 0.25 + 1.4 * (1 - u) * (0.7 + 0.6 * r()),
    pulses: r() < 0.35 + 0.6 * u,
    extras: r() < 0.15 + 0.7 * u,
  };
}

/** Building between waves: the least defended vessels first, two rounds, IgG aimed at the organ's bacteria where it can
 *  (an IgA every third node), with slips; within its budget. */
function build(s: State, k: Skill, r: () => number) {
  const kept = Math.round(s.energy * (1 - k.budget));
  s.energy -= kept;
  const guards = (v: VesselId) => s.nodes.filter((x) => guarding(v).some((g) => g.id === x.site)).length;
  const bugs = organBacteria(s.level);
  for (let round = 0; round < 2; round++) {
    let placed = false;
    for (const v of [...M.VESSEL_IDS].sort((a, b) => guards(a) - guards(b))) {
      const site = guarding(v).filter((x) => !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
      if (!site) continue;
      const aims = bugs.filter((b) => hasTarget(s, b) && aimedAt(s, b) < CONFIG.iggPerTarget);
      let want: NodeType = guards(v) % 3 === 2 ? 'iga' : aims.length ? 'igg' : 'igm';
      if (want !== 'igm' && r() < k.slips) want = 'igm';
      if (placeNode(s, site.id, want, want === 'igg' ? [aims[0] as BacteriumType] : undefined, want === 'igg' && s.perks.broad) || placeNode(s, site.id, 'igm')) placed = true;
    }
    if (!placed) break;
  }
  s.energy += kept;
}

/** Danger on a route: summed health of pathogens past the share `watch` of the way in. */
const danger = (s: State, v: VesselId, watch: number) => s.pathogens.filter((p) => p.hp > 0 && covers(v, p) && p.s > watch * M.VESSELS[v].length).reduce((a, p) => a + p.hp, 0);

/** During a wave, every `react` seconds: open the vessel in most danger (one at a time; a strong player two), close
 *  clear ones, pulse a boss or a tough arrival, and (with extras) use the antibiotic and an extra cell. */
function fight(s: State, k: Skill, memo: { next: number }) {
  if (s.phase !== 'combat' || s.waveTime < memo.next) return;
  memo.next = s.waveTime + k.react;
  const N = CONFIG.no, most = [...M.VESSEL_IDS].sort((a, b) => danger(s, b, k.watch) - danger(s, a, k.watch));
  for (const v of [...s.open]) if (danger(s, v, Math.min(k.watch, 0.5)) === 0) toggleRoute(s, v);
  const best = most[0], dBest = danger(s, best, k.watch);
  if (dBest > 0 && !s.open.includes(best)) {
    const cur = s.open[0];
    const room = k.u > 0.75 ? 2 : 1;
    if (s.open.length < room && s.no >= N.openCost + 2 * N.drainPerSec && dilateCheck(s, best).ok) toggleRoute(s, best);
    else if (cur && dBest > 2 * danger(s, cur, k.watch) && s.no >= N.openCost + 2 * N.drainPerSec) { toggleRoute(s, cur); toggleRoute(s, best); }
  }
  if (k.pulses && s.pulsesLeft > 0 && pulseTargets(s).some((p) => CONFIG.pathogens[p.type].boss || (p.hp >= 40 && p.s > 0.85 * M.VESSELS[p.vessel].length))) firePulse(s);
  if (k.extras) {
    if (abxAvailable(s) && abxCheck(s).ok) {
      const bact = (v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && p.s > 0 && covers(v, p) && CONFIG.pathogens[p.type].taxon).length;
      const v = [...M.VESSEL_IDS].sort((a, b) => bact(b) - bact(a))[0];
      if (bact(v) >= 4) deployAntibiotic(s, v);
    }
    if (outCells(s).length <= 1 && s.energy >= 200 && buyCellCheck(s).ok) buyCell(s);
  }
}

const fighting = (s: State) => s.phase === 'combat' || s.phase === 'recall';

/** One organ played by a player: the result and the health left. */
export function playOrgan(level: number, c: Career, k: Skill, seed: number) {
  const s = newGame(level, perksOf(c), seed), r = rng(seed * 31 + 7), memo = { next: 0 };
  while (s.phase === 'prep') {
    build(s, k, r);
    startWave(s); memo.next = 0;
    let n = 0;
    while (fighting(s) && n++ < 30 * 400) { step(s, 1 / 30); fight(s, k, memo); }
  }
  return s;
}

/** Upgrades bought before an organ: its IgG targets first, then damage for the types it builds most, then the rest. */
function shop(c: Career, level: number) {
  const wish: UpgradeId[] = [
    ...organSpecies(level).filter((b) => b !== 'saureus').map((b) => `target-${b}` as UpgradeId),
    'dmg-igm', 'dmg-igg', 'dmg-iga', 'dmg-igm', 'dmg-igg', 'broad', 'no', 'dmg-ige', 'dmg-iga', 'extraNode', 'cheapFirst', 'no', 'dmg-igm', 'dmg-igg', 'dmg-ige', 'dmg-iga', 'dmg-ige',
  ];
  for (const id of wish) buy(c, id);
}

export interface OrganRecord { level: number; attempts: number; firstTry: boolean; won: boolean; hp: number; grinds: number; goldBefore: number; lost: number[] }
export interface CareerRecord { seed: number; skill: Skill; organs: OrganRecord[]; finished: boolean; plays: number; gold: number }

/** A whole career: each organ in order; after a loss, retry (after the second loss in a row, first replay the organ
 *  before for gold and shop); give up after `maxTries` on one organ. */
export function playCareer(seed: number, maxTries = 8): CareerRecord {
  const k = makeSkill(seed), c = freshCareer(), out: OrganRecord[] = [];
  let plays = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    const rec: OrganRecord = { level: i, attempts: 0, firstTry: false, won: false, hp: 0, grinds: 0, goldBefore: c.gold, lost: [] };
    while (rec.attempts < maxTries) {
      shop(c, i);
      const s = playOrgan(i, c, k, seed * 1009 + i * 97 + rec.attempts * 13);
      rec.attempts++; plays++;
      onOrganEnd(c, s);
      if (s.phase === 'victory') { rec.won = true; rec.firstTry = rec.attempts === 1; rec.hp = s.heartHp; break; }
      rec.lost.push(s.wave);
      // stuck: replay the organ before (a quarter of its gold) to buy more upgrades before trying again
      if (rec.attempts >= 2 && i > 0) {
        shop(c, i - 1);
        const g = playOrgan(i - 1, c, k, seed * 7919 + i * 31 + rec.attempts);
        plays++; rec.grinds++;
        onOrganEnd(c, g);
      }
    }
    out.push(rec);
    if (!rec.won) return { seed, skill: k, organs: out, finished: false, plays, gold: c.gold };
  }
  return { seed, skill: k, organs: out, finished: true, plays, gold: c.gold };
}

/** Summary of many careers: per organ, how many reached it, first-try wins, mean attempts and health; per career. */
export function summarize(rs: CareerRecord[]) {
  const organs = LEVELS.map((L, i) => {
    const at = rs.map((r) => r.organs[i]).filter(Boolean);
    const won = at.filter((o) => o.won);
    const band = (lo: number, hi: number) => { const g = rs.filter((r) => r.skill.u >= lo && r.skill.u < hi).map((r) => r.organs[i]).filter(Boolean); return g.length ? g.filter((o) => o.firstTry).length / g.length : NaN; };
    return {
      id: L.id, reached: at.length, firstTry: at.length ? at.filter((o) => o.firstTry).length / at.length : NaN,
      cleared: at.length ? won.length / at.length : NaN, attempts: at.length ? at.reduce((a, o) => a + o.attempts, 0) / at.length : NaN,
      hp: won.length ? won.reduce((a, o) => a + o.hp, 0) / won.length / L.hp : NaN,
      weak: band(0, 1 / 3), mid: band(1 / 3, 2 / 3), strong: band(2 / 3, 1.01),
    };
  });
  const finished = rs.filter((r) => r.finished);
  const fin = (lo: number, hi: number) => { const g = rs.filter((r) => r.skill.u >= lo && r.skill.u < hi); return g.length ? g.filter((r) => r.finished).length / g.length : NaN; };
  return {
    careers: rs.length, finished: finished.length / rs.length,
    finishedWeak: fin(0, 1 / 3), finishedMid: fin(1 / 3, 2 / 3), finishedStrong: fin(2 / 3, 1.01),
    plays: finished.length ? finished.reduce((a, r) => a + r.plays, 0) / finished.length : NaN,
    stuckAt: Object.fromEntries(LEVELS.map((L, i) => [L.id, rs.filter((r) => !r.finished && r.organs.length === i + 1).length]).filter(([, n]) => n)),
    organs,
  };
}
