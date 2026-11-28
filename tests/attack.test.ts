// Attack mode: the player sends the pathogens, the scripted defender holds the organ.
import { describe, expect, it } from 'vitest';
import { CONFIG, LEVELS } from '../src/config';
import {
  ATTACK, ATTACK_TYPES, pathogenCost, attackBudget, attackVessels, checkPlan, planCost, launchAttack, simulateAttack, attackSpawns, isBoss,
  perVessel, freshMatch, recordAttack, matchWinner, matchRound, matchScore, type AttackGroup,
} from '../src/attack';
import { loadLevel } from '../src/level';
import * as M from '../src/level';
import { playMatch } from './balance/attackers';

const vessels = (i: number) => attackVessels(i).map((v) => v.id);

describe('attack mode: prices and the budget', () => {
  it('prices come from the stats: tougher, faster or more harmful costs more', () => {
    expect(pathogenCost('virus')).toBeLessThan(pathogenCost('saureus'));
    expect(pathogenCost('mtb')).toBeGreaterThan(pathogenCost('saureus')); // more health, and it lodges
    expect(pathogenCost('hijacker')).toBeGreaterThan(pathogenCost('virus')); // it infects white cells
    for (const t of ATTACK_TYPES) {
      expect(pathogenCost(t)).toBeGreaterThanOrEqual(1);
      if (isBoss(t)) expect(pathogenCost(t)).toBeGreaterThan(pathogenCost('mtb'));
    }
    // the infected white cell is never sent: it is what a hijacker makes
    expect(ATTACK_TYPES).not.toContain('infected');
  });

  it('every organ has a budget, larger for a better-defended organ', () => {
    for (let i = 0; i < LEVELS.length; i++) expect(attackBudget(i)).toBeGreaterThan(5 * pathogenCost('saureus'));
    const skin = LEVELS.findIndex((l) => l.id === 'skin');
    expect(attackBudget(skin)).toBeGreaterThan(attackBudget(0)); // the skin's defence starts with far more energy
  });

  it('a plan within the budget is allowed; one over it is not', () => {
    const v = vessels(0), B = attackBudget(0), n = Math.floor(B / pathogenCost('saureus'));
    const fits: AttackGroup[] = [];
    for (let left = n, k = 0; left > 0; k++) { const c = Math.min(ATTACK.maxCount, ATTACK.maxPerVessel, left); fits.push({ type: 'saureus', vessel: v[k % v.length], count: c, delay: 0 }); left -= c; }
    expect(planCost(fits)).toBeLessThanOrEqual(B);
    expect(checkPlan(0, fits)).toMatchObject({ ok: true, budget: B });
    const over = [...fits.slice(0, -1), { ...fits[fits.length - 1], count: fits[fits.length - 1].count + Math.ceil((B - planCost(fits) + 1) / pathogenCost('saureus')) }];
    if (over[over.length - 1].count <= Math.min(ATTACK.maxCount, ATTACK.maxPerVessel)) expect(checkPlan(0, over)).toMatchObject({ ok: false, reason: expect.stringMatching(/Over budget/) });
    const tooMuch: AttackGroup[] = Array.from({ length: 5 }, (_, k) => ({ type: 'mtb', vessel: v[k % v.length], count: 20, delay: 0 }));
    expect(checkPlan(0, tooMuch).ok).toBe(false);
    expect(checkPlan(0, tooMuch).cost).toBe(100 * pathogenCost('mtb'));
  });

  it('the plan rules: groups, vessels, counts, delays, one boss', () => {
    const v = vessels(0)[0];
    expect(checkPlan(0, []).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'saureus', vessel: 'nowhere', count: 1, delay: 0 }]).reason).toMatch(/vessels/);
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: 0, delay: 0 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: 1.5, delay: 0 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'virus', vessel: v, count: ATTACK.maxCount + 1, delay: 0 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: 1, delay: -1 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: 1, delay: ATTACK.maxDelay + 1 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'infected', vessel: v, count: 1, delay: 0 }]).ok).toBe(false);
    expect(checkPlan(0, [{ type: 'flu', vessel: v, count: 2, delay: 0 }]).reason).toMatch(/alone/);
    expect(checkPlan(0, [{ type: 'flu', vessel: v, count: 1, delay: 0 }, { type: 'colony', vessel: v, count: 1, delay: 5 }]).reason).toMatch(/boss/);
    expect(checkPlan(0, [{ type: 'flu', vessel: v, count: 1, delay: 0 }]).ok).toBe(true);
    const many = Array.from({ length: ATTACK.maxGroups + 1 }, () => ({ type: 'virus' as const, vessel: v, count: 1, delay: 0 }));
    expect(checkPlan(0, many).ok).toBe(false);
    // an illegal plan is never launched
    expect(launchAttack(0, [])).toBeNull();
  });

  it('a group enters as planned: its count, from its delay, spaced by kind, up its vessel', () => {
    loadLevel(0);
    const v = vessels(0);
    const sp = attackSpawns([{ type: 'saureus', vessel: v[1], count: 3, delay: 5 }, { type: 'virus', vessel: v[0], count: 2, delay: 0 }]);
    expect(sp.map((x) => [x.type, x.at])).toEqual([['virus', 0], ['virus', ATTACK.spacing.virus], ['saureus', 5], ['saureus', 5 + ATTACK.spacing.bacterium], ['saureus', 5 + 2 * ATTACK.spacing.bacterium]]);
    expect(sp.filter((x) => x.type === 'saureus').every((x) => x.vessel === v[1])).toBe(true);
  });
});

