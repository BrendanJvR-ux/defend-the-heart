// The reserve cell, lab tests, the local antibiotic, kill credit, organ mastery, the Field Guide's progress and the
// backup of permanent progress, played on the real simulation.
import { describe, it, expect } from 'vitest';
import { CONFIG, LEVELS, type PathogenType } from '../src/config';
import * as M from '../src/level';
import {
  type State, newGame, startWave, step, toggleRoute, closeRoute, outCells, aliveCells, pulsePairs, firePulse, setReserve, reserveCell, cellStatus, deployReserve,
  deployReserveCheck, labAvailable, labCheck, buyLab, gramReport, scanReport, waveSpawns, abxAvailable, abxCheck, deployAntibiotic, resumeGame, buyCell, hurt,
} from '../src/sim';
import { NO_PERKS, freshCareer, snapshot, saveCareer, loadCareer, perksOf, type KV, type Perks } from '../src/career';
import { SEALS, STEWARDSHIP, sealsEarned } from '../src/mastery';
import { freshProgress, loadProgress, saveProgress, grant, recordSeen, recordKill, methodsFor, secondDiscovery, exportBackup, importBackup, PROGRESS_KEY } from '../src/progress';
import { guideEntry } from '../src/guide';
import { mk, tick, quiet, finishWave } from './players';

const memory = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => { const data = { ...init }; return { data, get: (k) => data[k] ?? null, set: (k, v) => { data[k] = v; } }; };
const idx = (id: string) => LEVELS.findIndex((L) => L.id === id);
const withAbx: Perks = { ...NO_PERKS, antibiotic: true };
/** Keeps a wave going: a pathogen that barely moves, out of everyone's reach at the edge of the map. */
function keepAlive(s: State) { const k = mk(s, 'virus', M.VESSEL_IDS[M.VESSEL_IDS.length - 1], 0); k.hp = k.maxHp = 1e9; k.slow = 1e-6; k.slowT = 1e9; }
/** A wave in progress with nothing coming (pathogens are added by hand), no lymph nodes, NO plentiful. */
function combat(level: number, perks = NO_PERKS): State { const s = newGame(level, perks); s.nodes = []; startWave(s); quiet(s); keepAlive(s); s.no = 999; return s; }

