import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint } from './colony-view.js';

// Colony field companion: a small furry mechanical spider (docs/COLONY_MECHANICAL_SPIDER_PET.md).
// Presentation only. The runtime decides position, heading, mode and reactions;
// this module draws them with the worker's palette and local 3D approach so the
// pet stays coherent at every heading in the fixed 55-degree colony view.
//
// pet = { x, y, angle, mode, moving, reaction, name }
//   angle: 0 faces north, atan2(dy, dx) + PI/2 (the robot's convention)
//   mode: 'follow' | 'sit' | 'notice' | 'wander' (anything else stands)
//   reaction: null | { kind: 'purr' | 'happy', until } in the same seconds as time
const TAU = Math.PI * 2;
const INK = '#52616a';
const FRAME = '#44525a';
const METAL = '#91a0a3';
const WHITE = '#f0f2eb';
const LIGHT = '#fffdf2';
const SHADE = '#bdc8c6';
const VIOLET = '#aaa0bc';
const VIOLET_SHADE = '#887f9d';
const FUR = '#d9d4df';
const FUR_TUFT = '#b7adc6';
const CYAN = '#91e5e9';
const CYAN_CORE = '#d8ffff';
const SENSOR_DARK = '#354b53';
const HEART = '#dfa3b4';
const HEART_LIGHT = '#f6dbe3';

const BODY_RADIUS = .17;          // white shell; fur reaches about .215
const HEAD_RADIUS = .082;
const STAND_HEIGHT = .20;         // body centre above ground
const SIT_HEIGHT = .12;
// Leg roots along each flank, front to back, in body-local tiles.
const LEG_ROWS = [-.105, -.035, .035, .105];
// Standing stance: foot offsets [outward x, y, z] per row, mirrored by side.
const STAND_FEET = [[.255, -.215, 0], [.29, -.075, 0], [.29, .075, 0], [.255, .215, 0]];
const SIT_FEET = [[.15, -.14, 0], [.175, -.045, 0], [.175, .045, 0], [.15, .14, 0]];
const FUR_POINTS = 34;

// Tiles around (pet.x, pet.y): legs reach 0.32 either way, hearts and the name
// label rise above the head. [left, top, width, height].
export const PET_ART_BOUNDS = [-.6, -1.1, 1.2, 1.6];

