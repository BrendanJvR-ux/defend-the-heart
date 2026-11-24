import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CONFIG, LEVELS, BACTERIA, type BacteriumType, type LevelDef, type NodeType, type PathogenType, type VesselId } from '../src/config';
import * as map from '../src/level';
import { siteById, dist } from '../src/level';
import { layoutLabels, type Box } from '../src/labels';
import { organCacheKey, organImageScale } from '../src/organCache';
import { NO_PERKS, perksOf, freshCareer, buy, onOrganEnd, type Perks, type UpgradeId } from '../src/career';
// live bindings: always the currently loaded organ
const M = map;
import {
  newGame, toggleRoute, dilateCheck, openNeed, outCells, pulseCheck, covers, infect, surging, activeBoss, filtered, totalWaves, canStartWave, startWave, step, firePulse, pulseTargets, aliveCells, pathogenPos,
  waveSpawns, placeNode, buildCheck, nodeAt, hurt, hidden, iggMultiplier, retargetNode, advance, nextSpeed, SPEEDS, leakSummary, type State, type Pathogen,
} from '../src/sim';

function tick(s: State, seconds: number, each?: (s: State) => void) { for (let t = 0; t < seconds; t += 1 / 30) { step(s, 1 / 30); each?.(s); } }
function finishWave(s: State, each?: (s: State) => void) { let n = 0; while ((s.phase === 'combat' || s.phase === 'recall') && n++ < 30 * 400) { step(s, 1 / 30); each?.(s); } }
function mk(s: State, type: PathogenType, vessel: VesselId, at: number): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, committed: at >= M.forkAt(vessel), s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: 0, wob: 0, slow: 1, slowT: 0 };
  s.pathogens.push(p); return p;
}
/** Start the wave and open route v at once (home cells set out along it). */
function go(s: State, v: VesselId) { startWave(s); toggleRoute(s, v); }
/** Keep NO from running dry in tests that watch a long stretch of one open route. */
const endlessNo = (s: State) => { s.no = 1e9; };
function finishWaveUntil(s: State, phase: State['phase']) { let n = 0; while (s.phase !== phase && n++ < 30 * 400) step(s, 1 / 30); }
/** The sites that guard route r: its own, and its fork's shared stem sites. */
const guarding = (r: VesselId) => M.SITES.filter((x) => x.vessel === r || (x.stem && M.entryOf(x.vessel) === M.entryOf(r)));
/** Leave only the given pathogens in play (no further spawns). */
function quiet(s: State) { s.spawns = []; s.pathogens = []; }

/** The wave's pathogens entering by route v's vessel (a fork's two branches share them). */
const spawnsFor = (n: number, v: VesselId) => waveSpawns(n).filter((x) => M.entryOf(x.vessel) === M.entryOf(v));
const threat = (n: number, v: VesselId) => spawnsFor(n, v).reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
/** The scripted players' pulse: spend the white cells only on a boss, or on something tough (40+ health left)
 *  that is about to reach the organ. `min` 999 = never pulse. */
const pulseAtCluster = (min: number) => (s: State) => {
  if (min >= 999 || s.phase !== 'combat' || s.pulsesLeft <= 0) return;
  if (pulseTargets(s).some((p) => CONFIG.pathogens[p.type].boss || (p.hp >= 40 && p.s > 0.85 * M.VESSELS[p.vessel].length))) firePulse(s);
};

/** A sensible player: dilate the busiest vessel; spend energy on nodes for the other threatened vessels,
 *  IgG where bacteria come, IgA where viruses swarm, IgM otherwise; pulse into clusters. */
function sensibleBuild(s: State) {
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
      if (site && placeNode(s, site.id, want, want === 'igg' ? aim! : undefined)) placed = true;
    }
    if (!placed) break;
  }
}
/** The IgG aim (one target, or two with dual-target) from the unlocked targets that does the most to this
 *  vessel's wave — or null when IgG would do no better on average than an IgM's ×1. */
function bestAim(s: State, n: number, v: VesselId): BacteriumType[] | null {
  const sp = spawnsFor(n, v), total = sp.reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
  if (!total) return null;
  const score = (ts: BacteriumType[]) => sp.reduce((a, x) => a + CONFIG.pathogens[x.type].hp * iggMultiplier(ts, x.type), 0) / total;
  const ts = s.perks.targets, options: BacteriumType[][] = ts.map((b) => [b]);
  if (s.perks.dual) for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) options.push([ts[i], ts[j]]);
  const best = options.sort((a, b) => score(b) - score(a) || a.length - b.length)[0];
  return best && score(best) > 1.4 ? best : null;
}
const nodeOn = (s: State, v: VesselId, t: NodeType) => s.nodes.some((x) => guarding(v).some((g) => g.id === x.site) && x.type === t);
/** Summed health of the pathogens on a route that are past 65% of the way in (where the cells meet them). */
const danger = (s: State, v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && covers(v, p) && p.s > 0.65 * M.VESSELS[v].length).reduce((a, p) => a + p.hp, 0);
/** A sensible player's dilation, every tick of a wave: open where the danger is, close when it is clear,
 *  switch only for a much bigger threat and with NO to spare. */
function sensibleDilate(s: State) {
  if (s.phase !== 'combat') return;
  const best = [...M.VESSEL_IDS].sort((a, b) => danger(s, b) - danger(s, a))[0];
  const N = CONFIG.no;
  if (danger(s, best) === 0) { if (s.dilated) toggleRoute(s, s.dilated); return; }
  if (!s.dilated) { if (s.no >= N.openCost + 2 * N.drainPerSec) toggleRoute(s, best); return; }
  if (best !== s.dilated && danger(s, best) > 2 * danger(s, s.dilated) && s.no >= N.openCost + 2 * N.drainPerSec) toggleRoute(s, best);
}
const noBuild = () => {};
/** A clumsy new player: spends all energy on IgM, on the first free sites in list order. */
function clumsyBuild(s: State) {
  for (const site of M.SITES) if (!nodeAt(s, site.id) && !placeNode(s, site.id, 'igm') && s.energy < CONFIG.nodes.igm.cost) break;
}
/** …and opens the vessel with the most pathogens only once one is past 80% of it, closing it when that vessel is clear. */
function clumsyDilate(s: State) {
  if (s.phase !== 'combat') return;
  const count = (v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && covers(v, p)).length;
  if (s.dilated) { if (!count(s.dilated)) toggleRoute(s, s.dilated); return; }
  const late = M.VESSEL_IDS.filter((v) => s.pathogens.some((p) => p.hp > 0 && covers(v, p) && p.s > 0.8 * M.VESSELS[v].length));
  const v = late.sort((a, b) => count(b) - count(a))[0];
  if (v && s.no >= CONFIG.no.openCost + CONFIG.no.drainPerSec) toggleRoute(s, v);
}
function play(prep: (s: State) => void, dilate: (s: State) => void = sensibleDilate, pulseMin = 3, level = 0, perks: Perks = NO_PERKS) {
  const s = newGame(level, perks); const hp: number[] = [];
  const pulse = pulseAtCluster(pulseMin);
  while (s.phase === 'prep') { prep(s); startWave(s); finishWave(s, (st) => { dilate(st); pulse(st); }); hp.push(s.heartHp); }
  return { s, hp };
}