describe('attack mode: the AI defender', () => {
  it('builds with all its energy before the wave, without seeing the attack', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const a = launchAttack(i, [{ type: 'virus', vessel: vessels(i)[0], count: 1, delay: 0 }])!;
      const b = launchAttack(i, [{ type: 'salmonella', vessel: vessels(i)[vessels(i).length - 1], count: 10, delay: 3 }])!;
      expect(a.phase).toBe('combat');
      expect(a.nodes.length).toBeGreaterThan(vessels(i).length); // more than the free IgM each vessel gets
      expect(a.energy).toBeLessThan(Math.min(...Object.values(CONFIG.nodes).map((n) => n.cost)) + 10 + (LEVELS[i].handicap.nodeCost ?? 0));
      // the same build, whatever is coming
      expect(b.nodes.map((n) => `${n.site}:${n.type}`)).toEqual(a.nodes.map((n) => `${n.site}:${n.type}`));
    }
  });

  it('holds off a weak attack on every organ', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const v = vessels(i);
      const r = simulateAttack(i, [{ type: 'virus', vessel: v[0], count: 4, delay: 0 }, { type: 'saureus', vessel: v[1], count: 2, delay: 4 }])!;
      expect(r.outcome, LEVELS[i].id).toBe('held');
      expect(r.hp, LEVELS[i].id).toBeGreaterThan(r.maxHp / 2);
    }
  });

  it('holds off the whole budget scattered thinly over every vessel on most organs', () => {
    let held = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const v = vessels(i), per = Math.min(ATTACK.maxCount, Math.floor(attackBudget(i) / pathogenCost('virus') / v.length));
      const plan = v.map((x) => ({ type: 'virus' as const, vessel: x, count: per, delay: 0 }));
      expect(checkPlan(i, plan).ok).toBe(true);
      if (simulateAttack(i, plan)!.outcome === 'held') held++;
    }
    expect(held).toBeGreaterThanOrEqual(LEVELS.length - 1);
  });
});

describe('attack mode: a strong attack can win', () => {
  it('a mixed attack (hijackers to take the white cells, then bacteria the organ does not expect) wins on the heart', () => {
    const v = vessels(0);
    const plan: AttackGroup[] = [{ type: 'hijacker', vessel: v[0], count: 6, delay: 0 }, { type: 'salmonella', vessel: v[0], count: 9, delay: 4 }];
    let left = attackBudget(0) - planCost(plan);
    for (const x of v.slice(1)) { const n = Math.min(ATTACK.maxPerVessel, Math.floor(left / pathogenCost('salmonella'))); if (n > 0) { plan.push({ type: 'salmonella', vessel: x, count: n, delay: 2 }); left -= n * pathogenCost('salmonella'); } }
    expect(checkPlan(0, plan).ok).toBe(true);
    expect(simulateAttack(0, plan)!.outcome).toBe('won');
  });
});

