// Re-entry from orbit for every orbital arrival and strike (author, 9 November 2026).
// Presentation only. A pose comes from the object's own saved countdown and is
// exactly its saved ground point at its saved impact time. Smoke is browser-only
// cosmetic state keyed by the object's id and drawn from the server clock, so a
// pause freezes it and every player sees it drift in the same wind. Nothing here
// moves a hit, a landing point or a timer.
//
// What is modelled: everything from the same orbit comes in along one ground
// track per planet, steeply in its last seconds. A hot body sheds a plasma wake
// whose glow follows its heating; capsules brake (the plasma dies, then retro
// rockets fire and blow dust out just before contact) while strike shells stay
// hypersonic to the ground. The trail they leave is smoke that lingers, spreads,
// drifts downwind and is twisted by shear, more so higher up.
import { windAt } from './wind.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
const hash = text => {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};

export const REENTRY = Object.freeze({
  lean: .55,        // ground-track run per unit of height: a steep final entry
  preroll: .7,      // smoke above the visible descent, laid before it came into view
  linger: 14000,    // ms a trail of smoke stays, spreading and drifting
  heavyLinger: 20000,
  maxTrails: 48,
  burn: .8,         // braking capsules light their retro rockets here
});

const state = { clock: 0, world: null, key: null, track: { x: 1, y: 0 }, reduced: false };
const trails = new Map();

// The planet's orbital ground track: the direction arrivals come from. Fixed per
// world, east- or west-going within 40 degrees.
export function orbitTrack(world) {
  const h = hash(`${world?.id || world?.name || 'frontier'}:orbit`), side = h < .5 ? 1 : -1, angle = ((h * 7) % 1 - .5) * 1.4;
  return { x: side * Math.cos(angle), y: Math.sin(angle) };
}

// Screen offset in tiles of a body at altitude 1 (height tiles up). Height reads
// as an upward offset, as everywhere on this battlefield.
export function entryOffset(height, track = state.track) {
  return { x: track.x * REENTRY.lean * height, y: (track.y * REENTRY.lean - 1) * height };
}

// Fraction of the starting height at progress s (0 top, 1 contact). Capsules
// brake to a soft contact; shells keep their speed. Valid for s < 0 (above).
export function altitude(curve, s) { return curve === 'shell' ? 1 - s : Math.max(0, 1 - s) ** 1.6; }

// Pose at progress s along a path whose altitude-1 offset is `offset` (tiles).
export function descentPose(curve, s, offset) {
  const a = altitude(curve, s), length = Math.hypot(offset.x, offset.y) || 1;
  return {
    s, a, x: offset.x * a, y: offset.y * a, ux: -offset.x / length, uy: -offset.y / length,
    // Plasma glows while the body is fast: a capsule's dies as it brakes, a
    // shell's grows in the denser air near the ground.
    heat: curve === 'shell' ? .75 + .25 * clamp(s) : 1 - smooth(s / .62),
    burn: curve === 'pod' ? smooth((s - REENTRY.burn) / .05) * (1 - smooth((s - .975) / .025)) : 0,
  };
}

// Called once per frame before drawing. Clock: server ms (combat time plus the
// snapshot's age, frozen while the room is paused).
export function reentryFrame(world, clock, reduced) {
  const key = world?.id || world?.name || null;
  if (key !== state.key) { state.key = key; state.track = orbitTrack(world); trails.clear(); }
  state.world = world; state.clock = clock; state.reduced = !!reduced;
  for (const [id, trail] of trails) if (clock > trail.start + trail.duration * 1000 + trail.linger || clock < trail.start - 60000) trails.delete(id);
}
export const reentryTrack = () => state.track;

// Remember a descent so its smoke stays after the body has landed. Repeated
// calls for the same descent keep its first start; a new descent of the same
// id (a second recovery, say) replaces it. Bounded: the oldest trail goes first.
export function noteDescent(id, spec) {
  if (state.reduced) return;
  const start = state.clock - spec.elapsed * 1000, old = trails.get(id);
  if (old && Math.abs(old.start - start) < 1500) return;
  trails.set(id, { type: spec.type || 'trail', curve: spec.curve || 'pod', x: spec.x, y: spec.y, offset: spec.offset, to: spec.to, start,
    duration: spec.duration, size: spec.size ?? 1, opacity: spec.opacity ?? .3, linger: spec.linger ?? REENTRY.linger,
    preroll: spec.preroll ?? REENTRY.preroll, seed: hash(id) });
  if (trails.size > REENTRY.maxTrails) {
    let oldest = null;
    for (const [key, trail] of trails) if (!oldest || trail.start < trails.get(oldest).start) oldest = key;
    trails.delete(oldest);
  }
}
export const reentryTrailCount = () => trails.size;

