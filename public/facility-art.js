// Hostile facility art: a shared rooted bed and one body per site kind, in the
// creatures' visual language (public/enemy-art.js). Pixels at zoom 1 (48 px a
// tile), origin at the 3 x 3 site centre, aim angle 0 = up. Presentation only:
// poses follow saved site state (sensor mode and bearing, alarm, mortar charge,
// laser and flak phases, hive healing, giant emergence warnings); footprints,
// collision, warnings and labels are drawn and decided elsewhere.
// Design record: docs/ENEMY_ART_STAGE.md (facility sketches v1, 9 November 2026).
import { SCANNER } from './sensors.js';
import { LASER } from './laser-tower.js';
import { MORTAR } from './mortar.js';
import { AQUATIC } from './aquatic-profile.js';
const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp01(t)).toString(16).padStart(2, '0')).join(''); }
const deadOf = P => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, mix(v, '#3a3036', .6)]));
function oval(c, x, y, rx, ry, fill, rot = 0) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); }
function ring(c, x, y, rx, ry, stroke, width, rot = 0) { c.strokeStyle = stroke; c.lineWidth = width; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.stroke(); }
function line(c, pts, color, width) { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function poly(c, pts, fill, stroke, width = 1) {
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}
function blob(c, rx, ry, lobes, wobble, seed) {
  c.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, k = 1 + wobble * Math.sin(a * lobes + seed) + wobble * .5 * Math.cos(a * (lobes + 2) - seed); const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath();
}
const hash = v => { const x = Math.sin(v * 127.1) * 43758.5453; return x - Math.floor(x); };
const phaseOf = (site, time, reduced) => (site.state === 'conquered' || reduced ? 0 : time / 1000);
const HOT = '#ff9a52', HOT_FIN = '#ffd9a8';

// ---------------------------------------------------------------- Shared rooted bed
// A lobed tissue pad with eight thick roots that grip the ground with bone hooks.
const BED = { pad: '#4a2733', padLight: '#6a3a48', line: '#24141c', root: '#6b3442', rootLight: '#9c5a52', hook: '#dcc39c' };
const BED_DEAD = deadOf(BED);
function drawSiteBase(c, site, time, reduced, zoom = 1) {
  const P = site.state === 'conquered' ? BED_DEAD : BED, t = phaseOf(site, time, reduced), seed = hash(String(site.id).length + (site.x || 0));
  c.save();
  oval(c, 7, 10, 104, 88, '#30202752');
  // Far out the roots are a few pixels wide; skip them and keep the pad.
  if (zoom >= .3) for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + seed * .6 + Math.sin(i * 2.3) * .18, reach = 92 + 12 * Math.sin(i * 3.1 + seed * 5), twitch = Math.sin(t * 1.7 + i * 3) * 3;
    c.save(); c.rotate(a);
    const mid = [reach * .55, (i % 2 ? 12 : -12) + twitch * .5], tip = [reach, twitch];
    c.lineCap = 'round';
    c.strokeStyle = P.line; c.lineWidth = 15; c.beginPath(); c.moveTo(34, 0); c.quadraticCurveTo(mid[0], mid[1], tip[0] - 14, tip[1]); c.stroke();
    c.strokeStyle = P.root; c.lineWidth = 11; c.stroke();
    c.strokeStyle = P.line; c.lineWidth = 8; c.beginPath(); c.moveTo(tip[0] - 16, tip[1]); c.lineTo(tip[0] - 2, tip[1] + 1); c.stroke();
    c.strokeStyle = P.root; c.lineWidth = 5; c.stroke();
    c.strokeStyle = P.rootLight; c.lineWidth = 2; c.beginPath(); c.moveTo(40, -3); c.quadraticCurveTo(mid[0], mid[1] - 4, tip[0] - 16, tip[1] - 2); c.stroke();
    poly(c, [[tip[0] - 3, tip[1] - 3.5], [tip[0] + 7, tip[1] + (i % 2 ? 5 : -5)], [tip[0] - 3, tip[1] + 3.5]], P.hook, P.line, 1);
    c.restore();
  }
  blob(c, 76, 66, 5, .06, seed * 9); c.fillStyle = P.pad + 'dd'; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke();
  c.save(); blob(c, 76, 66, 5, .06, seed * 9); c.clip(); oval(c, -22, -20, 44, 34, P.padLight + '88'); c.restore();
  c.restore();
}
const hitFlash = (c, site, time, rx, ry) => { if (site.state !== 'conquered' && time - (site.hitAt ?? -1e9) < 350) { c.save(); c.globalAlpha = .22; oval(c, 0, 0, rx, ry, '#ffe8d2'); c.restore(); } };

