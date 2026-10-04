import { activeSectors } from './hazards.js';
// Fixed analytic sprites per field. No particles or decorative physics on server.
const TAU = Math.PI * 2;
let vapor;
function vaporSprite() {
  if (vapor) return vapor;
  vapor = document.createElement('canvas'); vapor.width = vapor.height = 96;
  const c = vapor.getContext('2d'), g = c.createRadialGradient(48, 48, 2, 48, 48, 48);
  g.addColorStop(0, '#d4eda0bb'); g.addColorStop(.4, '#93b05f80'); g.addColorStop(1, '#4e714500');
  c.fillStyle = g; c.fillRect(0, 0, 96, 96); return vapor;
}
export function drawHazards(c, fields, tile, time, reduced, zoom) {
  for (const f of fields || []) {
    if (f.sectors) { drawBarrageHazard(c, f, tile, time, reduced, zoom); continue; }
    const fire = f.weapon === 'INCENDIARY', age = Math.max(0, (time - f.at) / 1000), radius = f.radius * tile;
    const strength = fire ? Math.min(1, f.remaining / 2) : f.capacity / f.initialCapacity;
    const t = reduced ? 0 : time / 1000;
    c.save(); c.translate(f.x * tile, f.y * tile);
    c.fillStyle = fire ? '#271d19aa' : '#6b8b4938'; c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.fill();
    if (fire) {
      c.strokeStyle = '#efb45e40'; c.lineWidth = .75 * tile; c.beginPath(); c.arc(0, 0, radius + .375 * tile, 0, TAU); c.stroke();
      const count = reduced ? 20 : 58;
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996 + f.id, r = Math.sqrt((i + .5) / count) * radius * .91;
        const x = Math.cos(a) * r, y = Math.sin(a) * r, pulse = .7 + .3 * Math.sin(t * 9 + i * 3.1);
        const w = (10 + i % 4 * 3) * (.65 + strength * .35), h = (20 + i % 7 * 4) * pulse;
        c.globalAlpha = (.65 + .3 * pulse) * Math.max(.2, strength);
        c.fillStyle = '#ce401b'; c.beginPath(); c.ellipse(x, y, w * 1.3, w * .5, a, 0, TAU); c.fill();
        for (const [scale, color] of [[1, '#ef651e'], [.65, '#ffc15b'], [.32, '#fff1b7']]) {
          c.fillStyle = color; c.beginPath(); c.moveTo(x - w * scale, y);
          c.bezierCurveTo(x - w, y - h * .45, x + Math.sin(t * 5 + i) * w, y - h, x + w * .3, y - h * scale);
          c.bezierCurveTo(x + w * scale, y - h * .35, x + w * scale, y, x - w * scale, y); c.fill();
        }
        if (!reduced && i % 4 === 0) {
          const rise = (t * .7 + i * .17) % 1; c.globalAlpha = (1 - rise) * .6 * strength;
          c.fillStyle = '#ffdc83'; c.fillRect(x + Math.sin(t + i) * 12, y - rise * 65, 2, 3);
        }
      }
    } else {
      const count = reduced ? 9 : 24, sprite = vaporSprite();
      c.save(); c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.clip();
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996 + t * .07, r = Math.sqrt((i + .5) / count) * radius * .8;
        const size = radius * (.7 + .15 * Math.sin(t + i));
        c.globalAlpha = .25 + strength * .65;
        c.drawImage(sprite, Math.cos(a) * r - size / 2, Math.sin(a) * r - size / 2, size, size);
      }
      c.restore();
    }
    c.globalAlpha = 1; c.strokeStyle = fire ? '#ffc370' : '#d5eea5'; c.lineWidth = 1.3 / zoom;
    c.setLineDash(fire ? [] : [5 / zoom, 4 / zoom]); c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.stroke(); c.setLineDash([]);
    if (age < .7 && !reduced) {
      c.globalAlpha = (1 - age / .7) * .7; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, radius * Math.min(1.1, age * 2), 0, TAU); c.stroke(); c.globalAlpha = 1;
    }
    // The display clock animates only; expiry/capacity always comes from snapshots.
    const text = fire ? `FIRE ${Math.ceil(f.remaining)}s` : `GAS ${f.capacity}/${f.initialCapacity}`;
    c.font = `bold ${Math.max(12, 10 / zoom)}px monospace`; c.textAlign = 'center';
    const width = c.measureText(text).width;
    c.fillStyle = '#172c2cdd'; c.fillRect(-width / 2 - 5, radius + 5, width + 10, Math.max(18, 15 / zoom));
    c.fillStyle = fire ? '#ffd79e' : '#d5eea5'; c.fillText(text, 0, radius + 5 + Math.max(13, 11 / zoom)); c.restore();
  }
}

