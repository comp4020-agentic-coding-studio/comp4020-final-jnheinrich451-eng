// Enemy creature art: overhead, flat shapes, front toward -y, pixels at zoom 1
// (48 px a tile). Presentation only. Poses come from saved server state (attack
// windups, strikes, laser phases, armour hits) and from rendered travel; nothing
// here feeds back into simulation, collision or targeting. Collision stays the
// shared 0.38-tile circle (and the centipede's eight saved circles).
// Concepts and sketches: output/enemy-review/ (sketch v1, 9 November 2026).
import { MOBILE_LASERS } from './mobile-laser.js';

const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Art size per kind, relative to the drawings below. The heavy laser stays near
// its previous footprint: the requested 2.5x size needs a hit-circle decision.
export const ENEMY_ART_SCALE = Object.freeze({ hunter: .92, breaker: .9, bulwark: 1, 'twin-lens': 1, 'heavy-lens': .85 });

function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], clamp01(t))).toString(16).padStart(2, '0')).join('');
}
// Remains share the living palette, darkened toward dried tissue.
const deadOf = P => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, mix(v, '#33262c', .55)]));

function oval(c, x, y, rx, ry, fill, rot = 0) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); }
function line(c, pts, color, width) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
}
function poly(c, pts, fill, stroke, width = 1) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
// Clipping is a refinement: contexts without it (unit-test mocks) draw unclipped.
const clip = c => { if (typeof c.clip === 'function') c.clip(); };
function limb(c, root, knee, foot, P, width, upper, lower, tip, tipLength = 3.5) {
  line(c, [root, knee, foot], P.line, width + 2.2);
  line(c, [root, knee], upper, width);
  line(c, [knee, foot], lower, width * .85);
  if (tip) {
    const dx = foot[0] - knee[0], dy = foot[1] - knee[1], d = Math.hypot(dx, dy) || 1;
    line(c, [foot, [foot[0] + dx / d * tipLength, foot[1] + dy / d * tipLength]], tip, Math.max(1.4, width * .45));
  }
}
// Small triangular teeth along a segment, pointing toward (nx, ny).
function toothRow(c, a, b, count, size, nx, ny, color) {
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const dx = (b[0] - a[0]) / count * .45, dy = (b[1] - a[1]) / count * .45;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + nx * size, y + ny * size); c.lineTo(x + dx, y + dy); c.closePath(); c.fill();
  }
}
function toothRing(c, x, y, r, count, size, color) {
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = TAU * (i + .5) / count, ox = Math.cos(a), oy = Math.sin(a), px = -oy, py = ox;
    c.beginPath(); c.moveTo(x + ox * r + px * size * .55, y + oy * r + py * size * .55);
    c.lineTo(x + ox * (r - size), y + oy * (r - size)); c.lineTo(x + ox * r - px * size * .55, y + oy * r - py * size * .55); c.closePath(); c.fill();
  }
}
// A mouth-head from above: a lobe split by a forward-opening toothed jaw.
// `open` 0 shut .. 1 gaping.
function mouthHead(c, x, y, rx, ry, rot, open, lobe, gape, tooth, outline) {
  c.save(); c.translate(x, y); c.rotate(rot);
  oval(c, 0, 0, rx, ry, lobe); c.strokeStyle = outline; c.lineWidth = 1.1; c.stroke();
  const half = .18 + .8 * clamp01(open), a1 = -Math.PI / 2 - half, a2 = -Math.PI / 2 + half, base = ry * .3, reach = ry * 1.38;
  c.fillStyle = gape; c.beginPath(); c.moveTo(0, base); c.arc(0, base, reach, a1, a2); c.closePath(); c.fill();
  const tip = r => [Math.cos(r) * (reach - ry * .1), base + Math.sin(r) * (reach - ry * .1)], size = Math.max(1.6, rx * .34);
  toothRow(c, [0, base], tip(a1), 3, size, Math.cos(a1 + Math.PI / 2), Math.sin(a1 + Math.PI / 2), tooth);
  toothRow(c, [0, base], tip(a2), 3, size, Math.cos(a2 - Math.PI / 2), Math.sin(a2 - Math.PI / 2), tooth);
  c.restore();
}
function flash(c, trace, amount, color = '#ffe8cc') {
  if (!(amount > 0)) return;
  c.save(); c.globalAlpha = Math.min(.6, amount); trace(c); c.fillStyle = color; c.fill(); c.restore();
}
const sides = fn => { fn(-1); fn(1); };

/**
 * Animation inputs from saved state. `now` is combat time (ms), `stride` the
 * rendered distance travelled in tiles; legs step with travel and settle when it stops.
 */
export function enemyPose(e, now, stride = 0) {
  return {
    stride,
    windup: e.attack && Number.isFinite(e.attack.at) ? clamp01(1 - (e.attack.at - now) / (e.attack.windup || 1)) : 0,
    attacking: !!e.attack,
    strike: e.strike && Number.isFinite(e.strike.at) ? clamp01(1 - (now - e.strike.at) / 250) : 0,
    armor: Number.isFinite(e.armorHitAt) ? clamp01(1 - (now - e.armorHitAt) / 600) : 0,
  };
}
const NO_POSE = Object.freeze({ stride: 0, windup: 0, attacking: false, strike: 0, armor: 0 });

