import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint } from './colony-view.js';

// One construction rig for every colony object: a white-and-gold drop pod
// burns down onto the site, its walls sink into the foot ring while its four
// corner posts slide out to the footprint corners and rise into an open crate
// frame. A gantry beam steps back and forth across the frame while its print
// head sweeps left and right; the head's nozzle rides the reveal edge, so the
// renderer's bottom-up clip of the finished sprite reads as the print. The
// frame then lifts off the finished object, folds back into the pod above it
// and the pod burns away. Nothing here is saved or shared: the pose is a pure
// function of room time, and the drawing uses no textures or offscreen canvas.

const TAU = Math.PI * 2, D = COLONY_DEPTH, H = COLONY_HEIGHT;
const M = { ink: '#52616a', dark: '#44525a', shade: '#bdc8c6', side: '#d2dcd7', white: '#f0f2eb', light: '#fffef2', gold: '#bc9a5c', violet: '#aaa0bc', glass: '#9ec8c6', cyan: '#b6e4df' };

export const PRINT = Object.freeze({ seconds: 5, descentHeight: 16 });

/** @param {number} v */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
/** @param {number} v */
const ease = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
/** @param {number} v @param {number} a @param {number} b */
const span = (v, a, b) => clamp01((v - a) / (b - a));
/** @param {number} a @param {number} b @param {number} t */
const lerp = (a, b, t) => a + (b - a) * t;
/** @param {number} x @param {number} y @param {number} [z] @returns {[number, number]} */
const pt = (x, y, z = 0) => { const p = projectColonyPoint(x, y, z); return [p.x, p.y]; };

/** @typedef {CanvasRenderingContext2D} Ctx */
/** @param {Ctx} c @param {Array<[number, number]>} points @param {string} color @param {number} width */
function line(c, points, color, width) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
/** @param {Ctx} c @param {Array<[number, number]>} points @param {string | null} fill @param {string | null} [stroke] @param {number} [width] */
function poly(c, points, fill, stroke = M.ink, width = .02) {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
/** @param {Ctx} c @param {Array<[number, number, number]>} p @param {string} color @param {number} width */
const line3 = (c, p, color, width) => line(c, p.map(v => pt(v[0], v[1], v[2])), color, width);
/** @param {Ctx} c @param {Array<[number, number, number]>} p @param {string | null} fill @param {string | null} [stroke] @param {number} [width] */
const poly3 = (c, p, fill, stroke, width) => poly(c, p.map(v => pt(v[0], v[1], v[2])), fill, stroke, width);
/** @param {Ctx} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string} fill */
function ellipse(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU); c.fillStyle = fill; c.fill(); }
/** Ground-plane ellipse at world (x, y). @param {Ctx} c @param {number} x @param {number} y @param {number} rx @param {number} ry @param {string} fill */
const ground = (c, x, y, rx, ry, fill) => ellipse(c, x, y * D, rx, ry * D, fill);

// An octagonal frustum seen by the fixed camera: only the three faces turned
// toward the viewer and the lid can show, so the back faces are never drawn.
/** @param {Ctx} c @param {number} x @param {number} y @param {number} z @param {number} a bottom half-size @param {number} b top half-size @param {number} height @param {string} fill lid colour */
function frustum(c, x, y, z, a, b, height, fill) {
  const ring = (/** @type {number} */ s, /** @type {number} */ zz) => {
    const e = s * .32;
    return /** @type {Array<[number, number, number]>} */ ([[x - s + e, y - s, zz], [x + s - e, y - s, zz], [x + s, y - s + e, zz], [x + s, y + s - e, zz], [x + s - e, y + s, zz], [x - s + e, y + s, zz], [x - s, y + s - e, zz], [x - s, y - s + e, zz]]);
  };
  const lo = ring(a, z), hi = ring(b, z + height);
  for (const [i, color] of /** @type {Array<[number, string]>} */ ([[3, M.side], [5, M.side], [4, M.shade]])) {
    const j = (i + 1) % 8;
    poly3(c, [lo[i], lo[j], hi[j], hi[i]], color, M.ink, .018);
  }
  poly3(c, hi, fill, M.ink, .02);
}

