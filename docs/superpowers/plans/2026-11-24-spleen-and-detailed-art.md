# The Spleen and Detailed Organs and Pathogens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth level, the spleen (white cells remade at a health cost, a hiding *Plasmodium* boss, 9 routes), then redraw the six organs and every pathogen with more anatomical detail.

**Architecture:** The spleen is one more `LEVELS` entry plus two small rules in `src/sim.ts` (cell respawn, a boss that hides) and a `drawSpleen` in `src/organs.ts`. The art pass rewrites the organ drawings in `src/organs.ts` / `src/draw.ts` (heart) with their still parts cached in offscreen canvases, and the pathogen drawings in `src/bacteria.ts`, `src/draw.ts` (viruses, infected cells) and `src/bosses.ts`.

**Tech Stack:** TypeScript 5.9, Vite 6, Vitest 3, Canvas 2D (1600×1000).

**Spec:** `docs/superpowers/specs/2026-11-24-spleen-and-detailed-art-design.md`

## Global Constraints

- Rules DOM-free in `src/sim.ts`; tuning in `src/config.ts`.
- Spleen: health 22, 2 white cells, 2 starting nodes, `respawn: { after: 8, cost: 1 }`, 6 entry vessels with 3 forks (9 routes), ≥ 4 sites guarding each route, waves 4 + boss, bacteria exactly `saureus`, `spneumo`, `nmening`, `kpneumo`.
- Boss `plasmodium`: not a bacterium (no `taxon`), `hides: { every: 6, for: 2 }`; while hidden it can't be targeted or hit by nodes, white cells or the pulse, and doesn't touch white cells.
- Gold for a first clear of the spleen: 600 + 5 × health left (existing formula).
- Contract over six organs: scripted career wins all at the first attempt; never building loses all even with every upgrade; holding one vessel open loses or ends ≥ 2 worse; no-upgrade heart ≥ 12/20 and lungs won; clumsy player wins the heart. Figures exact (seeded games).
- Art: same paper-and-ink style; vessels, nodes, effects and panel unchanged; organ still-parts cached offscreen; frame time not slower than before (measured).
- Node at `~/.local/node/bin`; commits authored `BrendanJvR-ux`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; a branch per part, fast-forwarded into `main`, pushed, deployed, live-checked.

## Review Focus

1. **Older five-organ saves** load with six-long `cleared`/`best`, the spleen locked until the kidney is cleared. Test in Task 1.
2. **A white cell lost while the spleen's organ health is 1** — the remake cost can end the game; it must end in defeat cleanly, not go negative. Test in Task 1.
3. **A hidden *Plasmodium* reaching the organ** still damages it (hiding protects it from attacks, not from arriving). Test in Task 1.
4. **Shots already in flight when the boss hides** — they miss (no damage) rather than land. Test in Task 1.
5. **Organ cache after a canvas resize / organ switch** — the cached image is keyed by organ and size, never reused for the wrong organ. Checked in Task 3 by switching organs in the browser.

---

### Task 1: The spleen's rules, map and waves (Part 1); ship

**Files:** Modify `src/config.ts` (`OrganKind`, `BossType`, `LevelDef.respawn`, `PathogenStats.hides`, the spleen level, `plasmodium` stats), `src/sim.ts` (respawn, hiding), `src/organs.ts` (`drawSpleen`), `src/draw.ts` (dispatch), `src/bosses.ts` (a plain *Plasmodium* drawing, refined in Task 3), `README.md`; Test `tests/game.test.ts`, `tests/career.test.ts`.

**Interfaces:**
- `LevelDef.respawn?: { after: number; cost: number }`; `PathogenStats.hides?: { every: number; for: number }`.
- `State.respawns: number[]` — times (s.waveTime) at which lost cells return.
- `hidden(s: State, p: Pathogen): boolean` (exported) — true while a hiding boss is inside a red cell.

- [ ] **Step 1: Failing tests** — update the five-organ assumptions (`ids`, route counts `[6, 9, 3]` appended, five-false arrays → six, `unlockedCount` 6) and add:

```ts
it('spleen: a lost white cell comes back 8 s later and costs 1 health', () => { /* newGame(5); go; kill a cell (hp 0); tick 7.9 → still gone, heart −1 at once; tick 0.2 → a new home cell */ });
it('spleen: an infected cell is remade too', () => { /* infect(s, c, hijacker) → after 8 s a fresh cell */ });
it('spleen: remaking a cell at 1 health loses the organ, never below 0', () => { /* heartHp 1; kill cell; step → defeat, heartHp 0 */ });
it('plasmodium hides for 2 s in every 6, and while hidden nothing hits it', () => { /* node in reach, white cell beside, pulse: no damage while hidden(s,p); damage resumes after */ });
it('a shot in flight when the boss hides misses', () => { /* fire, hide before landing, no damage */ });
it('a hidden plasmodium that reaches the spleen still costs health', () => { /* … */ });
it('plasmodium is not a bacterium: IgG hits it at ×0.25', () => { expect(iggMultiplier(['saureus'], 'plasmodium')).toBe(0.25); });
it('older saves get a sixth, locked organ', () => { /* five-long cleared all true → cleared length 6, unlocked 6, spleen not cleared */ });
```

- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** the rules; author the spleen map (crescent organ at centre ≈ (800, 480), rx ≈ 150, ry ≈ 210), waves and boss; species test, map tests, label and site tests must pass.
- [ ] **Step 4: Balance** — sweep spleen energy and wave size inside the scripted career until the full six-organ contract passes; record exact figures.
- [ ] **Step 5: Browser** — play the spleen: cells come back after a loss, the boss flickers into a red cell and can't be hit, labels/sites readable at desktop and phone width.
- [ ] **Step 6: Ship** — README (organ table, boss table, spleen bacteria, figures); commit "Level 6: the spleen"; fast-forward `main`, push, deploy, live check.

### Task 2: Richer pathogens (Part 2a)

**Files:** Modify `src/bacteria.ts`, `src/draw.ts` (virus, hijacker, infected cell), `src/bosses.ts` (all six bosses incl. *Plasmodium*).

- [ ] **Step 1:** Before changing anything, render the current sheet (every pathogen at 3× and play size) in the browser and save the screenshot for comparison; measure average draw time over 300 frames on the kidney mid-wave (`performance.now()` around `draw`).
- [ ] **Step 2:** Bacteria: cell-wall rim, nucleoid + ribosome speckle (seeded per species so it doesn't shimmer), textured capsules (pneumococcus, meningococcus, Klebsiella), pili on Gram-negatives, beating flagella (E. coli, Listeria). Viruses: faceted capsid with spike proteins; hijacker: spiked envelope distinct from viruses; infected cell: nucleus with visible virions. Bosses enriched to match; *Plasmodium*: red cell with ring-form parasite and a dimmed outline while hidden.
- [ ] **Step 3:** Re-render the sheet; compare; check every pathogen still reads at play size (shape first, colour second). Tests and typecheck green.
- [ ] **Step 4: Commit** — "Richer pathogens".

### Task 3: Richer organs with cached still parts (Part 2b); ship

**Files:** Modify `src/organs.ts`, `src/draw.ts` (heart, organ cache), `README.md`.

**Interfaces:** `organSprite(kind: OrganKind, rx: number, ry: number): HTMLCanvasElement` — cached by key `${kind}:${rx}:${ry}`; the per-frame drawing composes the sprite with live parts (heart beat scale, lung breath, damage flash).

- [ ] **Step 1:** Screenshot each organ before; keep Task 2's frame-time baseline.
- [ ] **Step 2:** Redraw with the anatomy in the spec (heart chambers and coronaries; lungs lobes, fissures, bronchial tree, cartilage rings; brain gyri, cerebellum, brainstem; liver lobes, falciform ligament, gallbladder; kidney cortex, pyramids, pelvis, ureter, adrenal; spleen notches, hilum, red-pulp texture), drawing the still parts into the cached sprite.
- [ ] **Step 3:** Screenshot each organ after; switch organs and resize the window to check the cache key; measure frame time (no slower than the baseline).
- [ ] **Step 4: Ship** — README note; commit "Richer organs"; fast-forward `main`, push, deploy, live check every organ.