describe('Defend the Heart: NO and mid-wave dilation', () => {
  it('a wave starts with every vessel resting and needs no choice', () => {
    const s = newGame(0); expect(canStartWave(s).ok).toBe(true); expect(startWave(s)).toBe(true);
    expect(s.dilated).toBeNull(); expect(s.no).toBe(CONFIG.no.max);
    expect(s.cells.every((c) => c.mode === 'home')).toBe(true);
  });
  it('dilation is refused between waves and during recall', () => {
    const s = newGame(0); expect(toggleRoute(s, 'left')).toBe(false);
    expect(dilateCheck(s, 'left').reason).toBe('Dilate during the wave.');
    startWave(s); quiet(s); finishWaveUntil(s, 'recall'); expect(toggleRoute(s, 'left')).toBe(false);
  });
  it('opening costs NO, an open route drains it, a closed one regains it', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 10);
    toggleRoute(s, 'left'); expect(s.no).toBe(CONFIG.no.max - CONFIG.no.openCost);
    const a = s.no; tick(s, 1); expect(a - s.no).toBeCloseTo(CONFIG.no.drainPerSec, 0);
    toggleRoute(s, 'left'); expect(s.dilated).toBeNull();
    const b = s.no; tick(s, 1); expect(s.no - b).toBeCloseTo(CONFIG.no.regenPerSec, 0);
  });
  it('switching pays again; too little NO refuses', () => {
    const s = newGame(0); startWave(s); quiet(s);
    toggleRoute(s, 'left'); toggleRoute(s, 'right');
    expect(s.dilated).toBe('right'); expect(s.no).toBe(CONFIG.no.max - 2 * CONFIG.no.openCost);
    s.no = CONFIG.no.openCost - 1; expect(toggleRoute(s, 'left')).toBe(false); expect(s.dilated).toBe('right');
    expect(dilateCheck(s, 'left').reason).toBe('Not enough NO to open the left vessel.');
  });
  it('opening needs enough NO to stay open for a moment, not just the opening cost', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0);
    const need = CONFIG.no.openCost + CONFIG.no.drainPerSec * CONFIG.no.minOpenSeconds;
    expect(openNeed()).toBe(need);
    s.no = need - 0.5;
    expect(toggleRoute(s, 'left')).toBe(false);
    expect(dilateCheck(s, 'left').reason).toBe('Not enough NO to open the left vessel.');
    s.no = need; expect(toggleRoute(s, 'left')).toBe(true);
    tick(s, CONFIG.no.minOpenSeconds * 0.9); expect(s.dilated).toBe('left');
  });

  it('reopening the vessel you just closed turns its returning cells back out', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0);
    toggleRoute(s, 'left'); tick(s, 3); const at = outCells(s).map((c) => c.s);
    toggleRoute(s, 'left'); step(s, 1 / 30);
    expect(s.cells.every((c) => c.mode === 'returning')).toBe(true);
    toggleRoute(s, 'left');
    expect(outCells(s).length).toBe(2);
    // they turn round where they are, not back at the organ
    outCells(s).forEach((c, i) => expect(Math.abs(c.s - at[i])).toBeLessThan(20));
  });

  it('dilation is refused while paused, like the pulse', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0); s.paused = true;
    expect(toggleRoute(s, 'left')).toBe(false);
    expect(dilateCheck(s, 'left').reason).toBe('Paused.');
    expect(s.no).toBe(CONFIG.no.max);
  });

  it('running dry closes the route once, never goes negative, and sends the cells home', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 0.5); s.no = 0.1; step(s, 0.1);
    expect(s.no).toBe(0); expect(s.dilated).toBeNull(); expect(s.noOuts).toBe(1);
    expect(s.cells.every((c) => c.mode !== 'out')).toBe(true);
    step(s, 0.1); expect(s.noOuts).toBe(1);
  });
  it('cells go out along the opened route; reopening another waits for them to get home first', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 3);
    expect(outCells(s).every((c) => c.vessel === 'left' && c.s < M.VESSELS.left.length - 20)).toBe(true);
    toggleRoute(s, 'right'); step(s, 1 / 30);
    expect(s.cells.every((c) => c.vessel === 'left' && c.mode === 'returning')).toBe(true);
    tick(s, 3); expect(outCells(s).length).toBe(2); expect(outCells(s).every((c) => c.vessel === 'right')).toBe(true);
  });
  it('cells at home or returning neither fight nor get infected', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0);
    const h = mk(s, 'hijacker', 'left', M.VESSELS.left.length - 30); const hp = h.hp; tick(s, 0.1);
    expect(s.infections).toBe(0); expect(h.hp).toBe(hp);
    s.pathogens = s.pathogens.filter((p) => p !== h);
    toggleRoute(s, 'left'); tick(s, 2); toggleRoute(s, 'left');
    const r = s.cells.filter((c) => c.mode === 'returning'); expect(r.length).toBeGreaterThan(0);
    const h2 = mk(s, 'hijacker', 'left', r[0].s); const hp2 = h2.hp; step(s, 1 / 30);
    expect(s.infections).toBe(0); expect(h2.hp).toBe(hp2);
  });
  it('the pulse needs cells out on a route', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'virus', 'left', 10);
    expect(pulseCheck(s).reason).toBe('Open a vessel to send your white cells out first.');
  });
  it('after a cleared wave NO tops up, capped at capacity, and every vessel rests', () => {
    const s = newGame(0); startWave(s); quiet(s); s.no = 50; finishWave(s);
    expect(s.phase).toBe('prep'); expect(s.no).toBeCloseTo(50 + CONFIG.no.waveTopUp, 0); expect(s.dilated).toBeNull();
    const t = newGame(0); startWave(t); quiet(t); finishWave(t); expect(t.no).toBe(CONFIG.no.max);
  });
});

describe('Defend the Heart: cells and the pulse', () => {
  it('all four vessels admit pathogens, nodes fire on their own vessel, only the dilated vessel carries white cells', () => {
    const s = newGame(0); s.wave = 4; s.energy = 999;
    for (const v of M.VESSEL_IDS) { const site = M.SITES.find((x) => x.vessel === v && !nodeAt(s, x.id))!; placeNode(s, site.id, 'igm'); }
    go(s, 'lower'); endlessNo(s);
    const seen = new Set<string>(), shots = new Set<string>();
    tick(s, 30, (st) => {
      for (const p of st.pathogens) seen.add(p.vessel);
      for (const sh of st.shots) { shots.add(sh.vessel); expect(st.pathogens.find((p) => p.id === sh.targetId)?.vessel ?? sh.vessel).toBe(sh.vessel); }
      for (const c of st.cells) expect(c.vessel).toBe('lower');
    });
    expect([...seen].sort()).toEqual([...M.VESSEL_IDS].sort());
    expect([...shots].sort()).toEqual([...M.VESSEL_IDS].sort());
  });

  it('the pulse never strikes a pathogen on a resting vessel, even right beside a cell', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    const c = s.cells[0]; c.s = M.VESSELS.left.length - 2; s.cells = [c];
    const p = mk(s, 'virus', 'upper', M.VESSELS.upper.length - 4);
    expect(pulseTargets(s).length).toBe(0);
    expect(pulseCheck(s).ok).toBe(false);
    expect(firePulse(s)).toBe(-1);
    expect(p.hp).toBe(CONFIG.pathogens.virus.hp); expect(c.hp).toBeGreaterThan(0);
  });

  it('the pulse: a white cell touching a pathogen destroys it and dies; once per wave', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    const [a, b] = s.cells; a.s = 400; b.s = 300;
    expect(pulseCheck(s).reason).toMatch(/touching/); // nothing near yet: the charge is kept
    const p = mk(s, 'saureus', 'left', 410), far = mk(s, 'saureus', 'left', 200);
    expect(pulseTargets(s)).toEqual([p]);
    expect(firePulse(s)).toBe(1);
    expect(p.hp).toBeLessThanOrEqual(0); expect(a.hp).toBe(0);
    expect(far.hp).toBe(CONFIG.pathogens.saureus.hp); expect(b.hp).toBeGreaterThan(0); // a cell touching nothing lives
    expect(firePulse(s)).toBe(-1);
  });

  it('two cells touching pathogens strike two different ones', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    const [a, b] = s.cells; a.s = 400; b.s = 402;
    const p = mk(s, 'virus', 'left', 405), q = mk(s, 'virus', 'left', 395);
    expect(new Set(pulseTargets(s))).toEqual(new Set([p, q]));
    expect(firePulse(s)).toBe(2);
    expect(p.hp).toBeLessThanOrEqual(0); expect(q.hp).toBeLessThanOrEqual(0); expect(a.hp).toBe(0); expect(b.hp).toBe(0);
  });

  it('a pulse on a boss takes a third of its health, not all of it', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    s.cells = [s.cells[0]]; s.cells[0].s = 400;
    const boss = mk(s, 'colony', 'left', 410);
    expect(firePulse(s)).toBe(1);
    expect(boss.hp).toBeCloseTo(boss.maxHp * (2 / 3), 5);
  });

  it('lost cells are back at the start of the next wave', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    s.cells[0].s = 400; mk(s, 'virus', 'left', 405); firePulse(s);
    finishWave(s);
    startWave(s); expect(aliveCells(s).length).toBe(LEVELS[0].cells);
  });

  it('between waves: cells home, vessel contracts, choice and pulse reset, energy awarded; heart damage persists', () => {
    const s = newGame(0); go(s, 'right'); quiet(s);
    mk(s, 'saureus', 'upper', M.VESSELS.upper.length - 20); // one bacterium, about to reach the heart
    const e0 = s.energy;
    finishWave(s);
    expect(s.phase).toBe('prep'); expect(s.wave).toBe(2); expect(s.heartHp).toBeLessThan(LEVELS[0].hp);
    expect(s.dilated).toBeNull(); expect(s.cells.length).toBe(0); expect(s.pulsesLeft).toBe(0);
    for (const v of M.VESSEL_IDS) expect(s.width[v]).toBe(0);
    expect(s.energy).toBeGreaterThan(e0);
    const hp = s.heartHp;
    go(s, 'left');
    expect(aliveCells(s).length).toBe(LEVELS[0].cells);
    expect(s.pulsesLeft).toBe(1);
    expect(s.heartHp).toBe(hp);
  });

  it('defeat at zero heart health; restart restores everything', () => {
    const s = newGame(0); s.energy = 999; placeNode(s, 'lower-1', 'iga');
    go(s, 'left');
    s.heartHp = 1; mk(s, 'saureus', 'right', M.VESSELS.right.length - 1);
    tick(s, 0.2);
    expect(s.phase).toBe('defeat');
    const r = newGame(0);
    expect([r.heartHp, r.wave, r.dilated, r.energy, r.nodes.length]).toEqual([LEVELS[0].hp, 1, null, LEVELS[0].startEnergy, LEVELS[0].startingNodes.length]);
  });
});

