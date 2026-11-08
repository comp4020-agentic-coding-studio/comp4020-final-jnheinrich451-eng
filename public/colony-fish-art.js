// Illustrated alien fish for the catch card, the catch list and the reel meter.
// Presentation only: the genome from colony-fish.js decides every feature and this
// paints it in profile with the colony's clean shapes, soft banded shading, a light
// belly and an outline in the accent colour. The flying-fish glider with sail
// streamers, a hanging pectoral and a forked tail follows the author's sketch; the
// other bodies, fins, tails and eyes recombine on the same skeleton so every
// combination reads as one friendly species. No offscreen canvases, no randomness:
// the seed places spots, and `time` only moves anything while `swim` is set.

const TAU = Math.PI * 2;

/**
 * @typedef {{ body: string, belly: string, fin: string, accent: string, glow: string }} FishColors
 * @typedef {{ body?: string, fins?: string, tail?: string, eyes?: string, pattern?: string, glow?: boolean,
 *   colors?: Partial<FishColors>, stretch?: number, finScale?: number, marks?: number, eyeSize?: number, seed?: string }} FishLook
 * @typedef {{ nose: number, ped: number, top: number, bottom: number, peak: number, blunt: number, back: number, waist: number,
 *   tail: number, fins: number, eyeU: number, eye: number, sailU: number, reach: number, wave: number,
 *   dorsal: [number, number], anal: [number, number], frill: number, spine: number }} BodyPlan
 */

// Body plans in fish units: nose-to-tail is about 1, nose toward +x, y down. `ped` is
// where the tail joins, `peak` the deepest point (0 nose, 1 tail join), `blunt` the
// nose curve (below 1 rounds it), `back` the curve behind the peak (below 1 keeps it
// round), `waist` the tail-join depth as a share of the peak.
/** @type {Readonly<Record<string, BodyPlan>>} */
const BODIES = Object.freeze({
  glider: { nose: .5, ped: -.25, top: .092, bottom: .086, peak: .34, blunt: .6, back: 1.25, waist: .27, tail: .24, fins: 1, eyeU: .1, eye: .027, sailU: .33, reach: 1, wave: 0, dorsal: [.3, .82], anal: [.64, .9], frill: .075, spine: .14 },
  darter: { nose: .5, ped: -.15, top: .11, bottom: .1, peak: .44, blunt: 1.25, back: 1.2, waist: .25, tail: .3, fins: .9, eyeU: .15, eye: .03, sailU: .36, reach: .82, wave: 0, dorsal: [.32, .8], anal: [.62, .88], frill: .08, spine: .13 },
  // Disc: tall and laterally flat with a small snout, like an angelfish.
  disc: { nose: .31, ped: -.15, top: .3, bottom: .28, peak: .5, blunt: .56, back: .62, waist: .12, tail: .27, fins: .84, eyeU: .17, eye: .034, sailU: .3, reach: .72, wave: 0, dorsal: [.2, .88], anal: [.46, .9], frill: .12, spine: .15 },
  // Puff: a round inflatable ball with soft nubs, small fins and a stubby tail.
  puff: { nose: .3, ped: -.2, top: .235, bottom: .25, peak: .52, blunt: .42, back: .5, waist: .2, tail: .17, fins: .66, eyeU: .2, eye: .046, sailU: .34, reach: .6, wave: 0, dorsal: [.34, .7], anal: [.58, .8], frill: .07, spine: .09 },
  ribbon: { nose: .5, ped: -.42, top: .058, bottom: .052, peak: .1, blunt: .7, back: 1.2, waist: .36, tail: .1, fins: .8, eyeU: .045, eye: .022, sailU: .13, reach: .55, wave: .05, dorsal: [.12, .97], anal: [.42, .98], frill: .055, spine: .08 },
});
const DEFAULT_COLORS = Object.freeze({ body: '#aab8bf', belly: '#f1f4f2', fin: '#cfdbe0', accent: '#56656e', glow: '#c8fff0' });

