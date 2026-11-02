// The expedition server owns playback time. This client owns only one decoder
// and the viewer's audio preference; it never uploads media or advances a room.
export const COLONY_MOVIE = Object.freeze({
  title: 'Big Buck Bunny',
  url: '/assets/colony-cinema/big-buck-bunny.mp4',
  duration: 596.458333,
  credit: 'Copyright 2008, Blender Foundation / www.bigbuckbunny.org',
  source: 'https://download.blender.org/peach/bigbuckbunny_movies/',
  license: 'https://creativecommons.org/licenses/by/3.0/',
});

export function createColonyCinema({ onStatus = () => {} } = {}) {
  const video = document.createElement('video');
  video.preload = 'none'; video.muted = true; video.defaultMuted = true;
  video.playsInline = true; video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  // Keep it detached: the visible screen draws this decoded frame on its canvas.
  let loaded = false, disposed = false, pendingPlay = false, blocked = false, error = '';
  let desired = { position: 0, playing: false, visible: false, active: false };
  let eligibleBefore = false, lastSeek = -Infinity, lastStatus = '';
  const getStatus = () => ({ loaded, ready: video.readyState >= 2, muted: video.muted, error, blocked });
  function emit() {
    const status = getStatus(), key = JSON.stringify(status);
    if (key !== lastStatus) { lastStatus = key; onStatus(status); }
  }
  const eligible = () => !disposed && !document.hidden && desired.visible && desired.active;
  function seek(force = false) {
    if (!loaded || video.readyState < 1 || !Number.isFinite(video.duration)) return;
    const target = Math.max(0, Math.min(video.duration, desired.position));
    const now = performance.now();
    if (!video.seeking && (force || Math.abs(video.currentTime - target) > .8) && (force || now - lastSeek > 750)) {
      try { video.currentTime = target; lastSeek = now; } catch { /* Wait for seekable metadata. */ }
    }
  }
  function play() {
    if (pendingPlay || blocked || error || !eligible() || !desired.playing || !video.paused) return;
    pendingPlay = true;
    Promise.resolve(video.play()).catch(reason => {
      // A pause, hidden tab or changed room may cancel an in-flight play request.
      if (disposed || !eligible() || !desired.playing || reason?.name === 'AbortError') return;
      if (reason?.name === 'NotAllowedError') blocked = true;
      else error = 'This browser could not play the movie.';
      emit();
    }).finally(() => {
      pendingPlay = false;
      if (!eligible() || !desired.playing) video.pause();
      emit();
    });
  }
  function synchronize() {
    if (disposed) return;
    const canView = eligible();
    // A paused, never-watched screen does not download a 65 MB film.
    if (!loaded && canView && desired.playing) {
      loaded = true; video.src = COLONY_MOVIE.url; video.load(); emit();
    }
    if (!canView) { video.pause(); eligibleBefore = false; return; }
    if (loaded) {
      seek(!eligibleBefore);
      if (desired.playing) play(); else video.pause();
    }
    eligibleBefore = canView;
  }
  function update(state) {
    if (disposed) return;
    const position = Number.isFinite(state.position) ? Math.max(0, Math.min(COLONY_MOVIE.duration, state.position)) : 0;
    const wasPlaying = desired.playing;
    desired = { position, playing: !!state.playing, visible: !!state.visible, active: !!state.active };
    if (desired.playing && !wasPlaying) blocked = false;
    if (desired.playing !== wasPlaying && eligible()) seek(true);
    synchronize();
  }
  function setMuted(muted) { video.muted = !!muted; emit(); }
  function enableAudio() {
    if (disposed) return;
    video.muted = false; blocked = false;
    synchronize(); emit();
  }
  const metadata = () => { seek(true); synchronize(); emit(); };
  const ready = () => { synchronize(); emit(); };
  const mediaError = () => { if (!disposed) { error = 'Movie unavailable. You can keep exploring the garden.'; video.pause(); emit(); } };
  const visibility = () => { synchronize(); emit(); };
  video.addEventListener('loadedmetadata', metadata);
  video.addEventListener('loadeddata', ready);
  video.addEventListener('canplay', ready);
  video.addEventListener('error', mediaError);
  video.addEventListener('volumechange', emit);
  document.addEventListener('visibilitychange', visibility);
  function dispose() {
    if (disposed) return;
    disposed = true; video.pause();
    document.removeEventListener('visibilitychange', visibility);
    video.removeEventListener('loadedmetadata', metadata);
    video.removeEventListener('loadeddata', ready);
    video.removeEventListener('canplay', ready);
    video.removeEventListener('error', mediaError);
    video.removeEventListener('volumechange', emit);
    video.removeAttribute('src'); video.load();
  }
  return { video, update, enableAudio, setMuted, getStatus, dispose };
}
