// Frontier enemy sketches v1: game-scale simplifications of the concept art.
// Review material only; nothing in public/ imports this file yet.
//
// Conventions match the current renderers (effects.js, mobile-laser-effects.js,
// centipede-art.js, vehicle-effects.js): pixels at zoom 1 with 48 px per tile,
// origin at the body centre, front toward -y. Flat fills, a dark under-stroke
// for limbs with a lighter stroke on top, pale bone accents and a soft shadow.
const TAU = Math.PI * 2;

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
// A limb: dark outline stroke, then the upper (muscle) and lower (shell) segments.
function limb(c, root, knee, foot, { outline, upper, lower, width, tip, tipLength = 3.5 }) {
  line(c, [root, knee, foot], outline, width + 2.2);
  line(c, [root, knee], upper, width);
  line(c, [knee, foot], lower, width * .85);
  if (tip) {
    const dx = foot[0] - knee[0], dy = foot[1] - knee[1], d = Math.hypot(dx, dy) || 1;
    line(c, [foot, [foot[0] + dx / d * tipLength, foot[1] + dy / d * tipLength]], tip, Math.max(1.4, width * .45));
  }
}
// Small triangular teeth along a ring, pointing at its centre.
function toothRing(c, x, y, r, count, size, color, from = 0, to = TAU) {
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = from + (to - from) * (i + .5) / count, ox = Math.cos(a), oy = Math.sin(a), px = -oy, py = ox;
    c.beginPath();
    c.moveTo(x + ox * r + px * size * .55, y + oy * r + py * size * .55);
    c.lineTo(x + ox * (r - size), y + oy * (r - size));
    c.lineTo(x + ox * r - px * size * .55, y + oy * r - py * size * .55);
    c.closePath(); c.fill();
  }
}
// Teeth along a segment, pointing toward (nx, ny).
function toothRow(c, a, b, count, size, nx, ny, color) {
  c.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const dx = (b[0] - a[0]) / count * .45, dy = (b[1] - a[1]) / count * .45;
    c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + nx * size, y + ny * size); c.lineTo(x + dx, y + dy); c.closePath(); c.fill();
  }
}
// A mouth-head seen from above: a lobe split by a forward-opening toothed jaw,
// so it reads as a mouth rather than a round eye.
function mouthHead(c, x, y, rx, ry, rot, lobe, gape, tooth, outline, open = .78) {
  c.save(); c.translate(x, y); c.rotate(rot);
  oval(c, 0, 0, rx, ry, lobe); c.strokeStyle = outline; c.lineWidth = 1.1; c.stroke();
  const a1 = -Math.PI / 2 - open, a2 = -Math.PI / 2 + open, reach = ry * 1.08;
  c.fillStyle = gape; c.beginPath(); c.moveTo(0, ry * .3); c.arc(0, ry * .3, reach + ry * .3, a1, a2); c.closePath(); c.fill();
  const tip = r => [Math.cos(r) * (reach + ry * .2), ry * .3 + Math.sin(r) * (reach + ry * .2)];
  const size = Math.max(1.6, rx * .34);
  toothRow(c, [0, ry * .3], tip(a1), 3, size, Math.cos(a1 + Math.PI / 2), Math.sin(a1 + Math.PI / 2), tooth);
  toothRow(c, [0, ry * .3], tip(a2), 3, size, Math.cos(a2 - Math.PI / 2), Math.sin(a2 - Math.PI / 2), tooth);
  c.restore();
}
const sides = fn => { fn(-1); fn(1); };
const gaitOf = (o, rate, amount) => o.time ? Math.sin(o.time * rate + (o.id || 0)) * amount : 0;

