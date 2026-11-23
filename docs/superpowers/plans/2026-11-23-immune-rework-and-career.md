# Immune Rework, Menu, Career and an Easier Heart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove armour, rework the lymph nodes around targeted IgG and named bacteria, add a menu with saving, a gold-funded career with an upgrade shop, and make the heart friendly to new players — shipped in four stages.

**Architecture:** Taxonomy and node numbers live in `src/config.ts`; the damage rule (`iggMultiplier`, `nodeDamage`) in `src/sim.ts`. A new DOM-free `src/career.ts` owns gold, purchases, perks and the versioned save; `newGame` takes the perks. The menu, shop and IgG target picker are HTML in `src/main.ts` / `src/style.css`. Bacteria drawings move to a new `src/bacteria.ts` (beside `bosses.ts`).

**Tech Stack:** TypeScript 5.9, Vite 6, Vitest 3, Canvas 2D (1600×1000), HTML/CSS panel, `localStorage`.

**Spec:** `docs/superpowers/specs/2026-11-23-immune-rework-and-career-design.md`

## Global Constraints

- Rules stay DOM-free in `src/sim.ts` / `src/career.ts`; tuning in `src/config.ts`.
- No armour anywhere: no `armour`, `shred`, `effectiveArmour` or "armour" wording left in `src/`, `tests/` or `README.md` (except history in docs).
- Node base values: IgM 60 cost / 10 dmg / 0.9 s / 175; IgG 50 / 10×match / 0.8 s / 175; IgA 50 / 7.5 / 0.7 s / 175, slow ×0.5 for 2.2 s; IgE 80 / 20 / 0.9 s / 230, burns out after its 3rd wave.
- IgG match (best single match, never stacked): species ×3, shape ×2.5, Gram ×2, unrelated bacterium ×0.5, non-bacterium ×0.25.
- Species: S. aureus (+, coccus), S. pneumoniae (+, coccus), Listeria (+, rod), N. meningitidis (−, coccus), E. coli (−, rod), Klebsiella (−, rod); all hp 70, speed 30. Colony = S. aureus; meningo = N. meningitidis; other bosses non-bacteria.
- Gold: first clear `100 × levelNumber + 5 × healthLeft`; replay = floor(¼ of that).
- Shop: damage per node type 3 levels 80/160/240 (+15% each); IgG targets 120 each (S. aureus free); dual-target 600 (dual node costs 80); NO capacity 2 levels 100/200 (+20 each); extra starting node 150; cheaper first node 150 (first node each build phase half price).
- IgG re-aim between waves: 20 energy; adding a second target once dual is bought: 30.
- `localStorage` may throw or be missing (private mode): reads fall back to a fresh career, writes are skipped, play continues.
- Save key `dth-career-v1`; migrate `dth-unlocked` (cleared = value − 1) and `dth-level`. Never write an unparseable value; unreadable saves are left untouched and a fresh career is used.
- Each stage ends: `npx vitest run` and `npx tsc --noEmit` green, README updated, commit, push `main`, `npm run deploy`, live site checked.
- Node at `~/.local/node/bin`. Commits authored `BrendanJvR-ux`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on a branch per stage, fast-forward into `main` at ship.

## Review Focus

1. **A corrupt or older save** (truncated JSON, missing fields, a future version): the game must start, never crash, never overwrite the bad value. Test in Task 4.
2. **Continue after the code changed the organ's sites** (a saved node on a site id that no longer exists): drop that node, keep the rest. Test in Task 4.
3. **IgE burning out while its site is selected / its popover open**: popover closes, site reopens, no stale node. Test (`IgE removed after its third cleared wave; site is free`) in Task 1.
4. **Dual-target IgG against a pathogen matching both targets differently**: uses the higher multiplier, never the product. Test in Task 1.
5. **Buying with exactly enough gold / at max level**: exact gold succeeds to 0; a maxed upgrade refuses without spending. Test in Task 5.

---

## Stage 1 — The immune system

### Task 1: Armour out, targeted IgG, new IgM/IgA/IgE, named bacteria (rules)

**Files:** Modify `src/config.ts`, `src/sim.ts`; Test `tests/game.test.ts`.

