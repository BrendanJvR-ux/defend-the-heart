// The map of the current organ: its routes into the organ and the build sites beside them.
// A vessel enters from the map edge; a forked vessel splits into two branches, and each
// branch is its own route (stem + branch points), so the two routes share an identical stem.
// loadLevel() swaps the whole map; the exports are live bindings, so importers always see
// the current organ.
import { pointAt as pathPointAt, projectOnSegment, dist, type Vec } from './geometry';
import { LEVELS, type LevelDef, type VesselId } from './config';

export const W = 1600;
export const H = 1000;

export interface Vessel { id: VesselId; name: string; label: string; pts: Vec[]; cum: number[]; length: number }

/** A place a lymph node can stand: beside one section of one vessel, guarding that vessel. */
export interface Site { id: string; vessel: VesselId; index: number; x: number; y: number; anchor: Vec; stem: boolean }

export let LEVEL_INDEX = 0;
export let LEVEL: LevelDef = LEVELS[0];
/** The organ's centre (kept under its old name: everything flows to it). */
export let HEART: Vec = LEVEL.map.center;
export let HEART_R = 100;
/** Routes into the organ, keyed by route id (what is dilated, travelled and numbered 1–8). */
export let VESSELS: Record<VesselId, Vessel> = {};
export let VESSEL_IDS: VesselId[] = [];
/** Vessels entering the map (what waves name). */
export let ENTRY_IDS: VesselId[] = [];
let ENTRY_OF: Record<VesselId, VesselId> = {};
let FORK_AT: Record<VesselId, number> = {};
let ROUTES_OF: Record<VesselId, VesselId[]> = {};

/** The vessel entering the map that a route belongs to (itself, if unforked). */
export const entryOf = (r: VesselId): VesselId => ENTRY_OF[r] ?? r;
/** Distance along a route at which it forks off its sibling (Infinity if unforked). */
export const forkAt = (r: VesselId): number => FORK_AT[r] ?? Infinity;
/** The routes into the organ from one entry vessel: one, or the two branches of a fork. */
export const routesOf = (entry: VesselId): VesselId[] => ROUTES_OF[entry] ?? [entry];
/** The other branch of a forked route, or null. */
export const siblingOf = (r: VesselId): VesselId | null => routesOf(entryOf(r)).find((x) => x !== r) ?? null;
/** The entry vessel's own definition (name and label for the shared stem). */
export const entryDef = (entry: VesselId) => LEVEL.map.vessels.find((v) => v.id === entry)!;

/** The route to act on when the shared stem of `entry` is clicked: the open one if it is a branch of it, else the first. */
export const routeAtStem = (entry: VesselId, dilated: VesselId | null): VesselId =>
  dilated && entryOf(dilated) === entry ? dilated : routesOf(entry)[0];
export let SITES: Site[] = [];

function build(def: { id: VesselId; name: string; label: string; pts: Vec[] }): Vessel {
  const cum = [0];
  for (let i = 1; i < def.pts.length; i++) cum.push(cum[i - 1] + dist(def.pts[i - 1], def.pts[i]));
  return { ...def, cum, length: cum[cum.length - 1] };
}

export function pointAt(v: Vessel, s: number): Vec & { angle: number } {
  return pathPointAt(v, s);
}

export function nearestOnVessel(v: Vessel, p: Vec): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < v.pts.length; i++) {
    const pr = projectOnSegment(p, v.pts[i - 1], v.pts[i]);
    if (pr.d < best.d) best = { s: v.cum[i - 1] + pr.t * (v.cum[i] - v.cum[i - 1]), d: pr.d };
  }
  return best;
}

/** Roughly how far a point is outside the organ (negative inside). */
export function organClearance(p: Vec): number {
  const { center, rx, ry } = LEVEL.map;
  const dx = (p.x - center.x) / rx, dy = (p.y - center.y) / ry;
  return (Math.hypot(dx, dy) - 1) * Math.min(rx, ry);
}

const SITE_OFFSET = 88;

function makeSites(): Site[] {
  const out: Site[] = [];
  for (const v of VESSEL_IDS) {
    const ves = VESSELS[v];
    const first = routesOf(entryOf(v))[0] === v;
    LEVEL.map.siteFractions.forEach((f, index) => {
      const d = ves.length * f, stem = isFinite(forkAt(v)) && d < forkAt(v);
      // a stem site is shared by both branches: only the first branch makes it
      if (stem && !first) return;
      const a = pointAt(ves, d);
      // try both sides; keep the one with the most room from the organ and other vessels, inside the map
      let best: Site | null = null, bestScore = -Infinity;
      for (const side of [1, -1]) {
        for (const extra of [0, 20, -14]) {
          const off = SITE_OFFSET + extra;
          const p = { x: a.x - Math.sin(a.angle) * off * side, y: a.y + Math.cos(a.angle) * off * side };
          if (p.x < 50 || p.x > W - 50 || p.y < 50 || p.y > H - 50) continue;
          let clear = organClearance(p) - 70;
          for (const o of VESSEL_IDS) clear = Math.min(clear, nearestOnVessel(VESSELS[o], p).d - (entryOf(o) === entryOf(v) ? 50 : 70));
          for (const s of out) clear = Math.min(clear, dist(p, s) - 64);
          const score = clear - Math.abs(extra) * 0.5;
          if (clear > 0 && score > bestScore) { bestScore = score; best = { id: `${v}-${index}`, vessel: v, index, x: p.x, y: p.y, anchor: { x: a.x, y: a.y }, stem }; }
        }
      }
      if (best) out.push(best);
    });
  }
  return out;
}

/** Switch the map to another organ. */
export function loadLevel(index: number) {
  LEVEL_INDEX = Math.max(0, Math.min(LEVELS.length - 1, index));
  LEVEL = LEVELS[LEVEL_INDEX];
  HEART = LEVEL.map.center;
  HEART_R = Math.min(LEVEL.map.rx, LEVEL.map.ry);
  VESSELS = {}; VESSEL_IDS = []; ENTRY_IDS = []; ENTRY_OF = {}; FORK_AT = {}; ROUTES_OF = {};
  for (const v of LEVEL.map.vessels) {
    ENTRY_IDS.push(v.id);
    if (!v.fork) { VESSELS[v.id] = build(v); VESSEL_IDS.push(v.id); continue; }
    const stem = build(v);
    ROUTES_OF[v.id] = v.fork.branches.map((b) => b.id);
    for (const b of v.fork.branches) {
      VESSELS[b.id] = build({ id: b.id, name: b.name, label: b.label, pts: [...v.pts, ...b.pts] });
      VESSEL_IDS.push(b.id); ENTRY_OF[b.id] = v.id; FORK_AT[b.id] = stem.length;
    }
  }
  SITES = makeSites();
}
loadLevel(0);

export const siteById = (id: string) => SITES.find((s) => s.id === id)!;

export { dist };
export type { Vec };
