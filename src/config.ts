// ─────────────────────────────────────────────────────────────────────────────
//  DEFEND THE HEART · tuning. Every number that shapes play lives here,
//  shared rules first, then one entry per organ level.
// ─────────────────────────────────────────────────────────────────────────────

/** Vessel ids are per level ('left', 'portal', 'lowerLeft' …). */
export type VesselId = string;
/** The named bacteria. */
export type BacteriumType = 'saureus' | 'spneumo' | 'listeria' | 'nmening' | 'ecoli' | 'kpneumo' | 'mtb' | 'hpylori' | 'salmonella' | 'spyogenes' | 'paeruginosa' | 'chlamydia';
export const BACTERIA: BacteriumType[] = ['saureus', 'spneumo', 'listeria', 'nmening', 'ecoli', 'kpneumo', 'mtb', 'hpylori', 'salmonella', 'spyogenes', 'paeruginosa', 'chlamydia'];
export type PathogenType = BacteriumType | 'virus' | 'hijacker' | 'jumper' | 'infected' | BossType;
/** What an IgG antibody recognises: Gram stain, shape and species. */
export interface Taxon { gram: '+' | '-'; shape: 'coccus' | 'rod'; species: BacteriumType }
/** One boss per organ, met in that organ's last wave. */
export type BossType = 'colony' | 'flu' | 'meningo' | 'hepatitis' | 'sepsis' | 'plasmodium' | 'granuloma' | 'burrower' | 'hiv' | 'necrotizer' | 'herpes';
export type NodeType = 'igm' | 'igg' | 'iga' | 'ige';

export interface PathogenStats {
  name: string;
  plural: string;
  hp: number;
  /** Map units per second, carried with the blood flow towards the heart. */
  speed: number;
  /** Bacteria (and bacterial bosses): what an IgG antibody can match. Absent for viruses and infected cells. */
  taxon?: Taxon;
  /** Short line for the panel, e.g. "Gram+ coccus". */
  short?: string;
  /** Heart health lost when it reaches the heart. */
  heartDamage: number;
  /** Damage per second dealt to a white cell in contact. */
  contactDps: number;
  /** Energy earned for destroying it. */
  bounty: number;
  /** Hijacker viruses enter a white cell they touch and turn it into an infected cell. */
  infects?: boolean;
  // ── Boss traits ──
  boss?: boolean;
  /** One line for the panel. */
  blurb?: string;
  /** On death, breaks into this many of that pathogen. */
  splitInto?: { type: PathogenType; count: number; hpFactor?: number };
  /** Releases one of these every `every` seconds as it travels. */
  sheds?: { type: PathogenType; every: number };
  /** Health regained per second. */
  regen?: number;
  /** IgA cannot slow it. */
  slowImmune?: boolean;
  /** Infects every white cell it touches and keeps going. */
  infectsMany?: boolean;
  /** Hides inside a red blood cell for `for` seconds in every `every`: nothing can target or hit it then. */
  hides?: { every: number; for: number };
  /** Walled in: takes only `factor` of any damage until antibodies (or the pulse) have struck it `hits` times. */
  walled?: { hits: number; factor: number };
  /** Burrows into the lining for `for` seconds in every `every`: nothing can target or hit it then, and it
   *  tunnels on at ×`speed`. */
  burrows?: { every: number; for: number; speed: number };
  /** Stomach acid does not harm it: it feeds on it, regaining that much health instead. */
  acidProof?: boolean;
  /** White cells can't touch it (nor it them): they neither fight it nor strike it with the pulse. */
  ignoresCells?: boolean;
  /** Every lymph node guarding its route is switched off, for the rest of the wave, as it passes. */
  switchesOffNodes?: boolean;
  /** Frenzy: every antibody strike makes it this much faster (a share of its speed), up to `max` times its speed. */
  frenzy?: { per: number; max: number };
  /** Goes dormant the first `times` times its health falls to half: out of reach for `for` seconds, regaining `heal`
   *  of its full health. */
  dormant?: { times: number; for: number; heal: number };
  /** Jumps once to another vessel (one not of its own fork) when it is `at` of the way along its route, landing as far
   *  along the new one. */
  jumps?: { at: number };
  /** Lodges in the organ when it reaches it: from then on, every wave's end costs `perWave` organ health for each one
   *  lodged, until the organ ends. `only`: just on that organ; `cancer`: drawn as a small cancer on the organ. */
  lodges?: { perWave: number; only?: OrganKind; cancer?: boolean };
}

/** The four difficulty modes, chosen for a career: pathogen health, how many come, energy and gold, as multipliers. */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'brutal'];

export interface NodeStats {
  name: string;
  short: string;
  cost: number;
  /** Damage per antibody (IgG: before its match multiplier). */
  damage: number;
  cooldown: number;
  range: number;
  shotSpeed: number;
  /** IgA: target speed multiplied by this for a while. */
  slow?: number;
  slowSeconds?: number;
  /** IgE: the node bursts after this many cleared waves, freeing its site. */
  burnsOutAfter?: number;
  blurb: string;
}

export interface WaveGroup { type: PathogenType; vessel: VesselId; count: number; start: number; interval: number }
export interface WaveDef { title: string; hint: string; groups: WaveGroup[] }

