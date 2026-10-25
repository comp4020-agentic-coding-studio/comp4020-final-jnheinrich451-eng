import { relativeMovement, FLAME } from './weapons.js';
import { raycast } from './raycast.js';

// Overhead humanoid combat robot, facing -y. The right arm ends in the weapon (no
// hand): a flamethrower barrel over a laser emitter, fed by a hose from the fuel
// pack. The left hand grips the gun, thumb on the release. The gun axis sits just
// right of centre so the existing flame and laser effects leave its muzzle.
export function drawRobot(c, angle, vx, vy, phase, mine) {
  const local = relativeMovement(angle, vx, vy), speed = Math.hypot(vx, vy);
  const stride = speed > .02 ? Math.sin(phase) * 6 : 0;
  const sideways = speed ? local.right / speed : 0, forward = speed ? local.forward / speed : 0;
  const armor = mine ? '#c4b38d' : '#819e93', edge = mine ? '#e9dcb4' : '#c1d4cb', frame = '#263a3d', dark = '#18282c', metal = '#4a5a5c';
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
