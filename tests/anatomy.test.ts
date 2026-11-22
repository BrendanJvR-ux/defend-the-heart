import { describe, it, expect } from 'vitest';
import { CONFIG, type NodeType, type PathogenType, type VesselId } from '../src/anatomy/config';
import { VESSELS, VESSEL_IDS, SITES, siteById, dist } from '../src/anatomy/level';
import {
  newGame, selectVessel, canStartWave, startWave, step, firePulse, pulseTargets, aliveCells, cellPos, pathogenPos,
  waveSpawns, placeNode, buildCheck, nodeAt, hurt, effectiveArmour, type State, type Pathogen,
} from '../src/anatomy/sim';

function tick(s: State, seconds: number, each?: (s: State) => void) { for (let t = 0; t < seconds; t += 1 / 30) { step(s, 1 / 30); each?.(s); } }
function finishWave(s: State, each?: (s: State) => void) { let n = 0; while ((s.phase === 'combat' || s.phase === 'recall') && n++ < 30 * 400) { step(s, 1 / 30); each?.(s); } }
function mk(s: State, type: PathogenType, vessel: VesselId, at: number): Pathogen {
  const st = CONFIG.pathogens[type];
  const p: Pathogen = { id: s.nextId++, type, vessel, s: at, hp: st.hp, maxHp: st.hp, hit: 0, side: 0, wob: 0, shred: 0, shredT: 0, slow: 1, slowT: 0 };
  s.pathogens.push(p); return p;
}
/** Leave only the given pathogens in play (no further spawns). */
function quiet(s: State) { s.spawns = []; s.pathogens = []; }

const threat = (n: number, v: VesselId) => waveSpawns(n).filter((x) => x.vessel === v).reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0);
const pulseAtCluster = (min: number) => (s: State) => { if (s.phase === 'combat' && s.pulsesLeft > 0 && pulseTargets(s).length >= min) firePulse(s); };

/** A sensible player: dilate the busiest vessel; spend energy on nodes for the other threatened vessels,
 *  IgG where bacteria come, IgA where viruses swarm, IgM otherwise; pulse into clusters. */
function sensibleBuild(s: State) {
  const n = s.wave;
  const ranked = [...VESSEL_IDS].sort((a, b) => threat(n, b) - threat(n, a));
  selectVessel(s, ranked[0]);
  // spend energy round-robin on the threatened vessels, the undefended ones first
  const order = [...ranked.slice(1), ranked[0]].filter((v) => threat(n, v) > 0);
  for (let guard = 0; guard < 12; guard++) {
    let placed = false;
    for (const v of order) {
      const types = new Set(waveSpawns(n).filter((x) => x.vessel === v).map((x) => x.type));
      const want: NodeType = types.has('bacterium') && !nodeOn(s, v, 'igg') ? 'igg' : (types.has('virus') || types.has('hijacker')) && !nodeOn(s, v, 'iga') ? 'iga' : 'igm';
      const site = SITES.filter((x) => x.vessel === v && !nodeAt(s, x.id)).sort((a, b) => b.index - a.index)[0];
      if (site && placeNode(s, site.id, want)) placed = true;
    }
    if (!placed) break;
  }
}
const nodeOn = (s: State, v: VesselId, t: NodeType) => s.nodes.some((x) => x.vessel === v && x.type === t);
function play(prep: (s: State) => void, pulseMin = 3) {
  const s = newGame(); const hp: number[] = [];
  while (s.phase === 'prep') { prep(s); startWave(s); finishWave(s, pulseAtCluster(pulseMin)); hp.push(s.heartHp); }
  return { s, hp };
}

