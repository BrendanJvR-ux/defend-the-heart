// Where the vessel names go on the map. Pure layout (no canvas), so it can be tested:
// the caller passes how wide a piece of text is.
import type { VesselId } from './config';
import { W, H, VESSELS, ENTRY_IDS, SITES, routesOf, forkAt, entryDef, pointAt, organClearance, type Vec } from './level';

export interface Box { x: number; y: number; w: number; h: number }
export interface MapLabel {
  /** The route this label names (for a fork's stem, its first branch). */
  v: VesselId;
  text: string;
  /** A fork's branch label (the DILATED tag goes on it); false for a stem or an unforked vessel. */
  branch: boolean;
  /** Text centre-baseline. */
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

/** Lay out every vessel's name: for each, try spots along its own stretch of vessel and on either side,
 *  and keep the first that clears the build sites, the organ, the next-wave tags, the map edge and the
 *  names already placed. */
export function layoutLabels(widthOf: (text: string) => number): MapLabel[] {
  const out: MapLabel[] = [];
  const tags = ENTRY_IDS.map((e) => previewTagBox(e, 242));
  const place = (v: VesselId, from: number, to: number, start: number, text: string, top: boolean, branch: boolean) => {
    const ves = VESSELS[v], tw = widthOf(text), half = tw / 2;
    let best: MapLabel | null = null, bestCost = Infinity;
    for (const at of along(start, from, to)) {
      const p = pointAt(ves, at);
      // preferred side first: right of a vessel from the top edge, above any other
      const spots: Vec[] = top
        ? [{ x: p.x + 40 + half, y: p.y + 6 }, { x: p.x - 40 - half, y: p.y + 6 }, { x: p.x, y: p.y - 40 }, { x: p.x, y: p.y + 52 }]
        : [{ x: p.x, y: p.y - 40 }, { x: p.x, y: p.y + 52 }, { x: p.x + 40 + half, y: p.y + 6 }, { x: p.x - 40 - half, y: p.y + 6 }];
      for (const s of spots) {
        const lx = Math.max(half + 24, Math.min(W - half - 24, s.x));
        const label = { v, text, branch, lx, ly: s.y, box: labelBox(lx, s.y, tw) };
        const c = cost(label.box, out, tags);
        if (c < bestCost) { bestCost = c; best = label; }
        if (c === 0) { out.push(label); return; }
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
      place(r, f + 40, L - 70, f + (L - f) * 0.45, VESSELS[r].label, false, true);
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
  if (organClearance({ x: b.x + b.w / 2, y: b.y + b.h / 2 }) < 10) c += 2;
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
