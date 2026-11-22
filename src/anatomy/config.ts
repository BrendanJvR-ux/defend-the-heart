// ─────────────────────────────────────────────────────────────────────────────
//  DEFEND THE HEART · level one tuning. Every number that shapes play lives here.
// ─────────────────────────────────────────────────────────────────────────────

export type VesselId = 'left' | 'right';
export type PathogenType = 'bacterium' | 'virus';

export interface PathogenStats {
  name: string;
  plural: string;
  hp: number;
  /** Map units per second, carried with the blood flow towards the heart. */
  speed: number;
  /** Heart health lost when it reaches the heart. */
  heartDamage: number;
  /** Damage per second dealt to a white cell in contact. */
  contactDps: number;
}

export interface WaveGroup {
  type: PathogenType;
  vessel: VesselId;
  count: number;
  /** Seconds after the wave starts that the first one enters. */
  start: number;
  /** Seconds between each one. */
  interval: number;
}

export interface WaveDef { title: string; hint: string; groups: WaveGroup[] }

export const CONFIG = {
  heartHp: 20,

  /** Vessel lumen width at rest and fully dilated (map units), and how fast it changes (fraction per second). */
  vesselRestWidth: 32,
  vesselDilatedWidth: 68,
  dilateRate: 1.8,

  lymphNode: {
    /** Damage per antibody, seconds between shots, reach from the node's centre. */
    damage: 9,
    cooldown: 0.85,
    range: 180,
    shotSpeed: 520,
  },

  whiteCell: {
    /** How many white cells set out from the heart at the start of each wave. */
    startingCount: 2,
    hp: 60,
    /** Map units per second along the dilated vessel. */
    speed: 62,
    /** Recall speed at the end of a wave. */
    recallSpeed: 190,
    /** Contact attack: reach along the vessel and damage per second. */
    attackRange: 26,
    dps: 4,
    /** Where idle cells wait, as a fraction of the vessel from its entrance (1 = at the heart). */
    guardAt: 0.62,
    /** Cells never go further out than this fraction of the vessel (they fight under their lymph node's cover). */
    minReach: 0.4,
  },

  immunePulse: {
    perWave: 1,
    /** Radius around each white cell; only pathogens on that cell's vessel inside it are hit. */
    radius: 85,
    damage: 42,
    ringSeconds: 0.45,
  },

  pathogens: {
    bacterium: { name: 'Bacterium', plural: 'Bacteria', hp: 62, speed: 30, heartDamage: 3, contactDps: 3 },
    virus: { name: 'Virus', plural: 'Viruses', hp: 15, speed: 74, heartDamage: 1, contactDps: 2 },
  } as Record<PathogenType, PathogenStats>,

  waves: [
    {
      title: 'First infection',
      hint: 'Bacteria are coming up the left vessel. Dilate it so your white cells can meet them.',
      groups: [
        { type: 'bacterium', vessel: 'left', count: 5, start: 1, interval: 3.2 },
      ],
    },
    {
      title: 'Two fronts',
      hint: 'A few bacteria on the left, a fast viral cluster on the right. Which lymph node needs help?',
      groups: [
        { type: 'bacterium', vessel: 'left', count: 3, start: 1, interval: 4.5 },
        { type: 'virus', vessel: 'right', count: 5, start: 7, interval: 0.35 },
        { type: 'virus', vessel: 'right', count: 4, start: 17, interval: 0.35 },
      ],
    },
    {
      title: 'Pressure on both sides',
      hint: 'Both vessels at staggered times. Send the white cells where a lymph node cannot hold alone.',
      groups: [
        { type: 'bacterium', vessel: 'left', count: 3, start: 1, interval: 6 },
        { type: 'virus', vessel: 'right', count: 6, start: 6, interval: 0.3 },
        { type: 'bacterium', vessel: 'right', count: 3, start: 12, interval: 2.4 },
        { type: 'virus', vessel: 'left', count: 3, start: 20, interval: 0.4 },
        { type: 'virus', vessel: 'right', count: 5, start: 24, interval: 0.3 },
      ],
    },
  ] as WaveDef[],
};

export const TOTAL_WAVES = CONFIG.waves.length;
export const VESSEL_NAMES: Record<VesselId, string> = { left: 'Left vessel', right: 'Right vessel' };