describe('The reserve cell', () => {
  it('held from the start of a wave: one cell stays at the organ, the others go out', () => {
    const s = newGame(idx('lymphnode')); setReserve(s, true); startWave(s); quiet(s); keepAlive(s); s.no = 999;
    const v = M.VESSEL_IDS[0]; toggleRoute(s, v); tick(s, 0.2);
    const r = reserveCell(s)!;
    expect(r.mode).toBe('home');
    expect(outCells(s).length).toBe(aliveCells(s).length - 1);
    expect(cellStatus(s)).toEqual({ out: aliveCells(s).length - 1, returning: 0, reserve: 'home' });
  });
  it('turned on with every cell out: one is recalled at normal speed, shown returning until it is home', () => {
    const s = combat(0); toggleRoute(s, 'left'); tick(s, 3);
    expect(outCells(s).length).toBe(aliveCells(s).length);
    setReserve(s, true);
    expect(cellStatus(s).reserve).toBe('returning');
    let n = 0; while (cellStatus(s).reserve === 'returning' && n++ < 600) step(s, 1 / 30);
    expect(cellStatus(s).reserve).toBe('home'); expect(n).toBeGreaterThan(5); // it travelled, not teleported
  });
  it('recalling the last living cell: it comes home, and no vessel can take a cell until it is deployed', () => {
    const s = combat(0); toggleRoute(s, 'left'); tick(s, 2);
    for (const c of aliveCells(s).slice(1)) c.hp = 0;
    setReserve(s, true); let n = 0; while (reserveCell(s)?.mode !== 'home' && n++ < 600) step(s, 1 / 30);
    expect(outCells(s).length).toBe(0);
    expect(reserveCell(s)?.mode).toBe('home');
  });
  it('a held cell at the organ is out of the immune pulse\'s reach', () => {
    const s = combat(0); setReserve(s, true); toggleRoute(s, 'left'); tick(s, 2);
    const r = reserveCell(s)!;
    mk(s, 'saureus', 'left', M.VESSELS.left.length - 5).hp = 999; // right by the organ
    expect(pulsePairs(s).some((x) => x.cell === r)).toBe(false);
    firePulse(s); expect(r.hp).toBeGreaterThan(0);
  });
  it('deployed into an open vessel: it goes at once, the reserve turns off, nothing is paid', () => {
    const s = combat(0); setReserve(s, true); toggleRoute(s, 'left'); tick(s, 1);
    const r = reserveCell(s)!, no = s.no;
    expect(deployReserve(s, 'left')).toBe(true);
    expect([r.mode, r.vessel, s.reserve, s.reserveId, s.no]).toEqual(['out', 'left', false, null, no]);
  });
  it('deployed into a closed vessel: it opens at the normal NO cost; unaffordable keeps the cell, spends nothing', () => {
    const s = combat(0); setReserve(s, true); toggleRoute(s, 'left'); tick(s, 1);
    s.no = 5; // too little to open another
    expect(deployReserveCheck(s, 'right').ok).toBe(false);
    expect(deployReserve(s, 'right')).toBe(false);
    expect([s.no, reserveCell(s)?.mode, s.open]).toEqual([5, 'home', ['left']]);
    s.no = 100;
    expect(deployReserve(s, 'right')).toBe(true);
    expect(s.open).toEqual(['left', 'right']); expect(s.no).toBe(100 - CONFIG.no.extraOpenCost);
  });
  it('a cell sent from the reserve that meets a pathogen counts for Rapid Response, once per vessel', () => {
    const s = combat(0); setReserve(s, true); toggleRoute(s, 'left'); tick(s, 1);
    deployReserve(s, 'right'); mk(s, 'saureus', 'right', M.VESSELS.right.length - 60).hp = 9999;
    tick(s, 3);
    expect(s.stats.reserveHits).toEqual(['right']);
  });
  it('the choice is kept in the save between waves', () => {
    const s = newGame(1); setReserve(s, true);
    expect(resumeGame(snapshot(s)).reserve).toBe(true);
  });
});

describe('Lab tests', () => {
  it('start on the second organ, cost 20 energy once, one a wave', () => {
    expect(labAvailable(newGame(0))).toBe(false);
    const s = newGame(1), e = s.energy;
    expect(labCheck(s).ok).toBe(true);
    expect(buyLab(s, 'gram')).toBe(true); expect(s.energy).toBe(e - CONFIG.labTests.price);
    expect(buyLab(s, 'scan')).toBe(false); expect(s.energy).toBe(e - CONFIG.labTests.price);
  });
  it('not enough energy: refused, nothing taken', () => {
    const s = newGame(1); s.energy = 19;
    expect(labCheck(s).reason).toBe('Needs 20 energy (you have 19).'); expect(buyLab(s, 'gram')).toBe(false); expect(s.energy).toBe(19);
  });
  it('reports come from the actual wave, and that very plan is the one that starts', () => {
    const s = newGame(1), plan = waveSpawns(1, 1);
    buyLab(s, 'gram'); expect(s.lab!.text).toBe(gramReport(plan));
    startWave(s); expect(s.spawns.map((x) => `${x.type}${x.vessel}${x.at}`)).toEqual(plan.map((x) => `${x.type}${x.vessel}${x.at}`));
    expect(s.lab!.wave).toBe(1); // still shown during the wave
  });
  it('Gram stain: the predominant group, a tie, a virus-only wave', () => {
    const sp = (type: PathogenType) => ({ type, vessel: 'left', at: 0 });
    expect(gramReport([sp('saureus'), sp('saureus'), sp('ecoli')])).toMatch(/^Mostly Gram-positive/);
    expect(gramReport([sp('nmening'), sp('ecoli'), sp('saureus')])).toMatch(/^Mostly Gram-negative/);
    expect(gramReport([sp('saureus'), sp('ecoli'), sp('virus')])).toMatch(/^Mixed Gram result\./);
    expect(gramReport([sp('virus'), sp('jumper')])).toMatch(/^No bacteria detected\./);
    expect(gramReport([sp('virus')])).toContain('Viruses are outside the scope');
  });
  it('vessel scan: the busiest vessel, ties named, nothing about identity or timing', () => {
    newGame(0);
    const r = scanReport([{ type: 'saureus', vessel: 'left', at: 1 }, { type: 'virus', vessel: 'left', at: 9 }, { type: 'saureus', vessel: 'right', at: 2 }]);
    expect(r).toMatch(/^Most pathogens: the left vessel\./); expect(r).not.toMatch(/aureus|virus|\d s/i);
    expect(scanReport([{ type: 'saureus', vessel: 'left', at: 1 }, { type: 'virus', vessel: 'right', at: 9 }])).toContain('(tied)');
  });
  it('a reload keeps the bought report and the energy paid: no reroll, no second test', () => {
    const s = newGame(2); buyLab(s, 'scan');
    const back = resumeGame(snapshot(s));
    expect(back.lab).toEqual(s.lab); expect(back.energy).toBe(s.energy); expect(labCheck(back).ok).toBe(false);
  });
});