describe('Defend the Heart: dilation, cells and the pulse', () => {
  it('a wave needs exactly one dilated vessel; choosing another replaces the first; locked in combat', () => {
    const s = newGame();
    expect(canStartWave(s).ok).toBe(false);
    selectVessel(s, 'left'); selectVessel(s, 'upper');
    expect(s.dilated).toBe('upper');
    tick(s, 1);
    expect(s.width.upper).toBeGreaterThan(0.9);
    for (const v of ['left', 'right', 'lower'] as VesselId[]) expect(s.width[v]).toBe(0);
    expect(startWave(s)).toBe(true);
    expect(selectVessel(s, 'left')).toBe(false);
  });

  it('all four vessels admit pathogens, nodes fire on their own vessel, only the dilated vessel carries white cells', () => {
    const s = newGame(); s.wave = 4; s.energy = 999;
    for (const v of VESSEL_IDS) { const site = SITES.find((x) => x.vessel === v && !nodeAt(s, x.id))!; placeNode(s, site.id, 'igm'); }
    selectVessel(s, 'lower'); startWave(s);
    const seen = new Set<string>(), shots = new Set<string>();
    tick(s, 30, (st) => {
      for (const p of st.pathogens) seen.add(p.vessel);
      for (const sh of st.shots) { shots.add(sh.vessel); expect(st.pathogens.find((p) => p.id === sh.targetId)?.vessel ?? sh.vessel).toBe(sh.vessel); }
      for (const c of st.cells) expect(c.vessel).toBe('lower');
    });
    expect([...seen].sort()).toEqual([...VESSEL_IDS].sort());
    expect([...shots].sort()).toEqual([...VESSEL_IDS].sort());
  });

  it('the pulse never damages a pathogen on a resting vessel, even inside its radius', () => {
    const s = newGame(); selectVessel(s, 'left'); startWave(s); quiet(s);
    const c = s.cells[0]; c.s = VESSELS.left.length - 2; s.cells = [c];
    const p = mk(s, 'virus', 'upper', VESSELS.upper.length - 4);
    const d = dist(pathogenPos(p), cellPos(c));
    const saved = CONFIG.immunePulse.radius; CONFIG.immunePulse.radius = d + 50;
    expect(pulseTargets(s).length).toBe(0);
    expect(firePulse(s)).toBe(0);
    CONFIG.immunePulse.radius = saved;
    expect(p.hp).toBe(CONFIG.pathogens.virus.hp);
  });

  it('the pulse comes from the cells: misses early, hits a cluster, works once', () => {
    const early = newGame(); early.wave = 2; selectVessel(early, 'right'); startWave(early); tick(early, 1);
    expect(firePulse(early)).toBe(0);
    expect(firePulse(early)).toBe(-1);
    const s = newGame(); s.wave = 2; selectVessel(s, 'right'); startWave(s);
    let hits = -1;
    tick(s, 30, (st) => { if (hits < 0 && pulseTargets(st).length >= 3) hits = firePulse(st); });
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(firePulse(s)).toBe(-1);
  });

  it('between waves: cells home, vessel contracts, choice and pulse reset, energy awarded; heart damage persists', () => {
    const s = newGame(); selectVessel(s, 'right'); startWave(s);
    const e0 = s.energy;
    finishWave(s);
    expect(s.phase).toBe('prep'); expect(s.wave).toBe(2);
    expect(s.dilated).toBeNull(); expect(s.cells.length).toBe(0); expect(s.pulsesLeft).toBe(0);
    for (const v of VESSEL_IDS) expect(s.width[v]).toBe(0);
    expect(s.energy).toBeGreaterThan(e0);
    const hp = s.heartHp;
    selectVessel(s, 'left'); startWave(s);
    expect(aliveCells(s).length).toBe(CONFIG.whiteCell.startingCount);
    expect(s.pulsesLeft).toBe(1);
    expect(s.heartHp).toBe(hp);
  });

  it('defeat at zero heart health; restart restores everything', () => {
    const s = newGame(); s.energy = 999; placeNode(s, 'lower-1', 'iga');
    selectVessel(s, 'left'); startWave(s);
    s.heartHp = 1; mk(s, 'bacterium', 'right', VESSELS.right.length - 1);
    tick(s, 0.2);
    expect(s.phase).toBe('defeat');
    const r = newGame();
    expect([r.heartHp, r.wave, r.dilated, r.energy, r.nodes.length]).toEqual([CONFIG.heartHp, 1, null, CONFIG.startEnergy, CONFIG.startingNodes.length]);
  });
});

describe('Defend the Heart: placing lymph nodes', () => {
  it('nodes are placed only between waves, on free sites, and cost energy', () => {
    const s = newGame();
    const free = SITES.find((x) => !nodeAt(s, x.id))!;
    expect(buildCheck(s, free.id, 'igg').ok).toBe(true);
    const e = s.energy;
    expect(placeNode(s, free.id, 'igg')).toBe(true);
    expect(s.energy).toBe(e - CONFIG.nodes.igg.cost);
    expect(placeNode(s, free.id, 'igm')).toBe(false); // occupied
    s.energy = 0;
    expect(placeNode(s, SITES.find((x) => !nodeAt(s, x.id))!.id, 'iga')).toBe(false); // too poor
    s.energy = 999; selectVessel(s, 'left'); startWave(s);
    expect(placeNode(s, SITES.find((x) => !nodeAt(s, x.id))!.id, 'iga')).toBe(false); // in combat
  });

  it('every vessel has several sites, each beside its own vessel', () => {
    for (const v of VESSEL_IDS) expect(SITES.filter((x) => x.vessel === v).length).toBeGreaterThanOrEqual(3);
    for (const x of SITES) { const a = siteById(x.id).anchor; expect(dist(x, a)).toBeLessThan(130); }
  });
});

describe('Defend the Heart: immunoglobulins', () => {
  function oneShot(type: NodeType, target: PathogenType) {
    const s = newGame(); s.nodes = []; s.energy = 999;
    const site = SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    placeNode(s, site.id, type);
    selectVessel(s, 'right'); startWave(s); quiet(s);
    const p = mk(s, target, 'left', 0);
    // park it right beside the node and let exactly one antibody land
    const best = [...Array(200).keys()].map((i) => i * VESSELS.left.length / 200).sort((a, b) => dist(VESSELS.left.pts[0], VESSELS.left.pts[0]) + Math.abs(a - b) * 0)[0];
    void best;
    let sNear = 0, dmin = Infinity;
    for (let d = 0; d < VESSELS.left.length; d += 4) { p.s = d; const dd = dist(pathogenPos(p), site); if (dd < dmin) { dmin = dd; sNear = d; } }
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
    const s = newGame(); selectVessel(s, 'left'); startWave(s); quiet(s);
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
    const s = newGame(); selectVessel(s, 'left'); startWave(s); quiet(s);
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
    const { s, hp } = play((st) => selectVessel(st, [...VESSEL_IDS].sort((a, b) => threat(st.wave, b) - threat(st.wave, a))[0]));
    console.log('no building', hp, s.phase);
    expect(s.phase).toBe('defeat');
  });

  it('white cells alone cannot clear wave 1 without lymph nodes', () => {
    const s = newGame(); s.nodes = []; selectVessel(s, 'left'); startWave(s); finishWave(s, pulseAtCluster(2));
    console.log('cells only wave 1:', s.heartHp);
    expect(s.heartHp).toBeLessThan(CONFIG.heartHp);
  });
});
