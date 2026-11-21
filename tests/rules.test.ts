import { describe, it, expect } from 'vitest';
import { BALANCE } from '../src/balance';
import {
  newGame, traceTower, untraceTower, undoTrace, startWave, pulseTower, step, canStartWave, buildTower,
  placeGrant, bindTower, bindCheck, towerAt, invariantHolds, rule, unboundCount, type GameState,
} from '../src/game';

const T = (s: GameState, f: string) => towerAt(s, f)!.id;

/** Run the current wave to its end without pulses (towers alone). Survives easy waves. */
function finishWave(s: GameState) {
  let n = 0;
  while (s.phase === 'combat' && n++ < 30 * 600) step(s, 1 / 30);
}

/** Cheat: keep the castle topped up so we can walk through every wave. */
function survive(s: GameState) {
  let n = 0;
  while (s.phase === 'combat' && n++ < 30 * 600) { step(s, 1 / 30); s.castleHp = BALANCE.castleHp; }
}

describe('acceptance: trace / pulse / bind', () => {
  it('1. wave 1 starts with three built towers; exactly two distinct traces; one pulse', () => {
    const s = newGame();
    expect(s.towers.length).toBe(3);
    expect(rule(s)).toMatchObject({ traces: 2, pulses: 1 });
    expect(canStartWave(s).ok).toBe(false);
    expect(traceTower(s, T(s, 'f_mill'))).toBe(true);
    expect(traceTower(s, T(s, 'f_mill'))).toBe(false); // same tower twice consumes nothing
    expect(s.traces.length).toBe(1);
    expect(canStartWave(s).ok).toBe(false);
    expect(traceTower(s, T(s, 'f_junction'))).toBe(true);
    expect(traceTower(s, T(s, 'f_bend'))).toBe(false); // over the allocation
    expect(canStartWave(s).ok).toBe(true);
    expect(startWave(s)).toBe(true);
    expect(s.pulsesLeft).toBe(1);
  });

  it('undo and redraw are free during preparation', () => {
    const s = newGame();
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    expect(undoTrace(s)).toBe(true);
    expect(s.traces).toEqual([T(s, 'f_mill')]);
    expect(untraceTower(s, T(s, 'f_mill'))).toBe(true);
    expect(s.traces.length).toBe(0);
    traceTower(s, T(s, 'f_bend'));
    traceTower(s, T(s, 'f_junction'));
    expect(canStartWave(s).ok).toBe(true);
  });

  it('2. all towers attack; untraced clicks are free; double-click spends one charge', () => {
    const s = newGame();
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    startWave(s);
    const cds = new Map<string, number>();
    let attacked = new Set<string>();
    for (let i = 0; i < 30 * 120 && s.phase === 'combat'; i++) {
      for (const t of s.towers) cds.set(t.id, t.cd);
      step(s, 1 / 30);
      for (const t of s.towers) if (t.cd > (cds.get(t.id) ?? 0) + 0.01) attacked.add(t.foundation);
      if (attacked.size === 3) break;
    }
    expect([...attacked].sort()).toEqual(['f_bend', 'f_junction', 'f_mill']);
    expect(pulseTower(s, T(s, 'f_bend'))).toBe(false); // untraced
    expect(s.pulsesLeft).toBe(1);
    expect(pulseTower(s, T(s, 'f_mill'))).toBe(true);
    expect(pulseTower(s, T(s, 'f_mill'))).toBe(false); // double-click
    expect(s.pulsesLeft).toBe(0);
    expect(pulseTower(s, T(s, 'f_junction'))).toBe(false); // shared charges are gone
    attacked = new Set();
  });

  it('3. wave 2 opens with zero traces and unspent pulses vanish', () => {
    const s = newGame();
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    startWave(s);
    survive(s);
    expect(s.phase).toBe('prep');
    expect(s.wave).toBe(2);
    expect(s.traces.length).toBe(0);
    expect(s.towers.every((t) => !t.traced && !t.committed)).toBe(true);
    expect(s.pulsesLeft).toBe(0);
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    startWave(s);
    expect(s.pulsesLeft).toBe(1);
  });

  it('4 & 5. a player who buys nothing reaches wave 4 with 4 towers, 3 traces, 2 pulses; binding needs leaves and spare towers', () => {
    const s = newGame();
    for (let w = 1; w <= 3; w++) {
      expect(bindCheck(s, T(s, 'f_junction')).ok).toBe(false);
      traceTower(s, T(s, 'f_mill'));
      traceTower(s, T(s, 'f_junction'));
      startWave(s);
      survive(s);
    }
    expect(s.wave).toBe(4);
    expect(s.leaves).toBe(3);
    expect(s.pendingGrant).toBe(true);
    expect(canStartWave(s).ok).toBe(false);
    expect(buildTower(s, 'f_gate', 'bramble')).toBe(false); // grant first
    expect(placeGrant(s, 'f_gate', 'bramble')).toBe(true);
    expect(s.towers.length).toBe(4);
    expect(invariantHolds(s)).toBe(true);
    expect(rule(s)).toMatchObject({ traces: 3, pulses: 2 });
    // With only four towers, binding one would leave three to fill three traces: refused.
    expect(bindCheck(s, T(s, 'f_junction')).ok).toBe(false);
    s.gold = 1000;
    expect(buildTower(s, 'f_upper', 'ember')).toBe(true);
    traceTower(s, T(s, 'f_junction'));
    expect(bindTower(s, T(s, 'f_junction'))).toBe(true);
    expect(s.leaves).toBe(0);
    expect(towerAt(s, 'f_junction')!.traced).toBe(false); // its thread was returned
    expect(unboundCount(s)).toBe(4);
    expect(bindTower(s, T(s, 'f_mill'))).toBe(false); // no leaves left

    // 6. A bound tower cannot be traced, and fires its own free pulse without spending a shared charge.
    expect(traceTower(s, T(s, 'f_junction'))).toBe(false);
    expect(s.traces.length).toBe(0);
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_bend'));
    expect(canStartWave(s).ok).toBe(false);
    traceTower(s, T(s, 'f_gate'));
    expect(startWave(s)).toBe(true);
    expect(s.pulsesLeft).toBe(2);
    expect(pulseTower(s, T(s, 'f_junction'))).toBe(true);
    expect(s.pulsesLeft).toBe(2); // free
    expect(pulseTower(s, T(s, 'f_junction'))).toBe(false); // once per wave
    expect(pulseTower(s, T(s, 'f_upper'))).toBe(false); // untraced, unbound
    expect(pulseTower(s, T(s, 'f_mill'))).toBe(true);
    expect(s.pulsesLeft).toBe(1);
    survive(s);
    // The free pulse returns next wave, still without a trace.
    expect(s.wave).toBe(5);
    expect(towerAt(s, 'f_junction')!.bound).toBe(true);
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_bend'));
    traceTower(s, T(s, 'f_gate'));
    startWave(s);
    expect(pulseTower(s, T(s, 'f_junction'))).toBe(true);
    expect(s.pulsesLeft).toBe(2);
  });

  it('building and tracing are locked during a wave', () => {
    const s = newGame();
    s.gold = 500;
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    startWave(s);
    expect(buildTower(s, 'f_gate', 'bell')).toBe(false);
    expect(traceTower(s, T(s, 'f_bend'))).toBe(false);
    expect(untraceTower(s, T(s, 'f_mill'))).toBe(false);
  });

  it('7. restart restores the initial state', () => {
    const fresh = newGame();
    const s = newGame();
    traceTower(s, T(s, 'f_mill'));
    traceTower(s, T(s, 'f_junction'));
    startWave(s);
    pulseTower(s, T(s, 'f_mill'));
    finishWave(s);
    const r = newGame();
    for (const k of ['phase', 'wave', 'castleHp', 'gold', 'leaves', 'traces', 'pulsesLeft', 'flights', 'pendingGrant'] as const) {
      expect(r[k]).toEqual(fresh[k]);
    }
    expect(r.towers.map((t) => [t.foundation, t.type, t.bound])).toEqual(fresh.towers.map((t) => [t.foundation, t.type, t.bound]));
  });
});