describe('Defend the Heart: placing lymph nodes', () => {
  it('nodes are placed only between waves, on free sites, and cost energy', () => {
    const s = newGame(0);
    const free = M.SITES.find((x) => !nodeAt(s, x.id))!;
    expect(buildCheck(s, free.id, 'igg', ['saureus']).ok).toBe(true);
    const e = s.energy;
    expect(placeNode(s, free.id, 'igg', ['saureus'])).toBe(true);
    expect(s.energy).toBe(e - CONFIG.nodes.igg.cost);
    expect(placeNode(s, free.id, 'igm')).toBe(false); // occupied
    s.energy = 0;
    expect(placeNode(s, M.SITES.find((x) => !nodeAt(s, x.id))!.id, 'iga')).toBe(false); // too poor
    s.energy = 999; go(s, 'left');
    expect(placeNode(s, M.SITES.find((x) => !nodeAt(s, x.id))!.id, 'iga')).toBe(false); // in combat
  });

  it('every vessel has several sites, each beside its own vessel', () => {
    newGame(0);
    for (const v of M.VESSEL_IDS) expect(M.SITES.filter((x) => x.vessel === v).length).toBeGreaterThanOrEqual(3);
    for (const x of M.SITES) { const a = siteById(x.id).anchor; expect(dist(x, a)).toBeLessThan(130); }
  });
});

/** Every IgG target unlocked, nothing else (for tests of the rules themselves). */
const ALL_TARGETS: Perks = { ...NO_PERKS, targets: [...BACTERIA] };

describe('Defend the Heart: the IgG match', () => {
  it('species ×3, shape ×2.5, Gram ×2, unrelated bacterium ×0.5, not a bacterium ×0.25', () => {
    expect(iggMultiplier(['spneumo'], 'spneumo')).toBe(3);
    expect(iggMultiplier(['spneumo'], 'saureus')).toBe(2.5);
    expect(iggMultiplier(['spneumo'], 'listeria')).toBe(2);
    expect(iggMultiplier(['spneumo'], 'ecoli')).toBe(0.5);
    expect(iggMultiplier(['spneumo'], 'nmening')).toBe(2.5);
    for (const x of ['virus', 'hijacker', 'infected', 'flu', 'hepatitis', 'sepsis'] as PathogenType[]) expect(iggMultiplier(['spneumo'], x)).toBe(0.25);
    expect(iggMultiplier(['saureus'], 'colony')).toBe(3);
    expect(iggMultiplier(['nmening'], 'meningo')).toBe(3);
  });
  it('a dual target uses the better match, never the product', () => {
    expect(iggMultiplier(['ecoli', 'saureus'], 'spneumo')).toBe(2.5);
    expect(iggMultiplier(['ecoli', 'saureus'], 'kpneumo')).toBe(2.5);
    expect(iggMultiplier(['ecoli', 'listeria'], 'listeria')).toBe(3);
  });
  it('the six bacteria, with their Gram stain and shape', () => {
    expect(BACTERIA).toEqual(['saureus', 'spneumo', 'listeria', 'nmening', 'ecoli', 'kpneumo']);
    const tx = (b: BacteriumType) => { const x = CONFIG.pathogens[b].taxon!; return `${x.gram}${x.shape}`; };
    expect(BACTERIA.map(tx)).toEqual(['+coccus', '+coccus', '+rod', '-coccus', '-rod', '-rod']);
    for (const b of BACTERIA) expect([CONFIG.pathogens[b].hp, CONFIG.pathogens[b].speed]).toEqual([70, 30]);
  });
});

describe('Defend the Heart: lymph nodes', () => {
  function oneShot(type: NodeType, target: PathogenType, targets?: BacteriumType[]) {
    const s = newGame(0, ALL_TARGETS); s.nodes = []; s.energy = 999;
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    placeNode(s, site.id, type, targets ?? (type === 'igg' ? ['saureus'] : undefined));
    go(s, 'right'); quiet(s); mk(s, 'saureus', 'upper', 0);
    const p = mk(s, target, 'left', 0);
    // park it right beside the node and let exactly one antibody land
    let sNear = 0, dmin = Infinity;
    for (let d = 0; d < M.VESSELS.left.length; d += 4) { p.s = d; const dd = dist(pathogenPos(p), site); if (dd < dmin) { dmin = dd; sNear = d; } }
    p.s = sNear; p.hp = p.maxHp = 1000;
    const speed = CONFIG.pathogens[target].speed; CONFIG.pathogens[target].speed = 0;
    let n = 0; while (p.hp === 1000 && n++ < 300) step(s, 1 / 30);
    CONFIG.pathogens[target].speed = speed;
    return { s, p, dmg: 1000 - p.hp };
  }

  it('there is no armour: an IgM hit takes exactly its damage from a bacterium', () => {
    expect(oneShot('igm', 'saureus').dmg).toBe(10);
    for (const st of Object.values(CONFIG.pathogens)) expect('armour' in st).toBe(false);
  });
  it('IgM hits everything for 10; IgA for 7.5 and slows; IgE for 20', () => {
    for (const x of ['ecoli', 'virus'] as PathogenType[]) {
      expect(oneShot('igm', x).dmg).toBe(10);
      expect(oneShot('iga', x).dmg).toBe(7.5);
      expect(oneShot('ige', x).dmg).toBe(20);
    }
    expect(oneShot('iga', 'virus').p.slow).toBeLessThan(1);
    expect(oneShot('igm', 'virus').p.slow).toBe(1);
  });
  it('IgG damage is 10 × its match', () => {
    expect(oneShot('igg', 'spneumo', ['spneumo']).dmg).toBe(30);
    expect(oneShot('igg', 'ecoli', ['spneumo']).dmg).toBe(5);
    expect(oneShot('igg', 'virus', ['spneumo']).dmg).toBe(2.5);
    expect(oneShot('igg', 'virus', ['spneumo']).p.slow).toBe(1);
  });
  it('IgG needs a target; a second target is refused without dual-target', () => {
    const s = newGame(0); const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    expect(buildCheck(s, site.id, 'igg').reason).toBe('Choose what this IgG targets.');
    expect(placeNode(s, site.id, 'igg', ['saureus', 'ecoli'])).toBe(false);
    expect(placeNode(s, site.id, 'igg', ['saureus'])).toBe(true);
    expect(nodeAt(s, site.id)!.targets).toEqual(['saureus']);
  });
  it('an IgG node can be re-aimed between waves for 20 energy, not during a wave', () => {
    const s = newGame(0, ALL_TARGETS); s.energy = 200; const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    placeNode(s, site.id, 'igg', ['saureus']); const e = s.energy;
    expect(retargetNode(s, site.id, ['ecoli'])).toBe(true);
    expect(s.energy).toBe(e - CONFIG.iggRetarget); expect(nodeAt(s, site.id)!.targets).toEqual(['ecoli']);
    startWave(s); expect(retargetNode(s, site.id, ['saureus'])).toBe(false);
  });
  it('IgE removed after its third cleared wave; its site is free for the next build', () => {
    const s = newGame(0); s.energy = 999; const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    placeNode(s, site.id, 'ige');
    for (let w = 1; w <= 3; w++) {
      startWave(s); quiet(s); finishWave(s);
      expect(s.phase).toBe('prep');
      if (w < 3) { expect(nodeAt(s, site.id)!.wavesFought).toBe(w); expect(s.spent).toEqual([]); }
    }
    expect(nodeAt(s, site.id)).toBeUndefined();
    expect(s.spent.map((x) => x.site)).toEqual([site.id]);
    expect(buildCheck(s, site.id, 'igm').ok).toBe(true);
    startWave(s); quiet(s); finishWave(s); expect(s.spent).toEqual([]);
  });
  it('IgE has no boss priority: it shoots the most advanced pathogen in reach, boss or not', () => {
    const s = newGame(0); s.wave = 6; go(s, 'right'); quiet(s); s.cells = [];
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    s.nodes = [{ id: 999, site: site.id, vessel: 'left', type: 'ige', cd: 0, flash: 0, targets: [], wavesFought: 0 }];
    const probe = mk(s, 'virus', 'left', 0); let best = 0, bd = Infinity;
    for (let d = 0; d < M.VESSELS.left.length; d += 2) { probe.s = d; const dd = dist(pathogenPos(probe), site); if (dd < bd) { bd = dd; best = d; } }
    s.pathogens = [];
    const boss = mk(s, 'colony', 'left', best - 30), virus = mk(s, 'virus', 'left', best + 30); virus.hp = virus.maxHp = 1000;
    const saved = [CONFIG.pathogens.colony.speed, CONFIG.pathogens.virus.speed];
    CONFIG.pathogens.colony.speed = 0; CONFIG.pathogens.virus.speed = 0;
    tick(s, 0.5); [CONFIG.pathogens.colony.speed, CONFIG.pathogens.virus.speed] = saved;
    expect(virus.hp).toBeLessThan(1000); expect(boss.hp).toBe(boss.maxHp);
  });
});

