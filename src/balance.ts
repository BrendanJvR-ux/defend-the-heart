// ─────────────────────────────────────────────────────────────────────────────
//  THE LAST WARD · all tuning lives here.
//  Wave composition, tower damage, pulse effects, rewards and costs.
// ─────────────────────────────────────────────────────────────────────────────

export type TowerType = 'bramble' | 'ember' | 'bell';
export type EnemyType = 'goblin' | 'wolf' | 'ram';
export type LaneId = 'mill' | 'king';

export interface TowerStats {
  name: string;
  cost: number;
  /** Attack damage per hit. */
  damage: number;
  /** Seconds between attacks. */
  cooldown: number;
  /** Attack range in map units. */
  range: number;
  /** Projectile speed in map units per second (0 = instant ring). */
  projectileSpeed: number;
  /** Splash radius for Ember coals; 0 = single target. */
  splash: number;
  pulseName: string;
  pulseText: string;
}

export interface EnemyStats {
  name: string;
  plural: string;
  hp: number;
  /** Map units per second. */
  speed: number;
  /** Flat damage removed from every tower hit (burning ignores armour). */
  armour: number;
  bounty: number;
  /** Castle health lost when it reaches the gate. */
  castleDamage: number;
}

export interface WaveGroup {
  type: EnemyType;
  lane: LaneId;
  count: number;
  /** Seconds after the wave starts that the first one appears. */
  start: number;
  /** Seconds between each one in the group. */
  interval: number;
}

export interface WaveDef {
  title: string;
  /** One-line lesson printed on the bookmark. */
  lesson: string;
  groups: WaveGroup[];
}

export interface PhaseRule {
  fromWave: number;
  /** Exactly this many distinct towers must be traced before the wave starts. */
  traces: number;
  /** Pulse charges available during the wave. */
  pulses: number;
}