// ---------------------------------------------------------------- Pincers
// Geometry is in the wrist's frame for the right-hand claw; `s` mirrors it.
// Each finger is two cubic curves: [start, c1, c2, tip, c3, c4, end].
const HUNTER_PINCER = {
  outer: [[5, 2], [9, -8], [5, -19], [-4, -23], [0, -16], [1, -9], [-2, -2]], outerTeeth: [[-1.5, -18], [-.5, -5], 3, 2.6, -1, 0],
  thumb: [[-4, 1], [-8, -2], [-10, -7], [-10, -12], [-6, -9], [-4, -5], [-1, -2]], thumbTeeth: [[-8, -9], [-5, -3], 2, 2.2, .8, -.4], pivot: [-2, 0],
};
const BREAKER_PINCER = {
  outer: [[6, 3], [16, -7], [15, -26], [0, -35], [5, -25], [6, -12], [-1, -3]], outerTeeth: [[3.5, -28], [4, -8], 4, 3, -1, .1],
  thumb: [[-4, -1], [-9, -6], [-11, -14], [-10, -23], [-6, -16], [-3, -9], [1, -3]], thumbTeeth: [[-8.5, -18], [-5, -7], 2, 2.6, 1, -.2], pivot: [-1, -2],
  stripe: [[10, -4], [10, -20]],
};
function pincer(c, s, G, open, P, outerFill, thumbFill) {
  const X = ([x, y]) => [s * x, y];
  const finger = (pts, fill) => {
    const p = pts.map(X); c.beginPath(); c.moveTo(...p[0]); c.bezierCurveTo(...p[1], ...p[2], ...p[3]); c.bezierCurveTo(...p[4], ...p[5], ...p[6]); c.closePath();
    c.fillStyle = fill; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.2; c.stroke();
  };
  c.save(); c.rotate(s * (.25 * open - .1));
  finger(G.outer, outerFill);
  if (G.stripe) line(c, G.stripe.map(X), P.light, 2);
  { const [a, b, n, size, nx, ny] = G.outerTeeth; toothRow(c, X(a), X(b), n, size, s * nx, ny, P.bone); }
  c.restore();
  c.save(); c.translate(s * G.pivot[0], G.pivot[1]); c.rotate(s * (.35 - .6 * open)); c.translate(-s * G.pivot[0], -G.pivot[1]);
  finger(G.thumb, thumbFill);
  { const [a, b, n, size, nx, ny] = G.thumbTeeth; toothRow(c, X(a), X(b), n, size, s * nx, ny, P.bone); }
  c.restore();
}
// Walking leg points for one side; `step` is the leg's stride offset and dead
// remains curl their feet in toward the body.
function walkLeg(s, root, knee, foot, step, dead) {
  if (dead) return [[s * root[0], root[1]], [s * knee[0] * .86, knee[1] + 3], [s * (knee[0] * .7), knee[1] + 9]];
  return [[s * root[0], root[1]], [s * knee[0], knee[1] + step * .3], [s * foot[0], foot[1] + step]];
}

