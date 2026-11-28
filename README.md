# Defend the Heart

A fixed top-down 2D anatomy tower defence across ten organs. Each organ is the base on its own map, with blood vessels approaching it from different sides. You place lymph nodes beside the vessels between waves. During a wave you open (dilate) one vessel at a time for your white blood cells, paying for it with a scarce gauge of nitric oxide (NO), and once per wave can fire the immune pulse, in which every white cell touching a pathogen gives its life to destroy it. From the brain on, some vessels fork, and pathogens at a fork take the branch you have not opened.

## The organs

Clear an organ to unlock the next. The game opens on a **menu**:

- **Continue** picks up your game where you left it: the organ, the wave, your nodes (with their IgG targets and IgE waves left), energy, organ health and NO. It is saved in your browser at the start of every build phase, so leaving mid-wave brings you back to that wave's build phase. Losing an organ ends that run.
- **New career** starts over at the heart, at the difficulty you choose (it asks first if you have progress).
- **Upgrades** is the gold shop (below).
- **Endless** opens once you have cleared the eye: organ after organ, each bigger than the last (see below), with your leaderboard.
- **Tutorial** replays the guided first wave on the heart.
- **Organs** lists the ten organs: cleared ones show your best health and can be replayed. Starting a different organ while a game is in progress asks first.

The highlighted button is the way on: **Continue** for a game in progress, else **Continue** to the next organ you haven't cleared, else **Endless**. The **Menu** button in the top bar opens it at any time (the game pauses). Between waves, the **Level** card in the panel also switches organ.

### Difficulty

A career is played at one of four difficulties, chosen when it starts: **Easy** (pathogens 80% health, 85% as many, 15% more energy, 15% more gold), **Normal** (the game as tuned), **Hard** (110% health, 105% as many, the same energy, 85% gold) and **Brutal** (115%, 110%, 95% energy, 70% gold). Each keeps its own endless leaderboard, and the top bar shows it beside the level.

