# Defend the Heart

A fixed top-down 2D anatomy tower defence. The heart is the base. Two blood vessels approach it from opposite sides, each guarded by a lymph node; two white blood cells are your weak mobile defenders.

**Play it:** https://brendanjvr-ux.github.io/the-last-ward/

Also in this project: **The Last Ward: Siege of Goosebridge** (the storybook game this was converted from) at [/goosebridge.html](https://brendanjvr-ux.github.io/the-last-ward/goosebridge.html), and the **art style studies** at [/styles.html](https://brendanjvr-ux.github.io/the-last-ward/styles.html).

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## Level one: Defend the Heart

1. **Prepare.** The panel and the map show the next wave: which pathogens, how many, roughly when, and which vessel each group enters.
2. **Dilate vessel.** Click or tap a vessel (or press 1 / 2). Its walls part, the lumen widens and the flow animates towards the heart. Exactly one vessel can be dilated; choosing the other replaces the choice. Start the wave once one is chosen.
3. **Defend.** Both lymph nodes fire antibodies at pathogens on their own vessel, dilated or not. The white cells set out from the heart along the dilated vessel, against the flow, and fight anything on that vessel. They never leave it, never cross tissue, and never chase into the other vessel.
4. **Immune pulse.** Once per wave, a burst around each living white cell hits pathogens within its radius on that cell's vessel only. Fire it into a cluster; fired too early it hits nothing. Hover or focus the button to see the radius; on touchscreens, pathogens it would hit are outlined.
5. **Reset.** Surviving cells return to the heart, the vessel contracts to resting width, and you choose again. Heart damage persists until you restart.

Pathogens: **bacteria** (larger, slower green rods, tougher) and **viruses** (small, fast, spiked, in short groups). Three waves: bacteria on the left; a few bacteria left and a fast viral cluster right; staggered pressure on both.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Dilate vessel | Click / tap a vessel, or the **Left vessel** / **Right vessel** buttons | 1 or L, 2 or R |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** button | Space |
| Pause | **Pause** | P |
| Speed, restart | **Speed ×2**, **Restart** | |

### Tuning

Everything that shapes play is in [`src/anatomy/config.ts`](src/anatomy/config.ts): heart health; vessel resting and dilated widths and dilation speed; lymph node damage, rate and reach; white cell starting count (2), health, speed, contact range and damage, how far out they patrol; the immune pulse count, radius and damage; pathogen health, speed, heart damage and contact damage; and the three waves. Map geometry is in [`src/anatomy/level.ts`](src/anatomy/level.ts).

### Balance assumptions

- White cells patrol between 40% and 100% of the dilated vessel, so they fight under their lymph node's cover instead of wandering off alone.
- Cells are deliberately weak (4 damage per second each): with the lymph nodes switched off, the two cells alone leak 6 heart health in wave 1.
- A sensible player (dilating the vessel carrying more pathogen health, pulsing at a cluster of three) wins with 16/20 in the scripted test. Dilating the quieter vessel every wave ends with the heart at 2/20 or less.
- The resting vessel's lymph node holds wave 2's three bacteria on its own without any loss.

### Files

| File | What it is |
|---|---|
| `src/anatomy/config.ts` | All tuning values and the waves. |
| `src/anatomy/level.ts` | The heart, the two vessels and the lymph nodes. Reuses the Goosebridge path maths. |
| `src/anatomy/sim.ts` | State, rules and simulation (no DOM): dilation, waves, nodes, white cells, the pulse, recall. |
| `src/anatomy/draw.ts` | Rendering: tissue, vessels with dilation and flow, heartbeat, nodes, cells, pathogens, effects. |
| `src/anatomy/main.ts` | HUD, panel, mouse / touch / keyboard input, overlays. |
| `tests/anatomy.test.ts` | One test per verification point, plus balance checks with a scripted player. |

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
