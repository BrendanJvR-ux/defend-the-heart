// How the organ images are keyed and sized (no canvas here, so the rules can be tested).

/** Map units across an organ image (the organ's centre ± 420). */
export const ORGAN_SPAN = 840;

/** One image per organ, organ size and image scale: never reused for another organ or size. */
export const organCacheKey = (id: string, rx: number, ry: number, px: number) => `${id}:${rx}:${ry}:${px}`;

/** The image's pixels per map unit: the on-screen scale rounded to a half (so small resizes don't rebuild it),
 *  at least ½, and never more than 4096 pixels across. */
export const organImageScale = (screenScale: number) =>
  Math.min(4096 / ORGAN_SPAN, Math.max(0.5, Math.round(screenScale * 2) / 2));
