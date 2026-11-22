// The map: four vessels approaching the heart from different sides, never joining,
// with build sites for lymph nodes beside different sections of each vessel.
import { pointAt as lanePointAt, projectOnSegment, dist, type Vec, type Lane } from '../map';
import type { VesselId } from './config';

export const W = 1600;
export const H = 1000;

export const HEART: Vec = { x: 800, y: 480 };
export const HEART_R = 100;

export interface Vessel { id: VesselId; pts: Vec[]; cum: number[]; length: number }

function build(id: VesselId, pts: Vec[]): Vessel {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { id, pts, cum, length: cum[cum.length - 1] };
}

// Blood (and pathogens) flow from the outer end (s = 0) to the heart entrance (s = length).
export const VESSELS: Record<VesselId, Vessel> = {
  left: build('left', [{ x: -40, y: 500 }, { x: 170, y: 500 }, { x: 330, y: 420 }, { x: 520, y: 450 }, { x: 682, y: 485 }]),
  right: build('right', [{ x: 1640, y: 600 }, { x: 1420, y: 600 }, { x: 1260, y: 520 }, { x: 1080, y: 520 }, { x: 918, y: 500 }]),
  lower: build('lower', [{ x: 200, y: 1040 }, { x: 260, y: 880 }, { x: 440, y: 800 }, { x: 600, y: 760 }, { x: 735, y: 615 }]),
  upper: build('upper', [{ x: 1420, y: -40 }, { x: 1370, y: 120 }, { x: 1190, y: 190 }, { x: 1010, y: 250 }, { x: 880, y: 372 }]),
};
export const VESSEL_IDS: VesselId[] = ['left', 'right', 'lower', 'upper'];

export function pointAt(v: Vessel, s: number): Vec & { angle: number } {
  return lanePointAt({ ...v, id: 'mill', name: '', junctionS: v.length } as Lane, s);
}

export function nearestOnVessel(v: Vessel, p: Vec): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < v.pts.length; i++) {
    const pr = projectOnSegment(p, v.pts[i - 1], v.pts[i]);
    if (pr.d < best.d) best = { s: v.cum[i - 1] + pr.t * (v.cum[i] - v.cum[i - 1]), d: pr.d };
  }
  return best;
}

/** A place a lymph node can stand: beside one section of one vessel, guarding that vessel. */
export interface Site { id: string; vessel: VesselId; index: number; x: number; y: number; anchor: Vec }

const SITE_FRACTIONS = [0.3, 0.52, 0.74];
const SITE_OFFSET = 88;

function makeSites(): Site[] {
  const out: Site[] = [];
  for (const v of VESSEL_IDS) {
    const ves = VESSELS[v];
    SITE_FRACTIONS.forEach((f, index) => {
      const a = pointAt(ves, ves.length * f);
      // try both sides; keep the one furthest from the heart and other vessels, inside the map
      let best: Site | null = null, bestScore = -Infinity;
      for (const side of [1, -1]) {
        for (const extra of [0, 20, -14]) {
          const off = SITE_OFFSET + extra;
          const p = { x: a.x - Math.sin(a.angle) * off * side, y: a.y + Math.cos(a.angle) * off * side };
          if (p.x < 50 || p.x > W - 50 || p.y < 50 || p.y > H - 50) continue;
          let clear = dist(p, HEART) - 170;
          for (const o of VESSEL_IDS) if (o !== v) clear = Math.min(clear, nearestOnVessel(VESSELS[o], p).d - 70);
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
export const SITES: Site[] = makeSites();
export const siteById = (id: string) => SITES.find((s) => s.id === id)!;

export { dist };
export type { Vec };
