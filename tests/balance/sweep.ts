// Sweeps one organ's starting energy and health for the lab's population: npx vite-node tests/balance/sweep.ts <organ> <energies> [hp] [gold]
import { LEVELS } from '../../src/config';
import { freshCareer, buy, type UpgradeId } from '../../src/career';
import { organSpecies } from '../players';
import { makeSkill, playOrgan } from './population';
const [id, list, hpArg, goldArg] = process.argv.slice(2);
const i = LEVELS.findIndex((L) => L.id === id), L = LEVELS[i] as { startEnergy: number; hp: number };
const career = () => {
  const c = freshCareer(); c.gold = Number(goldArg ?? 90 * (i + 1) * (i + 2) / 2);
  for (let k = 0; k <= i; k++) for (const b of organSpecies(k)) if (b !== 'saureus') buy(c, `target-${b}` as UpgradeId);
  for (const u of ['dmg-igm', 'dmg-igg', 'dmg-iga', 'dmg-igm', 'dmg-igg', 'broad', 'no', 'dmg-ige', 'dmg-iga', 'extraNode', 'cheapFirst', 'no'] as UpgradeId[]) buy(c, u);
  for (let k = 0; k < i; k++) c.cleared[k] = true;
  return c;
};
if (hpArg) L.hp = Number(hpArg);
for (const e of list.split(',').map(Number)) {
  L.startEnergy = e;
  let win = 0, hp = 0; const w: Record<number, number> = {}; const n = 120;
  for (let seed = 1; seed <= n; seed++) { const s = playOrgan(i, career(), makeSkill(seed), seed * 7 + 3); if (s.phase === 'victory') { win++; hp += s.heartHp; } else w[s.wave] = (w[s.wave] ?? 0) + 1; }
  console.log(`${id} energy ${e} hp ${L.hp}: win ${Math.round(100 * win / n)}%  hp ${(hp / Math.max(1, win)).toFixed(1)}  lost ${JSON.stringify(w)}`);
}
