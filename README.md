# Defend the Heart

A fixed top-down 2D anatomy tower defence across six organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels between waves. During a wave you open (dilate) one vessel at a time for your white blood cells, paying for it with a scarce gauge of nitric oxide (NO), and fire one immune pulse per wave. From the brain on, some vessels fork, and pathogens at a fork take the branch you have not opened.

## The organs

Clear an organ to unlock the next. The game opens on a **menu**:

- **Continue** picks up your game where you left it: the organ, the wave, your nodes (with their IgG targets and IgE waves left), energy, organ health and NO. It is saved in your browser at the start of every build phase, so leaving mid-wave brings you back to that wave's build phase. Losing an organ ends that run.
- **New career** starts over at the heart (it asks first if you have progress).
- **Upgrades** is the gold shop (below).
- **Tutorial** replays the guided first wave on the heart.
- **Organs** lists the six organs: cleared ones show your best health and can be replayed. Starting a different organ while a game is in progress asks first.

The **Menu** button in the top bar opens it at any time (the game pauses). Between waves, the **Level** card at the top of the panel also switches organ.

| Level | Organ | Routes in | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ, made for new players: three nodes already placed, gentler first waves, and hints that walk you through building, opening a vessel and aiming IgG. | 20 | 5 + boss |
| 2 | **Lungs** | 5 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×1.5 (the panel counts down to the next breath, the map shows INHALE). | 20 | 4 + boss |
| 3 | **Brain** | 6 (one fork) | **Blood–brain barrier.** Only two lymph node sites guard each route and less health, but three white cells. | 18 | 4 + boss |
| 4 | **Liver** | 7 (two forks) | **Portal vein.** A long vein from the gut brings columns of bacteria (it forks before the liver); the liver **regrows 3 health** after every cleared wave. | 24 | 4 + boss |
| 5 | **Kidney** | 8 (three forks) | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. Hijackers throughout. | 20 | 4 + boss |
| 6 | **Spleen** | 9 (three forks) | **It remakes white cells.** A white cell that is killed or infected comes back at the spleen 8 s later, and the spleen pays 1 health when it does (a cell lost too late in a wave to come back costs nothing). The bacteria it exists to clear: pneumococci, meningococci, *Klebsiella*. | 22 | 4 + boss |

**Play it:** https://brendanjvr-ux.github.io/defend-the-heart/

