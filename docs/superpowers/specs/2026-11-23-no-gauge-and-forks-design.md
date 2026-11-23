# NO gauge, mid-wave dilation and forking vessels — design

Date: 2026-11-23 · Status: draft for approval

## Intent

Today the player picks one vessel to dilate *before* a wave and then watches. The user wants **more decisions during the wave**, and wants the resource behind dilation to be **costly**. So dilation moves into the wave and is paid for with a scarce gauge of nitric oxide (NO), the real vasodilator. Each organ also grows by one route into the organ, and from the brain onward some vessels **fork** on their way in, with pathogens steering away from the route you have opened.

Success: during a wave the player is repeatedly choosing *whether* to open a route now, *which* one, and *when* to close it to save NO, and those choices visibly matter (leaks, lost cells, wins by a margin).

## Goals

1. Dilation happens only during a wave. A wave starts with every vessel at rest; starting a wave no longer requires a choice.
2. A NO gauge is the fuel for dilation. Opening costs NO, staying open drains it, and when it runs out the route closes and the white cells return to the organ.
3. The player can open, switch and close routes as often as NO allows during a wave.
4. Each organ has one more route into the organ than the one before: heart 4, lungs 5, brain 6, liver 7, kidney 8.
5. From the brain onward, some vessels fork: one vessel enters from the map edge, runs a shared stem, and splits into two branches that both reach the organ. Pathogens reaching a fork take the branch that is **not** dilated.
6. The balance contract still holds on every organ: the scripted sensible player wins, a player who never builds loses, white cells alone lose heart wave 1.

## Non-goals