describe('Defend the Heart: hijacker viruses', () => {
  it('a hijacker that touches a white cell turns it into an infected enemy heading for the heart', () => {
    const s = newGame(0); go(s, 'left'); quiet(s);
    const c = s.cells[0]; s.cells = [c]; c.s = 400;
    const h = mk(s, 'hijacker', 'left', 390);
    step(s, 1 / 30);
    expect(h.hp).toBeLessThanOrEqual(0);
    expect(c.infected).toBe(true);
    expect(aliveCells(s).length).toBe(0);
    const enemy = s.pathogens.find((p) => p.type === 'infected')!;
    expect(enemy).toBeTruthy();
    expect(enemy.vessel).toBe('left');
    const s0 = enemy.s; tick(s, 1);
    expect(enemy.s).toBeGreaterThan(s0); // moving towards the heart
    expect(s.infections).toBe(1);
  });

  it('ordinary viruses never infect white cells', () => {
    const s = newGame(0); go(s, 'left'); quiet(s);
    const c = s.cells[0]; s.cells = [c]; c.s = 400;
    mk(s, 'virus', 'left', 395);
    tick(s, 1);
    expect(c.infected).toBe(false);
    expect(s.pathogens.some((p) => p.type === 'infected')).toBe(false);
  });
});

describe('Defend the Heart: balance', () => {
  it('without upgrades the sensible player wins the heart and the lungs', () => {
    for (const i of [0, 1]) {
      const { s, hp } = play(sensibleBuild, sensibleDilate, 3, i);
      console.log(LEVELS[i].id, 'no upgrades', hp, s.phase);
      expect(s.phase).toBe('victory');
    }
  });

  it('a clumsy player (IgM only, first free sites, opens late, never pulses) wins the heart without upgrades', () => {
    const { s, hp } = play(clumsyBuild, clumsyDilate, 999, 0);
    console.log('heart clumsy', hp, s.phase);
    expect(s.phase).toBe('victory');
  });

  it('the sensible player ends the heart on at least 12/20 without upgrades', () => {
    const { s } = play(sensibleBuild, sensibleDilate, 3, 0);
    expect(s.phase).toBe('victory'); expect(s.heartHp).toBeGreaterThanOrEqual(12);
  });

  it('white cells alone cannot clear wave 1 without lymph nodes', () => {
    const s = newGame(0); s.nodes = []; startWave(s); finishWave(s, (st) => { sensibleDilate(st); pulseAtCluster(2)(st); });
    console.log('cells only wave 1:', s.heartHp);
    expect(s.heartHp).toBeLessThan(LEVELS[0].hp);
  });

  it('a scripted career wins every organ on its first attempt', () => {
    const run = careerRun();
    for (const r of run) console.log('career', LEVELS[r.level].id, r.hp, r.phase, 'gold before', r.goldBefore, 'bought', r.bought.join(','));
    expect(run.map((r) => r.phase)).toEqual(LEVELS.map(() => 'victory'));
  });

  it('from the liver on, energy is tight: the career player fills at most 60% of the build sites', () => {
    for (const r of careerRun().filter((x) => x.level >= 3)) {
      const g = play(sensibleBuild, sensibleDilate, 3, r.level, r.perks); newGame(r.level);
      const share = g.s.nodes.length / M.SITES.length;
      console.log(LEVELS[r.level].id, 'built', g.s.nodes.length, 'of', M.SITES.length, 'sites');
      expect(share, LEVELS[r.level].id).toBeLessThanOrEqual(0.6);
    }
  });

  it('never building loses every organ, even with every upgrade', () => {
    for (let i = 0; i < LEVELS.length; i++) expect(play(noBuild, sensibleDilate, 3, i, ALL_PERKS).s.phase, LEVELS[i].id).toBe('defeat');
  });
});

/** Every upgrade at its top level. */
const ALL_PERKS: Perks = { dmg: { igm: 1.45, igg: 1.45, iga: 1.45, ige: 1.45 }, targets: [...BACTERIA], dual: true, noMax: 140, extraNode: true, cheapFirst: true };

/** The bacteria an organ's waves bring (bosses counted as their species). */
const organSpecies = (i: number) => [...new Set(LEVELS[i].waves.flatMap((w) => w.groups.map((g) => CONFIG.pathogens[g.type].taxon?.species)).filter((x): x is BacteriumType => !!x))];

/** A career played by the sensible player: organs in order, gold banked, upgrades bought before each organ by a
 *  fixed policy — first the IgG targets for that organ's bacteria, then damage for the node types it built most
 *  last time, then dual-target, NO, the extra starting node and the cheaper first node. */
function careerRun() {
  const c = freshCareer(); const built: Record<NodeType, number> = { igm: 2, igg: 1, iga: 1, ige: 0 };
  const out: { level: number; phase: string; hp: number[]; goldBefore: number; bought: string[]; perks: Perks }[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const goldBefore = c.gold, bought: string[] = [];
    const wish: UpgradeId[] = [
      ...organSpecies(i).filter((b) => b !== 'saureus').map((b) => `target-${b}` as UpgradeId),
      ...(Object.entries(built) as [NodeType, number][]).sort((a, b) => b[1] - a[1]).flatMap(([t]) => [`dmg-${t}`, `dmg-${t}`, `dmg-${t}`] as UpgradeId[]),
      'dual', 'no', 'no', 'extraNode', 'cheapFirst',
    ];
    for (const id of wish) if (buy(c, id).ok) bought.push(id);
    const perks = perksOf(c);
    const { s, hp } = play(sensibleBuild, sensibleDilate, 3, i, perks);
    for (const n of s.nodes) built[n.type]++;
    onOrganEnd(c, s);
    out.push({ level: i, phase: s.phase, hp, goldBefore, bought, perks });
    if (s.phase !== 'victory') break;
  }
  return out;
}

/** Holds the route with the most wave threat open: opens it as soon as it can, never closes it. */
function holdOpen(s: State) {
  if (s.phase !== 'combat' || s.dilated) return;
  const e = [...M.ENTRY_IDS].sort((a, b) => threat(s.wave, b) - threat(s.wave, a))[0];
  if (s.no >= CONFIG.no.openCost) toggleRoute(s, M.routesOf(e)[0]);
}

