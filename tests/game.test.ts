import { describe, it, expect } from 'vitest';
import { CONFIG, LEVELS, type NodeType, type PathogenType, type VesselId } from '../src/config';
import * as map from '../src/level';
import { siteById, dist } from '../src/level';
// live bindings: always the currently loaded organ
const M = map;
import {
  newGame, toggleRoute, dilateCheck, outCells, pulseCheck, surging, activeBoss, filtered, totalWaves, canStartWave, startWave, step, firePulse, pulseTargets, aliveCells, cellPos, pathogenPos,
  waveSpawns, placeNode, buildCheck, nodeAt, hurt, effectiveArmour, type State, type Pathogen,
} from '../src/sim';

function tick(s: State, seconds: number, each?: (s: State) => void) { for (let t = 0; t < seconds; t += 1 / 30) { step(s, 1 / 30); each?.(s); } }
function finishWave(s: State, each?: (s: State) => void) { let n = 0; while ((s.phase === 'combat' || s.phase === 'recall') && n++ < 30 * 400) { step(s, 1 / 30); each?.(s); } }
function mk(s: State, type: PathogenType, vessel: VesselId, at: number): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: 0, wob: 0, shred: 0, shredT: 0, slow: 1, slowT: 0 };
  s.pathogens.push(p); return p;
}
/** Start the wave and open route v at once (home cells set out along it). */
function go(s: State, v: VesselId) { startWave(s); toggleRoute(s, v); }
/** Keep NO from running dry in tests that watch a long stretch of one open route. */
const endlessNo = (s: State) => { s.no = 1e9; };
function finishWaveUntil(s: State, phase: State['phase']) { let n = 0; while (s.phase !== phase && n++ < 30 * 400) step(s, 1 / 30); }
/** Leave only the given pathogens in play (no further spawns). */
function quiet(s: State) { s.spawns = []; s.pathogens = []; }

const threat = (n: number, v: VesselId) => waveSpawns(n).filter((x) => x.vessel === v).reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
const pulseAtCluster = (min: number) => (s: State) => { if (s.phase === 'combat' && s.pulsesLeft > 0 && pulseTargets(s).length >= min) firePulse(s); };

/** A sensible player: dilate the busiest vessel; spend energy on nodes for the other threatened vessels,
 *  IgG where bacteria come, IgA where viruses swarm, IgM otherwise; pulse into clusters. */