describe('attack mode: the limit per vessel', () => {
  it('at most maxPerVessel pathogens up one vessel in an attack, counted over all its groups; a virus counts as half', () => {
    const v = vessels(0)[0], N = ATTACK.maxPerVessel;
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: N, delay: 0 }]).ok).toBe(true);
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: N - 2, delay: 0 }, { type: 'saureus', vessel: v, count: 3, delay: 6 }]).reason).toMatch(/up one vessel/);
    expect(checkPlan(0, [{ type: 'virus', vessel: v, count: 2 * N, delay: 0 }]).ok).toBe(N * 2 <= ATTACK.maxCount);
    expect(checkPlan(0, [{ type: 'virus', vessel: v, count: N, delay: 0 }, { type: 'saureus', vessel: v, count: N / 2 + 1, delay: 0 }]).ok).toBe(false);
    expect(perVessel([{ type: 'virus', vessel: v, count: 4, delay: 0 }, { type: 'flu', vessel: v, count: 1, delay: 0 }], v)).toBe(3);
    // another vessel has its own room
    expect(checkPlan(0, [{ type: 'saureus', vessel: v, count: N, delay: 0 }, { type: 'saureus', vessel: vessels(0)[1], count: 2, delay: 0 }]).ok).toBe(true);
  });
});

describe('attack mode: a match is the best of three', () => {
  it('two wins take it; a match ends as soon as one side has two', () => {
    const m = freshMatch(0), p: AttackGroup[] = [{ type: 'virus', vessel: vessels(0)[0], count: 1, delay: 0 }];
    expect(matchRound(m)).toBe(1); expect(matchWinner(m)).toBeNull();
    recordAttack(m, p, 'won'); expect(matchWinner(m)).toBeNull();
    recordAttack(m, p, 'held'); expect(matchRound(m)).toBe(3);
    recordAttack(m, p, 'won'); expect(matchWinner(m)).toBe('attacker'); expect(matchScore(m)).toEqual({ attacker: 2, defender: 1 });
    recordAttack(m, p, 'held'); expect(m.results.length).toBe(3); // nothing after the match is over
    const h = freshMatch(0); recordAttack(h, p, 'held'); recordAttack(h, p, 'held'); expect(matchWinner(h)).toBe('defender');
  });

  it('the defender learns: after attacks up one vessel it builds more on it, with the same energy', () => {
    for (const i of [0, 3, 6]) {
      const v = vessels(i)[0], plan: AttackGroup[] = [{ type: 'saureus', vessel: v, count: 10, delay: 0 }];
      const m = freshMatch(i), first = launchAttack(i, plan, m.seen)!;
      recordAttack(m, plan, 'won');
      const second = launchAttack(i, plan, m.seen)!;
      const on = (s: typeof first) => s.nodes.filter((n) => M.entryOf(M.SITES.find((x) => x.id === n.site)!.vessel) === v).length;
      expect(on(second), LEVELS[i].id).toBeGreaterThan(on(first));
      expect(second.energy).toBeLessThan(first.energy + 40);
    }
  });

  it('balance: simulated attackers of every skill and style take about half their matches (40 matches, four per organ)', () => {
    const rs = [];
    for (let i = 0; i < LEVELS.length; i++) for (let k = 1; k <= 4; k++) rs.push(playMatch(i, 1000 + k * 13 + i));
    const share = rs.filter((x) => x.winner === 'attacker').length / rs.length;
    console.log('attack matches: attacker takes', Math.round(100 * share), '%');
    expect(share).toBeGreaterThanOrEqual(0.3);
    expect(share).toBeLessThanOrEqual(0.7);
  }, 60_000);
});
