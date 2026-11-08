import { activeSectors, FUEL_POOL } from './hazards.js';
import { ARTILLERY_SHELLS } from './weapons.js';
import { windAt } from './wind.js';
// Fire and gas fields, drawn from the snapshot alone. The server owns every field's
// area, timer and kill count; nothing here changes them. Flames sway and lean with the
// shared cosmetic wind (wind.js), burn tall at first and down to embers at the end,
// over uneven burning puddles, with smoke drifting downwind. Gas spreads from its
// impact to its gameplay bound and rolls downwind inside it, thinning as its kills are
// spent. The boundary ring and the label show the true area from the first frame.
// Cached sprites only, no per-pixel work (author's brief, 9 November 2026).
const TAU = Math.PI * 2;
// The server's fuel pool radius (FUEL_POOL in hazards.js); a snapshot radius wins.
const POOL_RADIUS = FUEL_POOL.radius;
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = v => 1 - (1 - clamp01(v)) ** 3;
const sprites = new Map();
function sprite(kind) {
  if (sprites.has(kind)) return sprites.get(kind);
  const canvas = document.createElement('canvas'), flame = kind === 'flame';
  canvas.width = flame ? 32 : 96; canvas.height = flame ? 64 : 96;
  const g = canvas.getContext('2d');
  if (flame) {
    // A teardrop tongue, white at the root, orange, then a red tip fading out.
    const grad = g.createLinearGradient(0, 64, 0, 0);
    for (const [at, color] of [[0, 'rgba(255,246,204,.96)'], [.22, 'rgba(255,200,92,.95)'], [.58, 'rgba(240,102,32,.86)'], [1, 'rgba(150,36,14,0)']]) grad.addColorStop(at, color);
    g.fillStyle = grad; g.beginPath(); g.moveTo(16, 63); g.bezierCurveTo(1, 58, 3, 32, 16, 1); g.bezierCurveTo(29, 32, 31, 58, 16, 63); g.fill();
  } else {
    const r = g.createRadialGradient(48, 48, 2, 48, 48, 48);
    const stops = {
      vapor: [[0, '#d4eda0bb'], [.4, '#93b05f80'], [1, '#4e714500']],
      glow: [[0, 'rgba(255,214,120,.9)'], [.32, 'rgba(255,128,40,.62)'], [.7, 'rgba(196,52,20,.22)'], [1, 'rgba(110,28,14,0)']],
      smoke: [[0, 'rgba(46,36,30,.5)'], [.55, 'rgba(38,30,25,.24)'], [1, 'rgba(30,24,20,0)']],
      char: [[0, 'rgba(22,15,11,.85)'], [.6, 'rgba(30,21,15,.45)'], [1, 'rgba(36,26,18,0)']],
    }[kind];
    for (const [at, color] of stops) r.addColorStop(at, color);
    g.fillStyle = r; g.fillRect(0, 0, 96, 96);
  }
  sprites.set(kind, canvas); return canvas;
}
const blot = (c, kind, x, y, size, alpha) => { c.globalAlpha = alpha; c.drawImage(sprite(kind), x - size / 2, y - size / 2, size, size); };
function tongue(c, x, y, w, h, lean, alpha) {
  c.save(); c.translate(x, y); c.rotate(lean); c.globalAlpha = alpha; c.drawImage(sprite('flame'), -w / 2, -h, w, h); c.restore();
}

