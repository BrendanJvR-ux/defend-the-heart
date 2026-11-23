# NO Gauge, Mid-Wave Dilation and Forking Vessels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move dilation into the wave, pay for it with a scarce NO gauge, give every organ one more route than the last, and add forking vessels from the brain on, with pathogens steering away from the open branch.

**Architecture:** Approach A from the spec. A forked vessel is expanded in `level.ts` into two full routes (stem + branch) that share identical stem points, so every distance-along-one-line rule keeps working. `VESSEL_IDS`/`VESSELS` become the list of **routes**; a small set of route helpers (`entryOf`, `forkAt`, `siblingOf`) and one coverage predicate decide what shares a stretch of vessel. NO is a number on `State`, spent and refilled inside `step()`.

**Tech Stack:** TypeScript 5.9, Vite 6, Vitest 3, Canvas 2D (logical 1600×1000), HTML/CSS panel.

**Spec:** `docs/superpowers/specs/2026-11-23-no-gauge-and-forks-design.md`

## Global Constraints

- Rules stay in `src/sim.ts` with no DOM; every tuning value lives in `src/config.ts`.
- NO defaults (in `CONFIG.no`): capacity 100, full at the start of each organ, open/switch cost 15, drain 8/s while open, regen 3/s while nothing is open (combat only), +35 after each cleared wave (capped), opening needs at least the opening cost. Tune only via the balance tests.
- Routes into the organ: heart 4, lungs 5, brain 6, liver 7, kidney 8. Entry vessels 4/5/5/5/5; forks 0/0/1/2/3; at most one fork per vessel, no nesting, no merges.
- At most one route open at a time. Lymph nodes still build between waves only. Node types, pulse, bosses and organ twists unchanged except as forced by maps/NO.
- Cells waiting at home and cells returning do not fight and cannot be infected.
- Keys 1–8 select routes in panel order; mouse, touch and keyboard all work.
- Public pages avoid real studio or brand names.
- Node is at `~/.local/node/bin` (`export PATH=~/.local/node/bin:$PATH`). Commits authored as `BrendanJvR-ux`, message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every task ends with `npm test` and `npm run typecheck` both green.

## Review Focus