// ---------------------------------------------------------------- Sensory crown (alert)
// A crown of bone sensory fronds around a teal receptor dish. The receptor looks
// along the saved sensor bearing; search pulses with the scan ring; tracking turns
// it amber and leans the fronds; an alarm reddens the frond tips.
const CROWN = { collar: '#3a2232', frond: '#e4d3b4', frondShade: '#a88a92', tip: '#8a4a6a', line: '#24141e', ridge: '#c9a3b4', lensDark: '#10262a', lens: '#2c6b6a', lensLight: '#7cc0b2', pore: '#24161f' };
const CROWN_DEAD = deadOf(CROWN);
function drawCrown(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? CROWN_DEAD : CROWN, s = site.sensor || {}, t = phaseOf(site, time, reduced);
  const tracking = !dead && s.mode === 'tracking', lost = !dead && s.mode === 'lost', alarm = !dead && site.alarm;
  const bearing = Number.isFinite(s.angle) ? s.angle : 0, period = SCANNER.period;
  const scan = s.mode === 'search' && !reduced ? ((time - (s.pulseAt || 0)) % period) / period : 0;
  oval(c, 0, 0, 44, 42, P.collar); ring(c, 0, 0, 44, 42, P.line, 1.5);
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9 + .17;
    // Fronds lean toward a tracked contact and sway while searching.
    const toward = Math.sin(bearing - a) * (tracking ? .22 : 0), sway = Math.sin(t * 1.3 + i * 1.9) * .04;
    const broken = dead && i % 3 === 0, len = broken ? 34 : dead ? 52 : 64 + 4 * Math.sin(i * 2.7);
    c.save(); c.rotate(a + toward + sway);
    const blade = [[0, -22], [7, -24], [5, -len * .7], [0, -len], [-4, -len * .72], [-6, -26]];
    poly(c, blade, P.frond, P.line, 1.2);
    poly(c, [[0, -22], [7, -24], [5, -len * .7], [0, -len]], P.frondShade);
    poly(c, blade, null, P.line, 1.2);
    const lit = alarm ? (reduced || Math.sin(time / 120) > 0 ? '#ff5a6a' : '#ffb0a0') : tracking ? '#f0a060' : P.tip;
    if (!broken) poly(c, [[3.5, -len * .78], [0, -len], [-3, -len * .79]], lit);
    oval(c, 0, -30, 2.2, 2.2, P.pore);
    c.restore();
  }
  // Receptor dish with an aperture that looks along the beam.
  oval(c, 0, 0, 27, 27, P.ridge); ring(c, 0, 0, 27, 27, P.line, 1.4);
  oval(c, 0, 0, 21, 21, P.lensDark);
  const iris = dead ? '#2a2c30' : tracking ? '#ffb067' : lost ? '#7a6a50' : mix(P.lens, P.lensLight, scan > 0 ? (1 - scan) * .6 : 0);
  oval(c, 0, 0, 14, 14, iris);
  if (!dead) {
    const px = Math.sin(bearing) * 6, py = -Math.cos(bearing) * 6;
    oval(c, px, py, 5, 5, '#0a1416'); oval(c, px - 2, py - 2, 1.6, 1.6, '#e8fff6');
    if (scan > 0) ring(c, 0, 0, 22 + scan * 8, 22 + scan * 8, '#f2bc77' + Math.round((1 - scan) * 200).toString(16).padStart(2, '0'), 1.5);
  } else { line(c, [[-14, -8], [-2, 2], [-8, 12]], '#1a1418', 2); }
  if (!dead && site.hp < site.maxHp * .65) line(c, [[18, -12], [8, -4], [14, 6]], '#c084ae', 2);
  if (alarm) ring(c, 0, 0, 72 + (reduced ? 4 : (t % 1) * 20), 72 + (reduced ? 4 : (t % 1) * 20), '#ff6f86', 2);
  hitFlash(c, site, time, 50, 48);
}