function drawBarrageHazard(c, f, tile, time, reduced, zoom) {
  const sectors = activeSectors(f); if (!sectors.length) return;
  const b = f.box, transform = c.getTransform();
  const left = b.x * tile * transform.a + transform.e, top = b.y * tile * transform.d + transform.f;
  if (left > c.canvas.width || top > c.canvas.height || left + b.width * tile * transform.a < 0 || top + b.height * tile * transform.d < 0) return;
  const fire = f.weapon === 'INCENDIARY', t = reduced ? 0 : time / 1000;
  c.save(); c.beginPath(); c.rect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.clip();
  for (let index = 0; index < sectors.length; index++) {
    const s = sectors[index], x = s.x * tile, y = s.y * tile, radius = s.radius * tile;
    const strength = fire ? Math.min(1, s.remaining / 2) : f.capacity / f.initialCapacity;
    c.save(); c.beginPath(); c.arc(x, y, radius, 0, TAU); c.clip();
    c.fillStyle = fire ? '#48231c65' : '#63894140'; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    const count = reduced ? 3 : fire ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const seedX = Math.sin(i * 127.1 + index * 311.7 + f.id * 13) * 43758.5453;
      const angle = (seedX - Math.floor(seedX)) * TAU, distance = Math.sqrt((i + .5) / count) * radius * .85;
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
      if (fire) {
        const pulse = .75 + .25 * Math.sin(t * 8 + i * 3 + index), size = tile * (.35 + i % 3 * .07);
        c.globalAlpha = Math.max(.2, strength);
        for (const [scale, color] of [[1, '#ed5821'], [.62, '#ffb949'], [.28, '#fff0bc']]) {
          c.fillStyle = color; c.beginPath(); c.moveTo(px - size * scale, py + size * .2);
          c.quadraticCurveTo(px - size * scale, py - size * pulse, px + Math.sin(t * 4 + i) * size * .3, py - size * 2.3 * pulse * scale);
          c.quadraticCurveTo(px + size * scale, py - size, px + size * scale, py + size * .2); c.fill();
        }
      } else {
        const size = tile * (3.5 + Math.sin(t + i) * .3);
        c.globalAlpha = .35 + strength * .55;
        c.drawImage(vaporSprite(), px - size / 2 + Math.sin(t * .6 + i) * tile * .15, py - size / 2, size, size);
      }
    }
    c.restore(); c.strokeStyle = fire ? '#ffc06690' : '#d5eea590'; c.lineWidth = 1 / zoom; c.beginPath(); c.arc(x, y, radius, 0, TAU); c.stroke();
  }
  c.restore(); c.save();
  c.strokeStyle = fire ? '#ffc370' : '#d5eea5'; c.lineWidth = 1.3 / zoom; c.setLineDash([5 / zoom, 4 / zoom]);
  c.strokeRect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.setLineDash([]);
  const label = fire ? `FIRE ${Math.ceil(f.remaining)}s` : `GAS ${f.capacity}/${f.initialCapacity}`;
  c.font = `bold ${11 / zoom}px monospace`; c.textAlign = 'center';
  const width = c.measureText(label).width, x = f.x * tile, y = (b.y + b.height) * tile + 5 / zoom;
  c.fillStyle = '#172c2cee'; c.fillRect(x - width / 2 - 4 / zoom, y, width + 8 / zoom, 17 / zoom);
  c.fillStyle = fire ? '#ffd79e' : '#d5eea5'; c.fillText(label, x, y + 12 / zoom); c.restore();
}