export const BALANCE = {
  castleHp: 20,
  startGold: 40,
  startLeaves: 0,
  /** Gilded Leaves awarded for each wave survived. */
  leavesPerWave: 1,
  /** Gold awarded for surviving wave n. */
  waveClearGold: (wave: number) => 20 + 10 * wave,
  /** Binding one tower costs this many leaves. A bound tower gets its own free pulse every wave, with no trace. */
  bindCost: 3,

  /** The castle defends itself: a weak, short-range volley from the walls. */
  castle: { damage: 4, cooldown: 1.1, range: 140 },

  /** Trace / shared-pulse allocation by wave. Always pulses < traces < unbound built towers. */
  phaseRules: [
    { fromWave: 1, traces: 2, pulses: 1 },
    { fromWave: 4, traces: 3, pulses: 2 },
  ] as PhaseRule[],
  /** On this wave's preparation, a free tower is granted if the player still owns only three. */
  reinforcementWave: 4,
  reinforcementIfTowersAtMost: 3,

  /** How fast a pulse runs along its thread (map units per second). */
  pulseSpeed: 1600,

  startingTowers: [
    { foundation: 'f_mill', type: 'bramble' },
    { foundation: 'f_junction', type: 'ember' },
    { foundation: 'f_bridge', type: 'bell' },
  ] as { foundation: string; type: TowerType }[],

  towers: {
    bramble: {
      name: 'Bramble Tower', cost: 70, damage: 8, cooldown: 0.75, range: 185,
      projectileSpeed: 520, splash: 0,
      pulseName: 'Hedge', pulseText: 'Grows a hedge across the nearest road: enemies on that lane halt and bunch up.',
    },
    ember: {
      name: 'Ember Kiln', cost: 90, damage: 13, cooldown: 1.5, range: 175,
      projectileSpeed: 330, splash: 46,
      pulseName: 'Firebrand', pulseText: 'Sets the nearby road ablaze for several seconds. Burning ignores armour.',
    },
    bell: {
      name: 'Bell Spire', cost: 90, damage: 9, cooldown: 1.9, range: 135,
      projectileSpeed: 0, splash: 0,
      pulseName: 'Great Toll', pulseText: 'Knocks nearby enemies back along their own road and dazes them.',
    },
  } as Record<TowerType, TowerStats>,

  pulses: {
    /** Bramble hedge. */
    hedgeDuration: 6,
    /** Ember road fire. */
    fireDuration: 6,
    fireDps: 26,
    /** Road within this distance of the kiln catches fire. */
    fireRadius: 135,
    /** Bell knockback. */
    tollRadius: 175,
    tollKnockback: 170,
    tollDamage: 12,
    tollStun: 1.0,
  },

  enemies: {
    goblin: { name: 'Goblin', plural: 'Goblins', hp: 38, speed: 46, armour: 0, bounty: 4, castleDamage: 1 },
    wolf: { name: 'Wolf', plural: 'Wolves', hp: 26, speed: 100, armour: 0, bounty: 4, castleDamage: 1 },
    ram: { name: 'Armoured Ram', plural: 'Armoured Rams', hp: 170, speed: 27, armour: 5, bounty: 14, castleDamage: 4 },
  } as Record<EnemyType, EnemyStats>,

  /** Seconds of warning before a wolf pack enters (howl marker at the entrance). */
  wolfWarning: 4,

  waves: [
    {
      title: 'First Ink',
      lesson: 'Trace two towers, then pulse one when goblins gather.',
      groups: [
        { type: 'goblin', lane: 'mill', count: 7, start: 1, interval: 1.6 },
        { type: 'goblin', lane: 'king', count: 2, start: 16, interval: 2.5 },
      ],
    },
    {
      title: 'Two Roads',
      lesson: 'Goblins on the Mill Road first. A wolf pack runs the King’s Road late: hold your pulse?',
      groups: [
        { type: 'goblin', lane: 'mill', count: 9, start: 1, interval: 1.3 },
        { type: 'goblin', lane: 'king', count: 3, start: 6, interval: 2.4 },
        { type: 'wolf', lane: 'king', count: 7, start: 19, interval: 0.45 },
      ],
    },
    {
      title: 'The Ram',
      lesson: 'An armoured ram shrugs off thorns. Fire and the bell do not care for armour.',
      groups: [
        { type: 'goblin', lane: 'king', count: 6, start: 1, interval: 1.6 },
        { type: 'ram', lane: 'mill', count: 1, start: 3, interval: 0 },
        { type: 'goblin', lane: 'mill', count: 6, start: 5, interval: 1.5 },
        { type: 'wolf', lane: 'mill', count: 4, start: 18, interval: 0.6 },
      ],
    },
    {
      title: 'Royal Reinforcement',
      lesson: 'Three traces, two pulses. With five towers you can bind one in gold for a free pulse every wave.',
      groups: [
        { type: 'goblin', lane: 'mill', count: 10, start: 1, interval: 1.1 },
        { type: 'wolf', lane: 'mill', count: 5, start: 12, interval: 0.5 },
        { type: 'ram', lane: 'king', count: 1, start: 8, interval: 0 },
        { type: 'goblin', lane: 'king', count: 6, start: 10, interval: 1.4 },
      ],
    },
    {
      title: 'Pincer',
      lesson: 'Wolves on both roads at once. Spread your traces.',
      groups: [
        { type: 'goblin', lane: 'king', count: 7, start: 1, interval: 1.2 },
        { type: 'ram', lane: 'mill', count: 2, start: 2, interval: 6 },
        { type: 'goblin', lane: 'mill', count: 8, start: 4, interval: 1.2 },
        { type: 'wolf', lane: 'mill', count: 6, start: 20, interval: 0.45 },
        { type: 'wolf', lane: 'king', count: 6, start: 21, interval: 0.45 },
      ],
    },
    {
      title: 'The Last Ward',
      lesson: 'Rams first, then the great wolf pack on the King’s Road. Keep one pulse in hand.',
      groups: [
        { type: 'goblin', lane: 'mill', count: 12, start: 1, interval: 1.0 },
        { type: 'ram', lane: 'king', count: 2, start: 3, interval: 5 },
        { type: 'goblin', lane: 'king', count: 8, start: 6, interval: 1.2 },
        { type: 'ram', lane: 'mill', count: 1, start: 12, interval: 0 },
        { type: 'wolf', lane: 'mill', count: 6, start: 22, interval: 0.5 },
        { type: 'wolf', lane: 'king', count: 12, start: 32, interval: 0.35 },
      ],
    },
  ] as WaveDef[],
};

export const TOTAL_WAVES = BALANCE.waves.length;

export function phaseRule(wave: number): PhaseRule {
  let rule = BALANCE.phaseRules[0];
  for (const r of BALANCE.phaseRules) if (wave >= r.fromWave) rule = r;
  return rule;
}
