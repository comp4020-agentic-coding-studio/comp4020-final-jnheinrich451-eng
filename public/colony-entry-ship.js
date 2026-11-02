// Civilian presentation only. Admission and save ownership stay in campaigns.js.
export const COLONY_ENTRY = Object.freeze({ zoom: 1300, release: 1600, dive: 4800, total: 7700 });
export const COLONY_TRAVEL = Object.freeze({ turn: 450, depart: 650, exchange: 550, arrive: 750, settle: 400, total: 2800 });
export const COLONY_REST_ANGLE = -Math.PI / 2 + Math.PI / 12;
const CARRIER_SCALE = .8;
// Mouths of the three aft engine drums, measured in the original overhead art.
const ENGINE_NOZZLES = Object.freeze([246, 360, 475].map(y => Object.freeze({ x: 58, y })));
// Crop rectangles use asset pixels; anchors use the cropped image's proportions.
// Keeping the bay separate makes replacement art safe without changing the flight.
export const COLONY_SPRITES = Object.freeze({
  carrier: Object.freeze({ src: '/assets/entry/mycorrhizal-white-gold-top-v1.png', sourceRect: Object.freeze({ x: 36, y: 162, width: 2100, height: 402 }), anchor: Object.freeze({ u: .5, v: .5 }), bays: Object.freeze([Object.freeze({ u: .80, v: .27 }), Object.freeze({ u: .80, v: .79 })]) }),
  shuttle: Object.freeze({ src: '/assets/entry/mycorrhizal-shuttle-top-v1.png', sourceRect: Object.freeze({ x: 48, y: 84, width: 1980, height: 588 }), anchor: Object.freeze({ u: .5, v: .5 }), lengthRatio: .12 }),
});
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
const turnTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Planet travel compresses the unseen distance between worlds. Each visible leg
// has continuous steering and speed; only the offscreen middle changes the scene.
export function colonyTravelState(age) {
  const { turn, depart, exchange, arrive, settle, total } = COLONY_TRAVEL;
  const t = Math.max(0, age), leaves = turn + depart, returns = leaves + exchange, slows = returns + arrive;
  const phase = t < turn ? 'turn' : t < leaves ? 'depart' : t < returns ? 'exchange' : t < slows ? 'arrive' : t < total ? 'settle' : 'done';
  const begins = { turn: 0, depart: turn, exchange: leaves, arrive: returns, settle: slows, done: total };
  const lengths = { turn, depart, exchange, arrive, settle, done: 1 };
  const sceneMix = smooth((t - leaves) / exchange);
  return { phase, progress: clamp((t - begins[phase]) / lengths[phase]), sceneMix, swapped: sceneMix >= .5, done: t >= total };
}

export function colonyTravelPose(from, to, state, route = {}) {
  const departureAngle = route.departureAngle ?? -Math.PI * .75;
  const arrivalAngle = route.arrivalAngle ?? departureAngle;
  const distance = Math.max(1, route.distance ?? Math.max(from.length, to.length) * 4);
  const p = state.progress;
  if (state.phase === 'turn') return { ...from, angle: from.angle + turnTo(from.angle, departureAngle) * smooth(p), alpha: 1 };
  if (state.phase === 'depart') return { ...from, x: from.x + Math.cos(departureAngle) * distance * p * p,
    y: from.y + Math.sin(departureAngle) * distance * p * p, angle: departureAngle, alpha: 1 };
  if (state.phase === 'exchange') return { ...to, angle: arrivalAngle, alpha: 0 };
  if (state.phase === 'arrive') return { ...to, x: to.x - Math.cos(arrivalAngle) * distance * (1 - p) ** 2,
    y: to.y - Math.sin(arrivalAngle) * distance * (1 - p) ** 2, angle: arrivalAngle, alpha: 1 };
  if (state.phase === 'settle') return { ...to, angle: arrivalAngle + turnTo(arrivalAngle, to.angle) * smooth(p), alpha: 1 };
  return { ...to, alpha: 1 };
}

export function colonyEntryState(age, admitted = true) {
  const { zoom, release, dive, total } = COLONY_ENTRY;
  const clock = Math.max(0, admitted ? age : Math.min(age, zoom - 1));
  return { phase: clock < zoom ? 'zoom' : clock < zoom + release ? 'release' : 'dive',
    zoom: smooth(clock / zoom), release: smooth((clock - zoom) / release),
    dive: clamp((clock - zoom - release) / dive), done: admitted && clock >= total };
}