/**
 * @typedef {'descend'|'unfold'|'print'|'fold'|'depart'} PrintStage
 * @typedef {{ stage: PrintStage, t: number, progress: number, podZ: number, open: number, armX: number, armY: number, reach: number, burn: number }} PrintPose
 * stage-local `t` 0..1; `progress` 0..1 object reveal; `podZ` flight height in
 * tiles above where the pod rests (the ground on arrival, just above the
 * finished object on departure); `open` 0..1 frame expansion; `armX`/`armY`
 * 0..1 head position over the footprint (left→right, back→front of the
 * reachable band); `reach` 0..1 how far the head has left its parked centre;
 * `burn` 0..1 thruster intensity.
 */

/** Seconds of each stage for one timeline. @param {number} duration @param {number} readyAt */
export function printTimeline(duration, readyAt) {
  const T = Number(duration) > 0 ? Number(duration) : PRINT.seconds;
  const R = Math.min(T, Math.max(T * .3, Number.isFinite(Number(readyAt)) ? Number(readyAt) : T));
  const fold = Math.min(R, T * .74);
  const descend = Math.min(1.1, fold * .24), unfold = descend + Math.min(.9, fold * .18);
  const depart = fold + Math.min(.8, (T - fold) * .42);
  return { duration: T, descend, unfold, fold, depart };
}

const PASS = .55, STEPS = [0, 1 / 3, 2 / 3, 1, 2 / 3, 1 / 3];
/** Raster head position `s` seconds into the print: fast sweeps, a step at each turn. @param {number} s */
function raster(s) {
  const k = Math.floor(Math.max(0, s) / PASS), u = Math.max(0, s) / PASS - k;
  const sweep = .5 - .5 * Math.cos(Math.PI * u);
  const from = STEPS[(k + STEPS.length - 1) % STEPS.length], to = STEPS[k % STEPS.length];
  return { armX: k % 2 ? 1 - sweep : sweep, armY: lerp(from, to, ease(u / .3)) };
}

/**
 * Pose of the rig `elapsed` seconds of room time after construction began.
 * The object is fully printed and the frame starts folding by `readyAt`.
 * @param {number} elapsed
 * @param {number} [duration]
 * @param {number} [readyAt]
 * @returns {PrintPose | null}
 */
export function printPose(elapsed, duration = PRINT.seconds, readyAt = duration) {
  const line = printTimeline(duration, readyAt), e = Number(elapsed);
  if (!(e >= 0 && e < line.duration)) return null;
  const rest = { progress: 0, podZ: 0, open: 0, armX: .5, armY: .5, reach: 0, burn: 0 };
  if (e < line.descend) {
    const t = e / line.descend, fall = 1 - span(t, 0, .86);
    const burn = t < .86 ? ease(span(t, .26, .44)) * (1 - .45 * span(t, .74, .86)) : .55 * (1 - span(t, .86, .94));
    return { ...rest, stage: 'descend', t, podZ: PRINT.descentHeight * fall * fall, burn };
  }
  if (e < line.unfold) return { ...rest, stage: 'unfold', t: (e - line.descend) / (line.unfold - line.descend), open: (e - line.descend) / (line.unfold - line.descend) };
  if (e < line.fold) {
    const t = (e - line.unfold) / (line.fold - line.unfold), p = span(t, .07, .96);
    return { ...rest, stage: 'print', t, open: 1, progress: lerp(p, ease(p), .35), reach: ease(t / .07), ...raster(e - line.unfold) };
  }
  const last = raster(line.fold - line.unfold);
  if (e < line.depart) {
    const t = (e - line.fold) / (line.depart - line.fold);
    return { ...rest, stage: 'fold', t, progress: 1, open: 1 - t, ...last, reach: 1 - ease(t / .3), burn: .35 * ease(span(t, .72, 1)) };
  }
  const t = (e - line.depart) / (line.duration - line.depart), rise = span(t, .14, 1);
  return { ...rest, stage: 'depart', t, progress: 1, ...last, podZ: .05 * ease(t / .14) + PRINT.descentHeight * rise * rise, burn: .35 + .65 * ease(t / .2) };
}

