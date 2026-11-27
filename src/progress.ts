// Permanent progress, kept in this browser apart from the career (it survives new careers): organ mastery seals,
// the Pathogen Field Guide (kinds seen, and the methods each has been defeated by), Stewardship and the antibiotic
// treatment it unlocks. No DOM here; the store is passed in, as for the career.
import { CONFIG, LEVELS, type PathogenType } from './config';
import { type Career, type KV, exportCareer, importCareer } from './career';
import type { KillMethod } from './sim';

export interface Progress {
  version: 1;
  /** Per organ id: the seals earned ('clear' and the organ's two tactical seals). */
  seals: Record<string, string[]>;
  /** Pathogen kinds seen on the battlefield, and per kind the methods that have defeated one. */
  seen: PathogenType[];
  methods: Partial<Record<PathogenType, KillMethod[]>>;
  /** Stewardship earned: the Burst treatment can be chosen (`abxProfile`). */
  stewardship: boolean;
  abxProfile: 'standard' | 'burst';
}

export const PROGRESS_KEY = 'dth-progress-v1';
/** Methods the Field Guide records (acid and other organ effects don't count). */
export const GUIDE_METHODS: KillMethod[] = ['node', 'cell', 'pulse', 'antibiotic'];
export const METHOD_NAMES: Record<KillMethod, string> = { node: 'lymph node attack', cell: 'white-cell contact', pulse: 'immune pulse', antibiotic: 'local antibiotic', organ: 'the organ itself' };

export const freshProgress = (): Progress => ({ version: 1, seals: {}, seen: [], methods: {}, stewardship: false, abxProfile: 'standard' });

/** The methods that can defeat a kind at all: white cells and the pulse don't reach what ignores cells; the
 *  antibiotic works only on bacteria. */
export function methodsFor(type: PathogenType): KillMethod[] {
  const st = CONFIG.pathogens[type];
  return GUIDE_METHODS.filter((m) => (m === 'cell' || m === 'pulse' ? !st.ignoresCells : m === 'antibiotic' ? !!st.taxon : true));
}

const safeGet = (kv: KV, k: string) => { try { return kv.get(k); } catch { return null; } };
const safeSet = (kv: KV, k: string, v: string) => { try { kv.set(k, v); } catch { /* no storage: this visit only */ } };

/** Read progress, keeping only what makes sense; then grant the first-clear seal for every organ the career has
 *  cleared (older careers predate the seals). */
export function loadProgress(kv: KV, career?: Career): Progress {
  const p = parseProgress(safeGet(kv, PROGRESS_KEY)) ?? freshProgress();
  if (career) LEVELS.forEach((L, i) => { if (career.cleared[i]) grant(p, L.id, ['clear']); });
  return p;
}
export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  let o: Partial<Progress>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object' || o.version !== 1) return null;
  const p = freshProgress(), kinds = Object.keys(CONFIG.pathogens) as PathogenType[], organs: string[] = LEVELS.map((L) => L.id);
  if (o.seals && typeof o.seals === 'object') for (const [id, list] of Object.entries(o.seals)) if (organs.includes(id) && Array.isArray(list)) p.seals[id] = [...new Set(list.filter((x) => typeof x === 'string'))];
  if (Array.isArray(o.seen)) p.seen = [...new Set(o.seen.filter((t) => kinds.includes(t)))];
  if (o.methods && typeof o.methods === 'object') for (const [t, list] of Object.entries(o.methods)) if (kinds.includes(t as PathogenType) && Array.isArray(list)) p.methods[t as PathogenType] = [...new Set(list.filter((m) => GUIDE_METHODS.includes(m)))];
  p.stewardship = o.stewardship === true;
  p.abxProfile = o.abxProfile === 'burst' && p.stewardship ? 'burst' : 'standard';
  return p;
}
export function saveProgress(kv: KV, p: Progress) { safeSet(kv, PROGRESS_KEY, JSON.stringify(p)); }

/** Add seals to an organ; returns the ones that are new. */
export function grant(p: Progress, organ: string, ids: string[]): string[] {
  const have = (p.seals[organ] ??= []), fresh = ids.filter((x) => !have.includes(x));
  have.push(...fresh);
  return fresh;
}
/** A kind seen on the battlefield: true the first time. */
export function recordSeen(p: Progress, t: PathogenType): boolean {
  if (p.seen.includes(t)) return false;
  p.seen.push(t); return true;
}
/** A kind defeated by a method: 'second' when that gives it its second distinct method (the second discovery). */
export function recordKill(p: Progress, t: PathogenType, m: KillMethod): 'new' | 'second' | null {
  if (!methodsFor(t).includes(m)) return null;
  recordSeen(p, t);
  const list = (p.methods[t] ??= []);
  if (list.includes(m)) return null;
  list.push(m);
  return list.length === 2 ? 'second' : 'new';
}
export const secondDiscovery = (p: Progress, t: PathogenType) => (p.methods[t]?.length ?? 0) >= 2;

// ── Backup: the career and the permanent progress together ──
const BOTH = 'DTH2.';
export function exportBackup(c: Career, p: Progress): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ career: c, progress: p }));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return BOTH + btoa(bin);
}
/** A backup code back: the career, and the progress if the code carries it (older DTH1 codes don't). */
export function importBackup(code: string): { career: Career; progress: Progress | null } | null {
  const t = code.replace(/\s+/g, '');
  if (t.startsWith('DTH1.')) { const c = importCareer(t); return c ? { career: c, progress: null } : null; }
  if (!t.startsWith(BOTH)) return null;
  try {
    const bin = atob(t.slice(BOTH.length)), o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    // the career goes through the same checks as any saved career
    const career = o && typeof o.career === 'object' ? importCareer(exportCareer(o.career as Career)) : null;
    const progress = parseProgress(JSON.stringify(o.progress));
    return career && progress ? { career, progress } : null;
  } catch { return null; }
}