// Scorch left where a fire burned out, and the last kill count of each cloud so a
// spent kill can pulse. Both are browser memory only, bounded and short-lived.
const scorches = [], gasSeen = new Map();
let burning = new Map();
function trackFields(fields, time) {
  const now = new Map();
  for (const f of fields || []) {
    if (f.weapon === 'INCENDIARY') {
      if (f.sectors) for (const s of activeSectors(f)) now.set(`${f.id}:${s.x}:${s.y}`, { x: s.x, y: s.y, radius: s.radius, id: f.id, remaining: s.remaining });
      else now.set(String(f.id), { x: f.x, y: f.y, radius: f.radius, id: f.id, remaining: f.remaining });
    } else {
      const seen = gasSeen.get(f.id);
      if (seen && f.capacity < seen.capacity) seen.pulse = time;
      gasSeen.set(f.id, { capacity: f.capacity, pulse: seen?.pulse ?? -Infinity, at: time });
    }
  }
  // Only a fire that burned out leaves a scorch, not one that left the view for another reason.
  for (const [key, area] of burning) if (!now.has(key) && area.remaining < 1.5) scorches.push({ ...area, at: time });
  burning = now;
  while (scorches.length > 24 || (scorches.length && time - scorches[0].at > 20000)) scorches.shift();
  for (const [id, seen] of gasSeen) if (time - seen.at > 5000) gasSeen.delete(id);
}
function drawScorches(c, tile, time) {
  for (const s of scorches) {
    const age = (time - s.at) / 20000; if (age < 0 || age > 1) continue;
    const radius = s.radius * tile;
    for (let i = 0; i < 4; i++) blot(c, 'char', s.x * tile + (hash(s.id * 9 + i) - .5) * radius * .7, s.y * tile + (hash(s.id * 13 + i) - .5) * radius * .7, radius * (1.2 + hash(s.id + i) * .7), .5 * (1 - age));
  }
  c.globalAlpha = 1;
}

