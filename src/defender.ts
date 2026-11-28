// The scripted defender: how a sensible player builds lymph nodes, dilates vessels and fires the pulse. The balance
// tests drive games with it, and in Attack mode it runs the organ the player is attacking.
import { CONFIG, type NodeType, type VesselId } from './config';
import * as M from './level';
import { organBacteria } from './career';
import { toggleRoute, covers, pulseTargets, firePulse, placeNode, hasTarget, aimedAt, nodeAt, type State } from './sim';

/** The sites that guard route r: its own, and its fork's shared stem sites. */
export const guarding = (r: VesselId) => M.SITES.filter((x) => x.vessel === r || (x.stem && M.entryOf(x.vessel) === M.entryOf(r)));

/** The scripted players' pulse: spend the white cells only on a boss, or on something tough (40+ health left)
 *  that is about to reach the organ. `min` 999 = never pulse. */
export const pulseAtCluster = (min: number) => (s: State) => {
  if (min >= 999 || s.phase !== 'combat' || s.pulsesLeft <= 0) return;
  if (pulseTargets(s).some((p) => CONFIG.pathogens[p.type].boss || (p.hp >= 40 && p.s > 0.85 * M.VESSELS[p.vessel].length))) firePulse(s);
};

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

/** A player who, like a real one, can't see what the next wave brings: builds round the vessels, least defended
 *  first, two rounds a build; IgG aimed in turn at the organ's bacteria (the panel names them), an IgA as every
 *  third node on a vessel, IgM otherwise. */
export function blindBuild(s: State) {
  for (let round = 0; round < 2; round++) {
    let placed = false;
    for (const v of [...M.VESSEL_IDS].sort((a, b) => guardsOn(s, a) - guardsOn(s, b))) if (buildOn(s, v)) placed = true;
    if (!placed) break;
  }
}

/** How many nodes guard route v. */
export const guardsOn = (s: State, v: VesselId) => s.nodes.filter((x) => guarding(v).some((g) => g.id === x.site)).length;

/** One node on route v, as the scripted player chooses it: its outermost free site; an IgA as every third node, else
 *  IgG aimed at the next of the organ's bacteria that has room (broad with the upgrade), else IgM. */
export function buildOn(s: State, v: VesselId): boolean {
  const site = guarding(v).filter((x) => !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
  if (!site) return false;
  const aims = organBacteria(s.level).filter((b) => hasTarget(s, b) && aimedAt(s, b) < CONFIG.iggPerTarget);
  const want: NodeType = guardsOn(s, v) % 3 === 2 ? 'iga' : aims.length ? 'igg' : 'igm';
  return placeNode(s, site.id, want, want === 'igg' ? [aims[0]] : undefined, want === 'igg' && s.perks.broad) || placeNode(s, site.id, 'igm');
}
