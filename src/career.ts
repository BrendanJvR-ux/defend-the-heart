// The career: gold, purchases, organs cleared and the game in progress, saved in one versioned
// localStorage entry. No DOM here, so it is tested directly; the store is passed in.
import { CONFIG, LEVELS, BACTERIA, DIFFICULTIES, type BacteriumType, type Difficulty, type NodeType, type PathogenType } from './config';
import type { State } from './sim';

/** Things gold can buy (Stage 3 prices them). */
export type UpgradeId =
  | 'dmg-igm' | 'dmg-igg' | 'dmg-iga' | 'dmg-ige'
  | `target-${Exclude<BacteriumType, 'saureus'>}`
  | 'broad' | 'no' | 'extraNode' | 'cheapFirst';

/** The shop: what each upgrade is called, does and costs per level. S. aureus is always unlocked. */
export const UPGRADES: Record<UpgradeId, { name: string; blurb: string; prices: number[] }> = {
  'dmg-igm': { name: 'IgM damage', blurb: '+15% damage for every IgM node, per level.', prices: [80, 160, 240] },
  'dmg-igg': { name: 'IgG damage', blurb: '+15% damage for every IgG node, per level.', prices: [80, 160, 240] },
  'dmg-iga': { name: 'IgA damage', blurb: '+15% damage for every IgA node, per level.', prices: [80, 160, 240] },
  'dmg-ige': { name: 'IgE damage', blurb: '+15% damage for every IgE node, per level.', prices: [80, 160, 240] },
  'target-spneumo': { name: 'IgG target: S. pneumoniae', blurb: 'Aim IgG at pneumococci (Gram+ cocci).', prices: [120] },
  'target-listeria': { name: 'IgG target: Listeria', blurb: 'Aim IgG at Listeria (Gram+ rods).', prices: [120] },
  'target-nmening': { name: 'IgG target: N. meningitidis', blurb: 'Aim IgG at meningococci (Gram− cocci).', prices: [120] },
  'target-ecoli': { name: 'IgG target: E. coli', blurb: 'Aim IgG at E. coli (Gram− rods).', prices: [120] },
  'target-kpneumo': { name: 'IgG target: Klebsiella', blurb: 'Aim IgG at Klebsiella (Gram− rods).', prices: [120] },
  'target-mtb': { name: 'IgG target: M. tuberculosis', blurb: 'Aim IgG at M. tuberculosis (acid-fast rods, counted with the Gram+).', prices: [120] },
  'target-hpylori': { name: 'IgG target: H. pylori', blurb: 'Aim IgG at H. pylori (Gram− curved rods).', prices: [120] },
  'target-salmonella': { name: 'IgG target: Salmonella', blurb: 'Aim IgG at Salmonella (Gram− rods).', prices: [120] },
  'target-spyogenes': { name: 'IgG target: S. pyogenes', blurb: 'Aim IgG at S. pyogenes (Gram+ cocci in chains).', prices: [120] },
  'target-paeruginosa': { name: 'IgG target: Pseudomonas', blurb: 'Aim IgG at Pseudomonas (Gram− rods).', prices: [120] },
  'target-chlamydia': { name: 'IgG target: Chlamydia', blurb: 'Aim IgG at Chlamydia (Gram− coccoid).', prices: [120] },
  broad: { name: 'Broad IgG', blurb: 'An IgG node can be made broad: it hits every bacterium of its target\'s Gram stain as hard as one of the same shape (×2.5). A broad node costs 60 energy.', prices: [400] },
  no: { name: 'More NO', blurb: '+20 NO capacity, per level.', prices: [100, 200] },
  extraNode: { name: 'Extra starting node', blurb: 'Every organ starts with one more IgM node already placed.', prices: [150] },
  cheapFirst: { name: 'Cheaper first node', blurb: 'The first node you place in each build phase costs half.', prices: [150] },
};

/** What the career's upgrades do in play. */
export interface Perks {
  /** Damage multiplier per node type. */
  dmg: Record<NodeType, number>;
  /** IgG targets that can be chosen. */
  targets: BacteriumType[];
  broad: boolean;
  /** The career's difficulty mode. */
  mode: Difficulty;
  noMax: number;
  extraNode: boolean;
  cheapFirst: boolean;
}
export const NO_PERKS: Perks = { dmg: { igm: 1, igg: 1, iga: 1, ige: 1 }, targets: ['saureus'], broad: false, mode: 'normal', noMax: CONFIG.no.max, extraNode: false, cheapFirst: false };

