// Prints the summary of a balance-lab run: npx tsx tests/balance/report.ts <dir>
import { readdirSync, readFileSync } from 'node:fs';
import { summarize, type CareerRecord } from './population';
const dir = process.argv[2] ?? 'balance-out';
const rs: CareerRecord[] = readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const S = summarize(rs), p = (x: number) => (Number.isNaN(x) ? '  - ' : `${Math.round(x * 100)}%`.padStart(4));
console.log(`careers ${S.careers}  finished ${p(S.finished)}  (weak ${p(S.finishedWeak)} mid ${p(S.finishedMid)} strong ${p(S.finishedStrong)})  plays per finished career ${S.plays.toFixed(1)}`);
console.log('stuck at', JSON.stringify(S.stuckAt));
console.log('organ       reached first  weak  mid strong cleared tries  hp');
for (const o of S.organs) console.log(`${o.id.padEnd(11)} ${String(o.reached).padStart(5)}   ${p(o.firstTry)}  ${p(o.weak)} ${p(o.mid)}  ${p(o.strong)}   ${p(o.cleared)}  ${o.attempts.toFixed(2)} ${p(o.hp)}`);
console.log('losses by wave:');
for (const [i, o] of S.organs.entries()) { const w: Record<number, number> = {}; for (const r of rs) for (const x of r.organs[i]?.lost ?? []) w[x] = (w[x] ?? 0) + 1; if (Object.keys(w).length) console.log(' ', o.id, JSON.stringify(w)); }
