import { relativeMovement, FLAME } from './weapons.js';
import { raycast } from './raycast.js';

export function drawRobot(c, angle, vx, vy, phase, mine) {
  const local = relativeMovement(angle, vx, vy), speed = Math.hypot(vx, vy);
  const stride = speed > .02 ? Math.sin(phase) * 5 : 0;
  const sideways = speed ? local.right / speed : 0, forward = speed ? local.forward / speed : 0;
  c.save(); c.rotate(angle);
  // Alternate foot placements along the actual local movement vector. Backward
  // and sideways motion change the gait without turning the weapon away.
  for (const side of [-1, 1]) {
    c.fillStyle = '#203136'; c.fillRect(side * 8 - 4 + sideways * stride * side, 5 - forward * stride * side, 8, 15);
    c.fillStyle = '#697e77'; c.fillRect(side * 8 - 3 + sideways * stride * side, 6 - forward * stride * side, 6, 7);
  }
  c.fillStyle = '#283c3e'; c.fillRect(-13, -8, 26, 19);
  c.fillStyle = mine ? '#c4b38d' : '#819e93'; c.fillRect(-15, -13, 30, 16);
  c.strokeStyle = '#e1d4b1'; c.lineWidth = 1; c.strokeRect(-10, -11, 20, 12);
  // Backpack fuel cells and a compact head make this distinct from a tank hull.
  c.fillStyle = '#925344'; c.fillRect(-11, 4, 7, 8); c.fillRect(4, 4, 7, 8);
  c.fillStyle = '#354d50'; c.fillRect(-7, -18, 14, 12); c.fillStyle = '#f18f69'; c.fillRect(-5, -17, 10, 3);
  c.fillStyle = '#243a3e'; c.fillRect(-4, -30, 8, 17); c.fillStyle = '#b0b3a0'; c.fillRect(-5, -29, 10, 5);
  c.fillStyle = '#e6bd71'; c.fillRect(-2, -32, 4, 4);
  c.restore();
}

export function drawFuel(c, state, world, buildings, tile, elapsed, reduced) {
  const groups = new Map();
  for (const jet of state.jets || []) {
    const travel = Math.min(jet.remaining, elapsed * (jet.speed || FLAME.speed));
    const end = raycast(world, buildings, jet, jet.dx, jet.dy, travel);
    if (!groups.has(jet.owner)) groups.set(jet.owner, []);
    groups.get(jet.owner).push({ ...jet, px: end.x * tile, py: end.y * tile });
  }
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [owner, jets] of groups) {
    jets.sort((a, b) => b.id - a.id);
    const recent = state.shots.findLast(s => s.owner === owner && ['FLAME', 'HEAVY_FLAME'].includes(s.weapon));
    const points = [];
    if (recent && state.time - recent.at < 180) points.push({ px: (recent.x + Math.sin(recent.angle) * .4) * tile, py: (recent.y - Math.cos(recent.angle) * .4) * tile, id: jets[0].id + 1 });
    points.push(...jets);
    for (const [width, color] of (reduced ? [[6, '#ea8c35'], [2, '#ffe8a8']] : [[15, '#e34f222c'], [8, '#db692e'], [4, '#ffc962'], [1.5, '#fff0bc']])) {
      c.lineWidth = width; c.strokeStyle = color; c.beginPath();
      points.forEach((p, i) => {
        const previous = points[i - 1];
        if (!previous || Math.hypot(p.px - previous.px, p.py - previous.py) > tile * 2.2) c.moveTo(p.px, p.py);
        else c.lineTo(p.px, p.py);
      }); c.stroke();
    }
    for (const p of jets) {
      c.fillStyle = '#ffd077'; c.beginPath(); c.arc(p.px, p.py, reduced ? 2 : 3, 0, Math.PI * 2); c.fill();
      if (!reduced) { const flutter = Math.sin(state.time / 55 + p.id) * 5; c.fillStyle = '#df7b34aa'; c.fillRect(p.px + p.dy * flutter, p.py - p.dx * flutter, 2, 4); }
    }
  }
  c.restore();
}