// ---------------------------------------------------------------- Hunter
const HUNTER = { shell: '#a9492f', light: '#c7643f', dark: '#7a3024', line: '#3a1814', muscle: '#86323a', bone: '#ecd6ad', gape: '#2b0f15', vent: '#4a1922', seam: '#5c2219', seamLight: '#de8a5d', ventRim: '#e09272' };
const HUNTER_DEAD = deadOf(HUNTER);
function hunterBody(c) {
  c.beginPath(); c.moveTo(0, -15); c.bezierCurveTo(4, -14, 10, -14, 14, -9); c.bezierCurveTo(18, -3, 16, 8, 10, 14); c.bezierCurveTo(6, 18, 2, 21, 0, 24);
  c.bezierCurveTo(-2, 21, -6, 18, -10, 14); c.bezierCurveTo(-16, 8, -18, -3, -14, -9); c.bezierCurveTo(-10, -14, -4, -14, 0, -15); c.closePath();
}
// Fast melee: quick scuttle; clamps rise and gape through the windup, then snap.
function drawHunter(c, e, o) {
  const P = o.dead ? HUNTER_DEAD : HUNTER, p = o.pose, id = e.id || 0;
  const g = o.dead ? 0 : Math.sin(p.stride * 5 + id) * 3.2, breathe = o.idle ? Math.sin(o.idle * 3 + id) : 0;
  const wind = p.attacking ? p.windup : 0, snap = p.strike;
  const open = o.dead ? .05 : snap > 0 ? .05 : clamp01(.45 + .1 * breathe + .55 * wind);
  const jaw = o.dead ? .1 : snap > 0 ? .15 : clamp01(.5 + .1 * breathe + .5 * wind);
  oval(c, 3, 6, 25, 29, '#1c231944');
  sides(s => {
    const a = walkLeg(s, [11, 0], [24, -3], [28, 11], s * g, o.dead), b = walkLeg(s, [9, 9], [20, 15], [21, 28], -s * g, o.dead);
    limb(c, ...a, P, 4, P.muscle, P.shell, P.line); limb(c, ...b, P, 4, P.muscle, P.shell, P.line);
    const elbow = [s * (21 + 2 * wind), -13 - wind], wrist = [s * (23 + 3 * wind - 4 * snap), -22 - 7 * wind - 6 * snap];
    if (o.dead) { elbow[1] += 5; wrist[0] -= s * 2; wrist[1] += 9; }
    line(c, [[s * 11, -8], elbow, wrist], P.line, 7.5); line(c, [[s * 11, -8], elbow, wrist], P.muscle, 5);
    oval(c, ...elbow, 3, 3, P.shell);
    c.save(); c.translate(...wrist); c.rotate(-s * (.15 * wind + .25 * snap)); pincer(c, s, HUNTER_PINCER, open, P, P.shell, P.light); c.restore();
    mouthHead(c, s * 8.5, -18, 7, 7.6, s * .12, jaw, P.dark, P.gape, P.bone, P.line);
  });
  poly(c, [[-2.5, -14], [0, -21], [2.5, -14]], P.shell, P.line, 1);
  hunterBody(c); c.fillStyle = P.shell; c.fill();
  c.save(); hunterBody(c); clip(c); c.fillStyle = P.dark + '55'; c.fillRect(0, -20, 20, 46); oval(c, -6, -3, 9, 17, P.light); c.restore();
  hunterBody(c); c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke();
  line(c, [[0, -15], [0, 23]], P.seam, 1.6); line(c, [[-1, -13], [-1, 20]], P.seamLight, .7);
  // Vents flare open with each breath, wider while winding up.
  const vent = 1 + .15 * breathe + .3 * wind;
  sides(s => [-3, 6].forEach((y, i) => {
    oval(c, s * 7.5, y, 4.6, 2.1 * vent, P.vent, s * (i ? .32 : .2));
    c.strokeStyle = P.ventRim; c.lineWidth = .8; c.beginPath(); c.ellipse(s * 7.5, y + .6, 4.4, 1.6, s * (i ? .32 : .2), Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }));
  flash(c, hunterBody, o.hit);
}

// ---------------------------------------------------------------- Breaker
const BREAKER = { plate: '#c8912d', light: '#e2b34d', dark: '#8c5d1d', edge: '#f2deaa', bone: '#f2deaa', line: '#3d2414', muscle: '#6e2a2e', muscleLight: '#984340', gape: '#2c1014', vent: '#4f1a22' };
const BREAKER_DEAD = deadOf(BREAKER);
function breakerBody(c) {
  c.beginPath(); c.moveTo(0, -28); c.lineTo(3.5, -21); c.bezierCurveTo(12, -20, 18, -10, 18, 3); c.bezierCurveTo(18, 17, 10, 29, 0, 38);
  c.bezierCurveTo(-10, 29, -18, 17, -18, 3); c.bezierCurveTo(-18, -10, -12, -20, -3.5, -21); c.closePath();
}
const BREAKER_ROWS = [[-12, 16], [-1, 18], [10, 17], [21, 13], [30, 7]];
// Heavy melee: slow sway; clamps pull back and gape, then slam inward.
function drawBreaker(c, e, o) {
  const P = o.dead ? BREAKER_DEAD : BREAKER, p = o.pose, id = e.id || 0;
  const phase = p.stride * 7.4 + id, g = o.dead ? 0 : Math.sin(phase) * 2.4, breathe = o.idle ? Math.sin(o.idle * 2 + id) : 0;
  const wind = p.attacking ? p.windup : 0, snap = p.strike;
  const open = o.dead ? .05 : snap > 0 ? 0 : clamp01(.4 + .08 * breathe + .65 * wind);
  const jaw = o.dead ? .1 : clamp01(.45 + .12 * breathe + .4 * wind - .4 * snap);
  c.save(); if (!o.dead && p.stride) c.rotate(Math.sin(phase / 2) * .03);
  oval(c, 3, 8, 28, 36, '#1c231944');
  sides(s => {
    const a = walkLeg(s, [15, 4], [29, -2], [35, 14], s * g, o.dead), b = walkLeg(s, [13, 19], [27, 25], [30, 41], -s * g, o.dead);
    limb(c, ...a, P, 3.6, P.muscle, P.muscleLight, P.edge, 4); limb(c, ...b, P, 3.6, P.muscle, P.muscleLight, P.edge, 4);
    oval(c, ...a[1], 2.2, 2.2, P.edge); oval(c, ...b[1], 2.2, 2.2, P.edge);
    const elbow = [s * (27 + 2 * wind), -15 + 3 * wind], wrist = [s * (32 + 2 * wind - 7 * snap), -24 - 2 * wind - 7 * snap];
    if (o.dead) { elbow[1] += 6; wrist[0] -= s * 3; wrist[1] += 12; }
    line(c, [[s * 12, -11], elbow, wrist], P.line, 9); line(c, [[s * 12, -11], elbow, wrist], P.muscle, 6.5);
    oval(c, ...elbow, 3, 3, P.edge);
    c.save(); c.translate(...wrist); c.rotate(s * (.12 * wind - .4 * snap)); pincer(c, s, BREAKER_PINCER, open, P, P.plate, P.light); c.restore();
    // Necks sway out of step with the legs; heads lunge forward on the strike.
    const sway = o.dead ? 0 : Math.sin(phase / 2 + s) * 1.3 + (o.idle ? Math.sin(o.idle * 1.6 + s * 1.7) * .8 : 0);
    const head = [s * 9.5 + sway, -32 - 3 * snap + (o.dead ? 5 : 0)];
    line(c, [[s * 4, -18], head], P.line, 6.5); line(c, [[s * 4, -18], head], P.muscle, 4.5);
    mouthHead(c, ...head, 5.8, 6.8, s * .22, jaw, P.dark, P.gape, P.edge, P.line);
  });
  sides(s => BREAKER_ROWS.forEach(([y, w]) => poly(c, [[s * (w - 3), y + 3], [s * (w + 3.5), y + 9], [s * (w - 2), y + 8]], P.plate, P.line, 1)));
  breakerBody(c); c.fillStyle = P.plate; c.fill();
  c.save(); breakerBody(c); clip(c);
  oval(c, -7, 0, 9, 27, P.light + 'bb');
  BREAKER_ROWS.forEach(([y, w]) => {
    poly(c, [[-w - 2, y + 6], [0, y - 3], [w + 2, y + 6], [w + 2, y + 9.5], [0, y + .5], [-w - 2, y + 9.5]], P.dark);
    line(c, [[-w - 2, y + 6], [0, y - 3], [w + 2, y + 6]], P.edge, 1.6);
  });
  const vent = 1 + .2 * breathe + .3 * wind;
  sides(s => BREAKER_ROWS.slice(0, 4).forEach(([y]) => oval(c, s * 8.5, y + 4.8, 3.6, 1.25 * vent, P.vent, s * -.42)));
  c.restore();
  breakerBody(c); c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke();
  line(c, [[0, -26], [0, 37]], P.edge, 2); line(c, [[1.2, -20], [1.2, 36]], P.dark, .8);
  BREAKER_ROWS.forEach(([y]) => poly(c, [[-2, y + 1], [0, y + 6], [2, y + 1]], P.edge));
  flash(c, breakerBody, o.hit);
  c.restore();
}

// ---------------------------------------------------------------- Berserker (bulwark role)
const BERSERKER = { armor: '#4b5d6d', light: '#5f7588', dark: '#2c3843', edge: '#a9b7bc', line: '#141b21', seam: '#4b2a40', vent: '#2c1424', claw: '#d9d6c8' };
const BERSERKER_DEAD = deadOf(BERSERKER);
function berserkerBody(c) {
  c.beginPath(); c.moveTo(-21, -14); c.lineTo(21, -14); c.bezierCurveTo(28, -10, 32, -1, 32, 10); c.bezierCurveTo(32, 24, 21, 36, 0, 43);
  c.bezierCurveTo(-21, 36, -32, 24, -32, 10); c.bezierCurveTo(-32, -1, -28, -10, -21, -14); c.closePath();
}
const BERSERKER_ROWS = [[-8, 27], [.5, 31], [9, 32], [17.5, 31], [26, 26], [34.5, 16]];
const PROW = [[-21, -12], [-9, -32], [0, -59], [9, -32], [21, -12]];
// Armored siege melee: a slow tread under the skirt; it rears back through the
// windup with pikes closing on the target, then lunges. Blocked hits light the plates.
function drawBerserker(c, e, o) {
  const P = o.dead ? BERSERKER_DEAD : BERSERKER, p = o.pose, id = e.id || 0;
  const g = o.dead ? 0 : Math.sin(p.stride * 9 + id) * 1.8, breathe = o.idle ? Math.sin(o.idle * 1.4 + id) : 0;
  const wind = p.attacking ? p.windup : 0, snap = p.strike, armor = o.dead ? 0 : p.armor;
  const edge = armor ? mix(P.edge, '#fff6dc', armor) : P.edge;
  c.save(); c.translate(0, 4 * wind - 8 * snap);
  oval(c, 4, 9, 36, 42, '#1c231955');
  sides(s => [[29, 14, .25, 1], [21, 37, 1, -1]].forEach(([x, y, a, k]) => {
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, L = o.dead ? 4 : 8, ty = y + s * k * g;
    oval(c, s * x, ty, 3.2, 3.2, P.seam);
    poly(c, [[s * (x + px * 2.2), ty + py * 2.2], [s * (x + dx * L + px * 1.5), ty + dy * L + py * 1.5 + 1.5], [s * (x - px * 2.2), ty - py * 2.2]], P.claw, P.line, .9);
  }));
  sides(s => {
    c.save(); c.translate(s * 15, -8); c.rotate(-s * (.14 * wind + .2 * snap) + (o.dead ? s * .25 : 0)); c.translate(-s * 15, 8);
    poly(c, [[s * 15, -6], [s * 29, -12], [s * 31, -24], [s * 18, -57], [s * 21, -30], [s * 20, -17], [s * 12, -11]], P.armor, P.line, 1.3);
    poly(c, [[s * 29, -12], [s * 31, -24], [s * 18, -57], [s * 23, -28]], s < 0 ? P.light : P.dark);
    line(c, [[s * 30.5, -23], [s * 18, -56]], edge, 1.1);
    line(c, [[s * 19, -13], [s * 30, -18]], P.line, 1.2); line(c, [[s * 20, -24], [s * 28, -31]], P.line, 1.1);
    line(c, [[s * 13, -10], [s * 19, -6]], P.seam, 2.4);
    c.restore();
  });
  sides(s => BERSERKER_ROWS.forEach(([y, w]) => poly(c, [[s * (w - 4), y + 1], [s * (w + 6), y + 10], [s * (w - 3), y + 8]], P.armor, P.line, 1)));
  berserkerBody(c); c.fillStyle = P.armor; c.fill();
  c.save(); berserkerBody(c); clip(c);
  c.fillStyle = P.light; c.fillRect(-40, -20, 40, 70);
  BERSERKER_ROWS.forEach(([y, w]) => {
    poly(c, [[-w - 4, y + 7], [0, y - 2], [w + 4, y + 7], [w + 4, y + 10], [0, y + 1], [-w - 4, y + 10]], P.dark);
    line(c, [[-w - 4, y + 7], [0, y - 2], [w + 4, y + 7]], edge, 1 + armor);
  });
  const vent = 1 + .2 * breathe + .4 * wind;
  sides(s => BERSERKER_ROWS.slice(1, 5).forEach(([y]) => oval(c, s * 12, y + 4, 4, 1.15 * vent, P.vent, s * -.4)));
  c.restore();
  berserkerBody(c); c.strokeStyle = P.line; c.lineWidth = 1.6; c.stroke();
  poly(c, PROW, P.armor);
  poly(c, [[-21, -12], [-9, -32], [0, -59], [0, -12]], P.light);
  [[-12, 14], [-24, 10], [-36, 6]].forEach(([y, w]) => {
    poly(c, [[-w, y + 3], [0, y - 6], [w, y + 3], [w, y + 5.5], [0, y - 3.5], [-w, y + 5.5]], P.dark);
    line(c, [[-w, y + 3], [0, y - 6], [w, y + 3]], edge, 1 + armor);
  });
  line(c, [[0, -58], [0, 42]], edge, 1.3); line(c, [[1, -52], [1, 41]], P.dark, .8);
  c.beginPath(); PROW.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = P.line; c.lineWidth = 1.4; c.stroke();
  if (armor) { c.save(); c.globalAlpha = armor * .8; berserkerBody(c); c.strokeStyle = '#ffe9b0'; c.lineWidth = 3; c.stroke(); c.restore(); }
  flash(c, berserkerBody, o.hit, '#d9e2e6');
  c.restore();
}

// ---------------------------------------------------------------- Lasers
const LENS = { chitin: '#7b3d64', light: '#9d5d85', dark: '#4e2343', ridge: '#c9a3b4', line: '#2c1428', muscle: '#7e2a44', membrane: '#c24e55', gill: '#8d2b39', bone: '#e2c2b4', lensDark: '#10262a', lens: '#2c6b6a', lensLight: '#7cc0b2' };
const HEAVY = { ...LENS, chitin: '#74395e', light: '#965a7f', dark: '#46203d', ridge: '#cba6b7', line: '#26101f', muscle: '#6e2a40', membrane: '#c8514f', lensDark: '#0e2427' };
const LENS_DEAD = deadOf(LENS), HEAVY_DEAD = deadOf(HEAVY);
const HOT = '#ff9a52', HOT_FIN = '#ffd9a8';
// Barrel geometry: neck pivot ahead of the body centre, then the aperture.
export const LENS_BARRELS = Object.freeze({
  'twin-lens': Object.freeze({ pivot: 11, reach: 21, lateral: 8.6 }),
  'heavy-lens': Object.freeze({ pivot: 8, reach: 43, lateral: 0 }),
});
// Rendered barrel aim per enemy, eased toward the saved bearing.
const lensAims = new Map();
const ACTIVE = ['bracing', 'charging', 'firing'];
function lensAim(e, time, reduced) {
  const m = e.airLaser, active = ACTIVE.includes(m?.phase) || m?.phase === 'cooling';
  const target = active && Number.isFinite(m?.angle) ? m.angle - (e.angle || 0) : 0;
  if (e.id === undefined || !Number.isFinite(time)) return target;
  let memo = lensAims.get(e.id);
  if (lensAims.size > 256) lensAims.clear();
  if (!memo || reduced || m?.phase === 'firing') { memo = { aim: target, time }; lensAims.set(e.id, memo); return target; }
  const dt = Math.max(0, Math.min(.1, time - memo.time)), delta = Math.atan2(Math.sin(target - memo.aim), Math.cos(target - memo.aim));
  memo.aim += Math.sign(delta) * Math.min(Math.abs(delta), 12 * dt); memo.time = time;
  return memo.aim;
}
/** Aperture position in world pixels for the beam's visible origin (presentation only). */
export function lensMuzzle(e, tile, lens = null) {
  const b = LENS_BARRELS[e.kind]; if (!b) return { x: e.x * tile, y: e.y * tile };
  const k = ENEMY_ART_SCALE[e.kind] || 1, body = e.angle || 0, memo = lensAims.get(e.id);
  const aim = body + (memo ? memo.aim : (e.airLaser?.angle ?? body) - body);
  const lateral = lens === null ? 0 : (lens ? b.lateral : -b.lateral);
  const px = Math.sin(body) * b.pivot, py = -Math.cos(body) * b.pivot;
  const ax = lateral * Math.cos(aim) + b.reach * Math.sin(aim), ay = lateral * Math.sin(aim) - b.reach * Math.cos(aim);
  return { x: e.x * tile + (px + ax) * k, y: e.y * tile + (py + ay) * k };
}
// Heat 0..1: radiators warm through the charge, run hot while firing and cool
// over the saved cooldown. Charge 0..1 focuses the aperture ring.
function lensState(e) {
  const m = e.airLaser, p = MOBILE_LASERS[e.kind], phase = m?.phase || 'watching', left = Number(m?.remaining) || 0;
  const charge = phase === 'charging' ? clamp01(1 - left / p.charge) : 0;
  const heat = phase === 'firing' ? 1 : phase === 'charging' ? .6 * charge : phase === 'cooling' ? clamp01(left / p.cooldown) : phase === 'bracing' ? .05 : 0;
  return { phase, charge, heat, braced: ACTIVE.includes(phase), firing: phase === 'firing', charging: phase === 'charging', lens: m?.lens };
}
function aperture(c, x, y, r, P, lit, charging, charge, heavy) {
  oval(c, x, y, r * 1.3, r * 1.3, P.ridge); c.strokeStyle = P.line; c.lineWidth = heavy ? 1.3 : 1.1; c.stroke();
  oval(c, x, y, r, r, P.lensDark);
  const glow = lit ? '#fff3ce' : charging ? mix('#a8584e', '#ffd2a8', charge) : P.lens;
  oval(c, x, y, r * .7, r * .7, glow);
  if (heavy) {
    c.strokeStyle = lit || charging ? '#fff6e0aa' : P.lensDark; c.lineWidth = .9;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(x + Math.cos(a) * r * .22, y + Math.sin(a) * r * .22); c.lineTo(x + Math.cos(a + .9) * r * .66, y + Math.sin(a + .9) * r * .66); c.stroke(); }
  }
  oval(c, x - r * .26, y - r * .3, r * .22, r * .22, lit ? '#ffffff' : P.lensLight);
  if (charging) { c.strokeStyle = '#ffb9a0'; c.lineWidth = heavy ? 2 : 1.5; c.beginPath(); c.arc(x, y, r * (2.6 - 1.2 * charge), 0, TAU); c.stroke(); }
}
function twinBody(c) { c.beginPath(); c.moveTo(0, -13); c.bezierCurveTo(10, -14, 18, -7, 18, 4); c.bezierCurveTo(18, 14, 9, 22, 0, 29); c.bezierCurveTo(-9, 22, -18, 14, -18, 4); c.bezierCurveTo(-18, -7, -10, -14, 0, -13); c.closePath(); }
function heavyBody(c) { c.beginPath(); c.moveTo(-24, -12); c.lineTo(24, -12); c.bezierCurveTo(33, -6, 35, 12, 30, 26); c.bezierCurveTo(26, 38, 14, 45, 0, 48); c.bezierCurveTo(-14, 45, -26, 38, -30, 26); c.bezierCurveTo(-35, 12, -33, -6, -24, -12); c.closePath(); }

