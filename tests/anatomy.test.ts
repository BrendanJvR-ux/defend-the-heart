import { describe, it, expect } from 'vitest';
import { CONFIG, type VesselId } from '../src/anatomy/config';
import { VESSELS, HEART } from '../src/anatomy/level';
import {
  newGame, selectVessel, canStartWave, startWave, step, firePulse, pulseTargets, aliveCells, cellPos, pathogenPos,
  waveSpawns, type State,
} from '../src/anatomy/sim';

function tick(s: State, seconds: number, each?: (s: State) => void) {
  for (let t = 0; t < seconds; t += 1 / 30) { step(s, 1 / 30); each?.(s); }
}
function finishWave(s: State, each?: (s: State) => void) {
  let n = 0;
  while ((s.phase === 'combat' || s.phase === 'recall') && n++ < 30 * 400) { step(s, 1 / 30); each?.(s); }
}

/** A sensible player: dilate the vessel carrying the most pathogen health; pulse at a cluster. */
function threat(n: number, v: VesselId) { return waveSpawns(n).filter((x) => x.vessel === v).reduce((a, x) => a + CONFIG.pathogens[x.type].hp, 0); }
function pulseAtCluster(min: number) { return (s: State) => { if (s.phase === 'combat' && s.pulsesLeft > 0 && pulseTargets(s).length >= min) firePulse(s); }; }
function play(choose: (n: number) => VesselId, pulseMin = 3) {
  const s = newGame();
  const hp: number[] = [];
  while (s.phase === 'prep') {
    selectVessel(s, choose(s.wave));
    startWave(s);
    finishWave(s, pulseAtCluster(pulseMin));
    hp.push(s.heartHp);
  }
  return { s, hp };
}

