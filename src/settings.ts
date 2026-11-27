// Player settings, kept in this browser apart from the career: text size and motion. Applied to the page at once.
import { motion } from './draw';

export type TextSize = 'normal' | 'large' | 'larger';
export type Motion = 'system' | 'reduced' | 'full';
export type ViewMode = '3d' | '2d';
export interface Settings { text: TextSize; motion: Motion; view: ViewMode }

const KEY = 'dth-settings';
const TEXT: TextSize[] = ['normal', 'large', 'larger'], MOTION: Motion[] = ['system', 'reduced', 'full'], VIEW: ViewMode[] = ['3d', '2d'];

export function loadSettings(): Settings {
  const out: Settings = { text: 'normal', motion: 'system', view: '3d' };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (TEXT.includes(raw?.text)) out.text = raw.text;
    if (MOTION.includes(raw?.motion)) out.motion = raw.motion;
    if (VIEW.includes(raw?.view)) out.view = raw.view;
  } catch { /* no storage, or unreadable: the defaults */ }
  return out;
}
export function saveSettings(x: Settings) { try { localStorage.setItem(KEY, JSON.stringify(x)); } catch { /* this visit only */ } }

const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
/** Put the settings into effect: text size and reduced motion as classes on the page, and the map's motion flag. */
export function applySettings(x: Settings) {
  const b = document.body;
  b.classList.toggle('text-large', x.text === 'large');
  b.classList.toggle('text-larger', x.text === 'larger');
  motion.reduced = x.motion === 'reduced' || (x.motion === 'system' && systemReduced.matches);
  b.classList.toggle('reduce-motion', motion.reduced);
}
/** Follow the system's reduced-motion setting while the player leaves it to the system. */
export function watchSystemMotion(get: () => Settings) { systemReduced.addEventListener('change', () => applySettings(get())); }

const choice = (key: string, value: string, now: string, label: string, sub = '') =>
  `<button data-menu="set" data-key="${key}" data-value="${value}" aria-pressed="${value === now}" class="${value === now ? 'on' : ''}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;

/** The Settings page of the menu. */
export function settingsHtml(x: Settings): string {
  return `<h2>Settings</h2>
    <div class="settings">
      <h3>View</h3><div class="choice3 two">${choice('view', '3d', x.view, '3D', 'turn and zoom the board')}${choice('view', '2d', x.view, 'Flat map', 'the 2D drawing')}</div>
      <h3>Text size</h3><div class="choice3">${choice('text', 'normal', x.text, 'Normal')}${choice('text', 'large', x.text, 'Large')}${choice('text', 'larger', x.text, 'Larger')}</div>
      <h3>Motion</h3><div class="choice3">${choice('motion', 'system', x.motion, 'As my device', systemReduced.matches ? 'reduced now' : 'full now')}${choice('motion', 'reduced', x.motion, 'Reduced', 'no shaking or flashing')}${choice('motion', 'full', x.motion, 'Full')}</div>
      <h3>Colour</h3><p class="sub">Every lymph node carries its letter (M, G, A, E) as well as its colour, and each pathogen has its own shape, so the game can be played without telling colours apart.</p>
      <h3>Your career</h3><p class="sub">Kept in this browser only. Back it up as a code to move it to another device or browser.</p>
      <div class="menuButtons"><button data-menu="backup">Back up or restore</button></div>
    </div>
    <p><button data-menu="back">Back</button></p>`;
}
