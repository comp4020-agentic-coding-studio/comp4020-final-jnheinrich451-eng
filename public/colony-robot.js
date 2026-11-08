import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint } from './colony-view.js';

// The agricultural sheet supplies the upper body, not a texture: shoulder and
// backpack arms, guarded elbow rotors, visor and a vented pack. Four compact
// track pods replace its feet, using the existing distance-driven motion sample.
// Small local 3D shapes keep every heading coherent in the fixed colony view.
const TAU = Math.PI * 2;
const INK = '#52616a';
const FRAME = '#44525a';
const METAL = '#91a0a3';
const WHITE = '#f0f2eb';
const LIGHT = '#fffdf2';
const SHADE = '#bdc8c6';
const TRACK_LOOP = [[-.19, .035], [.19, .035], [.26, .105], [.26, .205],
  [.19, .275], [-.19, .275], [-.26, .205], [-.26, .105]];
const TRACK_SEGMENTS = TRACK_LOOP.map((a, i) => {
  const b = TRACK_LOOP[(i + 1) % TRACK_LOOP.length];
  return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]), normal: [0, b[1] - a[1], a[0] - b[0]] };
});
const TRACK_PERIMETER = TRACK_SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);
const TRACK_WHEEL = Array.from({ length: 10 }, (_, i) => [Math.cos(i * TAU / 10) * .063, Math.sin(i * TAU / 10) * .063]);
const ACTIVITY_KINDS = new Set(['sit', 'charge', 'brew', 'fish']);
// Resting arm targets in body-local tiles: [elbow, wrist] for the rear pack arms
// and the forward shoulder arms, mirrored by side. The standing pose blends toward
// them. Brewing is asymmetric: the robot faces the kettle (north, away from the
// camera), so the cup is raised beside the right shoulder, clear of the head
// silhouette, and the left hand crosses the chest to hold it.
const REST_ARMS = {
  sit: { rear: [[.70, .30, .60], [.80, .08, .36]], front: [[.58, -.36, .70], [.52, -.66, .44]] },
  charge: { rear: [[.72, .34, .70], [.82, .12, .44]], front: [[.62, -.30, .80], [.66, -.52, .52]] },
  brew: { rear: [[.72, .34, .70], [.82, .12, .44]], front: [[.62, -.30, .95], [.46, -.44, 1.12]], left: [[-.30, -.40, .90], [.22, -.50, 1.10]] },
  // Fishing keeps the saved heading toward the water. The right hand grips the
  // rod butt in front of the belly and the left crosses to hold it higher, so
  // the rod rises forward and to the right of the head.
  fish: { rear: [[.72, .34, .70], [.82, .12, .44]], front: [[.60, -.36, .88], [.125, -.414, .972]], left: [[-.14, -.50, 1.00], [.247, -.602, 1.252]] },
};
const BREW_CUP = [.34, -.46, 1.10];
// Fishing rod in body-local tiles: butt, unit direction and straight length. The
// two front wrists sit 0.22 and 0.58 tiles along it.
const FISH_ROD = { butt: [.05, -.30, .80], dir: [.34, -.52, .78], length: 1.6 };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** @param {number} t */
const smoothstep = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
// The rod leans to the right and turns through an elevation theta above forward-
// horizontal (the resting rod above is theta 0.98; past PI/2 it points back). The
// overhead swing straightens the lean so the raised rod reads from every side.
const ROD_SIDE = FISH_ROD.dir[0];
/** @param {number} theta @param {number} [wind] 0 at rest, 1 through the swing @returns {number[]} */
const rodDirection = (theta, wind = 0) => {
  const side = ROD_SIDE * (1 - .65 * wind), plane = Math.sqrt(1 - side * side);
  return [side, -plane * Math.cos(theta), plane * Math.sin(theta)];
};
/** Toward rising theta (back and up): where a lagging tip is displaced. @param {number} theta @returns {number[]} */
const rodSwing = theta => [0, Math.sin(theta), Math.cos(theta)];
// One cast, in seconds after activity.since (room time): the rod swings back over the
// right shoulder, loads, whips forward and settles; the float leaves the tip at
// `release`, lands at `land` with a splash, and the waiting bob takes over.
const CAST = Object.freeze({ back: .34, load: .44, whip: .6, release: .58, land: 1.0, settle: 1.1, wobble: .3, trail: .06,
  rest: Math.atan2(FISH_ROD.dir[2], -FISH_ROD.dir[1]), backTheta: 2.2, forwardTheta: .2 });
const BUTT_BACK = [.22, -.36, 1.05], BUTT_FORWARD = [.07, -.46, .90];
/** Rod elevation, butt and windup share at e seconds into a cast. @param {number} e */
function castPose(e) {
  const rest = CAST.rest, back = CAST.backTheta, forward = CAST.forwardTheta;
  if (!(e >= 0) || e >= CAST.settle + CAST.wobble) return { theta: rest, butt: FISH_ROD.butt, wind: 0 };
  if (e < CAST.back) { const k = smoothstep(e / CAST.back); return { theta: rest + (back - rest) * k, butt: lerp3(FISH_ROD.butt, BUTT_BACK, k), wind: k }; }
  if (e < CAST.load) return { theta: back + .1 * smoothstep((e - CAST.back) / (CAST.load - CAST.back)), butt: BUTT_BACK, wind: 1 };
  if (e < CAST.whip) {
    // Accelerating forward stroke: slow out of the load, fastest at the stop.
    const t = (e - CAST.load) / (CAST.whip - CAST.load), k = t * t * (2.2 - 1.2 * t);
    return { theta: back + .1 + (forward - back - .1) * k, butt: lerp3(BUTT_BACK, BUTT_FORWARD, smoothstep(t)), wind: 1 };
  }
  const k = smoothstep((e - CAST.whip) / (CAST.settle - CAST.whip)), u = (e - CAST.whip) / (CAST.settle + CAST.wobble - CAST.whip);
  return { theta: forward + (rest - forward) * k + .08 * Math.sin(u * Math.PI * 3) * (1 - u), butt: lerp3(BUTT_FORWARD, FISH_ROD.butt, k), wind: 1 - k };
}
// The hands hold the rod at these shares of its length (the upper hand slides down
// toward the reel for the overhead swing). The rod is a quadratic curve with its
// control two thirds up, so a share f sits at curve parameter t below.
/** @param {number} f */
const rodParameter = f => (1.32 - Math.sqrt(1.32 * 1.32 - 1.28 * f)) / .64;
// A seated worker's front pods hang over the seat edge this far in front of its centre.
const SEAT_EDGE = .32;