export const CONFIG = {
  /** Energy for a cleared wave (energy pays for lymph nodes). */
  waveClearEnergy: (wave: number) => 30 + 8 * wave,

  vesselRestWidth: 30,
  vesselDilatedWidth: 64,
  dilateRate: 1.8,

  nodes: {
    igm: { name: 'IgM lymph node', short: 'IgM', cost: 60, damage: 10, cooldown: 0.9, range: 175, shotSpeed: 520, blurb: 'Hits every pathogen the same.' },
    igg: { name: 'IgG lymph node', short: 'IgG', cost: 50, damage: 10, cooldown: 0.8, range: 175, shotSpeed: 560,
      blurb: 'Aimed at one bacterium: ×3 on it, ×2.5 on the same shape, ×2 on the same Gram stain, ×0.5 on other bacteria, ×0.25 on viruses.' },
    iga: { name: 'IgA lymph node', short: 'IgA', cost: 40, damage: 7.5, cooldown: 0.7, range: 175, shotSpeed: 560, slow: 0.4, slowSeconds: 2.2, blurb: 'Softer hits, but slows what it hits.' },
    ige: { name: 'IgE lymph node', short: 'IgE', cost: 80, damage: 20, cooldown: 0.9, range: 230, shotSpeed: 440, burnsOutAfter: 3,
      blurb: 'Double damage and a long reach, but it burns out after three waves.' },
  } as Record<NodeType, NodeStats>,

  whiteCell: {
    hp: 90,
    speed: 62,
    recallSpeed: 210,
    attackRange: 26,
    /** Damage a second to every pathogen it touches. */
    dps: 7,
    guardAt: 0.62,
    /** Cells never go further out than this fraction of the vessel (they fight under node cover). */
    minReach: 0.4,
  },

  /** The immune pulse: every white cell out on a vessel and touching a pathogen destroys it (a boss loses
   *  `bossShare` of its full health instead) and dies doing it. Once per wave. */
  immunePulse: { perWave: 1, bossShare: 1 / 4, ringSeconds: 0.45 },

  /** Nitric oxide: the fuel that holds a vessel open during a wave. */
  /** IgG damage multipliers: the single best match applies. */
  iggMatch: { species: 3, shape: 2.5, gram: 2, unrelated: 0.5, nonBacterium: 0.25 },
  /** Energy to re-aim a placed IgG node between waves. */
  iggRetarget: 20,
  /** Endless (once the eye is cleared): organ after organ, from the heart round again, each a stage. Every stage
   *  cleared, the vessels wind `windGrowth` longer (up to `maxWind` times their corner points), every `sitesEvery`
   *  stages each vessel gets another build site, pathogens have `hpGrowth` more health and come `countGrowth` more
   *  in every group, and bosses turn up at random: `bosses` of them in the first stage, one more every `bossEvery`.
   *  A stage cleared pays `goldPerStage`; each difficulty keeps your best `boardSize` runs. */
  endless: { windGrowth: 0.08, maxWind: 1.9, sitesEvery: 2, hpGrowth: 0.1, countGrowth: 0.06, bosses: 1, bossEvery: 2, goldPerStage: 20, boardSize: 10 },
  /** The last wave sends its boss up every vessel, a few seconds apart; each has this share of the boss's health. */
  bossEveryVessel: { gap: 3, hpShare: 0.55 },
  /** Difficulty modes: pathogen health, group sizes, starting energy and income, and gold earned. Normal is the game
   *  as tuned. */
  difficulty: {
    easy: { name: 'Easy', blurb: 'Weaker pathogens, fewer of them, more energy.', hp: 0.8, count: 0.85, energy: 1.15, gold: 1.15 },
    normal: { name: 'Normal', blurb: 'The game as designed.', hp: 1, count: 1, energy: 1, gold: 1 },
    hard: { name: 'Hard', blurb: 'Tougher pathogens, more of them, less gold.', hp: 1.2, count: 1.1, energy: 0.95, gold: 0.85 },
    brutal: { name: 'Brutal', blurb: 'Much tougher, many more, and little to spare.', hp: 1.4, count: 1.2, energy: 0.9, gold: 0.7 },
  } as Record<Difficulty, { name: string; blurb: string; hp: number; count: number; energy: number; gold: number }>,
  /** Bought with gold during an organ: `no` adds NO at once (it may go past the gauge's top); `cell` adds a white cell
   *  for the rest of the organ, at most `max`. */
  goldBuys: { no: { gold: 20, amount: 40 }, cell: { gold: 50, max: 3 } },
  /** At most this many IgG nodes may be aimed at any one bacterium on an organ . */
  iggPerTarget: 2,
  /** Gold to borrow an IgG target for the rest of one organ (gone when it ends; a permanent target costs 120). */
  borrowTargetGold: 30,
  /** Energy for a broad IgG node (career upgrade): it hits every bacterium of its target's Gram stain as if it
   *  matched the shape (×2.5). */
  broadIggCost: 60,

  /** NO: capacity, opening cost, drain a second while a vessel is open, refill a second while all are closed, the top-up
   *  after a cleared wave. Every vessel opened beyond the first costs and drains less (`extraOpenCost`, `extraDrainPerSec`). */
  no: { max: 100, openCost: 15, drainPerSec: 8, regenPerSec: 3, waveTopUp: 35, minOpenSeconds: 1, extraOpenCost: 8, extraDrainPerSec: 3 },

  pathogens: {
    saureus: { name: 'Staphylococcus aureus', plural: 'S. aureus', short: 'Gram+ coccus, in clusters', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'coccus', species: 'saureus' } },
    spneumo: { name: 'Streptococcus pneumoniae', plural: 'S. pneumoniae', short: 'Gram+ coccus, in pairs', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'coccus', species: 'spneumo' } },
    listeria: { name: 'Listeria monocytogenes', plural: 'Listeria', short: 'Gram+ rod', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'rod', species: 'listeria' } },
    nmening: { name: 'Neisseria meningitidis', plural: 'N. meningitidis', short: 'Gram− coccus, in pairs', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'coccus', species: 'nmening' } },
    ecoli: { name: 'Escherichia coli', plural: 'E. coli', short: 'Gram− rod', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'rod', species: 'ecoli' } },
    kpneumo: { name: 'Klebsiella pneumoniae', plural: 'Klebsiella', short: 'Gram− rod, capsulated', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'rod', species: 'kpneumo' } },
    virus: { name: 'Virus', plural: 'Viruses', hp: 10, speed: 74, heartDamage: 1, contactDps: 2, bounty: 2 },
    jumper: { name: 'Jumping virus', plural: 'Jumping viruses', hp: 14, speed: 64, heartDamage: 1, contactDps: 2, bounty: 3, jumps: { at: 0.35 } },
    hijacker: { name: 'Hijacker virus', plural: 'Hijacker viruses', hp: 16, speed: 58, heartDamage: 1, contactDps: 0, bounty: 4, infects: true },
    infected: { name: 'Infected white cell', plural: 'Infected white cells', hp: 55, speed: 46, heartDamage: 3, contactDps: 4, bounty: 6 },
    colony: { name: 'Staph colony', plural: 'Staph colonies', hp: 380, speed: 15, heartDamage: 6, contactDps: 3, bounty: 60, boss: true, taxon: { gram: '+', shape: 'coccus', species: 'saureus' },
      splitInto: { type: 'saureus', count: 3, hpFactor: 0.5 }, blurb: 'A grape-bunch of S. aureus. Burst it and three weakened staph spill out. IgG aimed at S. aureus hits it three times as hard.' },
    flu: { name: 'Mother virus', plural: 'Mother viruses', hp: 420, speed: 20, heartDamage: 6, contactDps: 6, bounty: 60, boss: true,
      sheds: { type: 'virus', every: 2.4 }, blurb: 'Releases a new virus every few seconds as it travels. Kill it fast: IgM and IgE do it best.' },
    meningo: { name: 'Meningococcus', plural: 'Meningococci', hp: 400, speed: 20, heartDamage: 7, contactDps: 9, bounty: 60, boss: true, taxon: { gram: '-', shape: 'coccus', species: 'nmening' },
      slowImmune: true, blurb: 'A giant N. meningitidis. IgA cannot slow it; IgG aimed at N. meningitidis hits it three times as hard.' },
    hepatitis: { name: 'Hepatitis giant', plural: 'Hepatitis giants', hp: 520, speed: 17, heartDamage: 6, contactDps: 6, bounty: 60, boss: true,
      regen: 9, blurb: 'Heals itself as it travels. Damage must outpace its regrowth: IgM and IgE, not IgG.' },
    sepsis: { name: 'Sepsis hijacker', plural: 'Sepsis hijackers', hp: 340, speed: 19, heartDamage: 8, contactDps: 0, bounty: 60, boss: true,
      infects: true, infectsMany: true, blurb: 'A giant hijacker: it infects every white cell it touches and keeps going.' },
    mtb: { name: 'Mycobacterium tuberculosis', plural: 'M. tuberculosis', short: 'Acid-fast rod, slow and tough', hp: 120, speed: 24, heartDamage: 3, contactDps: 4, bounty: 10, taxon: { gram: '+', shape: 'rod', species: 'mtb' },
      lodges: { perWave: 2 } },
    granuloma: { name: 'Tuberculous granuloma', plural: 'Granulomas', hp: 500, speed: 14, heartDamage: 8, contactDps: 4, bounty: 60, boss: true, taxon: { gram: '+', shape: 'rod', species: 'mtb' },
      walled: { hits: 40, factor: 0.25 }, blurb: 'M. tuberculosis walled in by the body\'s own cells. Every antibody strike chips the wall; until it breaks, everything does a quarter damage. A pulse breaks it at once.' },
    hpylori: { name: 'Helicobacter pylori', plural: 'H. pylori', short: 'Gram− curved rod, acid-proof', hp: 90, speed: 28, heartDamage: 3, contactDps: 3, bounty: 8, acidProof: true, taxon: { gram: '-', shape: 'rod', species: 'hpylori' },
      lodges: { perWave: 1, only: 'stomach', cancer: true } },
    salmonella: { name: 'Salmonella enterica', plural: 'Salmonella', short: 'Gram− rod, fast, in groups', hp: 55, speed: 46, heartDamage: 2, contactDps: 3, bounty: 6, taxon: { gram: '-', shape: 'rod', species: 'salmonella' } },
    burrower: { name: 'H. pylori swarm', plural: 'H. pylori swarms', hp: 620, speed: 15, heartDamage: 8, contactDps: 5, bounty: 60, boss: true, acidProof: true, taxon: { gram: '-', shape: 'rod', species: 'hpylori' },
      burrows: { every: 5, for: 1.6, speed: 3 }, blurb: 'A swarm of H. pylori, untouched by acid. Every few seconds it burrows into the stomach lining, where nothing can touch it, and tunnels on three times as fast.' },
    spyogenes: { name: 'Streptococcus pyogenes', plural: 'S. pyogenes', short: 'Gram+ coccus, in long chains', hp: 75, speed: 32, heartDamage: 3, contactDps: 4, bounty: 8, taxon: { gram: '+', shape: 'coccus', species: 'spyogenes' } },
    paeruginosa: { name: 'Pseudomonas aeruginosa', plural: 'Pseudomonas', short: 'Gram− rod, one whip-like flagellum', hp: 80, speed: 32, heartDamage: 3, contactDps: 4, bounty: 8, taxon: { gram: '-', shape: 'rod', species: 'paeruginosa' } },
    chlamydia: { name: 'Chlamydia trachomatis', plural: 'Chlamydia', short: 'Gram− coccoid, lives inside cells', hp: 65, speed: 34, heartDamage: 3, contactDps: 3, bounty: 8, taxon: { gram: '-', shape: 'coccus', species: 'chlamydia' } },
    necrotizer: { name: 'Flesh-eating strep', plural: 'Flesh-eating strep', hp: 520, speed: 13, heartDamage: 8, contactDps: 6, bounty: 60, boss: true, taxon: { gram: '+', shape: 'coccus', species: 'spyogenes' },
      frenzy: { per: 0.02, max: 2.2 }, blurb: 'Necrotising fasciitis: S. pyogenes tearing through tissue. Every antibody strike makes it faster, up to more than twice its speed: slow it with IgA, or kill it fast with IgE.' },
    herpes: { name: 'Herpes virus', plural: 'Herpes viruses', hp: 480, speed: 15, heartDamage: 8, contactDps: 5, bounty: 60, boss: true,
      dormant: { times: 2, for: 3, heal: 0.25 }, blurb: 'Herpes simplex, which hides in nerves. Twice, when its health falls to half, it goes dormant for 3 s, out of reach, and comes back with a quarter of its health restored. IgM and IgE.' },
    hiv: { name: 'HIV', plural: 'HIV', hp: 460, speed: 18, heartDamage: 8, contactDps: 0, bounty: 60, boss: true, ignoresCells: true, switchesOffNodes: true,
      blurb: 'The virus that attacks the immune system itself. White cells can\'t touch it, and every lymph node it passes is switched off for the rest of the wave. Kill it before it gets far: IgM and IgE.' },
    plasmodium: { name: 'Plasmodium', plural: 'Plasmodia', hp: 560, speed: 16, heartDamage: 8, contactDps: 5, bounty: 60, boss: true,
      hides: { every: 6, for: 2 }, blurb: 'The malaria parasite. Every few seconds it hides inside a red blood cell, where nothing can touch it. Not a bacterium: IgM and IgE, not IgG.' },
  } as Record<PathogenType, PathogenStats>,
};

// ── Levels ──────────────────────────────────────────────────────────────────

