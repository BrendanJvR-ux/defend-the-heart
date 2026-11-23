# Level 6 (the spleen) and more detailed organs and pathogens — design

Date: 2026-11-24 · Status: draft for approval

## Intent

More game (a sixth organ, the spleen) and a richer look where the player's eye rests most: the organs and the pathogens up close. Shipped in two parts: the spleen first, then the art pass (which then covers the spleen and its boss too).

## Part 1 — The spleen (level 6)

- **Twist — it remakes white cells.** A white cell that is killed or infected comes back at the spleen 8 s later, ready to go out again; each one remade costs 1 spleen health (this can lose the organ). Config: `respawn: { after: 8, cost: 1 }` on the level.
- **Organ:** health 22, two white cells, two starting nodes, energy tuned by the balance tests.
- **Bacteria:** the encapsulated ones a spleen clears — *S. pneumoniae*, *N. meningitidis*, *Klebsiella* — plus *S. aureus* (in every organ). No new IgG targets. Viruses and hijackers as elsewhere.
- **Boss — *Plasmodium* (malaria).** A new kind of pathogen, a parasite: not a bacterium, so IgG hits it at ×0.25. Trick: every 6 s it hides inside a red blood cell for 2 s, and while hidden nothing can target or hit it (nodes, white cells and the pulse skip it). Health and speed tuned so it falls to steady IgM/IgE damage and a well-timed pulse.
- **Map:** 9 routes — six vessels entering from the edges, three of them forking — around a crescent-shaped spleen; about five build sites per route; labels laid out by the existing label layout.
- **Waves:** four plus the boss, using the species above.
- **Career and balance:** clearing it pays 600 + 5 per health left. The contract extends to six organs: the scripted career wins every organ at its first attempt; never building loses every organ even with every upgrade; holding one vessel open loses or ends ≥ 2 worse. The README figures are updated. Older five-organ saves load (the cleared/best lists grow).

## Part 2 — Richer organs and pathogens (approach A: drawn in code)

**Approaches:** A, richer canvas drawings in the existing style (chosen); B, painted image files (more detail, but blur when scaled, clash with the drawn vessels, and need new art per pathogen); C, SVG shapes (a second drawing system for no gain over A).

- **Organs** — more anatomy, shading and texture, in the paper-and-ink style:
  - heart: atria and ventricles, coronary arteries and veins branching over the surface, the great vessels with their walls, a fatty sheen;
  - lungs: lobes and fissures, the bronchial tree branching inside, alveolar stipple, the trachea's cartilage rings;
  - brain: denser gyri and sulci with shading, the cerebellum's folia, the brainstem;
  - liver: right and left lobes, the falciform ligament, the gallbladder, a lobular texture;
  - kidney: cortex, medullary pyramids, the renal pelvis and ureter, the adrenal gland;
  - spleen: crescent with notched upper border, hilum with splenic vessels, capsule sheen, red-pulp texture.
  - The still parts of each organ are drawn once into an offscreen image (per organ and size) and reused; only the living parts (beat, breath, damage flash) are drawn each frame, so frame time does not grow.
- **Pathogens** — more inner detail and a little life:
  - bacteria: cell-wall rim, nucleoid and ribosome speckle, capsules with texture (pneumococcus, Klebsiella, meningococcus), pili, flagella that beat;
  - viruses: faceted capsid with spike proteins; hijackers: a distinct spiked envelope; infected cells: nucleus with viruses visible inside;
  - bosses enriched to match; *Plasmodium*: a red blood cell with the parasite's ring form (and a dimmed, outlined look while hidden).
- **Non-goals:** vessels, lymph nodes, effects and the panel stay as they are.
- **Checks:** a screenshot of each organ and a sheet of every pathogen at 3× and at play size; frame time measured before and after (no slower).

## Left to the builder

Exact coordinates and drawing code, wave details, boss numbers and organ energy within the contract, and the spleen's map within the readability tests (labels, sites, routes keep apart).
