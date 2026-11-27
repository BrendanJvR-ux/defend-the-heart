// Organ mastery: three permanent seals per organ (clearing it, and two tactics suited to its vessels, waves and
// mechanic), plus the late-game Stewardship challenge. Each seal's words and its check live together, so what the
// player is told is what the game measures. Pure functions of the game state; awarded only when an organ is won.
import { CONFIG, LEVELS } from './config';
import { type State, totalWaves, levelDef } from './sim';

export interface Seal {
  id: string;
  title: string;
  /** What the player must do, as shown before and during a run. */
  goal: string;
  /** At the end of a won run: was it met? */
  met: (s: State) => boolean;
  /** Progress so far in this run, for the panel ('' when there is nothing to count yet). */
  progress?: (s: State) => string;
}

const lostIn = (s: State, ...waves: number[]) => waves.reduce((a, w) => a + (s.stats.waveLoss[w] ?? 0), 0);
const last = (s: State) => totalWaves(s);
const clearSeal = (title: string, goal: string): Seal => ({ id: 'clear', title, goal, met: () => true });
const count = (n: number, of: number, what: string) => `${Math.min(n, of)} of ${of} ${what}`;

/** Each organ's three seals: clearing it first, then its two tactics. */
export const SEALS: Record<string, Seal[]> = {
  heart: [
    clearSeal('First Defence', 'Clear all six waves of the heart.'),
    { id: 'rapid', title: 'Rapid Response', goal: 'In one run, send a held reserve cell down two different vessels and have it meet a pathogen in each.',
      met: (s) => s.stats.reserveHits.length >= 2, progress: (s) => count(s.stats.reserveHits.length, 2, 'vessels intercepted from the reserve') },
    { id: 'lean', title: 'Lean Defence', goal: 'Clear the heart without buying an extra white cell in that run.',
      met: (s) => s.stats.cellsBought === 0, progress: (s) => (s.stats.cellsBought ? 'A white cell was bought this run: not this time.' : 'No white cell bought so far.') },
  ],
  lungs: [
    clearSeal('Clear Breathing', 'Clear all five waves of the lungs.'),
    { id: 'secondWind', title: 'Second Wind', goal: 'Clear the lungs without buying NO: let the breaths refill it.',
      met: (s) => s.stats.noBought === 0, progress: (s) => (s.stats.noBought ? 'NO was bought this run: not this time.' : 'No NO bought so far.') },
    { id: 'clearAirways', title: 'Clear Airways', goal: 'Lose no health in the last wave, the mother virus.',
      met: (s) => lostIn(s, last(s)) === 0, progress: (s) => (s.wave < last(s) ? 'The last wave is still to come.' : `${lostIn(s, last(s))} health lost in the last wave.`) },
  ],
  liver: [
    clearSeal('Portal Guard', 'Clear all five waves of the liver.'),
    { id: 'gallbladder', title: 'Gallbladder Intact', goal: 'Clear the liver without its gallbladder bursting.',
      met: (s) => s.bile.length === 0, progress: (s) => (s.bile.length ? 'The gallbladder has burst: not this time.' : 'The gallbladder is intact.') },
    { id: 'fullRecovery', title: 'Full Recovery', goal: 'Finish with the liver at full health (it regrows 2 after each wave).',
      met: (s) => s.heartHp >= levelDef(s).hp, progress: (s) => `${s.heartHp} of ${levelDef(s).hp} health now.` },
  ],
  kidney: [
    clearSeal('Filtered', 'Clear all five waves of the kidney.'),
    { id: 'cleanFilter', title: 'Clean Filter', goal: 'Clear the kidney with no white cell infected by a hijacker.',
      met: (s) => s.stats.infections === 0, progress: (s) => (s.stats.infections ? `${s.stats.infections} cell${s.stats.infections === 1 ? '' : 's'} infected: not this time.` : 'No cell infected so far.') },
    { id: 'strongFinish', title: 'Strong Finish', goal: 'Lose no health in the last two waves, when the pathogens are toughest.',
      met: (s) => lostIn(s, last(s) - 1, last(s)) === 0, progress: (s) => (s.wave < last(s) - 1 ? 'The last two waves are still to come.' : `${lostIn(s, last(s) - 1, last(s))} health lost in the last two waves.`) },
  ],
  spleen: [
    clearSeal('Capsules Cleared', 'Clear all five waves of the spleen.'),
    { id: 'noReplacements', title: 'No Replacements', goal: 'Clear the spleen without it remaking a white cell.',
      met: (s) => s.stats.remade === 0, progress: (s) => (s.stats.remade ? `${s.stats.remade} cell${s.stats.remade === 1 ? '' : 's'} remade: not this time.` : 'No cell remade so far.') },
    { id: 'capsuleBreaker', title: 'Capsule Breaker', goal: 'Defeat 12 bacteria with the final blow from an IgG node.',
      met: (s) => s.stats.iggKills >= 12, progress: (s) => count(s.stats.iggKills, 12, 'bacteria finished by IgG') },
  ],
  marrow: [
    clearSeal('Marrow Held', 'Clear all five waves of the bone marrow.'),
    { id: 'noLodging', title: 'No Lodging', goal: 'Clear the marrow with no M. tuberculosis lodged in it.',
      met: (s) => !s.lodged.mtb, progress: (s) => (s.lodged.mtb ? `${s.lodged.mtb} lodged: not this time.` : 'None lodged so far.') },
    { id: 'fullMuster', title: 'Full Muster', goal: 'Have five white cells out on vessels at once (the marrow makes one more each wave).',
      met: (s) => s.stats.maxOut >= 5, progress: (s) => count(s.stats.maxOut, 5, 'cells out at once, at most') },
  ],
  stomach: [
    clearSeal('Acid Bath', 'Clear all five waves of the stomach.'),
    { id: 'noUlcers', title: 'No Ulcers', goal: 'Clear the stomach with no H. pylori lodged in it.',
      met: (s) => !s.lodged.hpylori, progress: (s) => (s.lodged.hpylori ? `${s.lodged.hpylori} lodged: not this time.` : 'None lodged so far.') },
    { id: 'acidTest', title: 'Acid Test', goal: 'Let the acid deal the final blow to 10 pathogens.',
      met: (s) => (s.stats.kills.organ ?? 0) >= 10, progress: (s) => count(s.stats.kills.organ ?? 0, 10, 'finished by the acid') },
  ],
  lymphnode: [
    clearSeal('Defences Held', 'Clear all five waves of the lymph node.'),
    { id: 'fullStrength', title: 'Full Strength', goal: 'Never let a lymph node weaken below 80% (each pathogen reaching the node weakens its vessel\'s nodes by 10%).',
      met: (s) => s.stats.minPower >= 0.8 - 1e-9, progress: (s) => `Weakest node so far: ${Math.round(s.stats.minPower * 100)}%.` },
    { id: 'pulseDiscipline', title: 'Pulse Discipline', goal: 'Clear the lymph node without using the immune pulse.',
      met: (s) => s.stats.pulses === 0, progress: (s) => (s.stats.pulses ? 'The pulse was used this run: not this time.' : 'No pulse used so far.') },
  ],
  skin: [
    clearSeal('Wounds Closed', 'Clear all five waves of the skin.'),
    { id: 'closeQuarters', title: 'Close Quarters', goal: 'Let white cells (by contact or the pulse) deal the final blow to 25 pathogens.',
      met: (s) => (s.stats.kills.cell ?? 0) + (s.stats.kills.pulse ?? 0) >= 25, progress: (s) => count((s.stats.kills.cell ?? 0) + (s.stats.kills.pulse ?? 0), 25, 'finished by white cells') },
    { id: 'fieldRations', title: 'Field Rations', goal: 'Clear the skin without buying NO or white cells.',
      met: (s) => s.stats.noBought + s.stats.cellsBought === 0, progress: (s) => (s.stats.noBought + s.stats.cellsBought ? 'Extras were bought this run: not this time.' : 'Nothing bought so far.') },
  ],
  eye: [
    clearSeal('Clear Sight', 'Clear all five waves of the eye.'),
    { id: 'readTheSigns', title: 'Read the Signs', goal: 'Buy a lab test before every wave of the eye.',
      met: (s) => s.stats.labWaves.length >= totalWaves(s), progress: (s) => count(s.stats.labWaves.length, totalWaves(s), 'waves tested') },
    { id: 'sharpEyed', title: 'Sharp-Eyed', goal: 'Finish with at most 3 health lost.',
      met: (s) => s.heartHp >= levelDef(s).hp - 3, progress: (s) => `${levelDef(s).hp - s.heartHp} health lost so far.` },
  ],
};

