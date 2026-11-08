// Draw the server-owned body chain. Legs, petals and tentacles are cosmetic; the
// plated body stays inside the same eight circles used by weapon collision.
import { CENTIPEDE } from './centipede.js';
import { drawCentipedeParts } from './enemy-art.js';

const bodyOf = enemy => enemy.body?.length ? enemy.body.slice(0, CENTIPEDE.segments) : [{ x: enemy.x, y: enemy.y, angle: enemy.angle || 0 }];
const walking = enemy => ['hunting', 'investigating', 'returning', 'patrolling'].includes(enemy.behavior) && enemy.hp > 0;

export function drawCentipede(c, enemy, time, tile, reduced = false, hit = 0, dead = false) {
  // The head part faces the saved heading; enemy-art.js draws the plated chain,
  // flower maw and legs in pixels inside the same collision circles.
  const parts = bodyOf(enemy).map((part, i) => ({ x: part.x * tile, y: part.y * tile,
    angle: i === 0 && Number.isFinite(enemy.angle) ? enemy.angle : part.angle || 0 }));
  const walk = reduced || dead || !walking(enemy) ? 0 : time * 4;
  drawCentipedeParts(c, parts, CENTIPEDE.radius * tile, { time, walk, pose: enemy.pose, hit, dead, reduced });
}

export function drawCentipedeStatus(c, enemy, now, tile, zoom) {
  const x = enemy.x * tile, y = enemy.y * tile - tile * .86, width = 74 / zoom;
  c.save(); c.fillStyle = '#291d2bea'; c.fillRect(x - width / 2, y, width, 5 / zoom);
  c.fillStyle = '#e6bd73'; c.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, enemy.hp / (enemy.maxHp || 2400))), 5 / zoom);
  if (zoom >= .35) {
    const blocked = enemy.armorHitAt !== undefined && now - enemy.armorHitAt < 600;
    c.textAlign = 'center'; c.font = `${10 / zoom}px monospace`; c.fillStyle = blocked ? '#ffce89' : '#f3d89c';
    c.fillText(blocked ? 'ARMORED / HE · MAG · MAC' : 'SIEGE CENTIPEDE', x, y - 5 / zoom);
  }
  c.restore();
}

export function drawCentipedeWarnings(c, view, now, tile, zoom, reduced = false) {
  for (const warning of view?.warnings || []) {
    const giant = warning.kind === 'centipede', seconds = Math.max(0, Math.ceil((warning.at - now) / 1000));
    const progress = Math.max(0, Math.min(1, 1 - (warning.at - now) / Math.max(1, warning.windup)));
    c.save(); c.strokeStyle = '#f58c94'; c.fillStyle = '#a7354c24'; c.lineWidth = 1.5 / zoom;
    if (giant && warning.trail?.length) {
      c.strokeStyle = '#ed8f7944'; c.lineWidth = CENTIPEDE.radius * tile * 2; c.lineCap = 'round';
      c.beginPath(); warning.trail.forEach((p, i) => i ? c.lineTo(p.x * tile, p.y * tile) : c.moveTo(p.x * tile, p.y * tile)); c.stroke();
      c.strokeStyle = '#e79a7a'; c.lineWidth = 1.5 / zoom;
    }
    for (const point of warning.points || []) {
      const x = point.x * tile, y = point.y * tile, radius = tile * (giant ? .76 : .5);
      c.setLineDash([6 / zoom, 4 / zoom]); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
      c.lineWidth = 3 / zoom; c.beginPath(); c.arc(x, y, radius + 4 / zoom, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); c.stroke(); c.lineWidth = 1.5 / zoom;
      c.beginPath(); c.moveTo(x - 5 / zoom, y); c.lineTo(x + 5 / zoom, y); c.moveTo(x, y - 5 / zoom); c.lineTo(x, y + 5 / zoom); c.stroke();
    }
    if (zoom >= .3) {
      c.font = `${11 / zoom}px monospace`; c.textAlign = 'center'; c.fillStyle = '#ffb7a4';
      c.fillText((giant ? 'BLIGHT ROOT / GIANT EMERGING ' : 'BROOD HATCHING ') + seconds + 's', warning.x * tile, warning.y * tile - tile * 1.1);
    }
    c.restore();
  }
}
