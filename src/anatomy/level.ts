// The map of the current organ: its vessels (never joining) and the build sites
// beside different sections of each vessel. loadLevel() swaps the whole map; the
// exports are live bindings, so importers always see the current organ.
import { pointAt as lanePointAt, projectOnSegment, dist, type Vec, type Lane } from '../map';
import { LEVELS, type LevelDef, type VesselId } from './config';

export const W = 1600;
export const H = 1000;

export interface Vessel { id: VesselId; name: string; label: string; pts: Vec[]; cum: number[]; length: number }

/** A place a lymph node can stand: beside one section of one vessel, guarding that vessel. */
export interface Site { id: string; vessel: VesselId; index: number; x: number; y: number; anchor: Vec }

export let LEVEL_INDEX = 0;
export let LEVEL: LevelDef = LEVELS[0];
/** The organ's centre (kept under its old name: everything flows to it). */
export let HEART: Vec = LEVEL.map.center;
export let HEART_R = 100;
export let VESSELS: Record<VesselId, Vessel> = {};
export let VESSEL_IDS: VesselId[] = [];
export let SITES: Site[] = [];

function build(def: { id: VesselId; name: string; label: string; pts: Vec[] }): Vessel {
  const cum = [0];
  for (let i = 1; i < def.pts.length; i++) cum.push(cum[i - 1] + dist(def.pts[i - 1], def.pts[i]));
  return { ...def, cum, length: cum[cum.length - 1] };
}

export function pointAt(v: Vessel, s: number): Vec & { angle: number } {
  return lanePointAt({ ...v, id: 'mill', name: '', junctionS: v.length } as unknown as Lane, s);
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
    LEVEL.map.siteFractions.forEach((f, index) => {
      const a = pointAt(ves, ves.length * f);
      // try both sides; keep the one with the most room from the organ and other vessels, inside the map
      let best: Site | null = null, bestScore = -Infinity;
      for (const side of [1, -1]) {
        for (const extra of [0, 20, -14]) {
          const off = SITE_OFFSET + extra;
          const p = { x: a.x - Math.sin(a.angle) * off * side, y: a.y + Math.cos(a.angle) * off * side };
          if (p.x < 50 || p.x > W - 50 || p.y < 50 || p.y > H - 50) continue;
          let clear = organClearance(p) - 70;
          for (const o of VESSEL_IDS) clear = Math.min(clear, nearestOnVessel(VESSELS[o], p).d - (o === v ? 50 : 70));
          for (const s of out) clear = Math.min(clear, dist(p, s) - 80);
          const score = clear - Math.abs(extra) * 0.5;
          if (clear > 0 && score > bestScore) { bestScore = score; best = { id: `${v}-${index}`, vessel: v, index, x: p.x, y: p.y, anchor: { x: a.x, y: a.y } }; }
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
  VESSELS = Object.fromEntries(LEVEL.map.vessels.map((v) => [v.id, build(v)]));
  VESSEL_IDS = LEVEL.map.vessels.map((v) => v.id);
  SITES = makeSites();
}
loadLevel(0);

export const siteById = (id: string) => SITES.find((s) => s.id === id)!;

export { dist };
export type { Vec };
