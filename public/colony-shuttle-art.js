// @ts-check
// The colony freight shuttle and its launch-and-return flight. Presentation
// only: the saved shipment (`remaining`/`duration` in active room seconds)
// drives every phase as a fraction f of the trip, so 8 s legacy shipments and
// 14 s shipments share one choreography. The server lands the reward crates at
// f = 1; by then the shuttle is parked and settled exactly as it is at rest, so
// the cached parked sprite takes over without a jump. Reduced motion never flies.
//
// The classic sequence: still on the pad, belly lift thrusters warm and light,
// vertical lift, nose up, main engine ignites, climb out of view along the nose;
// away; glide back from the upper left, flare nose-up as the main engine cuts,
// level into a hover on the belly thrusters, descend, touch down and settle.
import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint } from './colony-view.js';

/** @typedef {[number, number]} P2 */
/** @typedef {[number, number, number]} P3 */
/** @typedef {(u: number, v: number, w: number) => P3} Frame */
/**
 * @typedef {object} ShuttlePose
 * @property {number} f       trip fraction, 0 at dispatch and 1 when the crates land
 * @property {string} stage   loading|ignition|lift|pitch|climb|away|approach|hover|descent|touchdown|settled
 * @property {number} x       world x of the hull centre (pad centre while parked)
 * @property {number} y       world y of the hull centre
 * @property {number} z       belly height of the level hull above the ground (0.36 parked)
 * @property {number} pitch   radians, nose (+x) up positive
 * @property {number} alpha   0 while out of view
 * @property {number} lift    belly lift-thruster flame, 0..1
 * @property {number} heat    belly thruster glow, 0..1 (leads the flame on ignition, trails it on spool-down)
 * @property {number} main    rear main-engine flame, 0..1
 * @property {number} gear    landing legs extended, 0..1
 * @property {number} dust    pad downwash, 0..1
 * @property {boolean} visible
 */

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const metal = { ink: '#52616a', dark: '#44525a', shade: '#bdc8c6', side: '#d2dcd7', white: '#f0f2eb', light: '#fffef2',
  gold: '#bc9a5c', violet: '#aaa0bc', joint: '#3f535b', glass: '#8fbec3', cyan: '#b6e4df' };
// Points toward the fixed camera: screen y = y * DEPTH - z * HEIGHT is constant along it.
const VIEW = /** @type {P3} */ ([0, COLONY_HEIGHT, COLONY_DEPTH]);

// Hull geometry in tile units: u along the hull (nose +x), v across (south +y), w up from the belly.
const REST_Z = .36, PIVOT = .24, ROOF = .47, GROUND = .14;
/** @type {P2[]} */
const BELLY = [[-1.23, -.43], [-.92, -.60], [.56, -.60], [1.15, -.35], [1.31, .09], [1.14, .39], [.63, .56], [-1.12, .56], [-1.27, .32]];
/** @type {P2[]} */
const DECK = [[-1.12, -.38], [-.91, -.49], [.49, -.49], [.99, -.28], [1.13, .04], [.99, .39], [.49, .47], [-1.07, .47], [-1.15, .30]];
// Side i joins BELLY[i]..BELLY[i+1]; 5 and 6 are the white south flank, 3 and 4 the nose, 8 the stern.
const SIDE_FILL = [metal.shade, metal.shade, metal.shade, metal.side, metal.side, metal.white, metal.white, metal.shade, metal.shade];
const LEGS = /** @type {P2[]} */ ([[-.86, -.41], [-.86, .48], [.58, -.41], [.58, .48]]);
const THRUSTERS = /** @type {P2[]} */ ([[-.70, .45], [.50, .45]]);
const NOZZLES = [-.26, .26];

// Flight profile. Heights are belly heights; distances are tiles.
const LIFT = 2.9, CLIMB_PITCH = 60 * DEG, CLIMB = 96, CLIMB_POWER = 2.6, HOVER = 2.8, FLARE = 34 * DEG, GLIDE = -16 * DEG;
// Return glide, relative to the hover point above the pad: in from the upper left.
const APPROACH = /** @type {P3[]} */ ([[-34, 0, 46], [-17, 0, 19], [-5.5, 0, 2.2], [0, 0, 0]]);

/** Phase boundaries as fractions of the trip. Overlaps are deliberate. */
export const SHUTTLE_PHASES = Object.freeze({
  loading: [0, .075],     // Morrow: loader extends, crate rides up into the bay
  warm: [.065, .10],      // belly thrusters glow and shimmer
  ignition: [.095, .15],  // belly flames grow; pad dust starts
  lift: [.15, .33],       // vertical lift to about three tiles
  gearUp: [.19, .26],
  pitch: [.27, .38],      // nose up to 60 degrees while hovering
  mainIgnition: [.31, .34],
  climb: [.335, .53],     // accelerate along the nose, out of any view
  fadeOut: [.46, .53],
  away: [.53, .57],
  approach: [.57, .75],   // glide in, flare nose-up, main engine cut at .655-.69
  hover: [.75, .80],      // level out over the pad
  gearDown: [.78, .86],
  descent: [.80, .925],
  touchdown: [.925, .97], // contact, settle bounce, thrusters spool down
  unloading: [.935, 1],   // Morrow: crate comes back down the loader
});
const P = SHUTTLE_PHASES;
const STAGES = /** @type {[string, number][]} */ ([['loading', P.warm[0]], ['ignition', P.lift[0]], ['lift', P.pitch[0]],
  ['pitch', P.climb[0]], ['climb', P.away[0]], ['away', P.approach[0]], ['approach', P.hover[0]], ['hover', P.descent[0]],
  ['descent', P.touchdown[0]], ['touchdown', P.touchdown[1]], ['settled', 2]]);

