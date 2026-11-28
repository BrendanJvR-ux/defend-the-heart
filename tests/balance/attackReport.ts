// 100 Attack mode matches (ten per organ, best of three), and how often the attacker takes the match:
// npx vite-node tests/balance/attackReport.ts [matches per organ]
import { LEVELS } from '../../src/config';
import { playMatch, attackSummary } from './attackers';
const per = Number(process.argv[2] ?? 10), rs = [];
for (let i = 0; i < LEVELS.length; i++) for (let k = 1; k <= per; k++) rs.push(playMatch(i, k * 13 + i));
const S = attackSummary(rs), p = (x: number) => (Number.isNaN(x) ? ' - ' : `${Math.round(100 * x)}%`);
console.log(`matches ${S.matches}: attacker takes ${p(S.match)} (single attacks ${p(S.attack)}; went to a third ${p(S.rounds)})`);
console.log(`by skill: weak ${p(S.weak)} mid ${p(S.mid)} strong ${p(S.strong)}   by style: ${Object.entries(S.styles).map(([k, v]) => `${k} ${p(v)}`).join(', ')}`);
console.log(S.organs.map((o) => `${o.id} ${p(o.match)}`).join(' · '));