export function perksOf(c: Career): Perks {
  const lvl = (id: UpgradeId) => c.bought[id] ?? 0;
  const dmg = (t: NodeType) => Math.round((1 + 0.15 * lvl(`dmg-${t}` as UpgradeId)) * 100) / 100;
  return {
    dmg: { igm: dmg('igm'), igg: dmg('igg'), iga: dmg('iga'), ige: dmg('ige') },
    targets: BACTERIA.filter((b) => b === 'saureus' || lvl(`target-${b}` as UpgradeId) > 0),
    broad: lvl('broad') > 0, mode: c.difficulty, noMax: CONFIG.no.max + 20 * lvl('no'), extraNode: lvl('extraNode') > 0, cheapFirst: lvl('cheapFirst') > 0,
  };
}

/** The bacteria an organ's waves bring (bosses counted as their species), in order of first appearance. */
export function organBacteria(level: number): BacteriumType[] {
  const out: BacteriumType[] = [];
  for (const w of LEVELS[level].waves) for (const g of w.groups) {
    const sp = CONFIG.pathogens[g.type].taxon?.species;
    if (sp && !out.includes(sp)) out.push(sp);
  }
  return out;
}

/** An organ's bacteria that this career has no IgG target for yet. */
export const missingTargets = (level: number, perks: Perks): BacteriumType[] => organBacteria(level).filter((b) => !perks.targets.includes(b));

/** Gold for winning organ `level` (0-based) with `healthLeft`: full on the first clear, a quarter on a replay, scaled
 *  by the difficulty. */
export function goldFor(level: number, healthLeft: number, firstClear: boolean, mode: Difficulty = 'normal'): number {
  const full = Math.round((70 * (level + 1) + 4 * healthLeft) * CONFIG.difficulty[mode].gold);
  return firstClear ? full : Math.floor(full / 4);
}

export function buyCheck(c: Career, id: UpgradeId): { ok: boolean; reason: string; price: number } {
  const prices = UPGRADES[id].prices, have = c.bought[id] ?? 0;
  if (have >= prices.length) return { ok: false, reason: 'Already at the top level.', price: 0 };
  if (c.gold < prices[have]) return { ok: false, reason: 'Not enough gold.', price: prices[have] };
  return { ok: true, reason: '', price: prices[have] };
}
export function buy(c: Career, id: UpgradeId): { ok: boolean; reason: string } {
  const chk = buyCheck(c, id);
  if (!chk.ok) return { ok: false, reason: chk.reason };
  c.gold -= chk.price;
  c.bought[id] = (c.bought[id] ?? 0) + 1;
  return { ok: true, reason: '' };
}

/** A build phase, enough to put the player back where they were. */
export interface RunSave {
  level: number; wave: number; heartHp: number; energy: number; no: number;
  nodes: { site: string; type: NodeType; targets: BacteriumType[]; wavesFought: number; broad?: boolean; paid?: number; discounted?: boolean }[];
  /** IgG targets borrowed for this organ. */
  borrowed?: BacteriumType[];
  /** Liver: where the gallbladder's bile fell (it has burst if any). */
  bile?: { x: number; y: number }[];
  /** An endless run: which stage this organ is (absent: an ordinary organ). */
  stage?: number;
  /** White cells bought with gold for this organ. */
  extraCells?: number;
  /** Infections lodged in the organ, by kind. */
  lodged?: Partial<Record<PathogenType, number>>;
  /** Saved since every vessel started with a free IgM (older saves get theirs when they are continued). */
  freeNodes?: boolean;
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
  /** The heart's guided first wave has been finished or skipped. */
  tutorialSeen: boolean;
  /** One-time tips already shown (each new rule is explained once, the first time it matters). */
  tips: string[];
  /** The difficulty mode, chosen when the career began. */
  difficulty: Difficulty;
  /** Endless: your best runs at each difficulty, furthest first. */
  endless: Partial<Record<Difficulty, EndlessRun[]>>;
}

/** One endless run on the leaderboard: stages (organs) cleared, waves into the stage it fell on, and the date, so a
 *  board reads as a history. */
export interface EndlessRun { stages: number; waves: number; date: string }

/** Where things are kept. localStorage, or a stand-in in tests. */
export interface KV { get(k: string): string | null; set(k: string, v: string): void }

export const SAVE_KEY = 'dth-career-v1';
/** An unreadable (or newer) save is copied here before a fresh career replaces it, so it is never lost. */
export const BACKUP_KEY = 'dth-career-unreadable';

export function freshCareer(): Career {
  const n = LEVELS.length;
  return { version: 1, gold: 0, cleared: Array(n).fill(false), best: Array(n).fill(0), bought: {}, run: null, tutorialSeen: false, tips: [], difficulty: 'normal', endless: {} };
}

const safeGet = (kv: KV, k: string) => { try { return kv.get(k); } catch { return null; } };
const safeSet = (kv: KV, k: string, v: string) => { try { kv.set(k, v); } catch { /* no storage: this visit only */ } };

