// ─────────────────────────────────────────────────────────────────────────────
//  DEFEND THE HEART · tuning. Every number that shapes play lives here,
//  shared rules first, then one entry per organ level.
// ─────────────────────────────────────────────────────────────────────────────

/** Vessel ids are per level ('left', 'portal', 'lowerLeft' …). */
export type VesselId = string;
/** The six named bacteria. */
export type BacteriumType = 'saureus' | 'spneumo' | 'listeria' | 'nmening' | 'ecoli' | 'kpneumo';
export const BACTERIA: BacteriumType[] = ['saureus', 'spneumo', 'listeria', 'nmening', 'ecoli', 'kpneumo'];
export type PathogenType = BacteriumType | 'virus' | 'hijacker' | 'infected' | BossType;
/** What an IgG antibody recognises: Gram stain, shape and species. */
export interface Taxon { gram: '+' | '-'; shape: 'coccus' | 'rod'; species: BacteriumType }
/** One boss per organ, met in that organ's last wave. */
export type BossType = 'colony' | 'flu' | 'meningo' | 'hepatitis' | 'sepsis';
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
}

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
  waveClearEnergy: (wave: number) => 40 + 10 * wave,

  vesselRestWidth: 30,
  vesselDilatedWidth: 64,
  dilateRate: 1.8,

  nodes: {
    igm: { name: 'IgM lymph node', short: 'IgM', cost: 60, damage: 10, cooldown: 0.9, range: 175, shotSpeed: 520, blurb: 'Hits every pathogen the same.' },
    igg: { name: 'IgG lymph node', short: 'IgG', cost: 50, damage: 10, cooldown: 0.8, range: 175, shotSpeed: 560,
      blurb: 'Aimed at one bacterium: ×3 on it, ×2.5 on the same shape, ×2 on the same Gram stain, ×0.5 on other bacteria, ×0.25 on viruses.' },
    iga: { name: 'IgA lymph node', short: 'IgA', cost: 50, damage: 7.5, cooldown: 0.7, range: 175, shotSpeed: 560, slow: 0.5, slowSeconds: 2.2, blurb: 'Softer hits, but slows what it hits.' },
    ige: { name: 'IgE lymph node', short: 'IgE', cost: 80, damage: 20, cooldown: 0.9, range: 230, shotSpeed: 440, burnsOutAfter: 3,
      blurb: 'Double damage and a long reach, but it burns out after three waves.' },
  } as Record<NodeType, NodeStats>,

  whiteCell: {
    hp: 60,
    speed: 62,
    recallSpeed: 210,
    attackRange: 26,
    dps: 4,
    guardAt: 0.62,
    /** Cells never go further out than this fraction of the vessel (they fight under node cover). */
    minReach: 0.4,
  },

  immunePulse: { perWave: 1, radius: 85, damage: 42, ringSeconds: 0.45 },

  /** Nitric oxide: the fuel that holds a vessel open during a wave. */
  /** IgG damage multipliers: the single best match applies. */
  iggMatch: { species: 3, shape: 2.5, gram: 2, unrelated: 0.5, nonBacterium: 0.25 },
  /** Energy to re-aim a placed IgG node between waves. */
  iggRetarget: 20,
  /** Energy for an IgG node aimed at two targets (career upgrade). */
  dualIggCost: 80,

  no: { max: 100, openCost: 15, drainPerSec: 8, regenPerSec: 3, waveTopUp: 35, minOpenSeconds: 1 },

  pathogens: {
    saureus: { name: 'Staphylococcus aureus', plural: 'S. aureus', short: 'Gram+ coccus, in clusters', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'coccus', species: 'saureus' } },
    spneumo: { name: 'Streptococcus pneumoniae', plural: 'S. pneumoniae', short: 'Gram+ coccus, in pairs', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'coccus', species: 'spneumo' } },
    listeria: { name: 'Listeria monocytogenes', plural: 'Listeria', short: 'Gram+ rod', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '+', shape: 'rod', species: 'listeria' } },
    nmening: { name: 'Neisseria meningitidis', plural: 'N. meningitidis', short: 'Gram− coccus, in pairs', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'coccus', species: 'nmening' } },
    ecoli: { name: 'Escherichia coli', plural: 'E. coli', short: 'Gram− rod', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'rod', species: 'ecoli' } },
    kpneumo: { name: 'Klebsiella pneumoniae', plural: 'Klebsiella', short: 'Gram− rod, capsulated', hp: 70, speed: 30, heartDamage: 3, contactDps: 3, bounty: 7, taxon: { gram: '-', shape: 'rod', species: 'kpneumo' } },
    virus: { name: 'Virus', plural: 'Viruses', hp: 10, speed: 74, heartDamage: 1, contactDps: 2, bounty: 2 },
    hijacker: { name: 'Hijacker virus', plural: 'Hijacker viruses', hp: 16, speed: 58, heartDamage: 1, contactDps: 0, bounty: 4, infects: true },
    infected: { name: 'Infected white cell', plural: 'Infected white cells', hp: 55, speed: 46, heartDamage: 3, contactDps: 4, bounty: 6 },
    colony: { name: 'Staph colony', plural: 'Staph colonies', hp: 380, speed: 15, heartDamage: 6, contactDps: 3, bounty: 60, boss: true, taxon: { gram: '+', shape: 'coccus', species: 'saureus' },
      splitInto: { type: 'saureus', count: 3, hpFactor: 0.5 }, blurb: 'A grape-bunch of S. aureus. Burst it and three weakened staph spill out. IgG aimed at S. aureus hits it three times as hard.' },
    flu: { name: 'Mother virus', plural: 'Mother viruses', hp: 420, speed: 20, heartDamage: 6, contactDps: 6, bounty: 60, boss: true,
      sheds: { type: 'virus', every: 2.4 }, blurb: 'Releases a new virus every few seconds as it travels. Kill it fast: IgM and IgE do it best.' },
    meningo: { name: 'Meningococcus', plural: 'Meningococci', hp: 290, speed: 20, heartDamage: 6, contactDps: 7, bounty: 60, boss: true, taxon: { gram: '-', shape: 'coccus', species: 'nmening' },
      slowImmune: true, blurb: 'A giant N. meningitidis. IgA cannot slow it; IgG aimed at N. meningitidis hits it three times as hard.' },
    hepatitis: { name: 'Hepatitis giant', plural: 'Hepatitis giants', hp: 520, speed: 17, heartDamage: 6, contactDps: 6, bounty: 60, boss: true,
      regen: 9, blurb: 'Heals itself as it travels. Damage must outpace its regrowth: IgM and IgE, not IgG.' },
    sepsis: { name: 'Sepsis hijacker', plural: 'Sepsis hijackers', hp: 340, speed: 19, heartDamage: 8, contactDps: 0, bounty: 60, boss: true,
      infects: true, infectsMany: true, blurb: 'A giant hijacker: it infects every white cell it touches and keeps going.' },
  } as Record<PathogenType, PathogenStats>,
};

