import { entryOf, ENTRY_IDS } from '../src/level';
import { describe, it, expect } from 'vitest';
import { CONFIG, LEVELS } from '../src/config';
import * as M from '../src/level';
import { newGame, placeNode, nodeAt, startWave, step, resumeGame, type State } from '../src/sim';
import { SAVE_KEY, BACKUP_KEY, freshCareer, loadCareer, saveCareer, snapshot, onOrganEnd, unlockedCount, goldFor, buy, perksOf, UPGRADES, NO_PERKS, organBacteria, missingTargets, recordEndless, type KV } from '../src/career';

/** An in-memory store standing in for localStorage. */
function memory(init: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...init };
  return { data, get: (k) => (k in data ? data[k] : null), set: (k, v) => { data[k] = v; } };
}
/** A store whose every call throws, like localStorage in some private modes. */
const broken: KV = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); } };

describe('Career: the save', () => {
  it('a fresh career has no gold, nothing cleared, no run', () => {
    const c = freshCareer();
    expect([c.version, c.gold, c.run]).toEqual([1, 0, null]);
    expect(c.cleared).toEqual([false, false, false, false, false, false, false, false, false]);
    expect(unlockedCount(c)).toBe(1);
  });

  it('saves and loads a career unchanged', () => {
    const kv = memory(); const c = freshCareer(); c.gold = 123; c.cleared[0] = true; c.best[0] = 14;
    saveCareer(kv, c);
    expect(loadCareer(kv)).toEqual(c);
    expect(unlockedCount(loadCareer(kv))).toBe(2);
  });

  it('migrates old progress: dth-unlocked 3 means the heart and lungs cleared, no gold', () => {
    const c = loadCareer(memory({ 'dth-unlocked': '3', 'dth-level': '2' }));
    expect(c.cleared).toEqual([true, true, false, false, false, false, false, false, false]);
    expect([c.gold, c.run]).toEqual([0, null]);
    expect(unlockedCount(c)).toBe(3);
  });

  it('an unreadable save starts a fresh career, kept aside rather than lost', () => {
    const kv = memory({ [SAVE_KEY]: '{"version":1,"gold":' });
    const c = loadCareer(kv);
    expect(c).toEqual(freshCareer());
    expect(kv.data[SAVE_KEY]).toBe('{"version":1,"gold":');
    expect(kv.data[BACKUP_KEY]).toBe('{"version":1,"gold":');
  });

  it('a save from a future version is kept aside, not overwritten', () => {
    const raw = JSON.stringify({ version: 2, gold: 999 });
    const kv = memory({ [SAVE_KEY]: raw });
    expect(loadCareer(kv)).toEqual(freshCareer());
    expect(kv.data[BACKUP_KEY]).toBe(raw);
  });

  it('missing fields in a version-1 save are filled in', () => {
    const kv = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, gold: 50 }) });
    const c = loadCareer(kv);
    expect(c.gold).toBe(50); expect(c.cleared).toEqual([false, false, false, false, false, false, false, false, false]); expect(c.run).toBeNull();
  });

  it('with no storage at all, the game still gets a fresh career and saving does nothing', () => {
    expect(loadCareer(broken)).toEqual(freshCareer());
    expect(() => saveCareer(broken, freshCareer())).not.toThrow();
  });
});

