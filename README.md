# Defend the Heart

A fixed top-down 2D anatomy tower defence across five organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels, choose one vessel to dilate for your white blood cells each wave, and fire one immune pulse per wave.

## The organs

Clear an organ to unlock the next. Your progress (and the organ you last played) is remembered in your browser; pick any unlocked organ from the **Level** card at the top of the panel between waves.

| Level | Organ | Vessels | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ: dilation, lymph nodes and the pulse. | 20 | 5 + boss |
| 2 | **Lungs** | 3 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×1.5 (the panel counts down to the next breath, the map shows INHALE). | 20 | 4 + boss |
| 3 | **Brain** | 4 | **Blood–brain barrier.** Only two lymph node sites per vessel and less health, but three white cells. | 18 | 4 + boss |
| 4 | **Liver** | 4 | **Portal vein.** A long vein from the gut brings columns of bacteria; the liver **regrows 3 health** after every cleared wave. | 24 | 4 + boss |
| 5 | **Kidney** | 4 | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. The hardest waves, hijackers throughout. | 20 | 4 + boss |

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

1. **Prepare.** The panel and the map show the next wave: which pathogens, how many, roughly when, and up which vessel.
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own vessel. Nodes cost energy; you start with 120–190 energy (more on later organs) and two nodes already placed, and earn energy for every kill and every wave cleared.

| Node | Cost | Effect |
|---|---|---|
| **IgM** | 60 | High damage. No slow, no armour reduction. |
| **IgG** | 50 | Lower damage, but strips armour (opsonisation), so every other hit lands harder. |
| **IgA** | 50 | Lower damage, no armour reduction, but slows what it hits. |
| **IgE** | 80 | **Boss hunter.** Longer reach; always aims at a boss in reach first and hits it for 38 straight through armour (every 1.8 s). Only 5 damage to anything else. |

3. **Dilate vessel.** Click or tap a vessel (or press 1 to 4). Its walls part and the flow animates. Exactly one vessel per wave; choosing another replaces the choice.
4. **Defend.** Nodes fire on their own. The white cells (two, or three in the brain) travel out from the heart along the dilated vessel only, against the flow, under their nodes' cover.
5. **Immune pulse.** Once per wave, a burst around each white cell hits pathogens on that cell's vessel only. Fire it into a cluster.
6. **Reset.** Cells return home, the vessel contracts, you earn energy and choose again. Organ damage persists until restart (the liver regrows a little).

**Pathogens:** bacteria (slow, tough, armoured capsule), viruses (small, fast, in groups), and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** heading for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA / IgE | **Place by list** in the panel |
| Dilate vessel | Click / tap a vessel, or the vessel buttons | 1–4, in the order the panel lists the vessels |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Pause, speed, restart | buttons in the top bar | P to pause, Esc closes the build menu |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, armour strip, slow, boss damage), white cells, the pulse, pathogens (health, speed, armour, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`), its map (organ centre and size, vessel paths, where along each vessel the build sites go) and its waves. [`src/level.ts`](src/level.ts) builds the vessels and sites for whichever organ is loaded.

### Balance assumptions

- A scripted sensible player (dilate the busiest vessel, spend energy on nodes matched to each vessel's threat, pulse into clusters of three) wins every organ, bosses included: heart 9/20, lungs 10/20, brain 7/18, liver 12/24, kidney 11/20. Each boss dies, but only in the last third of its vessel. Never building loses on every organ. The brain is deliberately the tightest: its few sites reward placing nodes better than the script does.
- Virus health (14) is set so IgM kills one in a single hit and IgG/IgA need two or three; bacteria (70, armour 5) shrug off much of IgM until IgG opens them.
- White cells alone (no nodes) leak 6 heart health in wave 1: they help, they do not carry.
- Hijackers appear in wave 5 on three vessels, so they meet the white cells whichever vessel you dilate; the scripted player lost 2 cells to them.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the five organ levels (maps, twists, waves). |
| `src/level.ts` | The loaded organ's vessels and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): placement, dilation, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/bosses.ts` | The five boss pathogens' drawings. |
| `src/organs.ts` | The lungs, brain, liver (with the gut) and kidney as anatomy-plate drawings. |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/main.ts` | HUD, panel, level picker and saved progress, build popover, mouse / touch / keyboard input, overlays. |
| `tests/game.test.ts` | Tests for every rule (dilation, cells, pulse, placement, the three immunoglobulins, infection), each organ's map and twist, each boss's trick, plus balance on every organ. |
