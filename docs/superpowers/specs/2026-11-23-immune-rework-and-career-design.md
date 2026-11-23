# Immune rework, menu, career mode and an easier heart — design

Date: 2026-11-23 · Status: draft for approval

## Intent

Four connected changes, asked for together:

1. **The heart is too hard for new players.** The first organ should be winnable by someone still learning the controls.
2. **A menu with New game / Continue**, so a game can be left and picked up again.
3. **A more biological IgG.** Armour goes. IgG becomes type-specific: each IgG node is aimed at one organism and hits it, its relatives (same shape, same Gram stain) and unrelated organisms with different strengths. This rewards reading the wave and choosing the right antibody.
4. **Career mode with gold.** Clearing organs earns gold, spent on permanent upgrades: stronger node types, more IgG targets, dual-target IgG and a few general boosts.

Success: a new player clears the heart; a returning player continues where they left off; choosing the right IgG target visibly matters; gold gives a reason to replay and push on.

## Goals

1. Remove armour from every pathogen and every rule.
2. Node lineup (base values, before upgrades):

| Node | Cost | Damage | Cooldown | Reach | Special |
|---|---|---|---|---|---|
| IgM | 60 | 10 | 0.9 s | 175 | Hits everything the same. |
| IgG | 50 | 10 × match | 0.8 s | 175 | Aimed at one organism (or two, if dual-target is bought). |
| IgA | 50 | 7.5 | 0.7 s | 175 | Slows to ×0.5 for 2.2 s (as now). |
| IgE | 80 | 20 | 0.9 s | 230 | Burns out after its third wave; no boss priority, no boss bonus. Keeps its longer reach. |

3. **IgG match multiplier** (the single best match applies, never stacked):

| Pathogen vs the node's target | × |
|---|---|
| Same species | 3 |
| Same shape (coccus / rod) | 2.5 |
| Same Gram stain | 2 |
| A bacterium sharing none of those | 0.5 |
| Not a bacterium (viruses, hijackers, infected cells, viral bosses) | 0.25 |

   With two targets, each hit uses the better of the two multipliers.

4. **Named bacteria** replace the generic bacterium. All six keep today's bacterium health (70) and speed (30) and differ in look and taxonomy:

| Species | Gram | Shape | Appears in |
|---|---|---|---|
| *Staphylococcus aureus* | + | coccus | every organ |
| *Streptococcus pneumoniae* | + | coccus | lungs, brain |
| *Listeria monocytogenes* | + | rod | brain |
| *Neisseria meningitidis* | − | coccus | brain |
| *Escherichia coli* | − | rod | liver, kidney |
| *Klebsiella pneumoniae* | − | rod | lungs, liver |

   Bosses take the taxonomy of what they are: the staph colony is *S. aureus*; meningococcus is *N. meningitidis*; the mother virus, hepatitis giant and sepsis hijacker are viruses (×0.25 for any IgG). The colony still bursts into *S. aureus*.
   **Re-aiming** *(my call)*: between waves, a placed IgG node can be re-aimed at any unlocked target for 20 energy, or (once dual-target is bought) given a second target by paying the 30 difference. The liver's starting IgG node becomes IgM, since its portal bacteria don't match *S. aureus*.
5. **IgE lifetime**: an IgE node fights in up to three waves. At the end of its third wave (after the wave clears) it bursts with a small effect, and its site is free for the next build phase. The site's popover shows "waves left".
6. **More build sites**: about two more per route on the heart, lungs, liver and kidney (e.g. heart/lungs/kidney 3 → 5 fractions, liver 4 → 6). The brain keeps two per route (its twist).
7. **Menu** shown when the game loads, and from a **Menu** button in the top bar (pauses the game):
   - **Continue** (only when a save exists): resumes the career at the last build phase saved.
   - **New career**: starts over at the heart with no gold or upgrades; confirms first if a career exists.
   - **Upgrades**: the gold shop.
   - **Organs**: the existing level picker (cleared organs replayable). *(My call)* There is one game in progress at a time: starting a different organ while one is saved asks "This ends your <organ> run" first.
8. **Saving**: the career (gold, purchases, organs cleared, best health per organ) and the game in progress (organ, wave, organ health, energy, NO, nodes with type, IgG target(s) and IgE waves fought) are saved in `localStorage` under one versioned key whenever a build phase begins and when an organ ends. Quitting mid-wave and continuing returns to that wave's build phase as it was saved. *(My call)* Losing an organ ends that run: Continue then starts the organ again from wave 1 (as Restart does today). Older saves (`dth-unlocked`, `dth-level`) migrate into it: `dth-unlocked − 1` organs count as cleared (the stored number is organs unlocked, one more than cleared), with no gold.
9. **Gold**: clearing an organ for the first time pays `100 × level number + 5 × organ health left` (heart: 100 + up to 100). Replaying a cleared organ pays a quarter of that, rounded down. Gold is shown on the menu, the shop and the victory screen.
10. **The shop** (prices are starting points for tuning):

