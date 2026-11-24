// Sound, made on the fly with the Web Audio API (no sound files): a pen scratch for building, soft plucks for
// kills, a thud when the organ is hit, a chime when a white cell gives its life, a low horn for a boss, a heartbeat
// that quickens as the organ weakens, and a few notes for winning and losing. Muted by default until the player
// has touched the page (browsers require it), and mutable with the HUD button or M.

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('dth-sound') === 'off'; } catch { /* no storage */ }

/** Start the audio (call from a user gesture). */
export function unlockAudio() {
  if (ac || typeof AudioContext === 'undefined') { void ac?.resume(); return; }
  ac = new AudioContext();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('dth-sound', m ? 'off' : 'on'); } catch { /* no storage */ }
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.05);
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number; attack?: number } = {}) {
  if (!ac || !master || muted) return;
  const t0 = ac.currentTime + (opts.delay ?? 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = opts.type ?? 'sine'; o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
  const v = opts.vol ?? 0.2, a = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur: number, freq: number, q: number, vol: number) {
  if (!ac || !master || muted) return;
  const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}

let lastPop = 0;
export const sfx = {
  /** A lymph node placed: a quick scratch of the pen. */
  build() { noise(0.09, 3200, 1.2, 0.5); noise(0.06, 1800, 2, 0.3); },
  /** A pathogen destroyed: a soft pluck (no more than ten a second). */
  pop() {
    if (!ac) return;
    const now = ac.currentTime; if (now - lastPop < 0.1) return; lastPop = now;
    tone(520 + Math.random() * 380, 0.09, { type: 'triangle', vol: 0.08 });
  },
  /** The organ is hit: a low thud. */
  hit() { tone(80, 0.28, { vol: 0.35, slide: 0.6 }); noise(0.08, 200, 1, 0.25); },
  /** A white cell gives its life in the pulse: a bright chime. */
  sacrifice() { tone(880, 0.9, { vol: 0.12 }); tone(1320, 0.7, { vol: 0.07, delay: 0.03 }); tone(1760, 0.5, { vol: 0.04, delay: 0.06 }); },
  /** A white cell lost or infected: a falling note. */
  cellLost() { tone(420, 0.35, { type: 'triangle', vol: 0.12, slide: 0.5 }); },
  /** A boss arrives: a low horn. */
  boss() { tone(98, 0.9, { type: 'sawtooth', vol: 0.06, attack: 0.08 }); tone(147, 0.9, { type: 'sawtooth', vol: 0.04, attack: 0.1 }); },
  /** One heartbeat: lub-dub. */
  beat(vol: number) { tone(60, 0.14, { vol: 0.3 * vol, slide: 0.7 }); tone(52, 0.12, { vol: 0.22 * vol, slide: 0.7, delay: 0.16 }); },
  /** The organ won. */
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.12 })); },
  /** The organ lost. */
  lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.12, delay: i * 0.18 })); },
  /** A wave begins. */
  wave() { tone(330, 0.25, { type: 'triangle', vol: 0.1 }); tone(440, 0.3, { type: 'triangle', vol: 0.1, delay: 0.12 }); },
};