**Interfaces:**
- Produces (config):
  - `type BacteriumType = 'saureus' | 'spneumo' | 'listeria' | 'nmening' | 'ecoli' | 'kpneumo'`; `PathogenType = BacteriumType | 'virus' | 'hijacker' | 'infected' | BossType` (no `'bacterium'`).
  - `PathogenStats.taxon?: { gram: '+' | '-'; shape: 'coccus' | 'rod'; species: BacteriumType }` (set on the six bacteria, `colony` → saureus, `meningo` → nmening). `armour` removed.
  - `NodeStats`: remove `shred`, `shredSeconds`, `bossDamage`; add `burnsOutAfter?: number` (IgE: 3).
  - `CONFIG.iggMatch = { species: 3, shape: 2.5, gram: 2, unrelated: 0.5, nonBacterium: 0.25 }`, `CONFIG.iggRetarget = 20`, `CONFIG.dualIggCost = 80`.
  - `BACTERIA: BacteriumType[]` in that order.
- Produces (sim):
  - `LymphNode` gains `targets: BacteriumType[]` (IgG only; 1 or 2) and `wavesFought: number`.
  - `iggMultiplier(targets: BacteriumType[], type: PathogenType): number`
  - `nodeDamage(s: State, n: LymphNode, type: PathogenType): number` (base × IgG match; Task 5 adds upgrades).
  - `hurt(s, p, dmg)` (no armour flag).
  - `buildCheck(s, siteId, type, targets?: BacteriumType[])`, `placeNode(s, siteId, type, targets?: BacteriumType[])` — IgG needs exactly 1 target in Stage 1 (Stage 1 has no perks); Task 5 allows 2 when `s.perks.dual`.
  - `retargetNode(s, siteId, targets: BacteriumType[]): boolean` (prep only, IgG only, pays `iggRetarget`). Task 5 adds going from 1 to 2 targets for 30 when `s.perks.dual`.
  - `State.spent: { site: string; at: Vec }[]` cleared each prep — IgE nodes removed this recall (for the UI ring).

- [ ] **Step 1: Write the failing tests** (replace the armour/IgE-boss tests in `immunoglobulins` and `IgE boss-hunter` describes)

```ts
describe('Defend the Heart: the IgG match', () => {
  it('species ×3, shape ×2.5, Gram ×2, unrelated bacterium ×0.5, not a bacterium ×0.25', () => {
    expect(iggMultiplier(['spneumo'], 'spneumo')).toBe(3);
    expect(iggMultiplier(['spneumo'], 'saureus')).toBe(2.5);   // another coccus
    expect(iggMultiplier(['spneumo'], 'listeria')).toBe(2);    // Gram-positive rod
    expect(iggMultiplier(['spneumo'], 'ecoli')).toBe(0.5);     // nothing shared
    expect(iggMultiplier(['spneumo'], 'nmening')).toBe(2.5);   // coccus beats Gram mismatch
    for (const t of ['virus', 'hijacker', 'infected', 'flu', 'hepatitis', 'sepsis'] as PathogenType[]) expect(iggMultiplier(['spneumo'], t)).toBe(0.25);
    expect(iggMultiplier(['saureus'], 'colony')).toBe(3);
    expect(iggMultiplier(['nmening'], 'meningo')).toBe(3);
  });
  it('a dual target uses the better match, never the product', () => {
    expect(iggMultiplier(['ecoli', 'saureus'], 'spneumo')).toBe(2.5);
    expect(iggMultiplier(['ecoli', 'saureus'], 'kpneumo')).toBe(2.5);
    expect(iggMultiplier(['ecoli', 'listeria'], 'listeria')).toBe(3);
  });
});
describe('Defend the Heart: lymph nodes', () => {
  it('there is no armour: an IgM hit takes exactly its damage from a bacterium', () => { /* oneShot('igm','saureus').dmg === 10 */ });
  it('IgM hits everything for 10; IgA for 7.5 and slows; IgE for 20', () => { /* oneShot for each vs 'ecoli' and 'virus' */ });
  it('IgG damage is 10 × its match', () => { /* oneShot igg target spneumo vs spneumo → 30, vs ecoli → 5, vs virus → 2.5 */ });
  it('IgG needs a target; a second target is refused without dual-target', () => {
    const s = newGame(0); const site = M.SITES.find((x) => !nodeAt(s, x.id))!;
    expect(buildCheck(s, site.id, 'igg').reason).toBe('Choose what this IgG targets.');
    expect(placeNode(s, site.id, 'igg', ['saureus', 'ecoli'])).toBe(false);
    expect(placeNode(s, site.id, 'igg', ['saureus'])).toBe(true);
  });
  it('an IgG node can be re-aimed between waves for 20 energy, not during a wave', () => { /* … */ });
  it('IgE removed after its third cleared wave; its site is free for the next build', () => {
    // place IgE, clear three quiet waves; after waves 1 and 2 it remains (wavesFought 1, 2); after 3 it is gone, s.spent names the site, buildCheck on it is ok
  });
  it('IgE has no boss priority: it shoots the most advanced pathogen in reach, boss or not', () => { /* boss behind a virus: virus hit first */ });
});
```

