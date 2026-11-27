// Attack mode: the player sends the pathogens, the scripted defender holds the organ.
import { describe, expect, it } from 'vitest';
import { CONFIG, LEVELS } from '../src/config';
import {
  ATTACK, ATTACK_TYPES, pathogenCost, attackBudget, attackVessels, checkPlan, planCost, launchAttack, simulateAttack, attackSpawns, isBoss,
  type AttackGroup,
} from '../src/attack';
import { loadLevel } from '../src/level';

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
    const v = vessels(0), B = attackBudget(0), n = Math.floor(B / pathogenCost('virus'));
    const fits: AttackGroup[] = [];
    for (let left = n, k = 0; left > 0; k++) { const c = Math.min(ATTACK.maxCount, left); fits.push({ type: 'virus', vessel: v[k % v.length], count: c, delay: 0 }); left -= c; }
    expect(planCost(fits)).toBeLessThanOrEqual(B);
    expect(checkPlan(0, fits)).toMatchObject({ ok: true, budget: B });
    const over = [...fits.slice(0, -1), { ...fits[fits.length - 1], count: fits[fits.length - 1].count + Math.ceil((B - planCost(fits) + 1) / pathogenCost('virus')) }];
    if (over[over.length - 1].count <= ATTACK.maxCount) expect(checkPlan(0, over)).toMatchObject({ ok: false, reason: expect.stringMatching(/Over budget/) });
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
  it('the whole budget in hijackers up one vessel brings every organ down', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const n = Math.floor(attackBudget(i) / pathogenCost('hijacker')), plan: AttackGroup[] = [];
      for (let k = 0; k * ATTACK.maxCount < n; k++) plan.push({ type: 'hijacker', vessel: vessels(i)[0], count: Math.min(ATTACK.maxCount, n - k * ATTACK.maxCount), delay: 2 * k });
      expect(checkPlan(i, plan).ok).toBe(true);
      const r = simulateAttack(i, plan)!;
      expect(r.outcome, LEVELS[i].id).toBe('won');
      expect(r.hp).toBe(0);
    }
  });

  it('a mixed attack: hijackers to take the white cells, then Salmonella behind them, wins on the heart', () => {
    const v = vessels(0)[0], B = attackBudget(0);
    const rest = Math.min(ATTACK.maxCount, Math.floor((B - 4 * pathogenCost('hijacker')) / pathogenCost('salmonella')));
    const r = simulateAttack(0, [{ type: 'hijacker', vessel: v, count: 4, delay: 0 }, { type: 'salmonella', vessel: v, count: rest, delay: 4 }])!;
    expect(r.outcome).toBe('won');
  });
});
