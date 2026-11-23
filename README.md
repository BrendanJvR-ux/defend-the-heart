# Defend the Heart

A fixed top-down 2D anatomy tower defence across five organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels between waves. During a wave you open (dilate) one vessel at a time for your white blood cells, paying for it with a scarce gauge of nitric oxide (NO), and fire one immune pulse per wave. From the brain on, some vessels fork, and pathogens at a fork take the branch you have not opened.

## The organs

Clear an organ to unlock the next. Your progress (and the organ you last played) is remembered in your browser; pick any unlocked organ from the **Level** card at the top of the panel between waves.

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

Every organ ends with a boss wave: one giant pathogen with its own trick, plus a small escort. Build an **IgE** node on the boss's vessel to counter it. While it lives, a **BOSS** banner across the top of the map shows its health; a leaked boss costs 6 to 8 organ health.

| Organ | Boss | Trick |
|---|---|---|
| Heart | **Staph colony** | A golden grape-bunch under a thick capsule (armour 7). When it bursts, three weakened bacteria spill out. |
| Lungs | **Mother virus** | Releases a new virus every 2.4 s as it travels, and rides the breathing surges. |
| Brain | **Meningococcus** | A heavily armoured diplococcus (armour 8) that IgA cannot slow. Bring IgG. |
| Liver | **Hepatitis giant** | Regrows 9 health per second as it climbs the long portal vein. |
| Kidney | **Sepsis hijacker** | A giant hijacker that infects **every** white cell it touches and keeps going. |

## How it plays

1. **Prepare.** The panel and the map show the next wave: which pathogens, how many, roughly when, and up which vessel (and whether it forks).
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own route; a node on a fork's shared stem guards both branches. Nodes cost energy; you start with 240–590 energy (more on the bigger organs) and two nodes already placed, and earn energy for every kill and every wave cleared.

| Node | Cost | Effect |
|---|---|---|
| **IgM** | 60 | High damage. No slow, no armour reduction. |
| **IgG** | 50 | Lower damage, but strips armour (opsonisation), so every other hit lands harder. |
| **IgA** | 50 | Lower damage, no armour reduction, but slows what it hits. |
| **IgE** | 80 | **Boss hunter.** Longer reach; always aims at a boss in reach first and hits it for 38 straight through armour (every 1.8 s). Only 5 damage to anything else. |

3. **Start the wave.** Every vessel starts at rest, and your white cells (two, or three in the brain) wait at the organ.
4. **Dilate during the wave, with NO.** Click or tap a route (or press 1 to 8) to open it: its walls part and the white cells set out along it, against the flow, under their nodes' cover. Only one route is open at a time; opening another switches, and clicking the open one closes it. The **NO gauge** (100) pays for it: opening or switching costs **15** (and you need at least 23, enough to hold it open for a second), an open route drains **8 a second**, and while every route is closed NO refills **3 a second**; each cleared wave adds **35**. When NO runs out the route closes and the cells head home. Cells at home or heading home don't fight, so every second closed is a second the organ relies on its nodes alone.
5. **Forks** (brain, liver, kidney). A forked vessel splits into two branches on its way in. Pathogens travel the shared stem, and at the fork take the branch you have **not** opened (with neither open, they alternate). Cells on either branch can fight up the stem.
6. **Immune pulse.** Once per wave, a burst around each white cell out on a route hits pathogens on that route only. Fire it into a cluster.
7. **Reset.** Cells return home, every route rests, you earn energy and build again. Organ damage persists until restart (the liver regrows a little).

**Pathogens:** bacteria (slow, tough, armoured capsule), viruses (small, fast, in groups), and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** heading for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA / IgE | **Place by list** in the panel |
| Open / switch / close a route (during a wave) | Click / tap a vessel, or the route buttons | 1–8, in the order the panel lists the routes |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Pause, speed, restart | buttons in the top bar | P to pause, Esc closes the build menu |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, armour strip, slow, boss damage), white cells, the pulse, the NO gauge (`no`: capacity, opening cost, drain, refill, top-up), pathogens (health, speed, armour, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`), its map (organ centre and size, vessel paths with any `fork` and its two branches, where along each route the build sites go) and its waves. [`src/level.ts`](src/level.ts) turns the loaded organ's vessels into routes (a forked vessel becomes two routes sharing a stem) and places the sites.

### Balance assumptions

- A scripted sensible player (spend energy on nodes matched to each vessel's threat; during the wave open the route with the most pathogens past 65% of the way in, keeping 2 s of NO to spare, close it when it is clear, switch only for twice the threat; pulse into clusters of three) wins every organ, bosses included: heart 7/20, lungs 12/20, brain 12/18, liver 16/24, kidney 8/20. Never building loses on every organ.
- **Holding one route open is worse than dilating with care.** A scripted player who builds the same way but opens the busiest route as soon as it can and never closes it loses the heart and the brain, and finishes the lungs on 8/20, the liver on 10/24 and the kidney on 5/20 (the tests require it to lose, or end at least 2 health worse).
- Virus health (14) is set so IgM kills one in a single hit and IgG/IgA need two or three; bacteria (70, armour 5) shrug off much of IgM until IgG opens them.
- White cells alone (no nodes) leak 9 heart health in wave 1: they help, they do not carry.
- Hijackers appear in wave 5 on three vessels, so they meet the white cells whichever vessel you dilate.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the five organ levels (maps, twists, waves). |
| `src/level.ts` | The loaded organ's routes (forks expanded into two routes sharing a stem) and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): placement, mid-wave dilation and the NO gauge, forks, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/bosses.ts` | The five boss pathogens' drawings. |
| `src/organs.ts` | The lungs, brain, liver (with the gut) and kidney as anatomy-plate drawings. |
| `src/labels.ts` | Where the vessel names and next-wave tags go: each name is placed clear of the build sites, the organ, the tags and the other names. |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/main.ts` | HUD, panel, level picker and saved progress, build popover, mouse / touch / keyboard input, overlays. |
| `tests/game.test.ts` | Tests for every rule (NO and dilation, forks, cells, pulse, placement, the three immunoglobulins, infection), each organ's map and twist, each boss's trick, map labels that never cover a site or each other, plus balance on every organ (including the hold-open check). |
