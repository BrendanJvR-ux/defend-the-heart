import { STYLES } from './styles';
import { renderStyle } from './scene';

const grid = document.getElementById('grid')!;
const zoom = document.getElementById('zoom')!;

STYLES.forEach((st, i) => {
  const fig = document.createElement('figure');
  if (st.featured) fig.className = 'featured';
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-label', `${st.name} study`);
  fig.appendChild(cv);
  const cap = document.createElement('figcaption');
  const plain = STYLES.filter((x) => !x.featured);
  cap.innerHTML = `<h2>${st.name}<small>${st.featured ?? `${plain.indexOf(st) + 1} of ${plain.length}`}</small></h2><p>${st.blurb}</p><p class="unity"><b>In Unity:</b> ${st.unity}</p>`;
  fig.appendChild(cap);
  grid.appendChild(fig);
  // render each after a frame so the page appears quickly
  setTimeout(() => renderStyle(cv, st), 30 * i);
  cv.addEventListener('click', () => {
    const big = document.createElement('canvas');
    big.width = cv.width; big.height = cv.height;
    big.getContext('2d')!.drawImage(cv, 0, 0);
    zoom.replaceChildren(big);
    zoom.classList.add('on');
  });
});
zoom.addEventListener('click', () => zoom.classList.remove('on'));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') zoom.classList.remove('on'); });
