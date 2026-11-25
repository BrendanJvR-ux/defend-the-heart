import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CONFIG, LEVELS, BACTERIA, DIFFICULTIES, type BacteriumType, type LevelDef, type NodeType, type PathogenType } from '../src/config';
import * as map from '../src/level';
import { siteById, dist } from '../src/level';
import { layoutLabels, ROUTE_KEYS, type Box } from '../src/labels';
import { organCacheKey, organImageScale } from '../src/organCache';
import { inspectHtml } from '../src/inspect';
import { NO_PERKS, perksOf, freshCareer, snapshot, type Perks } from '../src/career';
// live bindings: always the currently loaded organ
const M = map;
import {
  newGame, toggleRoute, dilateCheck, openNeed, outCells, pulseCheck, covers, infect, surging, activeBoss, filtered, totalWaves, canStartWave, startWave, step, firePulse, pulseTargets, aliveCells, pathogenPos,
  placeNode, buildCheck, endlessWave, waveSpawns, resumeGame, nodeAt, hurt, hidden, iggMultiplier, retargetNode, advance, nextSpeed, SPEEDS, leakSummary, type State, type Pathogen,
  cancelNode, cancelCheck, stageLevel, stageMap, BOSSES, nodeCost, igeLife, buyNo, buyNoCheck, buyCell, buyCellCheck,
} from '../src/sim';

import {
  tick, finishWave, mk, go, endlessNo, finishWaveUntil, guarding, quiet, pulseAtCluster, sensibleBuild, sensibleDilate, noBuild, blindBuild, multiDilate, clumsyBuild, clumsyDilate, play, ALL_PERKS, careerRun, holdOpen,
} from './players';

