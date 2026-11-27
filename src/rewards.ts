// The pages for permanent rewards: the Pathogen Field Guide, the Anatomy Atlas (organ mastery's home) and the mastery
// card shown while preparing. HTML only; main.ts shows them in the menu and acts on their buttons (data-menu).
import { CONFIG, LEVELS, type PathogenType } from './config';
import { type State } from './sim';
import { type Career } from './career';
import { type Progress, methodsFor, METHOD_NAMES, secondDiscovery } from './progress';
import { SEALS, STEWARDSHIP, stewardshipOpen } from './mastery';
import { guideEntry } from './guide';
import { organArt } from './draw';
import { icon } from './icons';
import { esc } from './text';

/** Each seal's own mark, so progress reads without colour: earned filled, missing hollow. */
const MARKS = [['◆', '◇'], ['●', '○'], ['▲', '△']];
export const sealMark = (i: number, earned: boolean) => `<span class="seal ${earned ? 'on' : ''}" aria-hidden="true">${MARKS[i][earned ? 0 : 1]}</span>`;
const sealsOf = (p: Progress, id: string) => p.seals[id] ?? [];
const organName = (i: number) => LEVELS[i].title.replace(/^The /, '');

// organ pictures for the Atlas, made once from the organs' own drawings
const pics = new Map<string, string>();
function organPic(i: number): string {
  const L = LEVELS[i];
  if (!pics.has(L.id)) pics.set(L.id, organArt(L, 0.3).img.toDataURL());
  return pics.get(L.id)!;
}

/** The Atlas: every organ in campaign order; a silhouette until unlocked, inked once cleared, in colour with all three seals. */
export function atlasHtml(p: Progress, unlocked: number): string {
  const cards = LEVELS.map((L, i) => {
    const got = sealsOf(p, L.id), n = SEALS[L.id].filter((x) => got.includes(x.id)).length;
    const state = i >= unlocked && !got.length ? 'unknown' : n === 3 ? 'colour' : got.includes('clear') ? 'ink' : 'faint';
    const marks = SEALS[L.id].map((x, k) => sealMark(k, got.includes(x.id))).join('');
    return `<button data-menu="atlasOrgan" data-level="${i}" class="atlasCard ${state}" aria-label="${esc(organName(i))}: ${state === 'unknown' ? 'not yet discovered' : `${n} of 3 seals`}">
      <img alt="" src="${organPic(i)}"><b>${i + 1}. ${state === 'unknown' ? '?' : esc(organName(i))}</b><span class="marks">${marks}</span><small>${n} of 3 seals</small></button>`;
  }).join('');
  return `<h2>Anatomy Atlas</h2><p class="sub">Every organ, in the order the campaign meets them. An organ is a faint silhouette until you reach it, inked once cleared, and in full colour once all three of its seals are earned. Open one for its seals and goals.</p>
    <div class="atlas">${cards}</div><p><button data-menu="back">Back</button></p>`;
}

/** An organ's Atlas page: its mechanic, its seals (earned, and the exact goals still open), and a replay button. */
export function atlasOrganHtml(p: Progress, career: Career, i: number, unlocked: number): string {
  const L = LEVELS[i], got = sealsOf(p, L.id), known = i < unlocked || got.length > 0;
  const seals = SEALS[L.id].map((x, k) => `<li class="${got.includes(x.id) ? 'done' : ''}">${sealMark(k, got.includes(x.id))}<span><b>${esc(x.title)}</b>${got.includes(x.id) ? ' <small>earned</small>' : ''}<small>${esc(x.goal)}</small></span></li>`).join('');
  const stew = L.id === STEWARDSHIP.organ && (career.cleared[CONFIG.antibiotic.unlockAfter - 1] || p.stewardship)
    ? `<h3>Antibiotic mastery</h3><ul class="sealList"><li class="${p.stewardship ? 'done' : ''}"><span class="seal ${p.stewardship ? 'on' : ''}" aria-hidden="true">${p.stewardship ? '✚' : '✛'}</span><span><b>${STEWARDSHIP.title}</b>${p.stewardship ? ' <small>earned: Burst treatment unlocked</small>' : ''}<small>${esc(STEWARDSHIP.goal)}</small></span></li></ul>` : '';
  const n = SEALS[L.id].filter((x) => got.includes(x.id)).length;
  return `<div class="atlasPage"><img class="atlasPic ${!known ? 'unknown' : n === 3 ? 'colour' : got.includes('clear') ? 'ink' : 'faint'}" alt="" src="${organPic(i)}">
    <h2>${i + 1}. ${known ? esc(L.title) : 'Not yet discovered'}</h2>
    ${known ? `<p class="sub"><b>${esc(L.feature)}</b>. ${esc(L.twist)}</p><p class="sub needs">${esc(L.handicap.text)}</p>` : '<p class="sub">Clear the organs before it to reach it.</p>'}
    <h3>Seals · ${n} of 3</h3><ul class="sealList">${seals}</ul>${stew}
    <div class="menuButtons">${i < unlocked ? `<button data-menu="level" data-level="${i}" class="primary">Replay ${esc(organName(i).toLowerCase())}<small>seals can be earned on any clear; gold on a replay is a quarter</small></button>` : '<button disabled>Locked</button>'}
    <button data-menu="atlas">Back to the Atlas</button></div></div>`;
}

