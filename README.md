# Defend the Heart

A fixed top-down 2D anatomy tower defence across five organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels between waves. During a wave you open (dilate) one vessel at a time for your white blood cells, paying for it with a scarce gauge of nitric oxide (NO), and fire one immune pulse per wave. From the brain on, some vessels fork, and pathogens at a fork take the branch you have not opened.

## The organs

Clear an organ to unlock the next. The game opens on a **menu**:

- **Continue** picks up your game where you left it: the organ, the wave, your nodes (with their IgG targets and IgE waves left), energy, organ health and NO. It is saved in your browser at the start of every build phase, so leaving mid-wave brings you back to that wave's build phase. Losing an organ ends that run.
- **New career** starts over at the heart (it asks first if you have progress).
- **Organs** lists the five organs: cleared ones show your best health and can be replayed. Starting a different organ while a game is in progress asks first.

The **Menu** button in the top bar opens it at any time (the game pauses). Between waves, the **Level** card at the top of the panel also switches organ.

| Level | Organ | Routes in | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ: lymph nodes, dilating with NO, and the pulse. | 20 | 5 + boss |
| 2 | **Lungs** | 5 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×1.5 (the panel counts down to the next breath, the map shows INHALE). | 20 | 4 + boss |
| 3 | **Brain** | 6 (one fork) | **Blood–brain barrier.** Only two lymph node sites guard each route and less health, but three white cells. | 18 | 4 + boss |
| 4 | **Liver** | 7 (two forks) | **Portal vein.** A long vein from the gut brings columns of bacteria (it forks before the liver); the liver **regrows 3 health** after every cleared wave. | 24 | 4 + boss |
| 5 | **Kidney** | 8 (three forks) | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. The hardest waves, hijackers throughout. | 20 | 4 + boss |

**Play it:** https://brendanjvr-ux.github.io/defend-the-heart/

It began as a conversion of [The Last Ward: Siege of Goosebridge](https://github.com/BrendanJvR-ux/the-last-ward), a storybook tower defence, and now lives in its own repository.

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## Bosses

Every organ ends with a boss wave: one giant pathogen with its own trick, plus an escort. While it lives, a **BOSS** banner across the top of the map shows its health; a leaked boss costs 6 to 8 organ health.

| Organ | Boss | Trick | What works |
|---|---|---|---|
| Heart | **Staph colony** | A grape-bunch of *S. aureus*. When it bursts, three weakened staph spill out. | IgG aimed at *S. aureus* (×3) |
| Lungs | **Mother virus** | Releases a new virus every 2.4 s as it travels, and rides the breathing surges. | IgM, IgE |
| Brain | **Meningococcus** | A giant *N. meningitidis* that IgA cannot slow. | IgG aimed at *N. meningitidis* (×3) |
| Liver | **Hepatitis giant** | Regrows 9 health per second as it climbs the long portal vein. | IgM, IgE: damage must outpace it |
| Kidney | **Sepsis hijacker** | A giant hijacker that infects **every** white cell it touches and keeps going. | Nodes, not white cells |

## The bacteria

There is no armour: every hit lands in full. Instead, each bacterium has a Gram stain, a shape and a species, and IgG antibodies are aimed at one of them.

| Bacterium | Gram | Shape | Organs |
|---|---|---|---|
| *Staphylococcus aureus* | + | coccus (clusters) | every organ |
| *Streptococcus pneumoniae* | + | coccus (pairs, chains) | lungs, brain |
| *Listeria monocytogenes* | + | rod | brain |
| *Neisseria meningitidis* | − | coccus (bean-shaped pairs) | brain |
| *Escherichia coli* | − | rod | liver, kidney |
| *Klebsiella pneumoniae* | − | rod (thick capsule) | lungs, liver |

All six have 70 health and the same speed; viruses (10 health) are fast and come in groups.

## How it plays

1. **Prepare.** The panel and the map show the next wave: which pathogens, how many, roughly when, and up which vessel (and whether it forks).
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own route; a node on a fork's shared stem guards both branches. Nodes cost energy; you start with 120–295 energy and two nodes already placed, and earn energy for every kill and every wave cleared. Most routes have five sites (the liver's more, the brain's two).

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
| Menu, pause, speed, restart | buttons in the top bar | P to pause; Esc closes the build menu or steps back in the menu |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, slow, burn-out), the IgG match multipliers (`iggMatch`) and re-aim cost, white cells, the pulse, the NO gauge (`no`: capacity, opening cost, drain, refill, top-up), pathogens (health, speed, Gram stain / shape / species for bacteria, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`), its map (organ centre and size, vessel paths with any `fork` and its two branches, where along each route the build sites go) and its waves. [`src/level.ts`](src/level.ts) turns the loaded organ's vessels into routes (a forked vessel becomes two routes sharing a stem) and places the sites.

### Balance assumptions

- A scripted sensible player (builds on the least-defended threatened vessels first, at most three nodes per vessel per build; aims IgG at the bacterium bringing the most health up that vessel; during the wave opens the route with the most pathogens past 65% of the way in, keeping 2 s of NO to spare, closes it when clear, switches only for twice the threat; pulses into clusters of three) wins every organ: heart 18/20, lungs 11/20, brain 15/18, liver 18/24, kidney 13/20. Never building loses on every organ, and white cells alone lose the heart in wave 1.
- **Holding one route open is worse than dilating with care.** The same player opening the busiest route as soon as it can and never closing it loses the lungs, and finishes the heart on 15/20, the brain on 4/18, the liver on 1/24 and the kidney on 7/20 (the tests require it to lose, or end at least 2 health worse).
- Virus health (10) is set so IgM and IgE kill one in a single hit; a well-aimed IgG kills a 70-health bacterium in three hits, IgM needs seven.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the five organ levels (maps, twists, waves). |
| `src/level.ts` | The loaded organ's routes (forks expanded into two routes sharing a stem) and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): placement, mid-wave dilation and the NO gauge, forks, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/bosses.ts` | The five boss pathogens' drawings. |
| `src/bacteria.ts` | The six bacteria's drawings. |
| `src/organs.ts` | The lungs, brain, liver (with the gut) and kidney as anatomy-plate drawings. |
| `src/labels.ts` | Where the vessel names and next-wave tags go: each name is placed clear of the build sites, the organ, the tags and the other names. |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/career.ts` | The career and its save (no DOM): organs cleared, best health, the game in progress, a versioned `localStorage` entry with old-save migration; an unreadable save is kept aside, never lost. |
| `src/main.ts` | HUD, panel, the menu, autosave, build popover and IgG target picker, mouse / touch / keyboard input, overlays. |
| `tests/career.test.ts` | The save: fresh, round-trip, migration, unreadable and newer saves, no storage, Continue, winning and losing. |
| `tests/game.test.ts` | Tests for every rule (NO and dilation, forks, cells, pulse, placement, the four lymph nodes and the IgG match, IgE burn-out, infection), each organ's map and twist, each boss's trick, map labels that never cover a site or each other, plus balance on every organ (including the hold-open check). |
