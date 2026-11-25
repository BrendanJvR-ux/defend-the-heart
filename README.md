# Defend the Heart

A fixed top-down 2D anatomy tower defence across eleven organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels between waves. During a wave you open (dilate) one vessel at a time for your white blood cells, paying for it with a scarce gauge of nitric oxide (NO), and once per wave can fire the immune pulse, in which every white cell touching a pathogen gives its life to destroy it. From the brain on, some vessels fork, and pathogens at a fork take the branch you have not opened.

## The organs

Clear an organ to unlock the next. The game opens on a **menu**:

- **Continue** picks up your game where you left it: the organ, the wave, your nodes (with their IgG targets and IgE waves left), energy, organ health and NO. It is saved in your browser at the start of every build phase, so leaving mid-wave brings you back to that wave's build phase. Losing an organ ends that run.
- **New career** starts over at the heart (it asks first if you have progress).
- **Upgrades** is the gold shop (below).
- **Endless** plays any organ you have cleared with no last wave (see below), and shows your leaderboard for each.
- **Tutorial** replays the guided first wave on the heart.
- **Organs** lists the eleven organs: cleared ones show your best health and can be replayed. Starting a different organ while a game is in progress asks first.

The **Menu** button in the top bar opens it at any time (the game pauses). Between waves, the **Level** card at the top of the panel also switches organ.

| Level | Organ | Routes in | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ, made for new players: gentler first waves, and hints that walk you through building, opening a vessel and aiming IgG. | 20 | 5 + boss |
| 2 | **Lungs** | 5 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×2.2 (the panel counts down to the next breath, the map shows INHALE). | 20 | 4 + boss |
| 3 | **Brain** | 6 (one fork) | **Blood–brain barrier.** Only three lymph node sites guard each route and less health, but three white cells. | 18 | 4 + boss |
| 4 | **Liver** | 7 (two forks) | **Portal vein.** A long vein from the gut brings columns of bacteria (it forks before the liver); the liver **regrows 3 health** after every cleared wave. **Its gallbladder bursts** the first time the liver falls to half health: bile destroys 2 of your lymph nodes at random, leaving green stains where they stood (you can build there again). | 24 | 4 + boss |
| 5 | **Kidney** | 8 (three forks) | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. Hijackers throughout. Every wave its pathogens come **20% tougher** (wave 5: ×1.8 health). | 20 | 4 + boss |
| 6 | **Spleen** | 9 (three forks) | **It remakes white cells.** A white cell that is killed or infected comes back at the spleen 8 s later, and the spleen pays 1 health when it does (a cell lost too late in a wave to come back costs nothing). The bacteria it exists to clear: pneumococci, meningococci, *Klebsiella*. | 22 | 4 + boss |
| 7 | **Bone marrow** | 10 (four forks) | **It makes white cells.** You start with only 2; every cleared wave adds one more, up to 5 (2, 3, 4, 5, 5 over its five waves). The tuberculosis bone: *M. tuberculosis* arrives here for the first time, with staph and *E. coli*. | 24 | 4 + boss |
| 8 | **Stomach** | 11 (four forks) | **Acid.** On the last third of every vessel (shown with a yellow-green wash and bubbles), pathogens lose 3 health a second, so whatever gets close is worn down; *H. pylori* and its swarm feed on the acid, **gaining** 3 health a second there instead. New bacteria: *H. pylori* and *Salmonella*. | 24 | 4 + boss |
| 9 | **Lymph node** (the finale) | 12 (five forks) | **Your own defences are the target.** Every pathogen that reaches the node **weakens the lymph nodes guarding its vessel by 10%** (down to half), shown as a % under each, until the wave ends. Three white cells. New bacterium: *S. pyogenes*. | 26 | 4 + boss |
| 10 | **Skin** | 10 (four forks) | **Open wounds.** Pathogens come in through cuts, partway along their vessels (a fixed place for each group, 20–50% of the way in), not from the edge of the map, so the inner sites matter from the start; each wound stays marked on its vessel for the rest of the organ. A wide slab of skin, with forks off both sides and from below. Three white cells. New bacterium: *Pseudomonas aeruginosa*. | 24 | 4 + boss |
| 11 | **Eye** | 8 (three forks) | **Immune privilege.** No white cells come to the eye: no pulse, no cells fighting, only your lymph nodes (a vessel can still be opened, to turn pathogens at a fork). The eye is drawn turned over, its optic nerve leaving between the two upper forks. New bacterium: *Chlamydia trachomatis*. | 22 | 4 + boss |