describe('Career: continuing a game', () => {
  function midGame(): State {
    const s = newGame(1); s.energy = 999;
    const free = M.SITES.filter((x) => !nodeAt(s, x.id));
    placeNode(s, free[0].id, 'igg', ['spneumo']); placeNode(s, free[1].id, 'ige');
    s.wave = 3; s.heartHp = 13; s.no = 61; s.energy = 140;
    s.nodes.find((n) => n.type === 'ige')!.wavesFought = 2;
    return s;
  }

  it('snapshot and resume round-trip a build phase: wave, health, energy, NO, nodes with targets and waves fought', () => {
    const s = midGame(); const run = snapshot(s);
    const r = resumeGame(run);
    expect([r.level, r.phase, r.wave, r.heartHp, r.energy, r.no]).toEqual([1, 'prep', 3, 13, 140, 61]);
    const sig = (x: State) => x.nodes.map((n) => [n.site, n.type, n.targets.join(), n.wavesFought].join(':')).sort();
    expect(sig(r)).toEqual(sig(s));
    expect(startWave(r)).toBe(true); step(r, 0.1);
  });

  it('a snapshot survives JSON (what localStorage stores)', () => {
    const s = midGame(); const run = JSON.parse(JSON.stringify(snapshot(s)));
    expect(resumeGame(run).nodes.length).toBe(s.nodes.length);
  });

  it('a saved node on a site that no longer exists is dropped; the rest load', () => {
    const run = snapshot(midGame());
    run.nodes.push({ site: 'nowhere-9', type: 'igm', targets: [], wavesFought: 0 });
    const r = resumeGame(run);
    expect(r.nodes.length).toBe(run.nodes.length - 1);
    expect(r.nodes.some((n) => n.site === 'nowhere-9')).toBe(false);
  });

  it('a run saved before every vessel had a free IgM gets the free IgMs it is missing, and only those', () => {
    const old = { level: 1, wave: 2, heartHp: 15, energy: 300, no: 80, nodes: [{ site: newGame(1).nodes[0].site, type: 'iga' as const, targets: [], wavesFought: 1 }] };
    const s = resumeGame(old);
    expect(new Set(s.nodes.map((n) => entryOf(n.vessel))).size).toBe(ENTRY_IDS.length); // every vessel has one
    expect(s.nodes.length).toBe(ENTRY_IDS.length); // the saved IgA counts for its own vessel
    expect(s.energy).toBe(300);
    // a newer save is left as it is (on the liver, bile may have taken a vessel's only node)
    const kept = resumeGame({ ...old, freeNodes: true });
    expect(kept.nodes.length).toBe(1);
  });

  it('a run for an organ that does not exist starts a fresh heart', () => {
    const run = snapshot(midGame()); run.level = 99;
    expect(resumeGame(run).level).toBe(0);
  });

  it('winning an organ marks it cleared, records the best health and ends the run', () => {
    const c = freshCareer(); const s = newGame(0); s.phase = 'victory'; s.heartHp = 15;
    c.run = snapshot(s);
    onOrganEnd(c, s);
    expect([c.cleared[0], c.best[0], c.run]).toEqual([true, 15, null]);
    s.heartHp = 9; onOrganEnd(c, s); expect(c.best[0]).toBe(15);
  });

  it('losing an organ ends the run and clears nothing', () => {
    const c = freshCareer(); const s = newGame(2); s.phase = 'defeat';
    c.run = snapshot(s); onOrganEnd(c, s);
    expect(c.run).toBeNull(); expect(c.cleared[2]).toBe(false);
  });

  it('every organ can be cleared and unlocks the next, up to nine', () => {
    const c = freshCareer();
    for (let i = 0; i < LEVELS.length; i++) { const s = newGame(i); s.phase = 'victory'; onOrganEnd(c, s); }
    expect(unlockedCount(c)).toBe(9);
  });
});

