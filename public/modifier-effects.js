import { MODIFIER, convertedCells, conversionStrength } from './modifier.js';
import { paintedSurfaces } from './ground-art.js';
const TAU = Math.PI * 2, caches = new WeakMap();
const noise = (x, y) => {
  let n = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
};

export function drawConvertedGround(c, world, tile, time, reduced) {
  let cache = caches.get(world); if (!cache) caches.set(world, cache = new Map());
  for (const site of world.sites || []) {
    if (site.kind !== 'modifier') continue;
    const strength = conversionStrength(site, time, reduced);
    if (!strength) { cache.delete(site.id); continue; }
    let layer = cache.get(site.id);
    if (!layer) {
      const scale = 32, side = MODIFIER.radius * 2 + 3, x = site.x - MODIFIER.radius, y = site.y - MODIFIER.radius;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = side * scale;
      const g = canvas.getContext('2d');
      const center = (MODIFIER.radius + 1.5) * scale;
      g.save(); g.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = i * TAU / 96, r = MODIFIER.radius * scale * (.88 + .07 * Math.sin(a * 5 + site.x) + .05 * Math.cos(a * 9 + site.y));
        const px = center + Math.cos(a) * r, py = center + Math.sin(a) * r;
        if (!i) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath(); g.clip();
      const carpet = g.createRadialGradient(center, center, scale, center, center, MODIFIER.radius * scale);
      carpet.addColorStop(0, '#513247bb'); carpet.addColorStop(.7, '#60425699'); carpet.addColorStop(1, '#75485b00');
      g.fillStyle = carpet; g.fillRect(0, 0, canvas.width, canvas.height);
      for (const cell of convertedCells(world, site)) {
        const n = noise(cell.x, cell.y), q = noise(cell.y + 7919, cell.x), px = (cell.x - x + n) * scale, py = (cell.y - y + q) * scale;
        g.globalAlpha = cell.strength;
        const stain = g.createRadialGradient(px, py, 2, px, py, scale * (.45 + q * .5));
        stain.addColorStop(0, n > .6 ? '#aa73718a' : '#342d4288'); stain.addColorStop(1, '#57375000');
        g.fillStyle = stain; g.fillRect(px - scale, py - scale, scale * 2, scale * 2);
        if (n > .4) {
          g.save(); g.translate(px, py); g.rotate(q * TAU);
          g.beginPath(); g.moveTo(-13, n * 5); g.bezierCurveTo(-5, -9, 8, 10, 20, -q * 8);
          g.strokeStyle = '#302735aa'; g.lineWidth = 1.7; g.stroke(); g.strokeStyle = '#c1898466'; g.lineWidth = .6; g.stroke();
          g.restore();
        }
        if (n > .75) { g.beginPath(); g.ellipse(px, py, 2 + q * 3, 1.5 + n * 2, q * TAU, 0, TAU); g.fillStyle = '#c4988266'; g.fill(); }
      }
      g.globalAlpha = .5;
      for (let i = 0; i < 16; i++) {
        const a = i * TAU / 16, r = scale * (5 + noise(i, site.x) * 3);
        g.beginPath(); g.moveTo(center, center);
        g.bezierCurveTo(center + Math.cos(a + .3) * r * .4, center + Math.sin(a + .3) * r * .4,
          center + Math.cos(a - .2) * r * .7, center + Math.sin(a - .2) * r * .7, center + Math.cos(a) * r, center + Math.sin(a) * r);
        g.strokeStyle = '#332535'; g.lineWidth = 2; g.stroke(); g.strokeStyle = '#b1797666'; g.lineWidth = .7; g.stroke();
      }
      g.restore();
      // Keep the coating on dry ground only, following the painted coast and ridge
      // edges, with a round clearing at each rock so the obstacle stays easy to see.
      // The mask is sampled at 8 px a tile and smoothed up; the coating is soft anyway.
      const fine = 8, drawn = paintedSurfaces(world, x, y, side, fine), mask = document.createElement('canvas');
      mask.width = mask.height = side * fine;
      const m = mask.getContext('2d'), image = m.createImageData(mask.width, mask.height);
      for (let i = 0; i < drawn.length; i++) image.data[i * 4 + 3] = drawn[i] === 0 ? 255 : 0;
      m.putImageData(image, 0, 0); m.globalCompositeOperation = 'destination-out';
      for (let cy = y; cy < y + side; cy++) for (let cx = x; cx < x + side; cx++) {
        const kind = cx < 0 || cy < 0 || cx >= world.width || cy >= world.height ? 0 : world.terrain[cy * world.width + cx];
        if (kind === 4) m.fillRect((cx - x) * fine, (cy - y) * fine, fine, fine);
        if (kind === 3) { m.beginPath(); m.arc((cx - x + .5) * fine, (cy - y + .52) * fine, fine * .48, 0, TAU); m.fill(); }
      }
      g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(mask, 0, 0, side * scale, side * scale); g.globalCompositeOperation = 'source-over';
      layer = { canvas, x, y, side }; cache.set(site.id, layer);
    }
    c.save(); c.globalAlpha = strength; c.drawImage(layer.canvas, layer.x * tile, layer.y * tile, layer.side * tile, layer.side * tile); c.restore();
  }
}