**Play it:** https://brendanjvr-ux.github.io/defend-the-heart/

It began as a conversion of [The Last Ward: Siege of Goosebridge](https://github.com/BrendanJvR-ux/the-last-ward), a storybook tower defence, and now lives in its own repository.

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## The look

Everything is drawn like a pen-and-ink plate with faint watercolour:

- **The map** is cream paper with faint washes of rose, blue-grey, ochre, sage and pink, and tissue sketched lightly in ink behind it all: loose cells with stippled nuclei, drifting fibres, and small capillaries branching in from the edges like roots. A double ink rule frames it.
- **The map's tags and gauges** match: organ health is a ring of hatched rose beads in ink (an empty pen circle for each one lost), the NO gauge, health bars and boss banner are hatched washes in ink outlines on paper slips, and the next-wave tags, DILATED and HIDING are inked paper slips. Antibodies are drawn in pen with a thin line of their node's colour; hits and losses show as ink rings; floating words are inked italics that move clear of the vessel names and stay inside the map. The NO gauge sits under the organ, or above it on the eye, clear of every vessel name. Each route's name has the key that opens it in a small ring before it (blue during a wave; not shown on touch screens, which have no keys), and a fork's two branch names sit on their outer sides. Messages appear at the top of the map, or at the bottom while a boss's health bar is up there. A wound on the skin is a red cut across its vessel, labelled.
- **Organs, pathogens, bosses, white cells and lymph nodes** are drawn in colour, then inked: the colour thinned to a faint wash, the shadows hatched, cross-hatched and stippled by how dark they are, edges drawn in as single pen lines, and a hatched band along each organ's shaded (lower-right) side so it reads as rounded. Darker organs are lifted to a common lightness, so none turns into solid cross-hatching. Each colour still tells the pathogens and node types apart.
- **Vessels** wind: their corners are rounded and a gentle meander runs along each one (the same along a forked vessel's shared stem, fading out where it meets the organ). Pathogens and white cells follow the same winding course, and the build sites stand where they did, so the balance figures are unchanged. Each has a firm ink outline, a pale rose wash, hatched walls and red cells ringed in fine ink.
- **The panel, top bar and menus** are paper plates on a faintly cross-hatched table: a double ink rule with slightly uneven, hand-drawn corners; buttons with an ink offset shadow; the selected organ, primary buttons, the open vessel, the pulse button and the gauges in faint washes with pen hatching instead of solid colour; italic serif headings.

Inking is a pass over pixels, so it is run once per organ image and per sprite and the results are kept: a frame takes about as long to draw as before. The next organ is inked in idle time after a win (and the saved organ while the menu is up), so it opens without a pause; a boss's animation loops, so each of its 64 frames is inked once and reused.

## Endless mode and your leaderboard

Once you've cleared an organ, **Endless** in the menu lets you play it again with no last wave. Its waves come round again and again, each time with more pathogens in every group and more health per wave already fought (12% and 6% a wave at the usual pace; see below). Its boss comes **every fifth wave**, up every vessel. Everything else is as in the career: your upgrades, its twist, borrowing targets, the pulse. A run ends only when the organ falls. It pays **5 gold for every wave cleared**, and goes on that organ's **leaderboard**: your ten best runs (waves held, and the date), kept in this browser with your career. The end screen says where the run placed ("A new best!", or #3 on the board). The leaderboard is personal to this device, not shared between players.

Each organ's endless waves grow at their own pace, set so runs last about as long everywhere. The scripted player who can't see the waves, with every upgrade the career buys by its end, holds out for **heart 13 waves, lungs 17, brain 13, liver 15, kidney 14, spleen 15, bone marrow 14, stomach 14, lymph node 14, skin 15, eye 18** (before, from 4 on the stomach to 29 on the marrow). The pace is slower where an organ's own rule stacks with endless growth (the stomach's acid-proof *H. pylori*, the kidney, the brain and the lymph node) and faster where it helps (the liver's regrowth, the marrow's extra white cells, the spleen). In endless mode the kidney's own toughening runs over a cycle of its waves and then starts again, rather than compounding for ever. A test requires every organ's run to last 8 to 25 waves.

## When an organ falls

The defeat screen says where the damage came from (how much came up the worst vessel and which pathogen did the most harm, or, on the spleen, how much went on remaking lost white cells) and suggests the counter: an IgG aimed at that bacterium (saying so, with an **Upgrades** button, when that target hasn't been bought yet), IgA for fast viruses, IgM and IgE for viral bosses, or keeping white cells away from hijackers.

## The tutorial

The first time you play the heart, a guided first wave walks you through it, one step at a time, waiting for you at each: place a lymph node (a ring marks the spot), start the wave, open the left vessel when the bacteria are on their way in, how NO keeps it open, and the immune pulse. At the two moments that can't wait (opening the vessel, firing the pulse) time stands still until you act. **Skip tutorial** is always there; the menu's **Tutorial** button replays it.

## Gold and upgrades

Your gold is shown in the top bar. Winning an organ pays gold: **100 × the organ's number + 5 per organ health left** the first time (the heart with 12 health left pays 160), and a quarter of that on a replay. Spend it in **Upgrades**; everything you buy is kept for the whole career and applies at once.

| Upgrade | Levels | Gold | Effect |
|---|---|---|---|
| IgM / IgG / IgA / IgE damage | 3 each | 80, 160, 240 | +15% damage for every node of that type, per level |
| IgG target | 1 each | 120 | Aim IgG at *S. pneumoniae*, *Listeria*, *N. meningitidis*, *E. coli*, *Klebsiella*, *M. tuberculosis*, *H. pylori*, *Salmonella*, *S. pyogenes*, *Pseudomonas* or *Chlamydia* (*S. aureus* is always unlocked) |
| Dual-target IgG | 1 | 600 | An IgG node can be aimed at two unlocked targets; each hit uses the better match. A dual node costs 80 energy, or 30 to add a second target to a placed one |
| More NO | 2 | 100, 200 | +20 NO capacity per level |
| Extra starting node | 1 | 150 | Every organ starts with one more IgM already placed |
| Cheaper first node | 1 | 150 | The first node you place in each build phase costs half |

The heart and lungs can be won without upgrades; later organs need the right IgG targets (bought, or borrowed for the organ) and some damage. Before you start an organ, the **Organs** list, a message and the build panel name any of its bacteria you have no IgG target for yet; the shop says which organs each bacterium comes in.

## Bosses

Every organ ends with a boss wave: its giant pathogen comes up **every vessel**, one after another 3 s apart, each with 45% of the boss's health, plus an escort. While they live, a **BOSS** banner across the top of the map counts them and shows their total health; each leaked boss costs 6 to 8 organ health.

| Organ | Boss | Trick | What works |
|---|---|---|---|
| Heart | **Staph colony** | A grape-bunch of *S. aureus*. When it bursts, three weakened staph spill out. | IgG aimed at *S. aureus* (×3) |
| Lungs | **Mother virus** | Releases a new virus every 2.4 s as it travels, and rides the breathing surges. | IgM, IgE |
| Brain | **Meningococcus** | A giant *N. meningitidis* that IgA cannot slow. | IgG aimed at *N. meningitidis* (×3) |
| Liver | **Hepatitis giant** | Regrows 9 health per second as it climbs the long portal vein. | IgM, IgE: damage must outpace it |
| Kidney | **Sepsis hijacker** | A giant hijacker that infects **every** white cell it touches and keeps going. | Nodes, not white cells |
| Spleen | ***Plasmodium*** (malaria) | A parasite, not a bacterium. Every 6 s it hides inside a red blood cell for 2 s (shown faded, with a turning dashed ring and a HIDING tag): nothing can target or hit it then, and antibodies in flight miss. | IgM, IgE, and a pulse timed for when it shows |
| Bone marrow | **Tuberculous granuloma** | *M. tuberculosis* walled in by your own cells (drawn with a ring of stone blocks and a "wall" count). Until antibodies have struck it 40 times, everything does a quarter damage to it; white cells' steady fighting doesn't chip the wall. A pulse breaks the wall at once. | Many fast-firing nodes on its vessel, or the pulse; then IgG aimed at *M. tuberculosis* |
| Stomach | **H. pylori swarm** | A swarm of curved rods in mucus, acid-proof. Every 5 s it burrows into the stomach lining for 1.6 s (shown faded with a BURROWED tag): nothing can target or hit it, and it tunnels on three times as fast. | Many nodes on its vessel, IgG aimed at *H. pylori*, so it is worn down while it is out |
| Lymph node | **HIV** | The virus that attacks the immune system: white cells can't touch it (they neither fight it nor can strike it with the pulse), and **every lymph node it passes is switched off** for the rest of the wave (struck through in violet, marked "off"). | IgM and IgE far out on its vessel, so it dies before it gets far |
| Skin | **Flesh-eating strep** | Necrotising fasciitis: *S. pyogenes* tearing through tissue. **Every antibody strike makes it 2% faster**, up to 2.2 times its speed. | Slow it with IgA where it enters; finish it fast with IgE |
| Eye | **Herpes virus** | Herpes simplex, which hides in nerves. **Twice, when its health falls to half, it goes dormant for 3 s** (shown faded with a DORMANT tag): nothing can touch it, and it wakes with a quarter of its health back. | IgM and IgE, enough to finish it after it wakes |

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
| *Mycobacterium tuberculosis* | acid-fast (counted as +) | rod (beaded, in cords) | bone marrow |
| *Helicobacter pylori* | − | curved rod (acid-proof) | stomach |
| *Salmonella enterica* | − | rod (fast, in groups) | stomach |
| *Streptococcus pyogenes* | + | coccus (long chains) | lymph node, skin |
| *Pseudomonas aeruginosa* | − | rod (one whip-like flagellum) | skin, eye |
| *Chlamydia trachomatis* | − | coccoid (lives inside cells) | eye |

The first six have 70 health and the same speed; *M. tuberculosis* is tougher (95) and slower, *H. pylori* tougher (90) and untouched by stomach acid, *Salmonella* frailer (55) but much faster; viruses (10 health) are fast and come in groups.

## How it plays

1. **Prepare.** You don't see what is coming: the next wave's pathogens, and the vessels they take, are only shown once it starts (its title is all you get). Build for anything.
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own route; a node on a fork's shared stem guards both branches. Nodes cost energy; every vessel starts with **one free IgM** (on its shared stem if it forks), you start with 100–380 energy more, and you earn energy for every kill and for every wave cleared (30 + 8 × the wave's number). From the liver on, energy is tight (kills and cleared waves pay 55–70% as much), so you can build on only about half of the other sites: choose where to build. Every build is saved at once. Most routes have five sites (the liver's more, the brain's three).

   **IgG is limited:** at most **2 IgG nodes may aim at any one bacterium** on an organ (a dual-target node counts for both); a third is refused, and you can build an IgM there instead. **Borrowing a target:** a bacterium you haven't unlocked can be borrowed as an IgG target **for the rest of that organ for 30 gold** (from the build menu's target list, or the notice at the top of the panel). It's gone when the organ ends; the permanent target in Upgrades costs 120.

| Node | Cost | Damage | Effect |
|---|---|---|---|
| **IgM** | 60 | 10 | Hits every pathogen the same. |
| **IgG** | 50 | 10 × match | **Aimed at one bacterium** (you pick it when you place the node; re-aim between waves for 20 energy). The best single match applies: **×3** its species, **×2.5** the same shape, **×2** the same Gram stain, **×0.5** any other bacterium, **×0.25** anything that is not a bacterium (viruses, hijackers, infected cells, viral bosses). |
| **IgA** | 40 | 7.5 | Slows what it hits to 40% of its speed for 2.2 s (not the meningococcus). |
| **IgE** | 80 | 20 | Double damage and a longer reach, but it **burns out after its third wave**; its site is free again for the next build. |

3. **Start the wave.** Every vessel starts at rest, and your white cells (two, or three in the brain) wait at the organ.
4. **Dilate during the wave, with NO.** Click or tap a route (or press the key in the ring before its name: 1 to 9, then 0, - and =) to open it: its walls part and the white cells set out along it, against the flow, under their nodes' cover. **Several routes can be open at once**, as many as you have white cells: the cells are split evenly among them (two open with two cells: one each), and closing one sends its cells home and on to the others. Opening the other branch of a fork switches to it rather than opening both. Clicking an open route closes it. The **NO gauge** (100) pays for it: the first opening costs **15** (and you need at least 23, enough to hold it open for a second) and an open route drains **8 a second**; **each route opened beyond the first costs only 8 and drains just 3 a second more** (two open drain 11), and while every route is closed NO refills **3 a second**; each cleared wave adds **35**. When NO runs out every route closes and the cells head home. Cells at home or heading home don't fight, so every second closed is a second the organ relies on its nodes alone.
5. **Forks** (brain, liver, kidney). A forked vessel splits into two branches on its way in. Pathogens travel the shared stem, and at the fork take the branch you have **not** opened (with neither open, they alternate). Cells on either branch can fight up the stem.
6. **Immune pulse.** Once per wave, every white cell out on a route that is touching a pathogen there destroys it, the one furthest in, and dies doing it (two cells never pick the same one). A boss is not destroyed: it loses a third of its full health. The pulse can only be fired while at least one cell is touching something, so it is never wasted. When the pulse fires, each cell that gives its life bursts in a splash of ink and the pathogen it struck is crossed out with two pen strokes. Lost cells are back at the start of the next wave (on the spleen they are remade mid-wave, at 1 health each). Save it for something tough that is about to get through.

**White cells** have 90 health and fight **everything** they touch at once, 7 damage a second to each, so a cell holds its own against a swarm of viruses.
7. **Reset.** Cells return home, every route rests, you earn energy and build again. Organ damage persists until restart (the liver regrows a little).

**After each wave** the panel shows a **Last wave** card: what came up each vessel, and how much organ health each vessel cost.

**One-time tips** explain each new rule the first time it matters (hidden waves, pathogen details, borrowing a target and the IgG limit, opening several vessels, the gallbladder, HIV), in a slip above the panel, never over the map; each is shown once per career.

**Click a pathogen** during a wave to see its details card: its name and Gram stain/shape, its health now, its speed (and any IgA slow), the organ damage and energy it's worth, how hard it hurts a white cell, how hard your IgG can hit it, and its tricks (a wall's strikes left, whether it is hiding or burrowed right now). The card follows it until it dies; it is ringed on the map.

