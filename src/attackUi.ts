// Attack mode's pages: the organ picker, the attack planner, the panel while it plays out, and the result.
// HTML only; main.ts wires the buttons (data-menu in the menu, data-act on the panel and the result screen).
import { CONFIG, LEVELS, BACTERIA, type PathogenType } from './config';
import { ATTACK, ATTACK_TYPES, attackBudget, attackVessels, checkPlan, groupCost, isBoss, pathogenCost, type AttackGroup } from './attack';
import { aliveCells, cellCount, type State } from './sim';
import { VESSELS, entryOf } from './level';
import { esc } from './text';

export interface AttackDraft { level: number; groups: AttackGroup[] }
const organName = (i: number) => LEVELS[i].title.replace(/^The /, '');

/** A first plan for an organ: ten S. aureus up its first vessel. */
export const freshDraft = (level: number): AttackDraft => ({ level, groups: [{ type: 'saureus', vessel: attackVessels(level)[0].id, count: 10, delay: 0 }] });

/** The most of this group's kind the budget still allows, the rest of the plan as it is. */
export function maxCount(d: AttackDraft, i: number): number {
  const g = d.groups[i], others = d.groups.reduce((a, x, k) => a + (k === i ? 0 : groupCost(x)), 0);
  const cap = isBoss(g.type) ? 1 : ATTACK.maxCount;
  return Math.max(1, Math.min(cap, Math.floor((attackBudget(d.level) - others) / pathogenCost(g.type))));
}

export function organPickerHtml(): string {
  return `<h2>Attack mode</h2><p class="kicker">You are the infection</p>
    <p class="sub">Choose an organ to attack. Its defender builds lymph nodes with all its energy, without seeing your plan, then dilates vessels with NO and fires the immune pulse as your pathogens come. Bring the organ's health to 0 to win. Nothing here touches your career, its saves or its gold.</p>
    <div class="menuButtons attackOrgans">${LEVELS.map((l, i) => `<button data-menu="attackPick" data-level="${i}">${i + 1}. ${esc(organName(i))}<small>${l.hp} health · ${l.map.vessels.length} vessels · budget ${attackBudget(i)}</small></button>`).join('')}</div>
    <p><button data-menu="back">Back</button></p>`;
}

const typeLabel = (t: PathogenType) => `${CONFIG.pathogens[t].taxon ? CONFIG.pathogens[t].plural : CONFIG.pathogens[t].name} · ${pathogenCost(t)}`;
function typeSelect(g: AttackGroup, i: number, bossTaken: boolean): string {
  const opt = (t: PathogenType) => `<option value="${t}" ${t === g.type ? 'selected' : ''} ${isBoss(t) && bossTaken && !isBoss(g.type) ? 'disabled' : ''}>${esc(typeLabel(t))}</option>`;
  const viruses = ATTACK_TYPES.filter((t) => !isBoss(t) && !CONFIG.pathogens[t].taxon), bosses = ATTACK_TYPES.filter(isBoss);
  return `<select data-ag="type" data-i="${i}" aria-label="Pathogen for group ${i + 1}"><optgroup label="Bacteria">${BACTERIA.map(opt).join('')}</optgroup><optgroup label="Viruses">${viruses.map(opt).join('')}</optgroup><optgroup label="Bosses (one, alone)">${bosses.map(opt).join('')}</optgroup></select>`;
}
/** One line on what a kind of pathogen is like, from its stats. */
function statLine(t: PathogenType): string {
  const st = CONFIG.pathogens[t];
  const tricks = [st.infects ? 'infects white cells' : '', st.jumps ? 'jumps vessel' : '', st.lodges ? 'lodges' : '', st.slowImmune ? 'IgA can\'t slow it' : ''].filter(Boolean);
  const hp = Math.round(st.hp * (st.boss ? CONFIG.bossEveryVessel.hpShare : 1));
  return `${hp} health · speed ${st.speed} · ${Math.round(st.heartDamage * (st.boss ? CONFIG.bossEveryVessel.hpShare : 1))} damage${st.short ? ` · ${st.short}` : ''}${tricks.length ? ` · ${tricks.join(', ')}` : ''}`;
}