export type OrganKind = 'heart' | 'lungs' | 'brain' | 'liver' | 'kidney' | 'spleen' | 'marrow' | 'stomach' | 'lymphnode' | 'skin' | 'eye';
type P = { x: number; y: number };

export interface BranchDef { id: VesselId; name: string; label: string; pts: P[] }
export interface VesselDef { id: VesselId; name: string; label: string; pts: P[]; fork?: { branches: [BranchDef, BranchDef] } }

/** An organ's slight disadvantage: `text` says it; the rest change the rules (multipliers default to 1, additions to 0). */
export interface Handicap {
  text: string;
  /** Pathogen speed ×. */ speed?: number;
  /** Pathogen health ×. */ hp?: number;
  /** NO refill ×, and NO drain ×. */ noRegen?: number; noDrain?: number;
  /** Lymph node reach ×, and time between shots ×. */ range?: number; cooldown?: number;
  /** Energy added to every node's cost. */ nodeCost?: number;
  /** Energy income ×. */ income?: number;
  /** White cell speed ×, and health ×. */ cellSpeed?: number; cellHp?: number;
  /** Waves added to an IgE node's life (negative: it burns out sooner). */ igeLife?: number;
}

export interface LevelDef {
  id: OrganKind;
  /** Shown in the level list: "Level 2 · The Lungs". */
  title: string;
  /** "Heart", "Lung", "Brain"… used for "Heart health", "−3 brain health". */
  organ: string;
  tagline: string;
  /** The one rule that makes this organ different, in a sentence for the panel. */
  twist: string;
  /** Its unique feature in a few words, for the label at the organ's start. */
  feature: string;
  /** A slight disadvantage of this organ's own, shown with its feature. Multipliers (1 = none) and additions. */
  handicap: Handicap;
  /** Pathogens that hit this organ harder: heart damage and contact damage ×. */
  damageMul?: Partial<Record<PathogenType, number>>;
  hp: number;
  startEnergy: number;
  cells: number;
  /** Nodes placed before the first wave besides the free IgM every vessel gets (none of the organs use this now). */
  startingNodes?: { vessel: VesselId; site: number; type: NodeType }[];
  /** Lungs: every `every` seconds the blood surges for `length` seconds, pathogens move ×`factor`. */
  surge?: { every: number; length: number; factor: number };
  /** Liver: organ health regained after every cleared wave. */
  regenPerWave?: number;
  /** Kidney: on the last `fraction` of every vessel, pathogens are filtered to ×`factor` speed. */
  filtration?: { fraction: number; factor: number };
  /** Energy income multiplier for this organ (kill bounties and the wave-clear bonus); later organs pay less. */
  income?: number;
  /** Spleen: a lost white cell is remade `after` seconds later, costing `cost` organ health. */
  respawn?: { after: number; cost: number };
  /** Bone marrow: each cleared wave adds `perWave` white cells, up to `max`. */
  cellGrowth?: { perWave: number; max: number };
  /** Stomach: on the last `fraction` of every vessel, acid costs pathogens `dps` health a second (not the acid-proof). */
  acid?: { fraction: number; dps: number };
  /** Liver: when its health first falls to `at` (a share of full health) or below, the gallbladder bursts and
   *  bile destroys `nodes` lymph nodes at random. */
  gallbladder?: { at: number; nodes: number };
  /** Lymph node: every pathogen that reaches the organ weakens the lymph nodes guarding its route by `per` (a share of
   *  their damage), down to `min`, until the wave ends. */
  weakens?: { per: number; min: number };
  /** Skin: pathogens enter through wounds, partway along their vessels: each group starts between `from` and `to`
   *  (shares of the route's length). */
  wounds?: { from: number; to: number };
  /** Kidney: pathogens grow tougher every wave: health ×(1 + `waveHpGrowth` × waves before this one). */
  waveHpGrowth?: number;
  map: {
    center: P;
    /** Rough organ size, for drawing and keeping build sites off the organ. */
    rx: number; ry: number;
    /** Where on each vessel (fractions of its length) lymph nodes may stand. */
    siteFractions: number[];
    /** How far below the organ's centre the NO gauge sits in combat (default ry + 80; negative is above), where a vessel label would be under it. */
    gaugeDrop?: number;
    /** Blood flows from the first point (off the map edge) to the last (the organ). A vessel with a `fork`
     *  ends its points at the fork, and each branch's points carry on from there to the organ. */
    vessels: VesselDef[];
  };
  waves: WaveDef[];
}

const g = (type: PathogenType, vessel: VesselId, count: number, start: number, interval: number): WaveGroup => ({ type, vessel, count, start, interval });

