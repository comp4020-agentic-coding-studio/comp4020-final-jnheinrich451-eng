// One browser-owned music player. No audio state or playback work on the server.
export function setupMusic() {
  const toggle = document.getElementById('music-toggle');
  const slider = document.getElementById('music-volume');
  const status = document.getElementById('music-status');
  const audio = document.createElement('audio');
  audio.id = 'background-music'; audio.loop = true; audio.preload = 'none';
  audio.src = '/audio/Apex_Of_Conquest.mp3';
  document.body.append(audio);
  let enabled = true, volume = .25, activated = false, pending = false, failed = false;
  try {
    const saved = JSON.parse(localStorage.getItem('frontier-music') || 'null');
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) volume = Math.max(0, Math.min(1, saved.volume));
  } catch { /* Storage can be unavailable in private browser contexts. */ }
  const wanted = () => enabled && volume > 0 && !document.hidden;
  function render() {
    toggle.textContent = enabled ? 'Music on' : 'Music off';
    toggle.setAttribute('aria-pressed', String(enabled));
    slider.value = String(Math.round(volume * 100)); audio.volume = volume;
    status.textContent = !enabled ? 'Music off.' : volume === 0 ? 'Volume muted.' : failed
      ? 'Music unavailable. Toggle off and on to retry.' : document.hidden ? 'Paused while this tab is hidden.'
      : !audio.paused ? 'Playing / Apex of Conquest' : 'Music starts after a click, tap or key press.';
  }
  function save() {
    try { localStorage.setItem('frontier-music', JSON.stringify({enabled, volume})); } catch {}
  }
  async function sync() {
    audio.volume = volume;
    if (!wanted()) { audio.pause(); render(); return; }
    if (!activated || pending || failed || !audio.paused) { render(); return; }
    pending = true;
    try {
      await audio.play();
      // A mute/hide can happen while the browser is still accepting playback.
      if (!wanted()) audio.pause();
    } catch (error) {
      if (error.name === 'NotAllowedError') activated = false;
      else if (error.name !== 'AbortError') failed = true;
    } finally { pending = false; render(); }
  }
  toggle.addEventListener('click', () => {
    enabled = !enabled; activated = true;
    if (enabled && failed) { failed = false; audio.load(); }
    save(); void sync();
  });
  slider.addEventListener('input', () => {
    volume = Number(slider.value) / 100; activated = true; save(); void sync();
  });
  const activate = event => {
    if (event.type === 'keydown' && (event.repeat || ['Shift','Control','Alt','Meta'].includes(event.key))) return;
    // Let music controls apply their value before attempting playback.
    if (event.target.closest?.('.music-settings')) return;
    activated = true; void sync();
  };
  document.addEventListener('pointerdown', activate);
  document.addEventListener('keydown', activate);
  document.addEventListener('visibilitychange', () => { void sync(); });
  window.addEventListener('pagehide', () => audio.pause());
  window.addEventListener('pageshow', () => { void sync(); });
  audio.addEventListener('error', () => { failed = true; render(); });
  audio.addEventListener('playing', render);
  render();
}