export function colonyCarrierPose(globe, time, compact = false) {
  // A small inclined orbit stays on the near lower hemisphere, clear of headings.
  const orbit = time * .00011;
  return { x: globe.x + globe.r * (-.16 + Math.sin(orbit) * .12),
    y: globe.y + globe.r * (.39 + Math.cos(orbit) * .055),
    angle: COLONY_REST_ANGLE,
    length: CARRIER_SCALE * clamp(globe.r * (compact ? 1.04 : 1.18), compact ? 150 : 280, compact ? 210 : 450) };
}

export function colonyExhaustPoses(carrier, options = {}) {
  // The scene owns this clock and freezes it for pause/reduced motion. Repainting
  // a paused frame therefore preserves the exact flame shape, without a snap.
  const { time = 0, travel = null } = options;
  const progress = clamp(travel?.progress || 0);
  const thrust = travel?.phase === 'depart' ? mix(.34, 1, progress)
    : travel?.phase === 'arrive' ? mix(1, .2, progress)
      : travel?.phase === 'turn' ? mix(.2, .34, progress) : .2;
  const sprite = COLONY_SPRITES.carrier, rect = sprite.sourceRect;
  return ENGINE_NOZZLES.map((nozzle, index) => {
    const x = ((nozzle.x - rect.x) / rect.width - sprite.anchor.u) * carrier.length;
    const y = ((nozzle.y - rect.y) / rect.height - sprite.anchor.v) * carrier.length * rect.height / rect.width;
    const pulse = .9 + .07 * Math.sin(time * .017 + index * 2.1) + .03 * Math.sin(time * .041 + index * 1.3);
    return { x: carrier.x + Math.cos(carrier.angle) * x - Math.sin(carrier.angle) * y,
      y: carrier.y + Math.sin(carrier.angle) * x + Math.cos(carrier.angle) * y,
      angle: carrier.angle + Math.PI, length: carrier.length * (.035 + .105 * thrust) * pulse,
      radius: carrier.length * .012 * (.82 + .18 * thrust), alpha: (.5 + .3 * thrust) * pulse };
  });
}

export function colonyBayPose(carrier, index = 0) {
  const sprite = COLONY_SPRITES.carrier;
  const bay = sprite.bays[index === 1 ? 1 : 0];
  const x = (bay.u - sprite.anchor.u) * carrier.length;
  const y = (bay.v - sprite.anchor.v) * carrier.length * sprite.sourceRect.height / sprite.sourceRect.width;
  return { x: carrier.x + Math.cos(carrier.angle) * x - Math.sin(carrier.angle) * y,
    y: carrier.y + Math.sin(carrier.angle) * x + Math.cos(carrier.angle) * y,
    angle: carrier.angle, length: carrier.length * COLONY_SPRITES.shuttle.lengthRatio };
}

export function colonyShuttlePose(carrier, state = { release: 0, dive: 0 }) {
  const bay = colonyBayPose(carrier), p = smooth(state.dive), r = state.release;
  // The port shuttle clears the bow to the outside, then flies ahead in a shallow
  // S. Offsets follow the ship's heading, not a gravity-driven screen-down fall.
  const forward = carrier.length * (.18 * r + .95 * p);
  const across = carrier.length * (-.14 * r + Math.sin(p * Math.PI * 2) * .055);
  return { ...bay, x: bay.x + Math.cos(carrier.angle) * forward - Math.sin(carrier.angle) * across,
    y: bay.y + Math.sin(carrier.angle) * forward + Math.cos(carrier.angle) * across,
    angle: bay.angle + .16 * r + Math.sin(p * Math.PI * 2) * .09 };
}

export function colonyCamera(carrier, state, width, height) {
  const shuttle = colonyShuttlePose(carrier, state), handover = smooth(state.release);
  return { z: mix(1, width <= 760 ? 1.7 : 1.55, state.zoom) * mix(1, 2, handover) * mix(1, 1.25, smooth(state.dive)),
    fx: mix(carrier.x, shuttle.x, handover), fy: mix(carrier.y, shuttle.y, handover),
    x: mix(carrier.x, width * .49, state.zoom), y: mix(carrier.y, height * .49, state.zoom) };
}

export function loadColonyShip(ready) {
  const images = {}, pending = Object.keys(COLONY_SPRITES);
  for (const name of pending) {
    const image = new Image();
    image.onload = () => { images[name] = image; if (pending.every(key => images[key])) ready(images); };
    image.src = COLONY_SPRITES[name].src;
  }
}