// ---------------------------------------------------------------- Bile mortar
// Gold armoured carapace (Breaker family) holding a green acid sac, with a thick
// muscular siphon that turns to the saved aim. The sac swells and glows through
// the saved charge; the siphon kicks back when it fires.
const SAC = { plate: '#c8912d', light: '#e2b34d', dark: '#8c5d1d', edge: '#f2deaa', line: '#2e1a12', body: '#482b35', siphon: '#a06351', siphonDark: '#5a2e30', band: '#e2a888', sac: '#9fae5a', sacGlow: '#e8ec9a', lip: '#bc7d68', mouth: '#251f28' };
const SAC_DEAD = deadOf(SAC);
function drawMortar(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? SAC_DEAD : SAC, m = site.mortar || {}, t = phaseOf(site, time, reduced);
  const charge = !dead && m.charge ? clamp01(1 - (m.charge.fireAt - time) / MORTAR.windup) : 0;
  const kick = !dead && time - (m.firedAt ?? -1e9) < 300 ? 1 - (time - m.firedAt) / 300 : 0;
  const swell = dead ? .7 : 1 + (charge ? .12 * charge + Math.sin(time / 90) * .04 * (reduced ? 0 : 1) : Math.sin(t * 1.6) * .03);
  oval(c, 0, 2, 58, 52, P.body); ring(c, 0, 2, 58, 52, P.line, 1.5);
  // A shell rim of seven overlapping curved gold plates round the sac.
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7 - Math.PI / 2 + .45, from = a - .52, to = a + .52;
    c.beginPath(); c.arc(0, 2, 54, from, to); c.arc(0, 2, 31, to, from, true); c.closePath();
    c.fillStyle = i % 2 ? P.plate : P.light; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = P.dark; c.lineWidth = 3; c.beginPath(); c.arc(0, 2, 34, from + .08, to - .08); c.stroke();
    c.strokeStyle = P.edge; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 2, 51.5, from + .06, to - .14); c.stroke();
    const mx = Math.cos(a) * 43, my = 2 + Math.sin(a) * 43;
    poly(c, [[mx + Math.cos(a + 1.57) * 4, my + Math.sin(a + 1.57) * 4], [mx + Math.cos(a) * 7, my + Math.sin(a) * 7], [mx - Math.cos(a + 1.57) * 4, my - Math.sin(a + 1.57) * 4]], P.edge);
  }
  c.save(); c.rotate(dead ? .65 : m.angle || 0);
  // Acid sac behind the siphon, ribbed with tissue straps.
  oval(c, 4, 22, 30 * swell, 24 * swell, P.line);
  oval(c, 4, 22, 28 * swell, 22 * swell, P.sac);
  oval(c, -2, 17, 14 * swell, 10 * swell, mix(P.sac, P.sacGlow, .4 + .6 * charge));
  for (const x of [-12, 4, 18]) line(c, [[x, 22 - 20 * swell], [x * 1.1, 22 + 20 * swell]], P.siphonDark, 3);
  // Siphon barrel: thick, banded, recoils on fire.
  const tip = -54 + 7 * kick + (dead ? 18 : 0);
  line(c, [[0, 10], [-6, -16], [0, tip]], P.line, 27);
  line(c, [[0, 10], [-6, -16], [0, tip]], P.siphon, 22);
  line(c, [[-6, 6], [-11, -16], [-5, tip + 2]], '#c4806a', 4);
  for (let i = 0; i < 4; i++) { const y = -2 - i * 12; line(c, [[-14, y], [9, y - 1]], P.band, 2.5); }
  oval(c, 0, tip, 17, 12, P.lip); ring(c, 0, tip, 17, 12, P.line, 1.4);
  oval(c, 0, tip - 1, 10, 7, P.mouth);
  if (!dead) oval(c, 0, tip - 1, 5 + 4 * charge, 3.5 + 2.5 * charge, charge ? P.sacGlow : '#839963');
  if (kick > 0) { c.save(); c.globalAlpha = kick * .8; oval(c, 0, tip - 14, 12, 18, '#dbeea7'); c.restore(); }
  c.restore();
  hitFlash(c, site, time, 58, 52);
}

