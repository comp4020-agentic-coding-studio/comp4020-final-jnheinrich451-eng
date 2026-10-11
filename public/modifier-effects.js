import { MODIFIER, convertedCells, conversionStrength } from './modifier.js';
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
      // Remove coating from water/rock/floor while preserving a smooth land edge.
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#fff'; g.beginPath();
      for (let cy = y; cy < y + side; cy++) for (let cx = x; cx < x + side; cx++) {
        if (cx < 0 || cy < 0 || cx >= world.width || cy >= world.height) continue;
        if ([1, 2].includes(world.terrain[cy * world.width + cx])) g.rect((cx - x) * scale, (cy - y) * scale, scale, scale);
      }
      g.fill(); g.globalCompositeOperation = 'source-over';
      layer = { canvas, x, y, side }; cache.set(site.id, layer);
    }
    c.save(); c.globalAlpha = strength; c.drawImage(layer.canvas, layer.x * tile, layer.y * tile, layer.side * tile, layer.side * tile); c.restore();
  }
}

// Broad low rosette with swollen translucent pods: distinct from the tall scanner
// and the mortar's curved barrel. Coordinates are in tiles.
export function drawModifierBody(c, site, time, reduced) {
  const dead = site.state === 'conquered', pulse = dead || reduced ? 1 : 1 + Math.sin(time / 850) * .045;
  c.fillStyle = dead ? '#302632' : '#302736'; c.beginPath(); c.ellipse(0, .1, 1.45, 1.14, 0, 0, TAU); c.fill();
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7, r = .72, x = Math.cos(a) * r, y = Math.sin(a) * r;
    c.save(); c.translate(x, y); c.rotate(a);
    const g = c.createLinearGradient(-.35, -.45, .5, .4);
    g.addColorStop(0, dead ? '#675348' : '#be8872'); g.addColorStop(.35, dead ? '#513b46' : '#9a536a'); g.addColorStop(1, '#362937');
    c.fillStyle = g; c.strokeStyle = '#332430'; c.lineWidth = .09;
    c.beginPath(); c.ellipse(0, 0, .53 * pulse, (dead ? .23 : .39) * pulse, 0, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = dead ? '#77575c' : '#e3b28b66'; c.lineWidth = .035;
    c.beginPath(); c.moveTo(-.35, -.12); c.quadraticCurveTo(0, -.3, .32, -.1); c.stroke();
    c.fillStyle = '#32222e'; c.beginPath(); c.ellipse(.14, .09, .06, .13, -.4, 0, TAU); c.fill(); c.restore();
  }
  c.fillStyle = dead ? '#231f28' : '#8e697b'; c.beginPath(); c.arc(0, 0, .48 * pulse, 0, TAU); c.fill();
  c.fillStyle = '#241b2d'; c.beginPath(); c.ellipse(0, .04, .19, dead ? .09 : .29, -.25, 0, TAU); c.fill();
  if (!dead) for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5; c.fillStyle = '#dab899'; c.beginPath(); c.ellipse(Math.cos(a) * .29, Math.sin(a) * .29, .06, .1, a, 0, TAU); c.fill();
  }
}
