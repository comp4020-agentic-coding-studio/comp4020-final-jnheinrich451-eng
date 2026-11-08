import { relativeMovement, FLAME, WEAPONS } from './weapons.js';
import { raycast } from './raycast.js';
import { windAt } from './wind.js';

// Overhead humanoid combat robot, facing -y. The right arm ends in the weapon (no
// hand): a flamethrower barrel over a laser emitter, fed by a hose from the fuel
// pack. The left hand grips the gun, thumb on the release. The gun axis sits just
// right of centre so the existing flame and laser effects leave its muzzle.
export function drawRobot(c, angle, vx, vy, phase, mine, lights = 0) {
  const local = relativeMovement(angle, vx, vy), speed = Math.hypot(vx, vy);
  const stride = speed > .02 ? Math.sin(phase) * 6 : 0;
  const sideways = speed ? local.right / speed : 0, forward = speed ? local.forward / speed : 0;
  const armor = mine ? '#d8b230' : '#819e93', edge = mine ? '#f4dc7c' : '#c1d4cb', frame = '#263a3d', dark = '#18282c', metal = '#4a5a5c';
  const poly = (points, fill, stroke) => { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.stroke(); } };
  const limb = (points, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
  c.save(); c.rotate(angle); c.lineWidth = 1;
  // Clawed feet alternate along the actual local movement vector; backward and
  // sideways motion change the gait without turning the weapon away.
  for (const side of [-1, 1]) {
    const x = side * 8 + sideways * stride * side, y = 6 - forward * stride * side;
    poly([[x - 2.6, y + 7], [x - 3, y - 3], [x - 2, y - 8], [x, y - 10], [x + 2, y - 8], [x + 3, y - 3], [x + 2.6, y + 7]], dark, '#5d7072');
    c.fillStyle = metal; c.fillRect(x - 1.5, y - 2, 3, 6);
  }
  // Hips, then a compact fuel pack on the back feeding a hose along the right arm.
  poly([[-6, 2], [6, 2], [4.5, 8], [-4.5, 8]], frame);
  poly([[-4, 5], [4, 5], [4, 11], [-4, 11]], '#5e342c', '#8f4c3f');
  c.fillStyle = '#8f4c3f'; for (const x of [-2, 2]) { c.beginPath(); c.arc(x, 8, 1.3, 0, Math.PI * 2); c.fill(); }
  limb([[3, 8], [11, 6], [13, -4], [8, -11]], 1.6, '#9b3a32');
  // Torso: a broad armoured chest plate with a darker spine.
  poly([[-9, -6], [9, -6], [11, 1], [7, 5], [-7, 5], [-11, 1]], armor, edge);
  poly([[-5.5, -4.5], [5.5, -4.5], [6.5, .5], [-6.5, .5]], '#a3946f');
  c.fillStyle = frame; c.fillRect(-1, -6, 2, 11);
  // Left arm: shoulder, elbow, and a hand wrapped round the gun with the thumb on top.
  limb([[-12, 0], [-13, -8], [-3, -15]], 4.2, frame);
  limb([[-12, 0], [-13, -8], [-3, -15]], 2, metal);
  poly([[-4, -18], [0, -18], [0, -12], [-4, -12]], armor, edge);
  c.fillStyle = edge; c.fillRect(-.5, -17, 2.5, 2.5);
  // Right arm becomes the weapon housing: no hand.
  limb([[12, 0], [12, -8], [7, -12]], 4.6, frame);
  limb([[12, 0], [12, -8], [7, -12]], 2.2, metal);
  // Laser emitter underneath shows along both sides and ends in a red lens.
  poly([[-1, -9], [7, -9], [7, -28], [5.5, -30], [.5, -30], [-1, -28]], '#2b3638', '#6a7b7b');
  c.fillStyle = '#ff3d3d'; c.fillRect(1, -30.5, 4, 1.6); c.fillStyle = '#ff3d3d55'; c.fillRect(0, -32, 6, 2);
  // Flamethrower barrel on top: ribbed body and a perforated nozzle.
  poly([[0, -10], [6, -10], [6, -30], [0, -30]], '#3d4b4d', '#7f8e8b');
  c.strokeStyle = '#26333566'; c.beginPath(); for (let y = -26; y <= -14; y += 2) { c.moveTo(.6, y); c.lineTo(5.4, y); } c.stroke();
  poly([[.5, -30], [5.5, -30], [5, -35], [1, -35]], '#8a918a', '#c9cdc0');
  c.fillStyle = '#111b1e'; c.beginPath(); c.arc(3, -34.5, 1.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2e3a3c'; for (const y of [-33, -31.5]) for (const x of [1.4, 4.6]) c.fillRect(x - .4, y, .8, .8);
  poly([[-1.5, -12], [8, -12], [8, -8], [-1.5, -8]], armor, edge);
  // Pauldrons and the head with its red optic.
  // Domed pauldrons sweep back along the shoulders; a small head sits forward.
  for (const side of [-1, 1]) {
    c.beginPath(); c.ellipse(side * 12.5, -.5, 4.2, 5.6, side * .25, 0, Math.PI * 2); c.fillStyle = armor; c.fill(); c.strokeStyle = edge; c.stroke();
    c.strokeStyle = '#8c7f60'; c.beginPath(); c.moveTo(side * 12.5, -5); c.lineTo(side * 13.2, 4); c.stroke();
  }
  c.beginPath(); c.ellipse(0, -2.5, 3.8, 4.4, 0, 0, Math.PI * 2); c.fillStyle = '#2a3537'; c.fill(); c.strokeStyle = '#6f7f7c'; c.stroke();
  poly([[-3, -5.3], [3, -5.3], [0, -2.4]], '#ff3d3d'); c.fillStyle = '#ffd2c8'; c.fillRect(-.6, -5.1, 1.2, 1.2);
  // Spine lights down the back: the body's own health gauge, as on the concept armour.
  if (mine) for (let i = 0; i < 5; i++) { c.fillStyle = 4 - i < lights ? '#7fe0b0' : '#14201f'; c.fillRect(-1.3, 2.6 + i * 1.9, 2.6, 1.2); }
  c.restore();
}

// The fuel stream: burning liquid, not a stripe (author, 9 November 2026). Each packet
// keeps the line it was fired on (the server moves it), so a swinging nozzle bends the
// stream like a hose. It leaves the nozzle as a slim liquid rod and thickens as it
// travels, blooming into rolling fire with a smoky fringe, and it splashes into burning
// drops where a packet ends. Presentation only: the packets and their hits are the
// server's; the splash and smoke are browser-only and settle under reduced effects.
const sprites = new Map(), splashes = [];
let lastPackets = new Map();
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function sprite(kind) {
  if (sprites.has(kind)) return sprites.get(kind);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const stops = kind === 'smoke' ? [[0, 'rgba(44,32,26,.5)'], [.55, 'rgba(36,27,22,.24)'], [1, 'rgba(30,24,20,0)']]
    : [[0, 'rgba(255,226,140,.95)'], [.28, 'rgba(255,150,46,.82)'], [.62, 'rgba(214,66,24,.42)'], [1, 'rgba(110,28,14,0)']];
  for (const [at, color] of stops) r.addColorStop(at, color);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); sprites.set(kind, canvas); return canvas;
}
// Between two packets the liquid fired in the meantime lies on a spiral around the
// nozzle, not a straight line: interpolate the firing origin, the bearing and the
// distance travelled. A fast swing stretches the stream, and stretched liquid thins.
function stream(points, steps) {
  const out = [];
  const at = (p, q, s) => {
    let turn = q.a - p.a; turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    const a = p.a + turn * s, d = p.d + (q.d - p.d) * s, ox = p.ox + (q.ox - p.ox) * s, oy = p.oy + (q.oy - p.oy) * s;
    return { x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d, f: p.f + (q.f - p.f) * s, id: p.id + s };
  };
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i], q = points[i + 1], first = at(p, q, 0), last = at(p, q, 1);
    // How far apart the stream between two packets is spread, against their spacing in travel.
    let length = 0, previous = first;
    for (let s = 1; s <= 4; s++) { const next = at(p, q, s / 4); length += Math.hypot(next.x - previous.x, next.y - previous.y); previous = next; }
    const thin = Math.min(1, Math.max(.45, Math.sqrt(Math.max(1e-6, Math.abs(q.d - p.d)) / Math.max(1e-6, length))));
    for (let s = 0; s < steps; s++) out.push({ ...at(p, q, s / steps), thin });
    if (i === points.length - 2) out.push({ ...last, thin });
  }
  if (points.length === 1) { const p = points[0]; out.push({ x: p.ox + Math.cos(p.a) * p.d, y: p.oy + Math.sin(p.a) * p.d, f: p.f, id: p.id, thin: 1 }); }
  return out;
}
// A filled ribbon whose width follows each sample: slim at the nozzle, thick at the tail.
function ribbon(c, path, width, color) {
  if (path.length < 2) return;
  const left = [], right = [];
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, length = Math.hypot(tx, ty) || 1, w = width(p) / 2;
    left.push([p.x - ty / length * w, p.y + tx / length * w]); right.push([p.x + ty / length * w, p.y - tx / length * w]);
  });
  c.fillStyle = color; c.beginPath(); c.moveTo(...left[0]);
  for (const point of left.slice(1)) c.lineTo(...point);
  for (const point of right.reverse()) c.lineTo(...point);
  c.closePath(); c.fill();
}