// ---------------------------------------------------------------- Blight root
// The centipede's source: five gnarled roots spiral out of a closed flower bud
// that carries the centipede's maw. Brood nodules swell along the roots. While
// a giant is emerging (o.emerging 0..1) the bud opens and the maw glows.
const ROOT = { bark: '#5c3a44', barkLight: '#8c5a5a', line: '#24141c', nodule: '#d9a07a', noduleHot: '#ffd0a0', petal: '#efb497', petalInner: '#a3313f', maw: '#4a0f1e', tooth: '#f8ecd4', pith: '#3a1a28' };
const ROOT_DEAD = deadOf(ROOT);
function drawRoot(c, site, time, reduced, o = {}) {
  const dead = site.state === 'conquered', P = dead ? ROOT_DEAD : ROOT, t = phaseOf(site, time, reduced), open = dead ? 0 : clamp01(o.emerging || 0);
  oval(c, 0, 0, 50, 46, P.pith); ring(c, 0, 0, 50, 46, P.line, 1.5);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + .3;
    c.save(); c.rotate(a);
    const pts = [[8, 0], [30, -16], [50, -6], [64, 10]];
    const draw = (color, w) => { c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(...pts[0]); c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); c.stroke(); };
    draw(P.line, 19); draw(P.bark, 14); c.save(); c.translate(-2, -3); draw(P.barkLight, 3); c.restore();
    // Brood nodules pulse in a slow wave around the root.
    [[32, -12, 7], [50, -3, 5.5]].forEach(([x, y, r], k) => {
      const p = dead ? .7 : 1 + Math.sin(t * 2 - i - k) * .12 + open * .25;
      oval(c, x, y, r * p, r * .8 * p, P.line); oval(c, x, y, (r - 1.5) * p, (r * .8 - 1.5) * p, open ? mix(P.nodule, P.noduleHot, open) : P.nodule);
      oval(c, x - 1.5, y - 1.5, r * .3, r * .25, '#ffffff55');
    });
    c.restore();
  }
  // Bud: petals folded shut, spreading open as a giant emerges.
  const breathe = 1 + Math.sin(t * 1.2) * .04;
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 - Math.PI / 2;
    c.save(); c.rotate(a);
    const L = (dead ? 18 : 24 + 10 * open) * breathe, W = 9 + 5 * open, base = 6 + 10 * open;
    c.beginPath(); c.moveTo(base, -W); c.quadraticCurveTo(base + L * .8, -W * 1.1, base + L, 0); c.quadraticCurveTo(base + L * .8, W * 1.1, base, W); c.closePath();
    c.fillStyle = P.petal; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.moveTo(base + 2, -W * .5); c.quadraticCurveTo(base + L * .7, -W * .55, base + L * .88, 0); c.quadraticCurveTo(base + L * .7, W * .55, base + 2, W * .5); c.closePath();
    c.fillStyle = P.petalInner; c.fill();
    if (open > .2) { c.setLineDash([1.3, 1.5]); c.strokeStyle = P.tooth; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]); }
    c.restore();
  }
  const maw = 6 + 12 * open;
  oval(c, 0, 0, maw, maw, P.maw);
  if (open > .2) { c.save(); c.globalAlpha = open; oval(c, 0, 0, maw * .55, maw * .55, '#ff8a5a'); c.restore(); }
  if (open > 0 && !reduced) ring(c, 0, 0, 30 + open * 30, 30 + open * 30, '#f58c94' + Math.round(open * 160).toString(16).padStart(2, '0'), 2);
  hitFlash(c, site, time, 50, 46);
}