Keep `oneShot` (set pathogen speed 0, wait for one hit) as the helper; it now takes `targets` for IgG.

- [ ] **Step 2: Run to see them fail** — `npx vitest run -t "IgG match|lymph nodes"` → FAIL (`iggMultiplier` not exported).

- [ ] **Step 3: Implement in `config.ts` / `sim.ts`.** Remove every armour/shred/bossDamage use (`effectiveArmour`, `p.shred*`, IgE boss rank). Pathogen stats: the six species `{ hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7 }`; virus hp 10 (IgM one-shots), hijacker hp 16, infected 55, bosses keep hp (retuned in Task 3). Colony `splitInto: { type: 'saureus' }`. IgE: at recall completion, increment `wavesFought` for every node; remove IgE nodes with `wavesFought >= burnsOutAfter`, push to `s.spent`, ring `'pop'`, floater "IgE spent". Node floaters: an IgG hit with match ≥ 2.5 shows its damage in the IgG colour; ≤ 0.5 shows it small and grey (`Floater` gains optional `size`).

- [ ] **Step 4: Run** — `npx vitest run -t "IgG match|lymph nodes"` → PASS. (Balance tests may fail until Task 3.)

- [ ] **Step 5: Commit** — "Immune rework: no armour, targeted IgG, IgE burns out".

### Task 2: Bacteria drawings, IgG target picker, re-aim, more sites (UI and maps)

**Files:** Create `src/bacteria.ts`; Modify `src/draw.ts`, `src/main.ts`, `src/style.css`, `src/config.ts` (siteFractions); Test `tests/game.test.ts`.

**Interfaces:** Consumes Task 1's `BACTERIA`, `taxon`, `placeNode(..., targets)`, `retargetNode`, `State.spent`. Produces `drawBacterium(ctx, type: BacteriumType, x, y, angle, hit, scale)` called by `drawPathogen`.

- [ ] **Step 1: Failing test** — sites:

```ts
it('more build sites: five guarding each route on the heart, lungs and kidney, six on the liver, two on the brain', () => {
  const want = [5, 5, 2, 6, 5];
  LEVELS.forEach((_, i) => { newGame(i); for (const r of M.VESSEL_IDS) expect(guarding(r).length).toBe(want[i]); });
});
```

(If a site can't fit on a crowded route, reduce that organ's expectation to "≥ 4" and ledger it.)

- [ ] **Step 2: Run, see it fail; then set `siteFractions`** (heart/lungs/kidney 5 values ≈ `[0.2, 0.35, 0.5, 0.65, 0.8]`, liver 6 ≈ `[0.18, 0.32, 0.46, 0.6, 0.74, 0.88]`) and adjust `makeSites` spacing (`dist(p, s) - 80` → `- 64`) until it passes with the label-layout tests still green.