/** @param {number} t */
const clamp01 = t => Math.max(0, Math.min(1, t));
/** @param {number} t */
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** @param {number} t */
const smoother = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
/** @param {number} f @param {readonly number[]} range */
const span = (f, range) => clamp01((f - range[0]) / (range[1] - range[0]));
/** @param {number} a @param {number} b @param {number} t */
const lerp = (a, b, t) => a + (b - a) * t;
/** @param {P3[]} p @param {number} t @returns {P3} */
function bezier(p, t) {
  const s = 1 - t, a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
  /** @param {number} i */
  const at = i => a * p[0][i] + b * p[1][i] + c * p[2][i] + d * p[3][i];
  return [at(0), at(1), at(2)];
}

/** Departure climb distance along the nose at fraction f. @param {number} f */
const climbDistance = f => CLIMB * span(f, P.climb) ** CLIMB_POWER;
/** Fraction at which the climb reached distance s. @param {number} s */
const climbFraction = s => lerp(P.climb[0], P.climb[1], (Math.max(0, s) / CLIMB) ** (1 / CLIMB_POWER));
/** Return glide progress (decelerating to the hover point). @param {number} f */
const approachProgress = f => 1 - (1 - span(f, P.approach)) ** 2;

/** Trip fraction, predicting up to 0.35 s past the snapshot like the rest of the colony clock. @param {any} colony @param {number} time */
function tripFraction(colony, time) {
  const active = colony?.shipment;
  if (!active) return null;
  const duration = Math.max(.001, Number(active.duration) || 14), remaining = Math.max(0, Number(active.remaining) || 0);
  const ahead = Math.min(.35, Math.max(0, (Number.isFinite(time) ? time : 0) - (colony.time || 0)));
  return clamp01(1 - Math.max(0, remaining - ahead) / duration);
}

/**
 * The flight pose for a fraction of the trip, relative to the pad centre.
 * @param {number} f @param {number} time
 */
function poseAt(f, time) {
  let x = 0, y = 0, z = REST_Z, pitch = 0, alpha = 1, lift = 0, heat = 0, main = 0, gear = 1;
  if (f < P.away[0]) {
    lift = smooth(span(f, P.ignition)) * (1 - smooth(span(f, [.42, .48])));
    heat = Math.max(lift, smooth(span(f, P.warm)) * (1 - smooth(span(f, [.43, .49]))));
    main = smooth(span(f, P.mainIgnition));
    gear = 1 - smooth(span(f, P.gearUp));
    pitch = CLIMB_PITCH * smooth(span(f, P.pitch));
    const s = climbDistance(f);
    x = s * Math.cos(CLIMB_PITCH);
    z = REST_Z + LIFT * smoother(span(f, P.lift)) + s * Math.sin(CLIMB_PITCH);
    alpha = 1 - smooth(span(f, P.fadeOut));
  } else if (f < P.approach[0]) {
    alpha = 0; gear = 0; pitch = CLIMB_PITCH;
    x = CLIMB * Math.cos(CLIMB_PITCH); z = REST_Z + LIFT + CLIMB * Math.sin(CLIMB_PITCH);
  } else if (f < P.hover[0]) {
    const t = span(f, P.approach), p = bezier(APPROACH, approachProgress(f));
    x = p[0]; y = p[1]; z = REST_Z + HOVER + p[2];
    pitch = lerp(GLIDE, FLARE, smooth((t - .42) / .54));
    main = .62 * (1 - smooth(span(f, [.655, .69])));
    lift = smooth(span(f, [.64, .70])); heat = lift;
    alpha = smooth(span(f, [P.approach[0], P.approach[0] + .03]));
    gear = 0;
  } else if (f < P.touchdown[0]) {
    lift = 1; heat = 1;
    pitch = FLARE * (1 - smoother(span(f, P.hover)));
    gear = smooth(span(f, P.gearDown));
    const t = span(f, P.descent);
    // Ease in from the hover, but keep a little sink rate so the gear visibly takes the weight.
    z = REST_Z + HOVER * (1 - (.86 * smoother(t) + .14 * t));
  } else {
    const t = span(f, [P.touchdown[0], .965]);
    z = REST_Z - .05 * Math.sin(TAU * t) * (1 - t) ** 1.6;
    lift = 1 - smooth(span(f, [P.touchdown[0], .955]));
    heat = 1 - smooth(span(f, [.93, .985]));
  }
  // A gentle hover bob while held on the belly thrusters, fading out near the ground.
  if (f > .70 && f < P.touchdown[0]) z += .045 * Math.sin(time * 2.6) * smooth((f - .70) / .05) * smooth((z - REST_Z - .5) / 1.2);
  const dust = Math.max(0, lift) * (1 - smooth((z - REST_Z) / 4.6)) * alpha;
  let stage = 'settled';
  for (const [name, end] of STAGES) if (f < end) { stage = name; break; }
  return { f, stage, x, y, z, pitch, alpha, lift, heat, main, gear, dust, visible: alpha > .001 };
}

