// The menu's "How to play" page: the whole game on one page, with the pictures from the map.
import { CONFIG, NODE_TYPES } from './config';
import { icon, nodeIcon } from './icons';
import { esc } from './text';

export function howToPlayHtml(): string {
  const N = CONFIG.no;
  const nodes = NODE_TYPES.map((t) => `<li><img alt="" src="${nodeIcon(t)}" width="40" height="31"><span><b>${CONFIG.nodes[t].short}</b> · ${CONFIG.nodes[t].cost} energy<small>${esc(CONFIG.nodes[t].blurb)}</small></span></li>`).join('');
  return `<h2>How to play</h2>
    <div class="howto">
      <section><h3>${icon('saureus', 30)} The goal</h3>
        <p>Pathogens come up the vessels towards the organ in the middle. Each one that reaches it costs health. Survive every wave and the organ is safe; lose all its health and it fails.</p></section>
      <section><h3>Build between waves</h3>
        <p>Tap a <b>+</b> site beside a vessel and choose a lymph node. It fires at pathogens on its own vessel. Nodes cost <b>energy</b>; kills earn more. A node placed since the last wave can be cancelled for a full refund.</p>
        <ul class="key">${nodes}</ul>
        <p class="sub">An IgG aimed at the right bacterium hits it three times as hard. Unlock targets in Upgrades, or borrow one for a single organ.</p></section>
      <section><h3>${icon('cell', 30)} Open vessels during a wave</h3>
        <p>Tap a vessel (or its button) to <b>dilate</b> it: your white cells set out along it and fight everything they touch. It costs <b>NO</b>: ${N.openCost} to open and ${N.drainPerSec} a second while open; with every vessel closed, NO refills. When it runs out, every vessel closes. Open as many vessels as you have white cells; they split between them.</p>
        <p class="sub">Keep white cells away from hijacker viruses: an infected cell turns on your nodes.</p></section>
      <section><h3>The immune pulse</h3>
        <p>Once a wave, the <b>pulse</b> makes every white cell touching a pathogen destroy it (a boss loses a third of its health), giving its life to do it. Lost cells come back next wave.</p></section>
      <section><h3>Organs, gold and upgrades</h3>
        <p>Every organ has its own twist (the lungs breathe, the liver regrows, the stomach has acid) and a slight disadvantage, shown as it starts and under <b>Info</b>. Clearing an organ pays <b>gold</b> for upgrades that last the whole career: damage, IgG targets, more NO, an extra starting node. During an organ, its <b>energy</b> can also buy NO or an extra white cell.</p></section>
      <section><h3>Endless</h3>
        <p>Clear the eye to open Endless: organ after organ, each one bigger, with bosses at random. Your best runs go on a leaderboard.</p></section>
      <section><h3>Keys</h3>
        <p class="sub">Space: pulse · 1–9, 0, -, =: open or close a vessel · P: pause · I: pathogen details · M: sound · Escape: close.</p></section>
    </div>
    <p><button data-menu="back" class="primary">Back</button></p>`;
}
