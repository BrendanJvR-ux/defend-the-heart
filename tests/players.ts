// The scripted players the balance tests use, and the small helpers that drive a game in a test.
// The career player can't see what the next wave brings (blindBuild), like a real one; the "sensible" builder can,
// and is kept for comparison and for the rule tests that need a known build.
import { CONFIG, LEVELS, BACTERIA, type BacteriumType, type NodeType, type PathogenType, type VesselId } from '../src/config';
import * as M from '../src/level';
import { NO_PERKS, perksOf, freshCareer, buy, onOrganEnd, organBacteria, type Perks, type UpgradeId } from '../src/career';
import {
  newGame, toggleRoute, dilateCheck, covers, startWave, step, pulseTargets, firePulse, waveSpawns, placeNode, hasTarget, aimedAt, nodeAt, iggMultiplier,
  type State, type Pathogen,
} from '../src/sim';

export function tick(s: State, seconds: number, each?: (s: State) => void) { for (let t = 0; t < seconds; t += 1 / 30) { step(s, 1 / 30); each?.(s); } }
export function finishWave(s: State, each?: (s: State) => void) { let n = 0; while ((s.phase === 'combat' || s.phase === 'recall') && n++ < 30 * 400) { step(s, 1 / 30); each?.(s); } }
export function mk(s: State, type: PathogenType, vessel: VesselId, at: number): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, committed: at >= M.forkAt(vessel), s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: 0, wob: 0, slow: 1, slowT: 0 };
  s.pathogens.push(p); return p;
}
/** Start the wave and open route v at once (home cells set out along it). */
export function go(s: State, v: VesselId) { startWave(s); toggleRoute(s, v); }
/** Keep NO from running dry in tests that watch a long stretch of one open route. */
export const endlessNo = (s: State) => { s.no = 1e9; };
export function finishWaveUntil(s: State, phase: State['phase']) { let n = 0; while (s.phase !== phase && n++ < 30 * 400) step(s, 1 / 30); }
/** The sites that guard route r: its own, and its fork's shared stem sites. */
export const guarding = (r: VesselId) => M.SITES.filter((x) => x.vessel === r || (x.stem && M.entryOf(x.vessel) === M.entryOf(r)));
/** Leave only the given pathogens in play (no further spawns). */
export function quiet(s: State) { s.spawns = []; s.pathogens = []; }

/** The wave's pathogens entering by route v's vessel (a fork's two branches share them). */
export const spawnsFor = (n: number, v: VesselId) => waveSpawns(n).filter((x) => M.entryOf(x.vessel) === M.entryOf(v));
export const threat = (n: number, v: VesselId) => spawnsFor(n, v).reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
/** The scripted players' pulse: spend the white cells only on a boss, or on something tough (40+ health left)
 *  that is about to reach the organ. `min` 999 = never pulse. */
export const pulseAtCluster = (min: number) => (s: State) => {
  if (min >= 999 || s.phase !== 'combat' || s.pulsesLeft <= 0) return;
  if (pulseTargets(s).some((p) => CONFIG.pathogens[p.type].boss || (p.hp >= 40 && p.s > 0.85 * M.VESSELS[p.vessel].length))) firePulse(s);
};

/** A sensible player: dilate the busiest vessel; spend energy on nodes for the other threatened vessels,
 *  IgG where bacteria come, IgA where viruses swarm, IgM otherwise; pulse into clusters. */