// ---------------------------------------------------------------- Lance tower
// A star of six radiator fins (laser family) under a turret carrying one long
// stepped lance with a teal aperture. It turns to the saved angle; the fins heat
// through the charge, run hot while firing and cool after.
const LANCE = { chitin: '#74395e', light: '#965a7f', dark: '#46203d', ridge: '#cba6b7', line: '#26101f', membrane: '#9e3f50', lensDark: '#0e2427', lens: '#2c6b6a', lensLight: '#7cc0b2' };
const LANCE_DEAD = deadOf(LANCE);
function drawLance(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? LANCE_DEAD : LANCE, m = site.laser || {}, t = phaseOf(site, time, reduced);
  const phase = dead ? 'silent' : m.phase || 'watching', left = Number(m.remaining) || 0;
  const charge = phase === 'charging' ? clamp01(1 - left / LASER.charge) : 0;
  const heat = phase === 'firing' ? 1 : phase === 'charging' ? .6 * charge : phase === 'cooling' ? clamp01(left / LASER.cooldown) : 0;
  // Radiator star.
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * TAU / 6 + Math.PI / 6);
    poly(c, [[0, -14], [14, -26], [10, -60], [0, -68], [-10, -60], [-14, -26]], mix(P.membrane, HOT, heat), P.line, 1.3);
    line(c, [[0, -18], [0, -64]], P.dark, 7); line(c, [[0, -18], [0, -64]], mix(P.ridge, HOT_FIN, heat), 3.4);
    for (const y of [-34, -48]) line(c, [[-8, y + 3], [0, y - 2], [8, y + 3]], mix(P.ridge, HOT_FIN, heat), 1.6);
    c.restore();
  }
  oval(c, 0, 0, 30, 30, P.chitin); ring(c, 0, 0, 30, 30, P.line, 1.5);
  oval(c, -8, -8, 14, 14, P.light + 'aa');
  // Turret and lance.
  c.save(); c.rotate(m.angle || 0);
  if (dead) {
    poly(c, [[-11, 0], [-9, -26], [9, -26], [11, 0]], P.chitin, P.line, 1.2);
    c.save(); c.translate(26, -40); c.rotate(.9); poly(c, [[-7, 0], [-6, -26], [6, -26], [7, 0]], P.chitin, P.line, 1.2); c.restore();
  } else {
    const steps = [[6, -18, 13, 12], [-18, -38, 11, 10], [-38, -56, 9, 8], [-56, -70, 7.5, 7]];
    steps.forEach(([y0, y1, w0, w1]) => {
      poly(c, [[-w0, y0], [-w1, y1], [w1, y1], [w0, y0]], P.chitin, P.line, 1.2);
      poly(c, [[-w0 + 1, y0], [-w1 + 1, y1], [-w1 * .3, y1], [-w0 * .3, y0]], P.light + 'aa');
      c.fillStyle = P.ridge; c.fillRect(-w1 - .8, y1 - 1.3, w1 * 2 + 1.6, 3);
    });
    const r = 7.5;
    oval(c, 0, -72, r * 1.3, r * 1.3, P.ridge); ring(c, 0, -72, r * 1.3, r * 1.3, P.line, 1.2);
    oval(c, 0, -72, r, r, P.lensDark);
    oval(c, 0, -72, r * .7, r * .7, phase === 'firing' ? '#fff3ce' : phase === 'charging' ? mix('#a8584e', '#ffd2a8', charge) : P.lens);
    oval(c, -2, -74, 1.8, 1.8, phase === 'firing' ? '#ffffff' : P.lensLight);
    if (phase === 'charging') ring(c, 0, -72, r * (3 - 1.6 * charge), r * (3 - 1.6 * charge), '#ffb9a0', 1.6);
  }
  c.restore();
  // The base warning ring stays: a charging lance is a danger players must see.
  if (phase === 'charging') ring(c, 0, 0, 72 + (reduced ? 0 : Math.sin(time / 100) * 4), 72 + (reduced ? 0 : Math.sin(time / 100) * 4), '#ffb7a7', 2.6);
  if (heat > .08 && !reduced) for (let i = 0; i < 3; i++) { const p = (t * .9 + i / 3) % 1; c.save(); c.globalAlpha = heat * .4 * (1 - p); ring(c, 0, 0, 34 + p * 30, 34 + p * 30, '#ffd6a8', 1.2); c.restore(); }
  hitFlash(c, site, time, 52, 52);
}