- [ ] **Step 3: Drawings** in `src/bacteria.ts`: S. aureus = grape cluster of cocci (gold); S. pneumoniae = lancet-shaped diplococcus chain (violet); Listeria = short rod with tumbling flagella (teal); N. meningitidis = kidney-bean diplococcus pair (pink-red); E. coli = rod with peritrichous flagella (green, today's look); Klebsiella = fat rod in a thick mucoid capsule (blue-grey). Each ≈ 34×20 at scale 1; hit flash white like today. Use these in the wave preview icons and panel threat list (name in italics, e.g. *S. aureus*, with "Gram+ coccus").

- [ ] **Step 4: IgG picker.** Choosing IgG in the build popover replaces the type list with a target list: one button per selectable species (Stage 1: all six), each with its icon, short name and "Gram±, coccus/rod"; Esc / × goes back. A placed IgG node's popover shows its target(s) and a **Re-aim (20)** button opening the same list. Keyboard: the list is buttons, first focused. The Lymph nodes key in the panel explains the multipliers in one line.

- [ ] **Step 5: IgE in the UI.** Node popover shows "Burns out after N more wave(s)"; when `s.spent` is non-empty at prep, close any popover on that site and toast "IgE spent: the site beside the <vessel> is free again."

- [ ] **Step 6: Verify** — `npx vitest run && npx tsc --noEmit`; then in the browser place IgG with a target, re-aim it, watch an IgE burn out on the heart, and check each organ's map for overlaps.

- [ ] **Step 7: Commit** — "Six bacteria, IgG target picker, more build sites".

### Task 3: Waves with named bacteria; rebalance; ship Stage 1

**Files:** Modify `src/config.ts` (waves, hints, blurbs, energy, boss hp), `tests/game.test.ts` (harness), `README.md`.

**Interfaces:** Consumes Tasks 1–2. Produces the harness's `sensibleBuild` choosing IgG targets: for each vessel, the species with the most wave health on it (IgG only where bacteria dominate the vessel's threat; IgM elsewhere; IgA for viral swarms).

- [ ] **Step 1: Failing tests**

```ts
it('S. aureus comes in every organ; each organ uses only its own species', () => {
  const own = [['saureus'], ['saureus', 'spneumo', 'kpneumo'], ['saureus', 'spneumo', 'listeria', 'nmening'], ['saureus', 'ecoli', 'kpneumo'], ['saureus', 'ecoli']];
  LEVELS.forEach((l, i) => {
    const kinds = new Set(l.waves.flatMap((w) => w.groups.map((g) => g.type)).filter((t) => CONFIG.pathogens[t].taxon && !CONFIG.pathogens[t].boss));
    expect(kinds.has('saureus')).toBe(true);
    for (const k of kinds) expect(own[i]).toContain(k);
  });
});
it('no armour is left anywhere', () => { for (const p of Object.values(CONFIG.pathogens)) expect('armour' in p).toBe(false); });
```

- [ ] **Step 2: Rewrite every `'bacterium'` group** with the organ's species (heart: S. aureus only; others mix as in the test), rewrite hints that mention armour/IgE-for-bosses (e.g. heart wave 3: "Staph comes in clusters. An IgG node aimed at *S. aureus* hits it three times as hard."; boss hints name what works: IgG anti-S. aureus on the colony, anti-N. meningitidis on meningococcus, IgM/IgE on the viral bosses).

- [ ] **Step 3: Rebalance** to the Stage-1 contract with every target selectable and no upgrades: sensible wins every organ; never building loses every organ; hold-open loses or ends ≥ 2 worse. Tune in order: wave sizes, start energy, boss hp. Record figures.

- [ ] **Step 4: README** — node table, IgG match table, the six bacteria, IgE burnout, no armour, balance figures, files table (`src/bacteria.ts`).

- [ ] **Step 5: Ship** — `npx vitest run && npx tsc --noEmit && npm run build`; commit "Named bacteria in every organ; rebalance"; fast-forward `main`, push, `npm run deploy`, wait for the new bundle, check the live heart (IgG picker, an IgE burning out) and console.

---

## Stage 2 — Menu and saving

### Task 4: `career.ts` save, migration, Continue; the menu

**Files:** Create `src/career.ts`; Modify `src/sim.ts` (state from a save), `src/main.ts`, `index.html` (Menu button), `src/style.css`; Test `tests/career.test.ts`.

**Interfaces:**
- `interface KV { get(k: string): string | null; set(k: string, v: string): void }`
- `interface RunSave { level: number; wave: number; heartHp: number; energy: number; no: number; nodes: { site: string; type: NodeType; targets: BacteriumType[]; wavesFought: number }[] }`
- `interface Career { version: 1; gold: number; cleared: boolean[]; best: number[]; bought: Partial<Record<UpgradeId, number>>; run: RunSave | null }` (`UpgradeId` defined now, used in Task 5)
- `freshCareer(): Career`; `loadCareer(kv: KV): Career` (reads `dth-career-v1`; else migrates `dth-unlocked`/`dth-level`; else fresh; unreadable → fresh, nothing written); `saveCareer(kv: KV, c: Career): void`
- `snapshot(s: State): RunSave`; `resumeGame(run: RunSave): State` (in `sim.ts`: `newGame(run.level)` then apply fields; nodes on unknown sites dropped)
- `unlockedCount(c): number` = cleared count + 1, capped at 5.

