import { LASER } from './laser-tower.js';
// Canvas geometry keeps the tower and beam cheap at every zoom level.
export function drawLaserBody(c, site, time, reduced) {
  const dead = site.state === 'conquered', m = site.laser;
  c.fillStyle = dead ? '#352d35' : '#422638';
  c.beginPath(); c.ellipse(0, 0, 1.2, 1.05, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * Math.PI / 3);
    c.fillStyle = dead ? '#685050' : '#945a68'; c.strokeStyle = '#33202e'; c.lineWidth = .08;
    c.beginPath(); c.moveTo(.35, -.35); c.lineTo(1.2, -.22); c.lineTo(1.35, .12); c.lineTo(.5, .32); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  c.save(); c.rotate(m?.angle || 0);
  c.fillStyle = dead ? '#463342' : '#712c50'; c.fillRect(-.32, -1.28, .64, 1.6);
  c.strokeStyle = '#ba8991'; c.lineWidth = .09;
  for (const x of [-.33, .33]) { c.beginPath(); c.moveTo(x, .2); c.lineTo(x * .6, -1.45); c.stroke(); }
  c.fillStyle = dead ? '#302635' : m?.phase === 'firing' ? '#fff0d6' : m?.phase === 'charging' ? '#ffb6af' : '#df3f65';
  c.beginPath(); c.ellipse(0, -.78, .19, .46, 0, 0, Math.PI * 2); c.fill(); c.restore();
  if (!dead && m?.phase === 'charging') {
    c.strokeStyle = '#ffb7a7'; c.lineWidth = .055;
    c.beginPath(); c.arc(0, 0, 1.5 + (reduced ? 0 : Math.sin(time / 100) * .08), 0, Math.PI * 2); c.stroke();
  }
}

export function drawLaserBeams(c, sites, tile, zoom, world, buildings, beamRay) {
  for (const site of sites) {
    const m = site.laser;
    if (site.kind !== 'laser' || site.state !== 'hostile' || !['charging', 'firing'].includes(m?.phase)) continue;
    const from = { x: site.x + 1.5, y: site.y + 1.5 };
    const end = m.phase === 'firing' ? m.beam : beamRay(world, buildings, site, m.angle, LASER.range);
    if (!end) continue;
    c.save(); c.lineCap = 'round';
    const line = (color, width) => { c.strokeStyle = color; c.lineWidth = width / zoom; c.beginPath(); c.moveTo(from.x * tile, from.y * tile); c.lineTo(end.x * tile, end.y * tile); c.stroke(); };
    if (m.phase === 'charging') { c.setLineDash([5 / zoom, 7 / zoom]); line('#ffa5adbb', 1.5); }
    else { line('#ff30594d', 13); line('#ff4868', 5); line('#fff1cb', 1.8); }
    c.setLineDash([]); c.fillStyle = m.phase === 'firing' ? '#fff1cb' : '#ffa5ad';
    c.beginPath(); c.arc(end.x * tile, end.y * tile, 3 / zoom, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ff4868aa'; c.lineWidth = 1.5 / zoom;
    c.beginPath(); c.arc(end.x * tile, end.y * tile, 6 / zoom, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
}