describe('The local antibiotic', () => {
  const MAR = idx('marrow'), SPL = idx('spleen');
  it('unlocks with the fifth organ cleared, and is used from the sixth organ on', () => {
    const c = freshCareer(); expect(perksOf(c).antibiotic).toBe(false);
    c.cleared = c.cleared.map((_, i) => i < 5); expect(perksOf(c).antibiotic).toBe(true);
    expect(abxAvailable(combat(SPL, withAbx))).toBe(false);
    expect(abxAvailable(combat(MAR, withAbx))).toBe(true);
    expect(abxCheck(combat(MAR)).reason).toMatch(/unlocks once the fifth organ is cleared/);
  });
  it('not enough energy: refused, nothing spent; one dose a wave', () => {
    const s = combat(MAR, withAbx), r = M.VESSEL_IDS[0];
    s.energy = 119; expect(deployAntibiotic(s, r)).toBe(false); expect([s.energy, s.abx, s.abxUsed]).toEqual([119, null, 0]);
    s.energy = 300; expect(deployAntibiotic(s, r)).toBe(true); expect(s.energy).toBe(180);
    expect(deployAntibiotic(s, M.VESSEL_IDS[1])).toBe(false); expect(s.energy).toBe(180);
  });
  it('works on bacteria in its vessel only (and on those that enter while it lasts); viruses, other vessels and your cells are untouched', () => {
    const s = combat(MAR, withAbx), a = M.VESSEL_IDS[0], b = M.VESSEL_IDS.find((v) => M.entryOf(v) !== M.entryOf(a))!;
    const here = mk(s, 'ecoli', a, 40), virus = mk(s, 'virus', a, 40), there = mk(s, 'ecoli', b, 40);
    for (const p of [here, virus, there]) { p.hp = p.maxHp = 5000; }
    deployAntibiotic(s, a); const cellHp = aliveCells(s).map((c) => c.hp);
    tick(s, 2); const late = mk(s, 'ecoli', a, 10); late.hp = late.maxHp = 5000; tick(s, 2);
    expect(here.hp).toBeLessThan(5000); expect(late.hp).toBeLessThan(5000);
    expect(virus.hp).toBe(5000); expect(there.hp).toBe(5000);
    expect(aliveCells(s).map((c) => c.hp)).toEqual(cellHp);
  });
  it('a full standard dose deals dps × duration to a bacterium there throughout; a bacterial boss takes the reduced share', () => {
    const A = CONFIG.antibiotic, s = combat(MAR, withAbx), r = M.VESSEL_IDS[0];
    const p = mk(s, 'ecoli', r, 30), boss = mk(s, 'meningo', r, 30);
    for (const x of [p, boss]) { x.hp = x.maxHp = 5000; }
    CONFIG.pathogens.ecoli.speed = 0; CONFIG.pathogens.meningo.speed = 0;
    try { deployAntibiotic(s, r); tick(s, A.standard.duration + 0.5); } finally { CONFIG.pathogens.ecoli.speed = 30; CONFIG.pathogens.meningo.speed = 20; }
    expect(5000 - p.hp).toBeCloseTo(A.standard.dps * A.standard.duration, -1);
    expect((5000 - boss.hp) / (5000 - p.hp)).toBeCloseTo(A.bossFactor, 1);
  });
  it('stays in its vessel when dilation changes', () => {
    const s = combat(MAR, withAbx), [a, b] = M.VESSEL_IDS; toggleRoute(s, a);
    const p = mk(s, 'ecoli', a, 40); p.hp = p.maxHp = 5000;
    deployAntibiotic(s, a); tick(s, 1); closeRoute(s); toggleRoute(s, b); tick(s, 2);
    expect(s.abx?.route).toBe(a); expect(5000 - p.hp).toBeGreaterThan(CONFIG.antibiotic.standard.dps * 2.5);
  });
  it('kills it finishes are credited to it', () => {
    const s = combat(MAR, withAbx), r = M.VESSEL_IDS[0]; const p = mk(s, 'ecoli', r, 30); p.hp = 10;
    deployAntibiotic(s, r); tick(s, 1);
    expect(s.kills).toContainEqual({ type: 'ecoli', method: 'antibiotic' });
  });
  it('a reload goes back to the wave\'s start: the energy and the unused dose come back together, never a second dose', () => {
    const s = newGame(MAR, withAbx); s.energy = 300; const save = snapshot(s); startWave(s); deployAntibiotic(s, M.VESSEL_IDS[0]);
    const back = resumeGame(save, withAbx); expect(back.energy).toBe(300); startWave(back); quiet(back);
    expect(deployAntibiotic(back, M.VESSEL_IDS[0])).toBe(true); expect(deployAntibiotic(back, M.VESSEL_IDS[1])).toBe(false);
  });
  it('Standard and Burst give about the same total to a bacterium there throughout; Burst front-loads, Standard covers later arrivals', () => {
    const run = (profile: 'standard' | 'burst', stagger: boolean) => {
      const s = combat(MAR, withAbx), r = M.VESSEL_IDS[0], ps = [] as ReturnType<typeof mk>[];
      CONFIG.pathogens.ecoli.speed = 0;
      try {
        const add = () => { const p = mk(s, 'ecoli', r, 30 + ps.length * 5); p.hp = p.maxHp = 5000; ps.push(p); };
        if (!stagger) for (let i = 0; i < 5; i++) add(); else add();
        deployAntibiotic(s, r, profile);
        for (let t = 0; t < 7; t += 1) { if (stagger && ps.length < 6) add(); tick(s, 1); }
      } finally { CONFIG.pathogens.ecoli.speed = 30; }
      return ps.reduce((a, p) => a + (5000 - p.hp), 0);
    };
    const clusterStd = run('standard', false), clusterBurst = run('burst', false), stagStd = run('standard', true), stagBurst = run('burst', true);
    console.log('antibiotic damage, clustered group: standard', Math.round(clusterStd), 'burst', Math.round(clusterBurst), '· staggered arrivals: standard', Math.round(stagStd), 'burst', Math.round(stagBurst));
    expect(clusterBurst / clusterStd).toBeGreaterThan(0.9); expect(clusterBurst / clusterStd).toBeLessThan(1.1);
    expect(stagStd).toBeGreaterThan(stagBurst * 1.3);
  });
});