/** @typedef {{ x: number, y: number, w: number, h: number, z: number }} PrintFootprint */
/** @param {Partial<PrintFootprint>} fp */
function sized(fp) {
  const n = (/** @type {unknown} */ v, /** @type {number} */ d) => Number.isFinite(Number(v)) ? Number(v) : d;
  return { x: n(fp.x, 0), y: n(fp.y, 0), w: Math.max(1, n(fp.w, 1)), h: Math.max(1, n(fp.h, 1)), z: Math.max(.05, n(fp.z, 1)) };
}

/**
 * Screen-space reveal for the bottom-up clip, in the same tile units the
 * renderer has already scaled the canvas to. Show the finished sprite only
 * below `edge` (clip to the rectangle left/edge → right/bottom); at progress 1
 * the edge passes above the object's back-top corner, so drop the clip then.
 * @param {Partial<PrintFootprint>} footprint
 * @param {number} progress
 */
export function printReveal(footprint, progress) {
  const { x, y, w, h, z } = sized(footprint);
  const bottom = (y + h) * D + .08, top = y * D - z * H - .1;
  return { left: x - 1.5, right: x + w + 1.5, top, bottom: bottom + 1.5, edge: bottom - (bottom - top) * clamp01(progress) };
}

/** Everything the two layers need, derived once per call. @param {Partial<PrintFootprint>} footprint @param {PrintPose} pose @param {boolean} reduced */
function rig(footprint, pose, reduced) {
  const fp = sized(footprint), s = Math.min(fp.w, fp.h);
  const P = Math.min(.6, .34 + .08 * s), bodyH = P * 1.45, noseH = P * .62;
  const cx = fp.x + fp.w / 2, cy = fp.y + fp.h / 2, out = .07;
  const frameH = Math.max(.95, fp.z * 1.04 + .42, bodyH + .3);
  const openX = fp.w / 2 + out, openY = fp.h / 2 + out, shut = P * .86, hover = fp.z + .16;
  const stage = reduced ? (pose.stage === 'depart' ? 'gone' : 'still') : pose.stage;
  let zBot = 0, zTop = frameH, spread = 1, wall = 0, cap = 1, alpha = 1, reach = reduced ? 0 : pose.reach;
  if (stage === 'still') {
    // Reduced motion: the open frame simply appears and fades, its head parked.
    alpha = pose.stage === 'descend' ? ease(pose.t / .6) : pose.stage === 'fold' ? 1 - ease(pose.t) : 1;
  } else if (stage === 'descend' || stage === 'depart') {
    zBot = pose.podZ + (stage === 'depart' ? hover : 0); zTop = zBot + bodyH; spread = 0; wall = 1; cap = 0;
  } else if (stage === 'unfold') {
    const o = pose.open;
    wall = 1 - ease(o / .3); spread = ease(span(o, .15, .6)); cap = ease(span(o, .3, .9));
    zTop = lerp(bodyH, frameH, ease(span(o, .35, .85)));
  } else if (stage === 'fold') {
    const f = 1 - pose.open;
    zBot = lerp(0, hover, ease(span(f, .15, .5)));
    zTop = lerp(frameH, hover + bodyH, ease(span(f, .25, .75)));
    spread = 1 - ease(span(f, .45, .85)); cap = 1 - ease(span(f, .5, .9)); wall = ease(span(f, .7, 1));
  }
  const hx = lerp(shut, openX, spread), hy = lerp(shut, openY, spread);
  // The head works inside the band of beam positions from which its nozzle can
  // touch the reveal edge between the ground and the object's top.
  const edge = printReveal(fp, pose.progress).edge, inner = Math.min(.14, fp.h * .12);
  const y0 = fp.y + inner, y1 = fp.y + fp.h - inner;
  const lo = Math.min(y1, Math.max(y0, edge / D)), hi = Math.min(y1, Math.max(y0, (edge + fp.z * H) / D));
  const workY = lerp(lo, Math.max(lo, hi), pose.armY), workX = lerp(fp.x + .17, fp.x + fp.w - .17, pose.armX);
  const parkX = reduced ? fp.x + .2 : cx, parkY = reduced ? fp.y + .12 : cy;
  const headX = lerp(parkX, workX, reach), beamY = lerp(parkY, workY, reach);
  const scanZ = Math.min(zTop - .22, Math.max(0, (beamY * D - edge) / H));
  const tipZ = lerp(zTop - .2, scanZ, reach);
  return { fp, P, bodyH, noseH, cx, cy, hx, hy, zBot, zTop, wall, cap, alpha, reach, headX, beamY, tipZ, edge, stage, frameH, spread };
}