function sensibleBuild(s: State) {
  const n = s.wave;
  const ranked = [...M.VESSEL_IDS].sort((a, b) => threat(n, b) - threat(n, a));
  // spend energy round-robin on the threatened vessels, the undefended ones first
  const order = [...ranked.slice(1), ranked[0]].filter((v) => threat(n, v) > 0);
  for (let guard = 0; guard < 12; guard++) {
    let placed = false;
    for (const v of order) {
      const types = new Set(waveSpawns(n).filter((x) => x.vessel === v).map((x) => x.type));
      const want: NodeType = [...types].some((t) => CONFIG.pathogens[t].boss) && !nodeOn(s, v, 'ige') ? 'ige' : [...types].some((t) => CONFIG.pathogens[t].armour >= 5) && !nodeOn(s, v, 'igg') ? 'igg' : (types.has('virus') || types.has('hijacker')) && !nodeOn(s, v, 'iga') ? 'iga' : 'igm';
      const site = M.SITES.filter((x) => x.vessel === v && !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
      if (site && placeNode(s, site.id, want)) placed = true;
    }
    if (!placed) break;
  }
}
const nodeOn = (s: State, v: VesselId, t: NodeType) => s.nodes.some((x) => x.vessel === v && x.type === t);
/** Summed health of the pathogens on a route that are past 65% of the way in (where the cells meet them). */
const danger = (s: State, v: VesselId) => s.pathogens.filter((p) => p.hp > 0 && p.vessel === v && p.s > 0.65 * M.VESSELS[v].length).reduce((a, p) => a + p.hp, 0);
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
function play(prep: (s: State) => void, dilate: (s: State) => void = sensibleDilate, pulseMin = 3, level = 0) {
  const s = newGame(level); const hp: number[] = [];
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
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 10);
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
  it('running dry closes the route once, never goes negative, and sends the cells home', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 0.5); s.no = 0.1; step(s, 0.1);
    expect(s.no).toBe(0); expect(s.dilated).toBeNull(); expect(s.noOuts).toBe(1);
    expect(s.cells.every((c) => c.mode !== 'out')).toBe(true);
    step(s, 0.1); expect(s.noOuts).toBe(1);
  });
  it('cells go out along the opened route; reopening another waits for them to get home first', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 3);
    expect(outCells(s).every((c) => c.vessel === 'left' && c.s < M.VESSELS.left.length - 20)).toBe(true);
    toggleRoute(s, 'right'); step(s, 1 / 30);
    expect(s.cells.every((c) => c.vessel === 'left' && c.mode === 'returning')).toBe(true);
    tick(s, 3); expect(outCells(s).length).toBe(2); expect(outCells(s).every((c) => c.vessel === 'right')).toBe(true);
  });
  it('cells at home or returning neither fight nor get infected', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 0);
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

  it('the pulse never damages a pathogen on a resting vessel, even inside its radius', () => {
    const s = newGame(0); go(s, 'left'); quiet(s);
    const c = s.cells[0]; c.s = M.VESSELS.left.length - 2; s.cells = [c];
    const p = mk(s, 'virus', 'upper', M.VESSELS.upper.length - 4);
    const d = dist(pathogenPos(p), cellPos(c));
    const saved = CONFIG.immunePulse.radius; CONFIG.immunePulse.radius = d + 50;
    expect(pulseTargets(s).length).toBe(0);
    expect(firePulse(s)).toBe(0);
    CONFIG.immunePulse.radius = saved;
    expect(p.hp).toBe(CONFIG.pathogens.virus.hp);
  });

  it('the pulse comes from the cells: misses early, hits a cluster, works once', () => {
    const early = newGame(0); early.wave = 2; go(early, 'right'); tick(early, 1);
    expect(firePulse(early)).toBe(0);
    expect(firePulse(early)).toBe(-1);
    const s = newGame(0); s.wave = 2; go(s, 'right'); endlessNo(s);
    let hits = -1;
    tick(s, 30, (st) => { if (hits < 0 && pulseTargets(st).length >= 3) hits = firePulse(st); });
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(firePulse(s)).toBe(-1);
  });

  it('between waves: cells home, vessel contracts, choice and pulse reset, energy awarded; heart damage persists', () => {
    const s = newGame(0); go(s, 'right');
    const e0 = s.energy;
    finishWave(s);
    expect(s.phase).toBe('prep'); expect(s.wave).toBe(2);
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
    s.heartHp = 1; mk(s, 'bacterium', 'right', M.VESSELS.right.length - 1);
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
    expect(buildCheck(s, free.id, 'igg').ok).toBe(true);
    const e = s.energy;
    expect(placeNode(s, free.id, 'igg')).toBe(true);
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

describe('Defend the Heart: immunoglobulins', () => {
  function oneShot(type: NodeType, target: PathogenType) {
    const s = newGame(0); s.nodes = []; s.energy = 999;
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    placeNode(s, site.id, type);
    go(s, 'right'); quiet(s);
    const p = mk(s, target, 'left', 0);
    // park it right beside the node and let exactly one antibody land
    const best = [...Array(200).keys()].map((i) => i * M.VESSELS.left.length / 200).sort((a, b) => dist(M.VESSELS.left.pts[0], M.VESSELS.left.pts[0]) + Math.abs(a - b) * 0)[0];
    void best;
    let sNear = 0, dmin = Infinity;
    for (let d = 0; d < M.VESSELS.left.length; d += 4) { p.s = d; const dd = dist(pathogenPos(p), site); if (dd < dmin) { dmin = dd; sNear = d; } }
    p.s = sNear;
    const speed = CONFIG.pathogens[target].speed; CONFIG.pathogens[target].speed = 0;
    const hp0 = p.hp;
    let n = 0; while (p.hp === hp0 && n++ < 300) step(s, 1 / 30);
    CONFIG.pathogens[target].speed = speed;
    return { s, p, dmg: hp0 - p.hp };
  }

  it('IgM hits hardest; IgG and IgA hit softer', () => {
    const m = oneShot('igm', 'virus'), g = oneShot('igg', 'virus'), a = oneShot('iga', 'virus');
    expect(m.dmg).toBeGreaterThan(g.dmg);
    expect(m.dmg).toBeGreaterThan(a.dmg);
  });

  it('IgG strips armour so later hits land harder; IgM and IgA do not', () => {
    const g = oneShot('igg', 'bacterium');
    expect(effectiveArmour(g.p)).toBe(0);
    const before = g.p.hp; hurt(g.s, g.p, 15, true); expect(before - g.p.hp).toBe(15);
    const m = oneShot('igm', 'bacterium');
    expect(effectiveArmour(m.p)).toBe(CONFIG.pathogens.bacterium.armour);
    expect(m.dmg).toBe(CONFIG.nodes.igm.damage - CONFIG.pathogens.bacterium.armour);
    expect(oneShot('iga', 'bacterium').p.shred).toBe(0);
  });

  it('IgA slows what it hits; IgM and IgG do not', () => {
    expect(oneShot('iga', 'virus').p.slow).toBeLessThan(1);
    expect(oneShot('igm', 'virus').p.slow).toBe(1);
    expect(oneShot('igg', 'virus').p.slow).toBe(1);
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
  it('a sensible player (dilate the busiest vessel, build matching nodes, pulse clusters) wins', () => {
    const { s, hp } = play(sensibleBuild);
    console.log('sensible', hp, s.phase, 'energy left', s.energy, 'nodes', s.nodes.map((n) => n.type).join(','));
    expect(s.phase).toBe('victory');
  });

  it('never building any nodes loses', () => {
    const { s, hp } = play(noBuild);
    console.log('no building', hp, s.phase);
    expect(s.phase).toBe('defeat');
  });

  it('white cells alone cannot clear wave 1 without lymph nodes', () => {
    const s = newGame(0); s.nodes = []; startWave(s); finishWave(s, (st) => { sensibleDilate(st); pulseAtCluster(2)(st); });
    console.log('cells only wave 1:', s.heartHp);
    expect(s.heartHp).toBeLessThan(LEVELS[0].hp);
  });
});

describe('Defend the Heart: organ levels', () => {
  it('there are five organs, each with its own map, waves and a full set of build sites', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['heart', 'lungs', 'brain', 'liver', 'kidney']);
    for (let i = 0; i < LEVELS.length; i++) {
      const s = newGame(i);
      expect(s.level).toBe(i);
      expect(s.heartHp).toBe(LEVELS[i].hp);
      expect(totalWaves(s)).toBe(LEVELS[i].waves.length);
      expect(M.VESSEL_IDS).toEqual(LEVELS[i].map.vessels.map((v) => v.id));
      expect(s.nodes.length).toBe(LEVELS[i].startingNodes.length);
      for (const v of M.VESSEL_IDS) expect(M.SITES.filter((x) => x.vessel === v).length).toBe(LEVELS[i].map.siteFractions.length);
      // every wave only uses this organ's vessels
      for (const w of LEVELS[i].waves) for (const g of w.groups) expect(M.VESSEL_IDS).toContain(g.vessel);
      // sites stay on the map and off the organ
      for (const x of M.SITES) { expect(map.organClearance(x)).toBeGreaterThan(60); expect(x.x).toBeGreaterThan(40); expect(x.y).toBeLessThan(960); }
    }
  });

  it('lungs: on each inhale the blood surges and pathogens move faster', () => {
    const s = newGame(1); go(s, 'left'); quiet(s); s.cells = [];
    const sg = LEVELS[1].surge!;
    const p = mk(s, 'bacterium', 'left', 50);
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

  it('brain: two sites per vessel, three white cells', () => {
    const s = newGame(2);
    for (const v of M.VESSEL_IDS) expect(M.SITES.filter((x) => x.vessel === v).length).toBe(2);
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
    const L = M.VESSELS.upper.length;
    const far = mk(s, 'virus', 'upper', 40), near = mk(s, 'virus', 'upper', L * 0.9);
    expect(filtered(s, far)).toBe(false); expect(filtered(s, near)).toBe(true);
    const a = far.s, b = near.s; step(s, 0.05);
    expect((near.s - b) / (far.s - a)).toBeCloseTo(LEVELS[4].filtration!.factor, 2);
  });

  for (let i = 1; i < LEVELS.length; i++) {
    it(`${LEVELS[i].title}: a sensible player wins, and never building loses`, () => {
      const win = play(sensibleBuild, sensibleDilate, 3, i);
      console.log(LEVELS[i].id, 'sensible', win.hp, win.s.phase, 'nodes', win.s.nodes.map((n) => n.type).join(','));
      expect(win.s.phase).toBe('victory');
      const lose = play(noBuild, sensibleDilate, 3, i);
      console.log(LEVELS[i].id, 'no building', lose.hp, lose.s.phase);
      expect(lose.s.phase).toBe('defeat');
    });
  }
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
    expect(s.pathogens.filter((p) => p.type === 'bacterium' && p.hp > 0).length).toBe(CONFIG.pathogens.colony.splitInto!.count);
  });

  it('lungs: the mother virus sheds new viruses as it travels', () => {
    const { s } = bossOn(1);
    tick(s, 6);
    expect(s.pathogens.filter((p) => p.type === 'virus').length).toBeGreaterThanOrEqual(2);
  });

  it('brain: meningococcus cannot be slowed by IgA', () => {
    const { s, b } = bossOn(2);
    const site = M.SITES.find((x) => x.vessel === b.vessel)!;
    s.nodes = [{ id: 999, site: site.id, vessel: b.vessel, type: 'iga', cd: 0, flash: 0 }];
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

describe('Defend the Heart: the IgE boss-hunter node', () => {
  /** Heart level, a single node of `type` at left-1, a still boss and a still virus both within its reach. */
  function setup(type: NodeType) {
    const s = newGame(0); s.wave = 6; go(s, 'right'); quiet(s); s.cells = [];
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    s.nodes = [{ id: 999, site: site.id, vessel: 'left', type, cd: 0, flash: 0 }];
    // the two points on the vessel nearest the site
    const near: number[] = [];
    const probe = mk(s, 'virus', 'left', 0);
    let best = 0, bd = Infinity;
    for (let d = 0; d < M.VESSELS.left.length; d += 2) { probe.s = d; const dd = dist(pathogenPos(probe), site); if (dd < bd) { bd = dd; best = d; } }
    near.push(best - 30, best + 30);
    s.pathogens = [];
    const boss = mk(s, 'colony', 'left', near[0]);
    const virus = mk(s, 'virus', 'left', near[1]); // further along, so ordinary nodes would aim at it
    const saved = [CONFIG.pathogens.colony.speed, CONFIG.pathogens.virus.speed];
    CONFIG.pathogens.colony.speed = 0; CONFIG.pathogens.virus.speed = 0;
    return { s, boss, virus, restore: () => { [CONFIG.pathogens.colony.speed, CONFIG.pathogens.virus.speed] = saved; } };
  }

  it('locks onto a boss before a more advanced ordinary pathogen, and hits it through armour', () => {
    const { s, boss, virus, restore } = setup('ige');
    tick(s, 0.8); restore();
    expect(virus.hp).toBe(CONFIG.pathogens.virus.hp);
    expect(boss.maxHp - boss.hp).toBe(CONFIG.nodes.ige.bossDamage);
  });

  it('is weak against ordinary pathogens', () => {
    const { s, boss, virus, restore } = setup('ige');
    s.pathogens = [virus]; void boss;
    tick(s, 0.8); restore();
    expect(CONFIG.pathogens.virus.hp - virus.hp).toBe(CONFIG.nodes.ige.damage - CONFIG.pathogens.virus.armour);
    expect(CONFIG.nodes.ige.damage).toBeLessThan(CONFIG.nodes.iga.damage);
  });

  it('out-damages an IgM node on a boss, while IgM is better on ordinary pathogens', () => {
    const e = setup('ige'); e.s.pathogens = [e.boss]; tick(e.s, 10); e.restore();
    const m = setup('igm'); m.s.pathogens = [m.boss]; tick(m.s, 10); m.restore();
    expect(e.boss.maxHp - e.boss.hp).toBeGreaterThan(2 * (m.boss.maxHp - m.boss.hp));
    const ev = setup('ige'); ev.s.pathogens = [ev.virus]; ev.virus.hp = ev.virus.maxHp = 1000; tick(ev.s, 10); ev.restore();
    const mv = setup('igm'); mv.s.pathogens = [mv.virus]; mv.virus.hp = mv.virus.maxHp = 1000; tick(mv.s, 10); mv.restore();
    expect(1000 - mv.virus.hp).toBeGreaterThan(2 * (1000 - ev.virus.hp));
  });
});