| Upgrade | Levels | Price | Effect |
|---|---|---|---|
| IgM / IgG / IgA / IgE damage | 3 each | 80, 160, 240 | +15% damage per level for that node type |
| IgG target: one per species except *S. aureus* | 1 each | 120 | That target can be chosen when placing IgG |
| Dual-target IgG | 1 | 600 | IgG nodes may be aimed at two unlocked targets; a dual node costs 80 |
| NO capacity | 2 | 100, 200 | +20 NO capacity per level |
| Extra starting node | 1 | 150 | Each organ starts with one more IgM already placed |
| Cheaper first node | 1 | 150 | The first node placed in each build phase costs half |

   *S. aureus* is unlocked from the start.
11. **An easier heart**: more starting energy, more organ health, a gentler waves 1–2, and hints that say what to do. Checked by a new **clumsy player** script that must win the heart: it builds only IgM, on the first free sites in list order, opens the busiest vessel only once a pathogen is 80% of the way in, and never pulses.
12. **Balance contract.** *(User's call: later organs may need upgrades.)*
    - **Without upgrades**, the sensible player (choosing IgG targets from those unlocked, which is only *S. aureus*) wins the heart with at least 12/20 and wins the lungs; the clumsy player wins the heart.
    - **A scripted career**: the sensible player plays heart → kidney in order, banking gold and buying upgrades by a fixed policy (first the IgG targets for the next organ's species, then damage for the node types it builds most, then the rest), and wins every organ on its first attempt.
    - **Never building** loses every organ, even with every upgrade bought.
    - **Holding one vessel open**, with the career player's upgrades at that organ, loses or ends at least 2 health worse than the sensible player, on every organ.

    The README's balance figures are updated from the test run.

## Non-goals

- Every organ winnable without upgrades: from the brain on, organs may need some (the scripted career shows how much).
- No new organs, bosses or twists; no online accounts or cloud saves.
- Viruses stay generic (no virus species or antiviral IgG).
- No mid-wave saving.

## Anti-goals

- Placing IgG becomes a long menu that slows every build (keep target choice to one quick pick).
- A mismatched IgG feels pointless with no feedback (show the multiplier on hits: big numbers for ×3, small grey ones for ×0.25).
- Gold farming the heart beats progressing (replays pay a quarter).
- A save bug that loses a player's career (versioned key, defensive parsing, never overwrite with an unparseable value).

## Constraints

- TypeScript, Vite, Vitest, Canvas 2D at 1600×1000, HTML/CSS panel; rules stay DOM-free in `src/sim.ts`; tuning in `src/config.ts`.
- `localStorage` may be unavailable (private mode): the game still runs, it just doesn't persist (as today).
- Mouse, touch and keyboard all work for the menu, shop and IgG target picker.
- Public pages avoid real studio or brand names.

## Approach (agreed)

**Four stages, each shipped on its own** (tests green, deployed, live site checked):

1. **Immune system** — goals 1–6 and the balance contract minus the heart/clumsy parts; every IgG target is selectable in this stage.
2. **Menu and saving** — goals 7–8.
3. **Career** — goals 9–10; IgG targets become locked except *S. aureus*.
4. **Easier heart** — goal 11 and the full contract (goal 12).

Rejected: one big release (hard to review; balance problems hard to place); career first (the shop would be priced around nodes about to change).

Code shape: species and multipliers in `config.ts` / `sim.ts`; a new `src/career.ts` holds gold, purchases, upgrade effects and the versioned save, with no DOM, so it is unit-tested; the menu, shop and IgG picker live in `main.ts` (with CSS in `style.css`); bacteria drawings in `draw.ts` (or a new `src/bacteria.ts` beside `bosses.ts`).

## The parts the user decided

- Later organs may need upgrades.
- Armour removed entirely (not just IgG's stripping).
- IgG mismatch: ×0.5 vs an unrelated bacterium, ×0.25 vs non-bacteria.
- IgM = IgG at ×1; IgA = 75% of IgM plus slow; IgE = 2× IgM and burns out after its third wave, freeing its site.
- *S. aureus* in every organ; more build sites.
- IgG targets unlocked with gold; dual-target IgG (one node, two targets) as a much more expensive upgrade.
- The upgrade list in goal 10.
- Four shipped stages, in that order.

## Left to the builder

- Exact drawings for the six bacteria and the IgE burst.
- Boss hints and blurbs rewritten: IgE is no longer the boss counter *(my call, following the user's IgE change)*.
- Wave rewrites naming species per organ (keeping each organ's character and boss), site fractions, and final tuning of health, energy, costs and prices within the contract.
- The sensible player's IgG target policy, and save-format field names.
- Menu and shop layout (within the project's existing paper-and-ink style).