/**
 * The shuttle's flight pose, or null while it is parked (no shipment).
 * Coordinates are absolute world tiles; drive tests through `colony.shipment`.
 * @param {any} colony @param {number} time renderer room clock, seconds
 * @returns {ShuttlePose | null}
 */
export function shuttleFlightPose(colony, time) {
  const f = tripFraction(colony, time);
  if (f === null) return null;
  const pad = colony?.pad || { x: 0, y: 0 }, pose = poseAt(f, time);
  return { ...pose, x: pad.x + .5 + pose.x, y: pad.y + .5 + pose.y };
}

// ---- drawing helpers (local, matching the other colony art modules) ----
/** @param {number} x @param {number} y @param {number} [z] @returns {P2} */
const pt = (x, y, z) => { const p = projectColonyPoint(x, y, z || 0); return [p.x, p.y]; };
/** @param {P3} p @returns {P2} */
const pp = p => pt(p[0], p[1], p[2]);
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string | CanvasGradient} fill @param {number} [rotation] */
function ellipse(c, x, y, rx, ry, fill, rotation) { c.beginPath(); c.ellipse(x, y, Math.max(.001, rx), Math.max(.001, ry), rotation || 0, 0, TAU); c.fillStyle = fill; c.fill(); }
/** @param {CanvasRenderingContext2D} c @param {P2[]} points @param {string} color @param {number} [width] @param {CanvasLineCap} [cap] */
function line(c, points, color, width, cap) {
  if (points.length < 2) return;
  c.beginPath(); c.moveTo(points[0][0], points[0][1]); for (const p of points.slice(1)) c.lineTo(p[0], p[1]);
  c.strokeStyle = color; c.lineWidth = width ?? .025; c.lineCap = cap || 'round'; c.lineJoin = 'round'; c.stroke();
}
/** @param {CanvasRenderingContext2D} c @param {P2[]} points @param {string | null} fill @param {string | null} [stroke] @param {number} [width] */
function polygon(c, points, fill, stroke, width) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]); for (const p of points.slice(1)) c.lineTo(p[0], p[1]); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  const edge = stroke === undefined ? metal.ink : stroke;
  if (edge) { c.strokeStyle = edge; c.lineWidth = width ?? .022; c.lineJoin = 'round'; c.stroke(); }
}
/** @param {CanvasRenderingContext2D} c @param {P3[]} points @param {string | null} fill @param {string | null} [stroke] @param {number} [width] */
function poly3(c, points, fill, stroke, width) { polygon(c, points.map(pp), fill, stroke, width); }
/** @param {CanvasRenderingContext2D} c @param {P3[]} points @param {string} color @param {number} [width] */
function line3(c, points, color, width) { line(c, points.map(pp), color, width); }
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string} fill */
function groundEllipse(c, x, y, rx, ry, fill) { ellipse(c, x, y * COLONY_DEPTH, rx, ry * COLONY_DEPTH, fill); }
/** Axis-aligned chamfered box, as the parked machinery draws (used for the loader crate). @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} hx @param {number} hy @param {number} z @param {number} height @param {string} fill @param {number} edge */
function machineBox(c, x, y, hx, hy, z, height, fill, edge) {
  const b = Math.min(edge, hx * .4, hy * .4);
  /** @type {P2[]} */
  const outline = [[-hx + b, -hy], [hx - b, -hy], [hx, -hy + b], [hx, hy - b], [hx - b, hy], [-hx + b, hy], [-hx, hy - b], [-hx, -hy + b]];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], d = outline[(i + 1) % outline.length];
    poly3(c, [[x + a[0], y + a[1], z], [x + d[0], y + d[1], z], [x + d[0], y + d[1], z + height], [x + a[0], y + a[1], z + height]], i === 4 ? metal.shade : i < 4 ? metal.dark : metal.side, metal.ink, .018);
  }
  poly3(c, outline.map(([dx, dy]) => /** @type {P3} */ ([x + dx, y + dy, z + height])), fill, metal.ink, .022);
  line3(c, [[x - hx + b, y - hy + .025, z + height + .01], [x + hx - b, y - hy + .025, z + height + .01]], metal.light, .028);
}

