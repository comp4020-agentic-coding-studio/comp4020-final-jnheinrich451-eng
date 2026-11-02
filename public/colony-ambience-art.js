import { COLONY_DEPTH, COLONY_HEIGHT, projectColonyPoint, colonyWorldToScreen } from './colony-view.js';

const TAU = Math.PI * 2;
const hash = (i, salt = 0) => { const v = Math.sin(i * 127.1 + salt * 73.3) * 43758.5453; return v - Math.floor(v); };
const point = (x, y, z = 0) => { const p = projectColonyPoint(x, y, z); return [p.x, p.y]; };
const line = (c, points, color, width) => { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke(); };
const polygon = (c, points, color, stroke = '#52616a', width = .025) => { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } };
const ellipse = (c, x, y, rx, ry, color, angle = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fillStyle = color; c.fill(); };

// Static foundations are rasterized by the main renderer at its current zoom.
export function drawCampfireBase(c, item) {
  const x = item.x + .5, y = item.y + .5;
  ellipse(c, x + .06, (y + .08) * COLONY_DEPTH, .53, .36 * COLONY_DEPTH, '#394c502b');
  ellipse(c, x, y * COLONY_DEPTH, .44, .32 * COLONY_DEPTH, '#514e45');
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9, [px, py] = point(x + Math.cos(a) * .39, y + Math.sin(a) * .28, .06);
    ellipse(c, px, py + .025, .115, .080, '#657473', a * .2);
    ellipse(c, px - .012, py - .014, .10, .061, i % 2 ? '#d1d6c5' : '#b9c3b6', a * .2);
  }
  for (const sign of [-1, 1]) {
    line(c, [point(x - .25, y - sign * .17, .10), point(x + .25, y + sign * .17, .10)], '#5b4a3a', .13);
    line(c, [point(x - .21, y - sign * .14, .15), point(x + .21, y + sign * .14, .15)], '#9b7954', .038);
  }
}

export function drawCampfire(c, item, time, reduced) {
  if (!item.lit) return;
  const x = item.x + .5, y = item.y + .5, t = reduced ? 0 : time;
  const [sx, sy] = point(x, y, .14);
  c.save(); c.translate(sx, sy);
  for (let i = 0; i < 3; i++) {
    const sway = reduced ? 0 : Math.sin(t * (5.6 + i) + i * 1.9) * .045;
    const height = [.75, .56, .35][i] + (reduced ? 0 : Math.sin(t * 8.3 + i) * .035);
    const width = [.27, .19, .10][i];
    c.beginPath(); c.moveTo(-width, .01);
    c.bezierCurveTo(-width * 1.10, -height * .34, -width * .25, -height * .42, sway, -height);
    c.bezierCurveTo(width * .08 + sway, -height * .57, width * 1.10, -height * .30, width, .01);
    c.quadraticCurveTo(0, .12, -width, .01);
    c.fillStyle = ['#dc773e', '#f6b652', '#fff0ad'][i]; c.fill();
  }
  if (!reduced) {
    for (let i = 0; i < 5; i++) {
      const age = (t * .48 + i / 5) % 1, dx = Math.sin(t * .9 + i * 2) * .08 + age * .16;
      c.globalAlpha = (1 - age) * .48;
      ellipse(c, dx, -.40 - age * 1.20, .065 + age * .11, .075 + age * .14, '#d4d3bb');
    }
    for (let i = 0; i < 6; i++) {
      const age = (t * .71 + i / 6) % 1;
      c.globalAlpha = (1 - age) * .85;
      ellipse(c, Math.sin(i * 4.2 + age * 3) * (.04 + age * .16), -.16 - age * 1.35, .012, .021, '#ffe6a2');
    }
  }
  c.restore();
}

// 2.8 x 1.575 projected screen preserves the supplied film's 16:9 aspect ratio.
export function cinemaRect(item) {
  const [x, y] = point(item.x + .5 - 1.4, item.y + .5, .46 + 1.575 / COLONY_HEIGHT);
  return { x, y, width: 2.8, height: 1.575 };
}