Played through by the scripted career player (who can't see the waves, and plays mechanically: a good human does better), Easy clears all 10 organs keeping 221 health in all, Normal all 10 keeping 185, Hard 9 (falling on the eye, 107 health kept) and Brutal 2 (22 kept). A test keeps them in that order.

### Each organ's feature, and its slight disadvantage

At the start of every organ, a label at the bottom left of the map names its unique feature and its own slight disadvantage (click it to put it away; the Level card under **Info** keeps both):

| Organ | Feature | Disadvantage |
|---|---|---|
| Heart | Four vessels, one beating target | Racing pulse: pathogens move 5% faster |
| Lungs | Breathing surges; each breath brings 20 NO | Short of breath: NO refills 25% slower |
| Liver | Regrows; the gallbladder can burst | Fatty liver: every lymph node costs 5 more energy |
| Kidney | Filtration; tougher every wave | Poor blood supply: 10% less energy |
| Spleen | Remakes lost white cells | Enlarged: white cells move 15% slower |
| Bone marrow | A white cell more every wave | Brittle bone: IgE burns out a wave sooner |
| Stomach | Acid; *H. pylori* feeds on it | Churning: NO drains 15% faster |
| Lymph node | Leaks weaken your nodes; HIV | Fever: white cells have 20% less health |
| Skin | Pathogens enter through wounds | Inflamed: pathogens have 10% more health |
| Eye | No white cells: nodes alone | Blurred: lymph nodes fire 10% slower |

| Level | Organ | Routes in | Twist | Health | Waves |
|---|---|---|---|---|---|
| 1 | **Heart** | 4 | The tutorial organ, made for new players: gentler first waves, and hints that walk you through building, opening a vessel and aiming IgG. | 20 | 5 + boss |
| 2 | **Lungs** | 5 | **Breathing.** Every 6 s the lungs inhale for 1.4 s and everything in the vessels surges forward ×2.2 (the panel counts down to the next breath, the map shows INHALE). **Every breath also brings 20 NO** (up to the gauge's top), so a vessel can be held open longer. | 20 | 4 + boss |
| 3 | **Liver** | 7 (two forks) | **Portal vein.** A long vein from the gut brings columns of bacteria (it forks before the liver); the liver **regrows 2 health** after every cleared wave. **Its gallbladder bursts** the first time the liver falls to half health: bile destroys 2 of your lymph nodes at random, leaving green stains where they stood (you can build there again). The gallbladder sits by the health bead it bursts at, labelled with the health it bursts at; within 3 health it swells, throbs and counts down the hits left. When it bursts the map flashes green, bile splashes out and jets to each node it dissolves, with a wet pop. | 24 | 4 + boss |
| 4 | **Kidney** | 8 (three forks) | **Filtration.** On the last 28% of every vessel (the striped stretch) pathogens crawl at ×0.6 speed, so nodes near the kidney get more shots. Hijackers throughout. Every wave its pathogens come **20% tougher** (wave 5: ×1.8 health). | 20 | 4 + boss |
| 5 | **Spleen** | 9 (three forks) | **It remakes white cells.** A white cell that is killed or infected comes back at the spleen 8 s later, and the spleen pays 1 health when it does (a cell lost too late in a wave to come back costs nothing). The bacteria it exists to clear: pneumococci, meningococci, *Klebsiella*. | 22 | 4 + boss |
| 6 | **Bone marrow** | 10 (four forks) | **It makes white cells.** You start with only 2; every cleared wave adds one more, up to 5 (2, 3, 4, 5, 5 over its five waves). The tuberculosis bone: *M. tuberculosis* arrives here for the first time, with staph and *E. coli*; any that reach the marrow **lodge** there (below). | 24 | 4 + boss |
| 7 | **Stomach** | 11 (four forks) | **Acid.** On the last third of every vessel (shown with a yellow-green wash and bubbles), pathogens lose 2 health a second, so whatever gets close is worn down; *H. pylori* and its swarm feed on the acid, **gaining** 2 health a second there instead. New bacteria: *H. pylori* and *Salmonella*. Here *H. pylori* **hits twice as hard** (6 health, and twice the harm to white cells), and each one that gets through **lodges**: 1 health at the end of every wave until the stomach is done, and a small cancer grows on it, a lobe for each. **Jumping viruses** first come here. | 24 | 4 + boss |
| 8 | **Lymph node** (the finale) | 12 (five forks) | **Your own defences are the target.** Every pathogen that reaches the node **weakens the lymph nodes guarding its vessel by 10%** (down to half), shown as a % under each, until the wave ends. Three white cells. New bacterium: *S. pyogenes*. | 26 | 4 + boss |
| 9 | **Skin** | 10 (four forks) | **Open wounds.** Pathogens come in through cuts, partway along their vessels (a fixed place for each group, 20–50% of the way in), not from the edge of the map, so the inner sites matter from the start; each wound stays marked on its vessel for the rest of the organ. A wide slab of skin, with forks off both sides and from below. Three white cells. New bacterium: *Pseudomonas aeruginosa*. | 24 | 4 + boss |
| 10 | **Eye** | 8 (three forks) | **Immune privilege.** No white cells come to the eye: no pulse, no cells fighting, only your lymph nodes (a vessel can still be opened, to turn pathogens at a fork). The eye is drawn turned over, its optic nerve leaving between the two upper forks. New bacterium: *Chlamydia trachomatis*. | 22 | 4 + boss |

**Play it:** https://brendanjvr-ux.github.io/defend-the-heart/

It began as a conversion of [The Last Ward: Siege of Goosebridge](https://github.com/BrendanJvR-ux/the-last-ward), a storybook tower defence, and now lives in its own repository.

**Run it locally:** `npm install`, then `npm run dev`, and open http://localhost:5173/. Tests: `npm test`.

## The look

Everything is drawn like a pen-and-ink plate with faint watercolour:

- **The map** is cream paper with faint washes of rose, blue-grey, ochre, sage and pink, and tissue sketched lightly in ink behind it all: loose cells with stippled nuclei, drifting fibres, and small capillaries branching in from the edges like roots. A double ink rule frames it.
- **The map's tags and gauges** match: organ health is a ring of hatched rose beads in ink (an empty pen circle for each one lost), the NO gauge, health bars and the boss bar are hatched washes in ink outlines on paper slips, and the next-wave tags, DILATED and HIDING are inked paper slips. Antibodies are drawn in pen with a thin line of their node's colour; hits and losses show as ink rings; floating words are inked italics that move clear of the vessel names and stay inside the map. The NO gauge sits under the organ, or above it on the eye, clear of every vessel name. Each route's name has the key that opens it in a small ring before it (blue during a wave; not shown on touch screens, which have no keys), and a fork's two branch names sit on their outer sides. Messages appear at the top of the map, or at the bottom while a boss's health bar is up there. A wound on the skin is a red cut across its vessel, labelled. TB lodged in an organ shows as pale tubercles on it; *H. pylori* lodged in the stomach as a small dark cancer. A broad IgG node wears a second blue ring; a node that can still be cancelled, a dashed one. An infected white cell going for a lymph node draws a dashed violet line to it.
- **Organs, pathogens, bosses, white cells and lymph nodes** are drawn in colour, then inked: the colour thinned to a faint wash, the shadows hatched, cross-hatched and stippled by how dark they are, edges drawn in as single pen lines, and a hatched band along each organ's shaded (lower-right) side so it reads as rounded. Darker organs are lifted to a common lightness, so none turns into solid cross-hatching. Each colour still tells the pathogens and node types apart.
- **Vessels** wind: their corners are rounded and a long, even meander (with a faint shorter ripple on it) runs along each one (the same along a forked vessel's shared stem, fading out where it meets the organ). The winding is real length: every route is **half as long again** as its corner points, measured along the course pathogens and white cells follow, so pathogens take half as long again to arrive and move at a steady speed round the bends. Each has a firm ink outline, a pale rose wash, hatched walls and red cells ringed in fine ink.
- **The panel, top bar and menus** are paper plates on a faintly cross-hatched table: a double ink rule with slightly uneven, hand-drawn corners; buttons with an ink offset shadow; the selected organ, primary buttons, the open vessel, the pulse button and the gauges in faint washes with pen hatching instead of solid colour; italic serif headings.

Inking is a pass over pixels, so it is run once per organ image and per sprite and the results are kept. The map's background and every vessel at rest are drawn once into a layer per map and screen size; only open, opening or hovered vessels are drawn each frame (a busy frame drew in about 14 ms before, well under 1 ms now). The next organ is inked in idle time after a win (and the saved organ while the menu is up), so it opens without a pause; a boss's animation loops, so each of its 64 frames is inked once and reused.

## Endless mode and your leaderboard

Once you have cleared the eye, **Endless** in the menu starts a run through organ after organ: the heart, then the lungs, and so on, round again after the eye. Each organ is a **stage**, played with its own five waves and starting at full health, with your nodes and energy fresh. Every stage cleared the field grows:

- **The vessels wind longer**: 8% more a stage (up to 1.9 times their corner points, against 1.5 in the career).
- **More build sites**: every two stages, each vessel gets another one, between the usual ones, on whichever side has room.
- **Tougher and more**: pathogens have 6% more health a stage, and every group is 4% larger.
- **More energy**: each stage starts with 3% more energy than the last (the extra sites are no use without it; it also stopped weaker runs all ending at the stomach on stage 8).
- **Bosses at random**: on top of each organ's own boss wave, a boss chosen at random comes up a vessel chosen at random in one of its middle waves (never the first, when little is built yet) on the first stage, and in one more every two stages, with 55% of its health like a boss-wave boss (the same stage always brings the same ones). The wave's hint names it, its vessel, its trick and what works. Tests check that the vessel names still clear the sites and each other on every organ at stages 12, 22 and 34.

A stage cleared pays **20 gold** (scaled by the difficulty), and the next stage is saved at once, so leaving at the stage-cleared screen and coming back carries on from there. Leaving a run still going (Restart, another organ, a new run) asks first, and puts it on the leaderboard as it stands. The run ends when an organ falls, and goes on the **leaderboard** for your difficulty: your ten best runs (stages cleared, waves into the next, and the date), kept in this browser with your career. The end screen says where it placed ("A new best!", or #3 on the board). The leaderboard is personal to this device, not shared between players.

The scripted player who can't see the waves, with every upgrade the career buys by its end, clears 14 stages, falling on stage 15, the spleen, on all three seeds (the first round of ten organs and four more). (Before the population re-tune it cleared 15; with eleven organs 16 or 13; before endless energy grew, 12, or 7 when the stomach stopped it; before random bosses stopped coming in a stage's first wave at full health, and growth was gentler, it fell on stage 4.) A test requires the middle of three runs to clear at least 8 stages, and every run to end by stage 30.

## Attack mode

**Attack mode** in the menu turns the game round: you are the infection. Choose an organ and play a **match: the best of three attacks** (two wins take the organ). Each attack is planned within the organ's **budget**: 8 points per point of its health and one per two of its starting energy, times a factor for that organ (below). An attack is up to eight groups, each one kind of pathogen up one vessel, 1 to 20 of them, sent after a delay you choose (0 to 40 s; bacteria enter 1.3 s apart, viruses 0.7 s). **At most 12 pathogens may come up any one vessel in an attack**, counted over all its groups; a small virus counts as half and a boss as one. Every kind has a price worked out from its stats: its health (priced a little more than in proportion, as (health / 10)^1.25, since a tough pathogen outlasts several hits) weighted by its speed, the harm it does on arrival, and its tricks (infecting white cells, jumping, lodging). A virus costs 3, a hijacker 7, *Salmonella* 14, *S. aureus* 16 and *M. tuberculosis* 29. One boss may come, alone, at its boss-wave health.

**Virus swarms.** A group of 8 or more viruses (plain, jumping or hijacker) is a swarm. From the 8th, each virus in the group makes the whole group 2% faster and shrug off 2% more of every hit, up to 15% faster and 20% shrugged off (a 20-strong group reaches both). The planner shows each virus group's boost, or how many more would make it a swarm. Only Attack mode has swarms; the campaign's viruses are unchanged.

The organ is defended by the same scripted player the balance tests use. It spends all its energy on lymph nodes round its vessels **without seeing your plan** (IgG aimed at the bacteria that organ usually meets). Then, as your pathogens come, it dilates the vessel in the most danger with NO (buying more with its energy when it runs low) and fires the pulse at a boss or a tough one near the organ.

- **It is slow to change its mind:** it dilates one vessel at a time, opens the first at once, but switches only after another vessel has been in clearly more danger (twice) for **3 seconds**. Groups timed to arrive together up different vessels stretch it.
- **It learns during a match.** After each attack:
  - It builds more on the vessels your attacks came up. A vessel's nodes count for less in its plan the more of your budget came that way (a vessel that took everything counts its nodes at 1 / (1 + ½ × the number of vessels)).
  - It **aims IgG at the bacteria you sent** that its organ doesn't normally meet: up to two kinds, the ones you spent most on first, ahead of its organ's own.
- **You can see what it learnt:** the planner and the result screen say where it is looking and what it is aiming at.

You watch each attack play out on the usual map, at any speed; tap a pathogen to see its details. Bring the organ's health to 0 to win the attack; if the wave ends with health left, it held. Giving up an attack part-way counts as held. The result screen gives the score, where the damage came from and what to try.

**Balanced to an even match.** The figures come from simulated attackers (`tests/balance/attackers.ts`) of every skill, from new to strong, each with a favourite style:
- viruses and hijackers (skilled ones in full swarms);
- bacteria (a skilled one avoids the kinds the organ's IgG is aimed at);
- a mix, with hijackers first;
- a boss with support.

Each plans within the budget and the per-vessel limit. A skilled one times its groups so that each vessel's leaders arrive together. Between attacks those who adapt (more of the skilled) move their weight off the vessels the defender has learnt to watch. The swarm boost was tuned until swarms did about as well as bacteria and mixed attacks: at twice the strength above they won 99% of matches, with none 32%. Then each organ's budget factor was tuned on 400 matches (40 per organ) until the attacker took 51% overall and 48% to 53% on every organ:

| Organ | Heart | Lungs | Liver | Kidney | Spleen | Bone marrow | Stomach | Lymph node | Skin | Eye |
|---|---|---|---|---|---|---|---|---|---|---|
| Budget factor | 1.12 | 0.76 | 0.83 | 1.22 | 0.71 | 0.91 | 1 | 0.81 | 0.88 | 0.79 |
| Budget | 235 | 165 | 265 | 450 | 200 | 245 | 440 | 305 | 410 | 235 |

On those 400 matches:

| | Attacker takes |
|---|---|
| Weak attackers | 38% |
| Middle | 50% |
| Strong | 63% |
| Swarms | 55% |
| Bacteria | 57% |
| Mixed | 63% |
| Boss | 27% |

Before swarms, learning kinds and the slow switch, bacteria took 82% and viruses alone 18%, and skill barely mattered (53% weak, 57% strong). Boss attacks are still the weakest: a boss is priced at 1.5 times its stats.

A fresh run of **100 matches** (ten per organ, other attackers) has the attacker taking **48%** (single attacks 49%). Re-run it with `npx vite-node tests/balance/attackReport.ts [matches per organ]`. A test plays 40 matches and requires the attacker to take between 30% and 70% of them.

Attack mode is kept apart from the career: nothing is saved, it earns and spends no gold, and it leaves the Field Guide, seals and tips alone. A weak attack is held off on every organ, and so are viruses scattered thinly in groups too small to swarm, on nearly every organ (tests check both).

## When an organ falls

The defeat screen says where the damage came from (how much came up the worst vessel and which pathogen did the most harm, or, on the spleen, how much went on remaking lost white cells) and suggests the counter: an IgG aimed at that bacterium (saying so, with an **Upgrades** button, when that target hasn't been bought yet), IgA for fast viruses, IgM and IgE for viral bosses, or keeping white cells away from hijackers.

## The tutorial

The first time you play the heart, a guided first wave walks you through it, one step at a time, waiting for you at each: place a lymph node (a ring marks the spot), start the wave, open the left vessel when the bacteria are on their way in, how NO keeps it open, and the immune pulse. At the two moments that can't wait (opening the vessel, firing the pulse) time stands still until you act. **Skip tutorial** is always there; the menu's **Tutorial** button replays it.

## Gold and upgrades

Your gold is shown in the top bar. Winning an organ pays gold: **88 × the organ's number + 4 per organ health left** the first time (the heart with 12 health left pays 136), and a quarter of that on a replay, scaled by the difficulty. Spend it in **Upgrades**; everything you buy is kept for the whole career and applies at once.

**The organ's energy can also buy extras**, from the panel (between waves under **Extras**, during a wave beside the NO gauge and the white cells), the same energy you build nodes with:

- **+40 NO for 30 energy**, at once, between waves or during one. It may take NO past the gauge's top (up to one purchase over); it is spent first and the refill doesn't trim it.
- **+1 white cell for 90 energy**, for the rest of the organ (gone when it ends): it joins at once if a wave is on, and every wave after. At most 3 an organ; none on the eye.

Between waves a purchase is saved at once; a game reloaded mid-wave goes back to the wave's start, energy and all, so nothing paid is lost. Gold is only for upgrades.

| Upgrade | Levels | Gold | Effect |
|---|---|---|---|
| IgM / IgG / IgA / IgE damage | 3 each | 80, 160, 240 | +15% damage for every node of that type, per level |
| IgG target | 1 each | 120 | Aim IgG at *S. pneumoniae*, *Listeria*, *N. meningitidis*, *E. coli*, *Klebsiella*, *M. tuberculosis*, *H. pylori*, *Salmonella*, *S. pyogenes*, *Pseudomonas* or *Chlamydia* (*S. aureus* is always unlocked) |
| Broad IgG | 1 | 400 | An IgG node can be made **broad** when it is placed (a Broad switch above its targets): it hits every bacterium of its target's Gram stain as hard as one of the same shape (×2.5). A broad node costs 60 energy. (It replaces dual-target IgG; a career that bought that has this.) |
| More NO | 2 | 100, 200 | +20 NO capacity per level |
| Extra starting node | 1 | 150 | Every organ starts with one more IgM already placed |
| Cheaper first node | 1 | 150 | The first node you place in each build phase costs half |

The heart and lungs can be won without upgrades; later organs need the right IgG targets (bought, or borrowed for the organ) and some damage. Before you start an organ, the **Organs** list, a message and the build panel name any of its bacteria you have no IgG target for yet; the shop says which organs each bacterium comes in.

## Bosses

Every organ ends with a boss wave: its giant pathogen comes up **every vessel**, one after another 3 s apart, each with 55% of the boss's health, plus an escort, and each doing 55% of its harm if it gets through (3 to 4 organ health), so one vessel too few costs a few health rather than a third of the organ. While they live, a **BOSS** banner across the top of the map counts them and shows their total health.

| Organ | Boss | Trick | What works |
|---|---|---|---|
| Heart | **Staph colony** | A grape-bunch of *S. aureus*. When it bursts, three weakened staph spill out. | IgG aimed at *S. aureus* (×3) |
| Lungs | **Mother virus** | Releases a new virus every 2.4 s as it travels, and rides the breathing surges. | IgM, IgE |
| (endless only) | **Meningococcus** | A giant *N. meningitidis* that IgA cannot slow (no meningococcus can be): 400 health, 7 organ damage, 9 a second to white cells. It was the brain's boss; with the brain gone it comes only as one of endless's random bosses. | IgG aimed at *N. meningitidis* (×3) |
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
| *Streptococcus pneumoniae* | + | coccus (pairs, chains) | lungs, spleen |
| *Listeria monocytogenes* | + | rod | none (it came only to the brain; its IgG target is hidden in the shop unless already bought) |
| *Neisseria meningitidis* | − | coccus (bean-shaped pairs); its capsule shrugs off IgA, so nothing slows it | spleen |
| *Escherichia coli* | − | rod | liver, kidney |
| *Klebsiella pneumoniae* | − | rod (thick capsule) | lungs, liver, spleen |
| *Mycobacterium tuberculosis* | acid-fast (counted as +) | rod (beaded, in cords) | bone marrow |
| *Helicobacter pylori* | − | curved rod (acid-proof) | stomach |
| *Salmonella enterica* | − | rod (fast, in groups) | stomach |
| *Streptococcus pyogenes* | + | coccus (long chains) | lymph node, skin |
| *Pseudomonas aeruginosa* | − | rod (one whip-like flagellum) | skin, eye |
| *Chlamydia trachomatis* | − | coccoid (lives inside cells) | eye |

The first six have 70 health and the same speed; *M. tuberculosis* is tougher (120) and slower, *H. pylori* tougher (90) and untouched by stomach acid, *Salmonella* frailer (55) but much faster; viruses (10 health) are fast and come in groups.

**Lodging.** *M. tuberculosis* that reaches an organ **lodges** in it: from then on, the end of every wave costs **2 health for each one lodged**, until the organ ends (the panel counts them; tubercles appear on the organ). In the stomach, *H. pylori* lodges too, at 1 a wave each, and starts a small cancer.

**Jumping viruses** (from the stomach on): a third of the way in, each leaps once to a vessel of another entry, landing as far along it. They always come in from the map's edge (on the skin, not through wounds). A virus with long jointed legs, in green.

## How it plays

1. **Prepare.** You don't see what is coming: the next wave's pathogens, and the vessels they take, are only shown once it starts (its title is all you get). Build for anything.
2. **Place lymph nodes** (between waves only). Click a **+** site beside a vessel section and pick a type. Each node fires its immunoglobulin at pathogens on its own route; a node on a fork's shared stem guards both branches. Nodes cost energy; every vessel starts with **one free IgM** (on its shared stem if it forks), you start with 100–520 energy more, and you earn energy for every kill and for every wave cleared (30 + 8 × the wave's number). From the liver on, energy is tight (kills and cleared waves pay a quarter to four fifths as much), so you can build on only about half to two thirds of the other sites: choose where to build. Every build is saved at once. Most routes have five sites (the liver's more, the brain's three).

   **Changed your mind?** A node placed since the last wave can be **cancelled** for everything paid for it (placing and any re-aiming, and the cheaper-first-node discount comes back): click it and **Cancel this node**. Once the wave starts it stays. The **Start wave** button is at the very top of the panel.

   **IgG is limited:** at most **2 IgG nodes may aim at any one bacterium** on an organ; a third is refused, and you can build an IgM there instead. **Borrowing a target:** a bacterium you haven't unlocked can be borrowed as an IgG target **for the rest of that organ for 30 gold** (from the build menu's target list, or the notice at the top of the panel). It's gone when the organ ends; the permanent target in Upgrades costs 120.

| Node | Cost | Damage | Effect |
|---|---|---|---|
| **IgM** | 60 | 10 | Hits every pathogen the same. |
| **IgG** | 50 | 10 × match | **Aimed at one bacterium** (you pick it when you place the node; re-aim between waves for 20 energy). The best single match applies: **×3** its species, **×2.5** the same shape, **×2** the same Gram stain, **×0.5** any other bacterium, **×0.25** anything that is not a bacterium (viruses, hijackers, infected cells, viral bosses). |
| **IgA** | 40 | 7.5 | Slows what it hits to 40% of its speed for 2.2 s (not *N. meningitidis*, nor its boss). |
| **IgE** | 80 | 20 | Double damage and a longer reach, but it **burns out after its third wave**; its site is free again for the next build. |

3. **Start the wave.** Every vessel starts at rest, and your white cells (two, or three in some organs) wait at the organ.
4. **Dilate during the wave, with NO.** Click or tap a route (or press the key in the ring before its name: 1 to 9, then 0, - and =) to open it: its walls part and the white cells set out along it, against the flow, under their nodes' cover. **Several routes can be open at once**, as many as you have white cells: the cells are split evenly among them (two open with two cells: one each), and closing one sends its cells home and on to the others. Opening the other branch of a fork switches to it rather than opening both. Clicking an open route closes it. The **NO gauge** (100) pays for it: the first opening costs **15** (and you need at least 22, enough to hold it open for a second) and an open route drains **7 a second**; **each route opened beyond the first costs only 8 and drains just 3 a second more** (two open drain 10), and while every route is closed NO refills **3 a second**; each cleared wave adds **35**. When NO runs out every route closes and the cells head home. Cells at home or heading home don't fight, so every second closed is a second the organ relies on its nodes alone.
5. **Forks** (from the liver on). A forked vessel splits into two branches on its way in. Pathogens travel the shared stem, and at the fork take the branch you have **not** opened (with neither open, they alternate). Cells on either branch can fight up the stem.
6. **Immune pulse.** Once per wave, every white cell out on a route that is touching a pathogen there destroys it, the one furthest in, and dies doing it (two cells never pick the same one). A boss is not destroyed: it loses a quarter of its full health. The pulse can only be fired while at least one cell is touching something, so it is never wasted. When the pulse fires, each cell that gives its life bursts in a splash of ink and the pathogen it struck is crossed out with two pen strokes. Lost cells are back at the start of the next wave (on the spleen they are remade mid-wave, at 1 health each). Save it for something tough that is about to get through.

**White cells** have 90 health and fight **everything** they touch at once, 7 damage a second to each, so a cell holds its own against a swarm of viruses.
7. **Reset.** Cells return home, every route rests, you earn energy and build again. Organ damage persists until restart (the liver regrows a little).

**The side panel keeps only what you act on**: before a wave, Start wave, your energy and node costs, the extras energy buys and the last wave's report; during it, the NO gauge, the immune pulse and your white cells. **Messages never cover the map.** They sit small in a strip at the top of the side column: the **boss bar** (the boss's name, how many are coming, and their health together), **the wave's hint** as each wave starts (its title and what to expect, for a few seconds, longer for a longer hint; it waits while the game is paused, and a tap puts it away), short notes (a breath's NO, the gallbladder bursting, an infection lodging, the spleen remaking a cell), the organ's label at its start, and one-time tips. Only what happens at a place (a hit's damage, a cell lost, a node knocked out) is written on the map, beside it. Everything else (the organ's twist and handicap, the level picker, the wave's hint again, how nodes, dilation and the pulse work, Place by list) is in **Info**, a drawer that slides over the right side: open it from the button at the foot of the panel, close it with ×, a tap beside it, or Escape. **A tap outside any pop-up closes it**: the build menu, a pathogen's card, or the menu (from its shaded edge, except on a question that needs an answer). On the map, that tap only closes it, so it never opens the next site or a vessel by mistake.

**After each wave** the panel shows a **Last wave** card: what came up each vessel, and how much organ health each vessel cost.

**Switching away** mid-wave (another tab, a call) pauses the game. Gold spent during a wave is saved with the game, so a reload keeps what you paid for.

**On a phone the game is played sideways.** Held upright, it asks you to turn the phone (on Android a **Play full screen** button goes full screen and locks it to landscape). Sideways, the map fills the screen's full height on the left, and a slim column on the right holds the top bar (health, wave, energy, gold and the buttons), the message strip and the controls, all in small type; you open and close vessels by tapping them on the map. A tap reaches as far on a small map as on a big one (the sites, vessels and pathogens answer to about a fingertip around them, however small the map is drawn), and double-tap zoom and text selection are off so quick taps don't misfire. The page keeps to the part of the screen the browser actually shows (it follows the visible height as the address and tab bars come and go, and keeps clear of the notch), so the top bar's buttons never slip under the browser's bars; on a scrolling page (a tablet or a narrow window) the top bar sticks to the top. On the smallest phones the map is still small: the **Zoom** button on it doubles its size inside its frame (centred on the organ), and you swipe to move around it; everything pinned to the map, like a pathogen's card, moves with it. It is remembered.

**The difficulty** shows in the top bar beside the level ("Level 3 of 10 · Hard"); it is kept for the whole career.

**One-time tips** explain each new rule the first time it matters (hidden waves, pathogen details, borrowing a target and the IgG limit, opening several vessels, the gallbladder, jumping viruses, lodged infections, an infected cell after a node, HIV), in the message strip above the panel, never over the map; each is shown once per career.

**How to play**, in the menu, is the whole game on one page with the map's pictures: the goal, building, the four lymph nodes, dilating with NO, the pulse, organs, gold and upgrades, endless and the keys.

**Settings**, in the menu: **text size** (Normal, Large, Larger, for the panel, Info, messages, pop-ups and menus), **motion** (as the device asks, Reduced, or Full: reduced stops the organ beating, breathing and shaking, the gallbladder throbbing and the burst's flash, and the page's slides and fades; a hit still flashes red), and a note that every lymph node carries its letter (M, G, A, E) and every pathogen its own shape, so colour is never the only clue. Settings are kept in this browser apart from the career.

**Back up or restore** (under Settings): the whole career (organs cleared, gold, upgrades, endless runs, the game in progress) as one code beginning `DTH1.`, with a Copy button. Pasting a code on another device or browser and choosing **Restore** shows what it holds and asks before replacing the career there. Anything that is not a whole, readable career code is refused.

**Install it like an app.** The site is a web app: on a phone, *Add to Home Screen* (iPhone) or *Install app* (Android) gives it an icon, and it opens full screen and sideways. Once visited it also plays **offline**: the page is fetched fresh when there is a connection, so updates arrive, and from the cache when there isn't.

**Click a pathogen** during a wave to see its details card: its name and Gram stain/shape, its health now, its speed here (with the organ's handicap, any IgA slow, a frenzy), the organ damage (doubled for *H. pylori* in the stomach) and energy it's worth, how hard it hurts a white cell, how hard your IgG can hit it (broad, if you have it), and its tricks: a wall's strikes left, whether it is hiding, burrowed or dormant right now, a jumping virus's jump (or that it has made it), whether it would lodge here, and which lymph node an infected cell is going for. The card follows it until it dies; it is ringed on the map.

**Pathogens:** the twelve bacteria above (slow, tough), viruses (small, fast, in groups), jumping viruses, and **hijacker viruses**: if one reaches a white cell it gets inside, the cell is lost, and it becomes an **infected white cell** that goes for the **nearest lymph node on its vessel** (back the way it came if need be) and knocks it out for the rest of the wave if it gets there; with no node to go for, it heads for the organ. The heart's five waves introduce these one at a time; later organs mix them.

### The reserve cell, lab tests and the local antibiotic

**Hold 1 in reserve** (beside the white-cell count, between waves and during them; off by default) keeps one living white cell at the organ while the others follow the usual sharing of open vessels. During a wave the panel shows how many cells are deployed, returning and in reserve. Turned on while every cell is out, it recalls the cell nearest the organ at normal speed, shown as **Returning to reserve** until it arrives; that works for the last living cell too. A held cell at the organ touches nothing, so the immune pulse can't spend it. **Deploy reserve** then asks for a vessel (tap it on the map, pick it from the panel's list, or press its key): an open vessel takes the cell at once; a closed one opens as usual, for its NO and within the usual limits. Deploying turns the reserve off; cancelling (Cancel or Escape), or a vessel that can't be opened, keeps the cell held and spends nothing.

**Lab tests** (from the second organ on, between waves, one a wave, **20 energy**): a **Gram stain** reports the main Gram group among the wave's scheduled bacteria ("Mixed Gram result" on a tie, "No bacteria detected" for a wave without them; viruses are outside its scope), and a **vessel scan** names the vessel (or tied vessels) bringing the most pathogens, without saying what or when. The report is read from the wave's actual plan, which is fixed when the test is bought and used when the wave starts; it stays on screen through the wave, is kept in the save (a reload can't reroll it or charge twice), and opening, closing or rereading the panel is free.

**Local antibiotic** (unlocked once the fifth organ is cleared, used from the sixth organ on, and in endless; existing careers that have cleared the fifth get it): once a wave, **120 energy**, into one vessel for **6 s**. Every bacterium in that vessel takes **16 a second** (a bacterial boss 30% of that), including any that enter while it lasts; viruses, parasites and your own cells are untouched, and it stays in its vessel if dilation changes. Choosing **Local antibiotic** highlights every vessel and shows the cost, duration and effect; picking a vessel commits the dose (energy is spent only then); cancelling is free. The treated vessel glows green with a countdown ring. 120 energy is also two IgM nodes that keep firing for the rest of the organ, which is the trade-off. A one-time tip introduces it.

### Mastery, the Field Guide and the Anatomy Atlas

These are permanent: kept in this browser apart from the career (a new career keeps them), carried in the backup code (now `DTH2.`, career and progress together; older `DTH1.` codes still restore the career), and never given twice (a reload replays from the last wave's start, and a seal or method already held is not added again).

**Organ mastery**: three seals per organ. The first is for clearing it; the other two reward a tactic suited to it. Goals and progress show in the panel's Mastery card while preparing ("1 of 2 vessels intercepted from the reserve"). Every seal a won run meets is awarded when the organ is cleared, several at once if so; a loss awards none; endless stages award none. Older careers get the first-clear seal for every organ they have cleared.

| Organ | Tactical seals |
|---|---|
| Heart | **Rapid Response**: in one run, send a held reserve cell down two different vessels and have it meet a pathogen in each. **Lean Defence**: clear without buying an extra white cell. |
| Lungs | **Second Wind**: clear without buying NO. **Clear Airways**: lose no health in the last wave. |
| Liver | **Gallbladder Intact**: clear without the gallbladder bursting. **Full Recovery**: finish at full health. |
| Kidney | **Clean Filter**: no white cell infected. **Strong Finish**: lose no health in the last two waves. |
| Spleen | **No Replacements**: the spleen remakes no white cell. **Capsule Breaker**: IgG nodes deal the final blow to 12 bacteria. |
| Bone marrow | **No Lodging**: no *M. tuberculosis* lodged. **Full Muster**: five white cells out at once. |
| Stomach | **No Ulcers**: no *H. pylori* lodged. **Acid Test**: the acid deals the final blow to 10 pathogens. |
| Lymph node | **Full Strength**: no lymph node weakened below 80%. **Pulse Discipline**: clear without the immune pulse. |
| Skin | **Close Quarters**: white cells (contact or pulse) deal the final blow to 25 pathogens. **Field Rations**: buy no NO or white cells. |
| Eye | **Read the Signs**: buy a lab test before every wave. **Sharp-Eyed**: lose at most 3 health. |

**Stewardship** (on the lymph node, once the local antibiotic is unlocked): *Clear the organ. During the marked wave (wave 1, streptococci with viruses), use exactly one antibiotic dose and defeat at least three bacteria with that dose.* Kills are credited to the dose by final blow. It permanently unlocks a choice, made between waves, between **Standard** (16 a second for 6 s: suits a stream of arrivals) and **Burst** (60 at once, then 18 a second for 2 s: suits a group already in place). Both cost the same, treat one vessel, once a wave, the same bacteria and bosses; against a bacterium there throughout they deal the same 96. Measured on the simulation: against a clustered group the two deal the same total (483 against 480 over five bacteria), against a staggered stream Standard deals far more (414 against 149).

**The Pathogen Field Guide** (main menu, and the pause screen; opening it mid-wave pauses and returns to the same moment): an entry opens the first time a kind appears in battle, with the game's own drawing of it, its kind, how to tell it, its traits, where it comes and a tactical note. Its **second discovery**, an annotated note, comes from defeating that kind by two different methods across any runs: lymph node attack, white-cell contact, immune pulse or local antibiotic, credited by the final blow, each counted once; only methods that can defeat it are listed (no cells or pulse for what ignores cells, no antibiotic for viruses), and the entry shows which are recorded.

**The Anatomy Atlas** (main menu, and an **Atlas page** button on an organ's result screen) shows the organs in campaign order: a faint silhouette until reached, inked once cleared, in full colour with all three seals, each with its seal count and its seals' own marks (◆ ● ▲, filled when earned, hollow when not), readable without colour. An organ's page gives its mechanic, its seals with the exact goals still open, Stewardship where it applies, and **Replay** (the usual organ change, with its confirmation; a replay pays a quarter of the gold, and seals can be earned on any clear).

### Controls

| | Mouse / touch | Keyboard |
|---|---|---|
| Place a lymph node | Click / tap a **+** site, then IgM / IgG / IgA / IgE | **Place by list** under Info |
| Open / switch / close a route (during a wave) | Click / tap a vessel, or the route buttons | The key in the ring before its name: 1 to 9, then 0, - and = |
| Start wave | **Start wave** | Enter |
| Immune pulse | **Immune pulse** | Space |
| Menu, pause, speed, restart | buttons in the top bar (**Speed** steps through ×1, ×1.5, ×2 and ×3) | P to pause; Esc closes the build menu or steps back in the menu |
| Sound on / off | **Sound** in the top bar | M |
| Pathogen details | Click / tap a pathogen during a wave | I steps through them (the one nearest the organ first); Esc closes |

### Tuning

Everything is in [`src/config.ts`](src/config.ts). Shared rules first: energy per wave, node types (cost, damage, rate, reach, slow, burn-out), the IgG match multipliers (`iggMatch`), broad IgG's cost and re-aim cost, white cells, the pulse, the NO gauge (`no`: capacity, opening cost, drain, refill, top-up), what energy buys in an organ (`energyBuys`), lab tests (`labTests`: price, first organ), the local antibiotic (`antibiotic`: unlock and first organ, cost, doses a wave, boss factor, the Standard and Burst profiles, and Stewardship's organ, wave and kills), the difficulties (`difficulty`), endless (`endless`), pathogens (health, speed, Gram stain / shape / species for bacteria, organ damage, contact damage, infection, `jumps`, `lodges`). Then `LEVELS`, one entry per organ: health, starting energy, white cell count, its `feature` and `handicap`, any `damageMul`, its twist (`surge`, `regenPerWave`, `filtration`, `respawn`), its map (organ centre and size, vessel paths with any `fork` and its two branches, where along each route the build sites go, and `gaugeDrop` where the NO gauge would cover a vessel name) and its waves. [`src/level.ts`](src/level.ts) turns the loaded organ's vessels into routes (a forked vessel becomes two routes sharing a stem), winds them (`BASE_WIND` 1.5: how many times longer than the corner points) and places the sites.

### Balance assumptions

The figures come from the scripted players in `tests/game.test.ts`. Each game has its own seeded random source (for the small drift of pathogens across a vessel), so the same game always plays out the same way and these figures repeat exactly.


- **The career player can't see the waves coming**, like a real one. It builds round the vessels, least defended first, two rounds a build, with IgG aimed in turn at the organ's bacteria (the panel names them; at most two per bacterium; broad once it has the upgrade), an IgA as every third node on a vessel, and IgM otherwise. During the wave it opens the route with the most pathogens past 65% of the way in, keeping 2 s of NO to spare, closes it when clear, and switches only for twice the threat (one route at a time). It fires the pulse only for a boss, or for a pathogen with 40+ health left that is past 85% of the way in. It never spends gold during an organ. **As a career** on Normal (organs in order, gold banked, before each organ buying first the IgG targets for its bacteria, then damage for its most-built node types, then the rest) it wins every organ at the first attempt: heart 20/20, lungs 18/20 (buying the *S. pneumoniae* target), liver 24/24 (*E. coli* and *Klebsiella*), kidney 11/20 (two levels of IgM damage, IgA and IgG damage), spleen 21/22 (*N. meningitidis*, IgM damage), bone marrow 15/24 (*M. tuberculosis*, two levels of IgA damage), stomach 24/28 (*Salmonella*, *H. pylori*, two levels of IgG damage), lymph node 22/26 (*S. pyogenes*, three levels of IgE damage), skin 14/20 (*Pseudomonas*, broad IgG, two levels of NO), eye 16/22 (*Chlamydia*, the extra starting node, the cheaper first node). From the liver on it builds on 63%, 56%, 50%, 63%, 67%, 60%, 65% and 65% of the sites beyond the free IgMs (the tests require at most 75%: a player who can't see what's coming has to cover every vessel).
  - **Re-tuned for the longer vessels**, with energies (lungs 120, liver 250 with regrowth 2, kidney 420 at 40% income, spleen 210, marrow 150 at 80%, stomach 430 at 45%, lymph node 340, skin 610, eye 240 at 35%) and gold 30% lower than before the longer vessels.
  - **Losses come gradually, not off a cliff.** Results used to jump in steps as energy changed: the stomach went from losing to flawless between 85% and 90% of its energy, the spleen from 2 to 21 health, the eye from 7 to 16. Two causes, both fixed. A boss wave's bosses each did the boss's full harm (8) though they carry 55% of its health, so a vessel too few cost 16 to 24 at once: they now do 55% of it. And big groups came all up one vessel (the stomach's *H. pylori* 11 to 18 at a time, its *Salmonella* 15 to 23, the skin's fourth wave 9 to 11), so one under-built vessel let a whole group through: they are now split into smaller groups up two or more vessels each (never the stomach's short oesophagus). A test now plays every organ at 90%, 95%, 100%, 105% and 110% of its energy: each must be won, and no 5% step may cost more than half the organ's health. The stomach now loses some (24/28 here). The marrow's middle waves bring fewer *M. tuberculosis*, the skin's middle wave is smaller, and the stomach's acid is 2 a second.
  - **Buying extras doesn't replace building.** A career that also spends energy on extras (three white cells as each organ starts, before building, and NO whenever it runs low in a wave) scores far worse than one that only builds (it starves its nodes and loses the lungs; a test checks it does no better): extras are for a tight moment, not a strategy.
- **For comparison**, the same career played by a player who *can* see each wave coming (and builds for exactly what comes up each vessel) ends: heart 20, lungs 20, liver 21, kidney 12, spleen 21, bone marrow 24, stomach 24, lymph node 22, and loses the skin (the skin is its hardest: it builds for each wave's groups, and the wounds open inside those defences; the test lets it fall there). One who opens every route with pathogens well in, as many as it has white cells: heart 20, lungs 18, liver 24, kidney 8, spleen 21, bone marrow 15, stomach 24, lymph node 22, skin 11, eye 13.
- **A population of 200 players, each playing a whole career** (`tests/balance/`, run with `npm run balance`; about two minutes). Each simulated player has its own skill, from new to strong: how much of its energy it spends, how often it slips and builds a plain IgM where it meant an IgG or IgA, how far in a pathogen must be before it opens that vessel, how quickly it reacts, and whether it uses the pulse, the antibiotic and extra cells. Each plays the organs in order with upgrades between them; after a loss it tries again, and from the second loss on it first replays the organ before for a quarter of its gold and shops. After the re-tune (first try wins, then the weakest third / middle / strongest third, then average tries):

  | Organ | First try | Weak | Middle | Strong | Tries |
  |---|---|---|---|---|---|
  | Heart | 100% | 100% | 100% | 100% | 1.00 |
  | Lungs | 98% | 93% | 100% | 100% | 1.02 |
  | Liver | 98% | 96% | 97% | 99% | 1.03 |
  | Kidney | 92% | 88% | 91% | 96% | 1.09 |
  | Spleen | 94% | 88% | 99% | 95% | 1.08 |
  | Bone marrow | 97% | 98% | 97% | 95% | 1.04 |
  | Stomach | 79% | 53% | 89% | 90% | 1.49 |
  | Lymph node | 91% | 95% | 87% | 92% | 1.23 |
  | Skin | 100% | 100% | 100% | 100% | 1.00 |
  | Eye | 87% | 82% | 87% | 90% | 1.28 |

  99% of careers reach the end (95% of the weakest third), in about 12 organ plays. Before, the stomach was a wall: 39% won it first time (30% of the weakest), it took 3.1 tries on average, and 6 careers in 200 never got past it. It is now 28 health and 430 energy (was 24 and 380); its boss is still the game's first real test of upgrades (without damage upgrades no one wins it), so losing there sends players back to earn them, which the career is for. The middle organs, which almost everyone won first time, are a little tighter: the spleen starts with 210 energy (was 230), the bone marrow 150 (180), and the skin has 20 health (24). The skin stays easy, a breather before the eye: below 610 energy it falls off a cliff, which the cliff test forbids, and at 18 health the same test fails at 90% energy. The liver keeps 250 (was 260; 240 failed the cliff test).
- **Without upgrades**, the all-seeing player wins the heart and the lungs.
- **A clumsy new player wins the heart.** A scripted player who builds only IgM on the first free sites in the list, opens a vessel only once a pathogen is 80% of the way in, and never pulses, still clears the heart. The heart is gentle on purpose. (The **Place by list** order takes each vessel's outermost site first, then the next.)
- Never building loses every organ, even with every upgrade; white cells alone leak health from the heart in wave 1.
- **Holding one route open is worse than dilating with care.** With the career's upgrades at each organ, a player who opens the busiest route as soon as it can and never closes it loses the liver every time and finishes every other organ worse. Averaged over three seeds (a loss counting as 0): lungs 8 (against 19), kidney 5 (9), spleen 6 (19), bone marrow 3 (12), stomach 8 (25), lymph node 7 (22), skin 2 (15). The tests require it to average at least 2 worse on every organ but the heart, where the free IgMs win either way, and the eye, which has no white cells to send.
- **The brain was removed** (ten organs now). Every organ after the lungs moved up a place, so three things keep the game as it was: **each organ has its own random seed** (its old one), so its waves fall out exactly as before rather than being reshuffled by its new position; **an organ pays 88 gold × its number** (it was 70), which gives a career about the same gold before each organ as when the brain's pay came first; and the **skin starts with 610 energy** (was 560), since careers now reach it with different upgrades and 560 left it on a cliff at 90–95% energy. **Old saves** carry over organ by organ: cleared organs and best health stay with their organ, the brain's are dropped, and a game in progress on the brain is dropped (gold and upgrades kept); saves now record their organs' order.
- **The kidney stays hard on purpose.** The scripted player ends it on about 9 of 20 health averaged over seeds, the lowest of any organ. Easing it was tried (430 to 480 starting energy, or pathogens toughening 13% or 16% a wave instead of 20%), but every version let a player who holds one vessel open do as well as or better than one who dilates with care, which the kidney's filtration rewards. So it keeps 420 energy and 20%.
- Virus health (10) is set so IgM and IgE kill one in a single hit; a well-aimed IgG kills a 70-health bacterium in three hits, IgM needs seven.

### 3D prototype

**`play3d.html`** ([live](https://brendanjvr-ux.github.io/defend-the-heart/play3d.html)) plays one organ in 3D, on the real rules: the same `sim.ts` drives it, and only the drawing is new (`src/three/`). It keeps the game's pen-and-ink look by reusing the game's own art:

- **The paper** is the level's inked background from the 2D map, lying on a desk.
- **The organ** is its 2D drawing raised into relief: the height comes from how far each point lies inside the drawing's outline, rising on a rounded profile (about 45° at the edges, a gentle dome on top), so every organ works and keeps its ink and hatching, every edge slopes down to the paper, and narrow parts (the lungs' windpipe) become rounded ridges. It beats (the heart) or breathes, and flushes red when hit.
- **Vessels** are tubes along each route's winding course, a little flattened on the paper, with blood scrolling towards the organ. They widen when dilated and turn the pale blue of the 2D map.
- **Pathogens and white cells** are the game's own drawings standing up as paper cut-outs.
- **Lymph nodes and health beads** are small cel-shaded solids with black ink outlines, in the nodes' colours, with their letters.

Tap a + site to build (between waves), Start wave, tap a vessel to open or close it, the pulse button or Space to pulse, ×1 to change speed. Drag to turn the view, pinch or scroll to zoom. Pick another organ from the list (or `#0` to `#9` in the address; the liver by default). It is a sandbox: every IgG target is unlocked, and nothing is saved. Three.js (`three`, pinned) loads only on this page.

### Files

| File | What it is |
|---|---|
| `src/config.ts` | All tuning values, and the ten organ levels (maps, twists, waves, and each organ's own random seed). |
| `src/level.ts` | The loaded organ's routes (forks expanded into two routes sharing a stem) and the build sites beside them (`loadLevel`). Path maths in `src/geometry.ts`. |
| `src/sim.ts` | State, rules and simulation (no DOM): endless stages (`endlessWave`, `stageLevel`, `stageMap`), placement and cancelling, energy buys (NO, white cells), mid-wave dilation and the NO gauge, forks, waves, immunoglobulins (broad IgG), white cells, infection and infected cells going for nodes, jumping viruses, lodging, organ handicaps and difficulty, the pulse, recall. |
| `src/bosses.ts` | The eleven boss pathogens' drawings. Each boss's animation loops every 4π seconds, so its 64 inked frames are made once and reused; the boss is turned to face its way and hits flash over it. |
| `src/bacteria.ts` | The twelve bacteria's drawings: cell walls, nucleoid and ribosomes, capsules, pili, beating flagella; each still body is drawn and inked once per size and reused. |
| `src/organs.ts` | The lungs, liver (with the gut), kidney, spleen, bone marrow, stomach, lymph node, skin and eye as anatomy-plate drawings: lobes, fissures and the bronchial tree; gyri, cerebellum and cerebral arteries; hepatic veins and ligaments; cortex, pyramids, hilar vessels and ureter; a tilted crimson spleen with a deeply notched border and a cut face speckled with white pulp, unlike the kidney's bean; a long bone cut open, with its cortex, red marrow, spongy heads and nutrient artery; the stomach with its folds, a pool of acid, the oesophagus, pylorus and duodenum; the lymph node with its follicles, medulla, afferent lymphatics and hilum; a block of skin with its layers, hair follicle, sweat gland and a cut; the eye cut in half with its cornea, lens, retina and optic nerve. Each organ (and the heart, drawn in `src/draw.ts` with its coronary vessels) is drawn and inked once into an image and reused every frame. |
| `src/sound.ts` | Sound made on the fly with Web Audio (no sound files): a pen scratch for building (and a backwards one for a cancelled node), a spring for a jumping virus, a clank for a node knocked out, low uneasy notes for an infection lodging, coin notes for gold spent, a wet pop and splash when the gallbladder bursts, plucks for kills, a thud when the organ is hit, a chime for the pulse, a horn for a boss, a heartbeat once the organ has lost a fifth of its health, quickening as it weakens, one horn per boss wave, win and loss. **Sound** in the top bar or M mutes it (remembered). `src/soundEvents.ts` decides which to play for what happened each frame. |
| `src/ink.ts` | The pen-and-ink look: cream paper with faint tissue drawn behind the map, and `inkify`, which turns a colour drawing into ink on paper (colour thinned to a faint wash; shadows hatched, cross-hatched and stippled by how dark they are; edges drawn in as pen lines). It runs once per organ image and per sprite, and the results are kept, never redone every frame. |
| `src/labels.ts` | Where the vessel names go: each name is placed clear of the build sites, the organ (its whole strip, not just its middle), the corners and the other names, and a fork's branch names sit on their outer sides. Which key opens each route (`ROUTE_KEYS`). |
| `src/draw.ts` | Rendering: vessels with dilation, flow, breathing surges and filtration, the heart, organ health beads, lodged tubercles and cancer, sites and nodes, antibodies (IgM pentamer, IgG Y, IgA dimer), pathogens (the jumping virus among them), effects. |
| `src/career.ts` | The career and its save (no DOM): the difficulty, the endless leaderboard (best ten runs per difficulty), gold, the upgrade shop and what upgrades do in play, organs cleared, best health, the game in progress, a versioned `localStorage` entry with old-save migration; an unreadable save is kept aside, never lost. |
| `src/tutorial.ts` | The heart's guided first wave (no DOM): its steps, when each is done, when time holds, what the callout says and points at. |
| `src/style.css` | The panel, top bar, menus and popovers in the ink style: paper plates, ink rules, washes and hatching (CSS variables at the top). |
| `src/inspect.ts` | The pathogen under a click, and its details card. |
| `src/notices.ts` | The message strip beside the map: the boss bar, the wave's hint, short notes (and the simulation's `notices`). |
| `src/settings.ts` | Text size and reduced motion: kept in this browser, put into effect on the page and the map, and the Settings page. |
| `src/howto.ts` | The menu's How to play page. |
| `src/icons.ts` | Pathogen, white cell and lymph node pictures for the page, drawn once in the map's style. |
| `src/orientation.ts` | The full-screen, landscape button for phones that allow it. |
| `public/` | The web app's manifest, icons (`icon.svg`, PNGs, the Apple touch icon) and `sw.js`, the service worker that lets it play offline. |
| `src/three/scene3d.ts`, `src/three/main3d.ts`, `play3d.html` | The 3D prototype: the scene built from the game state (paper, organ relief, vessel tubes, cut-outs, nodes), and its page (taps, build menu, controls). |
| `src/progress.ts`, `src/mastery.ts`, `src/guide.ts`, `src/rewards.ts` | Permanent progress (its store, migration and backup), the organ seals and Stewardship (each seal's words and its check together), the Field Guide's entries, and the Atlas, Guide and mastery pages. |
| `src/attack.ts`, `src/attackUi.ts`, `src/defender.ts` | Attack mode (no DOM in `attack.ts`): prices, the budget and its rules, the plan turned into a wave, the defender's build and moves, the outcome; its organ picker, planner, panel and result screen; the scripted defender (`blindBuild`, `sensibleDilate`, `pulseAtCluster`), shared with the tests. |
| `src/main.ts` | HUD, panel, the menu, the tutorial's callout, autosave, build popover and IgG target picker, mouse / touch / keyboard input, overlays. |
| `tests/tutorial.test.ts` | The tutorial played through on the real simulation: every step in order, the holds, skipping the pulse if the wave ends, the saved seen flag. |
| `tests/career.test.ts` | The save (fresh, round-trip, migration, unreadable and newer saves, no storage, Continue, winning and losing), gold, the shop and upgrade effects. |
| `tests/players.ts` | The scripted players the balance tests use (the career player who can't see the waves, the one who can, the clumsy one, the one who holds a route open, the one who opens several) and the helpers that drive a game in a test. |
| `tests/balance/` | The balance lab: a population of simulated players of different skill playing whole careers with retries and replays (`population.ts`), the simulated attackers for Attack mode (`attackers.ts`, `attackReport.ts`), split over eight test files that run only with `BALANCE_LAB=1`, a report (`report.ts`) and a sweep of one organ's energy and health (`sweep.ts`). |
| `tests/attack.test.ts` | Attack mode: prices from stats, the budget and plan rules, the limit per vessel, virus swarms, the best-of-three match and the defender learning vessels and kinds, its slow switch, the 50/50 balance check, the defender building blind with all its energy, a weak attack held off on every organ, a timed mixed one winning on the heart. |
| `tests/game.test.ts` | Tests for every rule (NO and dilation, forks, cells, pulse, placement, the four lymph nodes and the IgG match, IgE burn-out, infection), each organ's map and twist, each boss's trick, map labels that never cover a site or each other, plus balance on every organ (including the hold-open check). |