/** @typedef {ReturnType<typeof rig>} Rig */

/** A frame post: a white angle section with a graphite edge, foot pad and gold cap. @param {Ctx} c @param {number} x @param {number} y @param {number} z0 @param {number} z1 @param {number} width @param {boolean} [foot] */
function post(c, x, y, z0, z1, width, foot = true) {
  if (z1 - z0 < .04) return;
  const half = width / 2;
  poly3(c, [[x - half, y, z0], [x + half, y, z0], [x + half, y, z1], [x - half, y, z1]], M.white, M.ink, .016);
  line3(c, [[x + half * .38, y + .003, z0 + .04], [x + half * .38, y + .003, z1 - .05]], M.shade, width * .3);
  if (foot) { const [fx, fy] = pt(x, y, z0); ellipse(c, fx, fy + .006, width * .95, width * .42, M.dark); }
  poly3(c, [[x - half - .014, y, z1 - .075], [x + half + .014, y, z1 - .075], [x + half + .014, y, z1 + .014], [x - half - .014, y, z1 + .014]], M.gold, M.ink, .014);
}
/** A horizontal rail: graphite profile under a lit white top edge. @param {Ctx} c @param {[number, number, number]} a @param {[number, number, number]} b @param {number} width */
function rail(c, a, b, width) {
  line3(c, [a, b], M.ink, width * 1.25);
  line3(c, [a, b], M.white, width * .78);
  line3(c, [[a[0], a[1], a[2] + width * .2], [b[0], b[1], b[2] + width * .2]], M.light, width * .28);
}
/** The gantry beam: a white box section with a gold stripe, riding graphite end trucks. @param {Ctx} c @param {number} x0 @param {number} x1 @param {number} y @param {number} z @param {number} size */
function beam(c, x0, x1, y, z, size) {
  const d = size * .5, hgt = size * .8;
  poly3(c, [[x0, y + d, z], [x1, y + d, z], [x1, y + d, z + hgt], [x0, y + d, z + hgt]], M.shade, M.ink, .016);
  poly3(c, [[x0, y - d, z + hgt], [x1, y - d, z + hgt], [x1, y + d, z + hgt], [x0, y + d, z + hgt]], M.white, M.ink, .016);
  line3(c, [[x0 + .05, y + d + .004, z + hgt * .45], [x1 - .05, y + d + .004, z + hgt * .45]], M.gold, hgt * .32);
  for (const x of [x0, x1]) {
    poly3(c, [[x - .07, y + d + .02, z - .03], [x + .07, y + d + .02, z - .03], [x + .07, y + d + .02, z + hgt + .025], [x - .07, y + d + .02, z + hgt + .025]], M.dark, M.ink, .014);
    poly3(c, [[x - .07, y - d - .02, z + hgt + .025], [x + .07, y - d - .02, z + hgt + .025], [x + .07, y + d + .02, z + hgt + .025], [x - .07, y + d + .02, z + hgt + .025]], '#66757b', M.ink, .014);
  }
}