describe('Defend the Heart: organ levels', () => {
  it('there are six organs, each with its own map, waves and a full set of build sites', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['heart', 'lungs', 'brain', 'liver', 'kidney', 'spleen']);
    for (let i = 0; i < LEVELS.length; i++) {
      const s = newGame(i);
      expect(s.level).toBe(i);
      expect(s.heartHp).toBe(LEVELS[i].hp);
      expect(totalWaves(s)).toBe(LEVELS[i].waves.length);
      expect(M.ENTRY_IDS).toEqual(LEVELS[i].map.vessels.map((v) => v.id));
      expect(s.nodes.length).toBe(LEVELS[i].startingNodes.length);
      // every route has at least two sites guarding it (its own, or its fork's shared stem)
      for (const r of M.VESSEL_IDS) expect(guarding(r).length).toBeGreaterThanOrEqual(2);
      // every wave group names an entry vessel of this organ, and every entry is used by some wave
      const used = new Set<string>();
      for (const w of LEVELS[i].waves) for (const g of w.groups) { expect(M.ENTRY_IDS).toContain(g.vessel); used.add(g.vessel); }
      expect([...used].sort()).toEqual([...M.ENTRY_IDS].sort());
      // sites stay on the map and off the organ
      for (const x of M.SITES) { expect(map.organClearance(x)).toBeGreaterThan(60); expect(x.x).toBeGreaterThan(40); expect(x.y).toBeLessThan(960); }
    }
  });

  it('every site has a readable position label', () => {
    LEVELS.forEach((_, i) => {
      newGame(i);
      for (const x of M.SITES) expect(M.siteLabel(x), x.id).toMatch(/^site \d+ of \d+, (far out|midway|near the organ)$/);
    });
  });

  it('more build sites: at least five guarding each route (four on the kidney\'s short upper fork), two on the brain', () => {
    const atLeast = [5, 5, 2, 5, 4, 4];
    LEVELS.forEach((_, i) => {
      newGame(i);
      for (const r of M.VESSEL_IDS) {
        const n = guarding(r).length;
        if (i === 2) expect(n, `brain ${r}`).toBe(2); else expect(n, `${LEVELS[i].id} ${r}`).toBeGreaterThanOrEqual(atLeast[i]);
      }
    });
  });

  it('S. aureus comes in every organ; each organ uses only its own species', () => {
    const own: BacteriumType[][] = [['saureus'], ['saureus', 'spneumo', 'kpneumo'], ['saureus', 'spneumo', 'listeria', 'nmening'], ['saureus', 'ecoli', 'kpneumo'], ['saureus', 'ecoli'], ['saureus', 'spneumo', 'nmening', 'kpneumo']];
    LEVELS.forEach((l, i) => {
      const kinds = new Set(l.waves.flatMap((w) => w.groups.map((g) => g.type)).filter((x) => CONFIG.pathogens[x].taxon && !CONFIG.pathogens[x].boss));
      expect([...kinds].sort()).toEqual([...own[i]].sort());
    });
  });

  it('each organ has one more route than the last; forks only from the brain on', () => {
    const expected = [[4, 4, 0], [5, 5, 0], [5, 6, 1], [5, 7, 2], [5, 8, 3], [6, 9, 3]]; // entries, routes, forks
    LEVELS.forEach((_, i) => {
      newGame(i);
      const forks = M.ENTRY_IDS.filter((e) => M.routesOf(e).length === 2).length;
      expect([M.ENTRY_IDS.length, M.VESSEL_IDS.length, forks]).toEqual(expected[i]);
    });
  });

  it('every route ends at its organ, and routes of different vessels keep apart', () => {
    LEVELS.forEach((_, i) => {
      newGame(i);
      for (const r of M.VESSEL_IDS) {
        const pts = M.VESSELS[r].pts;
        // the heart's outline is not the map ellipse, so it gets more slack
        expect(map.organClearance(pts[pts.length - 1])).toBeLessThan(i === 0 ? 60 : 20);
        for (const o of M.VESSEL_IDS) {
          if (M.entryOf(o) === M.entryOf(r)) continue;
          // away from the organ (where every vessel converges), vessels stay at least 40 apart
          for (let d = 0; d < M.VESSELS[r].length; d += 10) {
            const q = M.pointAt(M.VESSELS[r], d);
            if (map.organClearance(q) < 60) continue;
            expect(map.nearestOnVessel(M.VESSELS[o], q).d).toBeGreaterThan(40);
          }
        }
      }
    });
  });

  it('lungs: on each inhale the blood surges and pathogens move faster', () => {
    const s = newGame(1); go(s, 'left'); quiet(s); s.cells = [];
    const sg = LEVELS[1].surge!;
    const p = mk(s, 'saureus', 'left', 50);
    s.waveTime = 0.5; const a = p.s; step(s, 0.1); const calm = p.s - a;
    expect(surging(s)).toBe(false);
    s.waveTime = sg.every - sg.length + 0.2; const b = p.s; step(s, 0.1); const surge = p.s - b;
    expect(surge / calm).toBeCloseTo(sg.factor, 1);
  });

  it('a vessel from another organ cannot be dilated', () => {
    const s = newGame(4); startWave(s);
    expect(toggleRoute(s, 'portal')).toBe(false);
    expect(s.dilated).toBeNull();
  });

  it('brain: at most two sites on any route, three white cells', () => {
    const s = newGame(2);
    for (const r of M.VESSEL_IDS) expect(guarding(r).length).toBeLessThanOrEqual(2);
    go(s, 'left');
    expect(aliveCells(s).length).toBe(3);
  });

  it('liver: regains health after a cleared wave, never above full', () => {
    const s = newGame(3); s.heartHp = 10; go(s, 'portal'); quiet(s); finishWave(s);
    expect(s.phase).toBe('prep');
    expect(s.heartHp).toBe(10 + LEVELS[3].regenPerWave!);
    const t = newGame(3); go(t, 'portal'); quiet(t); finishWave(t);
    expect(t.heartHp).toBe(LEVELS[3].hp);
  });

  it('kidney: pathogens are slowed on the filtered last stretch of a vessel', () => {
    const s = newGame(4); go(s, 'left'); quiet(s); s.cells = [];
    const L = M.VESSELS.lower.length;
    const far = mk(s, 'virus', 'lower', 40), near = mk(s, 'virus', 'lower', L * 0.9);
    expect(filtered(s, far)).toBe(false); expect(filtered(s, near)).toBe(true);
    const a = far.s, b = near.s; step(s, 0.05);
    expect((near.s - b) / (far.s - a)).toBeCloseTo(LEVELS[4].filtration!.factor, 2);
  });

  it('holding one vessel open, with the career player\'s upgrades at each organ, loses or ends at least 2 worse', () => {
    for (const r of careerRun()) {
      const good = play(sensibleBuild, sensibleDilate, 3, r.level, r.perks), hold = play(sensibleBuild, holdOpen, 3, r.level, r.perks);
      console.log(LEVELS[r.level].id, 'careful', good.s.heartHp, 'hold-open', hold.hp, hold.s.phase);
      expect(hold.s.phase === 'defeat' || hold.s.heartHp <= good.s.heartHp - 2, LEVELS[r.level].id).toBe(true);
    }
  });
});

describe('Defend the Heart: bosses', () => {
  const lastWave = (i: number) => LEVELS[i].waves[LEVELS[i].waves.length - 1];
  it('every organ ends with a boss wave holding exactly one boss, different for each organ', () => {
    const bosses = LEVELS.map((l, i) => {
      const b = lastWave(i).groups.filter((g) => CONFIG.pathogens[g.type].boss);
      expect(b.length).toBe(1); expect(b[0].count).toBe(1);
      for (const w of l.waves.slice(0, -1)) for (const g of w.groups) expect(CONFIG.pathogens[g.type].boss).toBeFalsy();
      return b[0].type;
    });
    expect(new Set(bosses).size).toBe(LEVELS.length);
  });

  function bossOn(level: number) {
    const s = newGame(level); s.wave = LEVELS[level].waves.length;
    const g = lastWave(level).groups.find((x) => CONFIG.pathogens[x.type].boss)!;
    go(s, M.VESSEL_IDS.find((v) => v !== g.vessel)!); s.nodes = []; s.cells = [];
    s.spawns = s.spawns.filter((x) => x.type === g.type);
    tick(s, 2.5);
    const b = activeBoss(s)!;
    expect(b).toBeTruthy();
    return { s, b };
  }

  it('heart: the staph colony bursts into bacteria', () => {
    const { s, b } = bossOn(0);
    hurt(s, b, 9999);
    expect(s.pathogens.filter((p) => p.type === 'saureus' && p.hp > 0).length).toBe(CONFIG.pathogens.colony.splitInto!.count);
  });

  it('lungs: the mother virus sheds new viruses as it travels', () => {
    const { s } = bossOn(1);
    tick(s, 6);
    expect(s.pathogens.filter((p) => p.type === 'virus').length).toBeGreaterThanOrEqual(2);
  });

  it('brain: meningococcus cannot be slowed by IgA', () => {
    const { s, b } = bossOn(2);
    const site = M.SITES.find((x) => x.vessel === b.vessel)!;
    s.nodes = [{ id: 999, site: site.id, vessel: b.vessel, type: 'iga', cd: 0, flash: 0, targets: [], wavesFought: 0 }];
    s.pathogens = [b]; b.s = 0;
    let best = 0, bd = Infinity;
    for (let d = 0; d < M.VESSELS[b.vessel].length; d += 4) { b.s = d; const dd = dist(pathogenPos(b), site); if (dd < bd) { bd = dd; best = d; } }
    b.s = best;
    const sp = CONFIG.pathogens.meningo.speed; CONFIG.pathogens.meningo.speed = 0;
    tick(s, 1.5);
    CONFIG.pathogens.meningo.speed = sp;
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(b.slow).toBe(1);
  });

  it('liver: the hepatitis giant heals over time', () => {
    const { s, b } = bossOn(3);
    b.hp = 100; tick(s, 2);
    expect(b.hp).toBeGreaterThan(100 + CONFIG.pathogens.hepatitis.regen! * 1.8);
  });

  it('kidney: the sepsis hijacker infects white cells and keeps going', () => {
    const { s, b } = bossOn(4);
    s.cells = [0, 1].map((i) => ({ id: 900 + i, vessel: b.vessel, s: b.s + 4 + i * 2, hp: 60, maxHp: 60, hit: 0, side: 0, targetId: null, mode: 'out' as const, infected: false }));
    tick(s, 0.2);
    expect(s.cells.every((c) => c.infected)).toBe(true);
    expect(b.hp).toBeGreaterThan(0);
    expect(s.pathogens.filter((p) => p.type === 'infected').length).toBe(2);
  });
});

