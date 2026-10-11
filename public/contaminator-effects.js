import { fogRadius } from './contaminator.js';

let texture;
function fogTexture() {
  if (texture) return texture;
  texture = document.createElement('canvas'); texture.width = texture.height = 768;
  const c = texture.getContext('2d'), center = 384, r = 332;
  c.fillStyle = '#593e58'; c.fillRect(0, 0, 768, 768);
  // One cached opaque texture, with broad lobes instead of simulated particles.
  for (let i = 0; i < 64; i++) {
    const x = 384 + Math.sin(i * 13.17) * 360, y = 384 + Math.cos(i * 7.91) * 360, size = 60 + (i * 31 % 100);
    const g = c.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, i % 3 ? '#a9526066' : '#a57abb77'); g.addColorStop(1, '#58354b00');
    c.fillStyle = g; c.fillRect(x - size, y - size, size * 2, size * 2);
  }
  c.globalCompositeOperation = 'destination-in';
  const mask = c.createRadialGradient(center, center, r, center, center, 383);
  mask.addColorStop(0, '#000'); mask.addColorStop(1, '#0000');
  c.fillStyle = mask; c.fillRect(0, 0, 768, 768);
  return texture;
}

// This is deliberately the last world layer. Interior pixels are opaque, even
// under reduced effects; only approved long-range aiming is drawn above it.
export function drawContamination(c, sites, tile, time, reduced) {
  for (const site of sites) {
    const r = fogRadius(site, time); if (!r) continue;
    c.save(); c.translate((site.x + 1.5) * tile, (site.y + 1.5) * tile);
    c.rotate(reduced ? 0 : time / 160000);
    const size = r * tile * 384 / 332;
    c.drawImage(fogTexture(), -size, -size, size * 2, size * 2); c.restore();
  }
}
export function drawContaminationMap(c, sites, sx, sy, time) {
  for (const site of sites) {
    const r = fogRadius(site, time); if (!r) continue;
    c.fillStyle = '#725066'; c.beginPath();
    c.ellipse((site.x + 1.5) * sx, (site.y + 1.5) * sy, r * sx, r * sy, 0, 0, Math.PI * 2); c.fill();
  }
}
export function drawContaminatorBody(c, site) {
  const dead = site.state === 'conquered';
  c.fillStyle = dead ? '#453340' : '#652d43'; c.beginPath(); c.ellipse(0, 0, 1.25, 1.05, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, x = Math.cos(a) * .65, y = Math.sin(a) * .55;
    c.fillStyle = dead ? '#594350' : '#ad6276'; c.beginPath(); c.ellipse(x, y, .38, .5, a, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#271e2d'; c.beginPath(); c.ellipse(x, y - .08, .22, .3, a, 0, Math.PI * 2); c.fill();
  }
}