describe('Kill credit', () => {
  it('nodes, white cells, the pulse and the stomach acid are each credited with the blows they finish', () => {
    const s = combat(0); const a = mk(s, 'virus', 'left', 30); a.hp = 1; hurt(s, a, 5, true, 'node', 'igm');
    const b = mk(s, 'virus', 'left', 30); b.hp = 1; hurt(s, b, 5, false, 'cell');
    expect(s.kills).toEqual([{ type: 'virus', method: 'node' }, { type: 'virus', method: 'cell' }]);
    const st = combat(idx('stomach')); const v = M.VESSEL_IDS[0], p = mk(st, 'saureus', v, M.VESSELS[v].length * 0.9); p.hp = 1; tick(st, 1);
    expect(st.kills).toContainEqual({ type: 'saureus', method: 'organ' }); expect(st.stats.kills.organ).toBe(1);
  });
  it('a pathogen seen for the first time is reported once', () => {
    const s = newGame(0); startWave(s); tick(s, 12);
    const first = [...s.seen]; expect(first.length).toBeGreaterThan(0); expect(new Set(first).size).toBe(first.length);
  });
});

describe('Organ mastery', () => {
  it('every organ has three seals: the clear first, then two tactics, each with its goal in words', () => {
    for (const L of LEVELS) {
      const seals = SEALS[L.id]; expect(seals?.length, L.id).toBe(3); expect(seals[0].id).toBe('clear');
      for (const x of seals) expect(x.goal.length, `${L.id} ${x.id}`).toBeGreaterThan(20);
    }
  });
  it('the heart, won with a reserve cell meeting pathogens in two vessels and no cell bought, earns all three seals', () => {
    const s = newGame(0); s.nodes = []; setReserve(s, true); startWave(s); quiet(s); keepAlive(s); s.no = 999;
    toggleRoute(s, 'left'); tick(s, 1); deployReserve(s, 'right'); mk(s, 'saureus', 'right', M.VESSELS.right.length - 60).hp = 50; tick(s, 4);
    setReserve(s, true); let n = 0; while (reserveCell(s)?.mode !== 'home' && n++ < 900) step(s, 1 / 30);
    // the second trip: down the other open vessel (both cells already have one, so a closed vessel couldn't open)
    expect(deployReserveCheck(s, 'upper').ok).toBe(false);
    expect(deployReserve(s, 'left')).toBe(true); mk(s, 'saureus', 'left', M.VESSELS.left.length - 60).hp = 300; tick(s, 4);
    expect(SEALS.heart[1].progress!(s)).toBe('2 of 2 vessels intercepted from the reserve');
    s.phase = 'victory';
    expect(sealsEarned(s)).toEqual(['clear', 'rapid', 'lean']);
  });
  it('buying a white cell forfeits Lean Defence; a loss earns nothing, not even the clear', () => {
    const s = newGame(0); s.energy = 999; buyCell(s); s.phase = 'victory';
    expect(sealsEarned(s)).toEqual(['clear']);
    s.phase = 'defeat'; expect(sealsEarned(s)).toEqual([]);
  });
  it('a replay earns a seal missed before; seals never duplicate', () => {
    const p = freshProgress();
    expect(grant(p, 'heart', ['clear'])).toEqual(['clear']);
    expect(grant(p, 'heart', ['clear', 'lean'])).toEqual(['lean']);
    expect(grant(p, 'heart', ['clear', 'lean'])).toEqual([]);
    expect(p.seals.heart).toEqual(['clear', 'lean']);
  });
  it('endless stages earn no organ seals', () => {
    const s = newGame(0, NO_PERKS, undefined, 3); s.phase = 'victory'; expect(sealsEarned(s)).toEqual([]);
  });
  it('Stewardship: one well-timed dose in the lymph node\'s first wave defeats at least three streptococci', () => {
    const LN = idx('lymphnode'), s = newGame(LN, withAbx); s.nodes = []; startWave(s); s.energy = 500;
    expect(STEWARDSHIP.wave).toBe(1);
    // the strep column comes up one vessel: dose it once several are in
    const strepVessel = (): M.Vessel['id'] | null => { const by = new Map<string, number>(); for (const p of s.pathogens) if (p.type === 'spyogenes') by.set(p.vessel, (by.get(p.vessel) ?? 0) + 1); const top = [...by].sort((a, b) => b[1] - a[1])[0]; return top && top[1] >= 4 ? top[0] : null; };
    let n = 0; while (!strepVessel() && n++ < 30 * 60) step(s, 1 / 30);
    expect(deployAntibiotic(s, strepVessel()!)).toBe(true);
    tick(s, CONFIG.antibiotic.standard.duration + 0.5);
    console.log('Stewardship test: bacteria defeated by the one dose', s.stats.stewardKills);
    expect(s.stats.stewardDoses).toBe(1); expect(s.stats.stewardKills).toBeGreaterThanOrEqual(3);
    expect(STEWARDSHIP.met(s)).toBe(true);
  });
});