describe('Defend the Heart: forking vessels', () => {
  // The heart, with its left vessel forking into an upper (A) and lower (B) branch on the way in.
  const ORIG = LEVELS[0];
  const FIXTURE: LevelDef = {
    ...ORIG, startingNodes: [],
    map: {
      ...ORIG.map,
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 500 }, { x: 170, y: 500 }, { x: 330, y: 460 }],
          fork: { branches: [
            { id: 'leftA', name: 'Left upper branch', label: 'Left upper', pts: [{ x: 460, y: 360 }, { x: 600, y: 380 }, { x: 700, y: 430 }] },
            { id: 'leftB', name: 'Left lower branch', label: 'Left lower', pts: [{ x: 470, y: 600 }, { x: 610, y: 590 }, { x: 710, y: 530 }] },
          ] } },
        ...ORIG.map.vessels.slice(1),
      ],
    },
  };
  const fixtureGame = () => newGame(0);
  beforeEach(() => { LEVELS[0] = FIXTURE; map.loadLevel(0); });
  afterEach(() => { LEVELS[0] = ORIG; map.loadLevel(0); });
  const undecided = (p: Pathogen) => Object.assign(p, { committed: false });
  const decided = (p: Pathogen) => Object.assign(p, { committed: true });

  it('a forked vessel becomes two routes sharing an identical stem', () => {
    expect(M.VESSEL_IDS).toEqual(['leftA', 'leftB', 'right', 'lower', 'upper']);
    expect(M.ENTRY_IDS).toEqual(['left', 'right', 'lower', 'upper']);
    expect(M.entryOf('leftB')).toBe('left'); expect(M.siblingOf('leftA')).toBe('leftB'); expect(M.siblingOf('right')).toBeNull();
    expect(M.routesOf('left')).toEqual(['leftA', 'leftB']);
    const f = M.forkAt('leftA'); expect(f).toBe(M.forkAt('leftB')); expect(f).toBeGreaterThan(300);
    for (const d of [0, f / 2, f - 1]) expect(dist(M.pointAt(M.VESSELS.leftA, d), M.pointAt(M.VESSELS.leftB, d))).toBeLessThan(0.01);
    expect(M.forkAt('right')).toBe(Infinity);
  });

  it('waves name the entry vessel; its pathogens spawn undecided on the stem', () => {
    const s = fixtureGame(); startWave(s); tick(s, 1.5);
    const p = s.pathogens.find((x) => M.entryOf(x.vessel) === 'left')!;
    expect(p).toBeTruthy(); expect(p.committed).toBe(false); expect(p.vessel).toBe('leftA');
  });

  it('pathogens take the branch that is not dilated', () => {
    const s = fixtureGame(); startWave(s); quiet(s); toggleRoute(s, 'leftA');
    const p = undecided(mk(s, 'saureus', 'leftA', M.forkAt('leftA') - 1)); tick(s, 0.5);
    expect(p.vessel).toBe('leftB'); expect(p.committed).toBe(true);
    const t = fixtureGame(); startWave(t); quiet(t); toggleRoute(t, 'leftB');
    const q = undecided(mk(t, 'saureus', 'leftA', M.forkAt('leftA') - 1)); tick(t, 0.5);
    expect(q.vessel).toBe('leftA');
  });

  it('with neither branch open they alternate, starting with A', () => {
    const s = fixtureGame(); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0); const f = M.forkAt('leftA');
    const ps = [0, 1, 2].map((i) => undecided(mk(s, 'virus', 'leftA', f - 1 - i * 0.5))); tick(s, 0.3);
    expect(ps.map((p) => p.vessel)).toEqual(['leftA', 'leftB', 'leftA']);
  });

  it('a committed pathogen keeps its branch when dilation changes', () => {
    const s = fixtureGame(); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0);
    const p = decided(mk(s, 'virus', 'leftA', M.forkAt('leftA') + 20)); toggleRoute(s, 'leftA'); tick(s, 0.2);
    expect(p.vessel).toBe('leftA');
  });

  it('a stem site guards both branches; a branch site only its own', () => {
    const s = fixtureGame();
    const stem = M.SITES.find((x) => x.stem && M.entryOf(x.vessel) === 'left')!;
    const branchB = M.SITES.find((x) => !x.stem && x.vessel === 'leftB')!;
    expect(stem).toBeTruthy(); expect(branchB).toBeTruthy();
    const onA = decided(mk(s, 'virus', 'leftA', M.forkAt('leftA') + 30));
    const onStem = undecided(mk(s, 'virus', 'leftA', M.forkAt('leftA') - 30));
    expect(covers(stem.vessel, onA, true)).toBe(true);
    expect(covers(branchB.vessel, onA)).toBe(false);
    expect(covers(branchB.vessel, onStem)).toBe(true);
    expect(covers('right', onStem)).toBe(false);
  });

  it('stem sites are not duplicated across the two routes, and only the forked vessel has stem sites', () => {
    const stems = M.SITES.filter((x) => x.stem);
    expect(stems.length).toBeGreaterThan(0);
    expect(stems.every((x) => M.entryOf(x.vessel) === 'left' && x.vessel === 'leftA')).toBe(true);
    expect(new Set(M.SITES.map((x) => x.id)).size).toBe(M.SITES.length);
  });

  it('cells on a branch engage undecided pathogens up the stem', () => {
    const s = fixtureGame(); startWave(s); quiet(s); toggleRoute(s, 'leftB'); endlessNo(s);
    const p = undecided(mk(s, 'saureus', 'leftA', M.forkAt('leftA') - 15)); const hp = p.hp;
    const speed = CONFIG.pathogens.saureus.speed; CONFIG.pathogens.saureus.speed = 0;
    tick(s, 12); CONFIG.pathogens.saureus.speed = speed;
    expect(p.hp).toBeLessThan(hp);
  });

  it('an infected cell made on the stem is undecided and chooses at the fork', () => {
    const s = fixtureGame(); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0); toggleRoute(s, 'leftB');
    const c = outCells(s)[0]; c.s = M.forkAt('leftB') - 30;
    infect(s, c, mk(s, 'hijacker', 'leftB', c.s));
    const e = s.pathogens.find((x) => x.type === 'infected')!;
    expect(e.committed).toBe(false); expect(M.entryOf(e.vessel)).toBe('left');
    tick(s, 2); expect(e.vessel).toBe('leftA');
  });

  it('a split or shed pathogen from a parent just past the fork stays on its branch', () => {
    const s = fixtureGame(); startWave(s); quiet(s);
    const b = decided(mk(s, 'colony', 'leftB', M.forkAt('leftB') + 4)); hurt(s, b, 9999);
    const kids = s.pathogens.filter((p) => p.type === 'saureus' && p.hp > 0);
    expect(kids.length).toBe(3); expect(kids.every((k) => k.vessel === 'leftB' && k.committed)).toBe(true);
    const t2 = fixtureGame(); startWave(t2); quiet(t2); mk(t2, 'saureus', 'upper', 0);
    const f = decided(mk(t2, 'flu', 'leftB', M.forkAt('leftB') + 3)); f.shedT = 0.01;
    const speed = CONFIG.pathogens.flu.speed; CONFIG.pathogens.flu.speed = 0; step(t2, 1 / 30); CONFIG.pathogens.flu.speed = speed;
    const v = t2.pathogens.find((p) => p.type === 'virus')!;
    expect(v).toBeTruthy(); expect(v.vessel).toBe('leftB'); expect(v.committed).toBe(true);
  });

  it('a split or shed pathogen on the stem is undecided and chooses at the fork', () => {
    const s = fixtureGame(); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0); toggleRoute(s, 'leftA');
    const b = undecided(mk(s, 'colony', 'leftA', M.forkAt('leftA') - 60)); hurt(s, b, 9999);
    const kids = s.pathogens.filter((p) => p.type === 'saureus' && p.vessel !== 'upper' && p.hp > 0);
    expect(kids.every((k) => !k.committed)).toBe(true);
    const f = undecided(mk(s, 'flu', 'leftA', M.forkAt('leftA') - 40)); f.shedT = 0.01; step(s, 1 / 30);
    const v = s.pathogens.find((p) => p.type === 'virus')!;
    expect(v.committed).toBe(false);
    tick(s, 3); expect(v.vessel).toBe('leftB');
  });

  it('a split pathogen made on a branch stays on that branch', () => {
    const s = fixtureGame(); startWave(s); quiet(s);
    const b = decided(mk(s, 'colony', 'leftB', M.forkAt('leftB') + 60)); hurt(s, b, 9999);
    const kids = s.pathogens.filter((p) => p.type === 'saureus' && p.hp > 0);
    expect(kids.length).toBe(3); expect(kids.every((k) => k.vessel === 'leftB' && k.committed)).toBe(true);
  });

  it('clicking the shared stem picks the open route, else branch A', () => {
    expect(M.routeAtStem('left', 'leftB')).toBe('leftB'); expect(M.routeAtStem('left', 'right')).toBe('leftA'); expect(M.routeAtStem('left', null)).toBe('leftA');
  });
});

describe('Defend the Heart: map labels', () => {
  // Palatino bold at 24px runs about 13 map units a character
  const widthOf = (text: string) => text.length * 13;
  const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const hitsCircle = (b: Box, c: { x: number; y: number }, r: number) => {
    const nx = Math.max(b.x, Math.min(c.x, b.x + b.w)), ny = Math.max(b.y, Math.min(c.y, b.y + b.h));
    return Math.hypot(nx - c.x, ny - c.y) < r;
  };
  for (let i = 0; i < LEVELS.length; i++) {
    it(`${LEVELS[i].title}: every vessel label (and its DILATED tag) clears the build sites, the other labels and the map edge`, () => {
      newGame(i);
      const labels = layoutLabels(widthOf);
      // one per vessel entering the map, plus one per branch of each fork
      expect(labels.length).toBe(M.ENTRY_IDS.length + M.ENTRY_IDS.filter((e) => M.routesOf(e).length > 1).length * 2);
      for (const l of labels) {
        for (const site of M.SITES) expect(hitsCircle(l.box, site, 32), `${l.text} over site ${site.id}`).toBe(false);
        expect(l.box.x).toBeGreaterThanOrEqual(0); expect(l.box.y).toBeGreaterThanOrEqual(0);
        expect(l.box.x + l.box.w).toBeLessThanOrEqual(M.W); expect(l.box.y + l.box.h).toBeLessThanOrEqual(M.H);
        for (const o of labels) if (o !== l) expect(overlaps(l.box, o.box), `${l.text} over ${o.text}`).toBe(false);
      }
    });
  }
});