It began as a conversion of [The Last Ward: Siege of Goosebridge](https://github.com/BrendanJvR-ux/the-last-ward), a storybook tower defence, and now lives in its own repository.

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## When an organ falls

The defeat screen says where the damage came from (how much came up the worst vessel and which pathogen did the most harm, or, on the spleen, how much went on remaking lost white cells) and suggests the counter: an IgG aimed at that bacterium (saying so, with an **Upgrades** button, when that target hasn't been bought yet), IgA for fast viruses, IgM and IgE for viral bosses, or keeping white cells away from hijackers.

## The tutorial

The first time you play the heart, a guided first wave walks you through it, one step at a time, waiting for you at each: place a lymph node (a ring marks the spot), start the wave, open the left vessel when the bacteria are on their way in, how NO keeps it open, and the immune pulse. At the two moments that can't wait (opening the vessel, firing the pulse) time stands still until you act. **Skip tutorial** is always there; the menu's **Tutorial** button replays it.

## Gold and upgrades

Your gold is shown in the top bar. Winning an organ pays gold: **100 × the organ's number + 5 per organ health left** the first time (the heart with 12 health left pays 160), and a quarter of that on a replay. Spend it in **Upgrades**; everything you buy is kept for the whole career and applies at once.

| Upgrade | Levels | Gold | Effect |
|---|---|---|---|
| IgM / IgG / IgA / IgE damage | 3 each | 80, 160, 240 | +15% damage for every node of that type, per level |
| IgG target | 1 each | 120 | Aim IgG at *S. pneumoniae*, *Listeria*, *N. meningitidis*, *E. coli* or *Klebsiella* (*S. aureus* is always unlocked) |
| Dual-target IgG | 1 | 600 | An IgG node can be aimed at two unlocked targets; each hit uses the better match. A dual node costs 80 energy, or 30 to add a second target to a placed one |
| More NO | 2 | 100, 200 | +20 NO capacity per level |
| Extra starting node | 1 | 150 | Every organ starts with one more IgM already placed |
| Cheaper first node | 1 | 150 | The first node you place in each build phase costs half |

The heart and lungs can be won without upgrades; from the brain on, the right IgG targets and some damage make a real difference, and the liver and kidney need them. Before you start an organ, the **Organs** list, a message and the build panel name any of its bacteria you have no IgG target for yet; the shop says which organs each bacterium comes in.

## Bosses

Every organ ends with a boss wave: one giant pathogen with its own trick, plus an escort. While it lives, a **BOSS** banner across the top of the map shows its health; a leaked boss costs 6 to 8 organ health.

| Organ | Boss | Trick | What works |
|---|---|---|---|
| Heart | **Staph colony** | A grape-bunch of *S. aureus*. When it bursts, three weakened staph spill out. | IgG aimed at *S. aureus* (×3) |
| Lungs | **Mother virus** | Releases a new virus every 2.4 s as it travels, and rides the breathing surges. | IgM, IgE |
| Brain | **Meningococcus** | A giant *N. meningitidis* that IgA cannot slow. | IgG aimed at *N. meningitidis* (×3) |
| Liver | **Hepatitis giant** | Regrows 9 health per second as it climbs the long portal vein. | IgM, IgE: damage must outpace it |
| Kidney | **Sepsis hijacker** | A giant hijacker that infects **every** white cell it touches and keeps going. | Nodes, not white cells |
| Spleen | ***Plasmodium*** (malaria) | A parasite, not a bacterium. Every 6 s it hides inside a red blood cell for 2 s (shown faded, with a turning dashed ring and a HIDING tag): nothing can target or hit it then, and antibodies in flight miss. | IgM, IgE, and a pulse timed for when it shows |

## The bacteria

There is no armour: every hit lands in full. Instead, each bacterium has a Gram stain, a shape and a species, and IgG antibodies are aimed at one of them.

| Bacterium | Gram | Shape | Organs |
|---|---|---|---|
| *Staphylococcus aureus* | + | coccus (clusters) | every organ |
| *Streptococcus pneumoniae* | + | coccus (pairs, chains) | lungs, brain, spleen |
| *Listeria monocytogenes* | + | rod | brain |
| *Neisseria meningitidis* | − | coccus (bean-shaped pairs) | brain, spleen |
| *Escherichia coli* | − | rod | liver, kidney |
| *Klebsiella pneumoniae* | − | rod (thick capsule) | lungs, liver, spleen |

All six have 70 health and the same speed; viruses (10 health) are fast and come in groups.

## How it plays

1. **Prepare.** The panel and the map show the next wave: which pathogens, how many, roughly when, and up which vessel (and whether it forks).
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own route; a node on a fork's shared stem guards both branches. Nodes cost energy; you start with 160–314 energy and two nodes already placed (three on the heart), and earn energy for every kill and every wave cleared. From the liver on, energy is tight (kills and cleared waves pay 70–75% as much), so you can fill only about half of the build sites: choose where to build. Every build is saved at once. Most routes have five sites (the liver's more, the brain's two).

| Node | Cost | Damage | Effect |
|---|---|---|---|
| **IgM** | 60 | 10 | Hits every pathogen the same. |
| **IgG** | 50 | 10 × match | **Aimed at one bacterium** (you pick it when you place the node; re-aim between waves for 20 energy). The best single match applies: **×3** its species, **×2.5** the same shape, **×2** the same Gram stain, **×0.5** any other bacterium, **×0.25** anything that is not a bacterium (viruses, hijackers, infected cells, viral bosses). |
| **IgA** | 50 | 7.5 | Slows what it hits to half speed for 2.2 s (not the meningococcus). |
| **IgE** | 80 | 20 | Double damage and a longer reach, but it **burns out after its third wave**; its site is free again for the next build. |

3. **Start the wave.** Every vessel starts at rest, and your white cells (two, or three in the brain) wait at the organ.
4. **Dilate during the wave, with NO.** Click or tap a route (or press 1 to 8) to open it: its walls part and the white cells set out along it, against the flow, under their nodes' cover. Only one route is open at a time; opening another switches, and clicking the open one closes it. The **NO gauge** (100) pays for it: opening or switching costs **15** (and you need at least 23, enough to hold it open for a second), an open route drains **8 a second**, and while every route is closed NO refills **3 a second**; each cleared wave adds **35**. When NO runs out the route closes and the cells head home. Cells at home or heading home don't fight, so every second closed is a second the organ relies on its nodes alone.
5. **Forks** (brain, liver, kidney). A forked vessel splits into two branches on its way in. Pathogens travel the shared stem, and at the fork take the branch you have **not** opened (with neither open, they alternate). Cells on either branch can fight up the stem.
6. **Immune pulse.** Once per wave, a burst around each white cell out on a route hits pathogens on that route only. Fire it into a cluster.
7. **Reset.** Cells return home, every route rests, you earn energy and build again. Organ damage persists until restart (the liver regrows a little).

**Pathogens:** the six bacteria above (slow, tough), viruses (small, fast, in groups), and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** heading for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA / IgE | **Place by list** in the panel |
| Open / switch / close a route (during a wave) | Click / tap a vessel, or the route buttons | 1–8, in the order the panel lists the routes |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Menu, pause, speed, restart | buttons in the top bar (**Speed** steps through ×1, ×1.5, ×2 and ×3) | P to pause; Esc closes the build menu or steps back in the menu |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, slow, burn-out), the IgG match multipliers (`iggMatch`) and re-aim cost, white cells, the pulse, the NO gauge (`no`: capacity, opening cost, drain, refill, top-up), pathogens (health, speed, Gram stain / shape / species for bacteria, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`, `respawn`), its map (organ centre and size, vessel paths with any `fork` and its two branches, where along each route the build sites go) and its waves. [`src/level.ts`](src/level.ts) turns the loaded organ's vessels into routes (a forked vessel becomes two routes sharing a stem) and places the sites.

### Balance assumptions

The figures come from the scripted players in `tests/game.test.ts`. Each game has its own seeded random source (for the small drift of pathogens across a vessel), so the same game always plays out the same way and these figures repeat exactly.


- A scripted sensible player (builds on the least-defended threatened vessels first, at most three nodes per vessel per build; aims IgG with the unlocked target that does most to that vessel's wave, and builds IgM instead when no target helps; during the wave opens the route with the most pathogens past 65% of the way in, keeping 2 s of NO to spare, closes it when clear, switches only for twice the threat; pulses into clusters of three):
  - **without upgrades** wins the heart (19/20) and the lungs (12/20), and loses the liver and kidney;
  - **as a career** (organs in order, gold banked, before each organ buying first the IgG targets for its bacteria, then damage for its most-built node types, then the rest) wins every organ at the first attempt: heart 19/20, lungs 12/20 (buying the *S. pneumoniae* target), brain 15/18 (*Listeria*, *N. meningitidis* and IgM damage), liver 14/24 (*E. coli*, *Klebsiella* and IgA damage), kidney 8/20 (IgM and IgG damage), spleen 13/22 (IgA and IgG damage). From the liver on it fills only 56%, 55% and 53% of the build sites.
- **A clumsy new player wins the heart.** A scripted player who builds only IgM on the first free sites in the list, opens a vessel only once a pathogen is 80% of the way in, and never pulses, still clears the heart without losing health. (The **Place by list** order takes each vessel's outermost site first, then the next.)
- Never building loses every organ, even with every upgrade; white cells alone leak most of the heart's health in wave 1 (it ends on 5/20).
- **Holding one route open is worse than dilating with care.** With the career's upgrades at each organ, a player who opens the busiest route as soon as it can and never closes it loses the liver and kidney and finishes the heart, lungs, brain and spleen at least 2 health worse (heart 17, lungs 5, brain 4, spleen 11). The tests require this on every organ.
- Virus health (10) is set so IgM and IgE kill one in a single hit; a well-aimed IgG kills a 70-health bacterium in three hits, IgM needs seven.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the six organ levels (maps, twists, waves). |
| `src/level.ts` | The loaded organ's routes (forks expanded into two routes sharing a stem) and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): placement, mid-wave dilation and the NO gauge, forks, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/bosses.ts` | The six boss pathogens' drawings. |
| `src/bacteria.ts` | The six bacteria's drawings: cell walls, nucleoid and ribosomes, capsules, pili, beating flagella; each still body is drawn once per size and reused. |
| `src/organs.ts` | The lungs, brain, liver (with the gut), kidney and spleen as anatomy-plate drawings: lobes, fissures and the bronchial tree; gyri, cerebellum and cerebral arteries; hepatic veins and ligaments; cortex, pyramids, hilar vessels and ureter; trabeculae and splenic vessels. Each organ (and the heart, drawn in `src/draw.ts` with its coronary vessels) is drawn once into an image and reused every frame. |
| `src/ink.ts` | The pen-and-ink look: cream paper with faint tissue drawn behind the map, and `inkify`, which turns a colour drawing into ink on paper (colour thinned to a faint wash; shadows hatched, cross-hatched and stippled by how dark they are; edges drawn in as pen lines). It runs once per organ image and per sprite, and the results are kept, never redone every frame. |
| `src/labels.ts` | Where the vessel names and next-wave tags go: each name is placed clear of the build sites, the organ, the tags and the other names. |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/career.ts` | The career and its save (no DOM): gold, the upgrade shop and what upgrades do in play, organs cleared, best health, the game in progress, a versioned `localStorage` entry with old-save migration; an unreadable save is kept aside, never lost. |
| `src/tutorial.ts` | The heart's guided first wave (no DOM): its steps, when each is done, when time holds, what the callout says and points at. |
| `src/main.ts` | HUD, panel, the menu, the tutorial's callout, autosave, build popover and IgG target picker, mouse / touch / keyboard input, overlays. |
| `tests/tutorial.test.ts` | The tutorial played through on the real simulation: every step in order, the holds, skipping the pulse if the wave ends, the saved seen flag. |
| `tests/career.test.ts` | The save (fresh, round-trip, migration, unreadable and newer saves, no storage, Continue, winning and losing), gold, the shop and upgrade effects. |
| `tests/game.test.ts` | Tests for every rule (NO and dilation, forks, cells, pulse, placement, the four lymph nodes and the IgG match, IgE burn-out, infection), each organ's map and twist, each boss's trick, map labels that never cover a site or each other, plus balance on every organ (including the hold-open check). |
