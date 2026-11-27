// One shard of the balance lab: plays careers seeds [from, to) and writes their records as JSON to $BALANCE_OUT.
import { it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { playCareer } from './population';

export function shard(k: number, n = 8, total = Number(process.env.BALANCE_N ?? 200)) {
  const on = !!process.env.BALANCE_LAB;
  it.skipIf(!on)(`balance lab shard ${k}`, () => {
    const out = process.env.BALANCE_OUT ?? 'balance-out';
    mkdirSync(out, { recursive: true });
    const recs = [];
    for (let seed = 1 + k; seed <= total; seed += n) recs.push(playCareer(seed));
    writeFileSync(`${out}/shard-${k}.json`, JSON.stringify(recs));
  }, 3_600_000);
}
