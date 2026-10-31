import { targetBox, batteryState } from './missile.js';
import { sandSeaAt } from './biome.js';

// Turreted missile launcher after the author's sketch, in 48px-tile units within the
// 4 x 4 footprint: a base slab whose outriggers stretch out when deployed, a
// turntable, hydraulic arms and a 12-tube box pod. From above the raised pod shows
// its foreshortened top and, ahead of it, the tube face tilted toward the sky.
export function drawBattery(c, gun, tile, selected = false, ghost = false, valid = true, reduced = false) {
  const { angle, elevation, deploy } = batteryState(gun, null), d = deploy * deploy * (3 - 2 * deploy);
  const shown = (elevation || 0) * d * Math.PI / 180, cos = Math.cos(shown), sin = Math.sin(shown);
  c.save(); c.translate(gun.x * tile, gun.y * tile); c.scale(tile / 48, tile / 48);
  c.globalAlpha = ghost ? .5 : 1;
  // Base slab with an armoured rim; outriggers reach toward the corners when deployed.
  c.fillStyle = '#263c3d'; c.fillRect(10, 10, 172, 172);
  c.strokeStyle = selected ? '#f5d48c' : '#91aaa0'; c.lineWidth = selected ? 3 : 2; c.strokeRect(12, 12, 168, 168);
  c.fillStyle = '#3f5452'; c.fillRect(22, 22, 148, 148);
  c.save(); c.translate(96, 96);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(Math.PI / 4 + i * Math.PI / 2);
    const reach = 58 + 62 * d;
    c.fillStyle = '#2a3c3e'; c.fillRect(-9, 30, 18, reach - 30);
    c.fillStyle = '#6d807a'; c.fillRect(-6, 32, 12, reach - 34);
    c.fillStyle = '#d0b96e'; c.beginPath(); c.moveTo(-14, reach); c.lineTo(14, reach); c.lineTo(9, reach + 10); c.lineTo(-9, reach + 10); c.closePath(); c.fill();
    c.restore();
  }
  // Turntable ring with bolts, turned to the launcher's bearing.
  c.rotate(angle);
  c.fillStyle = '#20383b'; c.beginPath(); c.arc(0, 0, 48, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#9aa797'; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillStyle = '#c1c7af'; c.fillRect(Math.cos(a) * 43 - 1.5, Math.sin(a) * 43 - 1.5, 3, 3); }
  c.fillStyle = '#4a5f5e'; c.fillRect(-30, -12, 60, 44);
  // Box pod: pivot at the rear trunnion; the front rises with elevation.
  const W = 72, L = 116, H = 44, rear = 34, front = rear - L * cos, face = H * sin;
  c.fillStyle = '#0d1a1d55'; c.fillRect(-W / 2 + 7, front - face + 9, W, rear - front + face);
  // Hydraulic arms from the yoke to the pod's underside.
  c.strokeStyle = '#7d8b85'; c.lineWidth = 5; c.lineCap = 'round';
  for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * 26, 22); c.lineTo(side * 26, front + (rear - front) * .45); c.stroke(); }
  // Tube face ahead of the top: twelve tubes, emptied by the current volley.
  if (face > 1) {
    c.fillStyle = '#2b3d40'; c.fillRect(-W / 2, front - face, W, face); c.strokeStyle = '#a7b3a3'; c.lineWidth = 1.5; c.strokeRect(-W / 2, front - face, W, face);
    const spent = gun.reload > 0 ? 12 : 0;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const i = row * 4 + col, x = -W / 2 + 9 + col * (W - 18) / 3, y = front - face + face * (row + .5) / 3;
      c.fillStyle = i < spent ? '#0a1416' : '#d9c899'; c.beginPath(); c.ellipse(x, y, 7, Math.max(1, face / 7.5), 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#4f5f5c'; c.lineWidth = 1; c.stroke();
    }
  }
  // Pod top: three tube runs along its length and a service hatch.
  c.fillStyle = '#5e7470'; c.fillRect(-W / 2, front, W, rear - front); c.strokeStyle = '#b8c3ad'; c.lineWidth = 2; c.strokeRect(-W / 2, front, W, rear - front);
  c.strokeStyle = '#3c4f4f'; c.lineWidth = 2;
  for (const x of [-W / 6, W / 6]) { c.beginPath(); c.moveTo(x, front + 4); c.lineTo(x, rear - 4); c.stroke(); }
  c.fillStyle = '#7f938c'; for (const x of [-W / 3, 0, W / 3]) c.fillRect(x - 5, front + (rear - front) * .35, 10, Math.max(3, (rear - front) * .3));
  c.fillStyle = gun.reload > 0 ? '#bb8057' : '#a1c4a1'; c.fillRect(-8, rear - 7, 16, 3);
  c.restore();
  for (const x of [14, 170]) for (const y of [14, 170]) { c.fillStyle = '#d0b96e'; c.fillRect(x, y, 8, 8); c.fillStyle = '#344b49'; c.fillRect(x + 3, y + 3, 2, 2); }
  c.fillStyle = gun.operator ? '#a1e6d3' : '#d0b96e'; c.fillRect(89, 182, 14, 4);
  if (ghost) {
    c.globalAlpha = 1; c.fillStyle = valid ? '#e7d79418' : '#e646464f'; c.strokeStyle = valid ? '#f5d48c' : '#ff7777'; c.lineWidth = 3;
    c.fillRect(0, 0, 192, 192); c.strokeRect(0, 0, 192, 192);
    if (!valid) { c.beginPath(); c.moveTo(0, 0); c.lineTo(192, 192); c.moveTo(192, 0); c.lineTo(0, 192); c.stroke(); }
  }
  c.restore();
}
// Pale-blue area and diamond: where the launcher actually points while it turns.
export function drawActualBox(c, target, rotated, tile, zoom) {
  const b = targetBox(target, rotated);
  c.save(); c.strokeStyle = '#a8d8f0'; c.fillStyle = '#a8d8f00f'; c.lineWidth = 1.5 / zoom; c.setLineDash([6 / zoom, 5 / zoom]);
  c.fillRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.strokeRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.setLineDash([]);
  const x = target.x * tile, y = target.y * tile, r = 7 / zoom;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.stroke();
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
/** @param {object|null} [world] Saved world used only for biome presentation. */
export function drawBarrages(c, barrages = [], tile, elapsed, reduced, zoom, world=null) {
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
        const sand=sandSeaAt(world,m.originX,m.originY);
        c.strokeStyle=sand?'#e7bd77':'#d3f1e9';c.lineWidth=1.5/zoom;c.beginPath();c.ellipse(m.originX*tile,m.originY*tile,(reduced?.35:.15+progress*.65)*tile,(reduced?.22:.1+progress*.4)*tile,0,0,Math.PI*2);c.stroke();
        if(!reduced)for(let i=0;i<3;i++){c.beginPath();c.arc((m.originX+Math.sin(i*2.1)*progress*.3)*tile,(m.originY-Math.cos(i*2.1)*progress*.3)*tile,(sand?.12:.055)*tile,0,Math.PI*2);if(sand){c.fillStyle='#c9a16599';c.fill();}else c.stroke();}
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