// ---------------------------------------------------------------- Hunter
// Keeps: heart-shaped rust carapace with a centre seam, two open mouth-heads
// (no eyes), two open serrated clamps outside them, four walking legs, and two
// pairs of back vents. Fast and light: little armor, exposed muscle.
export function drawHunterSketch(c, o = {}) {
  const P = { shell: '#a9492f', light: '#c7643f', dark: '#7a3024', line: '#3a1814', muscle: '#86323a', bone: '#ecd6ad', gape: '#2b0f15', vent: '#4a1922' };
  const g = gaitOf(o, 13, 3);
  oval(c, 3, 6, 25, 29, '#1c231944');
  sides(s => {
    limb(c, [s * 11, 0], [s * 24, -3 + s * g * .3], [s * 28, 11 + s * g], { outline: P.line, upper: P.muscle, lower: P.shell, width: 4, tip: P.line });
    limb(c, [s * 9, 9], [s * 20, 15 - s * g * .3], [s * 21, 28 - s * g], { outline: P.line, upper: P.muscle, lower: P.shell, width: 4, tip: P.line });
    // Clamp arm, then the open pincer: big outer finger and a shorter thumb.
    line(c, [[s * 11, -8], [s * 21, -13], [s * 23, -22]], P.line, 7.5);
    line(c, [[s * 11, -8], [s * 21, -13], [s * 23, -22]], P.muscle, 5);
    oval(c, s * 21, -13, 3, 3, P.shell);
    c.beginPath(); c.moveTo(s * 28, -20);
    c.bezierCurveTo(s * 32, -30, s * 28, -41, s * 19, -45);
    c.bezierCurveTo(s * 23, -38, s * 24, -31, s * 21, -24); c.closePath();
    c.fillStyle = P.shell; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.2; c.stroke();
    toothRow(c, [s * 21.5, -40], [s * 22.5, -27], 3, 2.6, -s, 0, P.bone);
    c.beginPath(); c.moveTo(s * 19, -21);
    c.bezierCurveTo(s * 15, -24, s * 13, -29, s * 13, -34);
    c.bezierCurveTo(s * 17, -31, s * 19, -27, s * 22, -24); c.closePath();
    c.fillStyle = P.light; c.fill(); c.strokeStyle = P.line; c.stroke();
    toothRow(c, [s * 15, -31], [s * 18, -25], 2, 2.2, s * .8, -.4, P.bone);
    // Mouth-head: a lobe split by a forward-opening toothed jaw.
    mouthHead(c, s * 8.5, -18, 7, 7.6, s * .12, P.dark, P.gape, P.bone, P.line);
  });
  // Heart-shaped carapace with a forward prow between the mouths.
  const body = new Path2D('M0 -15 C4 -14 10 -14 14 -9 C18 -3 16 8 10 14 C6 18 2 21 0 24 C-2 21 -6 18 -10 14 C-16 8 -18 -3 -14 -9 C-10 -14 -4 -14 0 -15 Z');
  poly(c, [[-2.5, -14], [0, -21], [2.5, -14]], P.shell, P.line, 1);
  c.fillStyle = o.hit ? '#d49d7e' : P.shell; c.fill(body);
  c.save(); c.clip(body); c.fillStyle = P.dark + '55'; c.fillRect(0, -20, 20, 46); oval(c, -6, -3, 9, 17, P.light); c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke(body);
  line(c, [[0, -15], [0, 23]], '#5c2219', 1.6); line(c, [[-1, -13], [-1, 20]], '#de8a5d', .7);
  sides(s => [-3, 6].forEach((y, i) => {
    oval(c, s * 7.5, y, 4.6, 2.1, P.vent, s * (i ? .32 : .2));
    c.strokeStyle = '#e09272'; c.lineWidth = .8; c.beginPath(); c.ellipse(s * 7.5, y + .6, 4.4, 1.6, s * (i ? .32 : .2), Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }));
}

// ---------------------------------------------------------------- Breaker
// Keeps: long gold body (about 1.65 times as long as wide), forward-pointing
// chevron plates on a pale spine, vent slits, two necked mouth-heads, two
// oversized open clamps, and four long exposed burgundy walking legs.
export function drawBreakerSketch(c, o = {}) {
  const P = { plate: '#c8912d', light: '#e2b34d', dark: '#8c5d1d', edge: '#f2deaa', line: '#3d2414', muscle: '#6e2a2e', muscleLight: '#984340', gape: '#2c1014', vent: '#4f1a22' };
  const g = gaitOf(o, 7, 2);
  oval(c, 3, 8, 28, 36, '#1c231944');
  sides(s => {
    limb(c, [s * 15, 4], [s * 29, -2 + s * g * .3], [s * 35, 14 + s * g], { outline: P.line, upper: P.muscle, lower: P.muscleLight, width: 3.6, tip: P.edge, tipLength: 4 });
    limb(c, [s * 13, 19], [s * 27, 25 - s * g * .3], [s * 30, 41 - s * g], { outline: P.line, upper: P.muscle, lower: P.muscleLight, width: 3.6, tip: P.edge, tipLength: 4 });
    [[s * 29, -2], [s * 27, 25]].forEach(([x, y]) => oval(c, x, y, 2.2, 2.2, P.edge));
    // Muscular forearm into the oversized open clamp.
    line(c, [[s * 12, -11], [s * 27, -15], [s * 32, -24]], P.line, 9);
    line(c, [[s * 12, -11], [s * 27, -15], [s * 32, -24]], P.muscle, 6.5);
    oval(c, s * 27, -15, 3, 3, P.edge);
    c.beginPath(); c.moveTo(s * 38, -21);
    c.bezierCurveTo(s * 48, -31, s * 47, -50, s * 32, -59);
    c.bezierCurveTo(s * 37, -49, s * 38, -36, s * 31, -27); c.closePath();
    c.fillStyle = P.plate; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.3; c.stroke();
    line(c, [[s * 42, -28], [s * 42, -44]], P.light, 2);
    toothRow(c, [s * 35.5, -52], [s * 36, -32], 4, 3, -s, .1, P.edge);
    c.beginPath(); c.moveTo(s * 28, -25);
    c.bezierCurveTo(s * 23, -30, s * 21, -38, s * 22, -47);
    c.bezierCurveTo(s * 26, -40, s * 29, -33, s * 33, -27); c.closePath();
    c.fillStyle = P.light; c.fill(); c.strokeStyle = P.line; c.stroke();
    toothRow(c, [s * 23.5, -42], [s * 27, -31], 2, 2.6, s, -.2, P.edge);
    // Necked mouth-head with a forward-opening jaw.
    line(c, [[s * 4, -18], [s * 9, -28]], P.line, 6.5); line(c, [[s * 4, -18], [s * 9, -28]], P.muscle, 4.5);
    mouthHead(c, s * 9.5, -32, 5.8, 6.8, s * .22, P.dark, P.gape, P.edge, P.line);
  });
  const body = new Path2D('M0 -28 L3.5 -21 C12 -20 18 -10 18 3 C18 17 10 29 0 38 C-10 29 -18 17 -18 3 C-18 -10 -12 -20 -3.5 -21 Z');
  const rows = [[-12, 16], [-1, 18], [10, 17], [21, 13], [30, 7]];
  // Side tips of each plate poke out of the outline, giving a serrated edge.
  sides(s => rows.forEach(([y, w]) => poly(c, [[s * (w - 3), y + 3], [s * (w + 3.5), y + 9], [s * (w - 2), y + 8]], P.plate, P.line, 1)));
  c.fillStyle = o.hit ? '#e0b690' : P.plate; c.fill(body);
  c.save(); c.clip(body);
  oval(c, -7, 0, 9, 27, P.light + 'bb');
  rows.forEach(([y, w]) => {
    poly(c, [[-w - 2, y + 6], [0, y - 3], [w + 2, y + 6], [w + 2, y + 9.5], [0, y + .5], [-w - 2, y + 9.5]], P.dark);
    line(c, [[-w - 2, y + 6], [0, y - 3], [w + 2, y + 6]], P.edge, 1.6);
  });
  sides(s => rows.slice(0, 4).forEach(([y]) => oval(c, s * 8.5, y + 4.8, 3.6, 1.25, P.vent, s * -.42)));
  c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke(body);
  line(c, [[0, -26], [0, 37]], P.edge, 2); line(c, [[1.2, -20], [1.2, 36]], P.dark, .8);
  rows.forEach(([y]) => poly(c, [[-2, y + 1], [0, y + 6], [2, y + 1]], P.edge));
}

// ---------------------------------------------------------------- Berserker
// Keeps: broad slate armored wedge, rows of forward chevron plates whose tips
// serrate the outline, a central prow spike plus two long pike forelimbs
// (three forward points), legs hidden except four claw tips, plum vents.
export function drawBerserkerSketch(c, o = {}) {
  const P = { armor: '#4b5d6d', light: '#5f7588', dark: '#2c3843', edge: '#a9b7bc', line: '#141b21', seam: '#4b2a40', vent: '#2c1424', claw: '#d9d6c8' };
  const g = gaitOf(o, 6, 1.5);
  oval(c, 4, 9, 36, 42, '#1c231955');
  // Only the four claw tips show beneath the skirt.
  sides(s => {
    // Hooked claws: a plum root, then a pale tapering hook.
    [[29, 14, .25], [21, 37, 1]].forEach(([x, y, a]) => {
      const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, L = 8, ty = y + s * g;
      oval(c, s * x, ty, 3.2, 3.2, P.seam);
      poly(c, [[s * (x + px * 2.2), ty + py * 2.2], [s * (x + dx * L + px * 1.5), ty + dy * L + py * 1.5 + 1.5], [s * (x - px * 2.2), ty - py * 2.2]], P.claw, P.line, .9);
    });
  });
  // Pike forelimbs: a segmented armored root, then a long lance.
  sides(s => {
    const pike = [[s * 15, -6], [s * 29, -12], [s * 31, -24], [s * 18, -57], [s * 21, -30], [s * 20, -17], [s * 12, -11]];
    poly(c, pike, P.armor, P.line, 1.3);
    poly(c, [[s * 29, -12], [s * 31, -24], [s * 18, -57], [s * 23, -28]], s < 0 ? P.light : P.dark);
    line(c, [[s * 30.5, -23], [s * 18, -56]], P.edge, 1.1);
    line(c, [[s * 19, -13], [s * 30, -18]], P.line, 1.2); line(c, [[s * 20, -24], [s * 28, -31]], P.line, 1.1);
    line(c, [[s * 13, -10], [s * 19, -6]], P.seam, 2.4);
  });
  const body = new Path2D('M-21 -14 L21 -14 C28 -10 32 -1 32 10 C32 24 21 36 0 43 C-21 36 -32 24 -32 10 C-32 -1 -28 -10 -21 -14 Z');
  const rows = [[-8, 27], [.5, 31], [9, 32], [17.5, 31], [26, 26], [34.5, 16]];
  sides(s => rows.forEach(([y, w]) => poly(c, [[s * (w - 4), y + 1], [s * (w + 6), y + 10], [s * (w - 3), y + 8]], P.armor, P.line, 1)));
  c.fillStyle = o.hit ? '#c4c9b4' : P.armor; c.fill(body);
  c.save(); c.clip(body);
  c.fillStyle = P.light; c.fillRect(-40, -20, 40, 70);
  rows.forEach(([y, w]) => {
    poly(c, [[-w - 4, y + 7], [0, y - 2], [w + 4, y + 7], [w + 4, y + 10], [0, y + 1], [-w - 4, y + 10]], P.dark);
    line(c, [[-w - 4, y + 7], [0, y - 2], [w + 4, y + 7]], P.edge, 1);
  });
  sides(s => rows.slice(1, 5).forEach(([y]) => oval(c, s * 12, y + 4, 4, 1.15, P.vent, s * -.4)));
  c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.6; c.stroke(body);
  // Prow wedge: stacked plates rising out of the body to the breaker spike.
  const prow = [[-21, -12], [-9, -32], [0, -59], [9, -32], [21, -12]];
  poly(c, prow, P.armor);
  poly(c, [[-21, -12], [-9, -32], [0, -59], [0, -12]], P.light);
  [[-12, 14], [-24, 10], [-36, 6]].forEach(([y, w]) => {
    poly(c, [[-w, y + 3], [0, y - 6], [w, y + 3], [w, y + 5.5], [0, y - 3.5], [-w, y + 5.5]], P.dark);
    line(c, [[-w, y + 3], [0, y - 6], [w, y + 3]], P.edge, 1);
  });
  line(c, [[0, -58], [0, 42]], P.edge, 1.3); line(c, [[1, -52], [1, 41]], P.dark, .8);
  c.beginPath(); prow.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = P.line; c.lineWidth = 1.4; c.stroke();
}

// ---------------------------------------------------------------- Twin laser
// Keeps: compact pear body, two banded camera-lens barrels side by side with a
// notch between, teal apertures, six slim walking legs, and two separate
// four-fin radiator banks either side of a clear central strip.
// The barrels sit in their own group pivoting at the neck so the aim can turn
// independently of the body, as drawLensCrawler does today.
export function drawTwinLaserSketch(c, o = {}) {
  const P = { chitin: '#7b3d64', light: '#9d5d85', dark: '#4e2343', ridge: '#c9a3b4', line: '#2c1428', muscle: '#7e2a44', membrane: '#c24e55', bone: '#e2c2b4', lensDark: '#10262a', lens: '#2c6b6a', lensLight: '#7cc0b2' };
  const braced = ['bracing', 'charging', 'firing'].includes(o.phase), g = braced ? 0 : gaitOf(o, 8, 3);
  oval(c, 3, 7, 23, 27, '#17212655');
  sides(s => [[[13, -5], [25, -11], [30, -1]], [[15, 5], [28, 4], [31, 15]], [[12, 15], [23, 21], [24, 32]]].forEach(([r, k, f], i) => {
    const st = g * (i % 2 ? 1 : -1), spread = braced ? 4 : 0;
    limb(c, [s * r[0], r[1]], [s * (k[0] + spread), k[1] + st * .4], [s * (f[0] + spread), f[1] + st], { outline: P.line, upper: P.muscle, lower: P.chitin, width: 2.8, tip: P.bone, tipLength: 3 });
    oval(c, s * (k[0] + spread), k[1] + st * .4, 1.7, 1.7, P.ridge);
  }));
  const body = new Path2D('M0 -13 C10 -14 18 -7 18 4 C18 14 9 22 0 29 C-9 22 -18 14 -18 4 C-18 -7 -10 -14 0 -13 Z');
  c.fillStyle = o.hit ? '#ecc0a1' : P.chitin; c.fill(body);
  c.save(); c.clip(body);
  oval(c, -7, 0, 8, 17, P.light + '99');
  sides(s => {
    c.fillStyle = P.membrane; c.beginPath(); c.moveTo(s * 3.5, -7); c.quadraticCurveTo(s * 15, -6, s * 15, 3); c.quadraticCurveTo(s * 14, 15, s * 3.5, 20); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++) {
      const y = -5.5 + k * 6.4, pts = [[s * 3.5, y], [s * (11.5 - k * .6), y - 1], [s * (15 - k * 1.3), y + 4]];
      line(c, pts, P.dark, 3.2); line(c, pts, P.bone, 1.5);
    }
  });
  line(c, [[0, -10], [0, 26]], '#a03a55', .9);
  c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.4; c.stroke(body);
  // Lens group: aimed about the neck pivot.
  c.save(); c.translate(0, -11); c.rotate((o.aim ?? 0));
  oval(c, 0, -1, 8, 4, P.muscle);
  const charging = o.phase === 'charging', firing = o.phase === 'firing';
  sides(s => {
    const x = s * 7.4;
    c.fillStyle = P.chitin; c.beginPath(); c.roundRect(x - 6, -21, 12, 21, 2.5); c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = P.dark + 'aa'; c.fillRect(x + 1.5, -20, 4, 19);
    [-6, -13].forEach(y => { c.fillStyle = P.ridge; c.fillRect(x - 6.3, y - 1.4, 12.6, 2.8); line(c, [[x - 6, y + 1.6], [x + 6, y + 1.6]], P.line, .8); });
    oval(c, x, -21, 6.6, 6.6, P.ridge); c.strokeStyle = P.line; c.lineWidth = 1.1; c.stroke();
    oval(c, x, -21, 5, 5, P.lensDark);
    const lit = firing && (o.lens === undefined || o.lens === (s < 0 ? 0 : 1));
    oval(c, x, -21, 3.4, 3.4, lit ? '#fff3ce' : charging ? '#ffba99' : P.lens);
    oval(c, x - 1.3, -22.4, 1.1, 1.1, lit ? '#ffffff' : P.lensLight);
    if (charging) { c.strokeStyle = '#ffb9a0'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, -21, 9.5, 0, TAU); c.stroke(); }
  });
  c.restore();
}

