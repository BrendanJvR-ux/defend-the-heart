// The guided first wave on the heart: seven steps, each waiting for the player. No DOM here: the screen
// asks what to show (tutorialText, tutorialTarget) and whether time should stop (tutorialHolds).
import { VESSELS, SITES, type Vec } from './level';
import { pulseTargets, nodeAt, type State } from './sim';
import type { VesselId } from './config';

export type TutStep = 'welcome' | 'build' | 'start' | 'open' | 'no' | 'pulse' | 'done';
export interface Tutorial { step: TutStep | null; baseNodes: number }

/** The vessel the tutorial teaches on (the heart's wave 1 comes up it). */
const VESSEL: VesselId = 'left';

export function startTutorial(s: State): Tutorial { return { step: 'welcome', baseNodes: s.nodes.length }; }

/** Steps the player finishes with a button rather than by playing. */
export const manualStep = (t: Tutorial) => t.step === 'welcome' || t.step === 'no' || t.step === 'done';

/** Next / Got it / Close. */
export function tutorialNext(t: Tutorial) {
  if (t.step === 'welcome') t.step = 'build';
  else if (t.step === 'no') t.step = 'pulse';
  else if (t.step === 'done') t.step = null;
}

/** A pathogen well on its way in (the heart's wave-1 nodes kill most before halfway, so a third of the way). */
const OPEN_AT = 0.3;
const halfwayIn = (s: State) => s.pathogens.some((p) => p.hp > 0 && p.s >= VESSELS[p.vessel].length * OPEN_AT);

/** Move on when the player has done what the current step asks. Call every frame. */
export function tutorialTick(t: Tutorial, s: State) {
  switch (t.step) {
    case 'build': if (s.nodes.length > t.baseNodes) t.step = 'start'; break;
    case 'start': if (s.phase !== 'prep') t.step = 'open'; break;
    case 'open': if (s.open.length) t.step = 'no'; else if (s.phase !== 'combat') t.step = 'done'; break;
    case 'pulse': if (s.pulsesLeft <= 0 || s.phase !== 'combat') t.step = 'done'; break;
  }
}

/** Should time stand still? Only at the two moments that can't wait: opening a vessel, firing the pulse. */
export function tutorialHolds(t: Tutorial, s: State): boolean {
  if (s.phase !== 'combat') return false;
  if (t.step === 'open') return !s.open.length && halfwayIn(s);
  // wave 1's bacteria come one at a time, so one in range is enough to teach the pulse
  if (t.step === 'pulse') return s.pulsesLeft > 0 && pulseTargets(s).length >= 1;
  return false;
}

export type TutTarget = { site?: string; at?: Vec; panel?: 'start' | 'no' | 'pulse' };

/** What the callout points at. */
export function tutorialTarget(t: Tutorial, s: State): TutTarget | null {
  switch (t.step) {
    case 'build': {
      const site = SITES.filter((x) => x.vessel === VESSEL && !nodeAt(s, x.id)).sort((a, b) => a.index - b.index)[1]
        ?? SITES.find((x) => !nodeAt(s, x.id));
      return site ? { site: site.id, at: { x: site.x, y: site.y } } : null;
    }
    case 'start': return { panel: 'start' };
    case 'open': {
      const lead = s.pathogens.filter((p) => p.hp > 0).sort((a, b) => b.s / VESSELS[b.vessel].length - a.s / VESSELS[a.vessel].length)[0];
      const v = lead?.vessel ?? VESSEL, ves = VESSELS[v], d = ves.length * 0.6;
      // a point on the vessel, a little ahead of the leading pathogen
      let i = 1; while (i < ves.cum.length - 1 && ves.cum[i] < d) i++;
      const a = ves.pts[i - 1], b = ves.pts[i], k = (d - ves.cum[i - 1]) / (ves.cum[i] - ves.cum[i - 1] || 1);
      return { at: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } };
    }
    case 'no': return { panel: 'no' };
    case 'pulse': return { panel: 'pulse' };
    default: return null;
  }
}

/** The callout's words for each step. */
export function tutorialText(t: Tutorial, s: State): { title: string; body: string; button?: string } | null {
  switch (t.step) {
    case 'welcome': return { title: 'Defend the heart', body: 'Pathogens travel up the vessels towards the heart. Every one that reaches it costs health. Stop them. You won\'t see what is coming until a wave starts.', button: 'Next' };
    case 'build': return { title: 'Place a lymph node', body: 'Every vessel starts with one free IgM lymph node. Add another: click the + marked here, beside the left vessel, and choose IgM. Lymph nodes fire antibodies at pathogens on their vessel.' };
    case 'start': return { title: 'Start the wave', body: 'Press Start wave when you are ready. You can build more between waves.' };
    case 'open': return tutorialHolds(t, s)
      ? { title: 'Open the vessel', body: 'The bacteria are on their way in. Click the left vessel to open it: your white cells go out along it to fight. (Time waits for you.)' }
      : { title: 'Watch them come', body: 'Bacteria are coming up the left vessel. When they are a third of the way in, you will open it for your white cells.' };
    case 'no': return { title: 'NO keeps it open', body: 'Holding a vessel open uses NO (the bar under the heart and in the panel). Click the vessel again to close it when it is clear, and NO refills. Later you can open more than one vessel: your white cells split between them, and each drains NO.', button: 'Got it' };
    case 'pulse': return tutorialHolds(t, s)
      ? { title: 'Fire the immune pulse', body: 'A white cell is touching a pathogen. Press Immune pulse (or Space): each white cell touching a pathogen destroys it, and dies doing it (you get it back next wave). Once per wave, so later on, save it for something tough. (Time waits for you.)' }
      : { title: 'The immune pulse', body: 'Once per wave, each white cell can give its life to destroy the pathogen it is touching. Wait until a pathogen reaches them.' };
    case 'done': return { title: 'You have the basics', body: 'Clear the wave. Between waves, place more nodes; wave 3 shows you IgG, which hits a chosen bacterium three times as hard (at most two IgG per bacterium). Click any pathogen to see what it is.', button: 'Close' };
    default: return null;
  }
}