describe('Defend the Heart: upgrades in play', () => {
  const perks = (over: Partial<Perks>): Perks => ({ ...NO_PERKS, ...over, dmg: { ...NO_PERKS.dmg, ...(over.dmg ?? {}) } });
  function hitOnce(s: State, type: NodeType, target: PathogenType, targets?: BacteriumType[]) {
    s.nodes = []; s.energy = 999;
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    expect(placeNode(s, site.id, type, targets)).toBe(true);
    go(s, 'right'); quiet(s); mk(s, 'saureus', 'upper', 0);
    const p = mk(s, target, 'left', 0);
    let sNear = 0, dmin = Infinity;
    for (let d = 0; d < M.VESSELS.left.length; d += 4) { p.s = d; const dd = dist(pathogenPos(p), site); if (dd < dmin) { dmin = dd; sNear = d; } }
    p.s = sNear; p.hp = p.maxHp = 1000;
    const speed = CONFIG.pathogens[target].speed; CONFIG.pathogens[target].speed = 0;
    let n = 0; while (p.hp === 1000 && n++ < 300) step(s, 1 / 30);
    CONFIG.pathogens[target].speed = speed;
    return 1000 - p.hp;
  }

  it('a new game has no upgrades: S. aureus is the only IgG target', () => {
    const s = newGame(0); const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    expect(s.perks).toEqual(NO_PERKS);
    expect(buildCheck(s, site.id, 'igg', ['ecoli']).reason).toBe('Unlock this target in Upgrades.');
    expect(buildCheck(s, site.id, 'igg', ['saureus']).ok).toBe(true);
  });
  it('a damage upgrade raises that node type\'s hits by 15% a level', () => {
    expect(hitOnce(newGame(0, perks({ dmg: { igm: 1.3 } as Perks['dmg'] })), 'igm', 'ecoli')).toBeCloseTo(13);
    expect(hitOnce(newGame(0, perks({ dmg: { igm: 1.3 } as Perks['dmg'] })), 'iga', 'ecoli')).toBeCloseTo(7.5);
  });
  it('dual-target IgG costs 80, takes two unlocked targets and hits with the better match', () => {
    const s = newGame(0, perks({ dual: true, targets: ['saureus', 'ecoli'] }));
    const site = M.SITES.find((x) => !nodeAt(s, x.id))!; s.energy = 100;
    expect(placeNode(s, site.id, 'igg', ['saureus', 'ecoli'])).toBe(true); expect(s.energy).toBe(100 - CONFIG.dualIggCost);
    expect(hitOnce(newGame(0, perks({ dual: true, targets: ['saureus', 'ecoli'] })), 'igg', 'kpneumo', ['saureus', 'ecoli'])).toBe(25);
    const n = newGame(0); expect(buildCheck(n, site.id, 'igg', ['saureus', 'ecoli']).reason).toBe('Dual-target IgG is an upgrade.');
  });
  it('an IgG node gains a second target for 30 once dual-target is bought', () => {
    const s = newGame(0, perks({ dual: true, targets: ['saureus', 'ecoli'] })); s.energy = 200;
    const site = M.SITES.find((x) => !nodeAt(s, x.id))!; placeNode(s, site.id, 'igg', ['saureus']);
    const e = s.energy; expect(retargetNode(s, site.id, ['saureus', 'ecoli'])).toBe(true);
    expect(s.energy).toBe(e - 30); expect(nodeAt(s, site.id)!.targets).toEqual(['saureus', 'ecoli']);
  });
  it('a dual-target node is re-aimed at two new targets for 20, keeping both', () => {
    const s = newGame(0, perks({ dual: true, targets: ['saureus', 'ecoli', 'kpneumo'] })); s.energy = 200;
    const site = M.SITES.find((x) => !nodeAt(s, x.id))!; placeNode(s, site.id, 'igg', ['saureus', 'ecoli']);
    const e = s.energy; expect(retargetNode(s, site.id, ['ecoli', 'kpneumo'])).toBe(true);
    expect(s.energy).toBe(e - CONFIG.iggRetarget); expect(nodeAt(s, site.id)!.targets).toEqual(['ecoli', 'kpneumo']);
  });

  it('cheaper first node halves only the first node each build phase', () => {
    const s = newGame(0, perks({ cheapFirst: true })); s.energy = 500;
    const free = M.SITES.filter((x) => !nodeAt(s, x.id));
    placeNode(s, free[0].id, 'igm'); expect(s.energy).toBe(500 - 30);
    placeNode(s, free[1].id, 'igm'); expect(s.energy).toBe(500 - 30 - 60);
    startWave(s); quiet(s); finishWave(s); const e = s.energy;
    placeNode(s, free[2].id, 'iga'); expect(s.energy).toBe(e - 25);
  });
  it('extra starting node places one more IgM', () => {
    const a = newGame(0), b = newGame(0, perks({ extraNode: true }));
    expect(b.nodes.length).toBe(a.nodes.length + 1); expect(b.nodes[b.nodes.length - 1].type).toBe('igm');
  });
  it('NO capacity perk raises the gauge and its refill cap', () => {
    const s = newGame(0, perks({ noMax: 140 })); expect(s.no).toBe(140);
    startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0); s.no = 139; tick(s, 2); expect(s.no).toBe(140);
  });
  it('perksOf(freshCareer()) is NO_PERKS', () => { expect(perksOf(freshCareer())).toEqual(NO_PERKS); });
});

describe('Defend the Heart: game speed', () => {
  it('the speed button steps through ×1, ×1.5, ×2 and ×3, then back to ×1', () => {
    expect(SPEEDS).toEqual([1, 1.5, 2, 3]);
    expect([nextSpeed(1), nextSpeed(1.5), nextSpeed(2), nextSpeed(3)]).toEqual([1.5, 2, 3, 1]);
    expect(nextSpeed(5)).toBe(1); // an unknown speed falls back to ×1
  });
  it('a frame at each speed moves the game on that many times as far', () => {
    for (const sp of SPEEDS) {
      const s = newGame(0); startWave(s); s.speed = sp;
      const t0 = s.waveTime; advance(s, 1 / 30);
      expect(s.waveTime - t0).toBeCloseTo(sp / 30, 6);
    }
  });
  it('a long frame at ×2 is split into small steps, never one big leap', () => {
    const s = newGame(0); startWave(s); quiet(s); s.speed = 2;
    const p = mk(s, 'saureus', 'left', 0); const t0 = s.waveTime;
    advance(s, 0.1);
    expect(s.waveTime - t0).toBeCloseTo(0.2, 6);
    expect(p.s).toBeCloseTo(CONFIG.pathogens.saureus.speed * 0.2, 3);
  });
});

describe('Defend the Heart: repeatable games', () => {
  it('the same game played the same way ends the same, every time', () => {
    const a = play(sensibleBuild, sensibleDilate, 3, 1), b = play(sensibleBuild, sensibleDilate, 3, 1);
    expect(b.hp).toEqual(a.hp);
    expect(b.s.killed).toBe(a.s.killed);
  });
  it('a different seed can play differently, but the same seed never does', () => {
    const x = newGame(0, NO_PERKS, 7), y = newGame(0, NO_PERKS, 7);
    startWave(x); startWave(y); tick(x, 5); tick(y, 5);
    expect(x.pathogens.map((p) => [p.side, p.wob])).toEqual(y.pathogens.map((p) => [p.side, p.wob]));
  });
});

describe('Defend the Heart: what leaked', () => {
  it('records the health each vessel and each pathogen cost', () => {
    const s = newGame(0); startWave(s); quiet(s);
    mk(s, 'saureus', 'lower', M.VESSELS.lower.length - 0.5); mk(s, 'virus', 'lower', M.VESSELS.lower.length - 1); mk(s, 'virus', 'upper', M.VESSELS.upper.length - 1);
    step(s, 1 / 30);
    expect(s.leaks.byVessel).toEqual({ lower: CONFIG.pathogens.saureus.heartDamage + CONFIG.pathogens.virus.heartDamage, upper: CONFIG.pathogens.virus.heartDamage });
    expect(s.leaks.byType).toEqual({ saureus: CONFIG.pathogens.saureus.heartDamage, virus: 2 * CONFIG.pathogens.virus.heartDamage });
  });
  it('leaks on a fork count against the vessel the player sees enter the map', () => {
    const s = newGame(2); startWave(s); quiet(s);
    const r = M.routesOf('lowerRight')[1]; mk(s, 'listeria', r, M.VESSELS[r].length - 1); step(s, 1 / 30);
    expect(Object.keys(s.leaks.byVessel)).toEqual(['lowerRight']);
  });
  it('the defeat tip says when its IgG target still has to be bought', () => {
    const s = newGame(4); s.leaks = { byVessel: { lower: 12 }, byType: { ecoli: 12 } };
    expect(leakSummary(s)!.advice).toMatch(/Unlock .*E\. coli.* in Upgrades/);
    const t = newGame(4, { ...NO_PERKS, targets: ['saureus', 'ecoli'] }); t.leaks = s.leaks;
    expect(leakSummary(t)!.advice).not.toMatch(/Unlock/);
  });

  it('the defeat summary names the worst vessel and pathogen and how to counter it', () => {
    const s = newGame(0);
    s.leaks = { byVessel: { lower: 9, left: 3 }, byType: { saureus: 9, virus: 3 } };
    const sum = leakSummary(s)!;
    if (sum.kind !== 'leak') throw new Error('expected a leak');
    expect(sum.vessel).toBe('lower'); expect(sum.type).toBe('saureus'); expect(sum.share).toBeCloseTo(0.75);
    expect(sum.advice).toMatch(/IgG aimed at S\. aureus/);
    s.leaks = { byVessel: { right: 5 }, byType: { virus: 5 } }; expect(leakSummary(s)!.advice).toMatch(/IgA/);
    s.leaks = { byVessel: { right: 5 }, byType: { infected: 5 } }; expect(leakSummary(s)!.advice).toMatch(/hijacker/i);
    s.leaks = { byVessel: {}, byType: {} }; expect(leakSummary(s)).toBeNull();
    // the spleen's remake cost counts too, and can be the main cause
    s.leaks = { byVessel: { left: 2 }, byType: { virus: 2 }, remade: 6 };
    const r = leakSummary(s)!; expect(r.kind).toBe('remake'); expect(r.share).toBeCloseTo(0.75); expect(r.advice).toMatch(/remade/);
    s.leaks = { byVessel: {}, byType: {}, remade: 3 }; expect(leakSummary(s)!.kind).toBe('remake');
    // a boss that is not a virus is not called one
    s.leaks = { byVessel: { left: 8 }, byType: { plasmodium: 8 } }; expect(leakSummary(s)!.advice).not.toMatch(/virus/);
  });
});

