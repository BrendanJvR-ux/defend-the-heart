// The map of the current organ: its routes into the organ and the build sites beside them.
// A vessel enters from the map edge; a forked vessel splits into two branches, and each
// branch is its own route (stem + branch points), so the two routes share an identical stem.
// loadLevel() swaps the whole map; the exports are live bindings, so importers always see
// the current organ.
import { pointAt as pathPointAt, projectOnSegment, dist, type Vec } from './geometry';
import { LEVELS, type LevelDef, type VesselId } from './config';

export const W = 1600;
export const H = 1000;

/** A route: its corner points (`pts`, `cum`, `length` measure distance along it), and the winding course
 *  everything actually follows, sampled every `STEP` units (`cx`, `cy`, `ca`). */
export interface Vessel { id: VesselId; name: string; label: string; pts: Vec[]; cum: number[]; length: number; cx: Float32Array; cy: Float32Array; ca: Float32Array; fork: number; forkPt: Vec }

// The vessels wind: corners are rounded off, and a meander (two waves of different length) runs along each one,
// the same along both branches' shared stem, fading out where the vessel meets the organ. The meander is real
// length: a route is measured along its winding course, `WIND` times as long as its corner points (1.5: half as
// long again). Endless stages wind more tightly still.
const STEP = 4, ROUND = 24, MEANDER = 40, FADE = 80;
/** The meander's shape at distance d (corner units): one long, even wave with a faint shorter ripple on it, so a
 *  vessel reads as a winding vessel rather than a zigzag. `q` stretches it (longer q: gentler). */
const wave = (d: number, q: number, phase: number) => 0.86 * Math.sin(d / (27 * q) + phase) + 0.14 * Math.sin(d / (10 * q) + phase * 2);
export const BASE_WIND = 1.5;
let WIND = BASE_WIND;

/** How tightly the meander must wave (a scale on its wavelengths) for a straight course to come out `wind` times
 *  as long: found once per wind by bisection, then kept. */
const waveScale = new Map<number, number>();
function scaleFor(wind: number): number {
  if (wind <= 1.0001) return Infinity;
  const have = waveScale.get(wind);
  if (have) return have;
  const ratio = (q: number) => {
    let len = 0, py = 0;
    for (let d = 1; d <= 6000; d++) { const y = MEANDER * wave(d, q, 0); len += Math.hypot(1, y - py); py = y; }
    return len / 6000;
  };
  let lo = 0.05, hi = 20;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ratio(m) > wind) lo = m; else hi = m; }
  waveScale.set(wind, (lo + hi) / 2);
  return (lo + hi) / 2;
}

/** A place a lymph node can stand: beside one section of one vessel, guarding that vessel. */
export interface Site { id: string; vessel: VesselId; index: number; x: number; y: number; anchor: Vec; stem: boolean;
  /** How far along its route (as pathogens measure it) the site's anchor lies, and as a share of the route. */
  at: number; frac: number }

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