1. **Switching while cells are still returning** — open A, close, open B before cells get home: cells must finish going home, then go out along B (never teleport, never walk B from A's coordinates). Test in Task 1.
2. **NO hitting exactly 0 mid-frame with a big `dt`** — gauge never goes negative, route closes once, cells return. Test in Task 1.
3. **Infected cell or split/shed pathogen created on a stem** — it must be undecided if before the fork and choose a branch when it crosses, like any other pathogen. Test in Task 2.
4. **Clicking the shared stem** — picks a route deterministically (the open one if its sibling shares the stem, else branch A), never errors. Covered by `routeAtStem` test in Task 2.
5. **Pressing a route key between waves or during recall** — does nothing harmful and explains "Dilate during the wave". Test (`toggleRoute` returns not-ok in prep/recall) in Task 1.

---

### Task 1: NO gauge and mid-wave dilation (existing maps)

**Files:**
- Modify: `src/config.ts` (add `CONFIG.no`; rewrite wave hints that say "dilate it" to say "open it during the wave")
- Modify: `src/sim.ts` (State, `newGame`, `startWave`, `canStartWave`, cell movement, `easeWidths`, `pulseCheck`, `recall`; remove `selectVessel`)
- Modify: `src/main.ts` (route clicks/keys in combat, panel route buttons, NO gauge, toasts)
- Modify: `src/draw.ts` (NO bar beside the organ; hover on routes in combat; skip drawing cells at home)
- Test: `tests/game.test.ts`

**Interfaces:**
- Produces:
  - `CONFIG.no: { max: number; openCost: number; drainPerSec: number; regenPerSec: number; waveTopUp: number }`
  - `State.no: number`, `State.noOuts: number` (increments each time NO runs dry; UI toasts on change)
  - `WhiteCell.mode: 'home' | 'out' | 'returning'` (replaces `home: boolean`; recall uses `mode !== 'home'`)
  - `dilateCheck(s: State, r: VesselId): { ok: boolean; reason: string }` — reasons: `'Dilate during the wave.'` (not combat), `'Not a vessel of this organ.'`, `'Not enough NO to open the <name>.'`
  - `toggleRoute(s: State, r: VesselId): boolean` — combat only; `r === s.dilated` closes; otherwise pays `openCost` and opens `r` (switching closes the old one).
  - `closeRoute(s: State): void` — sets `dilated = null`, cells `out` → `returning`.
  - `outCells(s: State): WhiteCell[]` — alive, uninfected, `mode === 'out'`.
- `canStartWave` no longer requires a dilation; `selectVessel` is deleted (tests and UI move to `toggleRoute`).

- [ ] **Step 1: Write the failing tests** (replace the `dilation, cells and the pulse` tests that call `selectVessel` in prep)

```ts
describe('Defend the Heart: NO and mid-wave dilation', () => {
  it('a wave starts with every vessel resting and needs no choice', () => {
    const s = newGame(0); expect(canStartWave(s).ok).toBe(true); expect(startWave(s)).toBe(true);
    expect(s.dilated).toBeNull(); expect(s.no).toBe(CONFIG.no.max);
    expect(s.cells.every((c) => c.mode === 'home')).toBe(true);
  });
  it('dilation is refused between waves and during recall', () => {
    const s = newGame(0); expect(toggleRoute(s, 'left')).toBe(false);
    expect(dilateCheck(s, 'left').reason).toBe('Dilate during the wave.');
    startWave(s); quiet(s); finishWaveUntil(s, 'recall'); expect(toggleRoute(s, 'left')).toBe(false);
  });
  it('opening costs NO, an open route drains it, a closed one regains it', () => {
    const s = newGame(0); startWave(s); quiet(s);
    toggleRoute(s, 'left'); expect(s.no).toBe(CONFIG.no.max - CONFIG.no.openCost);
    const a = s.no; tick(s, 1); expect(a - s.no).toBeCloseTo(CONFIG.no.drainPerSec, 0);
    toggleRoute(s, 'left'); expect(s.dilated).toBeNull();
    const b = s.no; tick(s, 1); expect(s.no - b).toBeCloseTo(CONFIG.no.regenPerSec, 0);
  });
  it('switching pays again; too little NO refuses', () => {
    const s = newGame(0); startWave(s); quiet(s);
    toggleRoute(s, 'left'); toggleRoute(s, 'right');
    expect(s.dilated).toBe('right'); expect(s.no).toBe(CONFIG.no.max - 2 * CONFIG.no.openCost);
    s.no = CONFIG.no.openCost - 1; expect(toggleRoute(s, 'left')).toBe(false); expect(s.dilated).toBe('right');
  });
  it('running dry closes the route once, never goes negative, and sends the cells home', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 0.5); s.no = 0.1; step(s, 0.1);
    expect(s.no).toBe(0); expect(s.dilated).toBeNull(); expect(s.noOuts).toBe(1);
    expect(s.cells.every((c) => c.mode !== 'out')).toBe(true);
  });
  it('cells go out along the opened route; reopening another waits for them to get home first', () => {
    const s = newGame(0); startWave(s); quiet(s); mk(s, 'bacterium', 'upper', 10);
    toggleRoute(s, 'left'); tick(s, 3);
    expect(outCells(s).every((c) => c.vessel === 'left' && c.s < M.VESSELS.left.length - 20)).toBe(true);
    toggleRoute(s, 'right'); step(s, 1 / 30);
    expect(s.cells.every((c) => c.vessel === 'left' && c.mode === 'returning')).toBe(true);
    tick(s, 6); expect(outCells(s).length).toBe(2); expect(outCells(s).every((c) => c.vessel === 'right')).toBe(true);
  });
  it('cells at home or returning neither fight nor get infected', () => {
    const s = newGame(0); startWave(s); quiet(s);
    const h = mk(s, 'hijacker', 'left', M.VESSELS.left.length - 6); const hp = h.hp; tick(s, 0.1);
    expect(s.infections).toBe(0); expect(h.hp).toBe(hp);
  });
  it('the pulse needs cells out on a route', () => {
    const s = newGame(0); startWave(s); quiet(s);
    expect(pulseCheck(s).reason).toBe('Open a vessel to send your white cells out first.');
  });
  it('after a cleared wave NO tops up, capped at capacity, and every vessel rests', () => {
    const s = newGame(0); startWave(s); quiet(s); s.no = 50; finishWave(s);
    expect(s.phase).toBe('prep'); expect(s.no).toBe(50 + CONFIG.no.waveTopUp); expect(s.dilated).toBeNull();
    const t = newGame(0); startWave(t); quiet(t); finishWave(t); expect(t.no).toBe(CONFIG.no.max);
  });
});
```

Add the helper `finishWaveUntil(s, phase)` (steps until `s.phase === phase`, capped like `finishWave`). Keep the existing "nodes fire on their own vessel", "pulse never damages a resting vessel", "pulse misses early / hits a cluster / works once", "defeat and restart" tests, rewritten to `startWave` then `toggleRoute` instead of `selectVessel` before the wave. Update the organ tests the same way (lungs surge, brain three cells, liver regrowth, kidney filtration, "vessel from another organ cannot be dilated" → `toggleRoute(s,'portal')` in combat returns false).

- [ ] **Step 2: Run to verify they fail**

Run: `export PATH=~/.local/node/bin:$PATH && npx vitest run -t "NO and mid-wave"`
Expected: FAIL (`toggleRoute` is not a function / `s.no` undefined).

- [ ] **Step 3: Implement in `src/config.ts` and `src/sim.ts`**

- `CONFIG.no = { max: 100, openCost: 15, drainPerSec: 8, regenPerSec: 3, waveTopUp: 35 }`.
- `newGame`: `no: CONFIG.no.max, noOuts: 0`.
- `startWave`: create the level's cells with `mode: 'home'`, on no particular route (give them `vessel` = first route, `s` = its length; position is irrelevant while home).
- `step` (combat), before cell movement: if `dilated`, `no -= drainPerSec*dt`; when `no <= 0` set `no = 0`, `noOuts++`, `closeRoute(s)`; else `no = min(max, no + regenPerSec*dt)`.
- Cells: `home` cells, when `dilated` is set, switch to `vessel = dilated`, `s = length − 8 − rank*30`, `mode = 'out'`. `out` cells behave exactly as today. `returning` cells move toward the organ at `whiteCell.recallSpeed` and become `home` at the end. Only `out` cells fight, take contact damage, or can be infected.
- `easeWidths`: a route is open only when `s.dilated === v && s.phase === 'combat'`.
- `pulseCheck`/`pulseTargets`/`firePulse` use `outCells`; the no-cells reason is `'Open a vessel to send your white cells out first.'`.
- End of combat: `closeRoute(s)` (free), then recall as now using `mode`. On recall completion: `no = min(max, no + waveTopUp)`.

- [ ] **Step 4: Update the test harness's scripted players**

In `tests/game.test.ts`:
- `sensibleBuild(s)` keeps its build logic but no longer dilates.
- Add `sensibleDilate(s: State)`, run every tick of combat (combine with the pulse in the `each` callback of `finishWave`). Policy: route danger = summed hp of pathogens on that route with `p.s > 0.3 * length`. If the best route's danger is 0 → close. If nothing is open and best danger > 0 and `no ≥ openCost` → open it. If open and another route's danger > 2× the open route's danger and `no ≥ openCost + 10` → switch. (The builder may tune these thresholds; record final values in a comment.)
- New signature `play(prep: (s: State) => void, dilate: (s: State) => void, pulseMin = 3, level = 0)`; each combat tick runs `dilate` then the cluster pulse; the never-builds and cells-alone baselines use `sensibleDilate` too (spec: baselines dilate the same way).

- [ ] **Step 5: Run the full suite; retune until the balance contract holds**

Run: `npx vitest run`
Expected: all pass, including "sensible player wins" on every organ, "never building loses" on every organ, "white cells alone leak in heart wave 1". If not, tune `CONFIG.no`, starting energy, starting nodes or wave counts — in that order of preference — and note each change in the commit message.

- [ ] **Step 6: UI in `src/main.ts` and `src/draw.ts`**

- Clicking/tapping a route or pressing its key during combat calls `toggleRoute`; on refusal toast the `dilateCheck` reason. In prep, route clicks/keys toast "Dilate during the wave." (sites still open the build popover in prep).
- Panel combat section: a NO bar with the number, and one button per route (`data-act="dilate"`, label, "open/key N", `aria-pressed`). Prep section: replace the "Choose exactly one" block with one line: "During the wave, open one vessel at a time with NO. Opening costs 15; an open vessel drains NO; closed, it refills."
- Toast on `s.noOuts` change: "NO ran out: the <name> contracts and your white cells return."
- Map: a small NO bar under the organ's health beads (reuse `bar()`), flashing when `no < openCost`; route hover highlight in combat instead of prep; do not draw cells whose `mode === 'home'`; the DILATED tag follows `s.dilated` as now.
- Add `s.no`, `s.dilated` to `signature()` (rounded NO) so the panel refreshes.

- [ ] **Step 7: Verify**

Run: `npx vitest run && npm run typecheck`
Expected: all tests pass, no type errors. Then `npm run dev`, play a heart wave: open, switch, close, run dry; confirm the bar, toasts and cells behave as the tests describe.

- [ ] **Step 8: Commit**

```bash
git add src tests && git -c user.name=BrendanJvR-ux commit -m "Dilate during the wave, fuelled by a NO gauge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Forking vessels (route model)

**Files:**
- Modify: `src/config.ts` (vessel def gains optional `fork`)
- Modify: `src/level.ts` (expand forks into routes; route helpers; site placement per route with stem flag; `loadLevelDef` for tests)
- Modify: `src/sim.ts` (spawn on stem, commit at fork, coverage predicate used by nodes, cells, pulse)
- Modify: `src/draw.ts`, `src/main.ts` (draw stem once with a junction; route labels on branches; stem click)
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: Task 1's `toggleRoute`, `outCells`, `WhiteCell.mode`.
- Produces:
  - Config: vessel def `{ id, name, label, pts, fork?: { branches: [Branch, Branch] } }`, `Branch = { id: VesselId; name: string; label: string; pts: P[] }` where each branch's `pts` start after the stem's last point and end at the organ. Wave groups keep naming the **entry** vessel id.
  - `level.ts`: `VESSEL_IDS` / `VESSELS` list **routes** (an unforked vessel's route id is the vessel id; a forked vessel yields its two branch ids; each route's `pts` = stem pts + branch pts). New exports: `ENTRY_IDS: VesselId[]`, `entryOf(r): VesselId`, `forkAt(r): number` (stem length, `Infinity` if unforked), `siblingOf(r): VesselId | null`, `routesOf(entry): VesselId[]`, `routeAtStem(entry, dilated): VesselId`, and `loadLevelDef(def: LevelDef)` (what `loadLevel` calls; tests use it with a fixture).
  - `Site` gains `stem: boolean`.
  - `Pathogen` gains `committed: boolean`. `State` gains `forkFlip: Record<VesselId, number>` keyed by entry.
  - `sim.ts`: `covers(route: VesselId, p: Pathogen, stemSite = false): boolean` — true if `entryOf(p.vessel) === entryOf(route)` and (`p.vessel === route` or `p.s < forkAt(route)` or `stemSite`).
  - `spawnRoute(entry)`: first route of the entry (`routesOf(entry)[0]`).

- [ ] **Step 1: Write the failing tests** using a fixture level (clone `LEVELS[0]`, replace `left` with a forked vessel `left` → branches `leftA`, `leftB`, stem ≈ half the old vessel) loaded with `loadLevelDef`, and `newGame` after it

```ts
describe('Defend the Heart: forking vessels', () => {
  it('a forked vessel becomes two routes sharing an identical stem', () => {
    expect(M.VESSEL_IDS).toEqual(['leftA', 'leftB', 'right', 'lower', 'upper']);
    expect(M.entryOf('leftB')).toBe('left'); expect(M.siblingOf('leftA')).toBe('leftB');
    const f = M.forkAt('leftA'); expect(f).toBe(M.forkAt('leftB'));
    for (const d of [0, f / 2, f - 1]) expect(dist(M.pointAt(M.VESSELS.leftA, d), M.pointAt(M.VESSELS.leftB, d))).toBeLessThan(0.01);
    expect(M.forkAt('right')).toBe(Infinity);
  });
  it('pathogens take the branch that is not dilated', () => {
    const s = fixtureGame(); startWave(s); quiet(s); toggleRoute(s, 'leftA');
    const p = mk(s, 'bacterium', 'leftA', M.forkAt('leftA') - 1); p.committed = false; tick(s, 0.5);
    expect(p.vessel).toBe('leftB'); expect(p.committed).toBe(true);
  });
  it('with neither branch open they alternate, starting with A', () => {
    const s = fixtureGame(); startWave(s); quiet(s); const f = M.forkAt('leftA');
    const ps = [0, 1, 2].map(() => Object.assign(mk(s, 'virus', 'leftA', f - 1), { committed: false })); tick(s, 0.3);
    expect(ps.map((p) => p.vessel)).toEqual(['leftA', 'leftB', 'leftA']);
  });
  it('a committed pathogen keeps its branch when dilation changes', () => {
    const s = fixtureGame(); startWave(s); quiet(s); const f = M.forkAt('leftA');
    const p = Object.assign(mk(s, 'virus', 'leftA', f + 20), { committed: true }); toggleRoute(s, 'leftA'); tick(s, 0.2);
    expect(p.vessel).toBe('leftA');
  });
  it('a stem site guards both branches; a branch site only its own', () => {
    const s = fixtureGame(); const stem = M.SITES.find((x) => x.stem && M.entryOf(x.vessel) === 'left')!;
    const branchB = M.SITES.find((x) => !x.stem && x.vessel === 'leftB')!;
    const onA = Object.assign(mk(s, 'virus', 'leftA', M.forkAt('leftA') + 30), { committed: true });
    expect(covers(stem.vessel, onA, true)).toBe(true); expect(covers(branchB.vessel, onA)).toBe(false);
  });
  it('stem sites are not duplicated across the two routes', () => {
    const stems = M.SITES.filter((x) => x.stem && M.entryOf(x.vessel) === 'left');
    expect(new Set(stems.map((x) => `${Math.round(x.x)},${Math.round(x.y)}`)).size).toBe(stems.length);
  });
  it('cells on a branch engage undecided pathogens up the stem', () => {
    const s = fixtureGame(); startWave(s); quiet(s); toggleRoute(s, 'leftB');
    const p = Object.assign(mk(s, 'bacterium', 'leftA', M.forkAt('leftA') - 40), { committed: false }); const hp = p.hp;
    tick(s, 8); expect(p.hp).toBeLessThan(hp);
  });
  it('an infected cell or split pathogen made on the stem is undecided and chooses at the fork', () => {
    const s = fixtureGame(); startWave(s); quiet(s); toggleRoute(s, 'leftB'); tick(s, 6);
    const c = outCells(s)[0]; c.s = M.forkAt('leftB') - 30;
    infect(s, c, mk(s, 'hijacker', 'leftB', c.s));
    const e = s.pathogens.find((x) => x.type === 'infected')!; expect(e.committed).toBe(false);
    tick(s, 2); expect(e.vessel).toBe('leftA');
  });
  it('clicking the shared stem picks the open route, else branch A', () => {
    expect(M.routeAtStem('left', 'leftB')).toBe('leftB'); expect(M.routeAtStem('left', null)).toBe('leftA');
  });
});
```

`fixtureGame()` = `loadLevelDef(FIXTURE); return newGameOnLoaded()` — add `newGame(level, def?)` overload or a `newGameFromDef(def)`; builder's choice, but tests must restore with `loadLevel(0)` in `afterEach`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run -t "forking vessels"`
Expected: FAIL (`loadLevelDef` / `entryOf` missing).

- [ ] **Step 3: Implement routes in `src/level.ts`**

- `loadLevelDef` builds routes: unforked vessel → one route; forked → two routes with `pts = [...stem.pts, ...branch.pts]`, recording `forkAt` = stem length, sibling and entry.
- Sites: for each route, at each `siteFractions` distance `d = length * f`: if `d < forkAt` the site is a stem site and is created **only for the first route** of its entry (`stem: true`); otherwise a branch site for that route. In clearance checks treat the sibling route as the same vessel (use the `o === v` allowance for `entryOf(o) === entryOf(v)`).
- `routeAtStem(entry, dilated)` returns `dilated` if it belongs to `entry`, else `routesOf(entry)[0]`.

- [ ] **Step 4: Implement fork behaviour in `src/sim.ts`**

- Wave spawns map `g.vessel` (entry) → `spawnRoute(entry)`; new pathogens get `committed = s < forkAt(route)` ? false : true. Same in `infect`, `splitInto` and `sheds` (they use the parent's route and position).
- In `step`, after movement: any uncommitted pathogen with `p.s >= forkAt(p.vessel)` commits: if exactly one of the entry's routes is `s.dilated`, take the other; else take `routesOf(entry)[s.forkFlip[entry] % 2]` and increment `forkFlip[entry]`.
- Replace every `p.vessel === X` "same vessel" test with `covers`: node targeting (`covers(n.vessel, p, site.stem)`), cell `mine` (`covers(c.vessel, p)`), `pulseTargets` (`covers(c.vessel, p)`). Shots keep their stored route.
- Kidney filtration and lung surge keep using `VESSELS[p.vessel].length` (routes are full length; no change).

- [ ] **Step 5: Draw and click in `src/draw.ts` / `src/main.ts`**

- Draw routes as now, but the open route last so its widened stem sits on top; draw a junction disc (wall colours) at each fork point. Put each route's label on its branch (at `forkAt + 80`), and the entry's name on the stem.
- `vesselAt(p)`: if the nearest point is on a stem (`d < forkAt`), return `routeAtStem(entry, s.dilated)`.
- Pathogen preview tags are per **entry**; forked entries add "· forks".

- [ ] **Step 6: Verify**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, including every Task 1 test and the balance tests (no shipped map forks yet, so balance is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src tests && git -c user.name=BrendanJvR-ux commit -m "Forking vessels: pathogens steer away from the open branch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: New maps, waves and the hold-open check

**Files:**
- Modify: `src/config.ts` (`LEVELS[1..4].map.vessels`, `siteFractions`, `waves`, possibly `startEnergy`/`startingNodes`)
- Modify: `src/organs.ts` only if a new vessel needs an attachment point drawn on the organ
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: Task 2's `fork` vessel def, `ENTRY_IDS`, `routesOf`, `forkAt`; Task 1's `sensibleDilate`.
- Produces: shipped maps with route counts 4/5/6/7/8.

- [ ] **Step 1: Write the failing tests**

```ts
it('each organ has one more route than the last; forks only from the brain on', () => {
  const expected = [[4, 4, 0], [5, 5, 0], [5, 6, 1], [5, 7, 2], [5, 8, 3]]; // entries, routes, forks
  LEVELS.forEach((_, i) => { newGame(i); const forks = M.ENTRY_IDS.filter((e) => M.routesOf(e).length === 2).length;
    expect([M.ENTRY_IDS.length, M.VESSEL_IDS.length, forks]).toEqual(expected[i]); });
});
it('every route ends at its organ and no two routes cross off their shared stem', () => { /* each route's last point has organClearance(...) < 10; for routes of different entries, sampled points stay ≥ 40 apart */ });
it('brain: at most two sites on any route', () => { newGame(2); for (const r of M.VESSEL_IDS) expect(M.SITES.filter((x) => x.vessel === r || (x.stem && M.entryOf(x.vessel) === M.entryOf(r))).length).toBeLessThanOrEqual(2); });
it('every wave group names an entry vessel of its organ; every entry is used by some wave', () => { /* … */ });
it('a hold-open player does worse than the sensible player on every organ', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const good = play(sensibleBuild, sensibleDilate, 3, i), hold = play(sensibleBuild, holdOpen, 3, i);
    console.log(LEVELS[i].id, 'sensible', good.hp, 'hold-open', hold.hp, hold.s.phase);
    expect(hold.s.phase === 'defeat' || hold.s.heartHp < good.s.heartHp).toBe(true);
  }
});
```

`holdOpen(s)`: at combat start open the route of the entry with the most wave threat (route A for forked); never close; whenever nothing is open and `no ≥ openCost`, reopen it.

Replace the old "every vessel has `siteFractions.length` sites" check with: every route has ≥ 2 sites guarding it (its own or stem), and every site keeps the existing clearance rules.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run -t "one more route|hold-open|at most two sites"`
Expected: FAIL (route counts 4/3/4/4/4).

- [ ] **Step 3: Author the maps and waves in `src/config.ts`**

- Lungs: 3 → 5 entries (add two vessels from free edges). Brain: 4 → 5 entries, one of them forked. Liver: 4 → 5 entries, two forked; keep the portal vein long (it may be one of the forks). Kidney: 4 → 5 entries, three forked.
- Each new vessel/branch ends on the organ's outline (`organClearance` ≈ 0), stays ≥ 40 from other entries' vessels, and leaves room for sites. Labels: "Left (upper branch)" style; keep labels short enough to fit.
- Add wave groups on the new entries in every wave so each entry is used; boss waves keep exactly one boss.

- [ ] **Step 4: Run, retune, repeat**

Run: `npx vitest run`
Expected: all pass, including sensible-wins, never-builds-loses and hold-open-worse on every organ. Tune in this order: wave groups, `startEnergy`, `startingNodes`, `CONFIG.no`. If `CONFIG.no` changes, rerun Task 1's NO tests (they read from `CONFIG`).

- [ ] **Step 5: Look at every organ**

Run `npm run dev`, open each organ (unlock via devtools `localStorage` or the level picker), and check at 1600×1000 and a 390-wide phone viewport: no overlapping vessels, sites or labels; forks readable; every route clickable.

- [ ] **Step 6: Commit**

```bash
git add src tests && git -c user.name=BrendanJvR-ux commit -m "One more route per organ, forks from the brain on

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs, deploy and live check

**Files:**
- Modify: `README.md` (organ table vessel/route counts; "How it plays" steps 1, 3–6; controls 1–8; tuning mentions `CONFIG.no` and `fork`; balance figures from the new test logs, including hold-open; files table mentions routes in `level.ts`)
- Modify: `src/config.ts` wave `hint`s and organ `twist`/`tagline` text that still describe choosing before the wave

- [ ] **Step 1: Update the text**, using the figures printed by `npx vitest run` (sensible and hold-open end health per organ).

- [ ] **Step 2: Verify**

Run: `npx vitest run && npm run build`
Expected: pass and a clean build. `grep -n "before the wave\|Choose exactly one\|locked during a wave" README.md src` returns nothing.

- [ ] **Step 3: Commit, push, deploy**

```bash
git add README.md src && git -c user.name=BrendanJvR-ux commit -m "README and hints: NO gauge, mid-wave dilation, forks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
npm run deploy
```

- [ ] **Step 4: Check the live site**

Open https://brendanjvr-ux.github.io/defend-the-heart/ (hard reload), play heart wave 1 (open, close, run dry), and open the brain to see a fork. Expected: the deployed build matches local behaviour and there are no console errors.