function paintSprite(ctx, image, definition, pose, alpha) {
  if (!image || alpha <= 0) return;
  const rect = definition.sourceRect, tall = pose.length * rect.height / rect.width;
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle); ctx.globalAlpha *= alpha;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height,
    -pose.length * definition.anchor.u, -tall * definition.anchor.v, pose.length, tall);
  ctx.restore();
}

function paintCarrierExhaust(ctx, carrier, alpha, options) {
  if (alpha <= 0) return;
  for (const jet of colonyExhaustPoses(carrier, options)) {
    ctx.save(); ctx.translate(jet.x, jet.y); ctx.rotate(jet.angle);
    ctx.globalAlpha *= alpha * jet.alpha; ctx.globalCompositeOperation = 'screen';
    // Two short tapered ribbons per engine; no particles, per-pixel processing,
    // or full-screen blur. The hull drawn afterwards covers the nozzle roots.
    for (const core of [false, true]) {
      const length = jet.length * (core ? .7 : 1), radius = jet.radius * (core ? .58 : 1.55);
      const glow = ctx.createLinearGradient(0, 0, length, 0);
      glow.addColorStop(0, core ? 'rgba(225,253,255,.95)' : 'rgba(80,183,255,.7)');
      glow.addColorStop(.3, core ? 'rgba(107,230,255,.8)' : 'rgba(45,141,255,.5)');
      glow.addColorStop(1, 'rgba(30,95,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.moveTo(-jet.radius * .5, -radius * .6);
      ctx.quadraticCurveTo(length * .25, -radius, length, 0);
      ctx.quadraticCurveTo(length * .25, radius, -jet.radius * .5, radius * .6);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export function paintColonyVessels(ctx, images, carrier, state, alpha = 1, options = {}) {
  const shuttle = colonyShuttlePose(carrier, state);
  const carrierAlpha = alpha * (1 - smooth((state?.dive || 0) / .42));
  if (images.carrier) paintCarrierExhaust(ctx, carrier, carrierAlpha, options);
  paintSprite(ctx, images.carrier, COLONY_SPRITES.carrier, carrier, carrierAlpha);
  // Both bow craft are visible from above. Only the port shuttle detaches; the
  // starboard shuttle stays in its berth and recedes with the carrier.
  paintSprite(ctx, images.shuttle, COLONY_SPRITES.shuttle, colonyBayPose(carrier, 1), carrierAlpha);
  paintSprite(ctx, images.shuttle, COLONY_SPRITES.shuttle, shuttle, alpha);
}

export function paintColonyAtmosphere(ctx, { width, height, state, time, clouds, ground, shuttle, palette }) {
  const air = smooth(state.dive / .36);
  if (!air) return;
  ctx.save(); ctx.globalAlpha = air;
  ctx.fillStyle = palette?.water || '#70a7a5'; ctx.fillRect(0, 0, width, height);
  if (ground) {
    // A slow lateral ground drift matches the shuttle's controlled glide.
    const scale = Math.max(width / ground.width, height / ground.height) * 2.8;
    const w = ground.width * scale, h = ground.height * scale;
    ctx.drawImage(ground, -w * .24 - state.dive * width * .11, -h * .28 - state.dive * height * .07, w, h);
  }
  ctx.fillStyle = 'rgba(218,237,231,.47)'; ctx.fillRect(0, 0, width, height);
  if (clouds) for (let i = 0; i < 9; i++) {
    const cycle = (i * .137 + time * .000035 * (1 + i % 3 * .12)) % 1;
    const size = width * (.40 + i % 3 * .16), x = width * (1.35 - cycle * 1.85), y = height * ((i * .233) % 1);
    ctx.globalAlpha = air * (.22 + i % 3 * .09);
    ctx.drawImage(clouds, x - size / 2, y - size / 4, size, size * .5);
  }
  // A fixed small ribbon set expresses moving air; no projectile or particle simulation.
  ctx.globalAlpha = air * .46; ctx.translate(shuttle.x, shuttle.y); ctx.rotate(shuttle.angle);
  ctx.strokeStyle = '#efffff'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) {
    const phase = (time * .00027 + i * .173) % 1;
    const x = width * (.56 - phase * 1.12), y = ((i % 6) - 2.5) * height * .11;
    const length = width * (.035 + (i % 3) * .018);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - length * .5, y + 4, x - length, y); ctx.stroke();
  }
  ctx.restore();
}