/** Thruster plume below the pod base. @param {Ctx} c @param {Rig} g @param {number} burn @param {number} time @param {number} floor height of the surface below */
function plume(c, g, burn, time, floor) {
  const flicker = .82 + .18 * Math.sin(time * 41) * Math.sin(time * 23 + 1.3);
  const len = burn * (.6 + g.P * .9) * flicker, a0 = c.globalAlpha, k = Math.min(1, burn * 1.6);
  // Two retro nozzles on the camera side of the hull; a flame that reaches the
  // surface below spreads into a warm splash there.
  for (const dx of [-.52, .52]) {
    const x = g.cx + dx * g.P, y = g.cy + g.P * .55, z = g.zBot - .02, l = Math.min(len, Math.max(0, z - floor));
    const [tx, ty] = pt(x, y, z), r = .075 + g.P * .1;
    if (len > z - floor) {
      const [sx, sy] = pt(x, y, floor), spread = Math.min(1, (len - (z - floor)) * 1.4);
      c.globalAlpha = a0 * .4 * k; ellipse(c, sx, sy, r * (2 + spread * 2), r * (.9 + spread * .8), '#ecc27a');
    }
    c.globalAlpha = a0 * .6 * k; ellipse(c, tx, ty + l * H * .5, r * 1.25, l * H * .5 + r * .55, '#e7b463');
    c.globalAlpha = a0 * .95 * k; ellipse(c, tx, ty + l * H * .36, r * .6, l * H * .36 + r * .32, '#fff4d6');
    ellipse(c, tx, ty + r * .1, r * .32, r * .38, '#c8f1f4');
  }
  c.globalAlpha = a0;
}

/** Landing / take-off dust: a ring of puffs, its far half behind the object. @param {Ctx} c @param {Rig} g @param {number} k 0..1 age @param {number} strength @param {'back'|'front'} layer */
function dust(c, g, k, strength, layer) {
  if (k <= 0 || k >= 1 || strength <= 0) return;
  const a0 = c.globalAlpha;
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9 + .35, sy = Math.sin(a);
    if ((sy < 0) !== (layer === 'back')) continue;
    const r = g.P + .18 + k * (.75 + g.P), wobble = .9 + .2 * Math.sin(i * 2.7);
    c.globalAlpha = a0 * strength * (1 - k) * .55;
    ground(c, g.cx + Math.cos(a) * r * 1.15, g.cy + .12 + sy * r * .8, (.16 + k * .22) * wobble, (.11 + k * .14) * wobble, '#e9dcc1');
  }
  c.globalAlpha = a0;
}

/** Sparks thrown from the nozzle: short streaks on fixed per-index arcs, phased by `time`. @param {Ctx} c @param {number} x @param {number} y @param {number} time @param {number} k */
function sparks(c, x, y, time, k) {
  const a0 = c.globalAlpha;
  for (let i = 0; i < 9; i++) {
    const age = (time * 2.7 + i * .618) % 1, dir = -Math.PI / 2 + ((i * 2.399) % 2.8 - 1.4), speed = .32 + (i % 3) * .11;
    const vx = Math.cos(dir) * speed, vy = Math.sin(dir) * speed * .75;
    const at = (/** @type {number} */ a) => /** @type {[number, number]} */ ([x + vx * a, y + vy * a + .85 * a * a]);
    c.globalAlpha = a0 * k * (1 - age);
    line(c, [at(Math.max(0, age - .07)), at(age)], i % 3 ? '#ffe7a8' : '#d8fbf6', .024);
  }
  c.globalAlpha = a0;
}