/** The Stewardship challenge, set by one late organ once the local antibiotic is unlocked. */
export const STEWARDSHIP = {
  organ: CONFIG.antibiotic.stewardship.organ,
  wave: CONFIG.antibiotic.stewardship.wave,
  title: 'Stewardship',
  goal: `Clear the organ. During the marked wave (wave ${CONFIG.antibiotic.stewardship.wave}), use exactly one antibiotic dose and defeat at least ${CONFIG.antibiotic.stewardship.kills} bacteria with that dose.`,
  met: (s: State) => s.stats.stewardDoses === 1 && s.stats.stewardKills >= CONFIG.antibiotic.stewardship.kills,
  progress: (s: State) => (s.wave < CONFIG.antibiotic.stewardship.wave ? 'The marked wave is still to come.'
    : `${s.stats.stewardDoses} dose${s.stats.stewardDoses === 1 ? '' : 's'} in the marked wave · ${s.stats.stewardKills} bacteri${s.stats.stewardKills === 1 ? 'um' : 'a'} defeated by ${s.stats.stewardDoses > 1 ? 'them' : 'it'} (${CONFIG.antibiotic.stewardship.kills} needed, with exactly one dose).`),
};
export const stewardshipOpen = (s: State) => !!s.perks.antibiotic && !s.endless && LEVELS[s.level].id === STEWARDSHIP.organ;

/** The seals a won campaign run earns (endless stages earn none). */
export function sealsEarned(s: State): string[] {
  if (s.phase !== 'victory' || s.endless) return [];
  return (SEALS[LEVELS[s.level].id] ?? []).filter((x) => x.met(s)).map((x) => x.id);
}
