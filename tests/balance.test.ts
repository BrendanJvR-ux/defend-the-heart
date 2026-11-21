import { describe, it, expect } from 'vitest';
import { playBot } from './bot';

describe('balance', () => {
  it('a sensible strategy wins all six waves', () => {
    const { state, hpByWave, leaks } = playBot({
      pulse: true,
      builds: [{ foundation: 'f_upper', type: 'bramble' }, { foundation: 'f_gate', type: 'bramble' }, { foundation: 'f_bend', type: 'ember' }, { foundation: 'f_ford', type: 'bramble' }, { foundation: 'f_millgate', type: 'bramble' }],
      bind: { wave: 4, foundation: 'f_junction' },
      traces: { 1: ['f_mill', 'f_junction'], 2: ['f_mill', 'f_junction'], 3: ['f_junction', 'f_bridge'], 4: ['f_junction', 'f_mill', 'f_bridge'], 5: ['f_junction', 'f_bridge', 'f_bend'], 6: ['f_junction', 'f_bridge', 'f_mill'] },
    });
    console.log('strategy HP by wave', hpByWave.slice(1), state.phase, 'gold', state.gold, 'towers', state.towers.length, JSON.stringify(leaks.slice(1)));
    expect(state.phase).toBe('victory');
  });

  const traces = { 1: ['f_mill', 'f_junction'], 2: ['f_mill', 'f_junction'], 3: ['f_junction', 'f_bridge'], 4: ['f_junction', 'f_mill', 'f_bridge'], 5: ['f_junction', 'f_bridge', 'f_bend'], 6: ['f_junction', 'f_bridge', 'f_mill'] };
  const builds = [{ foundation: 'f_upper', type: 'bramble' as const }, { foundation: 'f_gate', type: 'bramble' as const }, { foundation: 'f_bend', type: 'ember' as const }, { foundation: 'f_ford', type: 'bramble' as const }, { foundation: 'f_millgate', type: 'bramble' as const }];

  it('pulses matter: the same builds without pulses lose', () => {
    const r = playBot({ pulse: false, traces, builds });
    console.log('builds, no pulses', r.hpByWave.slice(1), r.state.phase);
    expect(r.state.phase).toBe('defeat');
  });

  it('building matters: pulses alone with no new towers lose', () => {
    const r = playBot({ pulse: true, traces });
    console.log('pulses, no builds', r.hpByWave.slice(1), r.state.phase);
    expect(r.state.phase).toBe('defeat');
  });

  it('a modest strategy (two extra towers, held pulses) still wins', () => {
    const r = playBot({ pulse: true, traces, builds: builds.slice(0, 2) });
    console.log('pulses, 2 builds', r.hpByWave.slice(1), r.state.phase);
    expect(r.state.phase).toBe('victory');
  });

  it('a do-nothing player (no builds, no pulses) is under real pressure', () => {
    const { state, hpByWave, leaks } = playBot({ pulse: false, traces: {} });
    console.log('passive HP by wave', hpByWave.slice(1), state.phase, JSON.stringify(leaks.slice(1)));
    // Not asserted to lose — but they should be bleeding health.
    expect(hpByWave.filter((x) => x !== undefined).at(-1)! < 20).toBe(true);
  });
});
