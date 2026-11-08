// Opening loop: the title screen in front of the entry pages.
// A classic script in <head>, so it decides before first paint and before the
// page modules run. It plays once per tab session on `/`, `/campaigns/` and
// `/login/`. Any key, click or tap fades it to black. A page that is about to
// navigate keeps the screen black, and the next page fades in from black;
// otherwise the black lifts over the page underneath. Presentation only: it
// stores two sessionStorage flags and never changes what the server admits.
// See docs/OPENING_LOOP.md.
(() => {
  const SEEN = 'frontier-opening-seen', HANDOFF = 'frontier-opening-handoff';
  const root = document.documentElement;
  const read = key => { try { return sessionStorage.getItem(key); } catch { return undefined; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* Optional. */ } };
  const remove = key => { try { sessionStorage.removeItem(key); } catch { /* Optional. */ } };
  const resolved = Promise.resolve();
  const api = window.frontierOpening = { active: false, done: resolved, navigating: false };

  // Arriving from the opening on the previous page: fade in from black once.
  const handoff = Number(read(HANDOFF));
  if (handoff) {
    remove(HANDOFF);
    if (Date.now() - handoff < 5000) {
      root.dataset.opening = 'arrive';
      setTimeout(() => { if (root.dataset.opening === 'arrive') delete root.dataset.opening; }, 1200);
    }
  }

  const path = location.pathname;
  const entryPage = path === '/' || /^\/campaigns\/?$/.test(path) || /^\/login\/?$/.test(path);
  // Without session storage the opening could not remember it was seen, and would
  // replay on every page; automated browsers skip it so test runs and preview
  // screenshots start on the page itself.
  if (!entryPage || read(SEEN) !== null || navigator.webdriver) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let overlay = null, video = null, finish, leaving = false, skipQueued = false;
  api.active = true;
  api.done = new Promise(resolve => { finish = resolve; });
  root.dataset.opening = 'play';

  const lone = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock', 'OS', 'Hyper', 'Super', 'Unidentified', 'Process', 'Dead']);
  function onKey(event) {
    if (!api.active) return;
    // Browser shortcuts (new tab, switch window, reload with Ctrl) stay the browser's.
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || lone.has(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    skip();
  }
  function onPointer(event) {
    if (!api.active) return;
    event.preventDefault(); event.stopImmediatePropagation();
    skip();
  }
  addEventListener('keydown', onKey, true);
  addEventListener('pointerdown', onPointer, true);

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'opening';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Frontier opening');
    overlay.tabIndex = -1;
    let picture;
    if (reduced) {
      // Reduced motion: the first frame, still.
      picture = document.createElement('img');
      picture.src = '/assets/entry/opening-poster.jpg'; picture.alt = '';
    } else {
      picture = video = document.createElement('video');
      video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.autoplay = true;
      video.preload = 'auto'; video.poster = '/assets/entry/opening-poster.jpg';
      video.setAttribute('aria-hidden', 'true'); video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
      video.src = '/assets/entry/opening-loop.mp4';
    }
    picture.className = 'opening-picture';
    const line = document.createElement('p');
    line.className = 'opening-skip';
    // data-text feeds the shine layer drawn over the gold letters (CSS ::after).
    line.innerHTML = '<span class="opening-keys" data-text="Press any key to skip">Press any key to skip</span>' +
      '<span class="opening-touch" data-text="Tap to skip">Tap to skip</span>';
    const black = document.createElement('div');
    black.className = 'opening-black';
    overlay.append(picture, line, black);
    document.body.append(overlay);
    root.dataset.opening = 'playing';
    overlay.focus({ preventScroll: true });
    if (video) video.play().catch(() => { /* The poster stays up; any key still continues. */ });
    if (skipQueued) skip();
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build, { once: true });

  // A hidden tab never keeps decoding the loop.
  document.addEventListener('visibilitychange', () => {
    if (!video || leaving) return;
    if (document.hidden) video.pause(); else video.play().catch(() => {});
  });

  function skip() {
    if (leaving) return;
    if (!overlay) { skipQueued = true; return; }
    leaving = true;
    write(SEEN, '1');
    overlay.classList.add('opening-leaving');
    overlay.setAttribute('aria-busy', 'true');
    const black = overlay.querySelector('.opening-black');
    let settled = false;
    const blackOut = () => {
      if (settled) return; settled = true;
      video?.pause();
      write(HANDOFF, String(Date.now()));
      finish();
      // A page navigating away keeps the black; the next page fades in from it.
      setTimeout(() => { if (!api.navigating) reveal(); }, 160);
    };
    black.addEventListener('transitionend', blackOut, { once: true });
    setTimeout(blackOut, reduced ? 500 : 900);
  }

  function reveal() {
    remove(HANDOFF);
    api.active = false;
    removeEventListener('keydown', onKey, true);
    removeEventListener('pointerdown', onPointer, true);
    if (root.dataset.opening === 'playing') delete root.dataset.opening;
    if (video) { video.removeAttribute('src'); video.load(); }
    overlay.querySelector('.opening-black').style.opacity = '1';
    overlay.classList.remove('opening-leaving');
    overlay.classList.add('opening-revealing');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 900);
  }

  // A page restored from the back/forward cache must never come back black.
  addEventListener('pageshow', event => {
    if (event.persisted && leaving && overlay?.isConnected) { api.navigating = false; reveal(); }
  });
})();