// ---------------------------------------------------------------- Heavy laser
// Keeps: one huge stepped lens barrel across the whole front, a broad body
// whose radiator ribs arch across the midline as one connected bank with red
// gill tissue between them, and six thick legs with armored knees and blunt
// feet. Drawn at its own size; `size` scales the whole creature.
export function drawHeavyLaserSketch(c, o = {}) {
  const P = { chitin: '#74395e', light: '#965a7f', dark: '#46203d', ridge: '#cba6b7', line: '#26101f', muscle: '#6e2a40', membrane: '#c8514f', gill: '#8d2b39', lensDark: '#0e2427', lens: '#2c6b6a', lensLight: '#7cc0b2' };
  const braced = ['bracing', 'charging', 'firing'].includes(o.phase), g = braced ? 0 : gaitOf(o, 5, 2.5);
  c.save(); if (o.size) c.scale(o.size, o.size);
  oval(c, 4, 10, 42, 44, '#17212655');
  sides(s => [[[22, -8], [38, -14], [44, -2]], [[26, 6], [42, 6], [46, 20]], [[22, 20], [36, 28], [38, 42]]].forEach(([r, k, f], i) => {
    const st = g * (i % 2 ? 1 : -1), spread = braced ? 4 : 0;
    const knee = [s * (k[0] + spread), k[1] + st * .4], foot = [s * (f[0] + spread), f[1] + st];
    line(c, [[s * r[0], r[1]], knee, foot], P.line, 11);
    line(c, [[s * r[0], r[1]], knee], P.muscle, 8.5); line(c, [knee, foot], P.chitin, 7.5);
    poly(c, [[knee[0], knee[1] - 5], [knee[0] + s * 4.5, knee[1]], [knee[0], knee[1] + 5], [knee[0] - s * 4.5, knee[1]]], P.ridge, P.line, 1);
    oval(c, foot[0], foot[1] + 1, 4.6, 3.6, P.dark); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke();
  }));
  const body = new Path2D('M-24 -12 L24 -12 C33 -6 35 12 30 26 C26 38 14 45 0 48 C-14 45 -26 38 -30 26 C-35 12 -33 -6 -24 -12 Z');
  c.fillStyle = o.hit ? '#ecc0a1' : P.chitin; c.fill(body);
  c.save(); c.clip(body);
  oval(c, -10, 10, 14, 30, P.light + '88');
  oval(c, 0, 21, 24, 21, P.membrane);
  c.strokeStyle = P.gill; c.lineWidth = .9;
  for (let x = -22; x <= 22; x += 3.4) { c.beginPath(); c.moveTo(x, 2); c.lineTo(x * 1.05, 42); c.stroke(); }
  [[3, 30], [13, 30], [23, 27], [33, 19]].forEach(([y, w], k) => {
    const pts = k === 3 ? [[-w, y + 7], [0, y - 4], [w, y + 7]] : null;
    c.lineCap = 'round';
    for (const [color, width] of [[P.dark, 6.5], [P.ridge, 3.6]]) {
      c.strokeStyle = color; c.lineWidth = width; c.beginPath();
      if (pts) { c.moveTo(...pts[0]); c.lineTo(...pts[1]); c.lineTo(...pts[2]); }
      else { c.moveTo(-w, y + 7); c.quadraticCurveTo(0, y - 9, w, y + 7); }
      c.stroke();
    }
  });
  c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.6; c.stroke(body);
  // Barrel group: stepped, tapering toward the aperture, aimed about its base.
  c.save(); c.translate(0, -8); c.rotate(o.aim ?? 0);
  const steps = [[0, -10, 25, 23], [-10, -21, 21, 19], [-21, -32, 17.5, 16], [-32, -42, 14.5, 13.5]];
  steps.forEach(([y0, y1, w0, w1]) => {
    poly(c, [[-w0, y0], [-w1, y1], [w1, y1], [w0, y0]], P.chitin, P.line, 1.2);
    poly(c, [[-w0 + 1, y0], [-w1 + 1, y1], [-w1 * .35, y1], [-w0 * .35, y0]], P.light + 'aa');
    poly(c, [[w0 * .55, y0], [w1 * .55, y1], [w1 - 1, y1], [w0 - 1, y0]], P.dark + 'aa');
    c.fillStyle = P.ridge; c.fillRect(-w1 - .8, y1 - 1.2, w1 * 2 + 1.6, 3); line(c, [[-w1, y1 + 2], [w1, y1 + 2]], P.line, .8);
  });
  const charging = o.phase === 'charging', firing = o.phase === 'firing';
  oval(c, 0, -43, 12.5, 12.5, P.ridge); c.strokeStyle = P.line; c.lineWidth = 1.3; c.stroke();
  oval(c, 0, -43, 10, 10, P.lensDark);
  oval(c, 0, -43, 7, 7, firing ? '#fff3ce' : charging ? '#ffba99' : P.lens);
  c.strokeStyle = firing || charging ? '#fff6e0aa' : P.lensDark; c.lineWidth = .9;
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(Math.cos(a) * 2.2, -43 + Math.sin(a) * 2.2); c.lineTo(Math.cos(a + .9) * 6.6, -43 + Math.sin(a + .9) * 6.6); c.stroke(); }
  oval(c, -2.6, -46, 2, 2, firing ? '#ffffff' : P.lensLight);
  if (charging) { c.strokeStyle = '#ffb9a0'; c.lineWidth = 2; c.beginPath(); c.arc(0, -43, 17, 0, TAU); c.stroke(); }
  c.restore();
  c.restore();
}
// Width of each creature at size 1, for scale comparisons (feet to feet).
export const SKETCH_WIDTH = { twin: 64, heavy: 102 };