function build(def: { id: VesselId; name: string; label: string; pts: Vec[] }, entry: VesselId = def.id, fork = Infinity): Vessel {
  const cum0 = [0];
  for (let i = 1; i < def.pts.length; i++) cum0.push(cum0[i - 1] + dist(def.pts[i - 1], def.pts[i]));
  const path = { pts: def.pts, cum: cum0, length: cum0[cum0.length - 1] };
  // the meander's phase comes from the entry vessel, so a forked vessel's two routes share one stem
  let phase = 0; for (const ch of entry) phase = (phase * 31 + ch.charCodeAt(0)) % 997;
  phase = (phase / 997) * Math.PI * 2;
  const q = scaleFor(WIND);
  // corners rounded: the average of the corner path around a point; on a shared stem, only the stem's own
  // points count, so both branches' stems come out exactly the same
  const centre = (d: number, lim: number) => {
    let x = 0, y = 0;
    for (const k of [-1, -0.5, 0, 0.5, 1]) { const p = pathPointAt(path, Math.min(lim, d + k * ROUND)); x += p.x; y += p.y; }
    return { x: x / 5, y: y / 5 };
  };
  const at = (d: number) => {
    const lim = d <= fork ? fork : Infinity;
    const a = centre(d - 6, lim), b = centre(Math.min(lim, d + 6), lim), m = centre(d, lim);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const k = isFinite(q) ? MEANDER * Math.min(1, (path.length - d) / FADE) * wave(d, q, phase) : 0;
    return { x: m.x - Math.sin(ang) * k, y: m.y + Math.cos(ang) * k };
  };
  // walk the winding course finely, measuring it: that measure is how far along the route anything is
  // (the fork itself is one of the points walked, so the stem's measure ends exactly there on both branches)
  const ds: number[] = [];
  for (let d = 0; d < path.length; d++) ds.push(d);
  ds.push(path.length);
  if (isFinite(fork) && !ds.includes(fork)) { ds.push(fork); ds.sort((x, y) => x - y); }
  const fine: Vec[] = [], arc: number[] = [];
  let len = 0, forkS = Infinity;
  for (const d of ds) {
    const p = at(d);
    if (fine.length) len += dist(fine[fine.length - 1], p);
    fine.push(p); arc.push(len);
    if (d === fork) forkS = len;
  }
  const length = arc[arc.length - 1];
  const n = Math.floor(length / STEP) + 2;
  const cx = new Float32Array(n), cy = new Float32Array(n), ca = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const want = Math.min(length, i * STEP);
    while (j < arc.length - 2 && arc[j + 1] < want) j++;
    const t = (want - arc[j]) / (arc[j + 1] - arc[j] || 1);
    cx[i] = fine[j].x + (fine[j + 1].x - fine[j].x) * t; cy[i] = fine[j].y + (fine[j + 1].y - fine[j].y) * t;
  }
  // the fork point itself, so a point on the stem never blends with either branch
  const forkPt = isFinite(fork) ? at(fork) : { x: 0, y: 0 };
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); ca[i] = Math.atan2(cy[b] - cy[a], cx[b] - cx[a]); }
  // the corner points keep their own cumulative lengths, scaled to the course's, for placing things roughly along them
  const k = length / (path.length || 1);
  return { ...def, cum: cum0.map((c) => c * k), length, cx, cy, ca, fork: forkS, forkPt };
}

/** Where on a route's winding course a point `s` along it lies, and which way the vessel runs there. */
export function pointAt(v: Vessel, s: number): Vec & { angle: number } {
  const c = Math.max(0, Math.min(v.length, s)), u = c / STEP, i = Math.min(v.cx.length - 2, Math.floor(u)), t = u - i;
  if (c <= v.fork && (i + 1) * STEP > v.fork) {
    const k = (c - i * STEP) / (v.fork - i * STEP || 1);
    return { x: v.cx[i] + (v.forkPt.x - v.cx[i]) * k, y: v.cy[i] + (v.forkPt.y - v.cy[i]) * k, angle: v.ca[i] };
  }
  return { x: v.cx[i] + (v.cx[i + 1] - v.cx[i]) * t, y: v.cy[i] + (v.cy[i + 1] - v.cy[i]) * t, angle: t < 0.5 ? v.ca[i] : v.ca[i + 1] };
}

/** The nearest point of a route's winding course to `p`: how far along the route, and how far away. */
export function nearestOnVessel(v: Vessel, p: Vec): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < v.cx.length; i++) {
    const pr = projectOnSegment(p, { x: v.cx[i - 1], y: v.cy[i - 1] }, { x: v.cx[i], y: v.cy[i] });
    if (pr.d < best.d) best = { s: Math.min(v.length, (i - 1 + pr.t) * STEP), d: pr.d };
  }
  return best;
}

/** Roughly how far a point is outside the organ (negative inside). */
export function organClearance(p: Vec): number {
  const { center, rx, ry } = LEVEL.map;
  const dx = (p.x - center.x) / rx, dy = (p.y - center.y) / ry;
  return (Math.hypot(dx, dy) - 1) * Math.min(rx, ry);
}

const SITE_OFFSET = 100;

/** Endless stages add build sites between the usual ones, in this order (each lands on whichever side of its
 *  vessel has room, or is left out where there is none). */
const EXTRA_FRACTIONS = [0.425, 0.575, 0.275, 0.725, 0.125, 0.875];
let FRACTIONS: number[] = [];