describe('Defend the Heart: NO and mid-wave dilation', () => {
  it('a wave starts with every vessel resting and needs no choice', () => {
    const s = newGame(0); expect(canStartWave(s).ok).toBe(true); expect(startWave(s)).toBe(true);
    expect(s.open).toEqual([]); expect(s.no).toBe(CONFIG.no.max);
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
    toggleRoute(s, 'left'); expect(s.open).toEqual([]);
    const b = s.no; tick(s, 1); expect(s.no - b).toBeCloseTo(CONFIG.no.regenPerSec, 0);
  });
  it('a second vessel can be opened while there is a white cell for it; it costs and drains less than the first; too little NO refuses', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 10);
    toggleRoute(s, 'left'); toggleRoute(s, 'right');
    expect(s.open).toEqual(['left', 'right']); expect(s.no).toBe(CONFIG.no.max - CONFIG.no.openCost - CONFIG.no.extraOpenCost);
    const drain = CONFIG.no.drainPerSec + CONFIG.no.extraDrainPerSec;
    const a = s.no; tick(s, 1); expect(a - s.no).toBeGreaterThan(0.9 * drain); expect(a - s.no).toBeLessThan(1.1 * drain); // the second drains less
    // two white cells on the heart: a third vessel has no cell to send
    expect(toggleRoute(s, 'lower')).toBe(false); expect(dilateCheck(s, 'lower').reason).toMatch(/Every white cell already has a vessel/);
    toggleRoute(s, 'right'); s.no = CONFIG.no.openCost - 1; expect(toggleRoute(s, 'lower')).toBe(false); expect(s.open).toEqual(['left']);
    expect(dilateCheck(s, 'lower').reason).toBe('Not enough NO to open the lower vessel.');
  });
  it('with two vessels open the cells split, one each; closing one sends its cell to the other', () => {
    const s = newGame(0); startWave(s); quiet(s); s.nodes = []; s.no = 999; s.perks = { ...s.perks, noMax: 999 };
    const keep = mk(s, 'saureus', 'upper', 10); keep.slow = 0.0001; keep.slowT = 999; // keeps the wave going
    toggleRoute(s, 'left'); tick(s, 2);
    expect(outCells(s).filter((c) => c.vessel === 'left').length).toBe(2);
    toggleRoute(s, 'right'); tick(s, 6);
    expect(outCells(s).map((c) => c.vessel).sort()).toEqual(['left', 'right']);
    toggleRoute(s, 'right'); tick(s, 6);
    expect(outCells(s).map((c) => c.vessel)).toEqual(['left', 'left']);
  });
  it('on a fork, opening the other branch switches rather than opening both', () => {
    const s = newGame(2); startWave(s); quiet(s);
    const [a, b] = M.routesOf(M.ENTRY_IDS.find((e) => M.routesOf(e).length === 2)!);
    toggleRoute(s, a); toggleRoute(s, b);
    expect(s.open).toEqual([b]);
  });
  it('opening needs enough NO to stay open for a moment, not just the opening cost', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 0);
    const need = CONFIG.no.openCost + CONFIG.no.drainPerSec * CONFIG.no.minOpenSeconds;
    expect(openNeed()).toBe(need);
    s.no = need - 0.5;
    expect(toggleRoute(s, 'left')).toBe(false);
    expect(dilateCheck(s, 'left').reason).toBe('Not enough NO to open the left vessel.');
    s.no = need; expect(toggleRoute(s, 'left')).toBe(true);
    tick(s, CONFIG.no.minOpenSeconds * 0.9); expect(s.open).toEqual(['left']);
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
    expect(s.no).toBe(0); expect(s.open).toEqual([]); expect(s.noOuts).toBe(1);
    expect(s.cells.every((c) => c.mode !== 'out')).toBe(true);
    step(s, 0.1); expect(s.noOuts).toBe(1);
  });
  it('cells go out along the opened route; switching to another waits for them to get home first', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'saureus', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 3);
    expect(outCells(s).every((c) => c.vessel === 'left' && c.s < M.VESSELS.left.length - 20)).toBe(true);
    toggleRoute(s, 'left'); toggleRoute(s, 'right'); step(s, 1 / 30);
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
    expect(s.phase).toBe('prep'); expect(s.no).toBeCloseTo(50 + CONFIG.no.waveTopUp, 0); expect(s.open).toEqual([]);
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

  it('a pulse on a boss takes a quarter of its health, not all of it', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); for (const c of s.cells) { c.vessel = 'left'; c.mode = 'out'; }
    s.cells = [s.cells[0]]; s.cells[0].s = 400;
    const boss = mk(s, 'colony', 'left', 410);
    expect(firePulse(s)).toBe(1);
    expect(boss.hp).toBeCloseTo(boss.maxHp * (3 / 4), 5);
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
    expect(s.open).toEqual([]); expect(s.cells.length).toBe(0); expect(s.pulsesLeft).toBe(0);
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
    expect([r.heartHp, r.wave, r.open, r.energy, r.nodes.length]).toEqual([LEVELS[0].hp, 1, [], LEVELS[0].startEnergy, M.ENTRY_IDS.length]);
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
    for (const x of M.SITES) { const a = siteById(x.id).anchor; expect(dist(x, a)).toBeLessThan(150); }
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
  it('the bacteria, with their Gram stain and shape', () => {
    expect(BACTERIA).toEqual(['saureus', 'spneumo', 'listeria', 'nmening', 'ecoli', 'kpneumo', 'mtb', 'hpylori', 'salmonella', 'spyogenes', 'paeruginosa', 'chlamydia']);
    const tx = (b: BacteriumType) => { const x = CONFIG.pathogens[b].taxon!; return `${x.gram}${x.shape}`; };
    expect(BACTERIA.map(tx)).toEqual(['+coccus', '+coccus', '+rod', '-coccus', '-rod', '-rod', '+rod', '-rod', '-rod', '+coccus', '-rod', '-coccus']);
    for (const b of BACTERIA.slice(0, 6)) expect([CONFIG.pathogens[b].hp, CONFIG.pathogens[b].speed]).toEqual([70, 30]);
    // M. tuberculosis is slower and tougher
    expect(CONFIG.pathogens.mtb.hp).toBeGreaterThan(70); expect(CONFIG.pathogens.mtb.speed).toBeLessThan(30);
    // Salmonella is quicker and frailer; H. pylori is the one acid-proof bacterium
    expect(CONFIG.pathogens.salmonella.speed).toBeGreaterThan(30); expect(CONFIG.pathogens.salmonella.hp).toBeLessThan(70);
    expect(BACTERIA.filter((b) => CONFIG.pathogens[b].acidProof)).toEqual(['hpylori']);
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
  it('a hijacker that touches a white cell turns it into an infected enemy heading for the heart (with no lymph node to go for)', () => {
    const s = newGame(0); go(s, 'left'); quiet(s); s.nodes = [];
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

  it('from the liver on, energy is tight: the career player builds on at most 75% of the sites beyond the free IgMs', () => {
    for (const r of careerRun().filter((x) => x.level >= 3)) {
      const g = play(blindBuild, sensibleDilate, 3, r.level, r.perks); newGame(r.level);
      // the free IgM on each vessel isn't paid for, so it doesn't count: the share of the remaining sites built on
      const share = (g.s.nodes.length - M.ENTRY_IDS.length) / (M.SITES.length - M.ENTRY_IDS.length);
      console.log(LEVELS[r.level].id, 'built', g.s.nodes.length, 'of', M.SITES.length, 'sites');
      expect(share, LEVELS[r.level].id).toBeLessThanOrEqual(0.75);
    }
  }, 30000);

  it('for comparison: a career player who can see the waves coming (it wins every organ but perhaps the skin), and one who opens several vessels at once', () => {
    // the contract's career player can't see the waves; for comparison, one who can, and one who opens several vessels
    const sighted = careerRun(sensibleBuild), multi = careerRun(blindBuild, multiDilate);
    const show = (r: ReturnType<typeof careerRun>) => r.map((x) => `${LEVELS[x.level].id} ${x.phase === 'victory' ? x.hp[x.hp.length - 1] : 'lost'}`).join(', ');
    console.log('sighted career:', show(sighted));
    console.log('multi-vessel career:', show(multi));
    // the sighted player wins every organ up to the skin; there it builds for each wave's groups, and the wounds open
    // inside those defences, so it may fall (the blind career player, building round every vessel, does not)
    const skin = LEVELS.findIndex((l) => l.id === 'skin');
    expect(sighted.length).toBeGreaterThanOrEqual(skin + 1);
    expect(sighted.filter((x) => x.level !== skin).every((x) => x.phase === 'victory')).toBe(true); expect(multi[0].phase).toBe('victory');
  }, 60000);

  it('the difficulties are in order: Easy wins every organ, and each harder one clears no more organs and keeps no more health', () => {
    const runs = DIFFICULTIES.map((mode) => careerRun(blindBuild, sensibleDilate, { mode }));
    const cleared = runs.map((r) => r.filter((x) => x.phase === 'victory').length), kept = runs.map((r) => r.filter((x) => x.phase === 'victory').reduce((a, x) => a + x.hp[x.hp.length - 1], 0));
    console.log('difficulty careers:', DIFFICULTIES.map((d, i) => `${d} ${cleared[i]} organs, ${kept[i]} health`).join('; '));
    expect(cleared[0]).toBe(LEVELS.length); expect(cleared[1]).toBe(LEVELS.length);
    for (let i = 1; i < runs.length; i++) { expect(cleared[i]).toBeLessThanOrEqual(cleared[i - 1]); if (cleared[i] === cleared[i - 1]) expect(kept[i]).toBeLessThanOrEqual(kept[i - 1]); }
    expect(cleared[3]).toBeGreaterThanOrEqual(1); // even Brutal's first organ can be won
  }, 120000);
  it('no organ is on a cliff: with the career\'s upgrades, each is still won with 10% less or 10% more starting energy', () => {
    for (const r of careerRun()) for (const k of [0.9, 1.1]) {
      const L = LEVELS[r.level], keep = L.startEnergy;
      L.startEnergy = Math.round(keep * k);
      try { expect(play(blindBuild, sensibleDilate, 3, r.level, r.perks).s.phase, `${L.id} at ×${k}`).toBe('victory'); } finally { L.startEnergy = keep; }
    }
  }, 120000);
  it('holding gold back to spend during organs (white cells, NO) does no better than buying upgrades with it', () => {
    const score = (r: ReturnType<typeof careerRun>) => r.filter((x) => x.phase === 'victory').reduce((a, x) => a + 100 + x.hp[x.hp.length - 1], 0);
    const base = score(careerRun()), spenders = [0.3, 0.6].map((keep) => score(careerRun(blindBuild, sensibleDilate, { keep })));
    console.log('gold spent in organs:', base, 'with upgrades only;', spenders.join(', '), 'holding back 30% / 60%');
    for (const x of spenders) expect(x).toBeLessThanOrEqual(base);
  }, 120000);

  it('never building loses every organ, even with every upgrade', () => {
    for (let i = 0; i < LEVELS.length; i++) expect(play(noBuild, sensibleDilate, 3, i, ALL_PERKS).s.phase, LEVELS[i].id).toBe('defeat');
  });
});


describe('Defend the Heart: organ levels', () => {
  it('there are eleven organs, each with its own map, waves and a full set of build sites', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['heart', 'lungs', 'brain', 'liver', 'kidney', 'spleen', 'marrow', 'stomach', 'lymphnode', 'skin', 'eye']);
    for (let i = 0; i < LEVELS.length; i++) {
      const s = newGame(i);
      expect(s.level).toBe(i);
      expect(s.heartHp).toBe(LEVELS[i].hp);
      expect(totalWaves(s)).toBe(LEVELS[i].waves.length);
      expect(M.ENTRY_IDS).toEqual(LEVELS[i].map.vessels.map((v) => v.id));
      // one free IgM on every vessel, on its shared stem if it forks
      expect(s.nodes.length).toBe(M.ENTRY_IDS.length);
      expect(s.nodes.every((n) => n.type === 'igm')).toBe(true);
      expect(new Set(s.nodes.map((n) => M.entryOf(n.vessel))).size).toBe(M.ENTRY_IDS.length);
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
    const atLeast = [5, 5, 2, 5, 4, 4, 4, 4, 3, 3, 3]; // the lymph node's, skin's and eye's short branches have three
    LEVELS.forEach((_, i) => {
      newGame(i);
      for (const r of M.VESSEL_IDS) {
        const n = guarding(r).length;
        if (i === 2) expect(n, `brain ${r}`).toBe(3); else expect(n, `${LEVELS[i].id} ${r}`).toBeGreaterThanOrEqual(atLeast[i]);
      }
    });
  });

  it('S. aureus comes in every organ; each organ uses only its own species', () => {
    const own: BacteriumType[][] = [['saureus'], ['saureus', 'spneumo', 'kpneumo'], ['saureus', 'spneumo', 'listeria', 'nmening'], ['saureus', 'ecoli', 'kpneumo'], ['saureus', 'ecoli'], ['saureus', 'spneumo', 'nmening', 'kpneumo'], ['saureus', 'mtb', 'ecoli'], ['saureus', 'hpylori', 'salmonella'], ['saureus', 'spyogenes', 'ecoli'], ['saureus', 'spyogenes', 'paeruginosa'], ['saureus', 'chlamydia', 'paeruginosa']];
    LEVELS.forEach((l, i) => {
      const kinds = new Set(l.waves.flatMap((w) => w.groups.map((g) => g.type)).filter((x) => CONFIG.pathogens[x].taxon && !CONFIG.pathogens[x].boss));
      expect([...kinds].sort()).toEqual([...own[i]].sort());
    });
  });

  it('the routes rise to the lymph node (one more each organ), and forks come only from the brain on; the skin and eye have fewer', () => {
    const expected = [[4, 4, 0], [5, 5, 0], [5, 6, 1], [5, 7, 2], [5, 8, 3], [6, 9, 3], [6, 10, 4], [7, 11, 4], [7, 12, 5], [6, 10, 4], [5, 8, 3]]; // entries, routes, forks
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
    expect(s.open).toEqual([]);
  });

  it('brain: at most three sites on any route, three white cells', () => {
    const s = newGame(2);
    for (const r of M.VESSEL_IDS) expect(guarding(r).length).toBeLessThanOrEqual(3);
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

  it('holding one vessel open, with the career player\'s upgrades at each organ, loses or ends at least 2 worse (not the heart, the gentle tutorial organ, nor the eye, which has no white cells to send)', { timeout: 30000 }, () => {
    for (const r of careerRun().filter((x) => x.level > 0 && LEVELS[x.level].cells > 0)) {
      const good = play(blindBuild, sensibleDilate, 3, r.level, r.perks), hold = play(blindBuild, holdOpen, 3, r.level, r.perks);
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
    const s = fixtureGame(); startWave(s); quiet(s); s.nodes = []; mk(s, 'saureus', 'upper', 0); toggleRoute(s, 'leftB');
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
    const s = fixtureGame(); startWave(s); quiet(s); s.nodes = []; mk(s, 'saureus', 'upper', 0); toggleRoute(s, 'leftA');
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
    it(`${LEVELS[i].title}: every vessel label (and its DILATED tag) clears the build sites, the other labels and the map edge, and names its key`, () => {
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
      // every route's name carries the key that opens it (1 to 9, then 0, - and =), each once; a fork's stem has none
      const keys = labels.filter((l) => l.key).map((l) => l.key);
      expect(keys.sort()).toEqual(M.VESSEL_IDS.map((_, k) => ROUTE_KEYS[k]).sort());
      for (const l of labels) if (l.key) expect(ROUTE_KEYS.indexOf(l.key)).toBe(M.VESSEL_IDS.indexOf(l.v));
      // on a touch screen there are no keys to show
      expect(layoutLabels(widthOf, false).every((l) => !l.key)).toBe(true);
    });
  }
  it('on late endless stages too (longer vessels, more sites), every vessel label clears the sites, the other labels and the map edge', () => {
    for (const stage of [12, 22, 34]) for (let i = 0; i < LEVELS.length; i++) {
      newGame(i, NO_PERKS, undefined, stage);
      const labels = layoutLabels(widthOf);
      for (const l of labels) {
        for (const site of M.SITES) expect(hitsCircle(l.box, site, 32), `stage ${stage} ${LEVELS[i].id}: ${l.text} over site ${site.id}`).toBe(false);
        expect(l.box.x >= 0 && l.box.y >= 0 && l.box.x + l.box.w <= M.W && l.box.y + l.box.h <= M.H, `stage ${stage} ${LEVELS[i].id}: ${l.text} off the map`).toBe(true);
        for (const o of labels) if (o !== l) expect(overlaps(l.box, o.box), `stage ${stage} ${LEVELS[i].id}: ${l.text} over ${o.text}`).toBe(false);
      }
    }
  });
  it('every organ has at most 12 routes, so every route has a key', () => {
    for (let i = 0; i < LEVELS.length; i++) { newGame(i); expect(M.VESSEL_IDS.length, LEVELS[i].id).toBeLessThanOrEqual(ROUTE_KEYS.length); }
  });
});

describe('Defend the Heart: upgrades in play', () => {
  const perks = (over: Partial<Perks>): Perks => ({ ...NO_PERKS, ...over, dmg: { ...NO_PERKS.dmg, ...(over.dmg ?? {}) } });
  function hitOnce(s: State, type: NodeType, target: PathogenType, targets?: BacteriumType[], broad = false) {
    s.nodes = []; s.energy = 999;
    const site = M.SITES.find((x) => x.vessel === 'left' && x.index === 1)!;
    expect(placeNode(s, site.id, type, targets, broad)).toBe(true);
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
    expect(buildCheck(s, site.id, 'igg', ['ecoli']).reason).toBe('Unlock this target in Upgrades, or borrow it for this organ.');
    expect(buildCheck(s, site.id, 'igg', ['saureus']).ok).toBe(true);
  });
  it('a damage upgrade raises that node type\'s hits by 15% a level', () => {
    expect(hitOnce(newGame(0, perks({ dmg: { igm: 1.3 } as Perks['dmg'] })), 'igm', 'ecoli')).toBeCloseTo(13);
    expect(hitOnce(newGame(0, perks({ dmg: { igm: 1.3 } as Perks['dmg'] })), 'iga', 'ecoli')).toBeCloseTo(7.5);
  });
  it('broad IgG costs 60 and hits every bacterium of its target\'s Gram stain as one of the same shape (×2.5)', () => {
    const s = newGame(0, perks({ broad: true, targets: ['saureus', 'ecoli'] }));
    const site = M.SITES.find((x) => !nodeAt(s, x.id))!; s.energy = 100;
    expect(placeNode(s, site.id, 'igg', ['ecoli'], true)).toBe(true); expect(s.energy).toBe(100 - CONFIG.broadIggCost);
    expect(nodeAt(s, site.id)!.broad).toBe(true);
    // E. coli is a Gram− rod: N. meningitidis (Gram− coccus) counts as the same shape, S. aureus (Gram+) does not
    expect(iggMultiplier(['ecoli'], 'nmening', true)).toBe(2.5); expect(iggMultiplier(['ecoli'], 'nmening')).toBe(2);
    expect(iggMultiplier(['ecoli'], 'ecoli', true)).toBe(3); expect(iggMultiplier(['ecoli'], 'saureus', true)).toBe(0.5);
    expect(hitOnce(newGame(0, perks({ broad: true, targets: ['saureus', 'ecoli'] })), 'igg', 'nmening', ['ecoli'], true)).toBe(25);
    const n = newGame(0); expect(buildCheck(n, site.id, 'igg', ['saureus'], true).reason).toBe('Broad IgG is an upgrade.');
    expect(buildCheck(n, site.id, 'igg', ['saureus', 'ecoli']).reason).toBe('An IgG node aims at one target.');
  });
  it('a node placed since the last wave can be cancelled for everything paid; older nodes and the free IgMs cannot', () => {
    const s = newGame(0, perks({ targets: ['saureus', 'ecoli'], cheapFirst: true })); s.energy = 300;
    const [a, b] = M.SITES.filter((x) => !nodeAt(s, x.id));
    placeNode(s, a.id, 'igm'); placeNode(s, b.id, 'igg', ['saureus']); // the first at half price
    retargetNode(s, b.id, ['ecoli']);
    expect(s.energy).toBe(300 - 30 - 50 - CONFIG.iggRetarget);
    expect(cancelNode(s, b.id)).toBe(50 + CONFIG.iggRetarget); expect(nodeAt(s, b.id)).toBeUndefined();
    expect(cancelNode(s, a.id)).toBe(30); expect(s.discountUsed).toBe(false); // the discount is back for the next node
    expect(s.energy).toBe(300);
    const free = s.nodes[0]; expect(cancelCheck(s, free.site).ok).toBe(false);
    placeNode(s, a.id, 'igm'); startWave(s); quiet(s); finishWave(s);
    expect(cancelCheck(s, a.id).reason).toBe('Only a node placed since the last wave can be cancelled.');
  });
  it('a cancellable node survives a save and reload', () => {
    const s = newGame(0); const a = M.SITES.find((x) => !nodeAt(s, x.id))!; placeNode(s, a.id, 'igm');
    const r = resumeGame(snapshot(s)); expect(cancelNode(r, a.id)).toBe(CONFIG.nodes.igm.cost);
  });

  it('cheaper first node halves only the first node each build phase', () => {
    const s = newGame(0, perks({ cheapFirst: true })); s.energy = 500;
    const free = M.SITES.filter((x) => !nodeAt(s, x.id));
    placeNode(s, free[0].id, 'igm'); expect(s.energy).toBe(500 - 30);
    placeNode(s, free[1].id, 'igm'); expect(s.energy).toBe(500 - 30 - 60);
    startWave(s); quiet(s); finishWave(s); const e = s.energy;
    placeNode(s, free[2].id, 'iga'); expect(s.energy).toBe(e - CONFIG.nodes.iga.cost / 2);
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
    expect(p.s).toBeCloseTo(CONFIG.pathogens.saureus.speed * (LEVELS[0].handicap.speed ?? 1) * 0.2, 3);
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

describe('Defend the Heart: the bone marrow', () => {
  const MARROW = LEVELS.findIndex((l) => l.id === 'marrow');
  it('starts with two white cells and makes one more for every cleared wave, up to five', () => {
    const counts: number[] = [];
    for (let w = 1; w <= LEVELS[MARROW].waves.length; w++) { const s = newGame(MARROW); s.wave = w; startWave(s); counts.push(s.cells.length); }
    expect(counts).toEqual([2, 3, 4, 5, 5]);
  });
  it('the granuloma takes a quarter damage until its wall has taken 40 antibody strikes', () => {
    const s = newGame(MARROW); go(s, 'topMid'); quiet(s);
    const b = mk(s, 'granuloma', 'topMid', 100), wall = CONFIG.pathogens.granuloma.walled!;
    hurt(s, b, 40, true); expect(b.hp).toBe(b.maxHp - 40 * wall.factor);
    hurt(s, b, 40); expect(b.wallHits).toBe(1); // a white cell's steady fighting does not chip it
    for (let i = 1; i < wall.hits; i++) hurt(s, b, 0, true);
    const hp = b.hp; hurt(s, b, 40, true); expect(b.hp).toBe(hp - 40);
  });
  it('a pulse breaks the granuloma\'s wall at once and takes a quarter of its health', () => {
    const s = newGame(MARROW); go(s, 'topMid'); quiet(s);
    for (const c of s.cells) { c.vessel = 'topMid'; c.mode = 'out'; }
    s.cells = [s.cells[0]]; s.cells[0].s = 300;
    const b = mk(s, 'granuloma', 'topMid', 310);
    expect(firePulse(s)).toBe(1);
    expect(b.wallHits).toBe(CONFIG.pathogens.granuloma.walled!.hits);
    expect(b.hp).toBeCloseTo(b.maxHp * (3 / 4), 5);
  });
});

describe('Defend the Heart: endless mode', () => {
  it('stage n is organ after organ from the heart, round again after the eye; each stage winds longer and adds sites', () => {
    expect([1, 2, 11, 12, 13].map(stageLevel)).toEqual([0, 1, 10, 0, 1]);
    const lens = [1, 3, 6].map((k) => { newGame(stageLevel(1), NO_PERKS, undefined, k); return [M.VESSELS.left.length, M.SITES.length]; });
    expect(lens[1][0]).toBeGreaterThan(lens[0][0] * 1.08); expect(lens[2][0]).toBeGreaterThan(lens[1][0] * 1.1);
    expect(lens[1][1]).toBeGreaterThan(lens[0][1]); expect(lens[2][1]).toBeGreaterThan(lens[1][1]);
    expect(stageMap(100).wind).toBe(CONFIG.endless.maxWind);
  });
  it('a stage\'s waves are its organ\'s own, larger each stage, with bosses at random on some (more as stages go on)', () => {
    const L = LEVELS[0], k = 1 + CONFIG.endless.countGrowth * 4;
    const w = endlessWave(0, 1, 5), base = L.waves[0];
    base.groups.forEach((g, i) => expect(w.groups[i].count).toBe(Math.max(1, Math.round(g.count * k))));
    const bossesIn = (stage: number) => L.waves.slice(0, -1).filter((_, i) => endlessWave(0, i + 1, stage).groups.length > L.waves[i].groups.length).length;
    expect(bossesIn(1)).toBe(CONFIG.endless.bosses); expect(bossesIn(5)).toBeGreaterThan(bossesIn(1));
    // the same stage always brings the same bosses; a wave with one says which, up which vessel, and what it does
    expect(JSON.stringify(endlessWave(3, 2, 7))).toBe(JSON.stringify(endlessWave(3, 2, 7)));
    const withBoss = L.waves.slice(0, -1).map((_, i) => endlessWave(0, i + 1, 1)).find((w, i) => w.groups.length > L.waves[i].groups.length)!;
    const boss = CONFIG.pathogens[withBoss.groups.at(-1)!.type];
    expect(withBoss.hint).toContain(`the ${boss.name.toLowerCase()}, up the`); expect(withBoss.hint).toContain(boss.blurb!);
    // no boss is described as if it were in one organ only
    for (const t of BOSSES) expect(CONFIG.pathogens[t].blurb, t).not.toMatch(/stomach|portal vein/);
  });
  it('a stage ends in victory like an organ; pathogens are tougher each stage', () => {
    const s = newGame(0, NO_PERKS, undefined, 3);
    for (let w = 1; w <= LEVELS[0].waves.length; w++) { startWave(s); quiet(s); finishWave(s); }
    expect(s.phase).toBe('victory');
    const t = newGame(0, NO_PERKS, undefined, 3); startWave(t); tick(t, 4);
    const p = t.pathogens[0]; expect(p.maxHp).toBe(Math.round(CONFIG.pathogens[p.type].hp * (LEVELS[0].handicap.hp ?? 1) * (1 + CONFIG.endless.hpGrowth * 2)));
  });
  it('with the career\'s upgrades, an endless run clears at least eight stages, and ends', { timeout: 120000 }, () => {
    const perks = careerRun().at(-1)!.perks;
    let stage = 1, s = newGame(stageLevel(1), perks, undefined, 1);
    while (stage <= 40) {
      while (s.phase === 'prep') { blindBuild(s); startWave(s); finishWave(s, (st) => { sensibleDilate(st); pulseAtCluster(3)(st); }); }
      if (s.phase !== 'victory') break;
      stage++; s = newGame(stageLevel(stage), perks, undefined, stage);
    }
    console.log(`endless: fell on stage ${stage} (${LEVELS[s.level].id}), ${stage - 1} cleared`);
    expect(stage - 1).toBeGreaterThanOrEqual(8); expect(stage).toBeLessThanOrEqual(30);
  });
  it('an endless stage is saved and continued as that stage', () => {
    const s = newGame(2, NO_PERKS, undefined, 14); s.wave = 3;
    const r = resumeGame(snapshot(s));
    expect([r.endless, r.stage, r.wave, M.SITES.length]).toEqual([true, 14, 3, (newGame(2, NO_PERKS, undefined, 14), M.SITES.length)]);
  });
});

describe('Defend the Heart: the new rules', () => {
  it('every vessel runs half as long again as its corner points, measured along its winding course', () => {
    newGame(0);
    for (const v of M.VESSEL_IDS) {
      const ves = M.VESSELS[v]; let corners = 0; for (let i = 1; i < ves.pts.length; i++) corners += dist(ves.pts[i - 1], ves.pts[i]);
      expect(ves.length / corners, v).toBeGreaterThan(1.4); expect(ves.length / corners, v).toBeLessThan(1.6);
      // and its course is that long: consecutive points STEP apart along it
      let course = 0; for (let d = 4; d <= ves.length; d += 4) course += dist(M.pointAt(ves, d - 4), M.pointAt(ves, d));
      expect(Math.abs(course - ves.length) / ves.length).toBeLessThan(0.02);
    }
  });
  it('every organ has a feature and a slight disadvantage of its own', () => {
    for (const L of LEVELS) { expect(L.feature.length, L.id).toBeGreaterThan(5); expect(L.handicap.text.length, L.id).toBeGreaterThan(10); expect(Object.keys(L.handicap).length, L.id).toBeGreaterThan(1); }
    expect(new Set(LEVELS.map((l) => l.handicap.text)).size).toBe(LEVELS.length);
  });
  it('handicaps change the rules: the liver\'s nodes cost 5 more, the marrow\'s IgE lasts a wave less, the heart\'s pathogens are faster', () => {
    const liver = newGame(3); expect(nodeCost(liver, 'igm')).toBe(CONFIG.nodes.igm.cost + 5);
    const marrow = newGame(6); expect(igeLife(marrow)).toBe((CONFIG.nodes.ige.burnsOutAfter ?? 3) - 1);
    const heart = newGame(0); quiet(heart); heart.phase = 'combat'; const p = mk(heart, 'saureus', 'left', 10);
    tick(heart, 1); expect((p.s - 10) / CONFIG.pathogens.saureus.speed).toBeCloseTo(1.05, 1);
  });
  it('the difficulty scales pathogen health, group sizes and starting energy', () => {
    const hard = { ...NO_PERKS, mode: 'brutal' as const }, D = CONFIG.difficulty.brutal;
    expect(newGame(1, hard).energy).toBe(Math.round(LEVELS[1].startEnergy * D.energy));
    const n = waveSpawns(1, 1).length, m = waveSpawns(1, 1, 0, 'brutal').length; expect(m).toBeGreaterThan(n);
    const s = newGame(1, hard); startWave(s); tick(s, 4);
    const p = s.pathogens[0]; expect(p.maxHp).toBe(Math.round(CONFIG.pathogens[p.type].hp * D.hp * (LEVELS[1].handicap.hp ?? 1)));
  });
  it('gold buys NO at once (past the top, up to one purchase over) and white cells for the rest of the organ', () => {
    const s = newGame(1); expect(buyNo(s)).toBe(true); expect(s.no).toBe(s.perks.noMax + CONFIG.goldBuys.no.amount);
    expect(buyNoCheck(s).ok).toBe(false);
    for (let i = 0; i < CONFIG.goldBuys.cell.max; i++) expect(buyCell(s)).toBe(true);
    expect(buyCell(s)).toBe(false);
    startWave(s); expect(s.cells.length).toBe(LEVELS[1].cells + CONFIG.goldBuys.cell.max);
    const eye = newGame(10); expect(buyCellCheck(eye).reason).toBe('No white cells come to the eye.');
    // NO above the top is not trimmed by the refill
    const t = newGame(1); buyNo(t); startWave(t); quiet(t); tick(t, 2); expect(t.no).toBe(t.perks.noMax + CONFIG.goldBuys.no.amount);
  });
  it('a bought white cell joins a wave in progress at once', () => {
    const s = newGame(1); startWave(s); const before = s.cells.length; buyCell(s); expect(s.cells.length).toBe(before + 1);
  });
  it('a jumping virus jumps once, a third of the way in, to a route of another vessel, as far along it', () => {
    const s = newGame(7); quiet(s); s.phase = 'combat';
    const p = mk(s, 'jumper', M.VESSEL_IDS[0], M.VESSELS[M.VESSEL_IDS[0]].length * 0.34), from = p.vessel;
    p.hp = p.maxHp = 1e6; tick(s, 1);
    expect(p.jumped).toBe(true); expect(M.entryOf(p.vessel)).not.toBe(M.entryOf(from));
    expect(p.s / M.VESSELS[p.vessel].length).toBeGreaterThan(0.33); expect(p.s / M.VESSELS[p.vessel].length).toBeLessThan(0.5);
    const v = p.vessel; tick(s, 3); expect(p.vessel).toBe(v); // once only
  });
  it('M. tuberculosis that reaches the organ lodges: 2 health at every wave\'s end until the organ ends', () => {
    const s = newGame(6); startWave(s); quiet(s);
    const v = M.VESSEL_IDS[0], p = mk(s, 'mtb', v, M.VESSELS[v].length - 1); p.hp = 999;
    mk(s, 'saureus', M.VESSEL_IDS[1], 0); // keeps the wave going
    tick(s, 0.2);
    expect(s.lodged.mtb).toBe(1);
    const hp = s.heartHp; quiet(s); finishWave(s); expect(s.heartHp).toBe(hp - 2);
    startWave(s); quiet(s); finishWave(s); expect(s.heartHp).toBe(hp - 4);
  });
  it('in the stomach, H. pylori hits twice as hard and lodges (1 a wave); elsewhere it does neither', () => {
    const s = newGame(7); startWave(s); quiet(s);
    const hp = s.heartHp, p = mk(s, 'hpylori', M.VESSEL_IDS[0], M.VESSELS[M.VESSEL_IDS[0]].length - 1); p.hp = 999;
    mk(s, 'saureus', M.VESSEL_IDS[1], 0); // keeps the wave going
    tick(s, 0.2);
    expect(hp - s.heartHp).toBe(2 * CONFIG.pathogens.hpylori.heartDamage); expect(s.lodged.hpylori).toBe(1);
    const h = s.heartHp; quiet(s); finishWave(s); expect(s.heartHp).toBe(h - 1);
    const o = newGame(0); startWave(o); quiet(o); const q = mk(o, 'hpylori', 'left', M.VESSELS.left.length - 1); q.hp = 999; tick(o, 0.2);
    expect(o.lodged.hpylori).toBeUndefined(); expect(o.heartHp).toBe(LEVELS[0].hp - CONFIG.pathogens.hpylori.heartDamage);
  });
  it('a white cell taken over by a hijacker goes for the nearest lymph node on its vessel and knocks it out for the wave', () => {
    const s = newGame(1); startWave(s); quiet(s);
    const node = s.nodes.find((n) => M.entryOf(n.vessel) === 'left')!, site = siteById(node.site);
    const c = s.cells[0]; c.vessel = node.vessel; c.s = site.at + 60; c.mode = 'out';
    const h = mk(s, 'hijacker', node.vessel, c.s); h.hp = 1;
    s.nodes = s.nodes.filter((n) => n === node); // no other node to shoot it
    node.cd = 999;
    tick(s, 0.1);
    const inf = s.pathogens.find((p) => p.type === 'infected')!; expect(inf.goalSite).toBe(node.site);
    inf.hp = 1e6; tick(s, 6);
    expect(nodeAt(s, node.site)!.off).toBe(true); expect(inf.hp).toBe(0);
    s.pathogens = []; finishWave(s); startWave(s); expect(nodeAt(s, node.site)!.off).toBe(false); // back next wave
  });
  it('a pathogen\'s card tells its new tricks: the jump, lodging, double damage in the stomach, the node an infected cell is after', () => {
    const s = newGame(7); startWave(s); quiet(s);
    const j = mk(s, 'jumper', M.VESSEL_IDS[0], 10);
    expect(inspectHtml(s, j)).toContain('Leaps once to another vessel');
    const h = mk(s, 'hpylori', M.VESSEL_IDS[0], 10), card = inspectHtml(s, h);
    expect(card).toContain('Lodges'); expect(card).toContain(`Organ damage</b> ${2 * CONFIG.pathogens.hpylori.heartDamage}`);
    const t = mk(s, 'mtb', M.VESSEL_IDS[0], 10); expect(inspectHtml(s, t)).toContain('Lodges');
    const inf = mk(s, 'infected', s.nodes[0].vessel, 10); inf.goalSite = s.nodes[0].site;
    expect(inspectHtml(s, inf)).toContain('Going for the lymph node');
    const heart = newGame(0); expect(inspectHtml(heart, mk(heart, 'hpylori', 'left', 10))).not.toContain('Lodges'); // only in the stomach
  });
  it('the boss of the brain is stronger; every boss wave\'s bosses carry 55% of their health each', () => {
    expect(CONFIG.pathogens.meningo.hp).toBe(400); expect(CONFIG.bossEveryVessel.hpShare).toBe(0.55);
  });
});

describe('Defend the Heart: the kidney', () => {
  it('pathogens come tougher each wave: health ×(1 + 0.2 × waves before)', () => {
    const K = LEVELS.findIndex((l) => l.id === 'kidney');
    for (const w of [1, 3, 5]) {
      const s = newGame(K); s.wave = w; startWave(s); tick(s, 4);
      const p = s.pathogens.find((x) => !CONFIG.pathogens[x.type].boss)!; // as the wave spawns it
      expect(p.maxHp).toBe(Math.round(CONFIG.pathogens[p.type].hp * (1 + LEVELS[K].waveHpGrowth! * (w - 1))));
    }
  });
});

describe('Defend the Heart: the skin and the eye', () => {
  const SKIN = LEVELS.findIndex((l) => l.id === 'skin'), EYE = LEVELS.findIndex((l) => l.id === 'eye');
  it('skin: each group comes in through a wound partway along its vessel; bosses still come from the edge', () => {
    newGame(SKIN);
    const sp = waveSpawns(1, SKIN), w = LEVELS[SKIN].wounds!;
    expect(sp.every((x) => x.pos !== undefined && x.pos >= w.from && x.pos <= w.to)).toBe(true);
    expect(waveSpawns(LEVELS[SKIN].waves.length, SKIN).filter((x) => CONFIG.pathogens[x.type].boss).every((x) => x.pos === undefined)).toBe(true);
    const s = newGame(SKIN); startWave(s); tick(s, 1.2);
    const p = s.pathogens[0]; expect(p.s).toBeGreaterThan(w.from * M.VESSELS[p.vessel].length * 0.9);
  });
  it('the flesh-eating strep speeds up with every antibody strike, up to its limit', () => {
    const s = newGame(SKIN); go(s, 'topMid'); quiet(s);
    const b = mk(s, 'necrotizer', 'topMid', 50), fz = CONFIG.pathogens.necrotizer.frenzy!;
    hurt(s, b, 1); expect(b.frenzy ?? 1).toBe(1); // a white cell's fighting doesn't
    hurt(s, b, 1, true); expect(b.frenzy).toBeCloseTo(1 + fz.per, 6);
    for (let i = 0; i < 500; i++) hurt(s, b, 0, true);
    expect(b.frenzy).toBe(fz.max);
  });
  it('herpes goes dormant twice at half health, out of reach, and wakes a quarter healed', () => {
    const s = newGame(EYE); go(s, 'left'); quiet(s); s.nodes = [];
    const b = mk(s, 'herpes', 'left', 50), dm = CONFIG.pathogens.herpes.dormant!;
    hurt(s, b, b.maxHp * 0.55, true);
    expect(hidden(s, b)).toBe(true); expect(b.dormantUsed).toBe(1);
    const hp = b.hp; tick(s, dm.for + 0.1);
    expect(hidden(s, b)).toBe(false); expect(b.hp).toBeCloseTo(hp + dm.heal * b.maxHp, 5);
    hurt(s, b, b.hp - b.maxHp * 0.4, true); expect(b.dormantUsed).toBe(2); tick(s, dm.for + 0.1);
    hurt(s, b, b.hp - b.maxHp * 0.3, true); expect(hidden(s, b)).toBe(false); // no third time
  });
  it('the eye has no white cells: no pulse, but a vessel can still be opened', () => {
    const s = newGame(EYE); startWave(s);
    expect(s.cells.length).toBe(0);
    expect(pulseCheck(s).ok).toBe(false);
    expect(toggleRoute(s, 'left')).toBe(true);
  });
});

describe('Defend the Heart: the lymph node', () => {
  const NODE = LEVELS.findIndex((l) => l.id === 'lymphnode');
  it('every pathogen reaching the node weakens the lymph nodes on its vessel by 10%, down to half; a new wave restores them', () => {
    const s = newGame(NODE); go(s, 'top'); quiet(s); s.cells = [];
    const n = s.nodes.find((x) => M.entryOf(x.vessel) === 'bottomRight')!;
    const keep = mk(s, 'saureus', 'top', 0); keep.slow = 0.0001; keep.slowT = 999; // keeps the wave going
    expect(n.power).toBe(1);
    for (let i = 0; i < 7; i++) { const p = mk(s, 'virus', 'bottomRight', M.VESSELS.bottomRight.length - 1); tick(s, 0.1); expect(p.hp).toBeLessThanOrEqual(0); }
    expect(n.power).toBe(LEVELS[NODE].weakens!.min);
    const other = s.nodes.find((x) => M.entryOf(x.vessel) === 'top')!; expect(other.power).toBe(1);
    finishWave(s); startWave(s); expect(n.power).toBe(1);
  });
  it('a weakened node hits for less', () => {
    const s = newGame(NODE); go(s, 'top'); quiet(s); s.cells = [];
    const n = s.nodes.find((x) => M.entryOf(x.vessel) === 'bottomRight')!; n.power = 0.5;
    const p = mk(s, 'saureus', 'bottomRight', M.nearestOnVessel(M.VESSELS.bottomRight, siteById(n.site).anchor).s - 40); p.slow = 0.0001; p.slowT = 99;
    tick(s, 1.5);
    expect(p.maxHp - p.hp).toBeGreaterThan(0);
    expect((p.maxHp - p.hp) % (CONFIG.nodes.igm.damage * 0.5)).toBeCloseTo(0, 5);
  });
  it('HIV switches off each lymph node on its route as it passes, for the rest of the wave; white cells can\'t touch it', () => {
    const s = newGame(NODE); go(s, 'bottomRight'); quiet(s);
    const n = s.nodes.find((x) => M.entryOf(x.vessel) === 'bottomRight')!, at = M.nearestOnVessel(M.VESSELS.bottomRight, siteById(n.site).anchor).s;
    const hiv = mk(s, 'hiv', 'bottomRight', at - 5); hiv.hp = hiv.maxHp = 1e6;
    expect(n.off).toBeFalsy();
    tick(s, 1); expect(n.off).toBe(true);
    // the cells on the right vessel neither fight it nor can strike it with the pulse
    for (const c of s.cells) { c.vessel = 'bottomRight'; c.mode = 'out'; c.s = hiv.s; }
    expect(pulseTargets(s)).not.toContain(hiv);
    const hp = hiv.hp; tick(s, 0.5); expect(hiv.hp).toBe(hp);
    finishWave(s); startWave(s); expect(n.off).toBe(false);
  });
});

describe('Defend the Heart: the stomach', () => {
  const STOMACH = LEVELS.findIndex((l) => l.id === 'stomach');
  it('acid on the last third of a vessel costs pathogens its health a second; nothing before it', () => {
    const s = newGame(STOMACH); go(s, 'top'); quiet(s); s.cells = []; s.nodes = [];
    const L = M.VESSELS.left.length, acid = LEVELS[STOMACH].acid!;
    const out = mk(s, 'saureus', 'left', L * 0.3), inside = mk(s, 'saureus', 'left', L * (1 - acid.fraction) + 10);
    out.slow = inside.slow = 0.0001; out.slowT = inside.slowT = 99; // keep them where they are
    tick(s, 1);
    expect(out.hp).toBe(out.maxHp);
    expect(inside.hp).toBeCloseTo(inside.maxHp - acid.dps, 0);
  });
  it('H. pylori and its boss are untouched by acid', () => {
    const s = newGame(STOMACH); go(s, 'top'); quiet(s); s.cells = []; s.nodes = [];
    const L = M.VESSELS.left.length;
    const h = mk(s, 'hpylori', 'left', L * 0.8); h.slow = 0.0001; h.slowT = 99;
    tick(s, 1); expect(h.hp).toBe(h.maxHp);
    expect(CONFIG.pathogens.burrower.acidProof).toBe(true);
  });
  it('the swarm burrows for 1.6 s in every 5: untouchable, and tunnelling three times as fast', () => {
    const s = newGame(STOMACH); go(s, 'top'); quiet(s); s.cells = []; s.nodes = [];
    const b = mk(s, 'burrower', 'left', 100), bw = CONFIG.pathogens.burrower.burrows!;
    s.waveTime = 0.5; expect(hidden(s, b)).toBe(false);
    const a = b.s; step(s, 0.1); const outStep = b.s - a;
    s.waveTime = bw.every - bw.for + 0.2; expect(hidden(s, b)).toBe(true);
    expect(pulseTargets(s)).not.toContain(b);
    const c = b.s; step(s, 0.1); expect((b.s - c) / outStep).toBeCloseTo(bw.speed, 1);
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
    s.shots = [{ type: 'igm', targets: [], power: 1, vessel: v, x: 0, y: 0, sx: 0, sy: 0, targetId: b.id, t: 0, dur: 0.2 }];
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
