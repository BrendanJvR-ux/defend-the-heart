// The Pathogen Field Guide's entries: what each kind is, how to tell it, what it does, and a tactical note drawn from
// its actual behaviour (and a second, unlocked by defeating it two different ways).
import { CONFIG, LEVELS, type PathogenType } from './config';

export interface GuideEntry { name: string; kind: string; looks: string; traits: string[]; note: string; second: string }

const LOOKS: Partial<Record<PathogenType, string>> = {
  saureus: 'Round cocci in grape-like clusters.', spneumo: 'Lancet-shaped cocci in pairs, in a pale capsule.', listeria: 'Short rods tumbling end over end.',
  nmening: 'Bean-shaped cocci face to face in pairs, in a heavy capsule.', ecoli: 'Plump rods trailing flagella.', kpneumo: 'Fat rods in a thick, glistening capsule.',
  virus: 'A small faceted capsid studded with spikes.', jumper: 'A spiky capsid on springy legs.', hijacker: 'A faceted head on a tail and splayed legs, like a phage.',
  infected: 'One of your own white cells, purple with the virus inside it.', mtb: 'Slender rods in loose cords, waxy-walled.', hpylori: 'A curved, corkscrew rod with flagella at one end.',
  salmonella: 'Rods ringed with flagella.', spyogenes: 'Cocci in long chains.', paeruginosa: 'Rods with one whip-like flagellum.', chlamydia: 'Tiny round bodies, packed together.',
  colony: 'A great clump of staph.', flu: 'A swollen capsid shedding small viruses.', meningo: 'A giant meningococcus pair in its capsule.', hepatitis: 'A huge, slowly mending capsid.',
  sepsis: 'A great hijacker trailing infected cells.', plasmodium: 'A ring-shaped parasite inside a red blood cell.', granuloma: 'A walled ball of bacteria and cells.',
  burrower: 'A seething swarm of H. pylori.', necrotizer: 'A chain of strep tearing at the vessel wall.', herpes: 'A large capsid in a lumpy envelope.', hiv: 'A round virus studded with knobs.',
};

/** Where it comes, in campaign order. */
function comesIn(t: PathogenType): string {
  const where = LEVELS.filter((L) => L.waves.some((w) => w.groups.some((g) => g.type === t))).map((L) => L.title.replace(/^The /, '').toLowerCase());
  return where.length ? `Comes in: ${where.join(', ')}.` : 'Comes only in endless.';
}

export function guideEntry(t: PathogenType): GuideEntry {
  const st = CONFIG.pathogens[t], tx = st.taxon;
  const kind = st.boss ? 'Boss' : tx ? `${tx.gram === '+' ? 'Gram-positive' : 'Gram-negative'} ${tx.shape}` : t === 'infected' ? 'Infected white cell' : t === 'plasmodium' ? 'Parasite' : 'Virus';
  const traits = [`${st.hp} health · speed ${st.speed} · ${st.heartDamage} organ damage.`, comesIn(t)];
  if (st.infects) traits.push(st.infectsMany ? 'Infects every white cell it touches.' : 'Infects the first white cell it touches.');
  if (st.slowImmune) traits.push('IgA cannot slow it.');
  if (st.acidProof) traits.push('Acid-proof: stomach acid heals it.');
  if (st.regen) traits.push(`Heals ${st.regen} a second.`);
  if (st.sheds) traits.push(`Releases a ${CONFIG.pathogens[st.sheds.type].name.toLowerCase()} every ${st.sheds.every} s.`);
  if (st.splitInto) traits.push(`Bursts into ${st.splitInto.count} ${CONFIG.pathogens[st.splitInto.type].plural}.`);
  if (st.walled) traits.push('Walled: takes a quarter damage until enough antibodies have struck.');
  if (st.hides || st.burrows) traits.push(st.burrows ? 'Burrows out of reach every few seconds.' : 'Hides in a red blood cell every few seconds.');
  if (st.frenzy) traits.push('Every antibody strike makes it faster.');
  if (st.dormant) traits.push('Goes dormant at half health, then wakes partly healed.');
  if (st.ignoresCells) traits.push('White cells can\'t touch it.');
  if (st.switchesOffNodes) traits.push('Switches off the lymph nodes it passes.');
  if (st.jumps) traits.push('Leaps once to another vessel.');
  if (st.lodges) traits.push(`Lodges in the ${st.lodges.only ?? 'organ'} if it gets through: health lost every wave after.`);
  const species = tx ? CONFIG.pathogens[tx.species].plural : '';
  const note = st.ignoresCells ? 'White cells and the pulse can\'t reach it: only lymph nodes stop it, so stack IgM and IgE far out on its vessel.'
    : st.infects ? 'It turns white cells against you: kill it with nodes before your cells meet it, or keep the cells on another vessel.'
    : st.walled ? 'Its wall soaks up most of every hit until enough antibodies land: many fast-firing nodes, or the pulse, break it.'
    : st.frenzy ? 'Each hit speeds it up: slow it with IgA where it enters and finish it fast with IgE.'
    : st.jumps ? 'It leaps to another vessel partway in: guard the inner sites of more than one vessel.'
    : st.dormant ? 'It comes back healed: keep enough on its vessel to finish it after it wakes.'
    : tx ? `IgG aimed at ${species} hits it three times as hard; other bacteria of its shape take two and a half times.`
    : 'Fast and fragile: IgM and IgE finish it in a hit or two, and IgA slows the group so they land.';
  const second = st.boss ? 'Annotated: the boss comes up every vessel in its wave, each carrying a share of its health; the pulse takes a third of one, and the local antibiotic (bacterial bosses only) works on it at reduced strength.'
    : tx ? `Annotated: the local antibiotic works on every ${species === '' ? 'bacterium' : species} in its vessel for its whole course, so a dose is best spent where a group is about to arrive; viruses and your own cells are untouched by it.`
    : t === 'infected' ? 'Annotated: an infected cell heads for the nearest lymph node on its vessel and knocks it out for the wave; nodes and the pulse stop it.'
    : 'Annotated: antibiotics do nothing to it. Count on nodes, white cells and the pulse, and keep NO for the vessel it crowds.';
  return { name: st.name, kind, looks: LOOKS[t] ?? (st.short ?? ''), traits, note, second };
}