export function loadCareer(kv: KV): Career {
  const raw = safeGet(kv, SAVE_KEY);
  if (raw != null) {
    const c = parse(raw);
    if (c) return c;
    // unreadable, or from a newer version: keep it aside (beside any kept before), play on with a fresh career
    keepAside(kv, raw);
    return freshCareer();
  }
  // older saves kept only how many organs were unlocked (one more than cleared)
  const c = freshCareer();
  const unlocked = Number(safeGet(kv, 'dth-unlocked'));
  if (Number.isFinite(unlocked)) for (let i = 0; i < Math.min(LEVELS.length, unlocked - 1); i++) c.cleared[i] = true;
  return c;
}

/** Copy an unreadable save to the first free backup slot (dth-career-unreadable, -2, -3 …), unless it is already kept. */
function keepAside(kv: KV, raw: string) {
  for (let i = 1; i <= 20; i++) {
    const key = i === 1 ? BACKUP_KEY : `${BACKUP_KEY}-${i}`, have = safeGet(kv, key);
    if (have === raw) return;
    if (have == null) { safeSet(kv, key, raw); return; }
  }
}

export function saveCareer(kv: KV, c: Career): void { safeSet(kv, SAVE_KEY, JSON.stringify(c)); }

// ── Backup: the whole career as one code to copy, and back again on another device or browser ──
const CODE_PREFIX = 'DTH1.';
/** The career as a code: a prefix and the save, base64 (letters, digits, + / =), safe to paste anywhere. */
export function exportCareer(c: Career): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return CODE_PREFIX + btoa(bin);
}
/** A career from a code made by `exportCareer` (spaces and line breaks ignored); null if it is not one. */
export function importCareer(code: string): Career | null {
  const t = code.replace(/\s+/g, '');
  if (!t.startsWith(CODE_PREFIX)) return null;
  try {
    const bin = atob(t.slice(CODE_PREFIX.length)), bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

/** Read a stored career, filling in anything missing; null if it is not a version-1 career. */
function parse(raw: string): Career | null {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object' || (v as { version?: unknown }).version !== 1) return null;
  const o = v as Partial<Career>, c = freshCareer();
  if (typeof o.gold === 'number' && o.gold >= 0) c.gold = Math.floor(o.gold);
  if (Array.isArray(o.cleared)) o.cleared.forEach((x, i) => { if (i < c.cleared.length) c.cleared[i] = x === true; });
  if (Array.isArray(o.best)) o.best.forEach((x, i) => { if (i < c.best.length && typeof x === 'number') c.best[i] = x; });
  // only known upgrades, at whole-number levels, capped at the top level
  // dual-target IgG became broad IgG: a career that bought the one has the other
  if (o.bought && typeof o.bought === 'object' && (o.bought as Record<string, unknown>).dual) c.bought.broad = 1;
  if (o.bought && typeof o.bought === 'object') for (const [k, n] of Object.entries(o.bought)) {
    if (!Object.prototype.hasOwnProperty.call(UPGRADES, k) || !Number.isInteger(n) || (n as number) < 1) continue;
    c.bought[k as UpgradeId] = Math.min(n as number, UPGRADES[k as UpgradeId].prices.length);
  }
  c.run = validRun(o.run) ? o.run : null;
  // a run from the old one-organ endless (it had no stages) can't be continued in the endless of organ after organ
  if (c.run && (c.run as { endless?: unknown }).endless === true && !c.run.stage) c.run = null;
  // older saves had no flag: a player who has cleared an organ has no need of the tutorial
  c.tutorialSeen = typeof o.tutorialSeen === 'boolean' ? o.tutorialSeen : c.cleared.some(Boolean);
  c.tips = Array.isArray(o.tips) ? o.tips.filter((x): x is string => typeof x === 'string').slice(0, 50) : [];
  c.difficulty = DIFFICULTIES.includes(o.difficulty as Difficulty) ? o.difficulty as Difficulty : 'normal';
  // endless boards, one per difficulty: whole non-negative counts and a date (boards from the old one-organ endless,
  // kept by organ, don't carry over)
  if (o.endless && typeof o.endless === 'object') for (const d of DIFFICULTIES) {
    const runs = (o.endless as Record<string, unknown>)[d];
    if (!Array.isArray(runs)) continue;
    const ok = (r: EndlessRun) => !!r && Number.isInteger(r.stages) && r.stages >= 0 && Number.isInteger(r.waves) && r.waves >= 0 && typeof r.date === 'string';
    c.endless[d] = runs.filter(ok).map((r) => ({ stages: r.stages, waves: r.waves, date: r.date.slice(0, 10) })).sort(byDistance).slice(0, CONFIG.endless.boardSize);
  }
  return c;
}

function validRun(r: unknown): r is RunSave {
  if (!r || typeof r !== 'object') return false;
  const x = r as RunSave;
  return Number.isInteger(x.level) && x.level >= 0 && x.level < LEVELS.length
    && [x.wave, x.heartHp, x.energy, x.no].every((n) => typeof n === 'number' && Number.isFinite(n)) && Array.isArray(x.nodes)
    && x.nodes.every((n) => n && typeof n.site === 'string' && typeof n.type === 'string' && Array.isArray(n.targets)
      && n.targets.every((b) => (BACTERIA as string[]).includes(b)))
    && (x.borrowed === undefined || (Array.isArray(x.borrowed) && x.borrowed.every((b) => (BACTERIA as string[]).includes(b))))
    // the newer fields: whole, non-negative counts where present
    && [x.stage, x.extraCells].every((n) => n === undefined || (Number.isInteger(n) && n >= 0))
    && (x.lodged === undefined || (typeof x.lodged === 'object' && x.lodged !== null && Object.values(x.lodged).every((n) => Number.isInteger(n) && (n as number) >= 0)));
}

/** Furthest first: more stages, then more waves into the next. */
const byDistance = (a: EndlessRun, b: EndlessRun) => b.stages - a.stages || b.waves - a.waves;

/** Endless opens once the last organ, the eye, has been cleared. */
export const endlessOpen = (c: Career) => !!c.cleared[LEVELS.length - 1];

/** How many organs can be played: every cleared one, and the next. */
export function unlockedCount(c: Career): number {
  const cleared = c.cleared.filter(Boolean).length;
  return Math.min(LEVELS.length, cleared + 1);
}

export function snapshot(s: State): RunSave {
  return {
    level: s.level, wave: s.wave, heartHp: s.heartHp, energy: s.energy, no: s.no,
    nodes: s.nodes.map((n) => ({ site: n.site, type: n.type, targets: [...n.targets], wavesFought: n.wavesFought, ...(n.broad ? { broad: true } : {}), ...(n.paid != null ? { paid: n.paid, discounted: !!n.discounted } : {}) })),
    borrowed: [...s.borrowed],
    bile: s.bile.map((p) => ({ x: p.x, y: p.y })),
    freeNodes: true,
    ...(s.stage ? { stage: s.stage } : {}),
    ...(s.extraCells ? { extraCells: s.extraCells } : {}),
    ...(Object.keys(s.lodged).length ? { lodged: { ...s.lodged } } : {}),
  };
}

/** Put a finished endless run on its difficulty's board (kept to the best `boardSize`). Returns its place (1 = best),
 *  or 0 if it didn't make the board. */
export function recordEndless(c: Career, stages: number, waves: number, date: string): number {
  const run = { stages, waves, date: date.slice(0, 10) };
  // a stable sort with the new run last: on a tie, the earlier run stays ahead
  const board = [...(c.endless[c.difficulty] ?? []), run].sort(byDistance);
  c.endless[c.difficulty] = board.slice(0, CONFIG.endless.boardSize);
  return c.endless[c.difficulty]!.indexOf(run) + 1;
}

/** Where the last endless run placed on its board (1 = best, 0 = off it), for the end screen. */
export let lastPlace = 0;

/** An organ was won or lost: record it, pay gold for a win and end the run. Returns the gold paid. In endless, a stage
 *  won pays a little gold and the run goes on (the caller starts the next stage); a stage lost ends the run, which
 *  goes on the leaderboard. */
export function onOrganEnd(c: Career, s: State, date = new Date().toISOString()): number {
  let paid = 0;
  if (s.endless) {
    if (s.phase === 'victory') {
      paid = Math.round(CONFIG.endless.goldPerStage * CONFIG.difficulty[c.difficulty].gold);
      c.gold += paid;
      // the run goes on: saved as the next stage's start, so leaving now and coming back carries on from there
      const k = s.stage + 1, next = LEVELS[(k - 1) % LEVELS.length];
      c.run = { level: (k - 1) % LEVELS.length, wave: 1, heartHp: next.hp, energy: Math.round(next.startEnergy * CONFIG.difficulty[c.difficulty].energy), no: s.perks.noMax, nodes: [], stage: k };
      return paid;
    }
    lastPlace = recordEndless(c, s.stage - 1, Math.max(0, s.wave - 1), date);
    c.run = null;
    return paid;
  }
  if (s.phase === 'victory') {
    paid = goldFor(s.level, s.heartHp, !c.cleared[s.level], c.difficulty);
    c.gold += paid;
    c.cleared[s.level] = true;
    c.best[s.level] = Math.max(c.best[s.level] ?? 0, s.heartHp);
  }
  c.run = null;
  return paid;
}