function drawTwin(c, e, o) {
  const P = o.dead ? LENS_DEAD : LENS, p = o.pose, s0 = lensState(e), id = e.id || 0;
  const g = o.dead || s0.braced ? 0 : Math.sin(p.stride * 5.7 + id) * 3, spread = s0.braced ? 4 : 0;
  const membrane = mix(P.membrane, HOT, s0.heat), fin = mix(P.bone, HOT_FIN, s0.heat);
  oval(c, 3, 7, 23 + spread * .5, 27, '#17212655');
  sides(s => [[[13, -5], [25, -11], [30, -1]], [[15, 5], [28, 4], [31, 15]], [[12, 15], [23, 21], [24, 32]]].forEach(([r, k, f], i) => {
    const step = g * (i % 2 ? 1 : -1) * s, leg = walkLeg(s, r, [k[0] + spread, k[1]], [f[0] + spread, f[1]], step, o.dead);
    limb(c, ...leg, P, 2.8, P.muscle, P.chitin, P.bone, 3); oval(c, ...leg[1], 1.7, 1.7, P.ridge);
  }));
  twinBody(c); c.fillStyle = P.chitin; c.fill();
  c.save(); twinBody(c); clip(c);
  oval(c, -7, 0, 8, 17, P.light + '99');
  sides(s => {
    c.fillStyle = membrane; c.beginPath(); c.moveTo(s * 3.5, -7); c.quadraticCurveTo(s * 15, -6, s * 15, 3); c.quadraticCurveTo(s * 14, 15, s * 3.5, 20); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++) {
      const y = -5.5 + k * 6.4, pts = [[s * 3.5, y], [s * (11.5 - k * .6), y - 1], [s * (15 - k * 1.3), y + 4]];
      line(c, pts, P.dark, 3.2); line(c, pts, fin, 1.5);
    }
  });
  line(c, [[0, -10], [0, 26]], '#a03a55', .9);
  c.restore();
  twinBody(c); c.strokeStyle = P.line; c.lineWidth = 1.4; c.stroke();
  heatShimmer(c, s0.heat, o.idle, [[-9, 6], [9, 6]], 7);
  c.save(); c.translate(0, -LENS_BARRELS['twin-lens'].pivot); c.rotate(o.dead ? .35 : lensAim(e, o.time, o.reduced));
  oval(c, 0, -1, 8, 4, P.muscle);
  sides(s => {
    const x = s * 8.6, lit = s0.firing && (s0.lens === undefined || s0.lens === (s < 0 ? 0 : 1));
    c.fillStyle = P.chitin; c.fillRect(x - 6, -21, 12, 21); c.strokeStyle = P.line; c.lineWidth = 1.2; c.strokeRect(x - 6, -21, 12, 21);
    c.fillStyle = P.dark + 'aa'; c.fillRect(x + 1.5, -20, 4, 19);
    [-6, -13].forEach(y => { c.fillStyle = P.ridge; c.fillRect(x - 6.3, y - 1.4, 12.6, 2.8); line(c, [[x - 6, y + 1.6], [x + 6, y + 1.6]], P.line, .8); });
    aperture(c, x, -21, 5, P, lit, s0.charging, s0.charge, false);
  });
  c.restore();
  flash(c, twinBody, o.hit);
}
function drawHeavy(c, e, o) {
  const P = o.dead ? HEAVY_DEAD : HEAVY, p = o.pose, s0 = lensState(e), id = e.id || 0;
  const g = o.dead || s0.braced ? 0 : Math.sin(p.stride * 9 + id) * 2.5, spread = s0.braced ? 5 : 0;
  const membrane = mix(P.membrane, HOT, s0.heat), rib = mix(P.ridge, HOT_FIN, s0.heat);
  oval(c, 4, 10, 42 + spread * .5, 44, '#17212655');
  sides(s => [[[22, -8], [38, -14], [44, -2]], [[26, 6], [42, 6], [46, 20]], [[22, 20], [36, 28], [38, 42]]].forEach(([r, k, f], i) => {
    const step = g * (i % 2 ? 1 : -1) * s, [root, knee, foot] = walkLeg(s, r, [k[0] + spread, k[1]], [f[0] + spread, f[1]], step, o.dead);
    line(c, [root, knee, foot], P.line, 11); line(c, [root, knee], P.muscle, 8.5); line(c, [knee, foot], P.chitin, 7.5);
    poly(c, [[knee[0], knee[1] - 5], [knee[0] + s * 4.5, knee[1]], [knee[0], knee[1] + 5], [knee[0] - s * 4.5, knee[1]]], P.ridge, P.line, 1);
    oval(c, foot[0], foot[1] + 1, 4.6, 3.6, P.dark); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke();
  }));
  heavyBody(c); c.fillStyle = P.chitin; c.fill();
  c.save(); heavyBody(c); clip(c);
  oval(c, -10, 10, 14, 30, P.light + '88');
  oval(c, 0, 21, 24, 21, membrane);
  c.strokeStyle = mix(P.gill, '#d8613c', s0.heat); c.lineWidth = .9;
  for (let x = -22; x <= 22; x += 3.4) { c.beginPath(); c.moveTo(x, 2); c.lineTo(x * 1.05, 42); c.stroke(); }
  [[3, 30], [13, 30], [23, 27], [33, 19]].forEach(([y, w], k) => {
    c.lineCap = 'round';
    for (const [color, width] of [[P.dark, 6.5], [rib, 3.6]]) {
      c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(-w, y + 7);
      if (k === 3) { c.lineTo(0, y - 4); c.lineTo(w, y + 7); } else c.quadraticCurveTo(0, y - 9, w, y + 7);
      c.stroke();
    }
  });
  c.restore();
  heavyBody(c); c.strokeStyle = P.line; c.lineWidth = 1.6; c.stroke();
  heatShimmer(c, s0.heat, o.idle, [[0, 20]], 18);
  c.save(); c.translate(0, -LENS_BARRELS['heavy-lens'].pivot); c.rotate(o.dead ? .25 : lensAim(e, o.time, o.reduced));
  [[0, -10, 25, 23], [-10, -21, 21, 19], [-21, -32, 17.5, 16], [-32, -42, 14.5, 13.5]].forEach(([y0, y1, w0, w1]) => {
    poly(c, [[-w0, y0], [-w1, y1], [w1, y1], [w0, y0]], P.chitin, P.line, 1.2);
    poly(c, [[-w0 + 1, y0], [-w1 + 1, y1], [-w1 * .35, y1], [-w0 * .35, y0]], P.light + 'aa');
    poly(c, [[w0 * .55, y0], [w1 * .55, y1], [w1 - 1, y1], [w0 - 1, y0]], P.dark + 'aa');
    c.fillStyle = P.ridge; c.fillRect(-w1 - .8, y1 - 1.2, w1 * 2 + 1.6, 3); line(c, [[-w1, y1 + 2], [w1, y1 + 2]], P.line, .8);
  });
  aperture(c, 0, -43, 10, P, s0.firing, s0.charging, s0.charge, true);
  c.restore();
  flash(c, heavyBody, o.hit);
}
// Rising heat over hot radiators: faint arcs that drift outward, gone when cool
// or under reduced motion.
function heatShimmer(c, heat, time, points, size) {
  if (!(heat > .08) || !time) return;
  c.save(); c.strokeStyle = '#ffd6a8'; c.lineWidth = 1;
  for (const [x, y] of points) for (let i = 0; i < 2; i++) {
    const t = (time * .9 + i / 2 + x * .01) % 1;
    c.globalAlpha = heat * .45 * (1 - t); c.beginPath(); c.arc(x, y, size * (.5 + t * .8), Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
  c.restore();
}

/** Draws a ground crawler (hunter, breaker, bulwark, twin-lens, heavy-lens) at the context origin. */
export function drawEnemyCrawler(c, e, time, hit = 0, dead = false, reduced = false) {
  const kind = e.kind || 'hunter', k = ENEMY_ART_SCALE[kind] || ENEMY_ART_SCALE.hunter;
  const o = { pose: e.pose || NO_POSE, hit: dead ? 0 : hit, dead, time, reduced, idle: dead || reduced ? 0 : time };
  c.save(); c.scale(k, k);
  if (kind === 'breaker') drawBreaker(c, e, o);
  else if (kind === 'bulwark') drawBerserker(c, e, o);
  else if (kind === 'twin-lens') drawTwin(c, e, o);
  else if (kind === 'heavy-lens') drawHeavy(c, e, o);
  else drawHunter(c, e, o);
  c.restore();
}

// ---------------------------------------------------------------- Siege centipede
const CENTI = { plate: '#d6a55e', light: '#edc684', dark: '#a2703c', edge: '#f6e0ae', line: '#3c1a1f', tissue: '#6a2433', tissueLight: '#8e3a44', leg: '#e6c79c', legLine: '#4a1c28', claw: '#3a161e', rim: '#d97c6c', port: '#3a0f1c', petal: '#efb497', petalInner: '#a3313f', maw: '#4a0f1e', mawDeep: '#25060f', tooth: '#f8ecd4', tentacle: '#b9505b', tentacleLight: '#e08a8c' };
const CENTI_DEAD = deadOf(CENTI);
/**
 * Draws the plated chain in pixels. `parts` are head first: {x, y, angle}, angle 0
 * facing -y. Plates stay inside the saved collision circles of radius `r`.
 * o: { time, walk (leg wave phase), pose, hit, dead, reduced }.
 */
export function drawCentipedeParts(c, parts, r, o) {
  const P = o.dead ? CENTI_DEAD : CENTI, pose = o.pose || NO_POSE, idle = o.dead || o.reduced ? 0 : o.time || 0, step = o.walk || 0;
  const at = (p, fn) => { c.save(); c.translate(p.x, p.y); c.rotate(p.angle || 0); fn(); c.restore(); };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#25152538';
  for (const p of parts) { c.beginPath(); c.ellipse(p.x + r * .2, p.y + r * .24, r * 1.15, r * 1.1, p.angle || 0, 0, TAU); c.fill(); }
  if (parts.length > 1) at(parts[parts.length - 1], () => {
    // Soft tail tentacles and two long antennae; they trail and sway.
    [-.5, -.25, 0, .25, .5].forEach((x, i) => {
      const sway = idle ? Math.sin(idle * 2.2 + i * 1.3) * .22 * r : 0, bend = (i % 2 ? .25 : -.25) * r;
      const curve = (w, color, from = 0) => {
        c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x * r * (1 + from), r * (.5 + from));
        c.quadraticCurveTo(x * r * 2.2 + bend + sway * .5, r * 1.35, x * r * 3.4 + sway, r * 1.75 + Math.abs(x) * r * .2); c.stroke();
      };
      curve(3.8, P.line); curve(2.3, P.tentacle); curve(1.1, P.tentacleLight, .5);
    });
    sides(s => {
      const sway = idle ? Math.sin(idle * 1.3 + s) * .35 * r : 0;
      c.strokeStyle = P.tentacle; c.lineWidth = 1; c.beginPath(); c.moveTo(s * r * .3, r * .6);
      c.bezierCurveTo(s * r * .9, r * 1.6, s * r * 2.2 + sway * .5, r * 2.3, s * r * 2.6 + sway, r * 3.6); c.stroke();
    });
  });
  // Four legs a body part, in a wave travelling down the chain.
  parts.forEach((p, i) => {
    if (i === 0) return;
    at(p, () => sides(s => [-1, 1].forEach(q => {
      const flex = step ? Math.sin(step - i * .85 + (q > 0 ? Math.PI / 2 : 0)) * .14 * r : 0, curl = o.dead ? .6 : 1;
      const root = [s * r * .55, q * r * .36], knee = [s * r * 1.08 * (o.dead ? .88 : 1), q * r * .5 + s * flex], foot = [s * r * 1.34 * curl + (o.dead ? s * r * .2 : 0), q * r * .66 + s * flex + (o.dead ? q * r * .1 : 0)];
      line(c, [root, knee, foot], P.legLine, 4.4); line(c, [root, knee], P.leg, 2.4); line(c, [knee, foot], P.claw, 1.8);
    })));
  });
  for (let i = parts.length - 1; i >= 0; i--) at(parts[i], () => {
    oval(c, 0, 0, r * .8, r * .96, P.tissue);
    oval(c, -r * .25, -r * .2, r * .35, r * .5, P.tissueLight);
    if (i === 0) {
      poly(c, [[-r * .62, -r * .1], [0, -r * .3], [r * .62, -r * .1], [r * .62, r * .45], [0, r * .66], [-r * .62, r * .45]], P.light, P.line, 1.2);
      line(c, [[-r * .6, r * .32], [0, r * .02], [r * .6, r * .32]], P.edge, 1.3);
      return;
    }
    const plate = [[-r * .68, -r * .5], [0, -r * .82], [r * .68, -r * .5], [r * .68, r * .45], [0, r * .68], [-r * .68, r * .45]];
    poly(c, plate, i % 2 ? P.plate : P.light, P.line, 1.2);
    poly(c, [[-r * .66, -r * .48], [0, -r * .8], [0, r * .66], [-r * .66, r * .44]], '#ffffff22');
    poly(c, [[-r * .66, r * .02], [0, -r * .46], [r * .66, r * .02], [r * .66, r * .2], [0, -r * .26], [-r * .66, r * .2]], P.dark);
    line(c, [[-r * .66, r * .02], [0, -r * .46], [r * .66, r * .02]], P.edge, 1.4);
    line(c, [[0, -r * .78], [0, r * .62]], P.dark, 1);
    // Brood ports breathe in a slow wave down the chain.
    const pulse = 1 + (idle ? Math.sin(idle * 2 - i * .9) * .12 : 0);
    sides(s => { oval(c, s * r * .8, 0, r * .17 * pulse, r * .25 * pulse, P.rim); oval(c, s * r * .81, 0, r * .1 * pulse, r * .16 * pulse, P.port); });
    if (o.hit) { c.save(); c.globalAlpha = Math.min(.55, o.hit); poly(c, plate, '#ffe6b0'); c.restore(); }
  });
  // Flower maw: petals breathe, spread wide through the windup and clamp shut on the strike.
  at(parts[0], () => {
    const wind = pose.attacking ? pose.windup : 0, snap = pose.strike, my = -r * .55;
    const spread = o.dead ? .45 : snap > 0 ? .35 : 1 + .3 * wind + (idle ? Math.sin(idle * 1.5) * .06 : 0);
    const length = o.dead ? .8 : 1 + .12 * wind;
    [-1.2, -.6, 0, .6, 1.2].forEach(a => {
      c.save(); c.translate(0, my); c.rotate(a * spread);
      const L = r * length;
      c.beginPath(); c.moveTo(-r * .3, 0); c.bezierCurveTo(-r * .55, -L * .5, -r * .3, -L * 1.05, 0, -L * 1.2); c.bezierCurveTo(r * .3, -L * 1.05, r * .55, -L * .5, r * .3, 0); c.closePath();
      c.fillStyle = P.petal; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.1; c.stroke();
      c.beginPath(); c.moveTo(-r * .16, -r * .1); c.bezierCurveTo(-r * .32, -L * .5, -r * .17, -L * .9, 0, -L * .98); c.bezierCurveTo(r * .17, -L * .9, r * .32, -L * .5, r * .16, -r * .1); c.closePath();
      c.fillStyle = P.petalInner; c.fill();
      c.setLineDash([1.3, 1.5]); c.strokeStyle = P.tooth; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
      c.restore();
    });
    const maw = r * (.42 + .08 * wind);
    oval(c, 0, my, maw, maw, P.maw); toothRing(c, 0, my, maw, 9, 2.4, P.tooth); oval(c, 0, my, maw * .4, maw * .4, P.mawDeep);
  });
  c.restore();
}

// ---------------------------------------------------------------- Swimmer
const SWIM = { fin: '#d9806a', body: '#b84a45', dark: '#8a2f3a', line: '#3e1418', vein: '#93304c', maw: '#45111f', tooth: '#f4e4c8', lip: '#e39684', core: '#ff9a3a', coreHot: '#ffd98a', vessel: '#6a2242', vesselLight: '#b04462', rim: '#ead0b0', hub: '#d2564a', well: '#5a1c2a' };
function swimmerOutline(c, wave) {
  c.beginPath(); c.moveTo(0, -26); c.bezierCurveTo(6, -26, 9, -18, 9, -9); c.bezierCurveTo(16, -6, 26 + wave, 0, 32 + wave, 8); c.bezierCurveTo(26, 9, 19, 9, 14, 10);
  c.bezierCurveTo(18, 14, 22, 19, 24, 24); c.bezierCurveTo(16, 24, 8, 20, 0, 16); c.bezierCurveTo(-8, 20, -16, 24, -24, 24); c.bezierCurveTo(-22, 19, -18, 14, -14, 10);
  c.bezierCurveTo(-19, 9, -26, 9, -32 - wave, 8); c.bezierCurveTo(-26 - wave, 0, -16, -6, -9, -9); c.bezierCurveTo(-9, -18, -6, -26, 0, -26); c.closePath();
}
/**
 * Swimmer body at the context origin (rotated, front -y). o: { time, pose, hit,
 * burning, reduced }. Fins beat, propellers turn with travel, the core pulses and
 * the mouth gapes through the saved windup before snapping shut.
 */
export function drawSwimmerBody(c, e, o) {
  const pose = o.pose || NO_POSE, idle = o.reduced ? 0 : o.time || 0, id = e.id || 0;
  const wave = idle ? Math.sin(idle * 8 + id) * 2.5 : 0;
  const fin = o.hit ? '#ffc7ae' : o.burning ? '#7a4a44' : SWIM.fin, body = o.hit ? '#ffb39a' : o.burning ? '#614341' : SWIM.body;
  swimmerOutline(c, wave); c.fillStyle = fin; c.fill();
  c.fillStyle = body; c.beginPath(); c.moveTo(0, -26); c.bezierCurveTo(6, -26, 9, -18, 9, -9); c.bezierCurveTo(11, 0, 9, 10, 0, 15); c.bezierCurveTo(-9, 10, -11, 0, -9, -9); c.bezierCurveTo(-9, -18, -6, -26, 0, -26); c.closePath(); c.fill();
  sides(s => { line(c, [[s * 9, -5], [s * 17, -1], [s * 25, 5.5]], SWIM.vein, .8); line(c, [[s * 10, 3], [s * 18, 7]], SWIM.vein, .8); line(c, [[s * 9, 11], [s * 16, 17]], SWIM.vein, .8); });
  swimmerOutline(c, wave); c.strokeStyle = SWIM.line; c.lineWidth = 1.3; c.stroke();
  const wind = pose.attacking ? pose.windup : 0, open = pose.strike > 0 ? .15 : .6 + .55 * wind + (idle ? Math.sin(idle * 2.5 + id) * .06 : 0);
  const w = 11.5 * open;
  c.fillStyle = SWIM.maw; c.beginPath(); c.moveTo(0, -25.5); c.quadraticCurveTo(w, -15, 0, -3); c.quadraticCurveTo(-w, -15, 0, -25.5); c.fill();
  sides(s => { c.strokeStyle = SWIM.lip; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -25.5); c.quadraticCurveTo(s * (w + .8), -15, 0, -3); c.stroke(); });
  for (let y = -22.5; y <= -6; y += 3.3) sides(s => {
    const half = Math.max(.8, w * .3 * Math.sin(Math.PI * (y + 25.5) / 22.5));
    poly(c, [[s * half, y - 1.3], [s * (half - 2.4), y], [s * half, y + 1.3]], SWIM.tooth);
  });
  sides(s => { const pts = [[s * 2.5, 7], [s * 10, 9], [s * 15, 16.5]]; line(c, pts, SWIM.vessel, 3.2); line(c, pts, SWIM.vesselLight, 1.3); });
  const beat = 1 + (idle ? Math.sin(idle * 5 + id) * .08 : 0) + .15 * wind;
  oval(c, 0, 5, 6.2 * beat, 6.2 * beat, '#f3b08a66'); oval(c, 0, 5, 4.6 * beat, 4.6 * beat, SWIM.core); oval(c, -.8, 4.2, 2.2, 2.2, SWIM.coreHot);
  const spin = (pose.stride || 0) * 6 + idle * 3;
  sides(s => {
    const x = s * 16, y = 17.5;
    oval(c, x, y, 4.9, 4.9, SWIM.well); c.strokeStyle = SWIM.rim; c.lineWidth = 1.1; c.stroke();
    for (let b = 0; b < 3; b++) {
      const a = spin * s + b * TAU / 3 + .4;
      c.fillStyle = SWIM.rim; c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a + .55) * 5, y + Math.sin(a + .55) * 5, x + Math.cos(a + 1) * 4.3, y + Math.sin(a + 1) * 4.3);
      c.quadraticCurveTo(x + Math.cos(a + .25) * 2.2, y + Math.sin(a + .25) * 2.2, x, y); c.fill();
    }
    oval(c, x, y, 1.4, 1.4, SWIM.hub);
  });
}