describe('Defend the Heart: the spleen', () => {
  const SPLEEN = 5;
  const outCell = (s: State) => { const v = M.VESSEL_IDS[0]; go(s, v); quiet(s); mk(s, 'saureus', M.VESSEL_IDS[1], 0); endlessNo(s); tick(s, 1); return outCells(s)[0]; };

  it('a lost white cell comes back 8 s later, and the 1 health is paid when it does', () => {
    const s = newGame(SPLEEN); const c = outCell(s); const n = s.cells.filter((x) => x.hp > 0 && !x.infected).length, hp = s.heartHp;
    c.hp = 0.01; mk(s, 'saureus', c.vessel, c.s); step(s, 1 / 30); // a bacterium finishes it off
    s.pathogens = s.pathogens.filter((p) => p.type !== 'saureus' || p.vessel !== c.vessel); mk(s, 'saureus', M.VESSEL_IDS[1], 0);
    expect(s.heartHp).toBe(hp);
    tick(s, 7.8); expect(s.cells.filter((x) => x.hp > 0 && !x.infected).length).toBe(n - 1); expect(s.heartHp).toBe(hp);
    tick(s, 0.4); expect(s.cells.filter((x) => x.hp > 0 && !x.infected).length).toBe(n); expect(s.heartHp).toBe(hp - 1);
    expect(s.leaks.remade).toBe(1);
  });
  it('a cell lost too late in a wave to be remade costs nothing', () => {
    const s = newGame(SPLEEN); const c = outCell(s); const hp = s.heartHp;
    infect(s, c, mk(s, 'hijacker', c.vessel, c.s)); s.pathogens = [];
    finishWave(s); expect(s.phase).toBe('prep'); expect(s.heartHp).toBe(hp); expect(s.leaks.remade ?? 0).toBe(0);
  });
  it('an infected cell is remade too', () => {
    const s = newGame(SPLEEN); const c = outCell(s); const n = aliveCells(s).length;
    infect(s, c, mk(s, 'hijacker', c.vessel, c.s));
    expect(aliveCells(s).length).toBe(n - 1); tick(s, 8.2); expect(aliveCells(s).length).toBe(n);
  });
  it('remaking a cell at 1 health loses the spleen, never below 0', () => {
    const s = newGame(SPLEEN); const c = outCell(s); s.heartHp = 1;
    infect(s, c, mk(s, 'hijacker', c.vessel, c.s)); s.pathogens = s.pathogens.filter((p) => p.type !== 'infected');
    tick(s, 8.2);
    expect(s.phase).toBe('defeat'); expect(s.heartHp).toBe(0);
  });
  it('other organs do not remake cells', () => {
    const s = newGame(0); const c = outCell(s); const hp = s.heartHp, n = aliveCells(s).length;
    infect(s, c, mk(s, 'hijacker', c.vessel, c.s)); s.pathogens = s.pathogens.filter((p) => p.type !== 'infected'); tick(s, 9);
    expect(aliveCells(s).length).toBe(n - 1); expect(s.heartHp).toBe(hp);
  });

  it('plasmodium is not a bacterium: IgG hits it at ×0.25', () => { expect(iggMultiplier(['saureus'], 'plasmodium')).toBe(0.25); });

  it('plasmodium hides for 2 s in every 6, and while hidden nothing hits it', () => {
    const s = newGame(SPLEEN); const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    s.nodes = [{ id: 999, site: site.id, vessel: site.vessel, type: 'igm', cd: 0, flash: 0, targets: [], wavesFought: 0 }];
    startWave(s); quiet(s); mk(s, 'saureus', site.vessel === M.VESSEL_IDS[0] ? M.VESSEL_IDS[1] : M.VESSEL_IDS[0], 0);
    const b = mk(s, 'plasmodium', site.vessel, 0); let best = 0, bd = Infinity;
    for (let d = 0; d < M.VESSELS[site.vessel].length; d += 4) { b.s = d; const dd = dist(pathogenPos(b), site); if (dd < bd) { bd = dd; best = d; } }
    b.s = best; const sp = CONFIG.pathogens.plasmodium.speed; CONFIG.pathogens.plasmodium.speed = 0;
    const { every, for: span } = CONFIG.pathogens.plasmodium.hides!;
    s.waveTime = every - span + 0.01; expect(hidden(s, b)).toBe(true);
    s.shots = []; const hp = b.hp; tick(s, span - 0.1); expect(b.hp).toBe(hp); expect(pulseTargets(s)).not.toContain(b);
    tick(s, 1.5); CONFIG.pathogens.plasmodium.speed = sp;
    expect(hidden(s, b)).toBe(false); expect(b.hp).toBeLessThan(hp);
  });
  it('white cells do not touch a hidden plasmodium, and it does not hurt them', () => {
    const s = newGame(SPLEEN); const c = outCell(s);
    const b = mk(s, 'plasmodium', c.vessel, c.s); const sp = CONFIG.pathogens.plasmodium.speed; CONFIG.pathogens.plasmodium.speed = 0;
    const { every, for: span } = CONFIG.pathogens.plasmodium.hides!; s.waveTime = every - span + 0.01;
    const hp = b.hp, chp = c.hp; tick(s, span - 0.2);
    expect(b.hp).toBe(hp); expect(c.hp).toBe(chp);
    tick(s, 3); CONFIG.pathogens.plasmodium.speed = sp;
    expect(b.hp).toBeLessThan(hp); // out of hiding, the cell walks back to it and fights
  });
  it('a remade white cell takes a side not already used by a living cell', () => {
    const s = newGame(SPLEEN); const c = outCell(s);
    const other = aliveCells(s).find((x) => x !== c)!;
    infect(s, c, mk(s, 'hijacker', c.vessel, c.s)); s.pathogens = s.pathogens.filter((p) => p.type !== 'infected');
    tick(s, 8.2);
    const fresh = aliveCells(s).find((x) => x !== other)!;
    expect(Math.sign(fresh.side)).not.toBe(Math.sign(other.side));
  });

  it('a shot in flight when the boss hides misses', () => {
    const s = newGame(SPLEEN); startWave(s); quiet(s); const v = M.VESSEL_IDS[0];
    const b = mk(s, 'plasmodium', v, 100); const hp = b.hp;
    s.shots = [{ type: 'igm', targets: [], vessel: v, x: 0, y: 0, sx: 0, sy: 0, targetId: b.id, t: 0, dur: 0.2 }];
    const { every, for: span } = CONFIG.pathogens.plasmodium.hides!; s.waveTime = every - span + 0.01;
    tick(s, 0.3); expect(b.hp).toBe(hp);
  });
  it('a hidden plasmodium that reaches the spleen still costs health', () => {
    const s = newGame(SPLEEN); startWave(s); quiet(s); const v = M.VESSEL_IDS[0];
    const { every, for: span } = CONFIG.pathogens.plasmodium.hides!; s.waveTime = every - span + 0.01;
    const hp = s.heartHp; mk(s, 'plasmodium', v, M.VESSELS[v].length - 0.1); step(s, 1 / 30);
    expect(s.heartHp).toBe(hp - CONFIG.pathogens.plasmodium.heartDamage);
  });
});

describe('Defend the Heart: organ images', () => {
  it('each organ, size and screen scale has its own image', () => {
    const keys = new Set(['heart', 'lungs', 'spleen'].flatMap((id) => [1, 1.5].map((px) => organCacheKey(id, 150, 210, px))));
    expect(keys.size).toBe(6);
    expect(organCacheKey('kidney', 130, 190, 1)).not.toBe(organCacheKey('kidney', 140, 190, 1));
  });
  it('the image scale follows the screen in half steps, never below ½ and never over 4096 px across', () => {
    expect(organImageScale(0.66)).toBe(0.5); expect(organImageScale(0.8)).toBe(1); expect(organImageScale(1.3)).toBe(1.5);
    expect(organImageScale(1.32)).toBe(organImageScale(1.4)); // small resizes don't rebuild it
    expect(organImageScale(40) * 840).toBeLessThanOrEqual(4096);
  });
});
