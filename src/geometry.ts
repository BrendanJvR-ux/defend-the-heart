// Small 2D path helpers: distances, points along a polyline, projection onto a segment.
export interface Vec { x: number; y: number }

/** A polyline with cumulative lengths, so positions can be given as distance along it. */
export interface Path { pts: Vec[]; cum: number[]; length: number }

export function dist(a: Vec, b: Vec): number { return Math.hypot(a.x - b.x, a.y - b.y); }

export function pointAt(path: Path, s: number): Vec & { angle: number } {
  const c = Math.max(0, Math.min(path.length, s));
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i] < c) i++;
  const a = path.pts[i - 1], b = path.pts[i];
  const seg = path.cum[i] - path.cum[i - 1] || 1;
  const t = (c - path.cum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

export function projectOnSegment(p: Vec, a: Vec, b: Vec): { t: number; point: Vec; d: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, point, d: dist(p, point) };
}