**Pathogens:** the twelve bacteria above (slow, tough), viruses (small, fast, in groups), and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** heading for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA / IgE | **Place by list** in the panel |
| Open / switch / close a route (during a wave) | Click / tap a vessel, or the route buttons | 1–8, in the order the panel lists the routes |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Menu, pause, speed, restart | buttons in the top bar (**Speed** steps through ×1, ×1.5, ×2 and ×3) | P to pause; Esc closes the build menu or steps back in the menu |
| Sound on / off | **Sound** in the top bar | M |
| Pathogen details | Click / tap a pathogen during a wave | I steps through them (the one nearest the organ first); Esc closes |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, slow, burn-out), the IgG match multipliers (`iggMatch`) and re-aim cost, white cells, the pulse, the NO gauge (`no`: capacity, opening cost, drain, refill, top-up), pathogens (health, speed, Gram stain / shape / species for bacteria, organ damage, contact damage, infection). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, starting nodes, its twist (`surge`, `regenPerWave`, `filtration`, `respawn`), its map (organ centre and size, vessel paths with any `fork` and its two branches, where along each route the build sites go, and `gaugeDrop` where the NO gauge would cover a vessel name) and its waves. [`src/level.ts`](src/level.ts) turns the loaded organ's vessels into routes (a forked vessel becomes two routes sharing a stem) and places the sites.

