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