/** The hull's model-to-world transform: pitch about the lateral axis through the hull's centre. @param {number} x @param {number} y @param {number} z @param {number} pitch @returns {Frame} */
function frame(x, y, z, pitch) {
  const cs = Math.cos(pitch), sn = Math.sin(pitch);
  return (u, v, w) => { const dw = w - PIVOT; return [x + u * cs - dw * sn, y + v, z + PIVOT + u * sn + dw * cs]; };
}
/** @param {Frame} at @param {P3[]} model @param {P3} inside model point inside the solid */
function facesCamera(at, model, inside) {
  const p = model.map(m => at(...m)), n = [0, 0, 0], o = at(...inside), mid = [0, 0, 0];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    for (let k = 0; k < 3; k++) mid[k] += a[k] / p.length;
  }
  // Orient outward, then test against the camera direction.
  const out = n[0] * (mid[0] - o[0]) + n[1] * (mid[1] - o[1]) + n[2] * (mid[2] - o[2]) < 0 ? -1 : 1;
  return out * (n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2]) / (Math.hypot(n[0], n[1], n[2]) || 1);
}
/** Draw a model polygon in the hull frame. @param {CanvasRenderingContext2D} c @param {Frame} at @param {P3[]} model @param {string | null} fill @param {string | null} [stroke] @param {number} [width] */
function part(c, at, model, fill, stroke, width) { poly3(c, model.map(m => at(...m)), fill, stroke, width); }
/** @param {CanvasRenderingContext2D} c @param {Frame} at @param {P3[]} model @param {string} color @param {number} [width] */
function stroke(c, at, model, color, width) { line3(c, model.map(m => at(...m)), color, width); }
/** A small box in the hull frame with back faces culled. @param {CanvasRenderingContext2D} c @param {Frame} at @param {number} u0 @param {number} u1 @param {number} v0 @param {number} v1 @param {number} w0 @param {number} w1 @param {string} top */
function hullBox(c, at, u0, u1, v0, v1, w0, w1, top) {
  /** @type {[P3[], string][]} */
  const faces = [
    [[[u0, v0, w0], [u1, v0, w0], [u1, v0, w1], [u0, v0, w1]], metal.dark],
    [[[u0, v1, w0], [u1, v1, w0], [u1, v1, w1], [u0, v1, w1]], metal.shade],
    [[[u0, v0, w0], [u0, v1, w0], [u0, v1, w1], [u0, v0, w1]], metal.side],
    [[[u1, v0, w0], [u1, v1, w0], [u1, v1, w1], [u1, v0, w1]], metal.dark],
    [[[u0, v0, w1], [u1, v0, w1], [u1, v1, w1], [u0, v1, w1]], top],
  ];
  const inside = /** @type {P3} */ ([(u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2]);
  for (const [model, fill] of faces) if (facesCamera(at, model, inside) > 0) part(c, at, model, fill, metal.ink, .016);
}
/** An octagonal raised panel on the south flank, in the hull frame. @param {CanvasRenderingContext2D} c @param {Frame} at @param {number} u @param {number} v @param {number} w @param {number} width @param {number} height @param {string} fill @param {number} cut */
function flankPanel(c, at, u, v, w, width, height, fill, cut) {
  const a = width / 2;
  part(c, at, [[u - a + cut, v, w], [u + a - cut, v, w], [u + a, v, w + cut], [u + a, v, w + height - cut], [u + a - cut, v, w + height], [u - a + cut, v, w + height], [u - a, v, w + height - cut], [u - a, v, w + cut]], fill, metal.ink, .018);
}

// ---- flames ----
/**
 * @typedef {object} Flame
 * @property {P2} root  screen root
 * @property {P2} tip   screen tip before flicker
 * @property {number} width  half width at the widest, tiles
 * @property {number} seed
 * @property {number} power 0..1
 */
/** @param {CanvasRenderingContext2D} c @param {Flame} f @param {number} time @param {number} scale @param {number} widthScale @param {string} fill */
function tongue(c, f, time, scale, widthScale, fill) {
  const [rx, ry] = f.root, dx = f.tip[0] - rx, dy = f.tip[1] - ry, raw = Math.hypot(dx, dy);
  if (raw < .002 || f.power <= 0) return;
  const ux = dx / raw, uy = dy / raw, nx = -uy, ny = ux;
  const flicker = .88 + .08 * Math.sin(time * 41 + f.seed) + .05 * Math.sin(time * 67 + f.seed * 2.3);
  const length = raw * scale * flicker, w = f.width * widthScale * (.94 + .06 * Math.sin(time * 53 + f.seed * 1.7));
  const sway = w * .35 * Math.sin(time * 29 + f.seed * 3.1);
  const tx = rx + ux * length + nx * sway, ty = ry + uy * length + ny * sway;
  c.beginPath();
  c.moveTo(rx + nx * w * .62, ry + ny * w * .62);
  c.bezierCurveTo(rx + ux * length * .28 + nx * w * 1.12, ry + uy * length * .28 + ny * w * 1.12,
    rx + ux * length * .72 + nx * w * .32 + nx * sway * .5, ry + uy * length * .72 + ny * w * .32 + ny * sway * .5, tx, ty);
  c.bezierCurveTo(rx + ux * length * .72 - nx * w * .32 + nx * sway * .5, ry + uy * length * .72 - ny * w * .32 + ny * sway * .5,
    rx + ux * length * .28 - nx * w * 1.12, ry + uy * length * .28 - ny * w * 1.12, rx - nx * w * .62, ry - ny * w * .62);
  c.quadraticCurveTo(rx - ux * w * .55, ry - uy * w * .55, rx + nx * w * .62, ry + ny * w * .62);
  c.fillStyle = fill; c.fill();
}
/** Warm red/orange tongues around a yellow body and a white core, flickering with the room clock. @param {CanvasRenderingContext2D} c @param {Flame[]} flames @param {number} time */
function drawFlames(c, flames, time) {
  for (const f of flames) {
    if (f.power <= 0) continue;
    const r = f.width * (2.3 + f.power * .9), glow = c.createRadialGradient(f.root[0], f.root[1], 0, f.root[0], f.root[1], r);
    glow.addColorStop(0, `rgba(255,214,150,${(.42 * f.power).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,170,96,0)');
    ellipse(c, f.root[0], f.root[1], r, r, glow);
  }
  /** @type {[number, number, string][]} */
  const layers = [[1, 1, 'rgba(214,92,54,.62)'], [.80, .74, 'rgba(240,150,60,.86)'], [.58, .50, 'rgba(255,212,118,.95)'], [.34, .26, 'rgba(255,251,234,.98)']];
  for (const [scale, width, fill] of layers) for (const f of flames) tongue(c, { ...f, width: f.width * Math.sqrt(f.power) }, time, scale * (.35 + .65 * f.power), width, fill);
}

/** Pad downwash: puffs swept outward in a ring, thinning as the shuttle climbs. @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} height @param {number} amount @param {number} time */
function drawDust(c, x, y, height, amount, time) {
  if (amount <= .01) return;
  const spread = 1 + height * .32, base = c.globalAlpha;
  for (let i = 0; i < 16; i++) {
    const phase = (time * .9 + i * .618 + (i % 3) * .21) % 1, a = i * TAU / 16 + Math.sin(i * 1.7) * .25 + time * .12;
    const r = (1.05 + phase * 2.1) * spread, rise = phase * .45;
    const fade = amount * (1 - phase) * Math.min(1, phase / .12) * .5;
    if (fade <= .01) continue;
    const [px, py] = pt(x + Math.cos(a) * r, y + .12 + Math.sin(a) * r * .8, rise);
    c.globalAlpha = base * fade; ellipse(c, px, py, .26 + phase * .36, (.15 + phase * .20) * COLONY_DEPTH, '#e9dcc1');
  }
  c.globalAlpha = base;
}

/** A contrail as collinear butt-capped segments that widen and fade with age. @param {CanvasRenderingContext2D} c @param {P3[]} points newest last @param {number[]} ages 0..1 per point @param {number} strength */
function drawTrail(c, points, ages, strength) {
  for (let i = 1; i < points.length; i++) {
    const age = (ages[i - 1] + ages[i]) / 2, a = strength * (1 - age) ** 1.6;
    if (a <= .01) continue;
    const segment = [pp(points[i - 1]), pp(points[i])];
    line(c, segment, `rgba(255,253,244,${(a * .26).toFixed(3)})`, .16 + age * .55, 'butt');
    line(c, segment, `rgba(255,255,250,${(a * .45).toFixed(3)})`, .05 + age * .18, 'butt');
  }
}

/** @param {CanvasRenderingContext2D} c @param {number} f @param {number} bx @param {number} by */
function drawContrails(c, f, bx, by) {
  const dir = /** @type {P3} */ ([Math.cos(CLIMB_PITCH), 0, Math.sin(CLIMB_PITCH)]), tail = 1.45;
  if (f > P.climb[0] && f < .70) {
    const start = 2.2, head = Math.min(climbDistance(f), CLIMB);
    if (head > start) {
      /** @type {P3[]} */ const points = []; /** @type {number[]} */ const ages = [];
      const c0 = span(climbFraction(start), P.climb), c1 = span(climbFraction(head), P.climb);
      for (let i = 0; i <= 18; i++) {
        const k = lerp(c0, c1, i / 18), s = CLIMB * k ** CLIMB_POWER - tail;
        points.push([bx + s * dir[0], by, REST_Z + LIFT + PIVOT + s * dir[2]]);
        ages.push(clamp01((f - lerp(P.climb[0], P.climb[1], k)) / .17));
      }
      drawTrail(c, points, ages, 1);
    }
  }
  if (f > P.approach[0] && f < .74) {
    /** @type {P3[]} */ const points = []; /** @type {number[]} */ const ages = [];
    for (let i = 0; i <= 10; i++) {
      const g = Math.max(P.approach[0], f - .07 * (1 - i / 10)), p = bezier(APPROACH, approachProgress(g));
      const on = .62 * (1 - smooth(span(g, [.655, .69]))) * smooth(span(g, [P.approach[0], P.approach[0] + .03]));
      points.push([bx + p[0] - tail, by + p[1], REST_Z + HOVER + PIVOT + p[2] + .15]);
      ages.push(clamp01(1 - on / .62 + (f - g) / .07));
    }
    drawTrail(c, points, ages, .55);
  }
}

/** Earned pennant beside the pad; it stays while the shuttle is away. @param {CanvasRenderingContext2D} c @param {number} x @param {number} y */
function drawPennant(c, x, y) {
  const [px, py] = pt(x + 1.60, y + .70, .83);
  line3(c, [[x + 1.60, y + .70, 0], [x + 1.60, y + .70, 1.25]], metal.dark, .035);
  polygon(c, [[px, py - .24], [px + .48, py - .12], [px, py + .04]], '#cfad6f', null);
}

/** Morrow's freight loader: extends, carries the sample crate up, retracts; mirrored on return. @param {CanvasRenderingContext2D} c @param {number} bx @param {number} by @param {number} f */
function drawLoader(c, bx, by, f) {
  const inbound = f > .5;
  const reach = inbound ? smooth(span(f, [.935, .95])) : smooth(span(f, [0, .02])) * (1 - smooth(span(f, [.085, .11])));
  if (reach <= 0) return;
  /** @type {P3} */
  const foot = [bx - 1.6, by + 1.1, .12];
  /** @type {P3} */
  const top = [bx - .48, by + .35, .74];
  line3(c, [foot, [lerp(foot[0], top[0], reach), lerp(foot[1], top[1], reach), lerp(foot[2], top[2], reach)]], metal.shade, .16);
  // The crate rides the belt, then drops through the cargo hatch (or rises out of it on return).
  const travel = inbound ? 1 - smooth(span(f, [.95, .995])) : smooth(span(f, [.02, .075]));
  const sink = inbound ? 1 - smooth(span(f, [.94, .952])) : smooth(span(f, [.075, .09]));
  if (sink >= 1) return;
  const scale = 1 - sink, cx = bx - 1.55 + travel * 1.05 + sink * .25, cy = by + 1.1 - travel * .75 - sink * .3, cz = .16 + travel * .60;
  machineBox(c, cx, cy, .22 * scale, .19 * scale, cz, .3 * scale, inbound ? '#d9c493' : '#b8bd8e', .025);
  line3(c, [[cx, cy - .18 * scale, cz + .31 * scale], [cx, cy + .18 * scale, cz + .31 * scale]], inbound ? metal.gold : metal.white, .045 * scale);
}

/** @param {CanvasRenderingContext2D} c @param {Frame} at @param {number} ports stern engine ports' opacity */
function drawHull(c, at, ports) {
  const inside = /** @type {P3} */ ([0, 0, ROOF / 2]);
  for (let i = 0; i < BELLY.length; i++) {
    const j = (i + 1) % BELLY.length;
    /** @type {P3[]} */
    const side = [[...BELLY[i], 0], [...BELLY[j], 0], [...DECK[j], ROOF], [...DECK[i], ROOF]];
    if (facesCamera(at, side, inside) > 0) part(c, at, side, SIDE_FILL[i], metal.ink, .026);
  }
  part(c, at, DECK.map(([u, v]) => /** @type {P3} */ ([u, v, ROOF])), '#f5f5e9', metal.ink, .024);
  // Windscreen band on the nose; it only shows once the nose lifts toward the camera.
  for (const i of [3, 4]) {
    const j = i + 1;
    /** @type {P3[]} */
    const face = [[...BELLY[i], 0], [...BELLY[j], 0], [...DECK[j], ROOF], [...DECK[i], ROOF]];
    if (facesCamera(at, face, inside) <= .12) continue;
    /** @param {number} a @param {number} h @returns {P3} */
    const on = (a, h) => [lerp(lerp(BELLY[i][0], BELLY[j][0], a), lerp(DECK[i][0], DECK[j][0], a), h), lerp(lerp(BELLY[i][1], BELLY[j][1], a), lerp(DECK[i][1], DECK[j][1], a), h), ROOF * h];
    part(c, at, [on(.1, .52), on(.9, .52), on(.9, .86), on(.1, .86)], '#648b8f', metal.ink, .016);
  }
  // Cockpit glass and its glint.
  part(c, at, [[.69, -.30, ROOF + .02], [.96, -.19, ROOF + .02], [1.07, .04, ROOF + .02], [.95, .18, ROOF + .02], [.69, .19, ROOF + .02]], '#648b8f', metal.ink, .018);
  stroke(c, at, [[.84, -.23, ROOF + .03], [.88, .17, ROOF + .03]], '#bfdad2', .018);
  // Cargo bay with the sample crates aboard.
  part(c, at, [[-.91, -.34, ROOF + .02], [.26, -.34, ROOF + .02], [.26, .31, ROOF + .02], [-.91, .31, ROOF + .02]], '#617b72', metal.ink, .020);
  for (const [du, dv, color] of /** @type {[number, number, string][]} */ ([[-.65, -.12, '#a7b488'], [-.24, -.12, '#b39b6a'], [-.65, .18, '#c5bb96'], [-.20, .18, '#8caa88']])) {
    part(c, at, [[du - .15, dv - .12, ROOF + .04], [du + .15, dv - .12, ROOF + .04], [du + .15, dv + .12, ROOF + .04], [du - .15, dv + .12, ROOF + .04]], color, metal.ink, .016);
    stroke(c, at, [[du, dv - .12, ROOF + .05], [du, dv + .12, ROOF + .05]], '#f3e7be', .020);
  }
  hullBox(c, at, -.97, .31, -.485, -.375, ROOF + .02, ROOF + .055, metal.white);
  stroke(c, at, [[-.97, .34, ROOF + .03], [.31, .34, ROOF + .03]], metal.light, .035);
  // South flank panels, hatch, keel line and gold trim.
  for (const du of [-.58, .20]) flankPanel(c, at, du, .565, .12, .65, .25, metal.white, .045);
  flankPanel(c, at, -.89, .575, .15, .16, .20, metal.violet, .025);
  stroke(c, at, [[-1.05, .575, .08], [.60, .575, .08]], metal.dark, .045);
  stroke(c, at, [[.57, .51, .18], [.86, .44, .18]], metal.gold, .035);
  // Stern engine ports, seen while the stern still faces the camera.
  if (ports > .01) for (const v of NOZZLES) {
    const [px, py] = pp(at(-1.20, v, .22));
    c.save(); c.globalAlpha *= ports;
    ellipse(c, px, py, .105, .11, metal.dark); ellipse(c, px - .012, py - .012, .077, .081, metal.shade);
    ellipse(c, px, py, .052, .063, metal.joint); ellipse(c, px, py, .026, .035, metal.violet);
    c.restore();
  }
}

/**
 * Draw the pad's pennant, the shuttle (parked or flying) and Morrow's loader.
 * Same contract as the original parked drawing: `pad` is the pad's tile origin.
 * @param {CanvasRenderingContext2D} c
 * @param {{x: number, y: number}} pad
 * @param {any} colony
 * @param {number} time room clock in seconds (the renderer's ambient time)
 * @param {boolean} reduced reduced motion: parked, no flight, no loader
 */
export function drawShuttle(c, pad, colony, time, reduced) {
  const bx = pad.x + .5, by = pad.y + .5;
  if (colony?.decorations?.pennant) drawPennant(c, bx, by);
  const trip = tripFraction(colony, time), f = reduced ? null : trip;
  // Reduced motion never flies: the parked shuttle fades out as it would lift off and back in to land.
  const away = reduced && trip !== null ? (trip < .5 ? 1 - smooth(span(trip, [.15, .33])) : smooth(span(trip, [.75, .93]))) : 1;
  const pose = f === null ? poseAt(0, time) : poseAt(f, time);
  const freight = colony?.template === 'morrow-v1';
  if (f !== null) drawContrails(c, f, bx, by);
  const x = bx + pose.x, y = by + pose.y, h = pose.z - REST_Z;
  // Ground effects belong to the pad, whatever the shuttle's alpha.
  if (f !== null) {
    const near = 1 - smooth(h / 3.4);
    if (pose.heat > 0 && near > 0) for (const [u, v] of THRUSTERS) {
      const a = (.30 * pose.heat * near).toFixed(3), b = (.22 * pose.heat * near).toFixed(3);
      groundEllipse(c, x + u * Math.cos(pose.pitch), y + v + .05, .75 + h * .2, .55 + h * .14, `rgba(255,196,120,${b})`);
      groundEllipse(c, x + u * Math.cos(pose.pitch), y + v + .05, .36 + h * .1, .26 + h * .07, `rgba(255,226,160,${a})`);
    }
    drawDust(c, bx, by, h, pose.dust, time);
    // Touchdown puff.
    const t = span(f, [P.touchdown[0], .985]);
    if (t > 0 && t < 1) {
      c.save(); c.globalAlpha *= (1 - t) * .55;
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + .2, r = 1.15 + smooth(t) * 1.6, [px, py] = pt(bx + Math.cos(a) * r, by + .12 + Math.sin(a) * r * .8, t * .3); ellipse(c, px, py, .28 + t * .3, (.16 + t * .16) * COLONY_DEPTH, '#e9dcc1'); }
      c.restore();
    }
  }
  if (pose.alpha * away > .001) {
    c.save(); c.globalAlpha *= pose.alpha * away;
    // The shadow slides south-east and thins as the shuttle climbs; the hull's projection never scales.
    const shrink = 1 / (1 + h * .07), fade = 1 - smooth(h / 9);
    if (fade > 0) {
      c.save(); c.globalAlpha *= fade;
      groundEllipse(c, x + .12 + h * .30, y + .16 + h * .20, 1.25 * (.38 + .62 * Math.cos(pose.pitch)) * shrink, .67 * shrink, '#4f66552b');
      c.restore();
    }
    const at = frame(x, y, pose.z, pose.pitch);
    const ports = smooth(facesCamera(at, [[...BELLY[8], 0], [...BELLY[0], 0], [...DECK[0], ROOF], [...DECK[8], ROOF]], [0, 0, ROOF / 2]) / .12);
    /** @type {Flame[]} */
    const flames = [];
    if (pose.main > 0) for (const v of NOZZLES) {
      const length = 2.7 * pose.main;
      flames.push({ root: pp(at(-1.33, v, .22)), tip: pp(at(-1.33 - length, v, .22)), width: .17, seed: v * 7 + 1, power: pose.main });
    }
    if (pose.lift > 0) {
      // Lift nozzles gimbal toward the ground, so they keep pushing down as the nose rises.
      const down = /** @type {P3} */ ([Math.sin(pose.pitch) * .3, 0, -.3 * Math.cos(pose.pitch) - .7]), norm = Math.hypot(down[0], down[2]);
      for (const [u, v] of THRUSTERS) {
        const root = at(u, v, .02), reach = 1.3 * pose.lift, drop = -down[2] / norm, clip = Math.min(1, Math.max(.04, (root[2] - GROUND) / (reach * drop)));
        const length = reach * clip, seed = u * 13 + 5;
        flames.push({ root: pp(root), tip: pp([root[0] + down[0] / norm * length, root[1], root[2] + down[2] / norm * length]), width: .12 + .03 * (1 - clip), seed, power: pose.lift });
        // Close to the pad the jet flattens into a low sheet spreading along the deck.
        const splash = (1 - clip) * pose.lift;
        if (splash > .02) {
          /** @type {P3} */
          const hit = [root[0] + down[0] / norm * length, root[1] + .04, GROUND];
          for (const [dx, dy, k] of /** @type {[number, number, number][]} */ ([[-1, .16, 1], [1, .16, 1], [0, 1, .45]])) {
            const reachOut = (.16 + .34 * splash) * k;
            flames.push({ root: pp(hit), tip: pp([hit[0] + dx * reachOut, hit[1] + dy * reachOut, GROUND]), width: .095 * (k < 1 ? .8 : 1), seed: seed + dx * 3 + dy * 7, power: splash * .8 });
          }
        }
      }
    }
    // Heat shimmer and the thruster glow lead the flames on ignition.
    if (pose.heat > 0) for (const [u, v] of THRUSTERS) {
      const [rx, ry] = pp(at(u, v, .02)), shimmer = pose.heat * (1 - pose.lift);
      const glow = c.createRadialGradient(rx, ry, 0, rx, ry, .22);
      glow.addColorStop(0, `rgba(255,190,120,${(.55 * pose.heat).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,160,90,0)');
      ellipse(c, rx, ry, .22, .14, glow);
      for (let k = 0; k < 3 && shimmer > .02; k++) {
        const wave = Math.sin(time * 9 + k * 2.1 + u * 3) * .035, rise = ((time * .9 + k / 3) % 1);
        c.save(); c.globalAlpha *= shimmer * .32 * (1 - rise);
        ellipse(c, rx + wave, ry + .10 + (1 - rise) * .20, .08 + rise * .06, .04, '#fff6e0');
        c.restore();
      }
    }
    // Ignition flash at the stern as the main engine lights.
    const flash = Math.sin(Math.PI * span(f ?? 0, [.31, .345]));
    if (flash > 0) for (const v of NOZZLES) {
      const [rx, ry] = pp(at(-1.30, v, .22)), r = .3 + flash * .35, glow = c.createRadialGradient(rx, ry, 0, rx, ry, r);
      glow.addColorStop(0, `rgba(255,248,226,${(.75 * flash).toFixed(3)})`); glow.addColorStop(1, 'rgba(255,190,120,0)');
      ellipse(c, rx, ry, r, r, glow);
    }
    drawFlames(c, flames, time);
    // Engine bells peek past the stern once it turns away from the camera.
    if (ports < .99) {
      c.save(); c.globalAlpha *= 1 - ports;
      for (const v of NOZZLES) { const [px, py] = pp(at(-1.29, v, .22)); ellipse(c, px, py, .08, .08, metal.dark); ellipse(c, px, py, .048, .048, pose.main > .05 ? '#ffe2a8' : metal.shade); }
      c.restore();
    }
    // Landing legs fold into the belly after lift-off and swing out for landing.
    if (pose.gear > .01) {
      const legLength = pose.gear * Math.min(.24, Math.max(0, pose.z - .12));
      for (const [u, v] of LEGS) {
        stroke(c, at, [[u, v, 0], [u + .06 * pose.gear, v, -legLength]], metal.dark, .055);
        stroke(c, at, [[u - .10 * pose.gear, v, -legLength], [u + .17 * pose.gear, v, -legLength]], '#687a77', .07);
      }
    }
    drawHull(c, at, ports);
    c.restore();
  }
  if (freight && f !== null) drawLoader(c, bx, by, f);
}