// One capsule's descent at the current origin (its ground point): remembers its
// smoke and draws its plasma, retro burn and ground light. `body` is the drawn
// half-width in tiles and `grow` the caller's perspective scale per unit of
// altitude, so the plasma wraps the body instead of hiding beneath it. Returns
// the pose the caller draws its body at.
export function capsuleDescent(c, T, spec, reduced) {
  const offset = entryOffset(spec.height), pose = descentPose('pod', spec.s, offset);
  if (!reduced && !state.reduced) {
    noteDescent(spec.id, { x: spec.x, y: spec.y, offset, curve: 'pod', elapsed: spec.s * spec.duration, duration: spec.duration, size: spec.body * 1.1, opacity: spec.opacity ?? .3 });
    drawDescentHead(c, pose, T, spec.body * (1 + pose.a * (spec.grow || 0)) * 3.75);
  }
  return pose;
}

// Hot body, its plasma wake and its light on the ground. The origin is the
// ground point; the caller draws any solid body afterwards, over its glow.
export function drawDescentHead(c, pose, T, size = 1) {
  if (state.reduced) return;
  const r = size * T * .2, hx = pose.x * T, hy = pose.y * T, near = 1 - clamp(pose.a / .35);
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  if (pose.heat > .02) {
    const length = r * (4 + 11 * pose.heat), tx = hx - pose.ux * length, ty = hy - pose.uy * length;
    for (const [width, red, green, blue, alpha] of [[3.4, 255, 104, 66, .24], [1.9, 255, 166, 90, .44], [.75, 255, 245, 218, .9]]) {
      const wake = c.createLinearGradient(tx, ty, hx, hy);
      wake.addColorStop(0, `rgba(${red},${green},${blue},0)`);
      wake.addColorStop(.65, `rgba(${red},${green},${blue},${alpha * .45 * pose.heat})`);
      wake.addColorStop(1, `rgba(${red},${green},${blue},${alpha * pose.heat})`);
      c.strokeStyle = wake; c.lineWidth = r * width; c.beginPath(); c.moveTo(tx, ty); c.lineTo(hx, hy); c.stroke();
    }
    // Plasma sheath: the shock ahead of the body is the brightest part.
    const glow = c.createRadialGradient(hx + pose.ux * r * .5, hy + pose.uy * r * .5, 0, hx, hy, r * 3.2);
    glow.addColorStop(0, `rgba(255,250,234,${.9 * pose.heat})`); glow.addColorStop(.25, `rgba(255,198,122,${.55 * pose.heat})`);
    glow.addColorStop(.6, `rgba(255,118,78,${.18 * pose.heat})`); glow.addColorStop(1, 'rgba(255,92,60,0)');
    c.fillStyle = glow; c.fillRect(hx - r * 3.2, hy - r * 3.2, r * 6.4, r * 6.4);
    // The approaching fire lights the ground under it (shells mostly).
    const light = pose.heat * near * near * (pose.burn ? 0 : 1);
    if (light > .01) {
      const radius = r * (2 + 7 * near), ground = c.createRadialGradient(0, 0, 0, 0, 0, radius);
      ground.addColorStop(0, `rgba(255,196,120,${.42 * light})`); ground.addColorStop(.4, `rgba(255,120,60,${.18 * light})`); ground.addColorStop(1, 'rgba(255,100,50,0)');
      c.fillStyle = ground; c.fillRect(-radius, -radius, radius * 2, radius * 2);
    }
  }
  if (pose.burn > .01) {
    // Retro rockets: a short flame toward the ground, its light, and the dust
    // it blows outward before the capsule touches down.
    const flicker = .86 + .14 * Math.sin(pose.s * 211) * Math.sin(pose.s * 97), length = r * 3.4 * flicker * pose.burn;
    const px = -pose.uy, py = pose.ux, tipX = hx + pose.ux * length, tipY = hy + pose.uy * length;
    const flame = c.createLinearGradient(hx, hy, tipX, tipY);
    flame.addColorStop(0, `rgba(255,252,236,${.95 * pose.burn})`); flame.addColorStop(.35, `rgba(255,206,120,${.75 * pose.burn})`); flame.addColorStop(1, 'rgba(255,120,60,0)');
    c.fillStyle = flame; c.beginPath();
    c.moveTo(hx + px * r * .7, hy + py * r * .7); c.lineTo(tipX, tipY); c.lineTo(hx - px * r * .7, hy - py * r * .7); c.closePath(); c.fill();
    const radius = r * (2.4 + 3 * near), ground = c.createRadialGradient(0, 0, 0, 0, 0, radius);
    ground.addColorStop(0, `rgba(255,222,160,${.4 * pose.burn * near})`); ground.addColorStop(1, 'rgba(255,150,80,0)');
    c.fillStyle = ground; c.fillRect(-radius, -radius, radius * 2, radius * 2);
    c.globalCompositeOperation = 'source-over';
    const blow = smooth((pose.s - .86) / .14), strength = Math.max(pose.burn, blow * .6);
    if (blow > 0) {
      // A soft ring of dust thrown outward by the exhaust, clearing the centre.
      const radius = r * (1.8 + 4.5 * blow), dust = c.createRadialGradient(0, 0, 0, 0, 0, radius);
      dust.addColorStop(0, 'rgba(204,190,162,0)'); dust.addColorStop(.5, `rgba(204,190,162,${.05 * strength})`);
      dust.addColorStop(.78, `rgba(214,200,172,${.4 * strength * blow})`); dust.addColorStop(1, 'rgba(214,200,172,0)');
      c.fillStyle = dust; c.fillRect(-radius, -radius, radius * 2, radius * 2);
    }
  }
  c.restore();
}