/** The mastery card for the organ being prepared: each seal with its progress so far. */
export function masteryCardHtml(s: State, p: Progress): string {
  if (s.endless) return '';
  const L = LEVELS[s.level], got = sealsOf(p, L.id);
  const rows = SEALS[L.id].map((x, k) => {
    const done = got.includes(x.id);
    return `<li>${sealMark(k, done)}<span><b>${esc(x.title)}</b>${done ? ' <small>earned</small>' : ''}<small>${esc(x.goal)}</small>${!done && x.progress ? `<small class="prog">${esc(x.progress(s))}</small>` : ''}</span></li>`;
  }).join('');
  const stew = stewardshipOpen(s) ? `<li><span class="seal ${p.stewardship ? 'on' : ''}" aria-hidden="true">${p.stewardship ? '✚' : '✛'}</span><span><b>${STEWARDSHIP.title}</b>${p.stewardship ? ' <small>earned</small>' : ''}<small>${esc(STEWARDSHIP.goal)}</small><small class="prog">${esc(STEWARDSHIP.progress(s))}</small></span></li>` : '';
  return `<section class="card mastery"><h3>Mastery <span class="count">${SEALS[L.id].filter((x) => got.includes(x.id)).length} of 3</span></h3><ul class="sealList small">${rows}${stew}</ul></section>`;
}

/** The Field Guide's index: every kind, a question mark until it has been met. */
export function guideHtml(p: Progress): string {
  const kinds = Object.keys(CONFIG.pathogens) as PathogenType[];
  const seen = kinds.filter((t) => p.seen.includes(t)).length, full = kinds.filter((t) => secondDiscovery(p, t)).length;
  const cards = kinds.map((t) => {
    const met = p.seen.includes(t), two = secondDiscovery(p, t);
    return met ? `<button data-menu="guideEntry" data-type="${t}" class="guideCard">${icon(t, 44)}<span><b>${esc(CONFIG.pathogens[t].name)}</b><small>${two ? '★ both discoveries' : `${p.methods[t]?.length ?? 0} of 2 methods recorded`}</small></span></button>`
      : '<div class="guideCard unknown" aria-label="Not yet met"><span class="q">?</span><span><b>Not yet met</b><small>It appears when you meet it in battle</small></span></div>';
  }).join('');
  return `<h2>Pathogen Field Guide</h2><p class="sub">${seen} of ${kinds.length} kinds met · ${full} with both discoveries. An entry opens the first time a kind appears in battle; its second discovery comes from defeating that kind by two different methods (the final blow counts), across any runs.</p>
    <div class="guide">${cards}</div><p><button data-menu="back">Back</button></p>`;
}

/** One kind's page: its picture, what it is, how to tell it, what it does, a tactical note; and, once defeated by two
 *  methods, an annotated note. */
export function guideEntryHtml(p: Progress, t: PathogenType): string {
  const e = guideEntry(t), have = p.methods[t] ?? [], can = methodsFor(t), two = secondDiscovery(p, t);
  const methods = can.map((m) => `<li class="${have.includes(m) ? 'done' : ''}">${have.includes(m) ? '✓' : '·'} ${esc(METHOD_NAMES[m])}</li>`).join('');
  return `<div class="guideEntry">${icon(t, 120)}<h2>${esc(e.name)}</h2><p class="kicker">${esc(e.kind)}</p>
    <p><b>How to tell it:</b> ${esc(e.looks)}</p><ul class="traits">${e.traits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="tip"><b>Tactics:</b> ${esc(e.note)}</p>
    <h3>Defeated by (${have.length} of 2 for the second discovery)</h3><ul class="methods">${methods}</ul>
    ${two ? `<p class="tip second"><b>Second discovery.</b> ${esc(e.second)}</p>` : '<p class="sub">Defeat it with two different methods to reveal its annotated note.</p>'}
    <p><button data-menu="guide">Back to the Guide</button></p></div>`;
}