const count0 = (reduced, size) => reduced ? 14 : Math.max(6, Math.min(56, Math.round(5.5 * size * size)));
// One burning area: puddles, flames, embers, sparks and smoke. x, y and radius in pixels.
function burn(c, { x, y, radius, seed, age, remaining }, tile, time, reduced, wind) {
  const t = reduced ? 0 : time / 1000, end = clamp01(remaining / 4), flare = 1 + .25 * clamp01(1 - age / 2);
  const tall = (.3 + .7 * end) * flare, size = radius / tile;
  // Uneven burning puddles under the flames.
  c.globalCompositeOperation = 'lighter';
  const puddles = reduced ? 3 : Math.min(10, 5 + Math.round(size));
  for (let i = 0; i < puddles; i++) {
    const a = hash(seed + i * 3) * TAU, d = Math.sqrt(hash(seed + i * 5)) * radius * .72;
    blot(c, 'glow', x + Math.cos(a) * d, y + Math.sin(a) * d, radius * (.65 + .5 * hash(seed + i * 7)), (.42 + .06 * Math.sin(t * 3 + i)) * (.35 + .65 * end));
  }
  // Each flame's root glows, so the tongues merge into one burning surface.
  for (let i = 0; i < count0(reduced, size); i += 2) {
    const a = i * 2.39996 + seed, r = Math.sqrt((i + .5) / count0(reduced, size)) * radius * .9;
    blot(c, 'glow', x + Math.cos(a) * r, y + Math.sin(a) * r, tile * 1.1, .3 * (.35 + .65 * end));
  }
  c.globalCompositeOperation = 'source-over';
  const count = count0(reduced, size), live = Math.max(3, Math.round(count * (.35 + .65 * end)));
  const lean = wind.dx * wind.strength * (reduced ? .35 : .6), stretch = 1 - wind.dy * wind.strength * .25;
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996 + seed, r = Math.sqrt((i + .5) / count) * radius * .9;
    const fx = x + Math.cos(a) * r + (hash(seed + i * 2) - .5) * tile * .2, fy = y + Math.sin(a) * r + (hash(seed + i * 4) - .5) * tile * .2;
    if (i < live) {
      const sway = reduced ? 0 : Math.sin(t * 2.1 + i * 1.7) * .14 + Math.sin(t * 5.3 + i) * .05;
      const flicker = reduced ? 1 : .85 + .15 * Math.sin(t * 9 + i * 3.1);
      const w = tile * (.34 + .3 * hash(seed + i)) * (.7 + .3 * end), h = tile * (.62 + .62 * hash(seed + i * 11)) * tall * stretch * flicker;
      tongue(c, fx, fy, w, h, lean + sway, .86 * (.45 + .55 * end));
    }
    // Embers glow where flames have burnt down.
    if (i >= live || end < 1) {
      c.globalAlpha = (i >= live ? .85 : .35 * (1 - end)) * (.6 + .4 * Math.sin(t * 4 + i * 2.3));
      c.fillStyle = '#ff9a3c'; c.beginPath(); c.arc(fx, fy, tile * (.035 + .03 * hash(seed + i * 17)), 0, TAU); c.fill();
    }
  }
  if (!reduced) {
    // Sparks rise and blow downwind; smoke plumes drift away from the fire.
    for (let i = 0; i < count; i += 4) {
      const a = i * 2.39996 + seed, r = Math.sqrt((i + .5) / count) * radius * .9, rise = (t * .7 + i * .17) % 1;
      c.globalAlpha = (1 - rise) * .7 * end; c.fillStyle = '#ffdc83';
      c.fillRect(x + Math.cos(a) * r + wind.dx * rise * tile * 1.4, y + Math.sin(a) * r + wind.dy * rise * tile * 1.4 - rise * tile * 1.2, 2, 3);
    }
    const plumes = Math.min(8, 2 + Math.round(size * 1.5));
    for (let j = 0; j < plumes; j++) {
      const phase = (t * .12 * (.6 + wind.strength) + hash(seed + j * 23)) % 1, a = hash(seed + j * 29) * TAU, d = Math.sqrt(hash(seed + j * 31)) * radius * .7;
      const travel = phase * (radius * 1.2 + tile * 2);
      blot(c, 'smoke', x + Math.cos(a) * d + wind.dx * travel, y + Math.sin(a) * d + wind.dy * travel - phase * tile * .8, tile * (.9 + phase * 2.4), Math.sin(Math.PI * phase) * .5 * (.3 + .7 * end));
    }
  }
  c.globalAlpha = 1;
}
// The napalm splash of a landing: a fireball and a ring of burning globs thrown out.
function splash(c, x, y, radius, seed, age, tile) {
  const e = clamp01(age / .7); if (e >= 1) return;
  c.globalCompositeOperation = 'lighter';
  blot(c, 'glow', x, y, radius * (.8 + 1.6 * ease(e)), (1 - e) * .85);
  for (let i = 0; i < 14; i++) {
    const a = hash(seed * 3 + i) * TAU, d = radius * (.15 + .95 * ease(e)) * (.5 + .5 * hash(seed * 5 + i));
    blot(c, 'glow', x + Math.cos(a) * d, y + Math.sin(a) * d, tile * .5 * (1 - .6 * e), 1 - e);
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
// One cloud: spreading to its bound, rolling downwind inside it, pulsing on a spent kill.
function cloud(c, { x, y, radius, seed, age, strength, pulse }, tile, time, reduced, wind) {
  const t = reduced ? 0 : time / 1000, spread = reduced ? 1 : ease(age / 1.5), current = radius * (.18 + .82 * spread);
  c.save(); c.beginPath(); c.arc(x, y, radius, 0, TAU); c.clip();
  c.fillStyle = '#6b8b4938'; c.beginPath(); c.arc(x, y, current, 0, TAU); c.fill();
  const px = -wind.dy, py = wind.dx, count = reduced ? 9 : 22;
  for (let i = 0; i < count; i++) {
    const drifting = !reduced && i % 2 === 0;
    const across = (hash(seed + i) * 2 - 1) * current * .8;
    const phase = drifting ? (t * .035 * (.5 + wind.strength) + hash(seed + i * 3)) % 1 : hash(seed + i * 3);
    const along = (phase * 2 - 1) * current * .8, roll = reduced ? 0 : Math.sin(t * .3 + i) * tile * .2;
    const size = current * (.55 + .35 * hash(seed + i * 7)) * (reduced ? 1 : 1 + .08 * Math.sin(t * .5 + i));
    blot(c, 'vapor', x + wind.dx * along + px * (across + roll), y + wind.dy * along + py * (across + roll), size, (.22 + .55 * strength) * (drifting ? Math.sin(Math.PI * phase) : 1));
  }
  const since = (time - pulse) / 600;
  if (since >= 0 && since < 1) blot(c, 'vapor', x, y, current * 2.2, (1 - since) * .6);
  c.restore();
  if (since >= 0 && since < 1) { c.globalAlpha = (1 - since) * .7; c.strokeStyle = '#e6f5b8'; c.lineWidth = tile * .06; c.beginPath(); c.arc(x, y, current * (.85 + .2 * since), 0, TAU); c.stroke(); }
  // Faint wisps reach toward the lure range and fall back.
  if (!reduced && spread >= 1) {
    const lure = (ARTILLERY_SHELLS.GAS.lureRange || 10) * tile;
    for (let i = 0; i < 5; i++) {
      const a = wind.angle + (i - 2) * 1.1 + hash(seed + i * 41), phase = (t * .08 + hash(seed + i * 43)) % 1, reach = radius + (lure - radius) * phase * .8;
      for (let k = 1; k <= 3; k++) {
        const d = radius + (reach - radius) * k / 3;
        blot(c, 'vapor', x + Math.cos(a) * d, y + Math.sin(a) * d, tile * (1.2 - k * .2), (1 - phase) * .07 * strength);
      }
    }
  }
  c.globalAlpha = 1;
}

/**
 * @param {CanvasRenderingContext2D} c @param {any[]} fields @param {number} tile @param {number} time server clock in ms
 * @param {boolean} reduced @param {number} zoom @param {{id?:string,name?:string}} [world] for the shared wind
 */
export function drawHazards(c, fields, tile, time, reduced, zoom, world) {
  trackFields(fields, time);
  drawScorches(c, tile, time);
  const wind = windAt(world, time, reduced);
  for (const f of fields || []) {
    if (f.sectors) { drawBarrageHazard(c, f, tile, time, reduced, zoom, wind); continue; }
    const fire = f.weapon === 'INCENDIARY', age = Math.max(0, (time - f.at) / 1000), radius = f.radius * tile;
    const strength = fire ? Math.min(1, f.remaining / 2) : f.capacity / f.initialCapacity;
    c.save(); c.translate(f.x * tile, f.y * tile);
    if (fire) {
      c.fillStyle = '#271d19aa'; c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.fill();
      // The heat band outside the ring, where enemies slow: a shimmer, still at reduced effects.
      const band = ARTILLERY_SHELLS.INCENDIARY.heatBand * tile, t = reduced ? 0 : time / 1000;
      c.strokeStyle = '#efb45e40'; c.lineWidth = band; c.beginPath(); c.arc(0, 0, radius + band / 2, 0, TAU); c.stroke();
      if (!reduced) for (let j = 0; j < 3; j++) {
        c.strokeStyle = '#ffcf80'; c.globalAlpha = (.16 - j * .04) * (.4 + .6 * Math.min(1, f.remaining / 4)); c.lineWidth = tile * .08; c.beginPath();
        for (let k = 0; k <= 48; k++) {
          const a = k / 48 * TAU, r = radius + band * (.2 + .3 * j) + Math.sin(a * 6 + t * (2 + j) + j) * tile * .05;
          if (k) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      burn(c, { x: 0, y: 0, radius, seed: f.id * 7.31, age, remaining: f.remaining }, tile, time, reduced, wind);
      if (!reduced) splash(c, 0, 0, radius, f.id, age, tile);
    } else cloud(c, { x: 0, y: 0, radius, seed: f.id * 5.17, age, strength, pulse: gasSeen.get(f.id)?.pulse ?? -Infinity }, tile, time, reduced, wind);
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

function drawBarrageHazard(c, f, tile, time, reduced, zoom, wind) {
  const sectors = activeSectors(f); if (!sectors.length) return;
  const b = f.box, transform = c.getTransform();
  const left = b.x * tile * transform.a + transform.e, top = b.y * tile * transform.d + transform.f;
  if (left > c.canvas.width || top > c.canvas.height || left + b.width * tile * transform.a < 0 || top + b.height * tile * transform.d < 0) return;
  const fire = f.weapon === 'INCENDIARY';
  c.save(); c.beginPath(); c.rect(b.x * tile, b.y * tile, b.width * tile, b.height * tile); c.clip();
  for (let index = 0; index < sectors.length; index++) {
    const s = sectors[index], x = s.x * tile, y = s.y * tile, radius = s.radius * tile, age = Math.max(0, (time - (s.at ?? f.at)) / 1000);
    const seed = f.id * 13.7 + index * 3.1;
    if (fire) {
      c.fillStyle = '#48231c65'; c.beginPath(); c.arc(x, y, radius, 0, TAU); c.fill();
      burn(c, { x, y, radius, seed, age, remaining: s.remaining }, tile, time, reduced, wind);
      if (!reduced) splash(c, x, y, radius, seed, age, tile);
    } else cloud(c, { x, y, radius, seed, age, strength: f.capacity / f.initialCapacity, pulse: gasSeen.get(f.id)?.pulse ?? -Infinity }, tile, time, reduced, wind);
    c.globalAlpha = 1; c.strokeStyle = fire ? '#ffc06690' : '#d5eea590'; c.lineWidth = 1 / zoom; c.beginPath(); c.arc(x, y, radius, 0, TAU); c.stroke();
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

/**
 * Burning fuel pools left by the robot's jet: live fire on the ground, with a crisp rim
 * like a fire field's, fading in their last 0.6 s. Distinct from the stream's
 * half-second cosmetic splash.
 * @param {CanvasRenderingContext2D} c @param {Array<{id:number,x:number,y:number,at:number,until:number,heavy?:boolean,radius?:number}>|undefined} pools
 * @param {number} tile @param {number} time server clock in ms @param {boolean} reduced @param {{dx:number,dy:number,strength:number}} [wind]
 */
export function drawFuelPools(c, pools, tile, time, reduced, wind = { angle: -Math.PI / 2, dx: 0, dy: -1, strength: 0 }) {
  if (!pools?.length) return;
  const t = reduced ? 0 : time / 1000;
  for (const p of pools.slice(0, 48)) {
    const left = (p.until - time) / 1000, age = (time - p.at) / 1000;
    if (left <= 0) continue;
    const fade = clamp01(left / .6), grow = reduced ? 1 : ease(age / .15), seed = Number(p.id) || hash(p.x * 31 + p.y);
    const x = p.x * tile, y = p.y * tile, r = (p.radius ?? POOL_RADIUS) * tile * (p.heavy ? 1.1 : 1) * (.55 + .45 * grow);
    c.globalAlpha = .78 * fade; c.fillStyle = '#2b160c'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    blot(c, 'glow', x, y, r * 2.8, .8 * fade * (reduced ? 1 : .85 + .15 * Math.sin(t * 7 + seed)));
    c.globalCompositeOperation = 'source-over';
    const flames = reduced ? 3 : 4;
    for (let i = 0; i < flames; i++) {
      const a = i / flames * TAU + seed, sway = reduced ? 0 : Math.sin(t * 2.6 + i * 1.9 + seed) * .16;
      const h = tile * (.38 + .18 * hash(seed + i)) * (reduced ? 1 : .88 + .12 * Math.sin(t * 9 + i * 2.7 + seed)) * (.4 + .6 * fade);
      tongue(c, x + Math.cos(a) * r * .45, y + Math.sin(a) * r * .45, tile * .18, h, wind.dx * wind.strength * .5 + sway, .9 * fade);
    }
    c.globalAlpha = .85 * fade; c.strokeStyle = '#ffb35e'; c.lineWidth = Math.max(1.2, tile * .035); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  }
  c.globalAlpha = 1;
}