- Forks inside forks, vessels that merge, more than one fork per vessel.
- Changes to lymph node types, the immune pulse, bosses or the organ twists (surge, the brain's site limit, liver regrowth, filtration) beyond what the new maps and NO force.
- Building lymph nodes during a wave (still between waves only).

## Anti-goals (would make this a failure even if it works)

- **NO so generous that the best play is "open the busiest route and leave it open".** That brings back the old one-choice game.
- Maps so crowded that vessels, sites or labels overlap or can't be clicked (especially the kidney with 8 routes).
- Forks where the player can't see which way a pathogen went or which branch is open.

## Constraints

- TypeScript, Vite, Vitest, Canvas 2D at a logical 1600×1000. The rules stay in `src/sim.ts` with no DOM; all tuning in `src/config.ts`.
- Saved progress (localStorage unlocks) must keep working; the save format holds only unlocks, so it should be unaffected.
- Mouse, touch and keyboard must all work. Keys 1–8 select routes in the panel's order.
- Public pages avoid real studio or brand names.

## Approaches considered (for forks)

- **A. Each route is a full vessel; forked routes share a stem — chosen.** A forking vessel is stored as two complete routes from the map edge to the organ whose first stretch is identical. Everything that measures distance along one line (movement, targeting, cells, pulse, surge, filtration) keeps working. Limits: one fork per vessel, no nesting, which is all this design needs. Chosen because it does everything agreed with the least change to tested code.
- **B. A true graph of segments and junctions.** Most flexible, but rewrites movement, targeting, the pulse, filtration and site placement. Not needed.
- **C. Assign the route at spawn.** Simplest, but pathogens couldn't react to the open route at the fork, which breaks "steer away". Rejected.

## The design

### Routes and forks (approach A)

- The level map lists **vessels** as now. A vessel may carry a `fork`: two branches, each a list of points continuing from the stem's last point to the organ. A vessel without a fork is a single route, as today.
- `level.ts` expands each forked vessel into **two routes** (e.g. `left` → `leftA`, `leftB`), each with full points stem+branch, and records the **fork distance** (the stem's length) and the **sibling route**.
- "Route" is what the player dilates, what cells travel and what keys 1–8 select. Wave groups name the **vessel** (the entry); for an unforked vessel that is the route itself.
- **Pathogens on a forked vessel** spawn on the vessel's stem, *undecided*. When one crosses the fork distance it commits to a branch:
  - if exactly one branch is dilated, it takes the **other** branch;
  - otherwise (neither open, or — not possible with one dilation — both) branches **alternate** per vessel, starting with A.
  - It keeps its distance travelled; only its route changes. Once committed it stays committed even if dilation changes.
- Undecided pathogens are drawn on the stem; committed ones on their branch. The fork point is drawn as a visible junction.

### Lymph node sites on forked vessels

- Sites are placed along the stem and along each branch. A **stem site** guards both routes (it targets any pathogen of that vessel still on the stem, and any on either branch within reach); a **branch site** guards only its branch.
- The brain keeps "two sites per vessel" meaning *per route*: its forked vessel gets one stem site and one site per branch (3 sites, 2 on any one route). Other organs: builder's call on fractions, aiming for roughly 3 sites per route and no overlaps.

### Dilation during the wave

- Phase `prep`: no dilation; you build and press **Start wave** (no longer blocked on a choice). The panel explains you'll dilate during the wave.
- Phase `combat`: click/tap a route or press its key to **open** it. Opening another route **switches** (the old one relaxes at the existing `dilateRate`, the new one opens and is paid for). Clicking/pressing the open route again **closes** it.
- At most one route is open at a time.
- **White cells** wait at the organ (home) while nothing is open. When a route opens, home cells set out along it. When it closes (by the player, by NO running out, or by a switch), cells head home at recall speed; on reaching home they set out along the currently open route, if any. Cells don't fight while returning, and *(my call)* **cells waiting at home don't fight either**: with every route closed the organ relies on its lymph nodes alone, so closing to save NO is a real risk. Cells on a forked route may travel out past the fork up the stem; on the stem they engage undecided pathogens of that vessel.
- End of wave: the open route closes for free, cells return, the existing recall/reset flow continues.

### NO gauge (my proposed numbers; balance tests will tune them)

| Rule | Value |
|---|---|
| Capacity | 100 |
| Start of each organ | full |
| Cost to open (or switch to) a route | 15 |
| Drain while a route is open | 8 per second (≈ 11 s from full) |
| Regeneration while nothing is open (combat only) | 3 per second |
| Top-up after each cleared wave | +35, capped at capacity |
| Opening needs at least | the opening cost |

When the gauge hits 0 the route closes and the cells return. The NO gauge carries over between waves (it is not refilled to full), which keeps it scarce across the organ. Organ twists don't alter NO. All values live in `CONFIG.no`.

### Immune pulse

Unchanged in spirit: once per wave, a burst around each white cell that is out on a route, hitting pathogens on that cell's route (stem included, so it can hit undecided pathogens of a forked vessel). If no cells are out, the pulse is unavailable with a reason ("Open a route to send your white cells out first.").

### Maps

| Organ | Entry vessels | Forks | Routes |
|---|---|---|---|
| Heart | 4 | 0 | 4 |
| Lungs | 5 | 0 | 5 |
| Brain | 5 | 1 | 6 |
| Liver | 5 | 2 | 7 |
| Kidney | 5 | 3 | 8 |

New vessels and forks must meet their organ's drawing, keep sites off the organ and each other, and stay readable. Liver keeps the portal vein as its long signature vessel (it may be one of the forks). Waves gain groups on the new vessels; boss waves stay one boss each.

### UI

- NO gauge shown in the HUD/panel (bar + number), and as a small bar near the organ on the map; it flashes when too low to open.
- Panel during combat lists routes as buttons (open / switch / close), labelled with their key; between waves those buttons are hidden or disabled with the hint "Dilate during the wave".
- Toasts: "Not enough NO to open the …", "NO ran out: the … contracts and your white cells return."
- Hover/cursor on routes during combat (not prep). Sites remain prep-only.
- Wave preview: for a forked vessel, show it as the vessel with a "forks" note.

### Tests and balance

- Replace the prep-dilation tests with: start wave without a choice; open/switch/close during combat; opening costs NO; drain; auto-close at 0 sends cells home; regen while closed; top-up between waves; no dilation in prep.
- New fork tests: pathogens take the undilated branch; alternate when none is open; commitment is permanent; stem sites hit both branches; cells on a forked route engage on the stem.
- Map tests: route counts 4/5/6/7/8, forks only from the brain on, every route reaches the organ, sites per route (brain ≤ 2).
- The scripted sensible player gains a mid-wave dilation policy (e.g. open the route with the most pathogens near the organ when NO allows, close when it's clear) and must win every organ; never-building must lose. The README balance figures are updated from the new run.
- *(My call.)* The baseline players ("never builds", "white cells alone, heart wave 1") use the **same mid-wave dilation policy** as the sensible player, so the contract measures building, not dilation skill. Starting energy, starting nodes and waves may be retuned per organ to keep the contract.
- *(My call.)* The anti-goal becomes a test: a scripted **hold-open player** (builds like the sensible player, but opens the busiest route as soon as it can and never closes it; reopens whenever NO allows after running out) must, on every organ, either lose or finish with **less organ health than the sensible player**. Ties count as failure. Both results are logged next to the sensible player's.

### Docs

README's "How it plays", controls, tuning and balance sections, and in-game wave hints, rewritten for mid-wave dilation, NO and forks.

## Left to the builder

- Exact point lists for new vessels and branches, site fractions, and new wave groups.
- The sensible player's exact dilation policy, and final NO numbers, within the anti-goal above.
- Route ids/labels, visual treatment of the fork junction and NO bar.
- Code structure inside `level.ts`/`sim.ts` for routes vs vessels.
