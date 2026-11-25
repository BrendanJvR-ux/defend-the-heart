// Where the vessel names go on the map. Pure layout (no canvas), so it can be tested:
// the caller passes how wide a piece of text is.
import type { VesselId } from './config';
import { W, H, HEART, LEVEL, VESSEL_IDS, VESSELS, ENTRY_IDS, SITES, routesOf, forkAt, entryDef, pointAt, organClearance, type Vec } from './level';

/** The key that opens each route during a wave, in route order: 1 to 9, then 0, - and = (up to 12 routes). */
export const ROUTE_KEYS = '1234567890-=';
/** The key for a route, or '' for a stem (not a route of its own) or a route past the twelfth. */
export const routeKey = (v: VesselId): string => ROUTE_KEYS[VESSEL_IDS.indexOf(v)] ?? '';
/** Room the key badge takes before a route's name. */
export const KEY_W = 30;

export interface Box { x: number; y: number; w: number; h: number }
export interface MapLabel {
  /** The route this label names (for a fork's stem, its first branch). */
  v: VesselId;
  text: string;
  /** A fork's branch label (the DILATED tag goes on it); false for a stem or an unforked vessel. */
  branch: boolean;
  /** The key that opens this route ('' for a fork's stem), drawn in a badge before the name. */
  key: string;
  /** Centre-baseline of the badge and name together. */
  lx: number; ly: number;
  /** Space taken by the label and the DILATED tag that may hang under it. */
  box: Box;
}

const SITE_CLEAR = 34;
const EDGE = 8;

/** Where the next-wave tag for a vessel sits (it is drawn only between waves), `w` wide. */
export function previewTagBox(entry: VesselId, w: number): Box {
  const v = routesOf(entry)[0], p = pointAt(VESSELS[v], 70), from = VESSELS[v].pts[0];
  // a vessel from the top edge has its name to the right of it, so its tag sits to the left
  const x = Math.max(24, Math.min(W - w - 24, from.y < 0 ? p.x - w - 24 : p.x - w / 2));
  const y = Math.max(24, Math.min(H - 70, p.y + (from.y < 0 ? 40 : from.y > H ? -110 : 46)));
  return { x, y, w, h: 48 };
}

/** Where the NO gauge sits during a wave (under the organ, or wherever the organ's `gaugeDrop` puts it): its centre
 *  line, and the box it takes. Vessel names keep clear of it. */
export function noGauge(): { y: number; box: Box } {
  const y = HEART.y + (LEVEL.id === 'heart' ? 189 : LEVEL.map.gaugeDrop ?? LEVEL.map.ry + 80), w = 150;
  return { y, box: { x: HEART.x - w / 2 - 44, y: y - 14, w: w + 96, h: 28 } };
}

/** Lay out every vessel's name: for each, try spots along its own stretch of vessel and on either side,
 *  and keep the first that clears the build sites, the organ, the next-wave tags, the map edge and the
 *  names already placed. */
