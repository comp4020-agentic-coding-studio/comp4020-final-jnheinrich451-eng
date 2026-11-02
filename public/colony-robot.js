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

export function drawColonyRobot(c, p, time = 0, mine = false, reduced = false) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  const angle = Number.isFinite(p.angle) ? p.angle : 0;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const driveAmount = reduced ? 0 : Number.isFinite(p.walkAmount)
    ? Math.max(0, Math.min(1, p.walkAmount)) : Math.hypot(p.vx || 0, p.vy || 0) > .025 ? 1 : 0;
  const moving = driveAmount > 0;
  // The live scene advances phase from rendered travel, so blocked movement and
  // old packets cannot keep the belts rolling. Standalone art previews use time.
  const drivePhase = moving ? Number.isFinite(p.walkPhase) ? p.walkPhase : time * 8 : 0;
  const ride = Math.sin(drivePhase * 2) * .018 * driveAmount;
  const violet = mine ? '#aaa0bc' : '#91aab1';
  const violetShade = mine ? '#887f9d' : '#718e99';
  const shapes = [];
  let sequence = 0;
  let bodyLift = 0;
  const world = ([x, y, z]) => ({ x: p.x + x * ca - y * sa, y: p.y + x * sa + y * ca, z: z + bodyLift });
  const screen = point => { const q = world(point); return projectColonyPoint(q.x, q.y, q.z); };
  const depth = points => points.reduce((sum, point) => {
    const q = world(point); return sum + (q.y - p.y) * COLONY_HEIGHT + q.z * COLONY_DEPTH;
  }, 0) / points.length;
  const visible = normal => !normal || (normal[0] * sa + normal[1] * ca) * COLONY_HEIGHT + normal[2] * COLONY_DEPTH > .005;
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

  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const ground = projectColonyPoint(p.x, p.y);
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
    const hip = [side * .21, row * .19, .60 + ride];
    const pivot = [side * .35, row * .32, .39 + compression];
    link(hip, pivot, .13);
    link(pivot, [side * .43, row * .36, .24], .10);
    joint(pivot, .065);
    track(side * .43, row * .36, side);
  }
  bodyLift = ride;
  prism(0, 0, .52, .69, .48, .47, violet, FRAME, .07);
  prism(0, 0, .67, .85, .18, .18, FRAME, FRAME, .025);
  for (const z of [.71, .77, .83]) prism(0, 0, z, z + .022, .23, .21, METAL, FRAME, .025);

  // Both auxiliary arms attach visibly to the pack, behind the shoulder roots.
  for (const rear of [true, false]) for (const side of [-1, 1]) {
    const swing = Math.sin(drivePhase * 2 + side) * .015 * driveAmount;
    const root = [side * (rear ? .23 : .39), rear ? .27 : -.075, rear ? 1.025 : 1.13];
    const elbow = [side * (rear ? .73 : .65), (rear ? .34 : -.28) + swing, rear ? .72 : .86];
    const wrist = [side * (rear ? .84 : .76), (rear ? .13 : -.51) + swing, rear ? .46 : .60];
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

  prism(0, -.05, 1.20, 1.31, .16, .16, FRAME, FRAME, .025);
  prism(0, -.085, 1.29, 1.46, .49, .34, violet, violetShade, .105);
  // One horizontal optical slit, not two eyes. It vanishes properly when the
  // robot faces away, revealing the neck and rear vents instead.
  face([[-.145, -.259, 1.40], [.145, -.259, 1.40], [.145, -.259, 1.335], [-.145, -.259, 1.335]], '#354b53', [0, -1, 0], null);
  stroke([[-.13, -.263, 1.372], [.13, -.263, 1.372]], '#91e5e9', .035, [0, -1, 0]);
  stroke([[-.105, -.265, 1.38], [.105, -.265, 1.38]], '#d8ffff', .012, [0, -1, 0]);
  for (const x of [-.09, 0, .09]) stroke([[x, .089, 1.325], [x, .089, 1.405]], FRAME, .025, [0, 1, 0]);
  stroke([[-.10, -.15, 1.463], [.10, -.15, 1.463]], '#d4cfe0', .018, [0, 0, 1]);

  shapes.sort((a, b) => a.depth - b.depth || a.sequence - b.sequence);
  for (const shape of shapes) shape.draw();
  if (!mine && p.name) {
    const label = projectColonyPoint(p.x, p.y, 1.8);
    c.font = '.22px "IBM Plex Sans",sans-serif'; c.textAlign = 'center';
    c.lineWidth = .06; c.strokeStyle = '#f5f7eecc'; c.strokeText(String(p.name).slice(0, 18), label.x, label.y);
    c.fillStyle = '#465f62'; c.fillText(String(p.name).slice(0, 18), label.x, label.y);
  }
  c.restore();
}
