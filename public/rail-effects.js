import { gunPosition, RAIL } from './rail.js';
import { turnTurret } from './turret.js';
import { isCurve, isCompact, railPorts, CURVES, curveEnds } from './track.js';

export function drawSwitch(c, rail, state, locked, tile, zoom) {
  const [a] = curveEnds(rail), color = locked ? '#f0ad77' : '#a4e5d0';
  c.save(); c.strokeStyle = color; c.lineWidth = 2 / zoom;
  c.beginPath();
  if (state.route === 'curve') c.arc((rail.x + .5) * tile, (rail.y + .5) * tile, tile * 3, CURVES[rail.shape], CURVES[rail.shape] + Math.PI / 2);
  else { c.moveTo((a.x + .5 - a.dx) * tile, (a.y + .5 - a.dy) * tile); c.lineTo((a.x + .5 + a.dx * 2) * tile, (a.y + .5 + a.dy * 2) * tile); }
  c.stroke();
  const x = (rail.x + .5) * tile, y = (rail.y + .5) * tile, size = 5 / zoom;
  c.fillStyle = '#19352e'; c.fillRect(x - size, y - size, size * 2, size * 2); c.strokeRect(x - size, y - size, size * 2, size * 2);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + size * .7, y - (state.route === 'curve' ? size * .7 : 0)); c.stroke();
  if (zoom >= .2) { c.font = `${10 / zoom}px monospace`; c.textAlign = 'center'; const text = locked ? 'LOCKED' : state.route.toUpperCase(); const width = c.measureText(text).width; c.fillStyle = '#19352ee6'; c.fillRect(x - width / 2 - 3, y + size + 2, width + 6, 14 / zoom); c.fillStyle = color; c.fillText(text, x, y + size + 12 / zoom); }
  c.restore();
}