- [ ] **Step 1: Failing tests** (`tests/career.test.ts`, with an in-memory `KV`)

```ts
it('a fresh career has no gold, nothing cleared, no run', () => { /* … */ });
it('migrates old progress: dth-unlocked 3 means heart and lungs cleared', () => { /* cleared = [true,true,false,false,false]; gold 0 */ });
it('an unreadable save starts a fresh career and is not overwritten', () => { /* kv holds '{"version":1,"gold":'; loadCareer → fresh; kv value unchanged */ });
it('a save from a future version is left alone', () => { /* version 2 → fresh, untouched */ });
it('snapshot and resume round-trip a build phase: wave, health, energy, NO, nodes with targets and waves fought', () => { /* … */ });
it('a saved node on a site that no longer exists is dropped; the rest load', () => { /* … */ });
it('losing an organ clears the run', () => { /* onOrganEnd(c, s) with defeat → run null */ });
```

- [ ] **Step 2: Run, see them fail; implement `career.ts`** and `resumeGame`. Main saves (`saveCareer`) on every entry into `prep` and on victory/defeat (defeat → `run = null`; victory → `cleared[level] = true`, `best[level]`, `run = null`).

- [ ] **Step 3: The menu.** An overlay shown on load and from a new **Menu** top-bar button (pauses): title, **Continue** (only with a run; shows "Kidney · wave 3"), **New career** (confirm if a career exists: "Start over? Your gold and upgrades will be lost."), **Organs** (the level picker; picking another organ while a run exists confirms "This ends your <organ> run"), and in Stage 3 **Upgrades**. Keyboard: buttons in order, Esc closes when a game is running. The old in-panel level card stays for between waves.

- [ ] **Step 4: Verify** — tests + typecheck; browser: play two waves, reload, Continue restores wave/nodes/NO; New career confirms; a hand-corrupted save starts fresh without a crash.

- [ ] **Step 5: Ship** — README (menu, saving); commit "Menu with New career and Continue; saved between waves"; fast-forward, push, deploy, live check (Continue across a reload).

---

## Stage 3 — Career

### Task 5: Gold, the shop, perks in play

**Files:** Modify `src/career.ts`, `src/sim.ts`, `src/config.ts` (`UPGRADES`, `GOLD`), `src/main.ts`, `src/style.css`; Test `tests/career.test.ts`, `tests/game.test.ts`.

**Interfaces:**
- `type UpgradeId = 'dmg-igm' | 'dmg-igg' | 'dmg-iga' | 'dmg-ige' | `target-${Exclude<BacteriumType,'saureus'>}` | 'dual' | 'no' | 'extraNode' | 'cheapFirst'`
- `UPGRADES: Record<UpgradeId, { name: string; blurb: string; prices: number[] }>` (values per Global Constraints)
- `goldFor(level: number, healthLeft: number, firstClear: boolean): number`
- `buy(c: Career, id: UpgradeId): { ok: boolean; reason: string }` (reasons: "Not enough gold.", "Already at the top level.")
- `interface Perks { dmg: Record<NodeType, number>; targets: BacteriumType[]; dual: boolean; noMax: number; extraNode: boolean; cheapFirst: boolean }`; `perksOf(c: Career): Perks`; `NO_PERKS: Perks` (targets ['saureus'], noMax 100, dmg all 1).
- `newGame(level, perks: Perks = NO_PERKS)`; `State.perks`, `State.firstNodeDiscount: boolean` (reset each prep).
- `nodeDamage` multiplies by `perks.dmg[type]`; `no` capacity uses `perks.noMax`; `buildCheck` refuses IgG targets not in `perks.targets` ("Unlock this target in Upgrades.") and two targets without `perks.dual`; cost halves for the first node each prep with `cheapFirst`; `extraNode` places one more IgM at the first free site of the busiest wave-1 vessel.

- [ ] **Step 1: Failing tests**