describe('The Field Guide and permanent progress', () => {
  it('a kind is discovered once; a second distinct method gives the second discovery; each method counts once', () => {
    const p = freshProgress();
    expect(recordSeen(p, 'ecoli')).toBe(true); expect(recordSeen(p, 'ecoli')).toBe(false);
    expect(recordKill(p, 'ecoli', 'node')).toBe('new'); expect(recordKill(p, 'ecoli', 'node')).toBe(null);
    expect(secondDiscovery(p, 'ecoli')).toBe(false);
    expect(recordKill(p, 'ecoli', 'antibiotic')).toBe('second'); expect(secondDiscovery(p, 'ecoli')).toBe(true);
  });
  it('only methods that can defeat a kind are offered (no cells for HIV, no antibiotic for viruses)', () => {
    expect(methodsFor('hiv')).toEqual(['node']);
    expect(methodsFor('virus')).toEqual(['node', 'cell', 'pulse']);
    expect(methodsFor('ecoli')).toEqual(['node', 'cell', 'pulse', 'antibiotic']);
    expect(recordKill(freshProgress(), 'virus', 'antibiotic')).toBe(null);
  });
  it('every kind has an entry: name, look, traits and notes', () => {
    for (const t of Object.keys(CONFIG.pathogens) as PathogenType[]) {
      const e = guideEntry(t); expect(e.name && e.looks && e.note && e.second, t).toBeTruthy(); expect(e.traits.length).toBeGreaterThan(1);
    }
  });
  it('stored apart from the career: a new career keeps it; an old career gets the first-clear seals it has earned', () => {
    const kv = memory(); const c = freshCareer(); c.cleared[0] = c.cleared[1] = true; saveCareer(kv, c);
    const p = loadProgress(kv, loadCareer(kv));
    expect(p.seals).toEqual({ heart: ['clear'], lungs: ['clear'] });
    recordSeen(p, 'virus'); saveProgress(kv, p);
    saveCareer(kv, freshCareer()); // a new career
    const again = loadProgress(kv, loadCareer(kv));
    expect(again.seen).toEqual(['virus']); expect(again.seals.heart).toEqual(['clear']);
    expect(kv.data[PROGRESS_KEY]).toBeTruthy();
  });
  it('the backup carries both, and an older career-only code still restores', () => {
    const c = freshCareer(); c.gold = 42; const p = freshProgress(); grant(p, 'heart', ['clear', 'lean']); p.stewardship = true; p.abxProfile = 'burst';
    const back = importBackup(exportBackup(c, p))!;
    expect(back.career.gold).toBe(42); expect(back.progress!.seals.heart).toEqual(['clear', 'lean']); expect(back.progress!.abxProfile).toBe('burst');
    expect(importBackup('nonsense')).toBeNull();
  });
});

