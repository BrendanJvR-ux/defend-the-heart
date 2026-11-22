// Level one geometry: two vessels approaching the heart from opposite sides, never joining.
import { pointAt as lanePointAt, projectOnSegment, dist, type Vec, type Lane } from '../map';
import type { VesselId } from './config';

export const W = 1600;
export const H = 1000;

export const HEART: Vec = { x: 800, y: 330 };
export const HEART_R = 100;

export interface Vessel { id: VesselId; pts: Vec[]; cum: number[]; length: number }

function build(id: VesselId, pts: Vec[]): Vessel {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { id, pts, cum, length: cum[cum.length - 1] };
}

// Blood (and pathogens) flow from the outer end (s = 0) to the heart entrance (s = length).
export const VESSELS: Record<VesselId, Vessel> = {
  left: build('left', [
    { x: -40, y: 880 }, { x: 170, y: 880 }, { x: 310, y: 760 }, { x: 340, y: 590 },
    { x: 460, y: 470 }, { x: 600, y: 470 }, { x: 682, y: 400 },
  ]),
  right: build('right', [
    { x: 1640, y: 900 }, { x: 1450, y: 900 }, { x: 1310, y: 780 }, { x: 1275, y: 620 },
    { x: 1140, y: 640 }, { x: 1010, y: 560 }, { x: 912, y: 412 },
  ]),
};
export const VESSEL_IDS: VesselId[] = ['left', 'right'];

/** Lymph nodes sit beside their vessel; their reach extends into the bloodstream. */
export const NODES: Record<VesselId, Vec> = {
  left: { x: 480, y: 640 },
  right: { x: 1150, y: 790 },
};

export function pointAt(v: Vessel, s: number): Vec & { angle: number } {
  return lanePointAt({ ...v, id: 'mill', name: '', junctionS: v.length } as Lane, s);
}

/** Distance from a point to a vessel's centre line, and the s of the nearest point. */
export function nearestOnVessel(v: Vessel, p: Vec): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < v.pts.length; i++) {
    const pr = projectOnSegment(p, v.pts[i - 1], v.pts[i]);
    if (pr.d < best.d) best = { s: v.cum[i - 1] + pr.t * (v.cum[i] - v.cum[i - 1]), d: pr.d };
  }
  return best;
}

export { dist };
export type { Vec };
