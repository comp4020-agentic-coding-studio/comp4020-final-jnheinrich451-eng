import {ColonySoundEvents} from './colony-sound-events.js';
import {COLONY_SOUND_PROFILES, COLONY_SOUND_FILES, createColonyVariantSelector} from './colony-sound-catalog.js';
import {SOUND_LEVELS} from './audio/effects/colony/loudness.js';
import {soundSampleScale} from './sound-level.js';

// Colony projection keeps world X horizontal. Local fishing feedback stays
// centered; machinery and pets attenuate around the currently viewed garden.
function spatial(event, point, profile) {
  if (event.local) return {gain: 1, pan: 0};
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y) || !point) return {gain: 0, pan: 0};
  const dx = event.x - point.x, dy = event.y - point.y;
  const range = profile.range || 18, distance = Math.hypot(dx, dy);
  return {gain: Math.max(0, 1 - distance / range) ** 2, pan: Math.max(-.85, Math.min(.85, dx / (range * .5)))};
}

export function setupColonySound({listener, active}) {
  const toggle = document.getElementById('sound-toggle'), slider = document.getElementById('sound-volume');
  const status = document.getElementById('sound-status'), quick = document.getElementById('sound-quick');
  const events = new ColonySoundEvents(), variants = createColonyVariantSelector();
  const files = [...new Set(COLONY_SOUND_FILES)], buffers = new Map(), failures = new Map();
  const playing = new Set(), retiring = new Set(), loops = new Map(), groups = new Map();
  let enabled = true, volume = .25, context = null, master = null, loading = null, failure = '';
  let epoch = null, time = -Infinity, region = null, sceneLoops = [], advancedAt = -Infinity, reel = null;
  try {
    const saved = JSON.parse(localStorage.getItem('frontier-sound') || 'null');
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) volume = Math.max(0, Math.min(1, saved.volume));
  } catch {}
  const wanted = () => enabled && volume > 0 && !document.hidden && active();
  function render() {
    if (toggle) { toggle.textContent = enabled ? 'Effects on' : 'Effects off'; toggle.setAttribute('aria-pressed', String(enabled)); }
    if (quick) { quick.setAttribute('aria-pressed', String(enabled)); quick.title = enabled ? 'Sound effects on' : 'Sound effects off'; }
    if (slider) slider.value = String(Math.round(volume * 100));
    if (status) status.textContent = !enabled ? 'Sound effects off.' : volume === 0 ? 'Effects muted.' : failure ?
      (failures.size ? 'Some sounds unavailable (' + failures.size + '/' + files.length + '): ' : 'Audio unavailable: ') + failure + '. Toggle effects off and on to retry.' :
      loading ? 'Loading sound effects...' : context?.state === 'running' ? 'Sound effects ready / nearby colony sounds.' : 'Sounds start after a click, tap or key press.';
  }
  function save() { try { localStorage.setItem('frontier-sound', JSON.stringify({enabled, volume})); } catch {} }
  function stopVoice(voice) { try { voice.source.stop(); } catch {} voice.dispose(); }
  function stop() {
    for (const voice of [...playing, ...retiring]) stopVoice(voice);
    loops.clear(); groups.clear();
  }
  function retire(voice, duration = .06) {
    if (voice.disposed || retiring.has(voice)) return;
    clearTimeout(voice.expiry); playing.delete(voice); retiring.add(voice);
    if (loops.get(voice.loopId) === voice) loops.delete(voice.loopId);
    const now = context.currentTime; voice.stopAt = now + duration;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(0, voice.stopAt);
    voice.source.stop(voice.stopAt);
  }
  const afterFades = () => Math.max(context.currentTime, ...[...retiring].map(voice => voice.stopAt));
  async function loadSample(file) {
    let error;
    for (const candidate of [file, file.replace(/\.ogg$/, '.wav')]) {
      try {
        const response = await fetch('/audio/effects/' + candidate, {cache: 'no-cache'});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const bytes = await response.arrayBuffer();
        let buffer;
        try { buffer = await context.decodeAudioData(bytes); }
        catch (cause) { throw new Error('decode failed (' + (cause.name || 'audio format') + ')'); }
        let peak = 0;
        for (let c = 0; c < buffer.numberOfChannels; c++) for (const value of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(value));
        return {buffer, scale: soundSampleScale(SOUND_LEVELS[candidate], peak)};
      } catch (cause) { error = new Error(candidate.split('/').pop() + ': ' + cause.message); }
    }
    throw error;
  }
  async function unlock() {
    if (!enabled || document.hidden) return;
    try {
      if (!context) {
        context = new AudioContext(); master = context.createGain();
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -16; limiter.knee.value = 10; limiter.ratio.value = 8;
        limiter.attack.value = .003; limiter.release.value = .18;
        master.connect(limiter); limiter.connect(context.destination);
        context.addEventListener('statechange', render);
      }
      master.gain.setTargetAtTime(volume, context.currentTime, .02);
      await context.resume();
      if (!loading && buffers.size < files.length) {
        failure = '';
        const queue = files.filter(file => !buffers.has(file));
        const worker = async () => {
          while (queue.length) {
            const file = queue.shift();
            try { buffers.set(file, await loadSample(file)); failures.delete(file); }
            catch (error) { failure = error.message; failures.set(file, error.message); }
          }
        };
        loading = Promise.all(Array.from({length: 4}, worker)).finally(() => { loading = null; render(); });
      }
    } catch (error) { failure = error.name + ': ' + error.message; }
    render();
  }
  function voiceFor(sample, position, priority, sourceKey, loopId) {
    const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner();
    const startAt = afterFades();
    source.buffer = sample.buffer; source.loop = !!loopId; source.playbackRate.value = 1;
    gain.gain.setValueAtTime(0, startAt); pan.pan.value = position.pan;
    source.connect(gain); gain.connect(pan); pan.connect(master);
    const voice = {source, gain, pan, startAt, priority, sourceKey, loopId, expiry: null, disposed: false, dispose() {
      if (voice.disposed) return;
      voice.disposed = true; clearTimeout(voice.expiry); playing.delete(voice); retiring.delete(voice);
      if (loops.get(loopId) === voice) loops.delete(loopId);
      source.disconnect(); gain.disconnect(); pan.disconnect();
    }};
    playing.add(voice); source.onended = voice.dispose;
    return voice;
  }
  function makeRoom(priority) {
    if (playing.size < 16) return true;
    const quietest = [...playing].sort((a, b) => a.priority - b.priority)[0];
    if (quietest.priority > priority) return false;
    retire(quietest, .02); return true;
  }
  function play(event, position) {
    const profile = COLONY_SOUND_PROFILES[event.kind];
    if (!profile || profile.loop || !wanted() || context?.state !== 'running' || position.gain <= .005) return false;
    // Wait for a whole variation group: a loading/missing take must not advance
    // the alternating footsteps or silently replace an authored variation.
    if (!(profile.files || [profile.file]).every(file => buffers.has(file))) return false;
    const now = context.currentTime, cell = Math.floor((event.x || 0) / 3) + ':' + Math.floor((event.y || 0) / 3);
    const sourceKey = event.kind + ':' + (event.id ?? event.owner ?? cell);
    if (now - (groups.get(sourceKey) ?? -Infinity) < .075) return false;
    const priority = position.gain * (profile.priority ?? 1);
    if (!makeRoom(priority)) return false;
    const same = [...playing].filter(voice => voice.sourceKey === sourceKey);
    if (same.length >= (profile.maxPerSource || 2)) retire(same[0], .015);
    const file = variants.select(event.kind), sample = buffers.get(file);
    if (!sample) return false;
    const voice = voiceFor(sample, position, priority, sourceKey, null);
    const duration = Math.max(.01, Math.min(sample.buffer.duration, Number.isFinite(event.duration) ? event.duration : sample.buffer.duration));
    const level = profile.gain * sample.scale * position.gain;
    voice.gain.gain.linearRampToValueAtTime(level, voice.startAt + Math.min(.004, duration / 4));
    voice.gain.gain.setValueAtTime(level, voice.startAt + Math.max(.005, duration - .04));
    voice.gain.gain.linearRampToValueAtTime(0, voice.startAt + duration);
    groups.set(sourceKey, now); if (groups.size > 128) groups.delete(groups.keys().next().value);
    voice.source.start(voice.startAt); voice.source.stop(voice.startAt + duration);
    return true;
  }
  function updateLoop(voice, event, position, profile, sample) {
    const now = Math.max(context.currentTime, voice.startAt), amount = Math.max(0, Math.min(1, event.gain ?? 1));
    voice.gain.gain.setTargetAtTime(profile.gain * sample.scale * position.gain * amount, now, .06);
    voice.pan.pan.setTargetAtTime(position.pan, now, .06);
    voice.source.playbackRate.setTargetAtTime(Math.max(.8, Math.min(1.2, event.rate ?? 1)), now, .1);
    voice.priority = position.gain * (profile.priority ?? .3) * amount;
    clearTimeout(voice.expiry); voice.expiry = setTimeout(() => retire(voice), 500);
  }
  function syncLoops() {
    if (!wanted()) { stop(); return; }
    if (context?.state !== 'running') return;
    const fresh = performance.now() - advancedAt < 500;
    const emitters = fresh ? sceneLoops : [];
    const point = listener();
    const selected = [...emitters, ...(fresh && reel ? [reel] : [])].map(event => {
      const profile = COLONY_SOUND_PROFILES[event.kind];
      return {event, profile, position: profile ? spatial(event, point, profile) : {gain: 0}, id: event.kind + ':' + event.id};
    }).filter(item => item.profile?.loop && item.position.gain > .005 && (item.event.gain ?? 1) > 0)
      .sort((a, b) => b.position.gain * (b.profile.priority ?? .3) * (b.event.gain ?? 1) - a.position.gain * (a.profile.priority ?? .3) * (a.event.gain ?? 1)).slice(0, 4);
    const ids = new Set(selected.map(item => item.id));
    for (const [id, voice] of loops) if (!ids.has(id)) retire(voice);
    for (const {event, profile, position, id} of selected) {
      const sample = buffers.get(profile.file); if (!sample) continue;
      let voice = loops.get(id);
      if (!voice) {
        const priority = position.gain * (profile.priority ?? .3) * (event.gain ?? 1);
        if (!makeRoom(priority)) continue;
        voice = voiceFor(sample, position, priority, id, id); loops.set(id, voice);
        updateLoop(voice, event, position, profile, sample); voice.source.start(voice.startAt);
      } else updateLoop(voice, event, position, profile, sample);
    }
  }
  function reset() {
    // A lifecycle boundary drops event history, not the audible take order.
    // The next real footstep still alternates after a pause or hidden tab.
    events.reset(); epoch = null; time = -Infinity; region = null;
    sceneLoops = []; advancedAt = -Infinity; reel = null; stop();
  }
  if (toggle) toggle.onclick = () => { enabled = !enabled; save(); if (!enabled) stop(); else void unlock(); render(); };
  if (quick) quick.onclick = () => toggle?.click();
  if (slider) slider.oninput = () => {
    volume = Number(slider.value) / 100; save();
    if (master) master.gain.setTargetAtTime(volume, context.currentTime, .02);
    if (!volume) stop(); void unlock(); render();
  };
  const gesture = event => {
    if (event.type === 'keydown' && (event.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
    if (!context || context.state !== 'running') void unlock();
  };
  window.addEventListener('pointerdown', gesture); window.addEventListener('keydown', gesture);
  document.addEventListener('visibilitychange', () => { reset(); if (document.hidden) void context?.suspend(); else if (context) void unlock(); });
  window.addEventListener('pagehide', reset);
  render();
  return {
    reset,
    ingest(state) {
      const nextRegion = state.colony?.regionId || 'home';
      if (state.epoch !== epoch || state.time < time || nextRegion !== region) {
        events.reset(); stop(); sceneLoops = []; reel = null; advancedAt = -Infinity;
      }
      const advancing = state.epoch !== epoch || state.time !== time || nextRegion !== region;
      const scene = events.ingest(state);
      epoch = state.epoch; time = state.time; region = nextRegion;
      if (!wanted()) { stop(); sceneLoops = []; return; }
      const point = listener();
      const candidates = scene.events.map(event => ({event, profile: COLONY_SOUND_PROFILES[event.kind]}))
        .filter(item => item.profile).map(({event, profile}) => ({event, position: spatial(event, point, profile)}))
        .filter(item => item.position.gain > .005).sort((a, b) => b.position.gain - a.position.gain);
      let count = 0;
      for (const {event, position} of candidates) if (count < 6 && play(event, position)) count++;
      if (advancing) { sceneLoops = scene.loops; advancedAt = performance.now(); syncLoops(); }
    },
    cue(kind, details = {}) {
      const profile = COLONY_SOUND_PROFILES[kind]; if (!profile) return false;
      const point = listener(), event = {...point, ...details, kind};
      return play(event, spatial(event, point, profile));
    },
    setReeling(on, details = {}) {
      if (!wanted()) { reel = null; stop(); return; }
      const wasOn = !!reel;
      reel = on ? {...details, kind: 'fish-reel', id: 'local-angler', local: true} : null;
      if (on || wasOn) syncLoops();
    },
  };
}