export function sensibleBuild(s: State) {
  const n = s.wave;
  const ranked = [...M.VESSEL_IDS].sort((a, b) => threat(n, b) - threat(n, a));
  // spend energy round-robin on the threatened vessels: the least defended first, then the busiest
  const guards = (v: VesselId) => s.nodes.filter((x) => guarding(v).some((g) => g.id === x.site)).length;
  const order = ranked.filter((v) => threat(n, v) > 0).sort((a, b) => guards(a) - guards(b) || threat(n, b) - threat(n, a));
  for (let guard = 0; guard < 3; guard++) { // at most three rounds: a sensible player keeps energy for later waves
    let placed = false;
    for (const v of order) {
      const types = new Set(spawnsFor(n, v).map((x) => x.type));
      const aim = bestAim(s, n, v);
      const want: NodeType = aim && !nodeOn(s, v, 'igg') ? 'igg' : (types.has('virus') || types.has('hijacker')) && !nodeOn(s, v, 'iga') ? 'iga' : 'igm';
      const site = guarding(v).filter((x) => !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
      // an IgG it may not aim (two already aim at that bacterium) becomes an IgM
      if (site && (placeNode(s, site.id, want, want === 'igg' ? aim! : undefined) || (want === 'igg' && placeNode(s, site.id, 'igm')))) placed = true;
    }
    if (!placed) break;
  }
}
/** The IgG aim (one target) from the unlocked targets that does the most to this vessel's wave — or null when IgG
 *  would do no better on average than an IgM's ×1. */
export function bestAim(s: State, n: number, v: VesselId): BacteriumType[] | null {
  const sp = spawnsFor(n, v), total = sp.reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
  if (!total) return null;
  const score = (ts: BacteriumType[]) => sp.reduce((a, x) => a + CONFIG.pathogens[x.type].hp * iggMultiplier(ts, x.type), 0) / total;
  const options: BacteriumType[][] = s.perks.targets.map((b) => [b]);
  const best = options.sort((a, b) => score(b) - score(a))[0];
  return best && score(best) > 1.4 ? best : null;
}
export const nodeOn = (s: State, v: VesselId, t: NodeType) => s.nodes.some((x) => guarding(v).some((g) => g.id === x.site) && x.type === t);
/** Summed health of the pathogens on a route that are past 65% of the way in (where the cells meet them). */
export const danger = (s: State, v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && covers(v, p) && p.s > 0.65 * M.VESSELS[v].length).reduce((a, p) => a + p.hp, 0);
/** A sensible player's dilation, every tick of a wave: open where the danger is, close when it is clear,
 *  switch only for a much bigger threat and with NO to spare. */
export function sensibleDilate(s: State) {
  if (s.phase !== 'combat') return;
  const best = [...M.VESSEL_IDS].sort((a, b) => danger(s, b) - danger(s, a))[0];
  const N = CONFIG.no;
  const cur = s.open[0];
  if (danger(s, best) === 0) { if (cur) toggleRoute(s, cur); return; }
  if (!cur) { if (s.no >= N.openCost + 2 * N.drainPerSec) toggleRoute(s, best); return; }
  // switch (this player keeps one vessel open at a time): close the open one, open the busier
  if (best !== cur && danger(s, best) > 2 * danger(s, cur) && s.no >= N.openCost + 2 * N.drainPerSec) { toggleRoute(s, cur); toggleRoute(s, best); }
}
export const noBuild = () => {};
/** A player who, like a real one, can't see what the next wave brings: builds round the vessels, least defended
 *  first, two rounds a build; IgG aimed in turn at the organ's bacteria (the panel names them), an IgA as every
 *  third node on a vessel, IgM otherwise. */
export function blindBuild(s: State) {
  const guards = (v: VesselId) => s.nodes.filter((x) => guarding(v).some((g) => g.id === x.site)).length;
  const bugs = organBacteria(s.level);
  for (let round = 0; round < 2; round++) {
    let placed = false;
    for (const v of [...M.VESSEL_IDS].sort((a, b) => guards(a) - guards(b))) {
      const site = guarding(v).filter((x) => !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
      if (!site) continue;
      const aims = bugs.filter((b) => hasTarget(s, b) && aimedAt(s, b) < CONFIG.iggPerTarget);
      const want: NodeType = guards(v) % 3 === 2 ? 'iga' : aims.length ? 'igg' : 'igm';
      // with the Broad upgrade, its IgG are broad (they hit every bacterium of the Gram stain harder)
      if (placeNode(s, site.id, want, want === 'igg' ? [aims[0]] : undefined, want === 'igg' && s.perks.broad) || placeNode(s, site.id, 'igm')) placed = true;
    }
    if (!placed) break;
  }
}
/** A player who opens every route with pathogens well in, as many as it has white cells, and closes each when clear. */
export function multiDilate(s: State) {
  if (s.phase !== 'combat') return;
  const N = CONFIG.no;
  for (const v of [...s.open]) if (danger(s, v) === 0) toggleRoute(s, v);
  const want = [...M.VESSEL_IDS].filter((v) => danger(s, v) > 0 && !s.open.includes(v)).sort((a, b) => danger(s, b) - danger(s, a));
  for (const v of want) if (s.no >= N.openCost + 2 * N.drainPerSec * (s.open.length + 1) && dilateCheck(s, v).ok) toggleRoute(s, v);
}
/** A clumsy new player: spends all energy on IgM, on the first free sites in list order. */
export function clumsyBuild(s: State) {
  for (const site of M.SITES) if (!nodeAt(s, site.id) && !placeNode(s, site.id, 'igm') && s.energy < CONFIG.nodes.igm.cost) break;
}
/** …and opens the vessel with the most pathogens only once one is past 80% of it, closing it when that vessel is clear. */
export function clumsyDilate(s: State) {
  if (s.phase !== 'combat') return;
  const count = (v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && covers(v, p)).length;
  if (s.open[0]) { if (!count(s.open[0])) toggleRoute(s, s.open[0]); return; }
  const late = M.VESSEL_IDS.filter((v) => s.pathogens.some((p) => p.hp > 0 && covers(v, p) && p.s > 0.8 * M.VESSELS[v].length));
  const v = late.sort((a, b) => count(b) - count(a))[0];
  if (v && s.no >= CONFIG.no.openCost + CONFIG.no.drainPerSec) toggleRoute(s, v);
}
export function play(prep: (s: State) => void, dilate: (s: State) => void = sensibleDilate, pulseMin = 3, level = 0, perks: Perks = NO_PERKS) {
  const s = newGame(level, perks); const hp: number[] = [];
  const pulse = pulseAtCluster(pulseMin);
  while (s.phase === 'prep') { prep(s); startWave(s); finishWave(s, (st) => { dilate(st); pulse(st); }); hp.push(s.heartHp); }
  return { s, hp };
}

/** Every upgrade at its top level. */
export const ALL_PERKS: Perks = { dmg: { igm: 1.45, igg: 1.45, iga: 1.45, ige: 1.45 }, targets: [...BACTERIA], broad: true, mode: 'normal', noMax: 140, extraNode: true, cheapFirst: true };

/** The bacteria an organ's waves bring (bosses counted as their species). */
export const organSpecies = (i: number) => [...new Set(LEVELS[i].waves.flatMap((w) => w.groups.map((g) => CONFIG.pathogens[g.type].taxon?.species)).filter((x): x is BacteriumType => !!x))];

/** A career played by the sensible player: organs in order, gold banked, upgrades bought before each organ by a
 *  fixed policy — first the IgG targets for that organ's bacteria, then damage for the node types it built most
 *  last time, then broad IgG, NO, the extra starting node and the cheaper first node. */
export function careerRun(build: (s: State) => void = blindBuild, dilate: (s: State) => void = sensibleDilate) {
  const c = freshCareer(); const built: Record<NodeType, number> = { igm: 2, igg: 1, iga: 1, ige: 0 };
  const out: { level: number; phase: string; hp: number[]; goldBefore: number; bought: string[]; perks: Perks }[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const goldBefore = c.gold, bought: string[] = [];
    const wish: UpgradeId[] = [
      ...organSpecies(i).filter((b) => b !== 'saureus').map((b) => `target-${b}` as UpgradeId),
      ...(Object.entries(built) as [NodeType, number][]).sort((a, b) => b[1] - a[1]).flatMap(([t]) => [`dmg-${t}`, `dmg-${t}`, `dmg-${t}`] as UpgradeId[]),
      'broad', 'no', 'no', 'extraNode', 'cheapFirst',
    ];
    for (const id of wish) if (buy(c, id).ok) bought.push(id);
    const perks = perksOf(c);
    const { s, hp } = play(build, dilate, 3, i, perks);
    for (const n of s.nodes) built[n.type]++;
    onOrganEnd(c, s);
    out.push({ level: i, phase: s.phase, hp, goldBefore, bought, perks });
    if (s.phase !== 'victory') break;
  }
  return out;
}

/** Holds the route with the most wave threat open: opens it as soon as it can, never closes it. */
export function holdOpen(s: State) {
  if (s.phase !== 'combat' || s.open.length) return;
  const e = [...M.ENTRY_IDS].sort((a, b) => threat(s.wave, b) - threat(s.wave, a))[0];
  if (s.no >= CONFIG.no.openCost) toggleRoute(s, M.routesOf(e)[0]);
}