export function drawFuel(c, state, world, buildings, tile, elapsed, reduced) {
  const now = (state.time || 0) + elapsed * 1000, groups = new Map(), packets = new Map(), wind = windAt(world, now, reduced);
  for (const jet of state.jets || []) {
    const profile = WEAPONS[jet.weapon] || FLAME, travel = Math.min(jet.remaining, elapsed * (jet.speed || profile.speed));
    const end = raycast(world, buildings, jet, jet.dx, jet.dy, travel);
    // Where this packet left the nozzle, and how far along its line it is now.
    const ox = jet.x - jet.dx * (profile.range - jet.remaining), oy = jet.y - jet.dy * (profile.range - jet.remaining);
    const d = Math.hypot(end.x - ox, end.y - oy);
    const point = { id: jet.id, ox: ox * tile, oy: oy * tile, a: Math.atan2(jet.dy, jet.dx), d: d * tile, travelled: d, speed: jet.speed || profile.speed,
      px: end.x * tile, py: end.y * tile, dx: jet.dx, dy: jet.dy, heavy: jet.weapon === 'HEAVY_FLAME', f: Math.min(1, d / profile.range) };
    packets.set(jet.id, point);
    if (!groups.has(jet.owner)) groups.set(jet.owner, []);
    groups.get(jet.owner).push(point);
  }
  // A packet the server has retired hit something or ran out: it splashes there.
  if (!reduced) for (const [id, point] of lastPackets) if (!packets.has(id)) splashes.push({ ...point, at: now });
  lastPackets = packets;
  while (splashes.length > 40 || (splashes.length && now - splashes[0].at > 520)) splashes.shift();
  const fire = reduced ? null : sprite('fire'), smoke = reduced ? null : sprite('smoke');
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [owner, jets] of groups) {
    jets.sort((a, b) => b.id - a.id);
    const heavy = jets[0].heavy, reach = heavy ? 1.05 : .85;
    const width = p => tile * (.1 + (reach - .1) * Math.pow(p.f, .75)) * (p.thin ?? 1);
    // The newest packet joins the nozzle while the trigger is held: shots arrive every
    // 130 ms plus the round trip, so a shot within 0.4 s means the jet is still firing.
    const recent = state.shots.findLast(s => s.owner === owner && ['FLAME', 'HEAVY_FLAME'].includes(s.weapon));
    const points = [];
    if (recent && state.time - recent.at < 400) {
      const nx = recent.x + Math.sin(recent.angle) * .4, ny = recent.y - Math.cos(recent.angle) * .4;
      points.push({ id: jets[0].id + 1, ox: nx * tile, oy: ny * tile, a: Math.atan2(-Math.cos(recent.angle), Math.sin(recent.angle)), d: 0, travelled: 0, speed: jets[0].speed, f: 0 });
    }
    points.push(...jets);
    // A pause in firing (over 0.4 s between packets) starts a new stream. Held fire sends a
    // packet every 130 ms plus the server round trip, so ordinary gaps are joined.
    const segments = [[]];
    for (const p of points) {
      const previous = segments.at(-1).at(-1);
      if (previous && p.travelled - previous.travelled > p.speed * .4) segments.push([]);
      segments.at(-1).push(p);
    }
    for (const segment of segments) {
      const path = stream(segment, reduced ? 3 : 6);
      if (reduced) {
        ribbon(c, path, p => Math.max(3, width(p) * .75), '#e0742e');
        ribbon(c, path.filter(p => p.f < .7), p => Math.max(1.5, width(p) * .3), '#ffe8a8');
        continue;
      }
      // Body, smoke behind the flames, the fire itself, then the liquid rod at its heart.
      // Lumps roll along the body, as in a thick burning liquid.
      ribbon(c, path, p => width(p) * (.62 + .14 * p.f * Math.sin(p.id * 3.1 - now / 85)), 'rgba(196,62,24,.5)');
      path.forEach((p, i) => {
        if (p.f < .45 || i % 2) return;
        const size = width(p) * 2.6, drift = (now / 900 + hash(p.id)) % 1;
        c.globalAlpha = Math.min(1, (p.f - .45) * 2.2) * (1 - drift * .6);
        // Smoke blows downwind with the shared cosmetic wind (wind.js).
        const blow = drift * tile * (.5 + .7 * wind.strength);
        c.drawImage(smoke, p.x - size / 2 + (hash(p.id + 3) - .5) * size * .5 + wind.dx * blow, p.y - size / 2 + wind.dy * blow - drift * tile * .2, size, size);
      });
      c.globalCompositeOperation = 'lighter';
      path.forEach((p, i) => {
        const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const turbulence = Math.sin(now / 70 + p.id * 2.7) * width(p) * .32 * p.f;
        const size = width(p) * (1.25 + .25 * Math.sin(now / 45 + p.id * 1.3));
        c.globalAlpha = .3 + .32 * (1 - p.f * .55);
        c.drawImage(fire, p.x - (b.y - a.y) / length * turbulence - size / 2, p.y + (b.x - a.x) / length * turbulence - size / 2, size, size);
      });
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      ribbon(c, path.filter(p => p.f < .72), p => Math.max(tile * .07, width(p) * .34), 'rgba(255,236,170,.95)');
      // Burning drops shed from the tail.
      const tail = path.at(-1);
      for (let k = 0; k < 3; k++) {
        const fall = (now / 380 + hash(Math.floor(tail.id) * 5 + k)) % 1, angle = hash(Math.floor(tail.id) + k * 9) * Math.PI * 2;
        c.globalAlpha = (1 - fall) * .8; c.fillStyle = '#ffb04a';
        c.beginPath(); c.arc(tail.x + Math.cos(angle) * fall * tile * .5, tail.y + Math.sin(angle) * fall * tile * .5, Math.max(1, tile * .045 * (1 - fall)), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
  }
  // Splashes: a flare and a fan of burning drops thrown on along the packet's line.
  if (!reduced) {
    c.globalCompositeOperation = 'lighter';
    for (const s of splashes) {
      const age = (now - s.at) / 520; if (age < 0 || age > 1) continue;
      const size = tile * (s.heavy ? 1.3 : 1.05) * (1 - age * .5);
      c.globalAlpha = (1 - age) * .75; c.drawImage(fire, s.px - size / 2, s.py - size / 2, size, size);
      for (let k = 0; k < 6; k++) {
        const spread = (hash(s.id * 7 + k) - .5) * 2.2, angle = Math.atan2(s.dy, s.dx) + spread, out = age * tile * (.35 + hash(s.id + k) * .7);
        const drop = tile * .32 * (1 - age);
        c.globalAlpha = (1 - age) * .85;
        c.drawImage(fire, s.px + Math.cos(angle) * out - drop / 2, s.py + Math.sin(angle) * out - drop / 2, drop, drop);
      }
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  c.restore();
}