// ---------------------------------------------------------------- Spore flak
// A puffball cap ringed with gills, carrying three stubby spore cannons that lean
// toward the saved aim. Their mouths glow through the charge and puff on firing.
const FLAK = { cap: '#8a4a78', light: '#b06a98', dark: '#4e2343', gill: '#d8a8c8', line: '#26101f', tube: '#b47a9a', band: '#e8c4d6', mouthRim: '#f0c8dc', mouth: '#2a1428', idle: '#d179c4', pore: '#3a1830' };
const FLAK_DEAD = deadOf(FLAK);
function drawFlak(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? FLAK_DEAD : FLAK, a = site.aa || {}, t = phaseOf(site, time, reduced);
  const phase = dead ? 'silent' : a.phase || 'watching', charging = phase === 'charging', firing = phase === 'firing';
  // Gilled rim and domed cap.
  for (let i = 0; i < 14; i++) { c.save(); c.rotate(i * TAU / 14); poly(c, [[-6, -40], [0, -58 - (i % 2) * 5], [6, -40]], P.gill, P.line, 1); c.restore(); }
  const breathe = dead ? .92 : 1 + Math.sin(t * 1.4) * .025 + (charging ? .04 : 0);
  oval(c, 0, 0, 48 * breathe, 46 * breathe, P.cap); ring(c, 0, 0, 48 * breathe, 46 * breathe, P.line, 1.5);
  oval(c, -12, -12, 24, 20, P.light + '99');
  for (let i = 0; i < 10; i++) { const q = i * TAU / 10 + .2; oval(c, Math.cos(q) * 36, Math.sin(q) * 34, 2.4, 2, P.pore); }
  c.save(); c.rotate(a.angle || 0);
  [-17, 0, 17].forEach((x, i) => {
    const len = dead ? 22 : 40 - Math.abs(x) * .3, sag = dead ? (i - 1) * .5 : 0;
    c.save(); c.translate(x, 8); c.rotate(x * .012 + sag);
    line(c, [[0, 0], [0, -len]], P.line, 17); line(c, [[0, 0], [0, -len]], P.tube, 13);
    line(c, [[-3.5, -2], [-3.5, -len + 2]], P.light, 2.5);
    for (const y of [-len * .35, -len * .7]) line(c, [[-6, y], [6, y]], P.band, 2.2);
    oval(c, 0, -len, 9.5, 9.5, P.mouthRim); ring(c, 0, -len, 9.5, 9.5, P.line, 1.2);
    oval(c, 0, -len, 6, 6, P.mouth);
    if (!dead) oval(c, 0, -len, charging ? 4.5 : 3, charging ? 4.5 : 3, charging ? '#ffdda0' : firing ? '#fff0d8' : P.idle);
    if (firing && !reduced) { const p = (time / 260 + i * .33) % 1; c.save(); c.globalAlpha = 1 - p; ring(c, 0, -len - 6 - p * 14, 5 + p * 8, 5 + p * 8, '#f0c0e0', 2); c.restore(); }
    c.restore();
  });
  c.restore();
  hitFlash(c, site, time, 50, 48);
}