// All remembered smoke, beneath structures and units so the battlefield stays
// readable. Each trail is two soft filled ribbons; a beam's cut leaves puffs.
/**
 * `view` (world pixels) skips trails wholly off screen.
 * @param {{x0:number,y0:number,x1:number,y1:number}|null} [view]
 */
export function drawReentrySmoke(c, T, view = null) {
  if (state.reduced || !trails.size) return;
  const wind = windAt(state.world, state.clock, false);
  c.save();
  for (const trail of trails.values()) trail.type === 'cut' ? cutSmoke(c, trail, T, wind) : ribbon(c, trail, T, wind, view);
  c.restore();
}

function ribbon(c, trail, T, wind, view) {
  const D = trail.duration * 1000, clock = state.clock, top = -trail.preroll, end = Math.min(1, (clock - trail.start) / D);
  if (end <= top || clock - (trail.start + end * D) > trail.linger) return;
  const n = 14, points = [], o = trail.offset, length = Math.hypot(o.x, o.y) || 1, nx = -o.y / length, ny = o.x / length;
  const intro = smooth((clock - trail.start) / 450);
  for (let k = 0; k <= n; k++) {
    const s = top + (end - top) * k / n, age = Math.max(0, clock - (trail.start + s * D)) / 1000;
    const a = altitude(trail.curve, s), high = Math.min(a, 1.8), drift = wind.strength * (.2 + .45 * high) * age;
    const twist = Math.sin(s * 6.5 + trail.seed * 6.283) * (.08 + .22 * high) * age;
    const landing = trail.curve === 'pod' ? smooth((s - .8) / .2) : 0;
    points.push({
      x: (trail.x + o.x * a + wind.dx * drift + nx * twist) * T, y: (trail.y + o.y * a + wind.dy * drift + ny * twist) * T,
      w: (trail.size * (.16 + .07 * high + .45 * landing) + .2 * Math.sqrt(age)) * T,
      alpha: trail.opacity * smooth(age / .25) * (1 - smooth(age * 1000 / trail.linger)) * smooth((s - top) / .4) * intro,
    });
  }
  const first = points[0], last = points[n];
  if (Math.hypot(last.x - first.x, last.y - first.y) < 1 || points.every(p => p.alpha < .006)) return;
  if (view) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p.x - p.w); y0 = Math.min(y0, p.y - p.w); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.w); }
    if (x1 < view.x0 || y1 < view.y0 || x0 > view.x1 || y0 > view.y1) return;
  }
  for (const [spread, strength] of [[2.4, .32], [1, 1]]) {
    // Seven colour stops are plenty for a smooth fade and keep each gradient cheap.
    const shade = c.createLinearGradient(first.x, first.y, last.x, last.y);
    for (let k = 0; k <= n; k += 2) shade.addColorStop(k / n, `rgba(206,201,192,${clamp(points[k].alpha * strength).toFixed(3)})`);
    c.fillStyle = shade; c.beginPath();
    for (let side = 1; side >= -1; side -= 2) for (let j = 0; j <= n; j++) {
      const k = side > 0 ? j : n - j, p = points[k], before = points[Math.max(0, k - 1)], after = points[Math.min(n, k + 1)];
      const tx = after.x - before.x, ty = after.y - before.y, t = Math.hypot(tx, ty) || 1, half = p.w * spread / 2 * side;
      const x = p.x - ty / t * half, y = p.y + tx / t * half;
      if (side > 0 && !j) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill();
  }
}

// A cutting beam boils the ground along its cut: puffs at fixed spacing, each
// rising (spreading toward the camera) and drifting downwind from when it was cut.
function cutSmoke(c, trail, T, wind) {
  const D = trail.duration * 1000, clock = state.clock, cut = clamp((clock - trail.start) / D);
  const dx = trail.to.x - trail.x, dy = trail.to.y - trail.y, length = Math.hypot(dx, dy), step = Math.max(.8, length / 48);
  for (let i = 0; (i + .5) * step <= length * cut; i++) {
    const f = (i + .5) * step / length, age = (clock - (trail.start + f * D)) / 1000;
    if (age < 0) continue;
    const drift = wind.strength * .35 * age, wobble = Math.sin(i * 2.1 + trail.seed * 6.283) * .15 * age;
    const x = (trail.x + dx * f + wind.dx * drift - wind.dy * wobble) * T, y = (trail.y + dy * f + wind.dy * drift + wind.dx * wobble) * T;
    const alpha = .2 * smooth(age / .4) * (1 - smooth(age * 1000 / trail.linger));
    if (alpha < .005) continue;
    c.fillStyle = `rgba(140,134,126,${alpha})`; c.beginPath(); c.arc(x, y, (.35 + .3 * Math.sqrt(age)) * T, 0, Math.PI * 2); c.fill();
  }
}
