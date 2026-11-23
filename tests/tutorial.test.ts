import { describe, it, expect } from 'vitest';
import * as M from '../src/level';
import { newGame, placeNode, nodeAt, startWave, step, toggleRoute, firePulse, pulseTargets, type State } from '../src/sim';
import { startTutorial, tutorialTick, tutorialNext, tutorialHolds, tutorialTarget, type Tutorial } from '../src/tutorial';
import { freshCareer, loadCareer, saveCareer, SAVE_KEY, type KV } from '../src/career';

/** Step the game the way the screen does: time stops while the tutorial holds. */
function play(s: State, t: Tutorial, seconds: number, each?: () => void) {
  for (let k = 0; k < seconds * 30; k++) { tutorialTick(t, s); each?.(); if (!tutorialHolds(t, s)) step(s, 1 / 30); }
}

describe('Tutorial: the guided first wave', () => {
  it('walks through welcome, build, start, open, NO, pulse and done, waiting for each', () => {
    const s = newGame(0); const t = startTutorial(s);
    expect(t.step).toBe('welcome');
    tutorialTick(t, s); expect(t.step).toBe('welcome'); // waits for Next
    tutorialNext(t); expect(t.step).toBe('build');
    const target = tutorialTarget(t, s)!; // a free site beside the left vessel
    expect(M.SITES.find((x) => x.id === target.site)!.vessel).toBe('left'); expect(nodeAt(s, target.site!)).toBeUndefined();
    placeNode(s, target.site!, 'igm'); tutorialTick(t, s); expect(t.step).toBe('start');
    startWave(s); tutorialTick(t, s); expect(t.step).toBe('open');
    // no hold until a pathogen is well on its way in
    expect(tutorialHolds(t, s)).toBe(false);
    play(s, t, 60, () => undefined);
    expect(tutorialHolds(t, s)).toBe(true); // held: on its way in, nothing open
    const before = s.waveTime; play(s, t, 2); expect(s.waveTime).toBe(before); // time stopped
    expect(toggleRoute(s, 'left')).toBe(true); tutorialTick(t, s);
    expect(t.step).toBe('no'); expect(tutorialHolds(t, s)).toBe(false);
    tutorialNext(t); expect(t.step).toBe('pulse');
    play(s, t, 60, () => undefined);
    expect(t.step).toBe('pulse'); expect(tutorialHolds(t, s)).toBe(true); expect(pulseTargets(s).length).toBeGreaterThanOrEqual(1);
    firePulse(s); tutorialTick(t, s);
    expect(t.step).toBe('done');
    tutorialNext(t); expect(t.step).toBeNull();
  });

  it('skips the pulse step if the wave ends first', () => {
    const s = newGame(0); const t = startTutorial(s); t.step = 'pulse';
    startWave(s); s.spawns = []; s.pathogens = [];
    play(s, t, 20);
    expect(t.step).toBe('done');
  });

  it('only the open and pulse steps ever hold the game', () => {
    const s = newGame(0); const t = startTutorial(s); startWave(s);
    for (const st of ['welcome', 'build', 'start', 'no', 'done'] as const) { t.step = st; expect(tutorialHolds(t, s)).toBe(false); }
    t.step = null; expect(tutorialHolds(t, s)).toBe(false);
  });

  it('the career remembers the tutorial was seen; older saves with cleared organs count as seen', () => {
    expect(freshCareer().tutorialSeen).toBe(false);
    const data: Record<string, string> = {}; const kv: KV = { get: (k) => data[k] ?? null, set: (k, v) => { data[k] = v; } };
    const c = freshCareer(); c.tutorialSeen = true; saveCareer(kv, c); expect(loadCareer(kv).tutorialSeen).toBe(true);
    data[SAVE_KEY] = JSON.stringify({ version: 1, gold: 0, cleared: [true, false, false, false, false] });
    expect(loadCareer(kv).tutorialSeen).toBe(true);
    data[SAVE_KEY] = JSON.stringify({ version: 1, gold: 0 });
    expect(loadCareer(kv).tutorialSeen).toBe(false);
  });
});
