# A basic tutorial on the heart — design (short)

Date: 2026-11-24 · Status: approved ("go ahead as described")

**Why:** a first-time player meets lymph nodes, mid-wave dilation, NO and the pulse at once; the wave hints are text in the side panel and nothing points at the map or waits for the player.

**What:** a guided first wave on the heart. Seven steps, each waiting for the player:

1. Welcome — "Pathogens travel up the vessels to the heart. Stop them." [Next]
2. Build — a callout points at a free + beside the left vessel; done when any node is placed.
3. Start — points at **Start wave**; done when the wave starts.
4. Open a vessel — when the first pathogen is a third of the way in (my call: the starting nodes kill wave 1's bacteria before halfway), the game **holds** (time stops, controls work): "Click the left vessel to send your white cells out." Done when a vessel opens.
5. NO — points at the NO bar: "Holding a vessel open uses NO. Close it when it's clear." [Got it]
6. Pulse — when a pathogen is in pulse range of a white cell (my call: wave 1's bacteria come singly, so "two or more" rarely happened), the game holds: "Press Immune pulse." Done when fired. If the wave ends first, this step is skipped.
7. Done — "Clear the wave. Between waves, build more; wave 3 shows you IgG." [Close]

**When:** the heart's wave 1 in a career that hasn't seen the tutorial; **Skip tutorial** is always visible; finishing or skipping marks it seen (saved in the career). A **Tutorial** button in the menu replays it on a fresh heart (asking first if a game is in progress).

**Approaches:** a guided first wave (chosen) over a text pop-up (forgotten at once) or a separate practice map (more to build and keep in step).

**How:** the steps, their completion rules and when the game holds live in a new DOM-free `src/tutorial.ts`, tested against the real simulation; the callout, the map ring and panel highlights are drawn by `main.ts` / `draw.ts`. `Career` gains `tutorialSeen` (older saves load as not seen only if they have no cleared organs).
