# Defend the Heart

A fixed top-down 2D anatomy tower defence across five organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels, choose one vessel to dilate for your white blood cells each wave, and fire one immune pulse per wave.

## The organs

Clear an organ to unlock the next. Your progress (and the organ you last played) is remembered in your browser; pick any unlocked organ from the **Level** card at the top of the panel between waves.

| Level | Organ | Vessels | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ: dilation, lymph nodes and the pulse. | 20 | 5 + boss |
| 2 | **Lungs** | 3 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×1.5 (the panel counts down to the next breath, the map shows INHALE). | 20 | 4+ boss |
| 3 | **Brain** | 4 | **Blood–brain barrier.** Only two lymph node sites per vessel and less health, but three white cells. | 18 | 4+ boss |
| 4 | **Liver** | 4 | **Portal vein.** A long vein from the gut brings columns of bacteria; the liver **regrows 3 health** after every cleared wave. | 24 | 4+ boss |
| 5 | **Kidney** | 4 | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. The hardest waves, hijackers throughout. | 20 | 4+ boss |

**Play it:** https://brendanjvr-ux.github.io/the-last-ward/

Also in this project: **The Last Ward: Siege of Goosebridge** (the storybook game this was converted from) at [/goosebridge.html](https://brendanjvr-ux.github.io/the-last-ward/goosebridge.html), and the **art style studies** at [/styles.html](https://brendanjvr-ux.github.io/the-last-ward/styles.html).

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## Bosses

Every organ ends with a boss wave: one giant pathogen with its own trick, plus a small escort. While it lives, a **BOSS** banner across the top of the map shows its health; a leaked boss costs 6 to 8 organ health.

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

3. **Dilate vessel.** Click or tap a vessel (or press 1 to 4). Its walls part and the flow animates. Exactly one vessel per wave; choosing another replaces the choice.
4. **Defend.** Nodes fire on their own. The white cells (two, or three in the brain) travel out from the heart along the dilated vessel only, against the flow, under their nodes' cover.
5. **Immune pulse.** Once per wave, a burst around each white cell hits pathogens on that cell's vessel only. Fire it into a cluster.
6. **Reset.** Cells return home, the vessel contracts, you earn energy and choose again. Organ damage persists until restart (the liver regrows a little).

**Pathogens:** bacteria (slow, tough, armoured capsule), viruses (small, fast, in groups), and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** heading for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA | **Place by list** in the panel |
| Dilate vessel | Click / tap a vessel, or the vessel buttons | 1–4, in the order the panel lists the vessels |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Pause, speed, restart | buttons in the top bar | P to pause, Esc closes the build menu |

### Tuning

Everything is in [`src/anatomy/config.ts`](src/anatomy/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, armour strip, slow), white cells, the pulse, pathogens (health, speed, armour, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`), its map (organ centre and size, vessel paths, where along each vessel the build sites go) and its waves. [`src/anatomy/level.ts`](src/anatomy/level.ts) builds the vessels and sites for whichever organ is loaded.

### Balance assumptions

- A scripted sensible player (dilate the busiest vessel, spend energy on nodes matched to each vessel's threat, pulse into clusters of three) wins every organ, bosses included: heart 9/20, lungs 10/20, brain 7/18, liver 12/24, kidney 11/20. Each boss dies, but only in the last third of its vessel. Never building loses on every organ. The brain is deliberately the tightest: its few sites reward placing nodes better than the script does.
- Virus health (14) is set so IgM kills one in a single hit and IgG/IgA need two or three; bacteria (70, armour 5) shrug off much of IgM until IgG opens them.
- White cells alone (no nodes) leak 6 heart health in wave 1: they help, they do not carry.
- Hijackers appear in wave 5 on three vessels, so they meet the white cells whichever vessel you dilate; the scripted player lost 2 cells to them.

### Files

| File | What it is |
|---|---|
| `src/anatomy/config.ts` | All tuning values, and the five organ levels (maps, twists, waves). |
| `src/anatomy/level.ts` | The loaded organ's vessels and the build sites beside them (`loadLevel`). Reuses the Goosebridge path maths. |
| `src/anatomy/sim.ts` | State, rules and simulation (no DOM): placement, dilation, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/anatomy/bosses.ts` | The five boss pathogens' drawings. |
| `src/anatomy/organs.ts` | The lungs, brain, liver (with the gut) and kidney as anatomy-plate drawings. |
| `src/anatomy/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/anatomy/main.ts` | HUD, panel, level picker and saved progress, build popover, mouse / touch / keyboard input, overlays. |
| `tests/anatomy.test.ts` | Tests for every rule (dilation, cells, pulse, placement, the three immunoglobulins, infection), each organ's map and twist, each boss's trick, plus balance on every organ. |

---

# The Last Ward: Siege of Goosebridge

A single-map fantasy tower defence prototype: an open storybook whose pages are painted in oils, after the Dutch landscape masters (umber ground, olive woods, dark water, warm light from the upper left, varnish and craquelure), with a turning windmill, grazing sheep and cows, haystacks, a farmhouse, drifting cloud shadows, dust in the light and glints on the water. Two painted roads lead to Goosebridge Castle; your magic runs in ink along a separate network of leylines, from an inkwell in the castle garden out to thirteen tower foundations.

**Play it:** https://brendanjvr-ux.github.io/the-last-ward/goosebridge.html

**Art style studies:** https://brendanjvr-ux.github.io/the-last-ward/styles.html (the same battle moment in alternative art directions, led by the candlelit tabletop, with notes on what each would mean in Unity; source in `src/styles/`)

TypeScript, Vite, HTML Canvas for the battlefield and HTML/CSS for the controls. All artwork and sound are made procedurally: no image or audio files, no fonts or services from the internet, no accounts or API keys.

## The central rule

Three separate decisions:

| | When | What it does |
|---|---|---|
| **Trace** | Between waves | Drag a line of ink from the inkwell along a leyline to a tower. It prepares that tower for the *next wave only*. |
| **Pulse** | During a wave | Click a traced tower to send a pulse down its thread. Its special ability fires when the pulse arrives. |
| **Bind** | Between waves, from wave 4 | Spend 3 Gilded Leaves to bind one tower in gold. From then on it has its own free pulse every wave, with no trace and no shared charge. Bound towers can't be traced. |

Always: **shared pulses < traces < unbound towers.** Binding is refused if it would leave too few unbound towers to fill the traces (in waves 4–6 you need five towers before you can bind one).

| Waves | Traces required | Pulses |
|---|---|---|
| 1–3 | exactly 2 distinct towers | 1 |
| 4–6 | exactly 3 distinct towers | 2 |

If you still own only three towers when wave 4's preparation begins, the Crown sends a free fourth tower (you choose its type and foundation), so the rule always holds.

The castle defends itself too: a weak, short-range volley at anything that reaches the gate.

Every tower attacks on its own, traced or not. Shared pulse charges never recharge during a wave and never carry over; each tower fires at most once per wave. Every ink thread fades at the end of every wave; gold stays.

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173/ (Defend the Heart), http://localhost:5173/goosebridge.html (Goosebridge) or http://localhost:5173/styles.html (art studies). Other commands: `npm test` (rules and balance tests), `npm run build` (production build into `dist/`), `npm run preview` (serve the build), `npm run deploy` (test, build and publish `dist/` to the `gh-pages` branch that GitHub Pages serves).

## Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Trace a tower | Press the inkwell, follow a leyline, release on a tower | Tab to **Trace** beside the tower in the margin |
| Undo / clear threads | **Undo last**, **Clear all**, or click a traced tower → **Remove this thread** | `U` undoes the last thread |
| Build | Click an empty foundation, pick a tower | Pick a foundation in the margin's **Build** list |
| Bind | Click a tower → **Bind in gold**, or margin → **Bind a tower**; hover to preview, confirm | Tab to a tower in **Bind a tower** (focus previews it), Enter |
| Start wave | **Start wave** (active once the exact number of threads is drawn) | `Enter` |
| Pulse | Click / tap a tower with a wet ink drop or a gold seal | `1`–`9` pulse ready towers in margin order (gilded first) |
| Pause | **Pause** | `P` or `Space` |
| Speed | **Speed ×1 / ×2** | |
| Inspect an enemy | Click / tap it during a wave | |
| Sound | **Sound on / off** (the hounds' horn) | |
| Restart | **Restart** (immediate) | |
| Wave preview | The ▴/▾ on the bookmark folds it (it folds itself during battle) | |
| Cancel | | `Esc` closes a popover or drops a thread |

## Enemies

Click (or tap) any enemy during a wave to see its health, armour and speed.

| Enemy | Health | Armour | Speed | Notes |
|---|---|---|---|---|
| **Fen Levy** | 36 | 2 | 40 | Steady infantry with reed shields marked by a white flood line. March down the Mill Road in tight files, three abreast, spaced so a Bramble hedge bunches the front ranks for the Ember Kiln's splash. |
| **Barrow Hound** | 24 | 0 | 108 | Black hounds in bronze burial collars, in small packs on the King's Road. A double horn call sounds and a warning appears at the bridge about 3.5 s before they reach it, enough to save an Ember pulse for the crossing. |
| **Stone-Bearer** | 130 | 0 | 26 | A marked levy (oxblood sash, gilt marker) carrying the Cairn-Born's stolen name-stone. |
| **Cairn-Born** | 700 | 8 | 24 | A stone giant with an empty chest, following its bearer. When the bearer falls, the giant walks to the stone, kneels there for 7 s blocking everything behind it on that road (both roads if on the shared stretch), then leaves the field and the queue is released. Time a pulse against the bearer to choose where the blockade forms. If the bearer reaches the gate, the giant marches on. Cannot be knocked back. |

Waves: Levy alone (1), Hounds join (2), both together (3), a calmer wave to try your first bind (4), the Cairn-Born and its bearer on a quiet Mill Road (5), the pair on the Mill Road while Hounds threaten the bridge (6). The bookmark gives each wave a title and a line of verse; it does not tell you what is coming, where, or how many.

## Towers

| Tower | Attack | Pulse |
|---|---|---|
| **Bramble Tower** | Thorns, single target | **Hedge**: a hedge grows across the nearest road; enemies on that lane halt and bunch up. On the shared stretch by the gate it blocks both lanes. |
| **Ember Kiln** | Lobbed coals, splash | **Firebrand**: the road near the kiln burns for several seconds. Burning ignores armour. The kiln at the Crossroads covers both roads. |
| **Bell Spire** | Periodic ring around it | **Great Toll**: knocks nearby enemies back along their own road and dazes them (not the Cairn-Born). |
| **Verdigris Font** | Copper spray that strips 2 armour per hit (up to 6, wears off after 4 s) | **Tarnish**: a green mist removes all armour from enemies nearby and makes them take 30% more damage for 6 s. |


## Tuning

Every number lives in [`src/balance.ts`](src/balance.ts): castle health and its volley, starting gold, rewards, tower costs and damage, pulse durations and strengths, bind cost, the trace/pulse table, the reinforcement wave and all six hand-authored waves.

`tests/balance.test.ts` plays the game headlessly with a scripted player and checks that a sensible strategy wins, that the same towers without pulses lose, and that pulses without building lose. Rerun `npm test` after tuning.

## Files

| File | What it is |
|---|---|
| `src/balance.ts` | All tuning values and the six waves. |
| `src/map.ts` | Map geometry: roads, river, the inkwell, the leyline tree and its 13 foundations, snapping. |
| `src/game.ts` | Game state, the trace / pulse / bind / build rules and the combat simulation (no DOM). |
| `src/paint.ts` | The painted spread: ground, polder fields, trees, water, roads, buildings, varnish and craquelure (drawn once). |
| `src/sprites.ts` | Painted towers and enemies. |
| `src/render.ts` | Live drawing: ink threads, gold leaf, effects, warnings, inspect highlight, the victory plate. |
| `src/audio.ts` | The synthesized double horn. |
| `src/main.ts` | Input (the trace gesture, pulses), the margin, HUD, ribbon bookmark, popovers and overlays. |
| `src/style.css` | Layout and look, including the phone layout. |
| `tests/` | Acceptance-rule tests, balance tests and the scripted player. |
| `scripts/deploy.sh` | Builds and publishes the game to the `gh-pages` branch. |