// ---------------------------------------------------------------- Air contaminator
// A ribbed gas bladder in the fog's own colours, breathing slowly, with five
// chimneys that exhale. While hostile it sits inside its own opaque fog, so this
// is mostly seen on the map edge and as a ruin.
const CONT = { bladder: '#6b3a62', light: '#8f5a86', dark: '#3e2038', rib: '#d9c0c8', line: '#22121e', stack: '#4a2a44', stackRim: '#c49ab4', hole: '#1e1020', puff: '#a57abb' };
const CONT_DEAD = deadOf(CONT);
function drawContaminator(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? CONT_DEAD : CONT, t = phaseOf(site, time, reduced);
  const breathe = dead ? .82 : 1 + Math.sin(t * .9) * .045;
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 - Math.PI / 2 + .3, x = Math.cos(a) * 50, y = Math.sin(a) * 46;
    line(c, [[x * .5, y * .5], [x, y]], P.line, 15); line(c, [[x * .5, y * .5], [x, y]], P.stack, 11);
    oval(c, x, y, 11, 11, P.stackRim); ring(c, x, y, 11, 11, P.line, 1.2); oval(c, x, y, 6.5, 6.5, P.hole);
    if (!dead && !reduced) for (let k = 0; k < 2; k++) {
      const p = (t * .5 + k * .5 + i * .2) % 1; c.save(); c.globalAlpha = (1 - p) * .7;
      oval(c, x + Math.cos(a) * p * 22, y + Math.sin(a) * p * 22, 6 + p * 10, 5 + p * 8, P.puff + '99'); c.restore();
    }
  }
  oval(c, 0, 0, 46 * breathe, 42 * (dead ? .7 : breathe), P.bladder); ring(c, 0, 0, 46 * breathe, 42 * (dead ? .7 : breathe), P.line, 1.5);
  oval(c, -12, -12, 22 * breathe, 17 * breathe, P.light + 'aa');
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 14 * breathe, bow = 10 - Math.abs(i - 2.5) * 2.5;
    c.strokeStyle = P.dark; c.lineWidth = 4; c.beginPath(); c.moveTo(x * .5, -40 * breathe); c.quadraticCurveTo(x + bow * Math.sign(x || 1), 0, x * .5, 40 * (dead ? .7 : breathe)); c.stroke();
    c.strokeStyle = P.rib; c.lineWidth = 2; c.stroke();
  }
  oval(c, 0, 0, 9, 9, P.dark); oval(c, 0, 0, 5, 5, dead ? P.hole : '#c08ad0');
  if (dead) line(c, [[-30, -6], [-14, 4], [-22, 16], [-4, 22]], '#1e141c', 2);
  hitFlash(c, site, time, 48, 44);
}