/**
 * Draw one layer of the rig. Call 'back' before the clipped object and
 * 'front' after it, in the object's depth slot. Coordinates are world tiles on
 * a canvas already scaled to tiles, like every other colony painter.
 * @param {Ctx} c
 * @param {Partial<PrintFootprint>} footprint
 * @param {PrintPose | null} pose
 * @param {number} time ambient seconds, for flicker and sparks only
 * @param {boolean} reduced
 * @param {'back'|'front'} layer
 */
export function drawPrintRig(c, footprint, pose, time, reduced, layer) {
  if (!pose) return;
  const g = rig(footprint, pose, !!reduced);
  if (g.stage === 'gone' || g.alpha <= 0) return;
  const a0 = c.globalAlpha; c.globalAlpha = a0 * g.alpha;
  const { cx, cy, hx, hy, zBot, zTop, fp } = g, x0 = cx - hx, x1 = cx + hx, yb = cy - hy, yf = cy + hy;
  const size = Math.min(fp.w, fp.h), pw = .075 + .01 * size, rw = .055 + .007 * size;
  const lowBack = zBot < fp.z - .02, flying = g.stage === 'descend' || g.stage === 'depart';
  // Inside the closed hull only the parts above the sinking walls show.
  const wallH = g.bodyH * g.wall, postFrom = g.wall > .02 ? zBot + wallH - .02 : zBot, feet = g.wall <= .02, ring = g.wall < .5;
  const t = Number(time) || 0;
  const rear = () => {
    if (ring) {
      rail(c, [x0, yb, zBot + .02], [x1, yb, zBot + .02], rw * .8);
      for (const x of [x0, x1]) rail(c, [x, yb, zBot + .02], [x, yf, zBot + .02], rw * .8);
    }
    for (const x of [x0, x1]) post(c, x, yb, postFrom, zTop, pw, feet);
  };
  if (layer === 'back') {
    // Ground shadow of the pod: it shrinks and fades with height.
    const lift = Math.max(0, zBot), shrink = 1 / (1 + lift * .11);
    c.globalAlpha = a0 * g.alpha * (.4 + .6 * shrink) * (1 - g.spread);
    ground(c, cx + .06 + lift * .015, cy + .1, (g.P + .14) * shrink, (g.P + .1) * shrink, '#4f665530');
    c.globalAlpha = a0 * g.alpha;
    if (g.stage === 'descend') dust(c, g, span(pose.t, .8, 1.2), 1, 'back');
    if (g.stage === 'unfold') dust(c, g, .4 / 1.4 + pose.t * .35, 1, 'back');
    if (g.stage === 'depart') dust(c, g, span(pose.t, 0, .6), clamp01(1.1 - fp.z / 2.5), 'back');
    const bed = flying || !lowBack ? 0 : g.spread * (1 - clamp01(zBot / fp.z));
    if (bed > .02) {
      // The print bed: a pale plate with a faint cyan grid the object rises from.
      c.globalAlpha = a0 * g.alpha * bed;
      poly3(c, [[fp.x, fp.y, .006], [fp.x + fp.w, fp.y, .006], [fp.x + fp.w, fp.y + fp.h, .006], [fp.x, fp.y + fp.h, .006]], '#e8f2ec55', null);
      for (let i = 1; i < fp.w * 3; i++) line3(c, [[fp.x + i / 3, fp.y + .03, .008], [fp.x + i / 3, fp.y + fp.h - .03, .008]], '#9fdcd655', .012);
      for (let i = 1; i < fp.h * 3; i++) line3(c, [[fp.x + .03, fp.y + i / 3, .008], [fp.x + fp.w - .03, fp.y + i / 3, .008]], '#9fdcd655', .012);
      // A tinted glass back wall gives the open frame its crate volume.
      poly3(c, [[x0, yb, zBot], [x1, yb, zBot], [x1, yb, zTop], [x0, yb, zTop]], '#d6ece833', null);
      for (const k of [.3, .62]) line3(c, [[x0 + pw, yb, lerp(zBot, zTop, k)], [x0 + pw + (x1 - x0) * .18, yb, lerp(zBot, zTop, k + .14)]], '#ffffff40', .02);
      c.globalAlpha = a0 * g.alpha;
    }
    if (lowBack) rear();
    c.globalAlpha = a0; return;
  }
  // Front layer, back to front: plume, rear posts when lifted, pod walls, top
  // rails, beam, nozzle and sparks, the head, then the front posts and rails.
  if (!reduced && pose.burn > .01 && g.wall > .3) plume(c, g, pose.burn, t, g.stage === 'depart' || g.stage === 'fold' ? fp.z : 0);
  if (g.stage === 'descend') {
    dust(c, g, span(pose.t, .8, 1.2), 1, 'front');
    // Speed lines while the pod is still falling fast.
    const fast = 1 - span(pose.t, .2, .6);
    if (fast > 0) { c.globalAlpha = a0 * fast * .6; for (const dx of [-.55, -.1, .4]) line3(c, [[cx + dx * g.P, cy, zTop + .25], [cx + dx * g.P, cy, zTop + .25 + fast * 2.6]], '#ffffff', .022); c.globalAlpha = a0; }
  }
  if (g.stage === 'unfold') dust(c, g, .4 / 1.4 + pose.t * .35, 1, 'front');
  if (g.stage === 'depart') dust(c, g, span(pose.t, 0, .6), clamp01(1.1 - fp.z / 2.5), 'front');
  if (!lowBack) rear();
  if (g.wall > .02) {
    // The pod: an octagonal white hull with a gold band, a violet port and
    // splayed landing legs; the walls sink into the foot ring as it opens.
    for (const sx of [-1, 1]) line3(c, [[cx + sx * g.P * .8, cy + g.P * .55, zBot + .24 * g.wall], [cx + sx * (g.P + .15 * g.wall), cy + g.P * .8, zBot]], M.dark, .055);
    frustum(c, cx, cy, zBot, g.P, g.P * .96, wallH, M.white);
    if (g.wall > .35) {
      const fy = cy + g.P + .006;
      line3(c, [[cx - g.P * .66, fy, zBot + wallH - .09], [cx + g.P * .66, fy, zBot + wallH - .09]], M.gold, .055);
      line3(c, [[cx - g.P * .66, fy, zBot + .07], [cx + g.P * .66, fy, zBot + .07]], M.dark, .05);
      poly3(c, [[cx - g.P * .36, fy, zBot + wallH * .3], [cx + g.P * .04, fy, zBot + wallH * .3], [cx + g.P * .04, fy, zBot + wallH * .64], [cx - g.P * .36, fy, zBot + wallH * .64]], M.violet, M.ink, .015);
      for (const k of [.2, .4]) line3(c, [[cx + g.P * k, fy, zBot + wallH * .27], [cx + g.P * k, fy, zBot + wallH * .67]], M.shade, .032);
    }
  }
  // Top frame: back and side rails (the closed pod's lid rim), then the beam.
  rail(c, [x0, yb, zTop], [x1, yb, zTop], rw);
  for (const x of [x0, x1]) rail(c, [x, yb, zTop], [x, yf, zTop], rw);
  const headX = lerp(cx, g.headX, g.cap), beamY = lerp(cy, g.beamY, g.cap), open = g.cap;
  if (open > .05) beam(c, x0, x1, beamY, zTop, .09 + .012 * size);
  // Nozzle: a telescoping graphite tube from the head down to the reveal edge.
  const tip = pt(headX, beamY, g.tipZ), printing = !reduced && pose.stage === 'print' && pose.progress > 0 && pose.progress < 1;
  if (open > .5 && g.tipZ < zTop - .05) {
    const sleeve = lerp(zTop, g.tipZ, .42);
    line3(c, [[headX, beamY, zTop], [headX, beamY, g.tipZ + .1]], M.ink, .085);
    line3(c, [[headX, beamY, zTop], [headX, beamY, sleeve]], M.white, .056);
    line3(c, [[headX, beamY, sleeve + .02], [headX, beamY, sleeve - .02]], M.gold, .09);
    poly(c, [[tip[0] - .05, tip[1] - .12 * H - .02], [tip[0] + .05, tip[1] - .12 * H - .02], [tip[0], tip[1]]], M.gold, M.ink, .014);
  }
  if (open > .5) {
    const glow = reduced ? 0 : printing ? .78 + .22 * Math.sin(t * 31) : .35 * g.reach;
    if (glow > .02) {
      c.globalAlpha = a0 * g.alpha * glow * .5; ellipse(c, tip[0], tip[1], .22, .085, '#ffeec0');
      c.globalAlpha = a0 * g.alpha * glow; ellipse(c, tip[0], tip[1], .06, .042, '#fffbe8');
      c.globalAlpha = a0 * g.alpha;
    }
    if (printing) sparks(c, tip[0], tip[1], t, g.reach);
  }
  // The head: the pod's nose cone shrinks into the gantry carriage.
  const capA = lerp(g.P * .82, .17, open), capB = lerp(g.P * .46, .15, open), capH = lerp(g.noseH, .16, open);
  frustum(c, headX, beamY, zTop, capA, capB, capH, open > .5 ? M.white : '#f4f3ea');
  line3(c, [[headX - capA * .7, beamY + capA + .004, zTop + .03], [headX + capA * .7, beamY + capA + .004, zTop + .03]], M.gold, .04);
  const [dx, dy] = pt(headX, beamY, zTop + capH + .004);
  c.beginPath(); c.ellipse(dx, dy, capB * .82, capB * .82 * D, 0, 0, TAU); c.strokeStyle = M.gold; c.lineWidth = .025; c.stroke();
  ellipse(c, dx, dy, capB * .6, capB * .6 * D, M.violet);
  ellipse(c, dx - capB * .2, dy - capB * .14, capB * .2, capB * .13, '#e6e0f2');
  // Front posts and the front rails close the crate over the object.
  for (const x of [x0, x1]) post(c, x, yf, postFrom, zTop, pw, feet);
  rail(c, [x0, yf, zTop], [x1, yf, zTop], rw);
  line3(c, [[x0 + pw, yf + .004, zTop - rw * .25], [x1 - pw, yf + .004, zTop - rw * .25]], M.gold, rw * .3);
  if (ring) rail(c, [x0, yf, zBot + .02], [x1, yf, zBot + .02], rw * .8);
  c.globalAlpha = a0;
}