/** @type {Map<string, number[]>} */
const parsed = new Map();
/** @param {string} hex @returns {number[]} */
function rgbOf(hex) {
  let value = parsed.get(hex);
  if (!value) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    const n = match ? parseInt(match[1], 16) : 0x9aa5a8;
    value = [n >> 16 & 255, n >> 8 & 255, n & 255];
    if (parsed.size < 512) parsed.set(hex, value);
  }
  return value;
}
/** Hex colour between a and b. @param {string} a @param {string} b @param {number} t */
const mix = (a, b, t) => {
  const p = rgbOf(a), q = rgbOf(b);
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
/** @param {string} hex @param {number} alpha */
const fade = (hex, alpha) => { const p = rgbOf(hex); return `rgba(${p[0]},${p[1]},${p[2]},${alpha})`; };
/** FNV-1a of the seed, so spots sit in the same places for the same fish. @param {string} text */
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** @param {number} v */
const frac = v => v - Math.floor(v);
/** @param {unknown} v */
const share = v => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .5;

/**
 * Draws one alien fish in profile, centred at x,y with the nose toward +x (or -x when
 * flipped). `length` is the nose-to-tail length in the canvas's current units; fine
 * detail (fin rays, gills, highlights) drops away below about 90 and 40 device pixels
 * so the same call reads on a catch card, in a list and as a meter icon.
 * @param {CanvasRenderingContext2D} c
 * @param {FishLook} genome
 * @param {number} x
 * @param {number} y
 * @param {number} length
 * @param {number} [time] seconds; only used while swimming
 * @param {{ swim?: boolean, flip?: boolean }} [options]
 */
export function drawAlienFish(c, genome, x, y, length, time = 0, options = {}) {
  if (!c || !genome || !Number.isFinite(x) || !Number.isFinite(y) || !(length > 0)) return;
  const plan = BODIES[genome.body || 'glider'] || BODIES.glider;
  const isRibbon = plan === BODIES.ribbon, isRound = plan === BODIES.disc || plan === BODIES.puff;
  const col = { ...DEFAULT_COLORS, ...(genome.colors || {}) };
  const stretch = share(genome.stretch), finScale = share(genome.finScale), marks = share(genome.marks), eyeSize = share(genome.eyeSize);
  const swim = !!options.swim && Number.isFinite(time), phase = swim ? time * 5 : 0;
  const matrix = typeof c.getTransform === 'function' ? c.getTransform() : null;
  const pixels = (matrix ? Math.hypot(matrix.a, matrix.b) : 1) * length;
  const detail = pixels >= 90 ? 2 : pixels >= 40 ? 1 : 0;
  const lw = Math.max(.0062, (detail ? 1.15 : 1) / pixels);
  const depthScale = isRound ? 1.06 - .12 * stretch : 1.13 - .26 * stretch;
  const FS = (.86 + .3 * finScale) * plan.fins;
  const fin = col.fin, edge = col.accent, ink = mix(col.accent, '#18222b', .35), glow = !!genome.glow;
  const seed = hash(String(genome.seed || `${genome.body}${genome.fins}${genome.tail}`));

  // Sample the body along its length; samples crowd toward the nose so its curve stays round.
  const N = 30;
  /** @type {number[]} */ const us = [];
  /** @type {number[]} */ const xs = [];
  /** @type {number[]} */ const cs = [];
  /** @type {number[]} */ const tops = [];
  /** @type {number[]} */ const bots = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), u = Math.pow(t, 1.3);
    const s = u < plan.peak ? Math.pow(Math.sin(Math.PI / 2 * u / plan.peak), plan.blunt)
      : plan.waist + (1 - plan.waist) * Math.pow(Math.cos(Math.PI / 2 * (u - plan.peak) / (1 - plan.peak)), plan.back);
    let centre = 0;
    if (plan.wave) centre += plan.wave * Math.sin(u * TAU * 1.2 + .4 - phase * .8) * (.3 + .7 * u);
    if (swim) centre += .018 * Math.sin(phase - u * 3.4) * u * u;
    us.push(u); xs.push(plan.nose + (plan.ped - plan.nose) * u); cs.push(centre);
    tops.push(plan.top * depthScale * s); bots.push(plan.bottom * depthScale * s);
  }
  /** Interpolated body section at u (0 nose, 1 tail join). @param {number} u */
  const at = u => {
    let i = 0;
    while (i < N - 2 && us[i + 1] < u) i++;
    const k = Math.max(0, Math.min(1, (u - us[i]) / (us[i + 1] - us[i])));
    const l = (/** @type {number[]} */ a) => a[i] + (a[i + 1] - a[i]) * k;
    return { x: l(xs), c: l(cs), top: l(tops), bot: l(bots) };
  };
  /** A point on the flank: v -1 is the back, 0 the centre line, 1 the belly. @param {number} u @param {number} v */
  const flank = (u, v) => { const b = at(u); return [b.x, b.c + (v < 0 ? v * b.top : v * b.bot)]; };
  /** Smooth closed path through a ring of points (midpoint quadratics). @param {number[][]} ring */
  const smooth = ring => {
    const path = new Path2D(), n = ring.length;
    const mid = (/** @type {number} */ a, /** @type {number} */ b) => [(ring[a][0] + ring[b][0]) / 2, (ring[a][1] + ring[b][1]) / 2];
    const start = mid(n - 1, 0); path.moveTo(start[0], start[1]);
    for (let k = 0; k < n; k++) { const m = mid(k, (k + 1) % n); path.quadraticCurveTo(ring[k][0], ring[k][1], m[0], m[1]); }
    path.closePath(); return path;
  };
  /** Region between two flank lines v0 above v1, across the whole body. @param {number} v0 @param {number} v1 */
  const band = (v0, v1) => {
    const path = new Path2D();
    for (let i = 0; i < N; i++) { const y = cs[i] + (v0 < 0 ? v0 * tops[i] : v0 * bots[i]); i ? path.lineTo(xs[i], y) : path.moveTo(xs[i], y); }
    for (let i = N - 1; i >= 0; i--) path.lineTo(xs[i], cs[i] + (v1 < 0 ? v1 * tops[i] : v1 * bots[i]));
    path.closePath(); return path;
  };
  const ring = [[xs[0], cs[0]]];
  for (let i = 1; i < N; i++) ring.push([xs[i], cs[i] - tops[i]]);
  for (let i = N - 1; i > 0; i--) ring.push([xs[i], cs[i] + bots[i]]);
  const bodyPath = smooth(ring);

  /** @param {Path2D} path @param {number} [alpha] @param {string} [fill] */
  const paint = (path, alpha = .94, fill = fin) => {
    c.globalAlpha = alpha; c.fillStyle = fill; c.fill(path); c.globalAlpha = 1;
    c.strokeStyle = edge; c.lineWidth = lw * .85; c.stroke(path);
  };
  /** Fin rays from one root, shown on the card only. @param {number[]} from @param {number[][]} points @param {number} [alpha] @param {number} [min] */
  const rays = (from, points, alpha = .32, min = 2) => {
    if (detail < min) return;
    c.beginPath(); for (const p of points) { c.moveTo(from[0], from[1]); c.lineTo(p[0], p[1]); }
    c.strokeStyle = fade(edge, alpha); c.lineWidth = lw * .55; c.stroke();
  };
  /** A luminous point: soft halo and bright core. @param {number} px @param {number} py @param {number} r */
  const lamp = (px, py, r) => {
    c.beginPath(); c.arc(px, py, r * 2.4, 0, TAU); c.fillStyle = fade(col.glow, .28); c.fill();
    c.beginPath(); c.arc(px, py, r, 0, TAU); c.fillStyle = col.glow; c.fill();
    if (detail) { c.beginPath(); c.arc(px, py, r * .45, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
  };

  c.save();
  c.translate(x, y); c.scale(options.flip ? -length : length, length);
  c.lineJoin = 'round'; c.lineCap = 'round';

  if (glow) {
    // A soft halo in the world's glow colour, wider than tall like the fish.
    c.save(); c.scale(1, isRound ? .85 : .62);
    const halo = c.createRadialGradient(0, 0, .04, 0, 0, .62);
    halo.addColorStop(0, fade(col.glow, .5)); halo.addColorStop(.55, fade(col.glow, .18)); halo.addColorStop(1, fade(col.glow, 0));
    c.fillStyle = halo; c.beginPath(); c.arc(0, 0, .62, 0, TAU); c.fill(); c.restore();
  }

  // ---- Far side and fins rooted behind the body ----
  const finKind = genome.fins || 'sail';
  if (finKind === 'wing') farWing();
  if (genome.eyes === 'stalk') stalkEye(true);
  if (finKind === 'sail') sails();
  else if (finKind === 'frill') { frillFin(plan.dorsal[0], plan.dorsal[1], plan.frill * FS, -1); frillFin(plan.anal[0], plan.anal[1], plan.frill * .7 * FS, 1); }
  else if (finKind === 'spine') { spineFin(plan.dorsal[0], plan.dorsal[0] + (plan.dorsal[1] - plan.dorsal[0]) * .7, plan.spine * FS, -1, 5 + Math.round(marks * 2)); spineFin(plan.anal[0] + .06, plan.anal[1], plan.spine * .45 * FS, 1, 3); }
  else smallDorsal();
  if (!isRibbon) pelvic();
  if (finKind === 'sail' || finKind === 'wing') { if (!isRound && !isRibbon) analFin(); }
  if (genome.body === 'puff' && detail) nubs();
  tail(genome.tail || 'fork');

  // ---- Body ----
  c.fillStyle = col.body; c.fill(bodyPath);
  c.save(); c.clip(bodyPath);
  const shade = mix(col.body, col.accent, .3), belly = col.belly;
  const H = plan.top * depthScale, B = plan.bottom * depthScale;
  if (isRibbon) {
    // The ribbon's wave would carry a straight gradient off its body: shade in bands.
    c.fillStyle = fade(shade, .5); c.fill(band(-1.05, -.42));
    c.fillStyle = fade(shade, .55); c.fill(band(-1.05, -.74));
  } else {
    const top = c.createLinearGradient(0, -H, 0, -H * .2);
    top.addColorStop(0, fade(shade, .9)); top.addColorStop(.45, fade(shade, .45)); top.addColorStop(1, fade(shade, 0));
    c.fillStyle = top; c.fillRect(-.6, -H - .05, 1.2, H * .85 + .05);
  }
  pattern(genome.pattern || 'plain');
  if (isRibbon) {
    c.fillStyle = fade(mix(col.body, belly, .55), .7); c.fill(band(.02, 1.05));
    c.fillStyle = belly; c.fill(band(.3, 1.05));
  } else {
    const under = c.createLinearGradient(0, -B * .12, 0, B * .55);
    under.addColorStop(0, fade(belly, 0)); under.addColorStop(.55, fade(belly, .8)); under.addColorStop(1, fade(belly, 1));
    c.fillStyle = under; c.fillRect(-.6, -B * .12, 1.2, B * 1.3);
  }
  if (detail === 2) {
    // A soft sheen along the upper flank, where the sun catches it.
    c.beginPath();
    for (let u = .06; u <= .72; u += .03) { const p = flank(u, -.62); u === .06 ? c.moveTo(p[0], p[1]) : c.lineTo(p[0], p[1]); }
    c.strokeStyle = 'rgba(255,255,250,.3)'; c.lineWidth = Math.max(lw, (isRound ? .03 : .014) * depthScale); c.stroke();
  }
  c.restore();
  c.strokeStyle = edge; c.lineWidth = lw * 1.1; c.stroke(bodyPath);

  // ---- Face ----
  if (detail) {
    const g = at(plan.eyeU + (isRound ? .13 : .1));
    c.beginPath(); c.moveTo(g.x + .004, g.c - g.top * .55);
    c.quadraticCurveTo(g.x - (isRound ? .05 : .03), g.c, g.x + .002, g.c + g.bot * .6);
    c.strokeStyle = fade(edge, .5); c.lineWidth = lw * .85; c.stroke();
    // A small upturned mouth near the nose: friendly, never a gape.
    const m = at(isRound ? .05 : .03), mx = m.x - (isRound ? .012 : 0);
    c.beginPath(); c.moveTo(mx + .002, m.c + m.bot * .3);
    c.quadraticCurveTo(mx - .018, m.c + m.bot * .62, mx - .036, m.c + m.bot * .26);
    c.strokeStyle = ink; c.lineWidth = lw * .8; c.stroke();
  }
  eyes(genome.eyes || 'pair');

  // ---- Near-side fins over the body ----
  if (finKind === 'sail') hangingPectoral();
  else if (finKind === 'frill') frillPectoral();
  else if (finKind === 'spine') spinePectoral();
  else nearWing();

  if (glow) {
    // Photophores along the lower flank.
    const count = 5 + Math.round(marks * 3);
    for (let k = 0; k < count; k++) { const p = flank(.22 + k * (.6 / (count - 1)), .5); lamp(p[0], p[1], Math.max(.007, .75 / pixels) + .004 * (isRound ? 1.4 : 1)); }
  }
  c.restore();

  // ---------------------------------------------------------------------------
  function sails() {
    // Long swept-back streamers rising from the back, the front one tallest; they
    // trail past the body above the tail like the sketch's flying fish.
    const count = 2 + (finScale > .42 ? 1 : 0);
    for (let i = count - 1; i >= 0; i--) {
      const u = plan.sailU + i * (isRibbon ? .09 : .12);
      const b = at(u), bx = b.x, by = b.c - b.top + .014 * depthScale;
      const h = (.2 - .034 * i) * FS * (isRibbon ? .7 : 1), wb = .026 * FS + .006;
      const tipX = Math.max(-.53, bx - (.56 - .1 * i) * FS * plan.reach);
      const tipY = by - h + (swim ? .012 * Math.sin(phase * .6 + i * 1.3) : 0);
      const path = new Path2D();
      path.moveTo(bx + wb, by);
      path.quadraticCurveTo(bx + wb * .2, tipY + h * .08, tipX, tipY);
      path.quadraticCurveTo(bx - wb - .03 * FS, tipY + h * .6, bx - wb, by);
      path.closePath();
      paint(path, .95, i ? mix(fin, col.accent, .1 * i) : fin);
      if (detail) {
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - .004, tipY + h * .3, tipX, tipY);
        c.strokeStyle = fade(edge, .45); c.lineWidth = lw * .65; c.stroke();
      }
      if (glow) lamp(tipX, tipY, Math.max(.006, .7 / pixels));
    }
  }
  function hangingPectoral() {
    // One big pectoral hanging down and back below the chest.
    const b = at(plan.eyeU + (isRound ? .17 : .13));
    const bx = b.x, by = b.c + b.bot * .18, L = (isRound ? .27 : .33) * FS, D = (isRound ? .2 : .23) * FS;
    c.save(); c.translate(bx, by); if (swim) c.rotate(.07 * Math.sin(phase * .7 + 1));
    const path = new Path2D();
    path.moveTo(.022, -.014);
    path.quadraticCurveTo(-.01, D * .72, -L, D);
    path.quadraticCurveTo(-L * .5, D * .4, -.07, .012);
    path.closePath();
    paint(path, .9);
    rays([0, 0], [[-L * .32, D * .66], [-L * .56, D * .82], [-L * .8, D * .93]], .38, 1);
    c.restore();
  }
  function farWing() {
    // The far wing of a pair, spread up and back behind the body.
    const b = at(plan.eyeU + .16), bx = b.x, by = b.c - b.top * .3;
    const L = (isRound ? .3 : .42) * FS, H = (isRound ? .3 : .2) * FS;
    c.save(); c.translate(bx, by); if (swim) c.rotate(-.06 * Math.sin(phase * .9));
    const path = new Path2D();
    path.moveTo(.02, 0);
    path.quadraticCurveTo(-L * .25, -H * 1.05, -L, -H * .85);
    path.quadraticCurveTo(-L * .75, -H * .45, -L * .8, -H * .2);
    path.quadraticCurveTo(-L * .45, -H * .2, -.06, .01);
    path.closePath();
    paint(path, .5, mix(fin, col.accent, .25));
    rays([0, 0], [[-L * .45, -H * .9], [-L * .75, -H * .88], [-L * .95, -H * .7]], .4, 1);
    c.restore();
  }
  function nearWing() {
    // Broad translucent near wing sweeping back and down; the body shows through it.
    const b = at(plan.eyeU + .15), bx = b.x, by = b.c + b.bot * .1;
    const L = (isRound ? .32 : .46) * FS, D = (isRound ? .2 : .15) * FS;
    c.save(); c.translate(bx, by); if (swim) c.rotate(.07 * Math.sin(phase * .9));
    const path = new Path2D();
    path.moveTo(.025, -.02);
    path.quadraticCurveTo(-L * .3, -D * .55, -L, D * .25);
    // A scalloped trailing edge between the rays.
    path.quadraticCurveTo(-L * .9, D * .75, -L * .74, D * .82);
    path.quadraticCurveTo(-L * .62, D * 1.08, -L * .46, D * .9);
    path.quadraticCurveTo(-L * .32, D * 1.05, -L * .2, D * .62);
    path.quadraticCurveTo(-.06, D * .4, -.05, .015);
    path.closePath();
    paint(path, .55);
    rays([0, 0], [[-L, D * .25], [-L * .74, D * .82], [-L * .46, D * .9], [-L * .2, D * .62]], .45, 1);
    c.restore();
    // A small second pair further back, as four-winged flying fish have.
    if (!isRound && !isRibbon) {
      const r = at(.62), rx = r.x, ry = r.c + r.bot * .85, l = .16 * FS;
      const back = new Path2D();
      back.moveTo(rx + .015, ry); back.quadraticCurveTo(rx - l * .4, ry + l * .1, rx - l, ry + l * .45);
      back.quadraticCurveTo(rx - l * .5, ry + l * .45, rx - .03, ry + .004); back.closePath();
      paint(back, .55);
    }
  }
  function smallDorsal() {
    const b = at((plan.dorsal[0] + plan.dorsal[1]) / 2), bx = b.x, by = b.c - b.top + .01;
    const h = plan.frill * FS * .9, path = new Path2D();
    path.moveTo(bx + .05, by); path.quadraticCurveTo(bx + .01, by - h * 1.1, bx - .06, by - h * .9);
    path.quadraticCurveTo(bx - .05, by - h * .3, bx - .07, by + .004); path.closePath();
    paint(path, .92);
  }
  /** Continuous soft fin with a scalloped outer edge. @param {number} u0 @param {number} u1 @param {number} height @param {number} side -1 back, 1 belly */
  function frillFin(u0, u1, height, side) {
    const scallops = Math.max(4, Math.round((u1 - u0) * (isRibbon ? 16 : 11)));
    const base = (/** @type {number} */ t) => flank(u0 + (u1 - u0) * t, side * .9);
    const outer = (/** @type {number} */ t) => {
      const p = base(t), h = height * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), .55) * (swim ? 1 + .08 * Math.sin(phase * 1.2 - t * 6) : 1);
      return [p[0] - h * .3, p[1] + side * h];
    };
    const path = new Path2D(), start = base(0);
    path.moveTo(start[0], start[1]);
    let prev = outer(0);
    path.lineTo(prev[0], prev[1]);
    for (let k = 1; k <= scallops; k++) {
      const next = outer(k / scallops), mx = (prev[0] + next[0]) / 2, my = (prev[1] + next[1]) / 2;
      const len = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
      path.quadraticCurveTo(mx - len * .1, my + side * len * .55, next[0], next[1]);
      prev = next;
    }
    for (let k = 12; k >= 0; k--) { const p = base(k / 12); path.lineTo(p[0], p[1] - side * .012); }
    path.closePath();
    paint(path, .92);
    if (detail === 2) {
      /** @type {number[][]} */ const roots = [];
      /** @type {number[][]} */ const tips = [];
      for (let k = 1; k < scallops; k++) { roots.push(base(k / scallops)); tips.push(outer(k / scallops)); }
      c.beginPath(); roots.forEach((r, k) => { c.moveTo(r[0], r[1]); c.lineTo(tips[k][0], tips[k][1]); });
      c.strokeStyle = fade(edge, .3); c.lineWidth = lw * .55; c.stroke();
    }
  }
  function frillPectoral() {
    const b = at(plan.eyeU + (isRound ? .15 : .12)), bx = b.x, by = b.c + b.bot * .15, r = (isRound ? .12 : .1) * FS;
    c.save(); c.translate(bx, by); if (swim) c.rotate(.12 * Math.sin(phase * 1.1));
    const path = new Path2D(), from = 2.05, to = 3.25, steps = 5;
    path.moveTo(.012, -.01);
    let prev = [Math.cos(from) * r, Math.sin(from) * r * 1.1];
    path.lineTo(prev[0], prev[1]);
    for (let k = 1; k <= steps; k++) {
      const a = from + (to - from) * k / steps, next = [Math.cos(a) * r, Math.sin(a) * r * 1.1];
      const am = from + (to - from) * (k - .5) / steps;
      path.quadraticCurveTo(Math.cos(am) * r * 1.22, Math.sin(am) * r * 1.3, next[0], next[1]);
      prev = next;
    }
    path.closePath(); paint(path, .9);
    rays([0, 0], [2.3, 2.6, 2.9].map(a => [Math.cos(a) * r * .95, Math.sin(a) * r]), .35);
    c.restore();
  }
  /** A row of slender spines joined by a dipping membrane. @param {number} u0 @param {number} u1 @param {number} height @param {number} side @param {number} count */
  function spineFin(u0, u1, height, side, count) {
    const roots = [], tips = [];
    for (let k = 0; k < count; k++) {
      const t = count === 1 ? 0 : k / (count - 1), p = flank(u0 + (u1 - u0) * t, side * .85);
      const h = height * (k === 0 ? .82 : 1 - .5 * t) * (swim ? 1 + .05 * Math.sin(phase + k) : 1);
      roots.push(p); tips.push([p[0] - h * .34, p[1] + side * h]);
    }
    const path = new Path2D();
    path.moveTo(roots[0][0], roots[0][1]); path.lineTo(tips[0][0], tips[0][1]);
    for (let k = 1; k < count; k++) {
      const a = tips[k - 1], b = tips[k], dip = (Math.abs(a[1] - roots[k - 1][1]) + Math.abs(b[1] - roots[k][1])) * .2;
      path.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - side * dip, b[0], b[1]);
    }
    const last = roots[count - 1];
    path.quadraticCurveTo(last[0] - .02, last[1] + side * .01, last[0] - .05, last[1]);
    for (let k = count - 1; k >= 0; k--) path.lineTo(roots[k][0], roots[k][1] - side * .012);
    path.closePath();
    c.globalAlpha = .72; c.fillStyle = fin; c.fill(path); c.globalAlpha = 1;
    c.beginPath(); for (let k = 0; k < count; k++) { c.moveTo(roots[k][0], roots[k][1]); c.lineTo(tips[k][0], tips[k][1]); }
    c.strokeStyle = edge; c.lineWidth = Math.max(lw * 1.1, .009); c.stroke();
    if (detail) for (const t of tips) { c.beginPath(); c.arc(t[0], t[1], Math.max(lw * 1.2, .008), 0, TAU); c.fillStyle = glow ? col.glow : mix(fin, '#ffffff', .4); c.fill(); }
  }
  function spinePectoral() {
    const b = at(plan.eyeU + (isRound ? .15 : .12)), bx = b.x, by = b.c + b.bot * .15, r = (isRound ? .13 : .11) * FS;
    c.save(); c.translate(bx, by); if (swim) c.rotate(.1 * Math.sin(phase * 1.1));
    const angles = [2.15, 2.5, 2.85, 3.15], tips = angles.map(a => [Math.cos(a) * r, Math.sin(a) * r]);
    const path = new Path2D(); path.moveTo(.01, -.008);
    tips.forEach((t, k) => k ? path.quadraticCurveTo((t[0] + tips[k - 1][0]) / 2 * .78, (t[1] + tips[k - 1][1]) / 2 * .78, t[0], t[1]) : path.lineTo(t[0] * .8, t[1] * .8));
    path.closePath();
    c.globalAlpha = .78; c.fillStyle = fin; c.fill(path); c.globalAlpha = 1;
    c.beginPath(); for (const t of tips) { c.moveTo(0, 0); c.lineTo(t[0], t[1]); }
    c.strokeStyle = edge; c.lineWidth = Math.max(lw, .008); c.stroke();
    c.restore();
  }
  function pelvic() {
    const p = flank(isRound ? .58 : .5, .9), l = (isRound ? .08 : .07) * FS, path = new Path2D();
    path.moveTo(p[0] + .015, p[1] - .008); path.quadraticCurveTo(p[0] - l * .2, p[1] + l * .6, p[0] - l, p[1] + l * .7);
    path.quadraticCurveTo(p[0] - l * .6, p[1] + l * .2, p[0] - .03, p[1] - .006); path.closePath();
    paint(path, .9);
  }
  function analFin() {
    const p = flank(.8, .9), l = .07 * FS, path = new Path2D();
    path.moveTo(p[0] + .03, p[1] - .006); path.quadraticCurveTo(p[0], p[1] + l * .7, p[0] - l, p[1] + l * .6);
    path.quadraticCurveTo(p[0] - l * .6, p[1] + l * .1, p[0] - .045, p[1] - .006); path.closePath();
    paint(path, .9);
  }
  function nubs() {
    // Soft rounded nubs peeking out round the puff's outline, never sharp.
    const path = new Path2D();
    for (let k = 0; k < 8; k++) {
      for (const side of [-1, 1]) {
        const u = .16 + k * .09 + (side > 0 ? .045 : 0), b = at(u);
        if (side < 0 && u > plan.dorsal[0] - .04 && u < plan.dorsal[1] + .04 && finKind !== 'wing') continue;
        const r = (side < 0 ? b.top : b.bot), y0 = b.c + side * r * .82, y1 = b.c + side * (r + .03);
        path.moveTo(b.x + .02, y0); path.quadraticCurveTo(b.x + .006, y1, b.x - .004, y1);
        path.quadraticCurveTo(b.x - .014, y1, b.x - .02, y0); path.closePath();
      }
    }
    paint(path, 1, mix(col.body, col.fin, .5));
  }
  /** @param {string} kind */
  function tail(kind) {
    const i = N - 1, j = N - 4, w0 = (tops[i] + bots[i]) / 2;
    const angle = Math.atan2(cs[i] - cs[j], xs[i] - xs[j]) - Math.PI;
    const T = plan.tail * (.9 + .2 * finScale);
    c.save(); c.translate(xs[i] + .012, cs[i] + (bots[i] - tops[i]) / 2); c.rotate(angle);
    if (swim) { c.rotate(.09 * Math.sin(phase - 1.4)); c.scale(.86 + .14 * Math.cos(phase - 1.4), 1); }
    if (kind === 'fan') fan(T, Math.max(w0, T * .1), T * .55, 0);
    else if (kind === 'twin') {
      for (const s of [-1, 1]) { c.save(); c.rotate(s * .45); fan(T * .82, Math.max(w0 * .6, T * .07), T * .3, s); c.restore(); }
    } else if (kind === 'whip') {
      // A short fork and one long thin filament ending in a small bead.
      const t = T * .55, path = new Path2D();
      path.moveTo(.01, -w0); path.quadraticCurveTo(-t * .5, -w0 - t * .2, -t, -t * .55);
      path.quadraticCurveTo(-t * .7, 0, -t, t * .55); path.quadraticCurveTo(-t * .5, w0 + t * .2, .01, w0); path.closePath();
      paint(path, .94);
      const reach = Math.max(.12, .57 + xs[i]), wag = swim ? Math.sin(phase * .8) * .03 : 0;
      c.beginPath(); c.moveTo(-t * .5, 0);
      c.bezierCurveTo(-reach * .45, .05 + wag, -reach * .7, -.05 - wag, -reach, .02 + wag * 1.5);
      c.strokeStyle = edge; c.lineWidth = Math.max(lw * 1.4, .011); c.stroke();
      c.strokeStyle = fin; c.lineWidth = Math.max(lw * .6, .005); c.stroke();
      if (glow) lamp(-reach, .02 + wag * 1.5, Math.max(.007, .8 / pixels));
      else { c.beginPath(); c.arc(-reach, .02 + wag * 1.5, Math.max(.012, 1 / pixels), 0, TAU); c.fillStyle = fin; c.fill(); c.strokeStyle = edge; c.lineWidth = lw * .8; c.stroke(); }
    } else {
      // Fork: two swept lobes with a deep V between them.
      const path = new Path2D();
      path.moveTo(.01, -w0);
      path.quadraticCurveTo(-T * .45, -w0 - T * .12, -T, -T * .64);
      path.quadraticCurveTo(-T * .66, -T * .22, -T * .4, 0);
      path.quadraticCurveTo(-T * .66, T * .22, -T * .95, T * .58);
      path.quadraticCurveTo(-T * .45, w0 + T * .12, .01, w0);
      path.closePath();
      paint(path, .94);
      rays([0, 0], [[-T * .88, -T * .55], [-T * .6, -T * .28], [-T * .6, T * .26], [-T * .84, T * .5]]);
    }
    c.restore();
  }
  /** Rounded fan tail along -x. @param {number} T @param {number} w0 @param {number} half @param {number} tilt */
  function fan(T, w0, half, tilt) {
    const path = new Path2D(), steps = detail ? 5 : 3;
    const edgePoint = (/** @type {number} */ a) => [-T * .55 - Math.cos(a) * T * .45, Math.sin(a) * half * 1.05];
    path.moveTo(.01, -w0);
    const first = edgePoint(-1.35);
    path.quadraticCurveTo(-T * .3, -w0 - half * .2, first[0], first[1]);
    for (let k = 1; k <= steps; k++) {
      const a = -1.35 + 2.7 * k / steps, am = -1.35 + 2.7 * (k - .5) / steps, p = edgePoint(a);
      const bulge = detail ? 1.1 : 1.04, q = [-T * .55 - Math.cos(am) * T * .45 * bulge, Math.sin(am) * half * 1.05 * bulge];
      path.quadraticCurveTo(q[0], q[1], p[0], p[1]);
    }
    path.quadraticCurveTo(-T * .3, w0 + half * .2, .01, w0);
    path.closePath();
    paint(path, .94, tilt ? mix(fin, col.accent, tilt < 0 ? 0 : .08) : fin);
    rays([0, 0], [-.9, -.3, .3, .9].map(a => edgePoint(a)));
  }
  /** @param {string} pattern */
  function pattern(pattern) {
    const accent = col.accent;
    if (pattern === 'stripes') {
      const count = 3 + Math.round(marks * 3), width = (isRound ? .045 : .03) * (.8 + .4 * marks);
      c.fillStyle = fade(accent, .5);
      for (let k = 0; k < count; k++) {
        const u = .2 + k * ((isRibbon ? .74 : .64) / Math.max(1, count - 1)), b = at(u), lean = isRound ? .02 : .028;
        const y0 = b.c - b.top - .02, y1 = b.c + b.bot + .02;
        c.beginPath(); c.moveTo(b.x + width / 2, y0); c.lineTo(b.x - width / 2, y0); c.lineTo(b.x - width / 2 - lean, y1); c.lineTo(b.x + width / 2 - lean, y1); c.closePath(); c.fill();
      }
    } else if (pattern === 'spots') {
      const count = 5 + Math.round(marks * 8), size = isRound ? 1.7 : isRibbon ? .7 : 1;
      c.fillStyle = fade(accent, .55);
      for (let k = 0; k < count; k++) {
        const u = .16 + .74 * frac(k * .618 + (seed % 97) / 97), v = -.85 + .95 * frac(k * .382 + (seed % 89) / 89);
        const r = (.009 + .013 * frac(k * .713 + (seed % 83) / 83)) * size, p = flank(u, v);
        c.beginPath(); c.arc(p[0], p[1], Math.max(r, .9 / pixels), 0, TAU); c.fill();
      }
    } else if (pattern === 'glowline') {
      // A lateral line of small lights from the gill to the tail.
      const tone = glow ? col.glow : mix(accent, col.fin, .2);
      c.beginPath();
      for (let k = 0; k <= 24; k++) { const p = flank(.18 + k * .033, -.12); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
      if (glow) { c.strokeStyle = fade(col.glow, .35); c.lineWidth = Math.max(.03 * depthScale, 2.4 / pixels); c.stroke(); }
      c.strokeStyle = tone; c.lineWidth = Math.max(.01, 1 / pixels); c.stroke();
      if (detail) for (let k = 0; k < 9; k++) { const p = flank(.22 + k * .085, -.12); c.beginPath(); c.arc(p[0], p[1], .011, 0, TAU); c.fillStyle = glow ? '#ffffff' : accent; c.fill(); }
    } else if (detail === 2) {
      // Plain fish keep a faint scale texture on the card.
      c.strokeStyle = fade(accent, .14); c.lineWidth = lw * .6;
      for (let u = .26; u < .9; u += .07) for (let v = -.6; v <= .2; v += .4) {
        const p = flank(u + (v > -.3 ? .035 : 0), v), r = .022 * (isRound ? 1.8 : 1);
        c.beginPath(); c.arc(p[0] + r, p[1], r, Math.PI * .65, Math.PI * 1.35); c.stroke();
      }
    }
  }
  /** @param {string} kind */
  function eyes(kind) {
    const base = plan.eye * (.85 + .4 * eyeSize), min = 1.1 / pixels;
    if (kind === 'single') {
      const p = flank(plan.eyeU + .045, -.28); eye(p[0], p[1], Math.max(base * 1.55, min * 1.3));
    } else if (kind === 'triple') {
      // Three in a gentle arc along the head, largest in front.
      [0, 1, 2].forEach(k => { const p = flank(plan.eyeU + k * (isRound ? .1 : .065) - .005, -.26 - (k === 1 ? .14 : 0)); eye(p[0], p[1], Math.max(base * (.98 - k * .1), min)); });
    } else if (kind === 'stalk') stalkEye(false);
    else { const p = flank(plan.eyeU, -.24); eye(p[0], p[1], Math.max(base, min)); }
  }
  /** Eyes on short stalks above the head; the far one is drawn behind the body. @param {boolean} far */
  function stalkEye(far) {
    const b = at(plan.eyeU + (far ? .07 : .02)), bx = b.x, by = b.c - b.top * .8;
    const h = (isRound ? .1 : .085) * (far ? .85 : 1) * (.9 + .3 * eyeSize), lean = far ? -.01 : .025;
    const sway = swim ? Math.sin(phase * .7 + (far ? 1 : 0)) * .008 : 0;
    const top = [bx + lean + sway, by - h];
    c.beginPath(); c.moveTo(bx, by + .01); c.quadraticCurveTo(bx + lean * .2, by - h * .5, top[0], top[1]);
    c.strokeStyle = edge; c.lineWidth = Math.max(.02, 2 / pixels); c.stroke();
    c.strokeStyle = far ? mix(fin, col.accent, .3) : fin; c.lineWidth = Math.max(.011, 1 / pixels); c.stroke();
    const r = Math.max(plan.eye * (.8 + .35 * eyeSize) * (far ? .85 : 1), 1.1 / pixels);
    if (far) { c.beginPath(); c.arc(top[0], top[1], r, 0, TAU); c.fillStyle = mix('#fbfaf2', col.accent, .3); c.fill(); c.strokeStyle = edge; c.lineWidth = lw; c.stroke(); }
    else eye(top[0], top[1], r);
  }
  /** One friendly eye: pale ball, large dark pupil, white catchlight. @param {number} ex @param {number} ey @param {number} r */
  function eye(ex, ey, r) {
    c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fillStyle = '#fbfaf2'; c.fill();
    c.strokeStyle = ink; c.lineWidth = Math.max(lw * .9, r * .14); c.stroke();
    c.beginPath(); c.arc(ex + r * .16, ey + r * .05, r * .68, 0, TAU); c.fillStyle = glow ? mix(col.glow, col.accent, .35) : mix(edge, '#16202a', .4); c.fill();
    if (detail) { c.beginPath(); c.arc(ex + r * .2, ey + r * .05, r * .38, 0, TAU); c.fillStyle = '#121a20'; c.fill(); }
    c.beginPath(); c.arc(ex - r * .1, ey - r * .26, r * (detail ? .24 : .3), 0, TAU); c.fillStyle = '#ffffff'; c.fill();
  }
}