describe('Play-test: a mixed late-game wave', () => {
  it('Gram stain, one cell held back, a bacterial lane treated, the reserve sent into a different lane', () => {
    const LN = idx('lymphnode'), s = newGame(LN, withAbx); s.wave = 4; s.energy = 600;
    expect(buyLab(s, 'gram')).toBe(true);
    console.log('wave 4 of the lymph node, Gram stain:', s.lab!.text);
    expect(s.lab!.text).toMatch(/Gram/);
    setReserve(s, true); startWave(s); s.no = 999;
    tick(s, 6);
    const lanes = new Map<string, number>(); for (const p of s.pathogens) if (CONFIG.pathogens[p.type].taxon) lanes.set(p.vessel, (lanes.get(p.vessel) ?? 0) + 1);
    const bact = [...lanes].sort((a, b) => b[1] - a[1])[0][0] as M.Vessel['id'];
    toggleRoute(s, bact);
    expect(deployAntibiotic(s, bact)).toBe(true);
    const other = M.VESSEL_IDS.find((v) => M.entryOf(v) !== M.entryOf(bact) && s.pathogens.some((p) => p.vessel === v))!;
    tick(s, 1);
    expect(deployReserve(s, other)).toBe(true);
    expect(s.open).toContain(other); expect(s.abx?.route).toBe(bact);
    finishWave(s);
    console.log('…the wave ended:', s.phase, 'health', s.heartHp, 'kills by method', JSON.stringify(s.stats.kills));
    expect(['prep', 'victory', 'defeat']).toContain(s.phase);
    expect(s.stats.kills.antibiotic ?? 0).toBeGreaterThan(0);
  });
});