// ---------------------------------------------------------------- Siege centipede
// Keeps: eight saved parts (radius .42 t, spacing .75 t), the flower maw on the
// head part, gold chevron plates over burgundy tissue, a brood port on each flank
// of every body part with a leg either side of it (four legs a part), and soft
// tail tentacles with two long antennae. Plates stay inside the collision circles.
// `body` is in pixels, head first: [{x, y, angle}], angle 0 = facing -y.
export function drawCentipedeSketch(c, body, o = {}) {
  const r = o.radius ?? 20.16;
  const P = { plate: '#d6a55e', light: '#edc684', dark: '#a2703c', edge: '#f6e0ae', line: '#3c1a1f', tissue: '#6a2433', tissueLight: '#8e3a44', leg: '#e6c79c', legLine: '#4a1c28', claw: '#3a161e', rim: '#d97c6c', port: '#3a0f1c', petal: '#efb497', petalInner: '#a3313f', maw: '#4a0f1e', tooth: '#f8ecd4', tentacle: '#b9505b' };
  const step = o.time ? o.time * 4 : 0;
  const at = (p, fn) => { c.save(); c.translate(p.x, p.y); c.rotate(p.angle || 0); fn(); c.restore(); };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#25152538';
  for (const p of body) { c.beginPath(); c.ellipse(p.x + r * .2, p.y + r * .24, r * 1.15, r * 1.1, p.angle || 0, 0, TAU); c.fill(); }
  // Tail tentacles and antennae, under the last part.
  at(body[body.length - 1], () => {
    [-.5, -.25, 0, .25, .5].forEach((x, i) => {
      const sway = step ? Math.sin(step * .7 + i) * .15 * r : 0, bend = (i % 2 ? .25 : -.25) * r;
      const curve = (w, color, from = 0) => {
        c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(x * r * (1 + from), r * (.5 + from));
        c.quadraticCurveTo(x * r * 2.2 + bend, r * 1.35, x * r * 3.4 + sway, r * 1.75 + Math.abs(x) * r * .2); c.stroke();
      };
      curve(3.8, P.line); curve(2.3, P.tentacle); curve(1.1, '#e08a8c', .5);
    });
    sides(s => {
      c.strokeStyle = P.tentacle; c.lineWidth = 1; c.beginPath(); c.moveTo(s * r * .3, r * .6);
      c.bezierCurveTo(s * r * .9, r * 1.6, s * r * 2.2, r * 2.3, s * r * 2.6, r * 3.6); c.stroke();
    });
  });
  body.forEach((p, i) => {
    if (i === 0) return;
    const flex = step ? Math.sin(step - i * .85) * .1 * r : 0;
    at(p, () => sides(s => [-1, 1].forEach(q => {
      const root = [s * r * .55, q * r * .36], knee = [s * r * 1.08, q * r * .5 + s * flex], foot = [s * r * 1.34, q * r * .66 + s * flex];
      line(c, [root, knee, foot], P.legLine, 4.4);
      line(c, [root, knee], P.leg, 2.4);
      line(c, [knee, foot], P.claw, 1.8);
    })));
  });
  for (let i = body.length - 1; i >= 0; i--) at(body[i], () => {
    oval(c, 0, 0, r * .8, r * .96, P.tissue);
    oval(c, -r * .25, -r * .2, r * .35, r * .5, P.tissueLight);
    if (i === 0) {
      // The head part wears a short collar plate behind the flower maw.
      poly(c, [[-r * .62, -r * .1], [0, -r * .3], [r * .62, -r * .1], [r * .62, r * .45], [0, r * .66], [-r * .62, r * .45]], o.hit ? '#ffe6b0' : P.light, P.line, 1.2);
      line(c, [[-r * .6, r * .32], [0, r * .02], [r * .6, r * .32]], P.edge, 1.3);
      return;
    }
    const plate = [[-r * .68, -r * .5], [0, -r * .82], [r * .68, -r * .5], [r * .68, r * .45], [0, r * .68], [-r * .68, r * .45]];
    poly(c, plate, o.hit ? '#ffe6b0' : i % 2 ? P.plate : P.light, P.line, 1.2);
    poly(c, [[-r * .66, -r * .48], [0, -r * .8], [0, r * .66], [-r * .66, r * .44]], '#ffffff22');
    poly(c, [[-r * .66, r * .02], [0, -r * .46], [r * .66, r * .02], [r * .66, r * .2], [0, -r * .26], [-r * .66, r * .2]], P.dark);
    line(c, [[-r * .66, r * .02], [0, -r * .46], [r * .66, r * .02]], P.edge, 1.4);
    line(c, [[0, -r * .78], [0, r * .62]], P.dark, 1);
    // Brood ports on both flanks, between that part's leg pair.
    sides(s => { oval(c, s * r * .8, 0, r * .17, r * .25, P.rim); oval(c, s * r * .81, 0, r * .1, r * .16, P.port); });
  });
  // Head: a flower of five toothed petals around a dark maw.
  at(body[0], () => {
    const my = -r * .55, open = step ? 1 + Math.sin(step * .6) * .06 : 1;
    [-1.2, -.6, 0, .6, 1.2].forEach(a => {
      c.save(); c.translate(0, my); c.rotate(a * open);
      const petal = new Path2D(`M${-r * .3} 0 C${-r * .55} ${-r * .5} ${-r * .3} ${-r * 1.05} 0 ${-r * 1.2} C${r * .3} ${-r * 1.05} ${r * .55} ${-r * .5} ${r * .3} 0 Z`);
      c.fillStyle = P.petal; c.fill(petal); c.strokeStyle = P.line; c.lineWidth = 1.1; c.stroke(petal);
      const inner = new Path2D(`M${-r * .16} ${-r * .1} C${-r * .32} ${-r * .5} ${-r * .17} ${-r * .9} 0 ${-r * .98} C${r * .17} ${-r * .9} ${r * .32} ${-r * .5} ${r * .16} ${-r * .1} Z`);
      c.fillStyle = P.petalInner; c.fill(inner);
      c.setLineDash([1.3, 1.5]); c.strokeStyle = P.tooth; c.lineWidth = 1.5; c.stroke(inner); c.setLineDash([]);
      c.restore();
    });
    oval(c, 0, my, r * .42, r * .42, P.maw);
    toothRing(c, 0, my, r * .42, 9, 2.4, P.tooth);
    oval(c, 0, my, r * .17, r * .17, '#25060f');
  });
  c.restore();
}

