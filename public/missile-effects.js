import { targetBox } from './missile.js';

export function drawBattery(c, gun, tile, selected = false, ghost = false, valid = true) {
  c.save(); c.translate(gun.x * tile, gun.y * tile); c.globalAlpha = ghost ? .5 : 1;
  c.fillStyle = '#263c3d'; c.fillRect(3, 3, tile * 4 - 6, tile * 4 - 6);
  c.strokeStyle = selected ? '#f5d48c' : '#91aaa0'; c.lineWidth = selected ? 3 : 2; c.strokeRect(5, 5, tile * 4 - 10, tile * 4 - 10);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const x = (col + 1) * tile, y = (row + .5) * tile;
    c.fillStyle = '#83958b'; c.fillRect(x - 14, y - 17, 28, 34); c.fillStyle = '#172c31'; c.fillRect(x - 10, y - 13, 20, 26);
    c.fillStyle = gun.reload > 0 ? '#5a6860' : '#d9c899'; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 6, y); c.lineTo(x + 6, y + 9); c.lineTo(x - 6, y + 9); c.lineTo(x - 6, y); c.closePath(); c.fill();
  }
  c.fillStyle = gun.operator ? '#a1e6d3' : '#d0b96e'; c.fillRect(9, tile * 4 - 18, 14, 6);
  if (ghost) {
    c.globalAlpha = 1; c.fillStyle = valid ? '#e7d79418' : '#e646464f'; c.strokeStyle = valid ? '#f5d48c' : '#ff7777'; c.lineWidth = 3;
    c.fillRect(0, 0, tile * 4, tile * 4); c.strokeRect(0, 0, tile * 4, tile * 4);
    if (!valid) { c.beginPath(); c.moveTo(0, 0); c.lineTo(tile * 4, tile * 4); c.moveTo(tile * 4, 0); c.lineTo(0, tile * 4); c.stroke(); }
  }
  c.restore();
}
export function drawTargetBox(c, target, rotated, tile, zoom, valid = true, weapon = 'HE') {
  const b = targetBox(target, rotated);
  c.save(); c.strokeStyle = valid ? '#f5d48c' : '#ef9578'; c.fillStyle = valid ? '#f5d48c12' : '#ef957812'; c.lineWidth = 1.5 / zoom;
  c.fillRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.strokeRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile);
  c.setLineDash([3 / zoom, 5 / zoom]);
  for (let i = 1; i < (rotated ? 4 : 3); i++) { const x = (b.x + b.width * i / (rotated ? 4 : 3)) * tile; c.beginPath(); c.moveTo(x, b.y * tile); c.lineTo(x, (b.y + b.height) * tile); c.stroke(); }
  for (let i = 1; i < (rotated ? 3 : 4); i++) { const y = (b.y + b.height * i / (rotated ? 3 : 4)) * tile; c.beginPath(); c.moveTo(b.x * tile, y); c.lineTo((b.x + b.width) * tile, y); c.stroke(); }
  c.setLineDash([]); c.font = `${11 / zoom}px monospace`; c.fillStyle = valid ? '#f5d48c' : '#ef9578'; c.fillText('12 ' + (weapon === 'INCENDIARY' ? 'FIRE' : weapon) + ' / ' + (rotated ? '18 x 12' : '12 x 18'), b.x * tile, b.y * tile - 7 / zoom); c.restore();
}
const smooth = x => x * x * (3 - 2 * x);
function position(b, m, t, index) {
  const originX=m.originX??b.x,originY=m.originY??b.y;
  const cruise = smooth(Math.max(0, Math.min(1, (t - .14) / .7))), dx = m.x - originX, dy = m.y - originY, distance = Math.hypot(dx, dy) || 1;
  const sway = Math.sin(t * Math.PI) ** 2 * Math.sin(m.phase + t * Math.PI * 6) * 1.4;
  const altitude = t < .2 ? smooth(t / .2) * 8 : t < .78 ? 8 + Math.sin((t - .2) / .58 * Math.PI) : 8 * (1 - smooth((t - .78) / .22));
  return { x: originX + dx * cruise - dy / distance * sway + (m.originX===undefined?(index % 3 - 1) * .6 * (1 - cruise):0), y: originY + dy * cruise + dx / distance * sway, altitude };
}
export function drawBarrages(c, barrages = [], tile, elapsed, reduced, zoom) {
  for (const b of barrages) {
    if(b.kind==='bomber')continue;
    const age = b.age + elapsed;
    c.save(); c.strokeStyle = '#efc78388'; c.lineWidth = 1 / zoom; c.setLineDash([5 / zoom, 7 / zoom]); c.strokeRect(b.box.x * tile, b.box.y * tile, b.box.width * tile, b.box.height * tile); c.restore();
    b.missiles.forEach((m, index) => {
      const t = (age - m.launch) / m.flight; if (m.landed || t < 0 || t >= 1) return;
      const p = position(b, m, t, index), px = p.x * tile, py = (p.y - p.altitude) * tile;
      const transform = c.getTransform(), screenX = px * transform.a + transform.e, screenY = py * transform.d + transform.f;
      if (screenX < -120 || screenY < -120 || screenX > c.canvas.width + 120 || screenY > c.canvas.height + 120) return;
      c.save(); c.fillStyle = '#172d3544'; c.beginPath(); c.ellipse(p.x * tile, p.y * tile, 6, 3, 0, 0, Math.PI * 2); c.fill();
      const segments = reduced ? 5 : 18, tail = reduced ? .055 : .12;
      for (let i = 0; i < segments; i++) {
        const a = position(b, m, Math.max(0, t - tail + tail * i / segments), index), z = position(b, m, Math.max(0, t - tail + tail * (i + 1) / segments), index);
        c.strokeStyle = i > segments - 4 ? '#ffd58fcc' : `rgba(196,207,191,${.08 + i / segments * .4})`; c.lineWidth = i > segments - 4 ? 3 : 5;
        c.beginPath(); c.moveTo(a.x * tile, (a.y - a.altitude) * tile); c.lineTo(z.x * tile, (z.y - z.altitude) * tile); c.stroke();
      }
      const prior = position(b, m, Math.max(0, t - .003), index); c.translate(px, py); c.rotate(Math.atan2(py - (prior.y - prior.altitude) * tile, px - prior.x * tile) + Math.PI / 2);
      c.fillStyle = b.weapon === 'GAS' ? '#d0f995' : b.weapon === 'INCENDIARY' ? '#ffc06c' : '#fff0c6'; c.beginPath(); c.moveTo(0, -9); c.lineTo(3, 2); c.lineTo(0, 5); c.lineTo(-3, 2); c.closePath(); c.fill();
      c.fillStyle = '#f5a545'; c.fillRect(-2, 4, 4, reduced ? 5 : 10); c.restore();
    });
  }
}
