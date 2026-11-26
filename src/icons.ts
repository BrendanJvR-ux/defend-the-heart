// Small pictures for the page (panel, shop, cards): pathogens, white cells and lymph nodes drawn once on a canvas in
// the map's own style, kept as image data.
import { CONFIG, type NodeType, type PathogenType } from './config';
import { drawPathogen, drawWhiteCell, drawNodeIcon } from './draw';

const icons = new Map<string, string>();
/** An <img> of a pathogen or a white cell, `size` pixels square. */
export function icon(kind: PathogenType | 'cell', size = 36): string {
  const key = kind + size;
  if (!icons.has(key)) {
    const c = document.createElement('canvas'); const dpr = 2; c.width = size * dpr; c.height = size * dpr;
    const x = c.getContext('2d')!; x.scale(dpr, dpr);
    if (kind === 'cell') drawWhiteCell(x, size / 2, size / 2, 0, 0, size / 60);
    else drawPathogen(x, kind, size / 2, size / 2, 0, 0, CONFIG.pathogens[kind].boss ? size / 100 : CONFIG.pathogens[kind].taxon ? size / 44 : size / 36);
    icons.set(key, c.toDataURL());
  }
  return `<img class="ico" alt="" width="${size}" height="${size}" src="${icons.get(key)}">`;
}
/** The image data of a lymph node of this type (for an <img src>). */
export function nodeIcon(t: NodeType): string {
  const key = 'node-' + t;
  if (!icons.has(key)) {
    const c = document.createElement('canvas'); c.width = 88; c.height = 68;
    const x = c.getContext('2d')!; x.scale(2, 2); drawNodeIcon(x, t, 22, 18, 0.48);
    icons.set(key, c.toDataURL());
  }
  return icons.get(key)!;
}