// ---------------------------------------------------------------- Swimmer
// Keeps: the old swimmer's swept fins and forked tail in rust-coral, a long
// toothed mouth splitting the front of the body, a glowing amber core, and two
// vessels feeding two bladed propellers at the tail corners.
export function drawSwimmerSketch(c, o = {}) {
  const P = { fin: '#d9806a', body: '#b84a45', dark: '#8a2f3a', line: '#3e1418', vein: '#93304c', maw: '#45111f', tooth: '#f4e4c8', lip: '#e39684', core: '#ff9a3a', coreHot: '#ffd98a', vessel: '#6a2242', vesselLight: '#b04462', rim: '#ead0b0', hub: '#d2564a' };
  const wave = o.time ? Math.sin(o.time * 8 + (o.id || 0)) * 2.5 : 0;
  c.strokeStyle = o.sand ? '#e6be7077' : '#a3dcd277'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 10, 26, 13, 0, 0, Math.PI); c.stroke();
  const outline = new Path2D(`M0 -26 C6 -26 9 -18 9 -9 C16 -6 ${26 + wave} 0 ${32 + wave} 8 C26 9 19 9 14 10 C18 14 22 19 24 24 C16 24 8 20 0 16 C-8 20 -16 24 -24 24 C-22 19 -18 14 -14 10 C-19 9 -26 9 ${-32 - wave} 8 C${-26 - wave} 0 -16 -6 -9 -9 C-9 -18 -6 -26 0 -26 Z`);
  c.fillStyle = o.hit ? '#ffc7ae' : P.fin; c.fill(outline);
  c.save(); c.clip(outline);
  c.fillStyle = P.body; c.fill(new Path2D('M0 -26 C6 -26 9 -18 9 -9 C11 0 9 11 0 17 C-9 11 -11 0 -9 -9 C-9 -18 -6 -26 0 -26 Z'));
  sides(s => { line(c, [[s * 9, -5], [s * 18, -1], [s * 27, 6]], P.vein, .8); line(c, [[s * 10, 3], [s * 18, 7]], P.vein, .8); line(c, [[s * 9, 11], [s * 16, 17]], P.vein, .8); });
  c.restore();
  c.strokeStyle = P.line; c.lineWidth = 1.3; c.stroke(outline);
  // The mouth splits the body from the nose back toward the middle.
  c.fillStyle = P.maw; c.beginPath(); c.moveTo(0, -25.5); c.quadraticCurveTo(7, -15, 0, -3); c.quadraticCurveTo(-7, -15, 0, -25.5); c.fill();
  sides(s => { c.strokeStyle = P.lip; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -25.5); c.quadraticCurveTo(s * 7.8, -15, 0, -3); c.stroke(); });
  for (let y = -22.5; y <= -6; y += 3.3) sides(s => {
    const half = Math.max(1, 3.4 * Math.sin(Math.PI * (y + 25.5) / 22.5));
    poly(c, [[s * half, y - 1.3], [s * (half - 2.4), y], [s * half, y + 1.3]], P.tooth);
  });
  // Core and the two vessels feeding the propellers.
  sides(s => {
    const pts = [[s * 2.5, 7], [s * 10, 9], [s * 15, 16.5]];
    line(c, pts, P.vessel, 3.2); line(c, pts, P.vesselLight, 1.3);
  });
  oval(c, 0, 5, 6.2, 6.2, '#f3b08a66'); oval(c, 0, 5, 4.6, 4.6, P.core); oval(c, -.8, 4.2, 2.2, 2.2, P.coreHot);
  // Propellers set into the tail lobes: three pale blades on a dark well.
  const spin = o.time ? o.time * 9 : 0;
  sides(s => {
    const x = s * 16, y = 17.5;
    oval(c, x, y, 4.9, 4.9, '#5a1c2a'); c.strokeStyle = P.rim; c.lineWidth = 1.1; c.stroke();
    for (let b = 0; b < 3; b++) {
      const a = spin * s + b * TAU / 3 + .4;
      c.fillStyle = P.rim; c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a + .55) * 5, y + Math.sin(a + .55) * 5, x + Math.cos(a + 1) * 4.3, y + Math.sin(a + 1) * 4.3);
      c.quadraticCurveTo(x + Math.cos(a + .25) * 2.2, y + Math.sin(a + .25) * 2.2, x, y); c.fill();
    }
    oval(c, x, y, 1.4, 1.4, P.hub);
  });
}
