// Phones play in landscape. Held upright, the page asks the player to turn the phone (CSS); where the browser allows it
// (Android), a button goes full screen and locks the screen sideways.
export function setUpLandscape(button: HTMLButtonElement) {
  const orient = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
  if (!('requestFullscreen' in document.documentElement) || typeof orient?.lock !== 'function') return;
  button.hidden = false;
  button.addEventListener('click', async () => {
    try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await orient.lock!('landscape'); } catch { /* not allowed here: turning the phone still works */ }
  });
}

/** Keep the page to the part of the screen the browser actually shows. On phones the address and tab bars come and go,
 *  and some browsers measure the screen's height with them hidden, which pushes the top bar under them; so the page
 *  takes the visible height (`--app-h`) and returns to the top whenever it changes. */
export function fitToVisibleScreen() {
  const fit = () => {
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--app-h', `${h}px`);
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
  };
  fit();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  window.addEventListener('orientationchange', () => { fit(); setTimeout(fit, 350); });
}
