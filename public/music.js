import { musicForWorld } from './music-tracks.js';

// One browser-owned music player. No audio state or playback work on the server.
export function setupMusic() {
  const toggle = document.getElementById('music-toggle');
  const slider = document.getElementById('music-volume');
  const status = document.getElementById('music-status');
  const label = document.getElementById('music-track');
  const audio = document.createElement('audio');
  audio.id = 'background-music'; audio.loop = true; audio.preload = 'none';
  document.body.append(audio);
  // The author's own listening level (9 November 2026); a saved choice still wins.
  let enabled = true, volume = .03, activated = false, pending = null, failed = false;
  const quick = document.getElementById('music-quick');
  let track = null, revision = 0, syncRequested = false;
  try {
    const saved = JSON.parse(localStorage.getItem('frontier-music') || 'null');
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) volume = Math.max(0, Math.min(1, saved.volume));
  } catch { /* Storage can be unavailable in private browser contexts. */ }
  const wanted = () => !!track && enabled && volume > 0 && !document.hidden;
  function render() {
    toggle.textContent = enabled ? 'Music on' : 'Music off';
    toggle.setAttribute('aria-pressed', String(enabled));
    if (quick) { quick.setAttribute('aria-pressed', String(enabled)); quick.title = enabled ? 'Music on' : 'Music off'; }
    slider.value = String(Math.round(volume * 100)); audio.volume = volume;
    if (label) label.textContent = track ? `${track.title} / looping soundtrack. Preferences stay in this browser.` : 'Each planet has its own soundtrack. Preferences stay in this browser.';
    status.textContent = !enabled ? 'Music off.' : volume === 0 ? 'Volume muted.' : failed
      ? 'Music unavailable. Toggle off and on to retry.' : document.hidden ? 'Paused while this tab is hidden.'
      : !track ? 'Waiting for your planet.' : !audio.paused ? `Playing / ${track.title}` : 'Music starts after a click, tap or key press.';
  }
  function save() {
    try { localStorage.setItem('frontier-music', JSON.stringify({enabled, volume})); } catch {}
  }
  async function sync() {
    audio.volume = volume;
    if (!wanted()) { audio.pause(); render(); return; }
    if (pending !== null) { syncRequested = true; render(); return; }
    if (!activated || failed || !audio.paused) { render(); return; }
    const request = revision;
    pending = request;
    try {
      await audio.play();
      if (request !== revision) return;
      // A mute/hide can happen while the browser is still accepting playback.
      if (!wanted()) audio.pause();
    } catch (error) {
      if (request !== revision) return;
      if (error.name === 'NotAllowedError') activated = false;
      else if (error.name !== 'AbortError') failed = true;
    } finally {
      if (request === revision) {
        pending = null;
        const retry = syncRequested; syncRequested = false;
        render();
        // A quick hide/show or off/on may abort the pending play after the
        // resume event. Honor that event once; an abort alone never retries.
        if (retry && wanted() && activated && !failed && audio.paused) void sync();
      }
    }
  }
  function setWorld(world, mode = 'combat') {
    const next = musicForWorld(world, mode);
    // Reconnects, snapshots and Morrow region visits keep the current position.
    if (!next || next === track) return;
    revision++; pending = null; failed = false; syncRequested = false;
    audio.pause(); track = next; audio.src = track.src;
    void sync();
  }
  quick?.addEventListener('click', () => toggle.click());
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
  audio.addEventListener('error', () => { if (audio.error) { failed = true; render(); } });
  audio.addEventListener('playing', render);
  render();
  return { setWorld };
}
