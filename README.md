# The Last Ward: Siege of Goosebridge

A single-map fantasy tower defence prototype drawn as an open storybook. Two painted roads lead to Goosebridge Castle; your magic runs in ink along a separate network of leylines, from an inkwell in the castle garden out to thirteen tower foundations.

**Play it:** https://brendanjvr-ux.github.io/the-last-ward/

TypeScript, Vite, HTML Canvas for the battlefield and HTML/CSS for the controls. All artwork is drawn procedurally: no image files, no fonts or services from the internet, no accounts or API keys.

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

Then open http://localhost:5173/. Other commands: `npm test` (rules and balance tests), `npm run build` (production build into `dist/`), `npm run preview` (serve the build), `npm run deploy` (test, build and publish `dist/` to the `gh-pages` branch that GitHub Pages serves).

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
| Restart | **Restart** (immediate) | |
| Wave preview | The ▴/▾ on the bookmark folds it (it folds itself during battle) | |
| Cancel | | `Esc` closes a popover or drops a thread |

## Towers

| Tower | Attack | Pulse |
|---|---|---|
| **Bramble Tower** | Thorns, single target | **Hedge**: a hedge grows across the nearest road; enemies on that lane halt and bunch up. On the shared stretch by the gate it blocks both lanes. |
| **Ember Kiln** | Lobbed coals, splash | **Firebrand**: the road near the kiln burns for several seconds. Burning ignores armour. The kiln at the Crossroads covers both roads. |
| **Bell Spire** | Periodic ring around it | **Great Toll**: knocks nearby enemies back along their own road and dazes them. |

Enemies: goblins (steady), wolves (fast, in packs, announced by a howl at their entrance), armoured rams (slow, tough, armour blunts every hit except fire and the toll).

## Tuning

Every number lives in [`src/balance.ts`](src/balance.ts): castle health and its volley, starting gold, rewards, tower costs and damage, pulse durations and strengths, bind cost, the trace/pulse table, the reinforcement wave and all six hand-authored waves.

`tests/balance.test.ts` plays the game headlessly with a scripted player and checks that a sensible strategy wins, that the same towers without pulses lose, and that pulses without building lose. Rerun `npm test` after tuning.

## Files

| File | What it is |
|---|---|
| `src/balance.ts` | All tuning values and the six waves. |
| `src/map.ts` | Map geometry: roads, river, the inkwell, the leyline tree and its 13 foundations, snapping. |
| `src/game.ts` | Game state, the trace / pulse / bind / build rules and the combat simulation (no DOM). |
| `src/render.ts` | Canvas drawing: parchment, roads, pencilled leylines, ink threads, gold leaf, towers, enemies, effects, the victory plate. |
| `src/main.ts` | Input (the trace gesture, pulses), the margin, HUD, ribbon bookmark, popovers and overlays. |
| `src/style.css` | Layout and look, including the phone layout. |
| `tests/` | Acceptance-rule tests, balance tests and the scripted player. |
| `scripts/deploy.sh` | Builds and publishes the game to the `gh-pages` branch. |