/**
 * Draws one colony worker. Reads p.x, p.y, p.angle, p.walkAmount/p.walkPhase or p.vx/p.vy,
 * p.name, p.seatHeight (tiles, while sitting) and p.activity: { kind, since, spot, bite,
 * fight: { since, colors? } } for fishing. `time` is room time in seconds.
 * @param {CanvasRenderingContext2D} c @param {any} p @param {number} [time] @param {boolean} [mine] @param {boolean} [reduced]
 */
export function drawColonyRobot(c, p, time = 0, mine = false, reduced = false) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  // Life-pace activities (sit, charge, brew, fish) hold the tracks still. Charging
  // and brewing face the furnishing one tile north; sitting and fishing keep the
  // saved heading (the server already turns an angler toward its water spot).
  const activity = p.activity && ACTIVITY_KINDS.has(p.activity.kind) ? p.activity : null;
  const keepsHeading = !activity || activity.kind === 'sit' || activity.kind === 'fish';
  const angle = keepsHeading && Number.isFinite(p.angle) ? p.angle : 0;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const driveAmount = reduced || activity ? 0 : Number.isFinite(p.walkAmount)
    ? Math.max(0, Math.min(1, p.walkAmount)) : Math.hypot(p.vx || 0, p.vy || 0) > .025 ? 1 : 0;
  const moving = driveAmount > 0;
  // The live scene advances phase from rendered travel, so blocked movement and
  // old packets cannot keep the belts rolling. Standalone art previews use time.
  const drivePhase = moving ? Number.isFinite(p.walkPhase) ? p.walkPhase : time * 8 : 0;
  // A pose settles in over half a second of simulation time from activity.since;
  // reduced motion and unknown start times hold the finished pose at once.
  const elapsed = activity && Number.isFinite(activity.since) ? time - activity.since : Infinity;
  const sitting = activity?.kind === 'sit', charging = activity?.kind === 'charge', brewing = activity?.kind === 'brew', fishing = activity?.kind === 'fish';
  // Every cast resets activity.since, so an angler's hands stay on the rod rather
  // than settling in again; the cast itself is the motion.
  const settle = !activity ? 0 : reduced || elapsed < 0 || fishing ? 1 : Math.max(0, Math.min(1, elapsed / .5));
  const ease = settle * settle * (3 - 2 * settle);
  const breathe = sitting && !reduced ? Math.sin(time * TAU * .4) * .015 : 0;
  const sway = brewing && !reduced ? Math.sin(time * TAU * .35) * .02 : 0;
  const ride = activity ? (breathe - .12) * (sitting ? ease : 0) : Math.sin(drivePhase * 2) * .018 * driveAmount;
  // A raised seat (a bench is about 0.46) lifts the worker onto it: the rear pods rest
  // on the seat under the body and the front pods hang over its front edge toward the
  // ground like legs. A flat rest pad only lifts it a little.
  const seatHeight = sitting && Number.isFinite(p.seatHeight) ? Math.max(0, Math.min(1.2, p.seatHeight)) : 0;
  const seatLift = seatHeight * ease, hang = Math.max(0, Math.min(1, (seatHeight - .12) / .25)) * ease;
  const violet = mine ? '#aaa0bc' : '#91aab1';
  const violetShade = mine ? '#887f9d' : '#718e99';
  const shapes = [];
  let sequence = 0;
  let bodyLift = 0;
  // A seated track pod is drawn through this local transform (rotation about the
  // pod's axle line, then a move); null everywhere else.
  /** @type {null | { point: (q: number[]) => number[], normal: (n: number[]) => number[] }} */
  let podPose = null;
  const world = (point) => {
    const [x, y, z] = podPose ? podPose.point(point) : point;
    return { x: p.x + x * ca - y * sa, y: p.y + x * sa + y * ca, z: z + bodyLift };
  };
  const screen = point => { const q = world(point); return projectColonyPoint(q.x, q.y, q.z); };
  const depth = points => points.reduce((sum, point) => {
    const q = world(point); return sum + (q.y - p.y) * COLONY_HEIGHT + q.z * COLONY_DEPTH;
  }, 0) / points.length;
  const visible = normal => {
    if (!normal) return true;
    const n = podPose ? podPose.normal(normal) : normal;
    return (n[0] * sa + n[1] * ca) * COLONY_HEIGHT + n[2] * COLONY_DEPTH > .005;
  };
  const enqueue = (points, draw, bias = 0) => shapes.push({ depth: depth(points) + bias, sequence: sequence++, draw });

  function face(points, fill, normal, stroke = INK, width = .022) {
    if (!visible(normal)) return;
    const projected = points.map(screen);
    enqueue(points, () => {
      c.beginPath(); projected.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath();
      c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    });
  }
  function stroke(points, color, width = .022, normal, bias = .002) {
    if (!visible(normal)) return;
    const projected = points.map(screen);
    enqueue(points, () => {
      c.beginPath(); projected.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.strokeStyle = color; c.lineWidth = width; c.stroke();
    }, bias);
  }
  function joint(point, radius = .075) {
    const q = screen(point);
    enqueue([point], () => {
      c.beginPath(); c.arc(q.x, q.y, radius, 0, TAU); c.fillStyle = FRAME; c.fill();
      c.strokeStyle = METAL; c.lineWidth = .022; c.stroke();
      c.beginPath(); c.arc(q.x, q.y, radius * .33, 0, TAU); c.fillStyle = SHADE; c.fill();
    }, .002);
  }
  function link(a, b, width = .09) {
    stroke([a, b], FRAME, width, null, 0);
    stroke([a, b], METAL, width * .36, null, .001);
  }
  function prism(x, y, z0, z1, width, length, top = WHITE, side = SHADE, bevel = .04) {
    const a = width / 2, b = length / 2, k = Math.min(bevel, a * .5, b * .5);
    const outline = [[-a + k, -b], [a - k, -b], [a, -b + k], [a, b - k], [a - k, b], [-a + k, b], [-a, b - k], [-a, -b + k]];
    face(outline.map(([dx, dy]) => [x + dx, y + dy, z1]), top, [0, 0, 1]);
    outline.forEach(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length];
      const nx = by - ay, ny = ax - bx;
      const color = nx * ca - ny * sa < -.02 ? side : top === FRAME ? '#56656a' : '#d8dfd9';
      face([[x + ax, y + ay, z0], [x + bx, y + by, z0], [x + bx, y + by, z1], [x + ax, y + ay, z1]], color, [nx, ny, 0]);
    });
  }
  function rotor(center, side, rear) {
    const radius = rear ? .118 : .137;
    const normal = [side * .6, -.8, 0], tangent = [.8, side * .6, 0];
    const point = (a, r = radius) => [center[0] + tangent[0] * Math.cos(a) * r, center[1] + tangent[1] * Math.cos(a) * r, center[2] + Math.sin(a) * r];
    // Both faces have a guarded housing. Only the forward face shows blades.
    const rim = Array.from({ length: 18 }, (_, i) => point(i * TAU / 18));
    face(rim, '#5f7176', null, '#d6ddda', .033);
    if (visible(normal)) {
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + (moving ? drivePhase * .25 : .35);
        stroke([point(a, radius * .68), center, point(a + .32, radius * .64)], '#cad7ce', .025, null, .004);
      }
      const q = screen(center);
      enqueue([center], () => { c.beginPath(); c.arc(q.x, q.y, .026, 0, TAU); c.fillStyle = '#9ed6d5'; c.fill(); }, .005);
    }
  }
  function hand(x, y, z, side) {
    prism(x, y, z - .05, z + .055, .12, .15, METAL, FRAME, .025);
    for (let digit = 0; digit < 3; digit++) {
      const dx = (digit - 1) * .044;
      stroke([[x + dx, y - .05, z - .015], [x + dx, y - .12, z - .08], [x + dx, y - .15, z - .06]], FRAME, .026);
    }
    stroke([[x + side * .06, y, z], [x + side * .11, y - .07, z - .04]], FRAME, .033);
  }

  function track(x, y, side) {
    const halfWidth = .13;
    // A closed belt with chamfered ends. Its bottom stays planted; the short
    // suspension above it absorbs the movement rather than lifting the hull.
    const point = (dx, yz) => [x + dx, y + yz[0], yz[1]];
    for (const edge of [-1, 1]) {
      const normal = [edge, 0, 0];
      face(TRACK_LOOP.map(yz => point(edge * halfWidth, yz)), '#334247', normal, '#899895', .02);
      if (!visible(normal)) continue;
      // Three recessed road wheels behind the belt, with a shared hub line.
      const wheelX = edge * (halfWidth + .003);
      const centers = [-.16, 0, .16];
      for (const cy of centers) {
        face(TRACK_WHEEL.map(([dy, dz]) => point(wheelX, [cy + dy, .155 + dz])), '#8c9b9b', normal, '#25393e', .015);
      }
      stroke([point(wheelX, [-.16, .155]), point(wheelX, [.16, .155])], FRAME, .027, normal, .006);
    }
    for (const { a, b, normal } of TRACK_SEGMENTS) {
      face([point(-halfWidth, a), point(halfWidth, a), point(halfWidth, b), point(-halfWidth, b)],
        normal[2] > 0 ? '#56696b' : '#3b4c50', normal, null);
    }
    // Twelve cleats wrap the belt, batched into one stroke per visible pod.
    // Seven pitches per 0.8-tile motion cycle keep the pattern continuous when
    // the shared phase wraps, and match belt travel closely at playing scale.
    const shift = ((drivePhase / TAU * 7) % 1 + 1) % 1;
    const cleats = [];
    for (let i = 0; i < 12; i++) {
      let distance = (i + shift) / 12 * TRACK_PERIMETER;
      for (const segment of TRACK_SEGMENTS) {
        if (distance > segment.length) { distance -= segment.length; continue; }
        if (visible(segment.normal)) {
          const t = distance / segment.length;
          const yz = segment.a.map((v, axis) => v + (segment.b[axis] - v) * t);
          cleats.push([point(-halfWidth, yz), point(halfWidth, yz)]);
        }
        break;
      }
    }
    const projected = cleats.map(line => line.map(screen));
    enqueue(cleats.flat(), () => {
      c.beginPath();
      for (const [a, b] of projected) { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
      c.strokeStyle = '#a8b4ac'; c.lineWidth = .018; c.stroke();
    }, .008);
    // Short white mudguard leaves the curved belt ends and outer wheels exposed.
    prism(x, y, .278, .345, .29, .30, WHITE, SHADE, .035);
    stroke([[x - .08, y - .06, .348], [x + .08, y - .06, .348]], side < 0 ? violet : violetShade, .035, [0, 0, 1]);
  }

  /**
   * Seated pod pose. Rear pods rest on the seat, tucked under the body; front pods
   * pivot about their upper rear edge at the seat's front edge and tip nose-down
   * until the nose just clears the ground. @param {number} row -1 front, 1 rear
   */
  function seatedPod(row) {
    const centre = row * .36, pivotY = .20, pivotZ = .30;
    let anchorY = (row > 0 ? centre + (.06 - centre) * ease : centre) + pivotY, anchorZ = seatLift + pivotZ, pitch = 0;
    if (row < 0 && hang > 0) {
      // Front-bottom corner relative to the pivot is (-.46, -.265): solve for the
      // pitch that leaves it 0.04 above the ground.
      const edgeZ = seatLift - .02, reach = Math.hypot(.46, .265), clear = Math.max(-1, Math.min(1, (edgeZ - .04) / reach));
      const hangPitch = Math.max(0, Math.min(1.1, Math.asin(clear) - Math.atan2(.265, .46)));
      anchorY += (-SEAT_EDGE + .02 - anchorY) * hang; anchorZ += (edgeZ - anchorZ) * hang; pitch = hangPitch * hang;
    }
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    /** @param {number[]} q */
    const point = q => { const vy = q[1] - centre - pivotY, vz = q[2] - pivotZ; return [q[0], anchorY + vy * cp - vz * sp, anchorZ + vy * sp + vz * cp]; };
    /** @param {number[]} n */
    const normal = n => [n[0], n[1] * cp - n[2] * sp, n[1] * sp + n[2] * cp];
    return { point, normal };
  }

  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const ground = projectColonyPoint(p.x, p.y, seatLift);
  c.beginPath(); c.ellipse(ground.x + .06, ground.y + .07, .73, .53 * COLONY_DEPTH, 0, 0, TAU);
  c.fillStyle = '#36484924'; c.fill();
  if (mine) {
    c.beginPath(); c.ellipse(ground.x, ground.y, .76, .56 * COLONY_DEPTH, 0, 0, TAU);
    c.strokeStyle = '#f7fbec9c'; c.lineWidth = .022; c.stroke();
  }

  // Four separate track pods retain the worker's four-corner stance. Suspension
  // compresses lightly while moving, with no changes to ground contact/collision.
  for (const row of [-1, 1]) for (const side of [-1, 1]) {
    const compression = Math.sin(drivePhase * 2 + side * row) * .015 * driveAmount;
    if (seatLift > 0) {
      // Seated: the pod moves as one piece and the suspension follows it.
      const pose = seatedPod(row);
      const hip = [side * .21, row * .19, .60 + ride + seatLift], foot = pose.point([side * .43, row * .36, .24]);
      const pivot = [side * .36, (hip[1] + foot[1]) / 2, (hip[2] + foot[2]) / 2 + .02];
      link(hip, pivot, .13); link(pivot, foot, .10); joint(pivot, .065);
      podPose = pose; track(side * .43, row * .36, side); podPose = null;
      continue;
    }
    const hip = [side * .21, row * .19, .60 + ride];
    const pivot = [side * .35, row * .32, .39 + compression];
    link(hip, pivot, .13);
    link(pivot, [side * .43, row * .36, .24], .10);
    joint(pivot, .065);
    track(side * .43, row * .36, side);
  }
  bodyLift = ride + seatLift;
  prism(0, 0, .52, .69, .48, .47, violet, FRAME, .07);
  prism(0, 0, .67, .85, .18, .18, FRAME, FRAME, .025);
  for (const z of [.71, .77, .83]) prism(0, 0, z, z + .022, .23, .21, METAL, FRAME, .025);

  // ---- Fishing: one rod pose per frame, shared by the hands and the rod ----
  const fight = fishing && activity.fight ? activity.fight : null;
  const spot = fishing ? activity.spot : null;
  // The float's water point in body-local tiles (the robot faces it).
  const water = spot && Number.isFinite(spot.x) && Number.isFinite(spot.y)
    ? [(spot.x - p.x) * ca + (spot.y - p.y) * sa, -(spot.x - p.x) * sa + (spot.y - p.y) * ca, 0] : null;
  const fightTime = fight ? Number.isFinite(fight.since) ? Math.max(0, time - fight.since) : Math.max(0, time) : 0;
  const jerk = fight && !reduced ? Math.sin(fightTime * TAU * 1.7) * .6 + Math.sin(fightTime * TAU * 4.3 + 1.1) * .4 : 0;
  // A hooked fish pulls the line about the float's spot.
  const fishPoint = fight && water ? [water[0] + (reduced ? .06 : .13 * Math.sin(fightTime * 2.1) + .05 * Math.sin(fightTime * 5.3)),
    water[1] + (reduced ? -.04 : .1 * Math.sin(fightTime * 1.7 + 1)), 0] : null;
  const castTime = fishing && !reduced && !fight ? elapsed : Infinity;
  const bitePhase = ((time / .4) % 1 + 1) % 1;
  const biting = fishing && !fight && !!activity.bite;
  // Waiting droop: the tip sags toward the line; a bite bends it further and twitches it.
  const droop = reduced ? (biting ? .34 : .10) : biting ? .30 + Math.sin(bitePhase * TAU) * .06 : .10 + Math.sin(time * TAU * .6) * .015;
  /** The rod at e seconds into the cast (or in the fight): butt, straight direction, tip, windup. @param {number} e */
  function rodAt(e) {
    if (fight) {
      // Held up against the pull and bent hard toward the fish, with small jerks.
      const theta = .78 + .05 * jerk, butt = lerp3(FISH_ROD.butt, BUTT_FORWARD, .6), dir = rodDirection(theta);
      const straight = butt.map((v, i) => v + dir[i] * FISH_ROD.length);
      const target = fishPoint || [straight[0], straight[1] - .5, 0];
      const to = target.map((v, i) => v - straight[i]), n = Math.hypot(to[0], to[1], to[2]) || 1, pull = .82 + .1 * jerk;
      return { butt, dir, tip: straight.map((v, i) => v + to[i] / n * pull), wind: 0 };
    }
    const pose = castPose(e), dir = rodDirection(pose.theta, pose.wind), swing = rodSwing(pose.theta);
    // The tip lags the swing: back while whipping forward, forward on the backswing.
    const lag = Math.max(-.42, Math.min(.42, FISH_ROD.length * (castPose(e - .05).theta - pose.theta) * .45));
    const tip = pose.butt.map((v, i) => v + dir[i] * FISH_ROD.length + swing[i] * lag);
    tip[2] -= droop;
    return { butt: pose.butt, dir, tip, wind: pose.wind };
  }
  const rod = fishing ? rodAt(castTime) : null;
  /** A point on the rod's curve at parameter t (0 butt, 1 tip). @param {{ butt: number[], dir: number[], tip: number[] }} r @param {number} t */
  const rodPoint = (r, t) => {
    const control = r.butt.map((v, i) => v + r.dir[i] * FISH_ROD.length * .66);
    return r.butt.map((v, i) => (1 - t) * (1 - t) * v + 2 * (1 - t) * t * control[i] + t * t * r.tip[i]);
  };

  // Both auxiliary arms attach visibly to the pack, behind the shoulder roots.
  for (const rear of [true, false]) for (const side of [-1, 1]) {
    const swing = Math.sin(drivePhase * 2 + side) * .015 * driveAmount;
    const root = [side * (rear ? .23 : .39), rear ? .27 : -.075, rear ? 1.025 : 1.13];
    let elbow = [side * (rear ? .73 : .65), (rear ? .34 : -.28) + swing, rear ? .72 : .86];
    let wrist = [side * (rear ? .84 : .76), (rear ? .13 : -.51) + swing, rear ? .46 : .60];
    if (activity) {
      const pose = REST_ARMS[activity.kind], crossing = (brewing || fishing) && !rear && side < 0;
      const [restElbow, restWrist] = pose[rear ? 'rear' : crossing ? 'left' : 'front'];
      const mirror = crossing ? 1 : side, drift = rear ? 0 : sway;
      elbow = lerp3(elbow, [mirror * restElbow[0], restElbow[1] + drift, restElbow[2]], ease);
      wrist = lerp3(wrist, [mirror * restWrist[0], restWrist[1] + drift, restWrist[2]], ease);
      if (rod && !rear) {
        // The hands ride the rod: the right 0.22 tiles up it, the left 0.58 (sliding
        // down toward the reel for the overhead swing). Elbows follow part way.
        const grip = rodPoint(rod, rodParameter((crossing ? .58 - .26 * rod.wind : .22) / FISH_ROD.length));
        const delta = grip.map((v, i) => v - wrist[i]);
        elbow = [elbow[0] + delta[0] * .6, elbow[1] + delta[1] * .3, elbow[2] + delta[2] * .6];
        wrist = grip;
      }
    }
    link(root, elbow, .12); link(elbow, wrist, .09); joint(root, .077);
    const mid = root.map((value, i) => value * .4 + elbow[i] * .6);
    prism(mid[0], mid[1], mid[2] - .07, mid[2] + .07, .17, .22, rear ? violet : WHITE, SHADE, .035);
    prism(wrist[0] * .97, wrist[1], wrist[2] + .015, wrist[2] + .13, .13, .18, violet, violetShade, .03);
    rotor(elbow, side, rear); hand(wrist[0], wrist[1] - .05, wrist[2] - .02, side);
  }

  // Broad low torso with white roof panels and a violet front equipment plate.
  prism(0, -.015, .87, 1.21, .80, .49, WHITE, SHADE, .115);
  prism(0, .295, .88, 1.18, .51, .22, '#dce2dc', SHADE, .045);
  face([[-.235, .412, .93], [.235, .412, .93], [.235, .412, 1.13], [-.235, .412, 1.13]], FRAME, [0, 1, 0]);
  for (let i = 0; i < 5; i++) {
    const z = .955 + i * .033;
    stroke([[-.195, .415, z], [.195, .415, z]], '#a2b0ab', .015, [0, 1, 0]);
  }
  stroke([[-.15, .415, .905], [.15, .415, .905]], '#a9e7df', .025, [0, 1, 0]);
  face([[-.29, -.264, 1.17], [.29, -.264, 1.17], [.31, -.264, 1.01], [.17, -.264, .90], [-.17, -.264, .90], [-.31, -.264, 1.01]], violet, [0, -1, 0]);
  face([[-.13, -.268, 1.09], [.13, -.268, 1.09], [0, -.268, .97]], FRAME, [0, -1, 0], INK, .012);
  stroke([[-.075, -.272, 1.075], [.075, -.272, 1.075]], '#a8e2e0', .021, [0, -1, 0]);
  // Metal roof ribs and a small gold branch mark remain readable at play scale.
  stroke([[-.27, -.10, 1.213], [-.27, .12, 1.213]], '#b2bdbb', .017, [0, 0, 1]);
  stroke([[.27, -.10, 1.213], [.27, .12, 1.213]], '#b2bdbb', .017, [0, 0, 1]);
  stroke([[-.06, .11, 1.215], [0, .07, 1.215], [.06, .11, 1.215]], '#bca877', .022, [0, 0, 1]);
  for (const side of [-1, 1]) prism(side * .40, -.02, 1.10, 1.26, .20, .26, WHITE, SHADE, .055);

  if (brewing && ease > .999) {
    // A small white cup held in both hands beside the right shoulder, with three
    // steam puffs that climb, spread and fade. Reduced motion keeps the cup and
    // drops the steam.
    const [cupX, cupBase, cupZ] = BREW_CUP, cupY = cupBase + sway;
    prism(cupX, cupY, cupZ, cupZ + .12, .15, .15, '#f4f2e6', SHADE, .03);
    face([[cupX - .05, cupY - .05, cupZ + .122], [cupX + .05, cupY - .05, cupZ + .122], [cupX + .05, cupY + .05, cupZ + .122], [cupX - .05, cupY + .05, cupZ + .122]], '#6a4b3c', [0, 0, 1], null);
    if (!reduced) for (let i = 0; i < 3; i++) {
      const t = ((time * .55 + i / 3) % 1 + 1) % 1;
      const point = [cupX + (i - 1) * .03 + Math.sin(time * 1.3 + i * 2.1) * .04, cupY - .02, cupZ + .15 + t * .42];
      const q = screen(point), radius = .035 + t * .05, alpha = (1 - t) * .45;
      enqueue([point], () => {
        c.save(); c.globalAlpha *= alpha; c.beginPath(); c.arc(q.x, q.y, radius, 0, TAU); c.fillStyle = '#f6faf4'; c.fill(); c.restore();
      }, .01);
    }
  }
  if (rod) {
    // A slim graphite rod in both front hands. A cast swings it back over the right
    // shoulder and whips it forward; the float flies out on its line and lands with a
    // splash ring before the waiting bob takes over. A bite bends the tip and twitches
    // it; a hooked fish bends the rod hard, pulls the float under and thrashes at the
    // spot. Reduced motion shows the settled pose, a still bent rod and a still ring.
    const curve = Array.from({ length: 13 }, (_, i) => rodPoint(rod, i / 12));
    for (let i = 0; i < 12; i++) {
      const width = .046 - i * .0024;
      stroke([curve[i], curve[i + 1]], '#3e4c52', width, null, .003);
      stroke([curve[i], curve[i + 1]], '#8e9ea1', width * .3, null, .004);
    }
    const along = (/** @type {number} */ t) => rod.butt.map((v, i) => v + rod.dir[i] * t);
    stroke([along(.02), along(.32)], '#2b363b', .062, null, .005);
    const reel = along(.30); reel[2] -= .085;
    const reelQ = screen(reel);
    enqueue([reel], () => {
      c.beginPath(); c.arc(reelQ.x, reelQ.y, .055, 0, TAU); c.fillStyle = FRAME; c.fill();
      c.strokeStyle = METAL; c.lineWidth = .02; c.stroke();
    }, .006);
    const tip = rod.tip, LINE = 'rgba(238,244,236,.82)';
    /** @param {number[][]} points @param {string} [color] @param {number} [width] */
    const line = (points, color = LINE, width = .014) => { for (let i = 0; i + 1 < points.length; i++) stroke([points[i], points[i + 1]], color, width, null, .003); };
    /** Quadratic line from a through control to b. @param {number[]} a @param {number[]} control @param {number[]} b */
    const curveLine = (a, control, b) => line(Array.from({ length: 13 }, (_, i) => {
      const t = i / 12; return a.map((v, k) => (1 - t) * (1 - t) * v + 2 * (1 - t) * t * control[k] + t * t * b[k]);
    }));
    /** White-and-violet float: white body, violet waterline band, pale stem with a violet tip. @param {number[]} bob @param {number} alpha */
    const float = (bob, alpha) => {
      const stemTop = [bob[0], bob[1], bob[2] + .16], floatQ = screen(bob), stemQ = screen(stemTop);
      enqueue([bob, stemTop], () => {
        c.save(); c.globalAlpha *= alpha;
        c.beginPath(); c.moveTo(floatQ.x, floatQ.y); c.lineTo(stemQ.x, stemQ.y); c.strokeStyle = LIGHT; c.lineWidth = .028; c.stroke();
        c.beginPath(); c.arc(floatQ.x, floatQ.y, .075, 0, TAU); c.fillStyle = WHITE; c.fill();
        c.beginPath(); c.arc(floatQ.x, floatQ.y, .075, Math.PI * .12, Math.PI * .88); c.closePath(); c.fillStyle = violet; c.fill();
        c.beginPath(); c.arc(floatQ.x, floatQ.y, .075, 0, TAU); c.strokeStyle = INK; c.lineWidth = .015; c.stroke();
        c.beginPath(); c.arc(stemQ.x, stemQ.y, .03, 0, TAU); c.fillStyle = violet; c.fill();
        c.restore();
      }, .006);
      return stemTop;
    };
    /** A ring on the water plane round a body-local point. @param {number[]} at @param {number} radius @param {number} alpha @param {number} [width] */
    const ring = (at, radius, alpha, width = .02) => {
      const q = screen(at);
      enqueue([at], () => {
        c.save(); c.globalAlpha *= alpha; c.beginPath();
        c.ellipse(q.x, q.y, radius, radius * COLONY_DEPTH, 0, 0, TAU);
        c.strokeStyle = '#f3f8f1'; c.lineWidth = width; c.stroke(); c.restore();
      }, .004);
    };
    /** Droplets thrown from a point, t seconds after the burst; seed varies the directions. @param {number[]} at @param {number} t @param {number} seed @param {number} count @param {number} speed */
    const droplets = (at, t, seed, count, speed) => {
      for (let i = 0; i < count; i++) {
        const angle = seed * 2.39996 + i * TAU / count, s = speed * (.65 + .35 * Math.abs(Math.sin(seed * 7.1 + i * 3.7)));
        const z = at[2] + (1.25 + .3 * Math.sin(seed + i)) * t - 7.5 * t * t;
        if (z < at[2] - .01) continue;
        const point = [at[0] + Math.cos(angle) * s * t, at[1] + Math.sin(angle) * s * t, z], q = screen(point);
        const r = .024 - .01 * Math.min(1, t * 3);
        enqueue([point], () => { c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.fillStyle = '#eef8f6'; c.fill(); }, .008);
      }
    };
    if (water) {
      const base = [water[0], water[1], -bodyLift];
      if (fight && fishPoint) {
        const entry = [fishPoint[0], fishPoint[1], -bodyLift];
        line([tip, entry], 'rgba(244,248,240,.95)', .016);
        // The float is dragged under: a pale shape just below the surface.
        const under = [entry[0] * .9 + base[0] * .1, entry[1] * .9 + base[1] * .1, -bodyLift - .06], uq = screen(under);
        enqueue([under], () => {
          c.save(); c.globalAlpha *= .3; c.beginPath(); c.ellipse(uq.x, uq.y, .07, .05, 0, 0, TAU); c.fillStyle = WHITE; c.fill(); c.restore();
        }, .002);
        if (reduced) ring(entry, .3, .5, .024);
        else {
          for (let k = 0; k < 3; k++) { const u = ((fightTime / .9 + k / 3) % 1 + 1) % 1; ring(entry, .08 + u * .52, (1 - u) * .55); }
          // Churned foam round the line.
          const foamQ = screen(entry), foam = .4 + .15 * Math.sin(fightTime * 19);
          enqueue([entry], () => {
            c.save(); c.globalAlpha *= foam; c.beginPath(); c.ellipse(foamQ.x, foamQ.y, .17, .17 * COLONY_DEPTH, 0, 0, TAU);
            c.fillStyle = '#f2f8f4'; c.fill(); c.restore();
          }, .005);
          // Bursts of spray; in each, the fish's tail flashes out of the water.
          const period = .55, burst = Math.floor(fightTime / period), t = fightTime - burst * period;
          droplets(entry, t, burst, 7, .55);
          if (t < .3) {
            const rise = Math.sin(t / .3 * Math.PI), sideways = Math.sin(burst * 2.7) > 0 ? 1 : -1;
            const colors = fight.colors || {}, fill = typeof colors.fin === 'string' ? colors.fin : '#9fd6cf';
            const edge = typeof colors.accent === 'string' ? colors.accent : '#2d6b7a';
            const tailQ = screen([entry[0] + sideways * .05, entry[1], entry[2]]);
            enqueue([entry], () => {
              c.save(); c.translate(tailQ.x, tailQ.y); c.rotate(sideways * (.25 + .35 * Math.sin(t * 22)));
              const h = .4 * rise;
              c.beginPath(); c.moveTo(-.045, 0); c.lineTo(-.026, -h * .5);
              c.quadraticCurveTo(-.15, -h * .8, -.2, -h * 1.05); c.quadraticCurveTo(-.07, -h * .8, 0, -h * .68);
              c.quadraticCurveTo(.07, -h * .8, .2, -h * 1.05); c.quadraticCurveTo(.15, -h * .8, .026, -h * .5);
              c.lineTo(.045, 0); c.closePath();
              c.fillStyle = fill; c.fill(); c.strokeStyle = edge; c.lineWidth = .018; c.stroke();
              c.restore();
            }, .007);
          }
        }
      } else if (castTime < CAST.release) {
        // Before release the float swings on a short drop below the tip.
        const dangle = rodAt(castTime - CAST.trail).tip;
        const stemTop = float([dangle[0], dangle[1], dangle[2] - .34], 1);
        line([tip, stemTop]);
      } else if (castTime < CAST.land) {
        // In flight: the float arcs out to the water and the line pays out from the
        // tip in a lofted curve that flattens as the float comes down.
        const released = rodAt(CAST.release - CAST.trail).tip, from = [released[0], released[1], released[2] - .34];
        const reach = Math.hypot(base[0] - from[0], base[1] - from[1]), arc = .45 + .12 * reach;
        /** @param {number} u */
        const flight = u => {
          const h = 1 - Math.pow(1 - u, 1.6);
          return [from[0] + (base[0] - from[0]) * h, from[1] + (base[1] - from[1]) * h, from[2] + (base[2] - from[2]) * u + arc * 4 * u * (1 - u)];
        };
        const u = (castTime - CAST.release) / (CAST.land - CAST.release), at = flight(u);
        const stemTop = float(at, 1), loft = .2 + .5 * (1 - u);
        curveLine(tip, tip.map((v, i) => (v + stemTop[i]) / 2 + (i === 2 ? loft : 0)), stemTop);
      } else {
        // Waiting. Just after landing the float plunges and bobs back while the line
        // drops from its arc into a slack curve on the water.
        const landed = castTime - CAST.land, fresh = landed < 1.2;
        let dip = 0;
        if (!reduced) {
          const idle = biting
            ? bitePhase < .55 ? -.14 * Math.sin(bitePhase / .55 * Math.PI) : .035 * Math.sin((bitePhase - .55) / .45 * Math.PI)
            : Math.sin(time * TAU * .6) * .03;
          dip = fresh ? idle * smoothstep(landed / .6) - .1 * Math.exp(-landed * 6) * Math.cos(landed * 13) : idle;
        }
        const bob = [base[0], base[1], base[2] + dip];
        const submerged = bob[2] < base[2] ? Math.max(.3, 1 + (bob[2] - base[2]) * 5) : 1;
        const stemTop = float(bob, submerged);
        const control = tip.map((v, i) => (v + stemTop[i]) / 2);
        control[2] -= biting ? .06 : .32;
        // The line settles from the flight's last loft (0.2 above the chord) to slack.
        const settled = fresh ? smoothstep(landed / .3) : 1, aloft = control[2] + (biting ? .06 : .32) + .2;
        control[2] = aloft + (control[2] - aloft) * settled;
        curveLine(tip, control, stemTop);
        if (!reduced) {
          if (fresh && landed < .75) {
            // Splash: two quick rings and a crown of droplets.
            for (const delay of [0, .16]) {
              const u = (landed - delay) / .6;
              if (u >= 0 && u < 1) ring(base, .06 + u * .46, (1 - u) * .7, .024);
            }
            droplets(base, landed, 3, 6, .45);
          }
          // Rings: two chasing rings while a fish pulls, otherwise one slow ring every few seconds.
          const idle = ((time / 3.4) % 1 + 1) % 1;
          const rings = biting ? [bitePhase, (bitePhase + .5) % 1] : idle < .4 && !fresh ? [idle / .4] : [];
          for (const u of rings) ring(base, .09 + u * (biting ? .34 : .42), (1 - u) * (biting ? .55 : .35));
        }
      }
    }
  }
  if (charging) {
    // The cable leaves a socket on the pack, arcs over the head and drops to the
    // post head one tile north. A bright pulse runs post-to-pack about once a second.
    const rootPoint = [0, .30, 1.19], apex = [0, -.22, 1.78], end = [0, -.86, 1.18];
    const along = t => rootPoint.map((v, i) => (1 - t) * (1 - t) * v + 2 * (1 - t) * t * apex[i] + t * t * end[i]);
    prism(0, .30, 1.18, 1.24, .11, .09, FRAME, FRAME, .02);
    const points = Array.from({ length: 15 }, (_, i) => along(i / 14));
    for (let i = 0; i < 14; i++) {
      stroke([points[i], points[i + 1]], '#3e4c52', .045, null, .003);
      stroke([points[i], points[i + 1]], '#8e9ea1', .016, null, .004);
    }
    if (!reduced) {
      const t = ((time % 1) + 1) % 1, point = along(1 - t), q = screen(point);
      enqueue([point], () => {
        c.save(); c.globalAlpha *= .45; c.beginPath(); c.arc(q.x, q.y, .085, 0, TAU); c.fillStyle = '#9fe9ee'; c.fill(); c.restore();
        c.beginPath(); c.arc(q.x, q.y, .04, 0, TAU); c.fillStyle = '#e6ffff'; c.fill();
      }, .006);
    }
  }
  prism(0, -.05, 1.20, 1.31, .16, .16, FRAME, FRAME, .025);
  prism(0, -.085, 1.29, 1.46, .49, .34, violet, violetShade, .105);
  // One horizontal optical slit, not two eyes. It vanishes properly when the
  // robot faces away, revealing the neck and rear vents instead.
  face([[-.145, -.259, 1.40], [.145, -.259, 1.40], [.145, -.259, 1.335], [-.145, -.259, 1.335]], '#354b53', [0, -1, 0], null);
  stroke([[-.13, -.263, 1.372], [.13, -.263, 1.372]], '#91e5e9', .035, [0, -1, 0]);
  stroke([[-.105, -.265, 1.38], [.105, -.265, 1.38]], '#d8ffff', .012, [0, -1, 0]);
  if (charging) {
    // The visor brightens and dims slowly while power flows; reduced motion holds a mid glow.
    const glow = reduced ? .5 : Math.sin(time * TAU / 2.6) * .5 + .5;
    stroke([[-.13, -.27, 1.372], [.13, -.27, 1.372]], `rgba(190,245,248,${(.15 + .45 * glow).toFixed(3)})`, .05 + glow * .035, [0, -1, 0], .003);
  }
  for (const x of [-.09, 0, .09]) stroke([[x, .089, 1.325], [x, .089, 1.405]], FRAME, .025, [0, 1, 0]);
  stroke([[-.10, -.15, 1.463], [.10, -.15, 1.463]], '#d4cfe0', .018, [0, 0, 1]);

  shapes.sort((a, b) => a.depth - b.depth || a.sequence - b.sequence);
  for (const shape of shapes) shape.draw();
  if (!mine && p.name) {
    const label = projectColonyPoint(p.x, p.y, 1.8 + seatLift);
    c.font = '.22px "IBM Plex Sans",sans-serif'; c.textAlign = 'center';
    c.lineWidth = .06; c.strokeStyle = '#f5f7eecc'; c.strokeText(String(p.name).slice(0, 18), label.x, label.y);
    c.fillStyle = '#465f62'; c.fillText(String(p.name).slice(0, 18), label.x, label.y);
  }
  c.restore();
}
