import { LASER } from './laser-tower.js';
import { LANCE_REACH } from './facility-art.js';
// Canvas geometry keeps the beam cheap at every zoom level. The tower body is
// drawn by facility-art.js; the server's ray decides hits, and the visible beam
// starts at the drawn lance tip rather than the site centre.
export function drawLaserBeams(c, sites, tile, zoom, world, buildings, beamRay) {
  for (const site of sites) {
    const m = site.laser;
    if (site.kind !== 'laser' || site.state !== 'hostile' || !['charging', 'firing'].includes(m?.phase)) continue;
    const from = { x: site.x + 1.5 + Math.sin(m.angle || 0) * LANCE_REACH, y: site.y + 1.5 - Math.cos(m.angle || 0) * LANCE_REACH };
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