describe('Defend the Heart: rules', () => {
  it('a wave needs exactly one dilated vessel; choosing the other replaces the first', () => {
    const s = newGame();
    expect(canStartWave(s).ok).toBe(false);
    expect(selectVessel(s, 'left')).toBe(true);
    expect(s.dilated).toBe('left');
    expect(selectVessel(s, 'right')).toBe(true);
    expect(s.dilated).toBe('right');
    tick(s, 1);
    expect(s.width.right).toBeGreaterThan(0.9);
    expect(s.width.left).toBe(0);
    expect(startWave(s)).toBe(true);
    // dilation is locked during combat
    expect(selectVessel(s, 'left')).toBe(false);
    expect(s.dilated).toBe('right');
  });

  it('both vessels admit pathogens and both lymph nodes fire; only the dilated vessel carries white cells', () => {
    const s = newGame();
    s.wave = 3;
    selectVessel(s, 'left');
    startWave(s);
    const shotsFrom = new Set<string>();
    const seen = new Set<string>();
    tick(s, 40, (st) => {
      for (const p of st.pathogens) seen.add(p.vessel);
      for (const sh of st.shots) shotsFrom.add(sh.vessel);
      for (const c of st.cells) expect(c.vessel).toBe('left');
    });
    expect([...seen].sort()).toEqual(['left', 'right']);
    expect([...shotsFrom].sort()).toEqual(['left', 'right']);
  });

  it('white cells never leave their vessel and never chase into the resting one', () => {
    const s = newGame();
    s.wave = 2; // viruses only on the right; cells on the left
    selectVessel(s, 'left');
    startWave(s);
    tick(s, 30, (st) => {
      for (const c of st.cells) {
        expect(c.vessel).toBe('left');
        expect(c.s).toBeGreaterThanOrEqual(0);
        expect(c.s).toBeLessThanOrEqual(VESSELS.left.length);
        if (c.targetId !== null) expect(st.pathogens.find((p) => p.id === c.targetId)?.vessel ?? 'left').toBe('left');
      }
    });
  });

  it('the pulse never damages a pathogen on the resting vessel, even right beside a cell at the heart', () => {
    const s = newGame();
    selectVessel(s, 'left');
    startWave(s);
    s.spawns = [];
    // a cell parked at the heart entrance of the left vessel
    const c = s.cells[0];
    c.s = VESSELS.left.length - 2;
    s.cells = [c];
    // a pathogen on the RIGHT vessel, also at the heart: visually close to the cell
    s.pathogens.push({ id: 999, type: 'virus', vessel: 'right', s: VESSELS.right.length - 4, hp: 15, maxHp: 15, hit: 0, side: 0, wob: 0 });
    const d = Math.hypot(pathogenPos(s.pathogens[0]).x - cellPos(c).x, pathogenPos(s.pathogens[0]).y - cellPos(c).y);
    // widen the pulse so the resting-vessel pathogen is geometrically inside it: it must still be excluded by vessel
    const saved = CONFIG.immunePulse.radius;
    CONFIG.immunePulse.radius = d + 50;
    expect(pulseTargets(s).length).toBe(0);
    expect(firePulse(s)).toBe(0);
    CONFIG.immunePulse.radius = saved;
    expect(s.pathogens[0].hp).toBe(15);
  });

  it('the pulse comes from the cells’ current positions: it hits a cluster, misses if early, and works once', () => {
    const s = newGame();
    s.wave = 2;
    selectVessel(s, 'right');
    startWave(s);
    // too early: nothing near the cells yet
    tick(s, 1);
    const early = newGame(); early.wave = 2; selectVessel(early, 'right'); startWave(early); tick(early, 1);
    expect(firePulse(early)).toBe(0);
    expect(early.pulsesLeft).toBe(0);
    expect(firePulse(early)).toBe(-1); // spent: a second tap does nothing
    // well timed: wait until a cluster is inside the radius
    let hits = -1;
    tick(s, 30, (st) => { if (hits < 0 && pulseTargets(st).length >= 3) hits = firePulse(st); });
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(firePulse(s)).toBe(-1);
  });

  it('between waves: cells return home, the vessel contracts, the choice and pulse reset; heart damage persists', () => {
    const s = newGame();
    selectVessel(s, 'right'); // the wrong vessel for wave 1, so the left takes some damage
    startWave(s);
    finishWave(s);
    expect(s.phase).toBe('prep');
    expect(s.wave).toBe(2);
    expect(s.dilated).toBeNull();
    expect(s.width.left).toBe(0);
    expect(s.width.right).toBe(0);
    expect(s.cells.length).toBe(0);
    expect(s.pulsesLeft).toBe(0);
    const hpAfter1 = s.heartHp;
    selectVessel(s, 'left');
    startWave(s);
    expect(aliveCells(s).length).toBe(CONFIG.whiteCell.startingCount);
    expect(s.pulsesLeft).toBe(1);
    expect(s.heartHp).toBe(hpAfter1);
  });

  it('pathogens reaching the heart cost heart health; defeat at zero; restart restores everything', () => {
    const s = newGame();
    selectVessel(s, 'left');
    startWave(s);
    s.heartHp = 1;
    s.pathogens.push({ id: 5, type: 'bacterium', vessel: 'right', s: VESSELS.right.length - 1, hp: 62, maxHp: 62, hit: 0, side: 0, wob: 0 });
    tick(s, 0.2);
    expect(s.phase).toBe('defeat');
    const r = newGame();
    expect(r.heartHp).toBe(CONFIG.heartHp);
    expect(r.wave).toBe(1);
    expect(r.dilated).toBeNull();
    void HEART;
  });
});

describe('Defend the Heart: balance', () => {
  it('a sensible choice each wave plus a well-timed pulse wins', () => {
    const { s, hp } = play((n) => (threat(n, 'left') >= threat(n, 'right') ? 'left' : 'right'));
    console.log('sensible', hp, s.phase);
    expect(s.phase).toBe('victory');
  });

  it('the resting lane holds a modest threat on its own (wave 1 right lane is empty, wave 2 left holds)', () => {
    const s = newGame();
    s.wave = 2;
    selectVessel(s, 'right');
    startWave(s);
    finishWave(s, pulseAtCluster(3));
    console.log('wave 2 with right dilated: heart', s.heartHp);
    expect(s.heartHp).toBeGreaterThanOrEqual(CONFIG.heartHp - 3);
  });

  it('wrong choices hurt: always dilating the quieter vessel loses or leaves the heart badly hurt', () => {
    const { s, hp } = play((n) => (threat(n, 'left') >= threat(n, 'right') ? 'right' : 'left'));
    console.log('wrong lane', hp, s.phase);
    expect(s.phase === 'defeat' || s.heartHp <= CONFIG.heartHp / 2).toBe(true);
  });

  it('white cells alone cannot clear a wave: without lymph nodes a wave leaks', () => {
    const saved = CONFIG.lymphNode.damage;
    CONFIG.lymphNode.damage = 0;
    const s = newGame();
    selectVessel(s, 'left');
    startWave(s);
    finishWave(s, pulseAtCluster(2));
    CONFIG.lymphNode.damage = saved;
    console.log('cells only, wave 1: heart', s.heartHp);
    expect(s.heartHp).toBeLessThan(CONFIG.heartHp);
  });
});