const normalize = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const EYE_NORMALS = [normalize([-.42, -.80, .40]), normalize([.42, -.80, .40])];
const ACCENT_DIR = normalize([0, .55, .83]);
const ACCENT_U = [1, 0, 0];
const ACCENT_V = [0, ACCENT_DIR[2], -ACCENT_DIR[1]];
const smooth = t => t * t * (3 - 2 * t);
const hash = (i, seed) => { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
const nameSeed = name => { let h = 0; const s = String(name || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1009; return h / 1009; };

// Eye openness from time: open almost always, with a short blink roughly every
// 3.4 s, offset per pet so companions do not blink together.
function blinkAmount(time, seed) {
  const cycle = ((time / 3.4 + seed) % 1 + 1) % 1;
  const width = .045;
  if (cycle > width) return 1;
  return 1 - Math.sin(cycle / width * Math.PI);
}

function heartPath(c, x, y, s) {
  c.moveTo(x, y + s * .9);
  c.bezierCurveTo(x - s * 1.3, y - s * .1, x - s * .6, y - s * 1.05, x, y - s * .35);
  c.bezierCurveTo(x + s * .6, y - s * 1.05, x + s * 1.3, y - s * .1, x, y + s * .9);
}

export function drawColonyPet(c, pet, time = 0, reduced = false) {
  if (!pet || !Number.isFinite(pet.x) || !Number.isFinite(pet.y)) return;
  const mode = pet.mode === 'sit' || pet.mode === 'notice' || pet.mode === 'wander' || pet.mode === 'follow' ? pet.mode : 'stand';
  const sitting = mode === 'sit', noticing = mode === 'notice';
  const moving = !!pet.moving && !sitting;
  const reaction = pet.reaction && (pet.reaction.kind === 'purr' || pet.reaction.kind === 'happy')
    && (!Number.isFinite(pet.reaction.until) || time < pet.reaction.until) ? pet.reaction : null;
  const happy = reaction?.kind === 'happy';
  const angle = Number.isFinite(pet.angle) ? pet.angle : 0;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const seed = nameSeed(pet.name);

  // Motion samples. Reduced motion holds every pose still: no step cycle,
  // breathing, hop, blink or antenna twitch.
  const stepPhase = moving && !reduced ? time * TAU * 1.7 : 0;
  const breathe = sitting && !reduced ? Math.sin(time * TAU * .35) * .012 : 0;
  const hop = happy && !reduced ? Math.max(0, Math.sin(time * TAU * 2.1)) * .075 : 0;
  const bodyHeight = (sitting ? SIT_HEIGHT : STAND_HEIGHT) + breathe;
  const tilt = noticing ? reduced ? .28 : .28 + Math.sin(time * 1.6) * .07 : 0;
  const headLift = noticing ? .035 : 0;
  const blink = reduced ? 1 : blinkAmount(time, seed);
  const eyeOpen = reaction ? 0 : Math.min(blink, sitting ? .42 : 1);

  const shapes = [];
  let sequence = 0;
  const world = ([x, y, z]) => ({ x: pet.x + x * ca - y * sa, y: pet.y + x * sa + y * ca, z: z + hop });
  const screen = point => { const q = world(point); return projectColonyPoint(q.x, q.y, q.z); };
  const depth = points => points.reduce((sum, point) => {
    const q = world(point); return sum + (q.y - pet.y) * COLONY_HEIGHT + q.z * COLONY_DEPTH;
  }, 0) / points.length;
  const facing = normal => (normal[0] * sa + normal[1] * ca) * COLONY_HEIGHT + normal[2] * COLONY_DEPTH;
  const enqueue = (points, draw, bias = 0) => shapes.push({ depth: depth(points) + bias, sequence: sequence++, draw });

  function stroke(points, color, width, bias = .002) {
    const projected = points.map(screen);
    enqueue(points, () => {
      c.beginPath(); projected.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.strokeStyle = color; c.lineWidth = width; c.stroke();
    }, bias);
  }
  function link(a, b, width) {
    stroke([a, b], FRAME, width, 0);
    stroke([a, b], METAL, width * .34, .001);
  }
  function joint(point, radius) {
    const q = screen(point);
    enqueue([point], () => {
      c.beginPath(); c.arc(q.x, q.y, radius, 0, TAU); c.fillStyle = FRAME; c.fill();
      c.strokeStyle = METAL; c.lineWidth = .012; c.stroke();
    }, .002);
  }
  function pad(point) {
    const q = screen(point);
    enqueue([point], () => {
      c.beginPath(); c.ellipse(q.x, q.y, .024, .024 * COLONY_DEPTH + .006, 0, 0, TAU);
      c.fillStyle = WHITE; c.fill(); c.strokeStyle = INK; c.lineWidth = .012; c.stroke();
    }, .003);
  }
  // A great-circle seam on a sphere, drawn only where the surface faces the camera.
  function seam(centre, radius, normalAt, color, width, bias) {
    const runs = [];
    let run = null;
    for (let i = 0; i <= 40; i++) {
      const n = normalAt(i / 40 * TAU);
      if (facing(n) > .04) {
        const point = [centre[0] + n[0] * radius, centre[1] + n[1] * radius, centre[2] + n[2] * radius];
        if (!run) runs.push(run = []);
        run.push(screen(point));
      } else run = null;
    }
    if (!runs.length) return;
    enqueue([centre], () => {
      c.beginPath();
      for (const points of runs) points.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.strokeStyle = color; c.lineWidth = width; c.stroke();
    }, bias);
  }

  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';

  // Ground shadow, shrinking slightly while the body hops.
  const ground = projectColonyPoint(pet.x, pet.y);
  const shadowScale = 1 - hop * 2.2;
  c.beginPath(); c.ellipse(ground.x + .03, ground.y + .03, .25 * shadowScale, .19 * COLONY_DEPTH * shadowScale, 0, 0, TAU);
  c.fillStyle = sitting ? '#3648492a' : '#36484924'; c.fill();

  // Eight short legs: four per flank, two links each, white pads on the ground.
  // Stepping is a wave along the body; left and right flanks run half a cycle
  // apart so the pet never lifts neighbouring legs together. Standing rests
  // them spread, sitting tucks them under, noticing raises the front pair.
  const feet = sitting ? SIT_FEET : STAND_FEET;
  for (const side of [-1, 1]) LEG_ROWS.forEach((row, index) => {
    const hip = [side * .125, row, bodyHeight - .025];
    const [fx, fy] = feet[index];
    let footX = side * fx, footY = fy, footZ = 0;
    const phase = stepPhase + index * TAU / 4 + (side > 0 ? Math.PI : 0);
    if (moving) {
      const lift = Math.max(0, Math.sin(phase));
      footZ = lift * .075;
      footY -= Math.cos(phase) * .055;
    }
    if (noticing && index === 0) { footZ += .055; footY -= .03; footX += side * .02; }
    const foot = [footX, footY, footZ];
    const kneeOut = sitting ? .62 : .72;
    const knee = [hip[0] + (foot[0] - hip[0]) * kneeOut, hip[1] + (foot[1] - hip[1]) * .55, bodyHeight + (sitting ? .005 : .07) + footZ * .4];
    link(hip, knee, .036);
    link(knee, foot, .028);
    joint(knee, .018);
    if (footZ < .02) pad(foot); else joint(foot, .014);
  });

  // Body: fuzzy halo over a white shell with a graphite seam and a violet
  // accent panel on the back. The sphere projects as a circle at its centre.
  const bodyCentre = [0, 0, bodyHeight];
  const bodyScreen = screen(bodyCentre);
  const bodyDepth = depth([bodyCentre]);
  enqueue([bodyCentre], () => {
    const { x, y } = bodyScreen;
    const R = BODY_RADIUS;
    // Fur halo: a jittered polygon, then radiating tufts.
    c.beginPath();
    for (let i = 0; i < FUR_POINTS; i++) {
      const a = i / FUR_POINTS * TAU, r = R + .03 + hash(i, seed) * .022;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = FUR; c.fill();
    c.beginPath();
    for (let i = 0; i < FUR_POINTS; i++) {
      const a = (i + .5) / FUR_POINTS * TAU + (hash(i + 7, seed) - .5) * .12;
      const r0 = R - .005, r1 = R + .04 + hash(i + 50, seed) * .03;
      c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    c.strokeStyle = FUR_TUFT; c.lineWidth = .013; c.stroke();
    // White shell with a soft lower shade and a small highlight.
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = WHITE; c.fill();
    c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
    c.beginPath(); c.arc(x, y, R + .01, 0, TAU); c.arc(x - .035, y - .05, R * .97, 0, TAU, true);
    c.fillStyle = SHADE; c.globalAlpha *= .6; c.fill(); c.restore();
    c.beginPath(); c.ellipse(x - .055, y - .075, .04, .028, -.6, 0, TAU); c.fillStyle = LIGHT; c.fill();
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.strokeStyle = INK; c.lineWidth = .014; c.stroke();
  }, 0);
  // Violet accent panel: a spherical cap on the upper back, drawn from its
  // camera-facing points only.
  const cap = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU, cr = .62;
    const n = normalize([
      Math.cos(cr) * ACCENT_DIR[0] + Math.sin(cr) * (Math.cos(a) * ACCENT_U[0] + Math.sin(a) * ACCENT_V[0]),
      Math.cos(cr) * ACCENT_DIR[1] + Math.sin(cr) * (Math.cos(a) * ACCENT_U[1] + Math.sin(a) * ACCENT_V[1]),
      Math.cos(cr) * ACCENT_DIR[2] + Math.sin(cr) * (Math.cos(a) * ACCENT_U[2] + Math.sin(a) * ACCENT_V[2])]);
    if (facing(n) > .05) cap.push(screen([n[0] * BODY_RADIUS, n[1] * BODY_RADIUS, bodyHeight + n[2] * BODY_RADIUS]));
  }
  if (cap.length > 2) enqueue([bodyCentre], () => {
    c.beginPath(); cap.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath();
    c.fillStyle = VIOLET; c.fill(); c.strokeStyle = FRAME; c.lineWidth = .012; c.stroke();
  }, .001);
  seam(bodyCentre, BODY_RADIUS + .002, a => [Math.cos(a), Math.sin(a), 0], FRAME, .012, .002);
  seam(bodyCentre, BODY_RADIUS + .002, a => [0, -Math.cos(a), Math.sin(a)], FRAME, .010, .002);
  // Small tail light on the back of the shell, violet-shaded.
  const tail = [0, BODY_RADIUS * .93, bodyHeight + BODY_RADIUS * .25];
  if (facing([0, 1, .25]) > .05) {
    const q = screen(tail);
    enqueue([tail], () => { c.beginPath(); c.arc(q.x, q.y, .016, 0, TAU); c.fillStyle = VIOLET_SHADE; c.fill(); }, .003);
  }

  // Head: a smaller sphere ahead of the body with two cyan sensor eyes. Noticing
  // lifts it and tilts it sideways; sitting half-closes the eyes; a reaction
  // curves them into happy arcs.
  const headCentre = [0, -(BODY_RADIUS + .045), bodyHeight - .015 + headLift];
  const tiltNormal = n => [n[0] * Math.cos(tilt) - n[2] * Math.sin(tilt), n[1], n[0] * Math.sin(tilt) + n[2] * Math.cos(tilt)];
  const headScreen = screen(headCentre);
  link([0, -BODY_RADIUS * .85, bodyHeight - .02], [headCentre[0], headCentre[1] + .03, headCentre[2] - .01], .05);
  enqueue([headCentre], () => {
    const { x, y } = headScreen, R = HEAD_RADIUS;
    c.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU, r = R + .018 + hash(i + 90, seed) * .014;
      i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath(); c.fillStyle = FUR; c.fill();
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = WHITE; c.fill();
    c.strokeStyle = INK; c.lineWidth = .013; c.stroke();
  }, .004);
  seam(headCentre, HEAD_RADIUS + .002, a => tiltNormal(normalize([Math.cos(a) * .25, -Math.sin(a) * .3 - .5, Math.cos(a) * .9])), FRAME, .009, .005);
  for (const base of EYE_NORMALS) {
    const n = tiltNormal(base);
    if (facing(n) <= .08) continue;
    const point = [headCentre[0] + n[0] * HEAD_RADIUS, headCentre[1] + n[1] * HEAD_RADIUS, headCentre[2] + n[2] * HEAD_RADIUS];
    const q = screen(point);
    enqueue([point], () => {
      c.beginPath(); c.arc(q.x, q.y, .03, 0, TAU); c.fillStyle = SENSOR_DARK; c.fill();
      if (reaction) {
        // Happy eyes: an upward arc instead of a lens.
        c.beginPath(); c.arc(q.x, q.y + .012, .024, Math.PI * 1.12, Math.PI * 1.88);
        c.strokeStyle = CYAN; c.lineWidth = .014; c.stroke();
        c.beginPath(); c.arc(q.x, q.y + .012, .024, Math.PI * 1.22, Math.PI * 1.78);
        c.strokeStyle = CYAN_CORE; c.lineWidth = .006; c.stroke();
        return;
      }
      const open = Math.max(.003, .024 * eyeOpen);
      const bright = noticing ? 1 : .8;
      c.beginPath(); c.ellipse(q.x, q.y, .024, open, 0, 0, TAU); c.fillStyle = CYAN; c.fill();
      if (eyeOpen > .3) {
        c.beginPath(); c.ellipse(q.x - .006, q.y - .004 * eyeOpen, .009, .009 * eyeOpen, 0, 0, TAU);
        c.fillStyle = CYAN_CORE; c.globalAlpha *= bright; c.fill(); c.globalAlpha /= bright;
      }
      if (noticing) {
        c.save(); c.globalAlpha *= .35; c.beginPath(); c.arc(q.x, q.y, .04, 0, TAU); c.fillStyle = CYAN; c.fill(); c.restore();
      }
    }, .006);
  }
  // Antenna: swept back at rest; noticing raises it into a question-like hook
  // and twitches it.
  const antennaBase = [headCentre[0], headCentre[1] + .005, headCentre[2] + HEAD_RADIUS - .005];
  const twitch = noticing && !reduced ? Math.sin(time * 9) * .022 : 0;
  const antenna = noticing
    ? [antennaBase, [twitch * .5, antennaBase[1] - .01, antennaBase[2] + .075], [twitch, antennaBase[1] - .05, antennaBase[2] + .115], [twitch * 1.2, antennaBase[1] - .085, antennaBase[2] + .095]]
    : [antennaBase, [0, antennaBase[1] + .05, antennaBase[2] + .05], [0, antennaBase[1] + .11, antennaBase[2] + .065]];
  stroke(antenna, FRAME, .016, .007);
  const tip = antenna[antenna.length - 1], tipScreen = screen(tip);
  enqueue([tip], () => {
    c.beginPath(); c.arc(tipScreen.x, tipScreen.y, noticing ? .018 : .013, 0, TAU);
    c.fillStyle = noticing ? CYAN_CORE : CYAN; c.fill();
    if (noticing) { c.save(); c.globalAlpha *= .4; c.beginPath(); c.arc(tipScreen.x, tipScreen.y, .034, 0, TAU); c.fillStyle = CYAN; c.fill(); c.restore(); }
  }, .008);

  shapes.sort((a, b) => a.depth - b.depth || a.sequence - b.sequence);
  for (const shape of shapes) shape.draw();

  // Reactions: small rising hearts above the head. Reduced motion draws three
  // at fixed heights with no fade.
  if (reaction) {
    const top = headCentre[2] + HEAD_RADIUS + .12;
    const count = 3;
    for (let i = 0; i < count; i++) {
      const t = reduced ? .35 + i * .2 : ((time * .55 + i / count) % 1 + 1) % 1;
      const alpha = reduced ? .9 : Math.sin(t * Math.PI) * .95;
      if (alpha <= .02) continue;
      const drift = reduced ? 0 : Math.sin(time * 1.9 + i * 2.3) * .025;
      const point = [headCentre[0] + (i - 1) * .085 + drift, headCentre[1], top + t * .36];
      const q = screen(point), size = .034 + t * .012;
      c.save(); c.globalAlpha *= alpha;
      c.beginPath(); heartPath(c, q.x, q.y, size); c.fillStyle = HEART; c.fill();
      c.strokeStyle = HEART_LIGHT; c.lineWidth = .008; c.stroke();
      c.restore();
    }
  }
  if (pet.name) {
    const label = projectColonyPoint(pet.x, pet.y, bodyHeight + hop + .62);
    const text = String(pet.name).slice(0, 18);
    c.font = '.17px "IBM Plex Sans",sans-serif'; c.textAlign = 'center';
    c.lineWidth = .05; c.strokeStyle = '#f5f7eecc'; c.strokeText(text, label.x, label.y);
    c.fillStyle = '#465f62'; c.fillText(text, label.x, label.y);
  }
  c.restore();
}