export const LEVELS: LevelDef[] = [
  {
    id: 'heart', title: 'The Heart', organ: 'Heart', tagline: 'Four vessels, one beating target.',
    twist: 'The first organ: learn lymph nodes, dilating with NO during the wave, and the pulse.',
    feature: 'Four vessels, one beating target',
    handicap: { text: 'Racing pulse: pathogens move 5% faster.', speed: 1.05 },
    hp: 20, startEnergy: 100, cells: 2,
    map: {
      center: { x: 800, y: 480 }, rx: 100, ry: 100, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 500 }, { x: 170, y: 500 }, { x: 330, y: 420 }, { x: 520, y: 450 }, { x: 682, y: 485 }] },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 600 }, { x: 1420, y: 600 }, { x: 1260, y: 520 }, { x: 1080, y: 520 }, { x: 918, y: 500 }] },
        { id: 'lower', name: 'Lower vessel', label: 'Lower', pts: [{ x: 200, y: 1040 }, { x: 260, y: 880 }, { x: 440, y: 800 }, { x: 600, y: 760 }, { x: 735, y: 615 }] },
        { id: 'upper', name: 'Upper vessel', label: 'Upper', pts: [{ x: 1420, y: -40 }, { x: 1370, y: 120 }, { x: 1190, y: 190 }, { x: 1010, y: 250 }, { x: 880, y: 372 }] },
      ],
    },
    waves: [
      {
        title: 'First infection',
        hint: 'Staph comes up the left vessel. Step 1: click a + beside it and place an IgM. Step 2: start the wave. Step 3: when the bacteria are on their way in, click the left vessel to open it: your white cells go out to meet them. Opening and holding it open costs NO.',
        groups: [{ type: 'saureus', vessel: 'left', count: 7, start: 1, interval: 3.4 }],
      },
      {
        title: 'Two fronts',
        hint: 'Fast viruses on the right, staph from below. Put an IgA (it slows) by the right vessel, and open the lower vessel for your white cells when the staph gets close.',
        groups: [
          { type: 'virus', vessel: 'right', count: 9, start: 4, interval: 0.35 },
          { type: 'saureus', vessel: 'lower', count: 4, start: 1, interval: 4 },
          { type: 'virus', vessel: 'right', count: 7, start: 16, interval: 0.35 },
        ],
      },
      {
        title: 'Staph clusters',
        hint: 'More staph. Place an IgG and aim it at S. aureus: it hits staph three times as hard as an IgM.',
        groups: [
          { type: 'saureus', vessel: 'upper', count: 7, start: 1, interval: 3.4 },
          { type: 'saureus', vessel: 'left', count: 5, start: 8, interval: 3.5 },
          { type: 'virus', vessel: 'lower', count: 9, start: 12, interval: 0.4 },
        ],
      },
      {
        title: 'Swarm',
        hint: 'Fast viruses on every side. IgA slows them long enough for the rest to land.',
        groups: [
          { type: 'virus', vessel: 'upper', count: 11, start: 2, interval: 0.35 },
          { type: 'virus', vessel: 'right', count: 13, start: 8, interval: 0.3 },
          { type: 'saureus', vessel: 'lower', count: 7, start: 4, interval: 3 },
          { type: 'virus', vessel: 'left', count: 11, start: 16, interval: 0.3 },
          { type: 'virus', vessel: 'upper', count: 9, start: 22, interval: 0.35 },
        ],
      },
      {
        title: 'Hijackers',
        hint: 'Some viruses can enter a white cell and turn it against the heart. Kill them before they touch your cells, or keep the cells away from them.',
        groups: [
          { type: 'hijacker', vessel: 'left', count: 7, start: 3, interval: 1 },
          { type: 'hijacker', vessel: 'lower', count: 7, start: 10, interval: 1 },
          { type: 'hijacker', vessel: 'right', count: 5, start: 18, interval: 1 },
          { type: 'saureus', vessel: 'right', count: 9, start: 1, interval: 2.6 },
          { type: 'virus', vessel: 'upper', count: 14, start: 6, interval: 0.3 },
          { type: 'saureus', vessel: 'lower', count: 5, start: 4, interval: 3 },
          { type: 'saureus', vessel: 'left', count: 5, start: 14, interval: 3 },
          { type: 'hijacker', vessel: 'upper', count: 5, start: 20, interval: 1.2 },
        ],
      },
      {
        title: 'Boss: the staph colony',
        hint: 'A huge bacterial colony crawls up the left vessel. When it bursts, three bacteria spill out: keep nodes behind it.',
        groups: [{ type: 'colony', vessel: 'left', count: 1, start: 2, interval: 1 }, { type: 'virus', vessel: 'right', count: 11, start: 10, interval: 0.35 }],
      },
    ],
  },
  {
    id: 'lungs', title: 'The Lungs', organ: 'Lung', tagline: 'Every breath drags the infection deeper.',
    twist: 'Breathing: every few seconds the lungs inhale and everything in the vessels surges forward.',
    feature: 'Breathing surges',
    handicap: { text: 'Short of breath: NO refills 25% slower.', noRegen: 0.75 },
    hp: 20, startEnergy: 100, cells: 2,
    surge: { every: 6, length: 1.4, factor: 2.2 },
    map: {
      center: { x: 800, y: 450 }, rx: 225, ry: 175, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 300 }, { x: 180, y: 300 }, { x: 320, y: 410 }, { x: 460, y: 480 }, { x: 592, y: 480 }] },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 720 }, { x: 1400, y: 720 }, { x: 1250, y: 590 }, { x: 1120, y: 500 }, { x: 1008, y: 480 }] },
        { id: 'lower', name: 'Lower vessel', label: 'Lower', pts: [{ x: 560, y: 1040 }, { x: 560, y: 900 }, { x: 700, y: 820 }, { x: 790, y: 740 }, { x: 800, y: 640 }] },
        { id: 'upperLeft', name: 'Upper-left vessel', label: 'Upper left', pts: [{ x: 380, y: -40 }, { x: 400, y: 110 }, { x: 540, y: 210 }, { x: 655, y: 318 }] },
        { id: 'upperRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1220, y: -40 }, { x: 1200, y: 110 }, { x: 1060, y: 210 }, { x: 945, y: 318 }] },
      ],
    },
    waves: [
      { title: 'First breath', hint: 'Pneumococci (S. pneumoniae) come up the left vessel: an IgG aimed at them hits three times as hard. On every inhale, pathogens surge forward.',
        groups: [g('spneumo', 'left', 6, 1, 3.4), g('virus', 'right', 8, 6, 0.35), g('virus', 'upperRight', 6, 12, 0.35)] },
      { title: 'Deep breaths', hint: 'Viral clusters on both sides, bacteria from below.',
        groups: [g('virus', 'left', 8, 2, 0.3), g('saureus', 'lower', 5, 1, 3.2), g('virus', 'right', 8, 14, 0.3), g('kpneumo', 'upperLeft', 4, 8, 3.2)] },
      { title: 'Pneumonia', hint: 'Bacteria on every vessel: pneumococci and staph are both cocci, so one IgG aimed at either hits both hard. Klebsiella is a Gram-negative rod.',
        groups: [g('spneumo', 'left', 5, 1, 3.2), g('kpneumo', 'right', 5, 4, 3.2), g('spneumo', 'lower', 4, 10, 3.2), g('virus', 'lower', 8, 20, 0.3), g('saureus', 'upperRight', 4, 6, 3.2), g('virus', 'upperLeft', 8, 14, 0.3)] },
      { title: 'Coughing fit', hint: 'Hijackers ride the surges. Keep your white cells away from them, or kill them first.',
        groups: [g('kpneumo', 'lower', 6, 1, 2.6), g('virus', 'right', 10, 2, 0.3), g('hijacker', 'left', 5, 4, 1), g('hijacker', 'right', 4, 16, 1), g('virus', 'left', 8, 20, 0.3), g('virus', 'upperRight', 8, 10, 0.3)] },
      { title: 'Boss: the mother virus', hint: 'A mother virus comes up from below, shedding new viruses as it goes. Every breath carries the brood faster.',
        groups: [g('flu', 'lower', 1, 2, 1), g('spneumo', 'left', 4, 6, 3), g('virus', 'upperLeft', 6, 14, 0.3)] },
    ],
  },
  {
    id: 'brain', title: 'The Brain', organ: 'Brain', tagline: 'Little room to build, nothing to spare.',
    twist: 'The blood–brain barrier: only two lymph node sites guard each route and less health, but you get three white cells. The lower-right vessel forks.',
    feature: 'Few sites, three white cells',
    handicap: { text: 'Tight skull: lymph nodes reach 10% less far.', range: 0.9 },
    hp: 18, startEnergy: 200, cells: 3,
    map: {
      center: { x: 800, y: 360 }, rx: 230, ry: 170, siteFractions: [0.3, 0.52, 0.72],
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 240 }, { x: 190, y: 200 }, { x: 380, y: 270 }, { x: 574, y: 350 }] },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 240 }, { x: 1410, y: 200 }, { x: 1220, y: 270 }, { x: 1026, y: 350 }] },
        { id: 'midLeft', name: 'Middle-left vessel', label: 'Middle left', pts: [{ x: -40, y: 640 }, { x: 180, y: 620 }, { x: 400, y: 540 }, { x: 605, y: 455 }] },
        { id: 'lowerLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 300, y: 1040 }, { x: 360, y: 860 }, { x: 540, y: 770 }, { x: 670, y: 650 }, { x: 724, y: 520 }] },
        { id: 'lowerRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1300, y: 1040 }, { x: 1240, y: 860 }, { x: 1120, y: 790 }],
          fork: { branches: [
            { id: 'lowerRightInner', name: 'Lower-right inner branch', label: 'Inner', pts: [{ x: 1000, y: 720 }, { x: 930, y: 650 }, { x: 876, y: 520 }] },
            { id: 'lowerRightOuter', name: 'Lower-right outer branch', label: 'Outer', pts: [{ x: 1200, y: 660 }, { x: 1080, y: 560 }, { x: 975, y: 470 }] },
          ] } },
      ],
    },
    waves: [
      { title: 'The barrier', hint: 'Few sites: pick them well. Three white cells patrol whichever vessel you dilate.',
        groups: [g('spneumo', 'lowerLeft', 9, 1, 3.4), g('virus', 'left', 15, 4, 0.35), g('virus', 'midLeft', 12, 10, 0.35)] },
      { title: 'Crossing over', hint: 'Viruses come up the lower-right vessel, which forks: at the fork they take the branch you have not opened. Nodes on the shared stem guard both.',
        groups: [g('saureus', 'right', 9, 1, 3.2), g('virus', 'lowerRight', 15, 6, 0.3), g('virus', 'left', 12, 14, 0.3), g('listeria', 'midLeft', 7, 4, 3.2)] },
      { title: 'Meningitis', hint: 'Meningococci (Gram-negative cocci) and pneumococci on two vessels, and the first hijackers.',
        groups: [g('nmening', 'left', 9, 1, 3), g('spneumo', 'lowerRight', 9, 3, 3), g('virus', 'right', 18, 10, 0.3), g('hijacker', 'lowerLeft', 7, 16, 1), g('virus', 'midLeft', 15, 8, 0.3)] },
      { title: 'Fever', hint: 'Everything at once. The brain cannot take many hits.',
        groups: [g('listeria', 'lowerLeft', 12, 1, 2.6), g('hijacker', 'left', 5, 3, 1), g('virus', 'lowerRight', 18, 6, 0.3), g('hijacker', 'right', 7, 9, 1), g('virus', 'left', 12, 20, 0.3), g('nmening', 'midLeft', 7, 12, 3)] },
      { title: 'Boss: meningococcus', hint: 'A giant N. meningitidis that IgA cannot slow. IgG aimed at N. meningitidis hits it three times as hard.',
        groups: [g('meningo', 'lowerLeft', 1, 2, 1), g('virus', 'right', 15, 10, 0.3), g('saureus', 'midLeft', 7, 6, 3)] },
    ],
  },
  {
    id: 'liver', title: 'The Liver', organ: 'Liver', tagline: 'Everything from the gut comes here first.',
    twist: 'The portal vein brings a long column of gut bacteria, but the liver regrows: it regains health after every wave. Fall to half health and the gallbladder bursts: bile destroys two of your lymph nodes.',
    feature: 'Regrows; the gallbladder can burst',
    handicap: { text: 'Fatty liver: every lymph node costs 5 more energy.', nodeCost: 5 },
    hp: 24, startEnergy: 200, cells: 2, regenPerWave: 2, income: 0.65, gallbladder: { at: 0.5, nodes: 2 },
    map: {
      center: { x: 900, y: 360 }, rx: 300, ry: 150, siteFractions: [0.18, 0.32, 0.46, 0.6, 0.74, 0.88],
      vessels: [
        { id: 'portal', name: 'Portal vein', label: 'Portal vein (from the gut)', pts: [{ x: -40, y: 900 }, { x: 220, y: 900 }, { x: 400, y: 820 }, { x: 330, y: 690 }, { x: 470, y: 600 }],
          fork: { branches: [
            { id: 'portalLeft', name: 'Left portal branch', label: 'Portal left', pts: [{ x: 560, y: 520 }, { x: 645, y: 452 }] },
            { id: 'portalRight', name: 'Right portal branch', label: 'Portal right', pts: [{ x: 640, y: 610 }, { x: 760, y: 560 }, { x: 800, y: 505 }] },
          ] } },
        { id: 'artery', name: 'Hepatic artery', label: 'Artery', pts: [{ x: 1640, y: 820 }, { x: 1420, y: 800 }, { x: 1300, y: 740 }],
          fork: { branches: [
            { id: 'arteryLower', name: 'Lower artery branch', label: 'Artery lower', pts: [{ x: 1200, y: 690 }, { x: 1100, y: 580 }, { x: 1000, y: 480 }] },
            { id: 'arteryUpper', name: 'Upper artery branch', label: 'Artery upper', pts: [{ x: 1320, y: 640 }, { x: 1250, y: 520 }, { x: 1172, y: 432 }] },
          ] } },
        { id: 'upperRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1500, y: -40 }, { x: 1450, y: 100 }, { x: 1300, y: 180 }, { x: 1130, y: 262 }] },
        { id: 'upper', name: 'Upper vessel', label: 'Upper', pts: [{ x: 420, y: -40 }, { x: 440, y: 100 }, { x: 560, y: 180 }, { x: 710, y: 236 }] },
        { id: 'lower', name: 'Lower vessel', label: 'Lower', pts: [{ x: 1000, y: 1040 }, { x: 960, y: 900 }, { x: 860, y: 780 }, { x: 900, y: 512 }] },
      ],
    },
    waves: [
      { title: 'From the gut', hint: 'E. coli comes up the long portal vein. Line it with nodes; IgG aimed at E. coli (or any Gram-negative rod) hits hard.',
        groups: [g('ecoli', 'portal', 13, 1, 3), g('virus', 'upperRight', 11, 10, 0.35)] },
      { title: 'Two supplies', hint: 'The gut keeps sending bacteria; viruses arrive by the artery and from above.',
        groups: [g('ecoli', 'portal', 13, 1, 2.6), g('virus', 'artery', 16, 6, 0.3), g('virus', 'upper', 11, 14, 0.3), g('saureus', 'upperRight', 6, 4, 3)] },
      { title: 'Abscess', hint: 'A heavy bacterial load on the portal vein and below.',
        groups: [g('ecoli', 'portal', 17, 1, 2.4), g('kpneumo', 'lower', 8, 4, 3), g('virus', 'artery', 17, 12, 0.3), g('virus', 'upperRight', 13, 16, 0.3)] },
      { title: 'Hepatitis', hint: 'Hijackers from the artery and above while the gut keeps up the pressure.',
        groups: [g('kpneumo', 'portal', 17, 1, 2.2), g('hijacker', 'artery', 8, 5, 1), g('virus', 'lower', 17, 8, 0.3), g('hijacker', 'upper', 6, 14, 1), g('saureus', 'upperRight', 8, 6, 3)] },
      { title: 'Boss: the hepatitis giant', hint: 'It regrows as it climbs the portal vein. Stack enough damage along the vein to outpace it.',
        groups: [g('hepatitis', 'portal', 1, 2, 1), g('virus', 'artery', 13, 10, 0.3), g('virus', 'upperRight', 11, 16, 0.3)] },
    ],
  },
  {
    id: 'kidney', title: 'The Kidney', organ: 'Kidney', tagline: 'The filter, and the last stand.',
    twist: 'Filtration: pathogens crawl through the last stretch of every vessel, so nodes near the kidney get extra time. Each wave, the pathogens come 20% tougher.',
    feature: 'Filtration; tougher every wave',
    handicap: { text: 'Poor blood supply: 10% less energy.', income: 0.9 },
    hp: 20, startEnergy: 320, cells: 2, income: 0.7, waveHpGrowth: 0.2,
    filtration: { fraction: 0.28, factor: 0.6 },
    map: {
      center: { x: 800, y: 470 }, rx: 130, ry: 190, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 420 }, { x: 200, y: 380 }, { x: 380, y: 450 }],
          fork: { branches: [
            { id: 'leftUpper', name: 'Left upper branch', label: 'Left upper', pts: [{ x: 560, y: 420 }, { x: 675, y: 420 }] },
            { id: 'leftLower', name: 'Left lower branch', label: 'Left lower', pts: [{ x: 530, y: 560 }, { x: 682, y: 560 }] },
          ] } },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 580 }, { x: 1400, y: 610 }, { x: 1230, y: 560 }],
          fork: { branches: [
            { id: 'rightUpper', name: 'Right upper branch', label: 'Right upper', pts: [{ x: 1050, y: 470 }, { x: 926, y: 460 }] },
            { id: 'rightLower', name: 'Right lower branch', label: 'Right lower', pts: [{ x: 1080, y: 640 }, { x: 910, y: 570 }] },
          ] } },
        { id: 'upper', name: 'Upper vessel', label: 'Upper', pts: [{ x: 1040, y: -40 }, { x: 1000, y: 110 }, { x: 950, y: 170 }],
          fork: { branches: [
            { id: 'upperInner', name: 'Upper inner branch', label: 'Upper inner', pts: [{ x: 900, y: 200 }, { x: 830, y: 286 }] },
            { id: 'upperOuter', name: 'Upper outer branch', label: 'Upper outer', pts: [{ x: 1020, y: 260 }, { x: 905, y: 355 }] },
          ] } },
        { id: 'topLeft', name: 'Top-left vessel', label: 'Top left', pts: [{ x: 400, y: -40 }, { x: 450, y: 120 }, { x: 600, y: 220 }, { x: 720, y: 320 }] },
        { id: 'lower', name: 'Lower vessel', label: 'Lower', pts: [{ x: 300, y: 1040 }, { x: 380, y: 870 }, { x: 560, y: 790 }, { x: 700, y: 710 }, { x: 770, y: 654 }] },
      ],
    },
    waves: [
      { title: 'Filtration', hint: 'E. coli climbs from the bladder. Pathogens slow down near the kidney (the striped stretch), so nodes there fire for longer.',
        groups: [g('ecoli', 'left', 6, 1, 3.2), g('virus', 'upper', 10, 6, 0.3), g('virus', 'topLeft', 6, 12, 0.3)] },
      { title: 'Stones and swarms', hint: 'Viruses on the right, bacteria below, hijackers behind them on the left.',
        groups: [g('virus', 'right', 10, 2, 0.3), g('ecoli', 'lower', 6, 1, 3), g('hijacker', 'left', 4, 12, 1), g('saureus', 'topLeft', 4, 4, 3)] },
      { title: 'Infection spreads', hint: 'Hijackers on two vessels. Only dilate where you can keep your cells safe.',
        groups: [g('ecoli', 'right', 6, 1, 2.6), g('hijacker', 'upper', 6, 3, 1), g('virus', 'left', 10, 6, 0.3), g('hijacker', 'lower', 6, 10, 1), g('virus', 'topLeft', 8, 14, 0.3)] },
      { title: 'Sepsis', hint: 'The final wave: every vessel, every kind of pathogen.',
        groups: [g('ecoli', 'left', 6, 1, 3), g('saureus', 'right', 6, 2, 3), g('virus', 'upper', 10, 6, 0.3), g('hijacker', 'left', 4, 10, 1), g('hijacker', 'right', 4, 14, 1), g('virus', 'lower', 8, 18, 0.3), g('hijacker', 'upper', 4, 22, 1), g('virus', 'topLeft', 8, 8, 0.3)] },
      { title: 'Boss: sepsis', hint: 'A giant hijacker infects every white cell it touches. Do not dilate its vessel unless your nodes can kill it first.',
        groups: [g('sepsis', 'upper', 1, 2, 1), g('ecoli', 'left', 6, 4, 3), g('virus', 'right', 8, 12, 0.3), g('saureus', 'topLeft', 4, 8, 3)] },
    ],
  },
  {
    id: 'spleen', title: 'The Spleen', organ: 'Spleen', tagline: 'The body\'s own immune organ.',
    twist: 'It remakes white cells: a lost white cell returns 8 seconds later, but each one costs the spleen 1 health.',
    feature: 'Remakes lost white cells',
    handicap: { text: 'Enlarged: white cells move 15% slower.', cellSpeed: 0.85 },
    hp: 22, startEnergy: 100, cells: 2, income: 0.55,
    respawn: { after: 8, cost: 1 },
    map: {
      center: { x: 800, y: 480 }, rx: 150, ry: 210, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 300 }, { x: 200, y: 280 }, { x: 380, y: 330 }],
          fork: { branches: [
            { id: 'leftUpper', name: 'Left upper branch', label: 'Left upper', pts: [{ x: 520, y: 330 }, { x: 665, y: 390 }] },
            { id: 'leftLower', name: 'Left lower branch', label: 'Left lower', pts: [{ x: 500, y: 460 }, { x: 650, y: 480 }] },
          ] } },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 300 }, { x: 1400, y: 280 }, { x: 1220, y: 330 }],
          fork: { branches: [
            { id: 'rightUpper', name: 'Right upper branch', label: 'Right upper', pts: [{ x: 1080, y: 330 }, { x: 935, y: 395 }] },
            { id: 'rightLower', name: 'Right lower branch', label: 'Right lower', pts: [{ x: 1100, y: 460 }, { x: 950, y: 480 }] },
          ] } },
        { id: 'lowerLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 300, y: 1040 }, { x: 380, y: 880 }, { x: 520, y: 800 }],
          fork: { branches: [
            { id: 'lowerLeftInner', name: 'Lower-left inner branch', label: 'Inner', pts: [{ x: 640, y: 740 }, { x: 720, y: 660 }] },
            { id: 'lowerLeftOuter', name: 'Lower-left outer branch', label: 'Outer', pts: [{ x: 540, y: 680 }, { x: 668, y: 585 }] },
          ] } },
        { id: 'lowerRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1300, y: 1040 }, { x: 1220, y: 880 }, { x: 1060, y: 780 }, { x: 890, y: 650 }] },
        { id: 'upper', name: 'Upper vessel', label: 'Upper', pts: [{ x: 600, y: -40 }, { x: 660, y: 90 }, { x: 790, y: 170 }, { x: 800, y: 270 }] },
        { id: 'lower', name: 'Lower vessel', label: 'Lower', pts: [{ x: 1000, y: 1040 }, { x: 960, y: 900 }, { x: 860, y: 800 }, { x: 800, y: 690 }] },
      ],
    },
    waves: [
      { title: 'Encapsulated', hint: 'The spleen clears bacteria in thick capsules: pneumococci, meningococci, Klebsiella. Aim IgG at them. Lose a white cell and the spleen remakes it, at a cost of 1 health.',
        groups: [g('spneumo', 'left', 8, 1, 3.2), g('saureus', 'upper', 5, 4, 3.4), g('virus', 'right', 8, 8, 0.35)] },
      { title: 'Two capsules', hint: 'Meningococci from below, Klebsiella from the right.',
        groups: [g('nmening', 'lowerLeft', 4, 1, 3), g('kpneumo', 'right', 4, 3, 3.2), g('virus', 'upper', 6, 10, 0.3), g('saureus', 'lower', 3, 6, 3)] },
      { title: 'Hijacked', hint: 'Hijackers come down from above. Each white cell they take, the spleen pays 1 health to remake.',
        groups: [g('spneumo', 'left', 8, 1, 3), g('nmening', 'lowerRight', 7, 3, 3), g('hijacker', 'upper', 4, 8, 1), g('kpneumo', 'lower', 6, 5, 3), g('virus', 'right', 10, 14, 0.3)] },
      { title: 'Sepsis of the blood', hint: 'Everything at once, from every side.',
        groups: [g('spneumo', 'right', 8, 1, 2.8), g('nmening', 'left', 8, 3, 2.8), g('kpneumo', 'lowerLeft', 7, 5, 3), g('saureus', 'lowerRight', 6, 2, 3), g('hijacker', 'upper', 5, 10, 1), g('virus', 'lower', 12, 14, 0.3)] },
      { title: 'Boss: malaria', hint: 'Plasmodium, the malaria parasite, climbs from below and hides in red blood cells: nothing can hit it then. IgM and IgE wear it down; IgG barely scratches it.',
        groups: [g('plasmodium', 'lowerLeft', 1, 2, 1), g('spneumo', 'left', 6, 6, 3), g('virus', 'right', 10, 12, 0.3)] },
    ],
  },
  {
    id: 'marrow', title: 'The Bone Marrow', organ: 'Marrow', tagline: 'Where white cells are born.',
    twist: 'It makes white cells: you start with 2, and every cleared wave adds one more, up to 5.',
    feature: 'A white cell more every wave',
    handicap: { text: 'Brittle bone: IgE burns out a wave sooner.', igeLife: -1 },
    hp: 24, startEnergy: 180, cells: 2, income: 0.8,
    cellGrowth: { perWave: 1, max: 5 },
    map: {
      center: { x: 800, y: 480 }, rx: 260, ry: 120, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'topLeft', name: 'Upper-left vessel', label: 'Upper left', pts: [{ x: 160, y: -40 }, { x: 220, y: 120 }, { x: 400, y: 200 }],
          fork: { branches: [
            { id: 'topLeftOuter', name: 'Upper-left outer branch', label: 'Outer', pts: [{ x: 470, y: 300 }, { x: 576, y: 418 }] },
            { id: 'topLeftInner', name: 'Upper-left inner branch', label: 'Inner', pts: [{ x: 580, y: 240 }, { x: 690, y: 372 }] },
          ] } },
        { id: 'topMid', name: 'Upper vessel', label: 'Upper', pts: [{ x: 860, y: -40 }, { x: 900, y: 110 }, { x: 840, y: 240 }, { x: 822, y: 360 }] },
        { id: 'topRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1440, y: -40 }, { x: 1380, y: 120 }, { x: 1200, y: 200 }],
          fork: { branches: [
            { id: 'topRightOuter', name: 'Upper-right outer branch', label: 'Outer', pts: [{ x: 1130, y: 300 }, { x: 1024, y: 418 }] },
            { id: 'topRightInner', name: 'Upper-right inner branch', label: 'Inner', pts: [{ x: 1020, y: 240 }, { x: 910, y: 372 }] },
          ] } },
        { id: 'bottomLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 160, y: 1040 }, { x: 220, y: 880 }, { x: 400, y: 800 }],
          fork: { branches: [
            { id: 'bottomLeftOuter', name: 'Lower-left outer branch', label: 'Outer', pts: [{ x: 470, y: 700 }, { x: 576, y: 542 }] },
            { id: 'bottomLeftInner', name: 'Lower-left inner branch', label: 'Inner', pts: [{ x: 580, y: 760 }, { x: 690, y: 588 }] },
          ] } },
        { id: 'bottomMid', name: 'Lower vessel', label: 'Lower', pts: [{ x: 740, y: 1040 }, { x: 700, y: 890 }, { x: 760, y: 760 }, { x: 778, y: 600 }] },
        { id: 'bottomRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1440, y: 1040 }, { x: 1380, y: 880 }, { x: 1200, y: 800 }],
          fork: { branches: [
            { id: 'bottomRightOuter', name: 'Lower-right outer branch', label: 'Outer', pts: [{ x: 1130, y: 700 }, { x: 1024, y: 542 }] },
            { id: 'bottomRightInner', name: 'Lower-right inner branch', label: 'Inner', pts: [{ x: 1020, y: 760 }, { x: 910, y: 588 }] },
          ] } },
      ],
    },
    waves: [
      { title: 'Osteomyelitis', hint: 'Staph has reached the bone. Only two white cells for now: the marrow makes one more after every wave you clear.',
        groups: [g('saureus', 'topLeft', 8, 1, 2.8), g('saureus', 'bottomRight', 6, 4, 3), g('virus', 'topMid', 8, 8, 0.35)] },
      { title: 'A slow cough', hint: 'M. tuberculosis: slow, tough and hard to see. Aim IgG at it if you have the target.',
        groups: [g('mtb', 'topRight', 6, 1, 3.4), g('saureus', 'topLeft', 7, 3, 3), g('ecoli', 'bottomMid', 4, 6, 3), g('virus', 'bottomRight', 8, 10, 0.3)] },
      { title: 'Seeded in the bone', hint: 'Tuberculosis from both sides, hijackers from below.',
        groups: [g('mtb', 'topLeft', 7, 1, 3.2), g('mtb', 'bottomRight', 6, 4, 3.2), g('ecoli', 'topMid', 6, 6, 3), g('hijacker', 'bottomMid', 4, 9, 1), g('saureus', 'bottomLeft', 6, 3, 3), g('virus', 'topRight', 10, 14, 0.3)] },
      { title: 'Every side', hint: 'Five white cells now: spread them where the bacteria are thickest.',
        groups: [g('mtb', 'bottomLeft', 8, 1, 3), g('saureus', 'topRight', 8, 2, 2.6), g('ecoli', 'bottomRight', 5, 4, 3.2), g('mtb', 'topMid', 5, 6, 3.2), g('hijacker', 'topLeft', 5, 10, 1), g('virus', 'bottomMid', 12, 14, 0.3)] },
      { title: 'Boss: the granuloma', hint: 'A tuberculous granuloma: bacteria walled in by your own cells. Every antibody strike chips the wall; until it breaks, everything does a quarter damage. A pulse breaks it at once.',
        groups: [g('granuloma', 'topLeft', 1, 2, 1), g('mtb', 'bottomRight', 6, 6, 3), g('virus', 'topRight', 10, 12, 0.3)] },
    ],
  },
  {
    id: 'stomach', title: 'The Stomach', organ: 'Stomach', tagline: 'A bath of acid at the end of every vessel.',
    damageMul: { hpylori: 2 },
    twist: 'Acid: on the last third of every vessel, pathogens lose 3 health a second. H. pylori feeds on it and gains health there instead.',
    feature: 'Acid; H. pylori feeds on it',
    handicap: { text: 'Churning: NO drains 15% faster.', noDrain: 1.15 },
    hp: 24, startEnergy: 280, cells: 2, income: 0.55,
    acid: { fraction: 0.33, dps: 3 },
    map: {
      center: { x: 800, y: 500 }, rx: 200, ry: 150, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'topLeft', name: 'Upper-left vessel', label: 'Upper left', pts: [{ x: 180, y: -40 }, { x: 240, y: 120 }, { x: 410, y: 200 }],
          fork: { branches: [
            { id: 'topLeftOuter', name: 'Upper-left outer branch', label: 'Outer', pts: [{ x: 500, y: 300 }, { x: 628, y: 424 }] },
            { id: 'topLeftInner', name: 'Upper-left inner branch', label: 'Inner', pts: [{ x: 590, y: 220 }, { x: 706, y: 368 }] },
          ] } },
        { id: 'top', name: 'Upper vessel', label: 'Upper', pts: [{ x: 820, y: -40 }, { x: 780, y: 110 }, { x: 810, y: 240 }, { x: 800, y: 350 }] },
        { id: 'topRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1420, y: -40 }, { x: 1360, y: 120 }, { x: 1190, y: 200 }],
          fork: { branches: [
            { id: 'topRightOuter', name: 'Upper-right outer branch', label: 'Outer', pts: [{ x: 1100, y: 300 }, { x: 972, y: 424 }] },
            { id: 'topRightInner', name: 'Upper-right inner branch', label: 'Inner', pts: [{ x: 1010, y: 220 }, { x: 894, y: 368 }] },
          ] } },
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 500 }, { x: 180, y: 470 }, { x: 400, y: 510 }, { x: 600, y: 500 }] },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 500 }, { x: 1420, y: 530 }, { x: 1200, y: 490 }, { x: 1000, y: 500 }] },
        { id: 'bottomLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 180, y: 1040 }, { x: 240, y: 880 }, { x: 410, y: 800 }],
          fork: { branches: [
            { id: 'bottomLeftOuter', name: 'Lower-left outer branch', label: 'Outer', pts: [{ x: 500, y: 700 }, { x: 628, y: 576 }] },
            { id: 'bottomLeftInner', name: 'Lower-left inner branch', label: 'Inner', pts: [{ x: 590, y: 780 }, { x: 706, y: 632 }] },
          ] } },
        { id: 'bottomRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1420, y: 1040 }, { x: 1360, y: 880 }, { x: 1190, y: 800 }],
          fork: { branches: [
            { id: 'bottomRightOuter', name: 'Lower-right outer branch', label: 'Outer', pts: [{ x: 1100, y: 700 }, { x: 972, y: 576 }] },
            { id: 'bottomRightInner', name: 'Lower-right inner branch', label: 'Inner', pts: [{ x: 1010, y: 780 }, { x: 894, y: 632 }] },
          ] } },
      ],
    },
    waves: [
      { title: 'Something it ate', hint: 'Salmonella: fast, in groups. The acid on the last third of each vessel wears down everything that gets that far, so slow them before they arrive.',
        groups: [g('salmonella', 'left', 9, 1, 1.8), g('saureus', 'right', 7, 4, 3), g('virus', 'top', 9, 8, 0.35)] },
      { title: 'Acid-proof', hint: 'H. pylori shrugs off acid: it must be killed before it reaches the stomach.',
        groups: [g('hpylori', 'topLeft', 11, 1, 3.2), g('salmonella', 'right', 15, 3, 1.8), g('saureus', 'left', 10, 6, 3), g('virus', 'top', 15, 10, 0.3)] },
      { title: 'Ulcer', hint: 'H. pylori from both upper sides, hijackers from above, and jumping viruses: a third of the way in, each leaps once to another vessel.',
        groups: [g('hpylori', 'topRight', 18, 1, 3), g('hpylori', 'topLeft', 13, 5, 3.2), g('salmonella', 'left', 23, 3, 1.6), g('hijacker', 'top', 10, 9, 1), g('saureus', 'right', 14, 2, 3), g('jumper', 'bottomRight', 15, 14, 0.4)] },
      { title: 'Every side', hint: 'Everything at once. The acid helps against all but H. pylori.',
        groups: [g('hpylori', 'bottomLeft', 14, 1, 3.2), g('salmonella', 'topRight', 23, 2, 1.6), g('saureus', 'left', 14, 4, 2.8), g('hpylori', 'right', 14, 6, 3), g('hijacker', 'topLeft', 10, 10, 1), g('jumper', 'bottomRight', 18, 14, 0.4)] },
      { title: 'Boss: the burrowing swarm', hint: 'A swarm of H. pylori: acid-proof, and every few seconds it burrows into the lining, where nothing can touch it, and tunnels on three times as fast. Hit it hard while it is out.',
        groups: [g('burrower', 'topLeft', 1, 2, 1), g('hpylori', 'bottomLeft', 14, 4, 3), g('salmonella', 'bottomRight', 19, 6, 1.6), g('virus', 'right', 25, 12, 0.3)] },
    ],
  },
  {
    id: 'lymphnode', title: 'The Lymph Node', organ: 'Node', tagline: 'The finale: your own defences are the target.',
    twist: 'Every pathogen that reaches the node weakens the lymph nodes guarding its vessel by 10% until the wave ends. The boss, HIV, switches off every lymph node it passes.',
    feature: 'Leaks weaken your nodes; HIV',
    handicap: { text: 'Fever: white cells have 20% less health.', cellHp: 0.8 },
    hp: 26, startEnergy: 340, cells: 3, income: 0.6,
    weakens: { per: 0.1, min: 0.5 },
    map: {
      center: { x: 800, y: 500 }, rx: 190, ry: 150, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8],
      vessels: [
        { id: 'topLeft', name: 'Upper-left vessel', label: 'Upper left', pts: [{ x: 180, y: -40 }, { x: 240, y: 120 }, { x: 410, y: 200 }],
          fork: { branches: [
            { id: 'topLeftOuter', name: 'Upper-left outer branch', label: 'Outer', pts: [{ x: 500, y: 300 }, { x: 636, y: 425 }] },
            { id: 'topLeftInner', name: 'Upper-left inner branch', label: 'Inner', pts: [{ x: 590, y: 220 }, { x: 712, y: 368 }] },
          ] } },
        { id: 'top', name: 'Upper vessel', label: 'Upper', pts: [{ x: 820, y: -40 }, { x: 780, y: 110 }, { x: 810, y: 240 }, { x: 800, y: 350 }] },
        { id: 'topRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1420, y: -40 }, { x: 1360, y: 120 }, { x: 1190, y: 200 }],
          fork: { branches: [
            { id: 'topRightOuter', name: 'Upper-right outer branch', label: 'Outer', pts: [{ x: 1100, y: 300 }, { x: 964, y: 425 }] },
            { id: 'topRightInner', name: 'Upper-right inner branch', label: 'Inner', pts: [{ x: 1010, y: 220 }, { x: 888, y: 368 }] },
          ] } },
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 500 }, { x: 160, y: 470 }, { x: 330, y: 500 }],
          fork: { branches: [
            { id: 'leftUpper', name: 'Left upper branch', label: 'Upper', pts: [{ x: 470, y: 450 }, { x: 612, y: 468 }] },
            { id: 'leftLower', name: 'Left lower branch', label: 'Lower', pts: [{ x: 470, y: 560 }, { x: 612, y: 532 }] },
          ] } },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 500 }, { x: 1440, y: 470 }, { x: 1270, y: 500 }],
          fork: { branches: [
            { id: 'rightUpper', name: 'Right upper branch', label: 'Upper', pts: [{ x: 1130, y: 450 }, { x: 988, y: 468 }] },
            { id: 'rightLower', name: 'Right lower branch', label: 'Lower', pts: [{ x: 1130, y: 560 }, { x: 988, y: 532 }] },
          ] } },
        { id: 'bottomLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 180, y: 1040 }, { x: 240, y: 880 }, { x: 410, y: 800 }],
          fork: { branches: [
            { id: 'bottomLeftOuter', name: 'Lower-left outer branch', label: 'Outer', pts: [{ x: 500, y: 700 }, { x: 636, y: 575 }] },
            { id: 'bottomLeftInner', name: 'Lower-left inner branch', label: 'Inner', pts: [{ x: 590, y: 780 }, { x: 712, y: 632 }] },
          ] } },
        { id: 'bottomRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1420, y: 1040 }, { x: 1360, y: 880 }, { x: 1190, y: 800 }, { x: 1000, y: 700 }, { x: 930, y: 610 }] },
      ],
    },
    waves: [
      { title: 'Strep throat', hint: 'S. pyogenes in long chains up the left, staph from the right. Every pathogen that reaches the node weakens the lymph nodes on its vessel until the wave ends.',
        groups: [g('spyogenes', 'left', 8, 1, 2.6), g('saureus', 'right', 6, 4, 3), g('virus', 'top', 8, 8, 0.35)] },
      { title: 'Swollen glands', hint: 'From the upper left and lower right; hijackers from above.',
        groups: [g('spyogenes', 'topLeft', 8, 1, 2.6), g('saureus', 'bottomRight', 7, 3, 3), g('ecoli', 'left', 6, 6, 3), g('hijacker', 'top', 3, 9, 1), g('virus', 'right', 10, 12, 0.3)] },
      { title: 'Drainage', hint: 'Everything the body drains comes here: from every side now.',
        groups: [g('spyogenes', 'topRight', 9, 1, 2.4), g('ecoli', 'bottomLeft', 7, 3, 3), g('saureus', 'left', 7, 2, 3), g('hijacker', 'right', 4, 9, 1), g('jumper', 'bottomRight', 8, 12, 0.4)] },
      { title: 'Overwhelmed', hint: 'The last wave before the boss. Keep your lymph nodes from being worn down.',
        groups: [g('spyogenes', 'bottomLeft', 10, 1, 2.2), g('saureus', 'topRight', 8, 2, 2.6), g('ecoli', 'topLeft', 8, 4, 2.8), g('spyogenes', 'right', 6, 6, 2.6), g('hijacker', 'bottomRight', 5, 10, 1), g('jumper', 'top', 9, 14, 0.4)] },
      { title: 'Boss: HIV', hint: 'HIV attacks the immune system itself: white cells can\'t touch it, and every lymph node it passes is switched off for the rest of the wave. Kill it early, with IgM and IgE.',
        groups: [g('hiv', 'topLeft', 1, 2, 1), g('spyogenes', 'bottomRight', 8, 6, 2.6), g('virus', 'left', 10, 12, 0.3)] },
    ],
  },
  {
    id: 'skin', title: 'The Skin', organ: 'Skin', tagline: 'The body\'s first wall, broken open.',
    twist: 'Open wounds: pathogens enter through cuts, partway along their vessels, not from the edge of the map.',
    feature: 'Pathogens enter through wounds',
    handicap: { text: 'Inflamed: pathogens have 10% more health.', hp: 1.1 },
    hp: 24, startEnergy: 520, cells: 3, income: 0.25,
    wounds: { from: 0.2, to: 0.5 },
    map: {
      center: { x: 800, y: 430 }, rx: 280, ry: 110, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8], gaugeDrop: 136,
      vessels: [
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 430 }, { x: 180, y: 410 }, { x: 320, y: 430 }],
          fork: { branches: [
            { id: 'leftUpper', name: 'Left upper branch', label: 'Upper', pts: [{ x: 420, y: 320 }, { x: 537, y: 392 }] },
            { id: 'leftLower', name: 'Left lower branch', label: 'Lower', pts: [{ x: 420, y: 550 }, { x: 537, y: 468 }] },
          ] } },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 430 }, { x: 1420, y: 410 }, { x: 1280, y: 430 }],
          fork: { branches: [
            { id: 'rightUpper', name: 'Right upper branch', label: 'Upper', pts: [{ x: 1180, y: 320 }, { x: 1063, y: 392 }] },
            { id: 'rightLower', name: 'Right lower branch', label: 'Lower', pts: [{ x: 1180, y: 550 }, { x: 1063, y: 468 }] },
          ] } },
        { id: 'topMid', name: 'Upper vessel', label: 'Upper', pts: [{ x: 800, y: -40 }, { x: 760, y: 120 }, { x: 820, y: 240 }, { x: 800, y: 320 }] },
        { id: 'bottomLeft', name: 'Lower-left vessel', label: 'Lower left', pts: [{ x: 300, y: 1040 }, { x: 360, y: 860 }, { x: 520, y: 760 }],
          fork: { branches: [
            { id: 'bottomLeftOuter', name: 'Lower-left outer branch', label: 'Outer', pts: [{ x: 560, y: 640 }, { x: 602, y: 508 }] },
            { id: 'bottomLeftInner', name: 'Lower-left inner branch', label: 'Inner', pts: [{ x: 660, y: 700 }, { x: 704, y: 533 }] },
          ] } },
        { id: 'bottomMid', name: 'Lower vessel', label: 'Lower', pts: [{ x: 800, y: 1040 }, { x: 840, y: 880 }, { x: 780, y: 720 }, { x: 800, y: 540 }] },
        { id: 'bottomRight', name: 'Lower-right vessel', label: 'Lower right', pts: [{ x: 1300, y: 1040 }, { x: 1240, y: 860 }, { x: 1080, y: 760 }],
          fork: { branches: [
            { id: 'bottomRightOuter', name: 'Lower-right outer branch', label: 'Outer', pts: [{ x: 1040, y: 640 }, { x: 998, y: 508 }] },
            { id: 'bottomRightInner', name: 'Lower-right inner branch', label: 'Inner', pts: [{ x: 940, y: 700 }, { x: 896, y: 533 }] },
          ] } },
      ],
    },
    waves: [
      { title: 'A graze', hint: 'Pathogens come in through cuts, partway along the vessels, not from the edge of the map: guard the inner sites too.',
        groups: [g('saureus', 'left', 3, 1, 2.8), g('spyogenes', 'bottomRight', 2, 4, 2.8), g('virus', 'topMid', 3, 8, 0.35)] },
      { title: 'Burn wound', hint: 'Pseudomonas, the burn-ward bacterium: tough, and quick through wounds.',
        groups: [g('paeruginosa', 'right', 7, 1, 3), g('saureus', 'left', 7, 3, 2.8), g('spyogenes', 'bottomMid', 5, 6, 3), g('virus', 'bottomRight', 9, 10, 0.3)] },
      { title: 'Infected cut', hint: 'Pseudomonas from two sides, hijackers through a wound from below.',
        groups: [g('paeruginosa', 'left', 10, 1, 2.8), g('paeruginosa', 'bottomRight', 8, 4, 3), g('spyogenes', 'topMid', 9, 6, 2.8), g('hijacker', 'bottomMid', 5, 9, 1), g('saureus', 'bottomLeft', 9, 3, 2.8), g('jumper', 'right', 9, 14, 0.4)] },
      { title: 'Cellulitis', hint: 'The infection spreads under the skin: every vessel at once.',
        groups: [g('paeruginosa', 'bottomLeft', 11, 1, 2.6), g('saureus', 'right', 11, 2, 2.4), g('spyogenes', 'bottomRight', 10, 4, 2.6), g('paeruginosa', 'topMid', 9, 6, 2.8), g('hijacker', 'left', 7, 10, 1), g('jumper', 'bottomMid', 12, 14, 0.4)] },
      { title: 'Boss: flesh-eating strep', hint: 'Necrotising fasciitis. Every antibody strike makes it faster, up to more than twice its speed: slow it with IgA, or hit it hard and fast with IgE.',
        groups: [g('necrotizer', 'left', 1, 2, 1), g('paeruginosa', 'bottomRight', 9, 6, 2.8), g('virus', 'right', 17, 12, 0.3)] },
    ],
  },
  {
    id: 'eye', title: 'The Eye', organ: 'Eye', tagline: 'Immune-privileged: you defend it alone.',
    twist: 'Immune privilege: no white cells come to the eye, so there is no pulse. Only your lymph nodes defend it.',
    feature: 'No white cells: nodes alone',
    handicap: { text: 'Blurred: lymph nodes fire 10% slower.', cooldown: 1.1 },
    hp: 22, startEnergy: 160, cells: 0, income: 0.35,
    map: {
      center: { x: 800, y: 500 }, rx: 150, ry: 150, siteFractions: [0.2, 0.35, 0.5, 0.65, 0.8], gaugeDrop: -200,
      vessels: [
        { id: 'topLeft', name: 'Upper-left vessel', label: 'Upper left', pts: [{ x: 200, y: -40 }, { x: 300, y: 150 }, { x: 480, y: 250 }],
          fork: { branches: [
            { id: 'topLeftInner', name: 'Upper-left inner branch', label: 'Inner', pts: [{ x: 560, y: 330 }, { x: 694, y: 394 }] },
            { id: 'topLeftOuter', name: 'Upper-left outer branch', label: 'Outer', pts: [{ x: 500, y: 400 }, { x: 659, y: 449 }] },
          ] } },
        { id: 'topRight', name: 'Upper-right vessel', label: 'Upper right', pts: [{ x: 1400, y: -40 }, { x: 1300, y: 150 }, { x: 1120, y: 250 }],
          fork: { branches: [
            { id: 'topRightInner', name: 'Upper-right inner branch', label: 'Inner', pts: [{ x: 1040, y: 330 }, { x: 906, y: 394 }] },
            { id: 'topRightOuter', name: 'Upper-right outer branch', label: 'Outer', pts: [{ x: 1100, y: 400 }, { x: 941, y: 449 }] },
          ] } },
        { id: 'left', name: 'Left vessel', label: 'Left', pts: [{ x: -40, y: 640 }, { x: 250, y: 680 }, { x: 450, y: 600 }, { x: 655, y: 539 }] },
        { id: 'right', name: 'Right vessel', label: 'Right', pts: [{ x: 1640, y: 640 }, { x: 1350, y: 680 }, { x: 1150, y: 600 }, { x: 945, y: 539 }] },
        { id: 'bottom', name: 'Lower vessel', label: 'Lower', pts: [{ x: 800, y: 1040 }, { x: 760, y: 900 }, { x: 800, y: 790 }],
          fork: { branches: [
            { id: 'bottomLeft', name: 'Lower left branch', label: 'Left', pts: [{ x: 700, y: 720 }, { x: 725, y: 630 }] },
            { id: 'bottomRight', name: 'Lower right branch', label: 'Right', pts: [{ x: 900, y: 720 }, { x: 875, y: 630 }] },
          ] } },
      ],
    },
    waves: [
      { title: 'Conjunctivitis', hint: 'The eye is immune-privileged: no white cells come here, so there is no pulse. Your lymph nodes are all there is.',
        groups: [g('saureus', 'left', 4, 1, 3), g('chlamydia', 'right', 4, 4, 3), g('virus', 'topRight', 5, 8, 0.35)] },
      { title: 'Trachoma', hint: 'Chlamydia, the commonest infectious cause of blindness: aim IgG at it.',
        groups: [g('chlamydia', 'left', 8, 1, 2.8), g('paeruginosa', 'bottom', 6, 3, 3), g('saureus', 'right', 6, 6, 3), g('virus', 'topLeft', 9, 10, 0.3)] },
      { title: 'Contact-lens ulcer', hint: 'Pseudomonas on the cornea: tough and fast.',
        groups: [g('paeruginosa', 'right', 10, 1, 2.8), g('chlamydia', 'topRight', 9, 3, 2.8), g('saureus', 'left', 9, 2, 3), g('jumper', 'bottom', 9, 12, 0.4)] },
      { title: 'Red eye', hint: 'From every side: nothing but your nodes stands in the way.',
        groups: [g('chlamydia', 'topLeft', 11, 1, 2.6), g('paeruginosa', 'left', 10, 2, 2.6), g('saureus', 'bottom', 10, 4, 2.6), g('chlamydia', 'right', 8, 6, 2.8), g('jumper', 'topRight', 11, 12, 0.4)] },
      { title: 'Boss: herpes', hint: 'Herpes simplex hides in nerves. Twice, when its health falls to half, it goes dormant for 3 s, out of reach, and comes back a quarter healed. IgM and IgE.',
        groups: [g('herpes', 'topRight', 1, 2, 1), g('chlamydia', 'left', 9, 6, 2.8), g('virus', 'right', 14, 12, 0.3)] },
    ],
  },
];

export const NODE_TYPES: NodeType[] = ['igm', 'igg', 'iga', 'ige'];