// ── Levels ──────────────────────────────────────────────────────────────────

export type OrganKind = 'heart' | 'lungs' | 'brain' | 'liver' | 'kidney';
type P = { x: number; y: number };

export interface BranchDef { id: VesselId; name: string; label: string; pts: P[] }
export interface VesselDef { id: VesselId; name: string; label: string; pts: P[]; fork?: { branches: [BranchDef, BranchDef] } }

export interface LevelDef {
  id: OrganKind;
  /** Shown in the level list: "Level 2 · The Lungs". */
  title: string;
  /** "Heart", "Lung", "Brain"… used for "Heart health", "−3 brain health". */
  organ: string;
  tagline: string;
  /** The one rule that makes this organ different, in a sentence for the panel. */
  twist: string;
  hp: number;
  startEnergy: number;
  cells: number;
  startingNodes: { vessel: VesselId; site: number; type: NodeType }[];
  /** Lungs: every `every` seconds the blood surges for `length` seconds, pathogens move ×`factor`. */
  surge?: { every: number; length: number; factor: number };
  /** Liver: organ health regained after every cleared wave. */
  regenPerWave?: number;
  /** Kidney: on the last `fraction` of every vessel, pathogens are filtered to ×`factor` speed. */
  filtration?: { fraction: number; factor: number };
  map: {
    center: P;
    /** Rough organ size, for drawing and keeping build sites off the organ. */
    rx: number; ry: number;
    /** Where on each vessel (fractions of its length) lymph nodes may stand. */
    siteFractions: number[];
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
    hp: 20, startEnergy: 240, cells: 2,
    startingNodes: [{ vessel: 'left', site: 1, type: 'igm' }, { vessel: 'right', site: 1, type: 'igm' }],
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
        hint: 'Bacteria come up the left vessel. Once they are well on their way, open it so your white cells can meet them: opening and holding it open costs NO.',
        groups: [{ type: 'saureus', vessel: 'left', count: 5, start: 1, interval: 3.4 }],
      },
      {
        title: 'Two fronts',
        hint: 'A fast viral cluster on the right, a few bacteria from below. Place a lymph node where you will not send your white cells.',
        groups: [
          { type: 'virus', vessel: 'right', count: 6, start: 4, interval: 0.35 },
          { type: 'saureus', vessel: 'lower', count: 3, start: 1, interval: 4 },
          { type: 'virus', vessel: 'right', count: 5, start: 16, interval: 0.35 },
        ],
      },
      {
        title: 'Armoured bacteria',
        hint: 'Staph comes in clusters. An IgG node aimed at S. aureus hits it three times as hard.',
        groups: [
          { type: 'saureus', vessel: 'upper', count: 4, start: 1, interval: 3.4 },
          { type: 'saureus', vessel: 'left', count: 3, start: 8, interval: 3.5 },
          { type: 'virus', vessel: 'lower', count: 5, start: 12, interval: 0.4 },
        ],
      },
      {
        title: 'Swarm',
        hint: 'Fast viruses on every side. IgA slows them long enough for the rest to land.',
        groups: [
          { type: 'virus', vessel: 'upper', count: 6, start: 2, interval: 0.35 },
          { type: 'virus', vessel: 'right', count: 7, start: 8, interval: 0.3 },
          { type: 'saureus', vessel: 'lower', count: 4, start: 4, interval: 3 },
          { type: 'virus', vessel: 'left', count: 6, start: 16, interval: 0.3 },
          { type: 'virus', vessel: 'upper', count: 5, start: 22, interval: 0.35 },
        ],
      },
      {
        title: 'Hijackers',
        hint: 'Some viruses can enter a white cell and turn it against the heart. Kill them before they touch your cells, or keep the cells away from them.',
        groups: [
          { type: 'hijacker', vessel: 'left', count: 4, start: 3, interval: 1 },
          { type: 'hijacker', vessel: 'lower', count: 4, start: 10, interval: 1 },
          { type: 'hijacker', vessel: 'right', count: 3, start: 18, interval: 1 },
          { type: 'saureus', vessel: 'right', count: 5, start: 1, interval: 2.6 },
          { type: 'virus', vessel: 'upper', count: 8, start: 6, interval: 0.3 },
          { type: 'saureus', vessel: 'lower', count: 3, start: 4, interval: 3 },
          { type: 'saureus', vessel: 'left', count: 3, start: 14, interval: 3 },
          { type: 'hijacker', vessel: 'upper', count: 3, start: 20, interval: 1.2 },
        ],
      },
      {
        title: 'Boss: the staph colony',
        hint: 'A huge bacterial colony crawls up the left vessel. When it bursts, three bacteria spill out: keep nodes behind it.',
        groups: [{ type: 'colony', vessel: 'left', count: 1, start: 2, interval: 1 }, { type: 'virus', vessel: 'right', count: 6, start: 10, interval: 0.35 }],
      },
    ],
  },
  {
    id: 'lungs', title: 'The Lungs', organ: 'Lung', tagline: 'Every breath drags the infection deeper.',
    twist: 'Breathing: every few seconds the lungs inhale and everything in the vessels surges forward.',
    hp: 20, startEnergy: 520, cells: 2,
    startingNodes: [{ vessel: 'left', site: 1, type: 'igm' }, { vessel: 'right', site: 1, type: 'iga' }],
    surge: { every: 6, length: 1.4, factor: 1.5 },
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
      { title: 'First breath', hint: 'Watch the blue breathing gauge: on every inhale, pathogens surge forward. Nodes further out buy time.',
        groups: [g('saureus', 'left', 5, 1, 3.4), g('virus', 'right', 6, 6, 0.35), g('virus', 'upperRight', 5, 12, 0.35)] },
      { title: 'Deep breaths', hint: 'Viral clusters on both sides, bacteria from below.',
        groups: [g('virus', 'left', 6, 2, 0.3), g('saureus', 'lower', 4, 1, 3.2), g('virus', 'right', 6, 14, 0.3), g('saureus', 'upperLeft', 3, 8, 3.2)] },
      { title: 'Pneumonia', hint: 'Bacteria on every vessel. IgG strips their capsules.',
        groups: [g('saureus', 'left', 4, 1, 3.2), g('saureus', 'right', 4, 4, 3.2), g('saureus', 'lower', 3, 10, 3.2), g('virus', 'lower', 6, 20, 0.3), g('saureus', 'upperRight', 3, 6, 3.2), g('virus', 'upperLeft', 6, 14, 0.3)] },
      { title: 'Coughing fit', hint: 'Hijackers ride the surges. Keep your white cells away from them, or kill them first.',
        groups: [g('saureus', 'lower', 5, 1, 2.6), g('virus', 'right', 8, 2, 0.3), g('hijacker', 'left', 4, 4, 1), g('hijacker', 'right', 3, 16, 1), g('virus', 'left', 6, 20, 0.3), g('virus', 'upperRight', 6, 10, 0.3)] },
      { title: 'Boss: the mother virus', hint: 'A mother virus comes up from below, shedding new viruses as it goes. Every breath carries the brood faster.',
        groups: [g('flu', 'lower', 1, 2, 1), g('saureus', 'left', 3, 6, 3), g('virus', 'upperLeft', 5, 14, 0.3)] },
    ],
  },
  {
    id: 'brain', title: 'The Brain', organ: 'Brain', tagline: 'Little room to build, nothing to spare.',
    twist: 'The blood–brain barrier: only two lymph node sites guard each route and less health, but you get three white cells. The lower-right vessel forks.',
    hp: 18, startEnergy: 440, cells: 3,
    startingNodes: [{ vessel: 'left', site: 1, type: 'igm' }, { vessel: 'right', site: 1, type: 'igm' }],
    map: {
      center: { x: 800, y: 360 }, rx: 230, ry: 170, siteFractions: [0.36, 0.66],
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
        groups: [g('saureus', 'lowerLeft', 4, 1, 3.4), g('virus', 'left', 6, 4, 0.35), g('virus', 'midLeft', 5, 10, 0.35)] },
      { title: 'Crossing over', hint: 'Viruses come up the lower-right vessel, which forks: at the fork they take the branch you have not opened. Nodes on the shared stem guard both.',
        groups: [g('saureus', 'right', 4, 1, 3.2), g('virus', 'lowerRight', 6, 6, 0.3), g('virus', 'left', 5, 14, 0.3), g('saureus', 'midLeft', 3, 4, 3.2)] },
      { title: 'Meningitis', hint: 'Armoured bacteria on two vessels, and the first hijackers.',
        groups: [g('saureus', 'left', 4, 1, 3), g('saureus', 'lowerRight', 4, 3, 3), g('virus', 'right', 7, 10, 0.3), g('hijacker', 'lowerLeft', 3, 16, 1), g('virus', 'midLeft', 6, 8, 0.3)] },
      { title: 'Fever', hint: 'Everything at once. The brain cannot take many hits.',
        groups: [g('saureus', 'lowerLeft', 5, 1, 2.6), g('hijacker', 'left', 2, 3, 1), g('virus', 'lowerRight', 7, 6, 0.3), g('hijacker', 'right', 3, 9, 1), g('virus', 'left', 5, 20, 0.3), g('saureus', 'midLeft', 3, 12, 3)] },
      { title: 'Boss: meningococcus', hint: 'A giant N. meningitidis that IgA cannot slow. IgG aimed at N. meningitidis hits it three times as hard.',
        groups: [g('meningo', 'lowerLeft', 1, 2, 1), g('virus', 'right', 6, 10, 0.3), g('saureus', 'midLeft', 3, 6, 3)] },
    ],
  },
  {
    id: 'liver', title: 'The Liver', organ: 'Liver', tagline: 'Everything from the gut comes here first.',
    twist: 'The portal vein brings a long column of gut bacteria, but the liver regrows: it regains health after every wave.',
    hp: 24, startEnergy: 320, cells: 2, regenPerWave: 3,
    startingNodes: [{ vessel: 'portalLeft', site: 0, type: 'igm' }, { vessel: 'arteryLower', site: 1, type: 'igm' }],
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
      { title: 'From the gut', hint: 'Bacteria come up the long portal vein. Line it with nodes.',
        groups: [g('saureus', 'portal', 6, 1, 3), g('virus', 'upperRight', 5, 10, 0.35)] },
      { title: 'Two supplies', hint: 'The gut keeps sending bacteria; viruses arrive by the artery and from above.',
        groups: [g('saureus', 'portal', 6, 1, 2.6), g('virus', 'artery', 7, 6, 0.3), g('virus', 'upper', 5, 14, 0.3), g('saureus', 'upperRight', 3, 4, 3)] },
      { title: 'Abscess', hint: 'A heavy bacterial load on the portal vein and below.',
        groups: [g('saureus', 'portal', 8, 1, 2.4), g('saureus', 'lower', 4, 4, 3), g('virus', 'artery', 8, 12, 0.3), g('virus', 'upperRight', 6, 16, 0.3)] },
      { title: 'Hepatitis', hint: 'Hijackers from the artery and above while the gut keeps up the pressure.',
        groups: [g('saureus', 'portal', 8, 1, 2.2), g('hijacker', 'artery', 4, 5, 1), g('virus', 'lower', 8, 8, 0.3), g('hijacker', 'upper', 3, 14, 1), g('saureus', 'upperRight', 4, 6, 3)] },
      { title: 'Boss: the hepatitis giant', hint: 'It regrows as it climbs the portal vein. Stack enough damage along the vein to outpace it.',
        groups: [g('hepatitis', 'portal', 1, 2, 1), g('virus', 'artery', 6, 10, 0.3), g('virus', 'upperRight', 5, 16, 0.3)] },
    ],
  },
  {
    id: 'kidney', title: 'The Kidney', organ: 'Kidney', tagline: 'The filter, and the last stand.',
    twist: 'Filtration: pathogens crawl through the last stretch of every vessel, so nodes near the kidney get extra time. The hardest waves.',
    hp: 20, startEnergy: 590, cells: 2,
    filtration: { fraction: 0.28, factor: 0.6 },
    startingNodes: [{ vessel: 'leftUpper', site: 2, type: 'igm' }, { vessel: 'rightUpper', site: 2, type: 'igm' }],
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
      { title: 'Filtration', hint: 'Pathogens slow down near the kidney (the shaded stretch). Nodes there fire for longer.',
        groups: [g('saureus', 'left', 5, 1, 3.2), g('virus', 'upper', 7, 6, 0.3), g('virus', 'topLeft', 5, 12, 0.3)] },
      { title: 'Stones and swarms', hint: 'Viruses on the right, bacteria below, hijackers behind them on the left.',
        groups: [g('virus', 'right', 8, 2, 0.3), g('saureus', 'lower', 4, 1, 3), g('hijacker', 'left', 3, 12, 1), g('saureus', 'topLeft', 3, 4, 3)] },
      { title: 'Infection spreads', hint: 'Hijackers on two vessels. Only dilate where you can keep your cells safe.',
        groups: [g('saureus', 'right', 5, 1, 2.6), g('hijacker', 'upper', 4, 3, 1), g('virus', 'left', 8, 6, 0.3), g('hijacker', 'lower', 4, 10, 1), g('virus', 'topLeft', 6, 14, 0.3)] },
      { title: 'Sepsis', hint: 'The final wave: every vessel, every kind of pathogen.',
        groups: [g('saureus', 'left', 4, 1, 3), g('saureus', 'right', 4, 2, 3), g('virus', 'upper', 8, 6, 0.3), g('hijacker', 'left', 3, 10, 1), g('hijacker', 'right', 3, 14, 1), g('virus', 'lower', 6, 18, 0.3), g('hijacker', 'upper', 3, 22, 1), g('virus', 'topLeft', 6, 8, 0.3)] },
      { title: 'Boss: sepsis', hint: 'A giant hijacker infects every white cell it touches. Do not dilate its vessel unless your nodes can kill it first.',
        groups: [g('sepsis', 'upper', 1, 2, 1), g('saureus', 'left', 4, 4, 3), g('virus', 'right', 6, 12, 0.3), g('saureus', 'topLeft', 3, 8, 3)] },
    ],
  },
];

export const NODE_TYPES: NodeType[] = ['igm', 'igg', 'iga', 'ige'];