```ts
it('gold: 100 × level + 5 × health left on a first clear, a quarter on a replay', () => {
  expect(goldFor(0, 12, true)).toBe(160); expect(goldFor(4, 10, true)).toBe(550); expect(goldFor(4, 10, false)).toBe(137);
});
it('buying spends exact gold, climbs a level, refuses when poor or maxed without spending', () => { /* gold 80 → buy dmg-igm ok, gold 0; poor → "Not enough gold."; three levels then "Already at the top level." */ });
it('perks: damage +15% per level, targets, dual, NO capacity', () => { /* perksOf after purchases */ });
it('without the target unlocked, IgG can only aim at S. aureus', () => { /* buildCheck reason */ });
it('a damage upgrade raises that node type’s hits by 15% a level', () => { /* oneShot igm with perks dmg 1.3 → 13 */ });
it('dual-target IgG costs 80 and takes two unlocked targets', () => { /* … */ });
it('cheaper first node halves only the first node each build phase', () => { /* … */ });
it('extra starting node places one more IgM', () => { /* … */ });
it('NO capacity perk raises the gauge and its refill cap', () => { /* … */ });
```

- [ ] **Step 2: Run, see them fail; implement.** Victory pays `goldFor` and records it (`best`, `cleared`); the victory overlay shows "+N gold".

- [ ] **Step 3: The shop** — menu **Upgrades** screen: gold at top, sections Node damage / IgG targets / Special, each row with name, blurb, level pips, price button (disabled with reason when unaffordable or maxed). IgG target rows show the species icon and taxonomy. The IgG picker in play shows locked targets greyed with "Unlock in Upgrades".

- [ ] **Step 4: Verify** — tests, typecheck, browser: clear the heart, gold paid, buy a target, it appears in the picker.

- [ ] **Step 5: Commit** — "Career: gold for cleared organs, the upgrade shop".

### Task 6: The scripted career and the Stage-3 contract; ship

**Files:** Modify `tests/game.test.ts` (harness), `src/config.ts` (tuning), `README.md`.

**Interfaces:** Consumes Task 5. Produces `careerRun(policy)` in the test harness: plays organs 0→4 with `perksOf(career)`, pays gold, buys per policy between organs, returns per-organ result and the perks used.

- [ ] **Step 1: Failing tests**

```ts
it('without upgrades the sensible player wins the heart and the lungs', () => { /* play(..., NO_PERKS) on 0 and 1 */ });
it('a scripted career wins every organ on its first attempt', () => {
  // policy: before each organ, buy IgG targets for that organ's species first, then damage for its most-built node type, then dual, NO, extraNode, cheapFirst
});
it('never building loses every organ, even with every upgrade', () => { /* ALL_PERKS */ });
it('holding one vessel open, with the career player’s upgrades at that organ, loses or ends ≥ 2 worse', () => { /* … */ });
```

- [ ] **Step 2: Run, retune to green** (gold prices, organ energy, wave sizes) keeping the brain-onwards organs dependent on upgrades only as far as the career run shows; log per-organ health and gold.

- [ ] **Step 3: Ship** — README (gold, shop table, career contract figures); commit "Career balance"; fast-forward, push, deploy, live check (shop buys persist across reload).

---

## Stage 4 — An easier heart

### Task 7: Easier heart, the clumsy player; ship

**Files:** Modify `src/config.ts` (heart), `tests/game.test.ts`, `README.md`.

- [ ] **Step 1: Failing tests**

```ts
it('a clumsy player (IgM only, first free sites, opens late, never pulses) wins the heart without upgrades', () => { /* … */ });
it('the sensible player ends the heart on at least 12/20 without upgrades', () => { /* … */ });
```

`clumsyBuild`: spends all energy on IgM at the first free sites in `M.SITES` order. `clumsyDilate`: opens the vessel with the most pathogens only once one is past 80% of it; closes when that vessel is clear; never pulses.

- [ ] **Step 2: Run, see them fail; tune the heart** — in order: start energy, organ health, waves 1–2 lighter, a third starting node; rewrite heart hints step by step ("Place an IgM beside the left vessel", "When the bacteria are close, click the vessel to open it", …).

- [ ] **Step 3: Ship** — full suite (every earlier contract still green), README figures; commit "A friendlier heart for new players"; fast-forward, push, deploy, live check of the heart from a fresh career.
