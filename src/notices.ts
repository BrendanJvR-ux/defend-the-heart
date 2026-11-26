// Messages beside the map, never over the play: a strip at the top of the side column holding the boss bar, the
// wave's hint as each wave starts, short notes (toasts, and what the simulation reports in `s.notices`), the organ's
// label and one-time tips (those two are filled in by main.ts).
import { CONFIG } from './config';
import { type State, activeBosses, wave, totalWaves } from './sim';
import { esc } from './text';

export function createNotices(strip: HTMLElement, toastEl: HTMLElement, bossBarEl: HTMLElement) {
  let toastT = 0, bossSig = '', hintT = 0, hintFor = '';
  const hintEl = document.createElement('div');
  hintEl.id = 'waveHint'; hintEl.hidden = true; hintEl.setAttribute('role', 'status'); hintEl.setAttribute('aria-live', 'polite');
  strip.prepend(hintEl);
  strip.prepend(bossBarEl);
  hintEl.addEventListener('click', () => { hintT = 0; hintEl.hidden = true; });

  /** A short note for a couple of seconds. */
  function toast(text: string) { toastEl.textContent = text; toastEl.hidden = false; toastT = 2.6; }

  /** While a boss is in play: its name, how many, and their health together (those still to come counted in). */
  function bossBar(s: State) {
    const bs = activeBosses(s), b = bs[0];
    let html = '';
    if (b && s.phase === 'combat') {
      const st = CONFIG.pathogens[b.type], coming = s.spawns.filter((x) => CONFIG.pathogens[x.type].boss).length, n = bs.length + coming;
      const hp = Math.ceil(bs.reduce((a, p) => a + p.hp, 0) + coming * b.maxHp), max = n * b.maxHp;
      html = `<b>Boss</b> <i>${esc(st.name)}${n > 1 ? ` ×${n}` : ''}</i> <span>${hp} / ${max}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, (hp / max) * 100))}%"></i></span>`;
    }
    if (html !== bossSig) { bossSig = html; bossBarEl.innerHTML = html; bossBarEl.hidden = !html; }
  }

  /** The wave's hint as it starts, long enough to read (a little longer for a longer hint); it waits while paused. */
  function waveHint(s: State, dt: number, tutorial: boolean) {
    const key = `${s.level}:${s.stage}:${s.wave}`;
    if (s.phase === 'combat' && hintFor !== key) {
      hintFor = key;
      const def = wave(s);
      if (!tutorial && def.hint) {
        hintEl.innerHTML = `<small>Wave ${s.wave} of ${totalWaves(s)}</small><b>${esc(def.title.replace(/^Stage \d+: /, ''))}</b><span>${esc(def.hint)}</span>`;
        hintEl.hidden = false; hintEl.classList.remove('fade');
        hintT = Math.min(10, 3.5 + def.hint.split(' ').length * 0.28);
      }
    }
    if (s.phase === 'prep' && !hintEl.hidden) hintT = 0;
    if (hintT > 0) {
      if (!s.paused) hintT -= dt;
      hintEl.classList.toggle('fade', hintT < 0.6);
      if (hintT <= 0) hintEl.hidden = true;
    } else if (!hintEl.hidden) hintEl.hidden = true;
  }

  /** Every frame: take the simulation's notes, count the toast down, keep the boss bar and the hint current. */
  function tick(s: State, dt: number, tutorial: boolean) {
    if (s.notices.length) { toast(s.notices.join(' ')); s.notices = []; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
    bossBar(s);
    waveHint(s, dt, tutorial);
  }
  return { toast, tick };
}