export function layoutLabels(widthOf: (text: string) => number, withKeys = true): MapLabel[] {
  const out: MapLabel[] = [];
  const tags = [...ENTRY_IDS.map((e) => previewTagBox(e, 242)), noGauge().box, noGauge().box];
  const place = (v: VesselId, from: number, to: number, start: number, text: string, top: boolean, branch: boolean, sibling?: VesselId) => {
    const key = withKeys && (branch || !isFinite(forkAt(v))) ? routeKey(v) : '';
    const ves = VESSELS[v], tw = widthOf(text) + (key ? KEY_W : 0), half = tw / 2;
    let best: MapLabel | null = null, bestCost = Infinity;
    // a branch tries its outer two sides all along its stretch before its inner two; anything else, all four as it goes
    for (const sides of sibling ? [[0, 1], [2, 3]] : [[0, 1, 2, 3]]) {
      for (const at of along(start, from, to)) {
        const p = pointAt(ves, at);
        // preferred side first: right of a vessel from the top edge, above any other
        const spots: Vec[] = top
          ? [{ x: p.x + 40 + half, y: p.y + 6 }, { x: p.x - 40 - half, y: p.y + 6 }, { x: p.x, y: p.y - 40 }, { x: p.x, y: p.y + 52 }]
          : [{ x: p.x, y: p.y - 40 }, { x: p.x, y: p.y + 52 }, { x: p.x + 40 + half, y: p.y + 6 }, { x: p.x - 40 - half, y: p.y + 6 }];
        // a fork's branch has its name on the outer side, away from its sibling, not squeezed between the two
        if (sibling) {
          const q = pointAt(VESSELS[sibling], Math.min(at, VESSELS[sibling].length)), far = (o: Vec) => -Math.hypot(o.x - q.x, o.y - q.y);
          spots.sort((a, b) => far(a) - far(b));
        }
        for (const i of sides) {
          const s = spots[i], lx = Math.max(half + 24, Math.min(W - half - 24, s.x));
          const label = { v, text, key, branch, lx, ly: s.y, box: labelBox(lx, s.y, tw) };
          const c = cost(label.box, out, tags);
          if (c < bestCost) { bestCost = c; best = label; }
          if (c === 0) { out.push(label); return; }
        }
      }
    }
    out.push(best!);
  };
  for (const e of ENTRY_IDS) {
    const rs = routesOf(e), first = VESSELS[rs[0]], top = first.pts[0].y < 0;
    const stemEnd = Math.min(forkAt(rs[0]) - 40, first.length * 0.6);
    place(rs[0], 90, stemEnd, Math.min(150, stemEnd), rs.length > 1 ? entryDef(e).label : first.label, top, false);
    for (const r of rs.length > 1 ? rs : []) {
      const f = forkAt(r), L = VESSELS[r].length;
      place(r, f + 40, L - 70, f + (L - f) * 0.45, VESSELS[r].label, false, true, rs.find((o) => o !== r));
    }
  }
  return out;
}

/** Distances to try along a stretch of vessel: the preferred one first, then outwards both ways. */
function along(start: number, from: number, to: number): number[] {
  const out = [start];
  for (let d = 20; start - d >= from || start + d <= to; d += 20) {
    if (start + d <= to) out.push(start + d);
    if (start - d >= from) out.push(start - d);
  }
  return out;
}

/** How badly a label box collides: with sites, other labels, next-wave tags, the organ, the map edge. */
function cost(b: Box, placed: MapLabel[], tags: Box[]): number {
  let c = 0;
  for (const s of SITES) if (hitsCircle(b, s, SITE_CLEAR)) c += 3;
  for (const l of placed) if (overlaps(b, l.box)) c += 3;
  for (const t of tags) if (overlaps(b, t)) c += 1;
  // the name's own strip (the top 32 of the box; the DILATED tag hangs below it) stays off the organ, corners and all
  const strip = [[0.5, 16], [0, 4], [1, 4], [0, 30], [1, 30]].map(([fx, dy]) => ({ x: b.x + fx * b.w, y: b.y + dy }));
  if (strip.some((p) => organClearance(p) < 24)) c += 2;
  if (b.x < EDGE || b.y < EDGE || b.x + b.w > W - EDGE || b.y + b.h > H - EDGE) c += 3;
  return c;
}

/** The label's backing plate, extended down to cover a DILATED tag under it. */
function labelBox(lx: number, ly: number, tw: number): Box {
  const w = Math.max(tw + 20, 116);
  return { x: lx - w / 2, y: ly - 23, w, h: 65 };
}

export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function hitsCircle(b: Box, c: Vec, r: number) {
  const nx = Math.max(b.x, Math.min(c.x, b.x + b.w)), ny = Math.max(b.y, Math.min(c.y, b.y + b.h));
  return Math.hypot(nx - c.x, ny - c.y) < r;
}
