// What the player is told about a pathogen they click: its details card. Pure functions of the game state.
import { CONFIG } from './config';
import { dist, siteById, VESSELS } from './level';
import { type State, type Pathogen, pathogenPos, iggMultiplier, selectableTargets, hasTarget, wallLeft, hidden, levelDef, income, hc } from './sim';
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
  // what it does here: this organ's own speed-up and harder hitters count
  const L = levelDef(s), mul = L.damageMul?.[q.type] ?? 1, speed = Math.round(st.speed * (hc(s).speed ?? 1) * (q.frenzy ?? 1) * 10) / 10;
  rows.push(`<p><b>Speed</b> ${speed}${q.slowT > 0 ? ` <i>(slowed by IgA to ×${q.slow})</i>` : ''} · <b>Organ damage</b> ${Math.round(st.heartDamage * mul)}${mul > 1 ? ` <i>(×${mul} in the ${esc(L.organ.toLowerCase())})</i>` : ''} · <b>Energy for a kill</b> ${Math.round(st.bounty * income(s))}</p>`);
  if (st.contactDps) rows.push(`<p><b>Harms a white cell</b> ${Math.round(st.contactDps * mul * 10) / 10} a second on contact</p>`);
  // how hard your IgG hits it: the best match among the targets you can aim at
  if (tx) {
    const best = selectableTargets(s).map((b) => iggMultiplier([b], q.type, s.perks.broad)).reduce((a, b) => Math.max(a, b), 0);
    rows.push(`<p><b>IgG</b> ×${best} at best with your targets${s.perks.broad ? ' (broad)' : ''}${hasTarget(s, tx.species) ? '' : ` (×3 once you aim at <i>${esc(CONFIG.pathogens[tx.species].plural)}</i>)`}</p>`);
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
  if (st.frenzy) traits.push(`Every antibody strike makes it faster: now ×${(q.frenzy ?? 1).toFixed(2)}, up to ×${st.frenzy.max}.`);
  if (st.dormant) traits.push((q.dormantT ?? 0) > 0 ? '<b>Dormant now</b>: nothing can touch it, and it wakes a quarter healed.' : `Goes dormant at half health (${st.dormant.times - (q.dormantUsed ?? 0)} more time${st.dormant.times - (q.dormantUsed ?? 0) === 1 ? '' : 's'}).`);
  if (st.ignoresCells) traits.push('White cells can\'t touch it.');
  if (st.switchesOffNodes) traits.push('Switches off every lymph node it passes, for the rest of the wave.');
  if (st.jumps) traits.push(q.jumped ? 'Has made its one jump.' : `Leaps once to another vessel, ${Math.round(st.jumps.at * 100)}% of the way in (now ${Math.round((q.s / VESSELS[q.vessel].length) * 100)}%).`);
  if (st.lodges && (!st.lodges.only || st.lodges.only === L.id)) traits.push(`<b>Lodges</b> if it reaches the ${esc(L.organ.toLowerCase())}: −${st.lodges.perWave} at the end of every wave until the organ ends.`);
  if (q.goalSite) { const site = siteById(q.goalSite); traits.push(`<b>Going for the lymph node</b> beside the ${esc((VESSELS[site.vessel]?.name ?? 'vessel').toLowerCase())}: it knocks it out for the wave if it gets there.`); }
  if (traits.length) rows.push(`<p class="sub">${traits.join(' ')}</p>`);
  return `<button class="x" data-act="closeInspect" aria-label="Close">×</button><h3>${st.boss ? '<span class="bossTag">BOSS</span> ' : ''}<i>${esc(st.name)}</i></h3>${rows.join('')}`;
}
