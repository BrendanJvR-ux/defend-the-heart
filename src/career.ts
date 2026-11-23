// The career: gold, purchases, organs cleared and the game in progress, saved in one versioned
// localStorage entry. No DOM here, so it is tested directly; the store is passed in.
import { LEVELS, BACTERIA, type BacteriumType, type NodeType } from './config';
import type { State } from './sim';

/** Things gold can buy (Stage 3 prices them). */
export type UpgradeId =
  | 'dmg-igm' | 'dmg-igg' | 'dmg-iga' | 'dmg-ige'
  | `target-${Exclude<BacteriumType, 'saureus'>}`
  | 'dual' | 'no' | 'extraNode' | 'cheapFirst';

/** A build phase, enough to put the player back where they were. */
export interface RunSave {
  level: number; wave: number; heartHp: number; energy: number; no: number;
  nodes: { site: string; type: NodeType; targets: BacteriumType[]; wavesFought: number }[];
}

export interface Career {
  version: 1;
  gold: number;
  /** Per organ: cleared at least once. */
  cleared: boolean[];
  /** Per organ: the most organ health left on a win. */
  best: number[];
  /** Upgrade levels bought. */
  bought: Partial<Record<UpgradeId, number>>;
  /** The game in progress, saved at the start of each build phase; null when none. */
  run: RunSave | null;
}

/** Where things are kept. localStorage, or a stand-in in tests. */
export interface KV { get(k: string): string | null; set(k: string, v: string): void }

export const SAVE_KEY = 'dth-career-v1';
/** An unreadable (or newer) save is copied here before a fresh career replaces it, so it is never lost. */
export const BACKUP_KEY = 'dth-career-unreadable';

export function freshCareer(): Career {
  const n = LEVELS.length;
  return { version: 1, gold: 0, cleared: Array(n).fill(false), best: Array(n).fill(0), bought: {}, run: null };
}

const safeGet = (kv: KV, k: string) => { try { return kv.get(k); } catch { return null; } };
const safeSet = (kv: KV, k: string, v: string) => { try { kv.set(k, v); } catch { /* no storage: this visit only */ } };

export function loadCareer(kv: KV): Career {
  const raw = safeGet(kv, SAVE_KEY);
  if (raw != null) {
    const c = parse(raw);
    if (c) return c;
    // unreadable, or from a newer version: keep it aside, play on with a fresh career
    if (safeGet(kv, BACKUP_KEY) == null) safeSet(kv, BACKUP_KEY, raw);
    return freshCareer();
  }
  // older saves kept only how many organs were unlocked (one more than cleared)
  const c = freshCareer();
  const unlocked = Number(safeGet(kv, 'dth-unlocked'));
  if (Number.isFinite(unlocked)) for (let i = 0; i < Math.min(LEVELS.length, unlocked - 1); i++) c.cleared[i] = true;
  return c;
}

export function saveCareer(kv: KV, c: Career): void { safeSet(kv, SAVE_KEY, JSON.stringify(c)); }

/** Read a stored career, filling in anything missing; null if it is not a version-1 career. */
function parse(raw: string): Career | null {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object' || (v as { version?: unknown }).version !== 1) return null;
  const o = v as Partial<Career>, c = freshCareer();
  if (typeof o.gold === 'number' && o.gold >= 0) c.gold = Math.floor(o.gold);
  if (Array.isArray(o.cleared)) o.cleared.forEach((x, i) => { if (i < c.cleared.length) c.cleared[i] = x === true; });
  if (Array.isArray(o.best)) o.best.forEach((x, i) => { if (i < c.best.length && typeof x === 'number') c.best[i] = x; });
  if (o.bought && typeof o.bought === 'object') for (const [k, n] of Object.entries(o.bought)) if (typeof n === 'number') c.bought[k as UpgradeId] = n;
  c.run = validRun(o.run) ? o.run : null;
  return c;
}

function validRun(r: unknown): r is RunSave {
  if (!r || typeof r !== 'object') return false;
  const x = r as RunSave;
  return [x.level, x.wave, x.heartHp, x.energy, x.no].every((n) => typeof n === 'number') && Array.isArray(x.nodes)
    && x.nodes.every((n) => n && typeof n.site === 'string' && typeof n.type === 'string' && Array.isArray(n.targets)
      && n.targets.every((b) => (BACTERIA as string[]).includes(b)));
}

/** How many organs can be played: every cleared one, and the next. */
export function unlockedCount(c: Career): number {
  const cleared = c.cleared.filter(Boolean).length;
  return Math.min(LEVELS.length, cleared + 1);
}

export function snapshot(s: State): RunSave {
  return {
    level: s.level, wave: s.wave, heartHp: s.heartHp, energy: s.energy, no: s.no,
    nodes: s.nodes.map((n) => ({ site: n.site, type: n.type, targets: [...n.targets], wavesFought: n.wavesFought })),
  };
}

/** An organ was won or lost: record it and end the run. (Stage 3 also pays gold here.) */
export function onOrganEnd(c: Career, s: State): void {
  if (s.phase === 'victory') {
    c.cleared[s.level] = true;
    c.best[s.level] = Math.max(c.best[s.level] ?? 0, s.heartHp);
  }
  c.run = null;
}