export function drawRail(c, rail, tile, ghost = false) {
  if (isCompact(rail)) {
    c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); c.globalAlpha = ghost ? .5 : 1;
    c.beginPath(); c.rect(-tile / 2, -tile / 2, tile, tile); c.clip();
    const ends = { N: [0, -tile / 2], E: [tile / 2, 0], S: [0, tile / 2], W: [-tile / 2, 0] }, ports = [...railPorts(rail)];
    const path = () => { c.beginPath(); if (rail.shape === 'J') { c.moveTo(-tile / 2, 0); c.lineTo(tile / 2, 0); c.moveTo(0, -tile / 2); c.lineTo(0, tile / 2); }
      else { c.moveTo(...ends[ports[0]]); c.quadraticCurveTo(0, 0, ...ends[ports[1]]); } };
    for (const [color, width] of [['#605f4c', 32], ['#b6bab0', 26], ['#243b3e', 21], ['#655e48', 16]]) { path(); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
    if (rail.shape === 'J') { c.fillStyle = '#a4e5d0'; c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill(); }
    c.restore(); return;
  }
  if (isCurve(rail)) {
    c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); c.globalAlpha = ghost ? .5 : 1;
    const start = CURVES[rail.shape], radius = tile * 3;
    c.strokeStyle = '#605f4c80'; c.lineWidth = 32; c.beginPath(); c.arc(0, 0, radius, start, start + Math.PI / 2); c.stroke();
    for (let i = 0; i <= 18; i++) { c.save(); c.rotate(start + i / 18 * Math.PI / 2); c.translate(radius, 0); c.fillStyle = '#4c4739'; c.fillRect(-19, -2.5, 38, 5); c.restore(); }
    for (const offset of [-11, 11]) { c.strokeStyle = '#243b3e'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, radius + offset, start, start + Math.PI / 2); c.stroke(); c.strokeStyle = '#b6bab0'; c.lineWidth = 2; c.stroke(); }
    c.restore(); return;
  }
  c.save(); c.translate((rail.x + .5) * tile, (rail.y + .5) * tile); if (rail.shape === 'NS') c.rotate(Math.PI / 2);
  c.globalAlpha = ghost ? .5 : 1;
  c.fillStyle = '#605f4c80'; c.fillRect(-tile / 2, -16, tile, 32);
  for (let x = -20; x <= 20; x += 10) { c.fillStyle = '#4c4739'; c.fillRect(x, -19, 5, 38); c.fillStyle = '#a2a095'; c.fillRect(x + 1, -14, 2, 3); c.fillRect(x + 1, 12, 2, 3); }
  for (const y of [-11, 11]) { c.fillStyle = '#243b3e'; c.fillRect(-tile / 2, y - 2, tile, 5); c.fillStyle = '#b6bab0'; c.fillRect(-tile / 2, y - 2, tile, 2); }
  c.restore();
}
export function drawRailGun(c, gun, tile, elapsed, recoil = 0, selected = false) {
  const p = gunPosition(gun, elapsed), braced = gun.move ? 0 : 1 - Math.min(1, gun.brace / RAIL.braceTime);
  c.save(); c.translate(p.x * tile, p.y * tile);
  if (selected) { c.strokeStyle = '#f2d39a'; c.lineWidth = 2; c.strokeRect(-1.5 * tile, -1.5 * tile, 3 * tile, 3 * tile); }
  c.fillStyle = '#162c3444'; c.fillRect(-56, -53, 120, 116);
  c.save(); c.rotate(p.chassis ?? (gun.shape === 'NS' ? Math.PI / 2 : 0));
  for (const y of [-21, 21]) for (const x of [-39, 30]) { c.fillStyle = '#263636'; c.fillRect(x, y - 7, 13, 14); c.fillStyle = '#9b9e91'; c.fillRect(x + 3, y - 5, 3, 10); }
  c.fillStyle = '#536562'; c.fillRect(-58, -48, 116, 96); c.strokeStyle = '#aebca5'; c.lineWidth = 2; c.strokeRect(-54, -44, 108, 88);
  for (const x of [-1, 1]) for (const y of [-1, 1]) { c.strokeStyle = '#334546'; c.lineWidth = 9; c.beginPath(); c.moveTo(x * 37, y * 28); c.lineTo(x * (46 + braced * 18), y * (37 + braced * 25)); c.stroke(); c.fillStyle = '#d3bd84'; c.fillRect(x * (46 + braced * 18) - 6, y * (37 + braced * 25) - 5, 12, 10); }
  c.restore();
  c.fillStyle = '#2b4142'; c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#9aa98f'; c.stroke();
  c.rotate(turnTurret(gun.angle, gun.aim, elapsed, RAIL.turnSpeed));
  c.save(); c.scale(1, .3 + .7 * Math.cos((gun.elevation ?? RAIL.defaultElevation) * Math.PI / 180));
  c.fillStyle = '#354849'; c.fillRect(-13, -78 + recoil * 2, 26, 68); c.fillStyle = '#a0aaa0'; c.fillRect(-9, -76 + recoil * 2, 18, 56);
  c.fillStyle = '#293f40'; c.fillRect(-17, -77 + recoil * 2, 34, 12); c.restore(); c.fillStyle = '#c6b483'; c.fillRect(-24, -20, 48, 48); c.strokeStyle = '#ead49e'; c.strokeRect(-19, -15, 38, 38);
  c.fillStyle = gun.operator ? '#9ee2d2' : '#526660'; c.fillRect(-5, 17, 10, 4); c.restore();
}
export function drawSalvos(c, salvos, tile, elapsed, reduced) {
  for (const s of salvos || []) {
    const t = Math.min(1, (s.elapsed + elapsed) / s.duration), groundX = (s.x + (s.targetX - s.x) * t) * tile, groundY = (s.y + (s.targetY - s.y) * t) * tile;
    const seconds = t * s.duration, priorSeconds = Math.max(0, seconds - .08), priorT = priorSeconds / s.duration;
    const altitude = at => s.gravity ? Math.max(0, s.verticalSpeed * at - .5 * s.gravity * at * at) : Math.sin(at / s.duration * Math.PI) * 16;
    const lift = reduced ? 0 : altitude(seconds) * tile * .12;
    c.save(); c.fillStyle = '#172e3544'; c.beginPath(); c.ellipse(groundX, groundY, 8, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = s.weapon === 'GAS' ? '#d5eea5' : s.weapon === 'INCENDIARY' ? '#ff9a49' : '#ffe2a7'; c.lineWidth = 3; c.beginPath(); c.moveTo((s.x + (s.targetX - s.x) * priorT) * tile, (s.y + (s.targetY - s.y) * priorT) * tile - (reduced ? 0 : altitude(priorSeconds) * tile * .12)); c.lineTo(groundX, groundY - lift); c.stroke();
    c.fillStyle = '#fff1c5'; c.beginPath(); c.arc(groundX, groundY - lift, 4, 0, Math.PI * 2); c.fill(); c.restore();
  }
}