describe('Career: gold and the shop', () => {
  it('gold: 100 × level + 5 × health left on a first clear, a quarter on a replay', () => {
    expect(goldFor(0, 12, true)).toBe(160); expect(goldFor(4, 10, true)).toBe(550); expect(goldFor(4, 10, false)).toBe(137);
  });

  it('winning pays gold: full on the first clear, a quarter on a replay', () => {
    const c = freshCareer(); const s = newGame(0); s.phase = 'victory'; s.heartHp = 12;
    expect(onOrganEnd(c, s)).toBe(160); expect(c.gold).toBe(160);
    expect(onOrganEnd(c, s)).toBe(40); expect(c.gold).toBe(200);
    const l = newGame(1); l.phase = 'defeat'; expect(onOrganEnd(c, l)).toBe(0);
  });

  it('buying spends exact gold, climbs a level, refuses when poor or maxed without spending', () => {
    const c = freshCareer(); c.gold = 80;
    expect(buy(c, 'dmg-igm')).toEqual({ ok: true, reason: '' }); expect(c.gold).toBe(0); expect(c.bought['dmg-igm']).toBe(1);
    expect(buy(c, 'dmg-igm')).toEqual({ ok: false, reason: 'Not enough gold.' }); expect(c.bought['dmg-igm']).toBe(1);
    c.gold = 1000; buy(c, 'dmg-igm'); buy(c, 'dmg-igm');
    expect([c.bought['dmg-igm'], c.gold]).toEqual([3, 1000 - 160 - 240]);
    expect(buy(c, 'dmg-igm')).toEqual({ ok: false, reason: 'Already at the top level.' }); expect(c.gold).toBe(600);
  });

  it('prices match the design', () => {
    expect(UPGRADES['dmg-igg'].prices).toEqual([80, 160, 240]);
    expect(UPGRADES['target-ecoli'].prices).toEqual([120]);
    expect(UPGRADES.dual.prices).toEqual([600]);
    expect(UPGRADES.no.prices).toEqual([100, 200]);
    expect([UPGRADES.extraNode.prices, UPGRADES.cheapFirst.prices]).toEqual([[150], [150]]);
    expect('target-saureus' in UPGRADES).toBe(false);
  });

  it('perks: damage +15% per level, targets, dual, NO capacity', () => {
    const c = freshCareer(); expect(perksOf(c)).toEqual(NO_PERKS);
    c.bought = { 'dmg-iga': 2, 'target-ecoli': 1, dual: 1, no: 2, extraNode: 1, cheapFirst: 1 };
    const p = perksOf(c);
    expect(p.dmg.iga).toBeCloseTo(1.3); expect(p.dmg.igm).toBe(1);
    expect(p.targets).toEqual(['saureus', 'ecoli']);
    expect([p.dual, p.noMax, p.extraNode, p.cheapFirst]).toEqual([true, 140, true, true]);
  });
});

describe('Career: hostile saves', () => {
  const withRun = (run: object) => memory({ [SAVE_KEY]: JSON.stringify({ version: 1, gold: 10, run }) });
  const base = { wave: 2, heartHp: 10, energy: 50, no: 40, nodes: [] };
  it('a saved run for an organ that does not exist, or not a whole number, is dropped', () => {
    for (const level of [99, -1, 1.5, NaN]) expect(loadCareer(withRun({ ...base, level })).run, String(level)).toBeNull();
    expect(loadCareer(withRun({ ...base, level: 2 })).run?.level).toBe(2);
  });
  it('upgrade levels in a save must be whole numbers within range, for known upgrades only', () => {
    const kv = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, gold: 500, bought: { 'dmg-igm': -1, 'dmg-iga': 1.5, 'dmg-igg': 9, dual: 1, nonsense: 2 } }) });
    const c = loadCareer(kv);
    expect(c.bought).toEqual({ 'dmg-igg': 3, dual: 1 });
    expect(buy(c, 'dmg-igm').ok).toBe(true); expect(Number.isFinite(c.gold)).toBe(true);
  });
});

describe('Career: more hostile saves', () => {
  it('a second unreadable save is kept as well, not lost', () => {
    const kv = memory({ [SAVE_KEY]: 'bad one' });
    loadCareer(kv);
    kv.data[SAVE_KEY] = 'bad two';
    loadCareer(kv);
    const kept = Object.entries(kv.data).filter(([k]) => k.startsWith(BACKUP_KEY)).map(([, v]) => v).sort();
    expect(kept).toEqual(['bad one', 'bad two']);
    loadCareer(kv); // the same bad save again is not copied twice
    expect(Object.keys(kv.data).filter((k) => k.startsWith(BACKUP_KEY)).length).toBe(2);
  });

  it('resumed IgG nodes only keep targets this career has unlocked', () => {
    const s = newGame(1, { ...NO_PERKS, targets: ['saureus', 'spneumo', 'ecoli'], dual: true }); s.energy = 999;
    const free = M.SITES.filter((x) => !nodeAt(s, x.id));
    placeNode(s, free[0].id, 'igg', ['spneumo', 'ecoli']); placeNode(s, free[1].id, 'igg', ['spneumo']);
    const run = snapshot(s);
    const r = resumeGame(run, NO_PERKS); // nothing unlocked but S. aureus, no dual
    const igg = r.nodes.filter((n) => n.type === 'igg').map((n) => n.targets.join('+'));
    expect(igg).toEqual(['saureus', 'saureus']);
    const d = resumeGame(run, { ...NO_PERKS, targets: ['saureus', 'ecoli'] }); // ecoli unlocked, still no dual
    expect(d.nodes.filter((n) => n.type === 'igg').map((n) => n.targets.join('+'))).toEqual(['ecoli', 'saureus']);
  });
});

