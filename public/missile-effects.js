import { targetBox } from './missile.js';

export function drawBattery(c, gun, tile, selected = false, ghost = false, valid = true) {
  c.save(); c.translate(gun.x * tile, gun.y * tile); c.scale(tile / 48, tile / 48);
  c.globalAlpha = ghost ? .5 : 1;
  // Twelve recessed launch cells, service spine and armored perimeter. All fit
  // inside the same four-square foundation, including placement ghosts.
  c.fillStyle = '#263c3d'; c.fillRect(3, 3, 186, 186);
  c.strokeStyle = selected ? '#f5d48c' : '#91aaa0'; c.lineWidth = selected ? 3 : 2; c.strokeRect(5, 5, 182, 182);
  c.fillStyle = '#526662'; c.fillRect(12, 12, 168, 168);
  c.fillStyle = '#243a3c'; c.fillRect(14, 14, 17, 164); c.fillRect(161, 14, 17, 164);
  for (let y = 20; y < 174; y += 9) {
    c.fillStyle = '#81918a'; c.fillRect(17, y, 11, 2); c.fillRect(164, y, 11, 2);
  }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const x = 48 + col * 48, y = 27 + row * 44;
    c.fillStyle = '#172c31'; c.fillRect(x - 17, y - 15, 34, 36);
    c.strokeStyle = '#a0aaa0'; c.lineWidth = 1; c.strokeRect(x - 16, y - 14, 32, 34);
    c.fillStyle = '#657a72'; c.fillRect(x - 13, y - 11, 26, 27);
    c.strokeStyle = '#c2bf9c'; c.strokeRect(x - 11, y - 9, 22, 23);
    c.fillStyle = '#20383b'; c.beginPath(); c.arc(x, y + 2, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = gun.reload > 0 ? '#536760' : '#d9c899';
    c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 5, y + 1); c.lineTo(x + 5, y + 9); c.lineTo(x - 5, y + 9); c.lineTo(x - 5, y + 1); c.closePath(); c.fill();
    c.fillStyle = '#b0b7a3'; c.fillRect(x - 18, y - 8, 3, 7); c.fillRect(x + 15, y - 8, 3, 7);
    c.fillStyle = gun.reload > 0 ? '#bb8057' : '#a1c4a1'; c.fillRect(x - 4, y + 17, 8, 2);
  }
  for (const x of [8, 176]) for (const y of [8, 176]) {
    c.fillStyle = '#d0b96e'; c.fillRect(x, y, 8, 8); c.fillStyle = '#344b49'; c.fillRect(x + 3, y + 3, 2, 2);
  }
  c.fillStyle = gun.operator ? '#a1e6d3' : '#d0b96e'; c.fillRect(89, 182, 14, 4);
  if (ghost) {
    c.globalAlpha = 1; c.fillStyle = valid ? '#e7d79418' : '#e646464f'; c.strokeStyle = valid ? '#f5d48c' : '#ff7777'; c.lineWidth = 3;
    c.fillRect(0, 0, 192, 192); c.strokeRect(0, 0, 192, 192);
    if (!valid) { c.beginPath(); c.moveTo(0, 0); c.lineTo(192, 192); c.moveTo(192, 0); c.lineTo(0, 192); c.stroke(); }
  }
  c.restore();
}
export function drawTargetBox(c, target, rotated, tile, zoom, valid = true, weapon = 'HE') {
  const b = targetBox(target, rotated);
  c.save(); c.strokeStyle = valid ? '#f5d48c' : '#ff7777'; c.fillStyle = valid ? '#f5d48c12' : '#ff777712'; c.lineWidth = 1.5 / zoom;
  c.fillRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.strokeRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile);
  c.setLineDash([3 / zoom, 5 / zoom]);
  for (let i = 1; i < (rotated ? 4 : 3); i++) { const x = (b.x + b.width * i / (rotated ? 4 : 3)) * tile; c.beginPath(); c.moveTo(x, b.y * tile); c.lineTo(x, (b.y + b.height) * tile); c.stroke(); }
  for (let i = 1; i < (rotated ? 3 : 4); i++) { const y = (b.y + b.height * i / (rotated ? 3 : 4)) * tile; c.beginPath(); c.moveTo(b.x * tile, y); c.lineTo((b.x + b.width) * tile, y); c.stroke(); }
  c.setLineDash([]); c.font = `${11 / zoom}px monospace`; c.fillStyle = valid ? '#f5d48c' : '#ff7777'; c.fillText('12 ' + (weapon === 'INCENDIARY' ? 'FIRE' : weapon) + ' / ' + (rotated ? '18 x 12' : '12 x 18'), b.x * tile, b.y * tile - 7 / zoom); c.restore();
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
      const t = (age - m.launch) / m.flight; if (m.landed || m.launchPending || t < 0 || t >= 1) return;
      // A brief surface disturbance marks the actual launch location. It stays
      // behind as the submerged boat moves away; no live tracking marker.
      if(m.underwater&&age-m.launch<.8){
        const progress=(age-m.launch)/.8;c.save();c.globalAlpha*=reduced?.45:(1-progress)*.8;
        c.strokeStyle='#d3f1e9';c.lineWidth=1.5/zoom;c.beginPath();c.ellipse(m.originX*tile,m.originY*tile,(reduced?.35:.15+progress*.65)*tile,(reduced?.22:.1+progress*.4)*tile,0,0,Math.PI*2);c.stroke();
        if(!reduced)for(let i=0;i<3;i++){c.beginPath();c.arc((m.originX+Math.sin(i*2.1)*progress*.3)*tile,(m.originY-Math.cos(i*2.1)*progress*.3)*tile,.055*tile,0,Math.PI*2);c.stroke();}
        c.restore();
      }
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