function makeSites(): Site[] {
  const out: Site[] = [];
  for (const v of VESSEL_IDS) {
    const ves = VESSELS[v];
    const first = routesOf(entryOf(v))[0] === v;
    FRACTIONS.forEach((f, index) => {
      const want = ves.length * f, stemWanted = isFinite(forkAt(v)) && want < forkAt(v);
      // a stem site is shared by both branches: only the first branch makes it
      if (stemWanted && !first) return;
      // just past a fork the two branches' sites crowd each other: where there is no room, a little further along
      for (const shift of isFinite(forkAt(v)) && !stemWanted && want - forkAt(v) < 160 ? [0, 50, 100] : [0]) {
        const d = want + shift, stem = isFinite(forkAt(v)) && d < forkAt(v);
        if (d <= 0 || d >= ves.length || stem !== stemWanted) continue;
        const a = pathPointAt(ves, d), on = pointAt(ves, d);
        // try both sides; keep the one with the most room from the organ and other vessels, inside the map
        let best: Site | null = null, bestScore = -Infinity;
        for (const side of [1, -1]) {
          for (const extra of [0, 20, -14, -26]) {
            const off = SITE_OFFSET + extra;
            const p = { x: a.x - Math.sin(a.angle) * off * side, y: a.y + Math.cos(a.angle) * off * side };
            if (p.x < 50 || p.x > W - 50 || p.y < 50 || p.y > H - 50) continue;
            let clear = organClearance(p) - 70;
            for (const o of VESSEL_IDS) clear = Math.min(clear, nearestOnVessel(VESSELS[o], p).d - (entryOf(o) === entryOf(v) ? 50 : 70));
            for (const s of out) clear = Math.min(clear, dist(p, s) - 64);
            const score = clear - Math.abs(extra) * 0.5;
            if (clear > 0 && score > bestScore) { bestScore = score; best = { id: `${v}-${index}`, vessel: v, index, x: p.x, y: p.y, anchor: { x: on.x, y: on.y }, stem, at: d, frac: f }; }
          }
        }
        if (best) { out.push(best); break; }
      }
    });
  }
  // list order (the panel's "Place by list"): each vessel's outermost site, then each vessel's next, and so on
  return out.sort((a, b) => a.index - b.index || VESSEL_IDS.indexOf(a.vessel) - VESSEL_IDS.indexOf(b.vessel));
}

/** Switch the map to another organ. `wind`: how many times longer than its corner points each route runs (endless
 *  stages wind more); `extraSites`: how many more build sites each vessel gets (endless stages). */
export function loadLevel(index: number, opts: { wind?: number; extraSites?: number } = {}) {
  WIND = opts.wind ?? BASE_WIND;
  FRACTIONS = [...LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))].map.siteFractions, ...EXTRA_FRACTIONS.slice(0, Math.max(0, opts.extraSites ?? 0))];
  LEVEL_INDEX = Math.max(0, Math.min(LEVELS.length - 1, index));
  LEVEL = LEVELS[LEVEL_INDEX];
  HEART = LEVEL.map.center;
  HEART_R = Math.min(LEVEL.map.rx, LEVEL.map.ry);
  VESSELS = {}; VESSEL_IDS = []; ENTRY_IDS = []; ENTRY_OF = {}; FORK_AT = {}; ROUTES_OF = {};
  for (const v of LEVEL.map.vessels) {
    ENTRY_IDS.push(v.id);
    if (!v.fork) { VESSELS[v.id] = build(v); VESSEL_IDS.push(v.id); continue; }
    // the fork, measured along the stem's corner points (the builder measures the winding course from there)
    let stemCorners = 0; for (let i = 1; i < v.pts.length; i++) stemCorners += dist(v.pts[i - 1], v.pts[i]);
    ROUTES_OF[v.id] = v.fork.branches.map((b) => b.id);
    for (const b of v.fork.branches) {
      VESSELS[b.id] = build({ id: b.id, name: b.name, label: b.label, pts: [...v.pts, ...b.pts] }, v.id, stemCorners);
      VESSEL_IDS.push(b.id); ENTRY_OF[b.id] = v.id; FORK_AT[b.id] = VESSELS[b.id].fork;
    }
  }
  SITES = makeSites();
}
loadLevel(0);

export const siteById = (id: string) => SITES.find((s) => s.id === id)!;

/** A site's place along its route, for lists: "site 2 of 5, far out". */
export function siteLabel(site: Site): string {
  const sorted = [...FRACTIONS].sort((a, b) => a - b), n = sorted.length, pos = sorted.indexOf(site.frac) + 1;
  const where = site.frac <= 0.34 ? 'far out' : site.frac <= 0.67 ? 'midway' : 'near the organ';
  return `site ${pos} of ${n}, ${where}`;
}

export { dist };
export type { Vec };