export function drawCinemaBase(c, item) {
  const x = item.x + .5, y = item.y + .5, r = cinemaRect(item);
  ellipse(c, x + .06, (y + .12) * COLONY_DEPTH, 1.60, .34 * COLONY_DEPTH, '#354d4b29');
  const deck = [[x - 1.50, y - .35], [x + 1.50, y - .35], [x + 1.50, y + .35], [x - 1.50, y + .35]];
  polygon(c, deck.map(([px, py]) => point(px, py, .045)), '#a99b7c');
  for (let i = 0; i < 7; i++) line(c, [point(x - 1.4 + i * .46, y - .30, .05), point(x - 1.4 + i * .46, y + .30, .05)], '#e3d4b2', .018);
  for (const side of [-1, 1]) {
    line(c, [point(x + side * 1.42, y, .06), point(x + side * 1.42, y, 3.24)], '#4c6268', .13);
    line(c, [point(x + side * 1.44, y - .015, .10), point(x + side * 1.44, y - .015, 3.25)], '#e9eee4', .075);
    line(c, [point(x + side * 1.42, y - .28, .065), point(x + side * 1.42, y + .28, .065)], '#e3e9dc', .17);
  }
  c.beginPath(); c.roundRect(r.x - .08, r.y - .08, r.width + .16, r.height + .16, .07);
  c.fillStyle = '#edf1e7'; c.fill(); c.strokeStyle = '#53646b'; c.lineWidth = .035; c.stroke();
  line(c, [[r.x + .22, r.y - .04], [r.x + r.width - .22, r.y - .04]], '#bd9d64', .025);
  // A little service panel belongs to the screen, rather than another HUD box.
  polygon(c, [point(x - .35, y + .18, .11), point(x + .35, y + .18, .11), point(x + .35, y + .18, .34), point(x - .35, y + .18, .34)], '#54676b');
  line(c, [point(x - .20, y + .19, .23), point(x + .20, y + .19, .23)], '#d9c295', .025);
}

export function drawCinema(c, item, movie) {
  const r = cinemaRect(item);
  c.save(); c.beginPath(); c.rect(r.x, r.y, r.width, r.height); c.clip();
  c.fillStyle = '#24373c'; c.fillRect(r.x, r.y, r.width, r.height);
  if (movie?.readyState >= 2 && movie.videoWidth > 0) {
    c.drawImage(movie, r.x, r.y, r.width, r.height);
  } else {
    c.fillStyle = '#d5c494'; c.textAlign = 'center'; c.font = '.14px "IBM Plex Mono",monospace';
    c.fillText('FRONTIER PICTURE HOUSE', r.x + r.width / 2, r.y + .38);
    c.fillStyle = '#f3eed9'; c.font = 'italic .29px Georgia,serif';
    c.fillText('Big Buck Bunny', r.x + r.width / 2, r.y + .83);
    c.fillStyle = '#a6bab8'; c.font = '.13px "IBM Plex Sans",sans-serif';
    c.fillText('An evening together', r.x + r.width / 2, r.y + 1.19);
  }
  c.restore();
}

function lightSprite(color) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d'), glow = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, color); glow.addColorStop(.24, color.replace('1)', '.58)')); glow.addColorStop(1, color.replace('1)', '0)'));
  c.fillStyle = glow; c.fillRect(0, 0, 128, 128); return canvas;
}

