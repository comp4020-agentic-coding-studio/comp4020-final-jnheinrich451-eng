import { SURVIVAL } from './survival.js';

export function drawReplacement(c, player, tile, elapsed, reduced) {
  const progress = Math.max(0, Math.min(1, 1 - (player.recovery - elapsed) / SURVIVAL.arrival));
  const drop = Math.max(0, 1 - progress / .8), x = player.x * tile, y = player.y * tile;
  c.save(); c.translate(x, y);
  c.strokeStyle = '#c6eddb'; c.lineWidth = 2; c.setLineDash([5, 5]);
  c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#142e3266'; c.beginPath(); c.ellipse(0, 3, 13 + drop * 12, 10 + drop * 7, 0, 0, Math.PI * 2); c.fill();
  c.translate(reduced ? 0 : -drop * 90, reduced ? 0 : -drop * 150); c.scale(1 + drop * .6, 1 + drop * .6);
  if (!reduced && drop > 0) { c.strokeStyle = '#ffbb7277'; c.lineWidth = 6; c.beginPath(); c.moveTo(-3, -17); c.lineTo(-18, -52); c.stroke(); }
  c.fillStyle = '#43565b'; c.fillRect(-14, -18, 28, 36); c.strokeStyle = '#d5c7a1'; c.strokeRect(-10, -15, 20, 30);
  c.fillStyle = '#dcb67d'; c.fillRect(-4, -12, 8, 21); c.fillStyle = '#a6e2d7'; c.fillRect(-3, -13, 6, 4);
  c.restore();
  if (progress > .8) {
    c.save(); c.globalAlpha = (1 - progress) * 3; c.strokeStyle = '#e8d5a1'; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 20 + (progress - .8) * 180, 0, Math.PI * 2); c.stroke(); c.restore();
  }
}

export function drawAttack(c, enemy, time, tile) {
  const attack = enemy.attack || enemy.strike;
  if (!attack) return;
  const windup = !!enemy.attack, progress = windup ? 1 - Math.max(0, attack.at - time) / (attack.windup || SURVIVAL.windup) : Math.max(0, 1 - (time - attack.at) / 250);
  c.save(); c.translate(attack.x * tile, attack.y * tile);
  c.fillStyle = windup ? '#ff73412b' : '#ff946144'; c.strokeStyle = '#ffbc85'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, (attack.radius || SURVIVAL.strikeRadius) * tile, 0, Math.PI * 2); c.fill(); c.stroke();
  if (windup) { c.lineWidth = 4; c.beginPath(); c.arc(0, 0, (attack.radius || SURVIVAL.strikeRadius) * tile + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); c.stroke(); }
  else { c.globalAlpha = progress; c.lineWidth = 3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-14 + i * 9, -17); c.lineTo(4 + i * 9, 17); c.stroke(); } }
  c.restore();
}
