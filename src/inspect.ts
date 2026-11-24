// What the player is told about a pathogen they click: its details card. Pure functions of the game state.
import { CONFIG } from './config';
import { dist } from './level';
import { type State, type Pathogen, pathogenPos, iggMultiplier, selectableTargets, hasTarget, wallLeft, hidden, levelDef } from './sim';
import { esc } from './text';

/** The pathogen under a point (bosses are bigger targets), if any. */
export function pathogenAt(s: State, p: { x: number; y: number }, touch: boolean): Pathogen | null {
  let best: Pathogen | null = null, bd = Infinity;
  for (const q of s.pathogens) {
    if (q.hp <= 0 || q.s <= 0) continue;
    // small enough that the rest of a busy vessel still opens it when clicked
    const st = CONFIG.pathogens[q.type], d = dist(p, pathogenPos(q)), reach = (st.boss ? 44 : q.type === 'infected' ? 20 : 16) + (touch ? 8 : 0);
    if (d <= reach && d < bd) { bd = d; best = q; }
  }
  return best;
}

export function inspectHtml(s: State, q: Pathogen): string {
  const st = CONFIG.pathogens[q.type], tx = st.taxon;
  const rows: string[] = [];
  rows.push(`<p class="sub">${esc(tx ? `${tx.gram === '+' ? 'Gram+' : 'Gram−'} ${tx.shape}${st.short ? ` · ${st.short.replace(/^Gram[+−-] (coccus|rod),? ?/, '')}` : ''}` : st.short ?? (st.boss ? 'Boss' : 'Virus'))}</p>`);
  rows.push(`<p><b>Health</b> ${Math.ceil(q.hp)} / ${q.maxHp}</p><p class="nogauge"><i style="width:${Math.max(0, (q.hp / q.maxHp) * 100)}%"></i></p>`);
  rows.push(`<p><b>Speed</b> ${st.speed}${q.slowT > 0 ? ` <i>(slowed by IgA to ×${q.slow})</i>` : ''} · <b>Organ damage</b> ${st.heartDamage} · <b>Energy for a kill</b> ${Math.round(st.bounty * (levelDef(s).income ?? 1))}</p>`);
  if (st.contactDps) rows.push(`<p><b>Harms a white cell</b> ${st.contactDps} a second on contact</p>`);
  // how hard your IgG hits it: the best match among the targets you can aim at
  if (tx) {
    const best = selectableTargets(s).map((b) => iggMultiplier([b], q.type)).reduce((a, b) => Math.max(a, b), 0);
    rows.push(`<p><b>IgG</b> ×${best} at best with your targets${hasTarget(s, tx.species) ? '' : ` (×3 once you aim at <i>${esc(CONFIG.pathogens[tx.species].plural)}</i>)`}</p>`);
  } else rows.push('<p><b>IgG</b> ×0.25: not a bacterium. IgM and IgE are best.</p>');
  const traits: string[] = [];
  if (st.infects) traits.push(st.infectsMany ? 'Infects every white cell it touches.' : 'Infects the first white cell it touches.');
  if (st.acidProof) traits.push('Acid-proof: stomach acid heals it.');
  if (st.slowImmune) traits.push('IgA cannot slow it.');
  if (st.regen) traits.push(`Heals ${st.regen} a second.`);
  if (st.sheds) traits.push(`Releases a ${CONFIG.pathogens[st.sheds.type].name.toLowerCase()} every ${st.sheds.every} s.`);
  if (st.splitInto) traits.push(`Bursts into ${st.splitInto.count} ${CONFIG.pathogens[st.splitInto.type].plural}.`);
  if (st.walled) traits.push(wallLeft(q) > 0 ? `Walled: a quarter damage until ${wallLeft(q)} more antibody strikes break the wall.` : 'Its wall is broken.');
  if (st.hides || st.burrows) traits.push(hidden(s, q) ? `<b>${st.burrows ? 'Burrowed' : 'Hiding'} now</b>: nothing can touch it.` : st.burrows ? 'Burrows into the lining every few seconds.' : 'Hides in a red blood cell every few seconds.');
  if (traits.length) rows.push(`<p class="sub">${traits.join(' ')}</p>`);
  return `<button class="x" data-act="closeInspect" aria-label="Close">×</button><h3>${st.boss ? '<span class="bossTag">BOSS</span> ' : ''}<i>${esc(st.name)}</i></h3>${rows.join('')}`;
}
