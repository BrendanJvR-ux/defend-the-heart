// Which sounds to play for what happened in the game since the last frame (the sounds themselves are in sound.ts).
import { CONFIG } from './config';
import { type State, levelDef } from './sim';
import { sfx } from './sound';

// ── Sound: played for what happened since the last frame ──
const heardRings = new WeakSet<object>(), heardBosses = new Set<number>();
let heardPhase = '', beatT = 0;
export function playSounds(s: State, dt: number) {
  for (const r of s.rings) {
    if (heardRings.has(r)) continue;
    heardRings.add(r);
    if (r.kind === 'pop') sfx.pop();
    else if (r.kind === 'heart') sfx.hit();
    else if (r.kind === 'sacrifice') sfx.sacrifice();
    else if (r.kind === 'cellDown' || r.kind === 'infect') sfx.cellLost();
    else if (r.kind === 'build') sfx.build();
    else if (r.kind === 'jump') sfx.jump();
    else if (r.kind === 'knock') sfx.knock();
    else if (r.kind === 'lodge') sfx.lodge();
    else if (r.kind === 'cancel') sfx.cancel();
    else if (r.kind === 'burst') sfx.burst();
  }
  // one horn for a boss wave, not one for every vessel's boss
  for (const p of s.pathogens) if (CONFIG.pathogens[p.type].boss && !heardBosses.has(p.id)) { if (!s.pathogens.some((q) => q !== p && heardBosses.has(q.id) && q.hp > 0)) sfx.boss(); heardBosses.add(p.id); }
  if (s.phase !== heardPhase) {
    if (s.phase === 'combat' && heardPhase === 'prep') sfx.wave();
    else if (s.phase === 'victory') sfx.win();
    else if (s.phase === 'defeat') sfx.lose();
    heardPhase = s.phase;
  }
  // a heartbeat under the wave once the organ has lost a fifth of its health, faster and louder as it weakens
  if (s.phase === 'combat' && !s.paused && s.heartHp < levelDef(s).hp * 0.8) {
    const k = 1 - s.heartHp / levelDef(s).hp;
    beatT -= dt;
    if (beatT <= 0) { beatT = 1.1 - 0.55 * k; sfx.beat(0.35 + 0.65 * k); }
  }
}