// ---------------------------------------------------------------- Aquatic hive
// A reef mound (kept in the bile spitters' green) with a ring of egg pods round a
// spawning pool and three poison vents. Pods glow while it regenerates and go
// dim while healing is suppressed after a hit; conquest bursts them.
const HIVE = { mound: '#2d514b', moundLight: '#3f6a5e', line: '#132623', coral: '#6d8762', coralTip: '#bad585', pod: '#8c8a55', egg: '#bad585', embryo: '#283d36', glow: '#e8f2a8', pool: '#1d3632', core: '#b0ce72', vent: '#283e3e', ventIn: '#c4d8a0' };
const HIVE_DEAD = deadOf(HIVE);
function drawHive(c, site, time, reduced) {
  const dead = site.state === 'conquered', P = dead ? HIVE_DEAD : HIVE, t = phaseOf(site, time, reduced);
  const suppressed = !dead && time - (site.hitAt ?? -1e9) < AQUATIC.healDelay, healing = !dead && !suppressed && site.hp < site.maxHp;
  blob(c, 68, 60, 6, .07, 2); c.fillStyle = P.mound; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.5; c.stroke();
  c.save(); blob(c, 68, 60, 6, .07, 2); c.clip(); oval(c, -18, -18, 40, 30, P.moundLight + 'aa'); c.restore();
  // Branching coral fronds around the rim.
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + .5, r0 = 52, x = Math.cos(a) * r0, y = Math.sin(a) * r0 * .9, sway = Math.sin(t * 1.5 + i) * .1;
    c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2 + sway);
    line(c, [[0, 0], [0, -16], [-6, -24]], P.line, 5); line(c, [[0, -16], [6, -25]], P.line, 4);
    line(c, [[0, 0], [0, -16], [-6, -24]], P.coral, 3); line(c, [[0, -16], [6, -25]], P.coral, 2.4);
    oval(c, -6, -24, 2.2, 2.2, P.coralTip); oval(c, 6, -25, 2, 2, P.coralTip);
    c.restore();
  }
  // Egg pods.
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7, x = Math.cos(a) * 34, y = Math.sin(a) * 30, beat = healing && !reduced ? 1 + Math.sin(t * 3 - i) * .08 : 1;
    oval(c, x, y, 13 * beat, 11 * beat, P.line); oval(c, x, y, 11.5 * beat, 9.5 * beat, P.pod);
    if (dead) { oval(c, x + 2, y - 1, 7, 5, P.embryo); continue; }
    oval(c, x - 1, y - 1, 8 * beat, 6.5 * beat, healing ? mix(P.egg, P.glow, .5 + .5 * Math.sin(t * 3 - i)) : suppressed ? '#6f7c4c' : P.egg);
    oval(c, x + 1.5, y + 1, 3, 2.4, P.embryo);
  }
  oval(c, 0, 0, 17, 16, P.line); oval(c, 0, 0, 15, 14, P.pool);
  oval(c, 0, 0, 9, 8.5, dead ? '#2a3530' : suppressed ? '#6a8050' : P.core);
  // Poison vents on the near rim.
  for (const x of [-26, 0, 26]) {
    oval(c, x, 50, 9, 7.5, P.vent); ring(c, x, 50, 9, 7.5, P.line, 1.2); oval(c, x, 50, 5.5, 3.5, dead ? '#394a46' : P.ventIn);
    if (!dead && !reduced) { const p = (t * .8 + x * .01 + 1) % 1; c.save(); c.globalAlpha = 1 - p; oval(c, x + Math.sin(p * 6) * 2, 50 - p * 14, 2 + p * 2, 2 + p * 2, P.ventIn); c.restore(); }
  }
  hitFlash(c, site, time, 68, 60);
}

const BODIES = { alert: drawCrown, mortar: drawMortar, modifier: drawRoot, laser: drawLance, 'anti-air': drawFlak, contaminator: drawContaminator, 'aquatic-hive': drawHive };
/**
 * Draws one site's rooted bed and body at the context origin (the site centre).
 * o: { zoom, emerging } where emerging (0..1) is the root's saved giant warning.
 */
export function drawFacility(c, site, time, reduced, o = {}) {
  drawSiteBase(c, site, time, reduced, o.zoom ?? 1);
  (BODIES[site.kind] || drawCrown)(c, site, time, reduced, o);
}
/** Aperture of the lance in tiles from the site centre: the visible beam starts here. */
export const LANCE_REACH = 72 / 48;
