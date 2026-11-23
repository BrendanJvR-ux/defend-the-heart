import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/config';
import * as M from '../src/level';
import { newGame, placeNode, nodeAt, startWave, step, resumeGame, type State } from '../src/sim';
import { SAVE_KEY, BACKUP_KEY, freshCareer, loadCareer, saveCareer, snapshot, onOrganEnd, unlockedCount, type KV } from '../src/career';

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
    expect(c.cleared).toEqual([false, false, false, false, false]);
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
    expect(c.cleared).toEqual([true, true, false, false, false]);
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
    expect(c.gold).toBe(50); expect(c.cleared).toEqual([false, false, false, false, false]); expect(c.run).toBeNull();
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

  it('a run for an organ that does not exist starts a fresh heart', () => {
    const run = snapshot(midGame()); run.level = 9;
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

  it('every organ can be cleared and unlocks the next, up to five', () => {
    const c = freshCareer();
    for (let i = 0; i < LEVELS.length; i++) { const s = newGame(i); s.phase = 'victory'; onOrganEnd(c, s); }
    expect(unlockedCount(c)).toBe(5);
  });
});