export function plannerHtml(d: AttackDraft): string {
  const L = LEVELS[d.level], chk = checkPlan(d.level, d.groups), vs = attackVessels(d.level);
  const bossTaken = d.groups.some((g) => isBoss(g.type));
  const pct = Math.min(100, (chk.cost / chk.budget) * 100);
  const rows = d.groups.map((g, i) => `<li class="agroup">
      <div class="agTop">${typeSelect(g, i, bossTaken)}
        <select data-ag="vessel" data-i="${i}" aria-label="Vessel for group ${i + 1}">${vs.map((v) => `<option value="${v.id}" ${v.id === g.vessel ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
        <button data-menu="agRemove" data-i="${i}" class="x" aria-label="Remove group ${i + 1}" ${d.groups.length > 1 ? '' : 'disabled'}>×</button></div>
      <div class="agBottom">
        <span class="stepper" aria-label="How many"><button data-menu="agStep" data-i="${i}" data-f="count" data-d="-1" ${g.count > 1 ? '' : 'disabled'} aria-label="One fewer">−</button><b>${g.count}</b><button data-menu="agStep" data-i="${i}" data-f="count" data-d="1" ${g.count < maxCount(d, i) ? '' : 'disabled'} aria-label="One more">+</button><button data-menu="agMax" data-i="${i}" class="small" ${g.count < maxCount(d, i) ? '' : 'disabled'}>Max</button></span>
        <span class="stepper" aria-label="Send delay"><small>after</small><button data-menu="agStep" data-i="${i}" data-f="delay" data-d="-2" ${g.delay > 0 ? '' : 'disabled'} aria-label="Send sooner">−</button><b>${g.delay} s</b><button data-menu="agStep" data-i="${i}" data-f="delay" data-d="2" ${g.delay < ATTACK.maxDelay ? '' : 'disabled'} aria-label="Send later">+</button></span>
        <span class="agCost">${groupCost(g)}</span></div>
      <small class="agInfo">${esc(statLine(g.type))}</small></li>`).join('');
  return `<h2>Attack the ${esc(organName(d.level).toLowerCase())}</h2>
    <p class="sub">Its defender has ${L.startEnergy} energy for lymph nodes, ${L.cells} white cell${L.cells === 1 ? '' : 's'} and ${L.hp} health. ${esc(L.feature)}. Choose what to send, up which vessel, how many and when.</p>
    <p class="budget ${chk.cost > chk.budget ? 'over' : ''}"><span><b>${chk.cost}</b> of ${chk.budget} spent</span><span class="bar"><i style="width:${pct}%"></i></span></p>
    <ol class="attackGroups">${rows}</ol>
    <p><button data-menu="agAdd" ${d.groups.length < ATTACK.maxGroups && chk.cost < chk.budget ? '' : 'disabled'}>+ Add a group</button></p>
    ${chk.ok ? '' : `<p class="needs">${esc(chk.reason)}</p>`}
    <div class="menuButtons"><button data-menu="attackLaunch" class="primary" ${chk.ok ? '' : 'disabled'}>Launch the attack<small>then watch the defender respond</small></button><button data-menu="attack">Another organ</button><button data-menu="back">Menu</button></div>`;
}

/** The panel while an attack plays out: how much is still to come, what the defender is doing. */
export function attackPanelHtml(s: State, d: AttackDraft): string {
  const L = LEVELS[s.level], waiting = s.spawns.length, live = s.pathogens.filter((p) => p.hp > 0).length;
  const sent = d.groups.reduce((a, g) => a + g.count, 0);
  const open = s.open.map((v) => esc((VESSELS[v]?.name ?? v).toLowerCase()));
  const byEntry = attackVessels(s.level).map((v) => [v.name, s.pathogens.filter((p) => p.hp > 0 && entryOf(p.vessel) === v.id).length] as const).filter(([, n]) => n);
  return `<h2><small>Attack mode</small>Attacking the ${esc(organName(s.level).toLowerCase())}</h2>
    <section class="card"><h3>Your attack <span class="count">${sent} sent</span></h3>
      <p class="hint small">${waiting ? `${waiting} still to enter · ` : ''}${live} in the vessels · ${s.killed} destroyed</p>
      ${byEntry.length ? `<p class="hint small">${byEntry.map(([n, k]) => `${esc(n)}: ${k}`).join(' · ')}</p>` : ''}</section>
    <section class="card"><h3>The defender <span class="count">${s.heartHp}/${L.hp} health</span></h3>
      <p class="hint small">${s.nodes.length} lymph nodes · ${aliveCells(s).length} of ${cellCount(s)} white cells · ${Math.floor(s.no)} NO</p>
      <p class="hint small">${open.length ? `Dilating the ${open.join(' and the ')}.` : 'Every vessel resting.'} Pulse ${s.pulsesLeft > 0 ? 'ready' : 'used'}.</p></section>
    <div class="flist"><button data-act="attackReplan">${s.phase === 'combat' ? 'Stop and re-plan' : 'Re-plan'}</button><button data-act="attackOrgans">Another organ</button></div>`;
}

/** The result: the organ fell, or held, and a word on why. */
export function attackResultHtml(s: State, d: AttackDraft, won: boolean): string {
  const L = LEVELS[s.level], org = organName(s.level).toLowerCase(), cost = d.groups.reduce((a, g) => a + groupCost(g), 0);
  const leaks = Object.entries(s.leaks.byVessel).sort((a, b) => b[1] - a[1]);
  const top = leaks[0] ? `Most damage came up the ${esc(attackVessels(s.level).find((v) => v.id === leaks[0][0])?.name.toLowerCase() ?? leaks[0][0])}.` : 'Nothing reached it.';
  const tip = won ? '' : `<p class="tip"><b>Try:</b> ${s.infections ? 'the hijackers took white cells: send more of them first, and something tough behind.' : 'put everything up one or two vessels: the defender spreads its nodes over all of them, and can dilate only where it has white cells.'} Viruses are fast but frail; bacteria are slow but tough, and an IgG aimed at them hits three times as hard.</p>`;
  return `<div class="plate"><p class="kicker">Attack mode · ${cost} of ${attackBudget(s.level)} spent</p>
    <h2>${won ? `The ${esc(org)} has fallen` : `The ${esc(org)} held`}</h2>
    <p>${won ? `Your attack brought its ${L.hp} health to 0 in ${Math.round(s.waveTime)} s.` : `It kept ${s.heartHp} of ${L.hp} health; ${s.killed} of your pathogens were destroyed.`} ${top}${s.infections ? ` ${s.infections} white cell${s.infections === 1 ? ' was' : 's were'} infected.` : ''}</p>${tip}
    <button data-act="attackReplan" class="primary">${won ? 'Plan another attack' : 'Re-plan the attack'}</button> <button data-act="attackOrgans">Another organ</button></div>`;
}