describe('Career: a sixth organ', () => {
  it('a five-organ save gets a sixth, locked organ: the spleen opens once the kidney is cleared', () => {
    const kv = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, gold: 5, cleared: [true, true, true, true, false], best: [1, 2, 3, 4, 0] }) });
    const c = loadCareer(kv);
    expect(c.cleared).toEqual([true, true, true, true, false, false, false, false, false]); expect(c.best).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 0]);
    expect(unlockedCount(c)).toBe(5);
    c.cleared[4] = true; expect(unlockedCount(c)).toBe(6);
  });
  it('the spleen pays 600 + 5 per health left on a first clear', () => { expect(goldFor(5, 10, true)).toBe(650); });
  it('a six-organ save gets a seventh, locked organ: the bone marrow opens once the spleen is cleared', () => {
    const kv = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, gold: 5, cleared: [true, true, true, true, true, false], best: [1, 2, 3, 4, 5, 0] }) });
    const c = loadCareer(kv);
    expect(c.cleared).toEqual([true, true, true, true, true, false, false, false, false]); expect(unlockedCount(c)).toBe(6);
    c.cleared[5] = true; expect(unlockedCount(c)).toBe(7);
  });
});

describe('Career: endless leaderboard', () => {
  it('keeps the best ten runs per organ, most waves first; an equal later run goes below; reports the place', () => {
    const c = freshCareer();
    const places = [5, 9, 3, 9].map((w, i) => recordEndless(c, 1, w, `2026-11-0${i + 1}T10:00:00Z`));
    expect(places).toEqual([1, 1, 3, 2]);
    expect(c.endless.lungs.map((r) => r.waves)).toEqual([9, 9, 5, 3]);
    expect(c.endless.lungs[0].date).toBe('2026-11-02');
    for (let i = 0; i < 12; i++) recordEndless(c, 1, 20 + i, '2026-11-20');
    expect(c.endless.lungs.length).toBe(10);
    expect(recordEndless(c, 1, 1, '2026-11-21')).toBe(0); // off the board
  });
  it('an endless run that falls goes on the board and pays gold per wave cleared, without clearing anything', () => {
    const c = freshCareer(); const s = newGame(1, undefined, undefined, true); s.wave = 8; s.phase = 'defeat';
    const paid = onOrganEnd(c, s, '2026-11-24T09:00:00Z');
    expect(paid).toBe(7 * CONFIG.endless.goldPerWave); expect(c.gold).toBe(paid);
    expect(c.endless.lungs).toEqual([{ waves: 7, date: '2026-11-24' }]);
    expect(c.cleared[1]).toBe(false); expect(c.run).toBeNull();
  });
  it('a saved board is read back, junk dropped', () => {
    const kv = memory({ [SAVE_KEY]: JSON.stringify({ version: 1, endless: { lungs: [{ waves: 4, date: '2026-11-01' }, { waves: -2, date: 'x' }, { waves: 1.5, date: 'y' }, 'junk'], nowhere: [{ waves: 3, date: 'z' }] } }) });
    const c = loadCareer(kv);
    expect(c.endless).toEqual({ lungs: [{ waves: 4, date: '2026-11-01' }] });
  });
});

describe('Career: what an organ needs', () => {
  it('lists the bacteria each organ brings, bosses counted as their species', () => {
    expect(organBacteria(0)).toEqual(['saureus']);
    expect(organBacteria(4).sort()).toEqual(['ecoli', 'saureus']);
    expect(organBacteria(2)).toContain('nmening'); // the meningococcus boss and its waves
  });
  it('names the IgG targets for an organ that are not unlocked yet', () => {
    expect(missingTargets(4, NO_PERKS)).toEqual(['ecoli']);
    expect(missingTargets(4, { ...NO_PERKS, targets: ['saureus', 'ecoli'] })).toEqual([]);
    expect(missingTargets(0, NO_PERKS)).toEqual([]);
  });
});