// One cheap screen-space color pass, bounded particles and reusable light masks.
// The caller supplies authoritative environment/time, never a local weather roll.
export function createColonyAtmosphere() {
  let amber, ivory, cloudMask;
  function prepare() {
    if (amber) return;
    amber = lightSprite('rgba(255,176,83,1)'); ivory = lightSprite('rgba(222,239,225,1)');
    cloudMask = document.createElement('canvas'); cloudMask.width = 384; cloudMask.height = 192;
    const c = cloudMask.getContext('2d');
    for (let i = 0; i < 5; i++) {
      const x = 75 + i * 51, y = 94 + Math.sin(i * 2) * 16, g = c.createRadialGradient(x, y, 0, x, y, 77);
      g.addColorStop(0, '#344a5826'); g.addColorStop(1, '#344a5800'); c.fillStyle = g; c.fillRect(0, 0, 384, 192);
    }
  }
  return function draw(c, { width: w, height: h, camera, environment, time, reduced, items, hub, movie, world }) {
    if (!environment) return;
    prepare(); const t = reduced ? 0 : time, { night = 0, warmth = 0, cloud = 0, rain = 0 } = environment;
    c.save();
    // The screen supplies its own light. Exclude that surface from sunlight
    // shading, retaining the already-rendered depth order and movie luminance.
    c.beginPath(); c.rect(0, 0, w, h);
    for (const item of items) if (item.kind === 'cinema') {
      const r = cinemaRect(item);
      c.rect(w / 2 + (r.x - camera.x) * camera.tile, h / 2 + (r.y - camera.y * COLONY_DEPTH) * camera.tile, r.width * camera.tile, r.height * camera.tile);
    }
    c.clip('evenodd');
    // Multiplication lowers the light without laying an opaque grey veil over
    // the painted scenery. Twilight stays amber; moonlight retains blue detail.
    const dusk = night * (1 - warmth * .25);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = `rgba(${Math.round(54 + warmth * 130)},${Math.round(83 + warmth * 35)},${Math.round(135 - warmth * 37)},${dusk * .72 + cloud * .045})`; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgba(30,58,105,${dusk * (1 - warmth) * .045})`; c.fillRect(0, 0, w, h);
    if (warmth > .01) {
      const sunset = environment.phase >= .5, wash = c.createLinearGradient(sunset ? w : 0, 0, sunset ? 0 : w, h);
      wash.addColorStop(0, `rgba(255,191,100,${warmth * .17})`);
      wash.addColorStop(.65, `rgba(239,171,138,${warmth * .06})`);
      wash.addColorStop(1, 'rgba(239,171,138,0)');
      c.fillStyle = wash; c.fillRect(0, 0, w, h);
    }
    if (cloud > .01) {
      c.globalAlpha = cloud * .50;
      for (let i = 0; i < 3; i++) {
        const x = ((i * 23 + t * .09) % (world.width + 24)) - 12, y = 10 + i * 17;
        const p = colonyWorldToScreen({ x, y }, camera, w, h);
        c.drawImage(cloudMask, p.x - camera.tile * 10, p.y - camera.tile * 5, camera.tile * 20, camera.tile * 10);
      }
      c.globalAlpha = 1;
    }
    c.restore(); c.save();
    c.globalCompositeOperation = 'screen';
    const glowAt = (x, y, z, radius, sprite, strength) => {
      const p = colonyWorldToScreen({ x, y, z }, camera, w, h), size = radius * camera.tile;
      if (p.x + size < 0 || p.x - size > w || p.y + size < 0 || p.y - size > h) return;
      c.globalAlpha = strength; c.drawImage(sprite, p.x - size, p.y - size * .7, size * 2, size * 1.4);
    };
    if (night > .1 && hub) glowAt(hub.x, hub.y + .6, .50, 2.1, ivory, night * .25);
    for (const item of items) {
      if (item.kind === 'campfire' && item.lit) {
        const flicker = reduced ? 1 : .95 + Math.sin(t * 7.1 + item.x) * .035 + Math.sin(t * 11.7) * .015;
        glowAt(item.x + .5, item.y + .5, .23, 2.6, amber, (.11 + night * .42) * flicker);
      } else if (item.kind === 'cinema' && movie?.readyState >= 2) {
        glowAt(item.x + .5, item.y + 1.15, .2, 2.4, ivory, .035 + night * .18);
      }
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    if (rain > .01 && !reduced) {
      const count = Math.min(130, Math.round(w * h / 11000)) + 18, drift = .13 + (environment.wind || 0) * .12;
      for (let layer = 0; layer < 2; layer++) {
        c.beginPath();
        for (let i = layer; i < count; i += 2) {
          const speed = 230 + hash(i, 3) * 170;
          const y = (hash(i, 1) * (h + 40) + t * speed) % (h + 40) - 20;
          const x = (hash(i, 2) * (w + 100) + t * speed * drift) % (w + 100) - 50;
          const length = 8 + hash(i, 4) * 8;
          c.moveTo(x, y); c.lineTo(x + length * drift, y + length);
        }
        c.strokeStyle = layer ? `rgba(231,244,242,${rain * .36})` : `rgba(209,230,231,${rain * .24})`;
        c.lineWidth = layer ? 1.2 : .75; c.stroke();
      }
      c.strokeStyle = `rgba(228,241,233,${rain * .32})`; c.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const wx = Math.floor(camera.x - w / camera.tile / 2 + hash(i, 8) * w / camera.tile);
        const wy = Math.floor(camera.y - h / (camera.tile * COLONY_DEPTH) / 2 + hash(i, 9) * h / (camera.tile * COLONY_DEPTH));
        if (wx < 0 || wy < 0 || wx >= world.width || wy >= world.height || world.terrain[wy * world.width + wx] !== 0) continue;
        const age = (t * .65 + i * .31) % 1, p = colonyWorldToScreen({ x: wx + .5, y: wy + .5 }, camera, w, h);
        c.globalAlpha = 1 - age; c.beginPath(); c.ellipse(p.x, p.y, 2 + age * 8, (2 + age * 8) * COLONY_DEPTH * .45, 0, 0, TAU); c.stroke();
      }
    }
    c.restore();
  };
}
