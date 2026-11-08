// The reel fight meter and the catch card. Browser-only presentation and input:
// the server replays the recorded holds through colony-fish.js to decide the catch.
import { finishedRecording, fishArticle, fishGenome, simulateStruggle } from './colony-fish.js';
import { drawAlienFish } from './colony-fish-art.js';

const TAU = Math.PI * 2;
/** A jagged red burst behind the fish, as in the author's catch-card sketch. */
function burstPoints(count = 26) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = i / count * TAU, r = i % 2 ? .78 : 1, wobble = .92 + .08 * Math.sin(i * 2.3);
    points.push(`${(100 + Math.cos(angle) * 92 * r * wobble).toFixed(1)},${(62 + Math.sin(angle) * 54 * r * wobble).toFixed(1)}`);
  }
  return points.join(' ');
}

/**
 * @param {{ $: (id: string) => any, act: (action: string, data?: any) => Promise<any>, toast: (message: string, error?: boolean) => void, reduced: () => boolean }} options
 */
export function createFishingUI({ $, act, toast, reduced }) {
  /** @type {null | { seed: string, genome: any, startedAt: number, toggles: number[], held: boolean, sent: boolean }} */
  let fight = null;
  /** @type {null | { genome: any, openedAt: number }} */
  let card = null;
  let cardTimer = 0;
  // The last fight this page played, so a packet that still shows it never restarts it.
  let lastSeed = null;
  const meter = $('fish-fight-canvas'), meterContext = meter.getContext('2d');
  const picture = $('catch-fish'), pictureContext = picture.getContext('2d');
  $('catch-burst-shape').setAttribute('points', burstPoints());

  const elapsed = now => fight ? Math.max(0, (now - fight.startedAt) / 1000) : 0;
  /** Start a fight from the server's hook. `offset` (s) resumes one already under way. */
  function start(info, planet, offset = 0) {
    if (!info?.seed) return;
    lastSeed = info.seed;
    // Browser tests read the live fight here, as they read colonyPackets.
    /** @type {any} */ (globalThis).colonyFight = null;
    fight = { seed: info.seed, genome: fishGenome(info.seed, planet), startedAt: performance.now() - offset * 1000, toggles: [], held: false, sent: false };
    $('fish-fight').hidden = false;
  }
  function stop() { fight = null; $('fish-fight').hidden = true; }
  /** Hold (true) or release (false) the reel. Only real changes are recorded. */
  function hold(on) {
    if (!fight || fight.sent || fight.held === on) return;
    fight.held = on; fight.toggles.push(Math.round(elapsed(performance.now()) * 1000) / 1000);
    $('fish-reel').classList.toggle('held', on);
  }
  function drawMeter(played) {
    const ratio = Math.min(2, devicePixelRatio || 1), width = meter.clientWidth || 112, height = meter.clientHeight || 260;
    if (meter.width !== Math.round(width * ratio)) { meter.width = Math.round(width * ratio); meter.height = Math.round(height * ratio); }
    const c = meterContext; c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0, 0, width, height);
    const top = 12, bottom = height - 12, span = bottom - top, track = { x: 10, w: width * .52 }, bar = { x: track.x + track.w + 12, w: 12 };
    const water = c.createLinearGradient(0, top, 0, bottom); water.addColorStop(0, '#9fd6d0'); water.addColorStop(1, '#2f5f68');
    c.fillStyle = water; c.beginPath(); c.roundRect(track.x, top, track.w, span, 10); c.fill();
    c.strokeStyle = '#4f6a5c'; c.lineWidth = 1.5; c.stroke();
    // The catch ring the angler lifts.
    const zoneTop = bottom - (played.y + played.size) * span, zoneHeight = played.size * span;
    c.fillStyle = played.inside ? '#f6dc8ccc' : '#f4f1e2a6'; c.strokeStyle = played.inside ? '#b8893c' : '#e9e5d2';
    c.beginPath(); c.roundRect(track.x + 3, zoneTop, track.w - 6, zoneHeight, 7); c.fill(); c.lineWidth = 2; c.stroke();
    // The fish, a small picture of the real catch.
    const fishY = bottom - played.fish * span, now = performance.now() / 1000;
    c.save(); if (played.inside) { c.shadowColor = '#fff3b8'; c.shadowBlur = 10; }
    drawAlienFish(c, fight.genome, track.x + track.w / 2, fishY, Math.min(36, track.w * .78), now, { swim: !reduced() });
    c.restore();
    // Progress: fills inside the ring, drains outside it.
    c.fillStyle = '#e7e6d6'; c.beginPath(); c.roundRect(bar.x, top, bar.w, span, 6); c.fill();
    const fill = played.progress, color = fill > .66 ? '#7fae6a' : fill > .33 ? '#d7aa52' : '#c96a4f';
    c.fillStyle = color; c.beginPath(); c.roundRect(bar.x, bottom - fill * span, bar.w, fill * span, 6); c.fill();
    c.strokeStyle = '#6c7c62'; c.lineWidth = 1; c.beginPath(); c.roundRect(bar.x, top, bar.w, span, 6); c.stroke();
  }
  /** Advance the fight each frame; `activity` is the local worker's server activity. */
  function update(now, activity, planet) {
    // A refresh mid-fight resumes from the server's clock; the fish has likely escaped by then.
    if (!fight && activity?.kind === 'fish' && activity.fight?.seed && activity.fight.seed !== lastSeed) start(activity.fight, planet, 0);
    if (!fight) return;
    if (activity?.kind !== 'fish' || !activity.fight || activity.fight.seed !== fight.seed) {
      if (!fight.sent) toast('The fish got away.');
      stop(); return;
    }
    const played = simulateStruggle(fight.seed, fight.genome.difficulty, fight.toggles, elapsed(now));
    /** @type {any} */ (globalThis).colonyFight = played;
    drawMeter(played);
    if (played.done && !fight.sent) {
      fight.sent = true;
      const recording = finishedRecording(fight.toggles, played.t);
      void act('land', recording).finally(stop);
    }
  }
  function drawPicture() {
    if (!card) return;
    const ratio = Math.min(2, devicePixelRatio || 1), width = picture.clientWidth || 260, height = picture.clientHeight || 150;
    if (picture.width !== Math.round(width * ratio)) { picture.width = Math.round(width * ratio); picture.height = Math.round(height * ratio); }
    const c = pictureContext; c.setTransform(ratio, 0, 0, ratio, 0, 0); c.clearRect(0, 0, width, height);
    drawAlienFish(c, card.genome, width / 2, height / 2, width * .74, (performance.now() - card.openedAt) / 1000, { swim: !reduced() });
    if (!reduced()) requestAnimationFrame(drawPicture);
  }
  /** The gold catch card: "You caught a [name]!" */
  function showCatch(fish, kept) {
    const genome = fishGenome(fish.seed, fish.planet);
    card = { genome, openedAt: performance.now() };
    $('catch-title').textContent = `You caught ${fishArticle(genome.name)} ${genome.name}!`;
    $('catch-detail').textContent = `${fish.length} cm · ${genome.rarityName} · ${kept ? 'sent to the warehouse' : 'the warehouse is full, so it swims free'}`;
    $('catch-card').hidden = false; $('catch-card').dataset.rarity = String(genome.rarity);
    requestAnimationFrame(drawPicture);
    clearTimeout(cardTimer); cardTimer = setTimeout(hideCatch, 7000);
  }
  function hideCatch() { clearTimeout(cardTimer); card = null; $('catch-card').hidden = true; }
  $('catch-close').onclick = hideCatch;
  const reel = $('fish-reel');
  reel.addEventListener('pointerdown', event => { event.preventDefault(); reel.setPointerCapture(event.pointerId); hold(true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) reel.addEventListener(type, () => hold(false));
  return {
    start, stop, hold, update, showCatch, hideCatch,
    get active() { return !!fight && !fight.sent; },
    get reeling() { return !!fight && !fight.sent && fight.held; },
    get cardOpen() { return !!card; },
  };
}