/**
 * Optional scan line for the reveal edge, drawn after the clipped object and
 * before the front layer: a bright line across the open frame with a hot spot
 * under the nozzle. Matches the nozzle exactly because both use printReveal.
 * @param {Ctx} c
 * @param {Partial<PrintFootprint>} footprint
 * @param {PrintPose | null} pose
 * @param {number} time
 * @param {boolean} reduced
 */
export function drawPrintScan(c, footprint, pose, time, reduced) {
  if (!pose || pose.stage !== 'print' || pose.progress <= 0 || pose.progress >= 1) return;
  const g = rig(footprint, pose, !!reduced), y = g.edge, x0 = g.cx - g.hx + .05, x1 = g.cx + g.hx - .05;
  const a0 = c.globalAlpha, pulse = reduced ? 1 : .85 + .15 * Math.sin((Number(time) || 0) * 9);
  c.globalAlpha = a0 * .3 * pulse; line(c, [[x0, y], [x1, y]], '#c9f3ec', .07);
  c.globalAlpha = a0 * .9; line(c, [[x0, y], [x1, y]], '#f7fff8', .018);
  if (!reduced) { c.globalAlpha = a0 * .55; line(c, [[g.headX - .22, y], [g.headX + .22, y]], '#ffe8b0', .035); }
  c.globalAlpha = a0;
}
