// ─────────────────────────────────────────────────────────────────────────────
//  DEFEND THE HEART · tuning. Every number that shapes play lives here.
// ─────────────────────────────────────────────────────────────────────────────

export type VesselId = 'left' | 'right' | 'lower' | 'upper';
export type PathogenType = 'bacterium' | 'virus' | 'hijacker' | 'infected';
export type NodeType = 'igm' | 'igg' | 'iga';

export interface PathogenStats {
  name: string;
  plural: string;
  hp: number;
  /** Map units per second, carried with the blood flow towards the heart. */
  speed: number;
  /** Flat damage removed from every antibody hit (IgG strips it). White cells and the pulse ignore armour. */
  armour: number;
  /** Heart health lost when it reaches the heart. */
  heartDamage: number;
  /** Damage per second dealt to a white cell in contact. */
  contactDps: number;
  /** Energy earned for destroying it. */
  bounty: number;
  /** Hijacker viruses enter a white cell they touch and turn it into an infected cell. */
  infects?: boolean;
}

export interface NodeStats {
  name: string;
  short: string;
  cost: number;
  /** Damage per antibody before armour. */
  damage: number;
  cooldown: number;
  range: number;
  shotSpeed: number;
  /** IgG: armour removed from the target for a while. */
  shred?: number;
  shredSeconds?: number;
  /** IgA: target speed multiplied by this for a while. */
  slow?: number;
  slowSeconds?: number;
  blurb: string;
}

export interface WaveGroup { type: PathogenType; vessel: VesselId; count: number; start: number; interval: number }
export interface WaveDef { title: string; hint: string; groups: WaveGroup[] }

export const CONFIG = {
  heartHp: 20,

  /** Energy pays for lymph nodes. */
  startEnergy: 120,
  waveClearEnergy: (wave: number) => 40 + 10 * wave,

  vesselRestWidth: 30,
  vesselDilatedWidth: 64,
  dilateRate: 1.8,

  /** Lymph nodes already in place at the start (vessel, site index along it). */
  startingNodes: [
    { vessel: 'left', site: 1, type: 'igm' },
    { vessel: 'right', site: 1, type: 'igm' },
  ] as { vessel: VesselId; site: number; type: NodeType }[],

  nodes: {
    igm: { name: 'IgM lymph node', short: 'IgM', cost: 60, damage: 15, cooldown: 0.9, range: 175, shotSpeed: 520, blurb: 'High damage. No slow, no armour reduction.' },
    igg: { name: 'IgG lymph node', short: 'IgG', cost: 50, damage: 7, cooldown: 0.8, range: 175, shotSpeed: 560, shred: 5, shredSeconds: 4, blurb: 'Lower damage, but strips armour so every other hit lands harder.' },
    iga: { name: 'IgA lymph node', short: 'IgA', cost: 50, damage: 6, cooldown: 0.7, range: 175, shotSpeed: 560, slow: 0.5, slowSeconds: 2.2, blurb: 'Lower damage, no armour reduction, but slows what it hits.' },
  } as Record<NodeType, NodeStats>,

  whiteCell: {
    startingCount: 2,
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

  pathogens: {
    bacterium: { name: 'Bacterium', plural: 'Bacteria', hp: 70, speed: 30, armour: 5, heartDamage: 3, contactDps: 3, bounty: 7 },
    virus: { name: 'Virus', plural: 'Viruses', hp: 14, speed: 74, armour: 1, heartDamage: 1, contactDps: 2, bounty: 2 },
    hijacker: { name: 'Hijacker virus', plural: 'Hijacker viruses', hp: 22, speed: 58, armour: 1, heartDamage: 1, contactDps: 0, bounty: 4, infects: true },
    infected: { name: 'Infected white cell', plural: 'Infected white cells', hp: 55, speed: 46, armour: 2, heartDamage: 3, contactDps: 4, bounty: 6 },
  } as Record<PathogenType, PathogenStats>,

  waves: [
    {
      title: 'First infection',
      hint: 'Bacteria come up the left vessel. Dilate it so your white cells can meet them.',
      groups: [{ type: 'bacterium', vessel: 'left', count: 5, start: 1, interval: 3.4 }],
    },
    {
      title: 'Two fronts',
      hint: 'A fast viral cluster on the right, a few bacteria from below. Place a lymph node where you will not send your white cells.',
      groups: [
        { type: 'virus', vessel: 'right', count: 6, start: 4, interval: 0.35 },
        { type: 'bacterium', vessel: 'lower', count: 3, start: 1, interval: 4 },
        { type: 'virus', vessel: 'right', count: 5, start: 16, interval: 0.35 },
      ],
    },
    {
      title: 'Armoured bacteria',
      hint: 'Bacterial capsules blunt IgM. An IgG node strips their armour.',
      groups: [
        { type: 'bacterium', vessel: 'upper', count: 4, start: 1, interval: 3.4 },
        { type: 'bacterium', vessel: 'left', count: 3, start: 8, interval: 3.5 },
        { type: 'virus', vessel: 'lower', count: 5, start: 12, interval: 0.4 },
      ],
    },
    {
      title: 'Swarm',
      hint: 'Fast viruses on every side. IgA slows them long enough for the rest to land.',
      groups: [
        { type: 'virus', vessel: 'upper', count: 6, start: 2, interval: 0.35 },
        { type: 'virus', vessel: 'right', count: 7, start: 8, interval: 0.3 },
        { type: 'bacterium', vessel: 'lower', count: 4, start: 4, interval: 3 },
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
        { type: 'bacterium', vessel: 'right', count: 5, start: 1, interval: 2.6 },
        { type: 'virus', vessel: 'upper', count: 8, start: 6, interval: 0.3 },
        { type: 'bacterium', vessel: 'lower', count: 3, start: 4, interval: 3 },
        { type: 'bacterium', vessel: 'left', count: 3, start: 14, interval: 3 },
        { type: 'hijacker', vessel: 'upper', count: 3, start: 20, interval: 1.2 },
      ],
    },
  ] as WaveDef[],
};

export const TOTAL_WAVES = CONFIG.waves.length;
export const VESSEL_NAMES: Record<VesselId, string> = { left: 'Left vessel', right: 'Right vessel', lower: 'Lower vessel', upper: 'Upper vessel' };
export const NODE_TYPES: NodeType[] = ['igm', 'igg', 'iga'];