### Balance assumptions

The figures come from the scripted players in `tests/game.test.ts`. Each game has its own seeded random source (for the small drift of pathogens across a vessel), so the same game always plays out the same way and these figures repeat exactly.


- **The career player can't see the waves coming**, like a real one. It builds round the vessels, least defended first, two rounds a build, with IgG aimed in turn at the organ's bacteria (the panel names them; at most two per bacterium), an IgA as every third node on a vessel, and IgM otherwise. During the wave it opens the route with the most pathogens past 65% of the way in, keeping 2 s of NO to spare, closes it when clear, and switches only for twice the threat (one route at a time). It fires the pulse only for a boss, or for a pathogen with 40+ health left that is past 85% of the way in. **As a career** (organs in order, gold banked, before each organ buying first the IgG targets for its bacteria, then damage for its most-built node types, then the rest) it wins every organ at the first attempt: heart 20/20, lungs 15/20 (buying the *S. pneumoniae* target and IgM damage), brain 15/18 (*Listeria* and *N. meningitidis*), liver 16/24 (*E. coli*, *Klebsiella* and IgM damage), kidney 16/20 (IgM damage and two levels of IgA), spleen 18/22 (IgA damage, two levels of IgG and one of IgE), bone marrow 17/24 (the *M. tuberculosis* target, IgG and IgE damage, more NO), stomach 19/24 (the *Salmonella* and *H. pylori* targets, IgE damage, more NO and the extra starting node), lymph node 18/26 (the *S. pyogenes* target, dual-target IgG and the cheaper first node), skin 19/24 (the *Pseudomonas* target), eye 13/22 (the *Chlamydia* target). From the liver on it builds on 62%, 67%, 54%, 58%, 73%, 58%, 71% and 74% of the sites beyond the free IgMs (the tests require at most 75%: a player who can't see what's coming has to cover every vessel).
  - **The difficulty climbs, roughly.** As a share of health kept: heart 100%, lungs 75%, brain 83%, liver 67%, kidney 80%, spleen 82%, bone marrow 71%, stomach 79%, lymph node 69%, skin 79%, eye 59% (the eye, with no white cells, is the hardest). Starting energy alone couldn't do it: each organ's result jumps in steps as energy changes, so the brain's and stomach's waves were made larger instead (about a third more pathogens in each group; the stomach's acid also down from 4 to 3 a second), which brought both from flawless to 15. The kidney's pathogens now grow 20% tougher a wave (was 15%), bringing it from 18 to 16. The stomach, skin and eye lost all their health in wave 1 and none after, so their first waves are now lighter (60% of the pathogens) and their later ones heavier (up to 125%): the damage now comes across each organ (stomach 24, 24, 19, 19, 19 after each wave; skin 21, 21, 19, 19, 19; eye 19, 13, 13, 13, 13).
- **For comparison**, the same career played by a player who *can* see each wave coming (and builds for exactly what comes up each vessel) ends: heart 20, lungs 20, brain 18, liver 24, kidney 18, spleen 18, bone marrow 24, stomach 24, lymph node 26, skin 5, eye 18 (seeing the waves doesn't help on the skin, where it builds for each wave's groups and is caught out by the wounds opening inside its defences). One who opens every route with pathogens well in, as many as it has white cells, now does about as well as one who opens one at a time, since extra routes are cheap: heart 20, lungs 13, brain 16, liver 22, kidney 16, spleen 18, bone marrow 18, stomach 13, lymph node 18, skin 20, eye 13.
- **Without upgrades**, the all-seeing player wins the heart and the lungs without losing health.
- **A clumsy new player wins the heart.** A scripted player who builds only IgM on the first free sites in the list, opens a vessel only once a pathogen is 80% of the way in, and never pulses, still clears the heart without losing health. The heart is gentle on purpose: its free IgMs alone hold it. (The **Place by list** order takes each vessel's outermost site first, then the next.)
- Never building loses every organ, even with every upgrade; white cells alone leak most of the heart's health in wave 1 (it ends on 5/20).
- **Holding one route open is worse than dilating with care.** With the career's upgrades at each organ, a player who opens the busiest route as soon as it can and never closes it loses the lungs, the brain, the stomach, the lymph node and the skin, and finishes every other organ at least 2 health worse: liver 11 (against 16), kidney 11 (16), spleen 8 (18), bone marrow 2 (17). The tests require this on every organ but the heart, where the free IgMs win either way, and the eye, which has no white cells to send.
- Virus health (10) is set so IgM and IgE kill one in a single hit; a well-aimed IgG kills a 70-health bacterium in three hits, IgM needs seven.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the eleven organ levels (maps, twists, waves). |
| `src/level.ts` | The loaded organ's routes (forks expanded into two routes sharing a stem) and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): endless waves (`endlessWave`), placement, mid-wave dilation and the NO gauge, forks, waves, immunoglobulins, white cells, infection, the pulse, recall. |
| `src/bosses.ts` | The eleven boss pathogens' drawings. Each boss's animation loops every 4π seconds, so its 64 inked frames are made once and reused; the boss is turned to face its way and hits flash over it. |
| `src/bacteria.ts` | The twelve bacteria's drawings: cell walls, nucleoid and ribosomes, capsules, pili, beating flagella; each still body is drawn and inked once per size and reused. |
| `src/organs.ts` | The lungs, brain, liver (with the gut), kidney, spleen, bone marrow, stomach, lymph node, skin and eye as anatomy-plate drawings: lobes, fissures and the bronchial tree; gyri, cerebellum and cerebral arteries; hepatic veins and ligaments; cortex, pyramids, hilar vessels and ureter; a tilted crimson spleen with a deeply notched border and a cut face speckled with white pulp, unlike the kidney's bean; a long bone cut open, with its cortex, red marrow, spongy heads and nutrient artery; the stomach with its folds, a pool of acid, the oesophagus, pylorus and duodenum; the lymph node with its follicles, medulla, afferent lymphatics and hilum; a block of skin with its layers, hair follicle, sweat gland and a cut; the eye cut in half with its cornea, lens, retina and optic nerve. Each organ (and the heart, drawn in `src/draw.ts` with its coronary vessels) is drawn and inked once into an image and reused every frame. |
| `src/sound.ts` | Sound made on the fly with Web Audio (no sound files): a pen scratch for building, plucks for kills, a thud when the organ is hit, a chime for the pulse, a horn for a boss, a heartbeat once the organ has lost a fifth of its health, quickening as it weakens, one horn per boss wave, win and loss. **Sound** in the top bar or M mutes it (remembered). `src/soundEvents.ts` decides which to play for what happened each frame. |
| `src/ink.ts` | The pen-and-ink look: cream paper with faint tissue drawn behind the map, and `inkify`, which turns a colour drawing into ink on paper (colour thinned to a faint wash; shadows hatched, cross-hatched and stippled by how dark they are; edges drawn in as pen lines). It runs once per organ image and per sprite, and the results are kept, never redone every frame. |
| `src/labels.ts` | Where the vessel names go: each name is placed clear of the build sites, the organ (its whole strip, not just its middle), the corners and the other names, and a fork's branch names sit on their outer sides. Which key opens each route (`ROUTE_KEYS`). |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens, effects. |
| `src/career.ts` | The career and its save (no DOM): the endless leaderboard (best ten runs per organ), gold, the upgrade shop and what upgrades do in play, organs cleared, best health, the game in progress, a versioned `localStorage` entry with old-save migration; an unreadable save is kept aside, never lost. |
| `src/tutorial.ts` | The heart's guided first wave (no DOM): its steps, when each is done, when time holds, what the callout says and points at. |
| `src/style.css` | The panel, top bar, menus and popovers in the ink style: paper plates, ink rules, washes and hatching (CSS variables at the top). |
| `src/inspect.ts` | The pathogen under a click, and its details card. |
| `src/main.ts` | HUD, panel, the menu, the tutorial's callout, autosave, build popover and IgG target picker, mouse / touch / keyboard input, overlays. |
| `tests/tutorial.test.ts` | The tutorial played through on the real simulation: every step in order, the holds, skipping the pulse if the wave ends, the saved seen flag. |
| `tests/career.test.ts` | The save (fresh, round-trip, migration, unreadable and newer saves, no storage, Continue, winning and losing), gold, the shop and upgrade effects. |
| `tests/players.ts` | The scripted players the balance tests use (the career player who can't see the waves, the one who can, the clumsy one, the one who holds a route open, the one who opens several) and the helpers that drive a game in a test. |
| `tests/game.test.ts` | Tests for every rule (NO and dilation, forks, cells, pulse, placement, the four lymph nodes and the IgG match, IgE burn-out, infection), each organ's map and twist, each boss's trick, map labels that never cover a site or each other, plus balance on every organ (including the hold-open check). |
