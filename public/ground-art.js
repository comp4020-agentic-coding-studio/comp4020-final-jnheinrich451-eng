// Presentation only: every planet's ground, water and ridges, baked from the saved
// tiles into the terrain caches. Coasts and ridge outlines follow a smoothed
// distance to the saved edge that is held within EDGE of the true distance, so a
// drawn edge never strays more than EDGE tiles from the saved one and every tile
// centre shows its own surface. Movement, cover and placement still come from the
// tiles themselves; nothing here changes them.
import { CALDERA, calderaGround, valueNoise, treeAt, drawCalderaTree, drawCalderaTufts } from './caldera-art.js';
import { drawVesperDetail } from './vesper-art.js';
import { drawSiroccoDetail } from './sirocco-art.js';
import { mountainAt } from './terrain-rules.js';
import { tileAt } from './world.js';

// Tiles read beyond the painted area: open water reads as deep after DEPTH tiles,
// ridges reach full height INNER tiles in, and their shadows fall up to 3 tiles;
// MARGIN covers the furthest of those plus a blur, so any area paints the same alone.
const MARGIN = 8, DEPTH = 4, INNER = 5;
// Edges: distances are exact out to REACH tiles, blurred by SOFT and held within EDGE.
export const EDGE = .35;
const REACH = 2, SOFT = .6;
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ease = t => t * t * (3 - 2 * t);
const step = (a, b, v) => ease(clamp((v - a) / (b - a)));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lerp3 = (out, a, b, t) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
const bil4 = (a, k, n, w00, w10, w01, w11) => a[k] * w00 + a[k + 1] * w10 + a[k + n] * w01 + a[k + n + 1] * w11;
const ramp3 = (out, stops, t) => t < .5 ? lerp3(out, stops[0], stops[1], t * 2) : lerp3(out, stops[1], stops[2], (t - .5) * 2);
// The shared sun: upper right, as for Caldera's trees and the entry scene.
const SUN = (() => { const v = [.55, -.55, .63], l = Math.hypot(...v); return v.map(n => n / l); })(), SUN_FLAT = Math.hypot(SUN[0], SUN[1]);

const VESPER_MOSS = ['#66816a', '#80997a', '#5f7b80', '#8f975f'].map(hex);
const SIROCCO_GROUND = ['#cdae83', '#d9bf94', '#c99a72'].map(hex);
const PALETTES = {
  caldera: {
    deep: hex(CALDERA.deep), shallow: hex(CALDERA.shallow), foam: hex('#cfe3ec'), foamStrength: .5,
    lakeDeep: hex(CALDERA.deep), lakeShallow: hex(CALDERA.shallow),
    wet: hex('#6c8490'), wetStrength: .55,
    sandBase: hex(CALDERA.sand),
    ground: calderaGround,
    boulder: { base: '#515a68', light: '#7f8c9e', dark: '#363d48', rim: '#aab8cc' }, detail: 'caldera',
  },
  vesper: {
    deep: hex('#1b3f52'), shallow: hex('#33697a'), foam: hex('#d3e4dc'), foamStrength: .42,
    lakeDeep: hex('#35707a'), lakeShallow: hex('#5d9890'),
    wet: hex('#857f63'), wetStrength: .5,
    sandBase: hex('#b9b39b'),
    ground(x, y, out) {
      const moss = valueNoise(x / 9, y / 9, 41) * .6 + valueNoise(x / 3.5, y / 3.5, 42) * .4, tint = valueNoise(x / 15, y / 15, 43);
      lerp3(out, VESPER_MOSS[0], VESPER_MOSS[1], moss);
      const cool = step(.55, .8, tint) * .3, warm = step(.55, .8, 1 - tint) * .25;
      for (let i = 0; i < 3; i++) out[i] += (VESPER_MOSS[2][i] - out[i]) * cool + (VESPER_MOSS[3][i] - out[i]) * warm;
    },
    ridges: 'alpine', rock: ['#414c57', '#66747d', '#8f9b9e'].map(hex), snow: hex('#dfe5da'),
    boulder: { base: '#455861', light: '#7a8c8d', dark: '#2f3d44', rim: '#a7b5aa' }, detail: 'vesper',
  },
  sirocco: {
    sandSea: true, sea: hex('#b9763e'), slip: hex('#7f4525'), crest: hex('#f1bd74'),
    lakeDeep: hex('#2b8489'), lakeShallow: hex('#5cb5a8'), foam: hex('#eef3dc'), foamStrength: .5,
    wet: hex('#a98757'), wetStrength: .5,
    sandBase: hex('#e4c994'),
    ground(x, y, out) {
      lerp3(out, SIROCCO_GROUND[0], SIROCCO_GROUND[1], valueNoise(x / 8, y / 8, 51) * .65 + valueNoise(x / 3, y / 3, 52) * .35);
      const red = step(.62, .82, valueNoise(x / 13, y / 13, 53)) * .3;
      for (let i = 0; i < 3; i++) out[i] += (SIROCCO_GROUND[2][i] - out[i]) * red;
    },
    ridges: 'mesa', mesa: ['#c2865c', '#cd966a', '#d9a879'].map(hex), cliff: hex('#4e2d27'), cliffLit: hex('#94543b'), lip: hex('#f3cf9a'),
    boulder: { base: '#6e4a37', light: '#9c7050', dark: '#422a20', rim: '#e5c99a' }, detail: 'sirocco',
  },
};
export const paletteFor = world => world?.template === 'vesper-v1' ? PALETTES.vesper : world?.template === 'sirocco-v1' ? PALETTES.sirocco : PALETTES.caldera;

// Tileable noise sampled by pixel: FINE for grit, BROAD for mottling. There is no
// per-pixel speck: grain that fine made full-screen PNG screenshots take half a
// second to encode, which paused the page past the 700 ms input lease.
function noiseTable(octaves) {
  const n = 256, out = new Float32Array(n * n);
  for (const [period, weight, salt] of octaves) {
    const cells = n / period, lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) { let h = Math.imul(i + salt * 7919, 2654435761) ^ salt; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; lattice[i] = ((h >>> 0) / 4294967296) * 2 - 1; }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = x / period, gy = y / period, ix = Math.floor(gx), iy = Math.floor(gy), u = ease(gx - ix), v = ease(gy - iy);
      const x1 = (ix + 1) % cells, y1 = (iy + 1) % cells;
      const a = lattice[iy * cells + ix], b = lattice[iy * cells + x1], c = lattice[y1 * cells + ix], d = lattice[y1 * cells + x1];
      out[y * n + x] += weight * ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v);
    }
  }
  return out;
}
let FINE, BROAD;
const tables = () => { FINE ||= noiseTable([[8, .6, 2], [4, .4, 3]]); BROAD ||= noiseTable([[64, .6, 4], [32, .4, 5]]); };

// Two-pass chamfer distance from every cell whose mask equals `own` to the nearest
// cell that does not, in cells, capped.
function chamfer(d, mask, own, nw, nh, cap) {
  for (let k = 0; k < d.length; k++) d[k] = (mask[k] > .5) === own ? cap : 0;
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const k = j * nw + i; if (!d[k]) continue;
    let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - nw] + 1); if (i > 0) v = Math.min(v, d[k - nw - 1] + 1.41); if (i < nw - 1) v = Math.min(v, d[k - nw + 1] + 1.41); }
    d[k] = v;
  }
  for (let j = nh - 1; j >= 0; j--) for (let i = nw - 1; i >= 0; i--) {
    const k = j * nw + i; if (!d[k]) continue;
    let v = d[k];
    if (i < nw - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < nh - 1) { v = Math.min(v, d[k + nw] + 1); if (i < nw - 1) v = Math.min(v, d[k + nw + 1] + 1.41); if (i > 0) v = Math.min(v, d[k + nw - 1] + 1.41); }
    d[k] = v;
  }
  return d;
}
// Separable blur with a Gaussian of `sigma` cells; edges repeat their last cell.
function blur(src, nw, nh, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 2)), kernel = [];
  let total = 0; for (let i = -r; i <= r; i++) { const w = Math.exp(-i * i / (2 * sigma * sigma)); kernel.push(w); total += w; }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    let s = 0; for (let o = -r; o <= r; o++) s += src[j * nw + Math.min(nw - 1, Math.max(0, i + o))] * kernel[o + r];
    tmp[j * nw + i] = s;
  }
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    let s = 0; for (let o = -r; o <= r; o++) s += tmp[Math.min(nh - 1, Math.max(0, j + o)) * nw + i] * kernel[o + r];
    out[j * nw + i] = s;
  }
  return out;
}

// Saved surfaces around a painted area, one value per tile centre. Only the saved
// terrain, mountain and water masks are read, never floors or other overlays.
function surfaceWindow(world, ox, oy, nw, nh, pal) {
  const n = nw * nh, f = { ox, oy, nw, nh };
  for (const key of ['liquid', 'lake', 'sand', 'ridge', 'level', 'height', 'hx', 'hy', 'shadow']) f[key] = new Float32Array(n);
  const W = world.width, H = world.height, terrain = world.terrain, peaks = world.mountains, kinds = world.waterKinds;
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const x = ox + i, y = oy + j, k = j * nw + i, inside = x >= 0 && y >= 0 && x < W && y < H, t = y * W + x;
    // Past the rim every planet is open sea or loose sand.
    const raw = inside ? terrain[t] : 0, peak = inside && peaks ? peaks[t] || 0 : 0;
    if (peak) { f.ridge[k] = 1; f.level[k] = peak; }
    else if (raw === 0) { f.liquid[k] = 1; if (inside && kinds && kinds[t] > 1) f.lake[k] = 1; }
    else if (raw === 1) f.sand[k] = 1;
  }
  // Water beside a beach keeps the beach colour right up to the coastline.
  for (let j = 1; j < nh - 1; j++) for (let i = 1; i < nw - 1; i++) {
    const k = j * nw + i;
    if (f.liquid[k] && (f.sand[k - 1] && !f.liquid[k - 1] || f.sand[k + 1] && !f.liquid[k + 1] || f.sand[k - nw] && !f.liquid[k - nw] || f.sand[k + nw] && !f.liquid[k + nw])) f.sand[k] = 1;
  }
  f.depth = blur(chamfer(new Float32Array(n), f.liquid, true, nw, nh, DEPTH), nw, nh, .8);
  if (!pal.ridges) return f;
  const inner = chamfer(new Float32Array(n), f.ridge, true, nw, nh, INNER);
  // Saved ridge levels change in blocks; a box average keeps that grid out of the shading.
  const level = new Float32Array(n);
  for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
    const k = j * nw + i; if (!f.ridge[k]) continue;
    let sum = 0, count = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= nw || y >= nh) continue;
      const q = y * nw + x; if (f.ridge[q]) { sum += f.level[q]; count++; }
    }
    level[k] = sum / count;
  }
  f.level = level;
  const mesa = pal.ridges === 'mesa', raised = new Float32Array(n);
  for (let k = 0; k < n; k++) if (f.ridge[k]) raised[k] = mesa ? Math.min(inner[k], 2) * 1.1 + level[k] * .15 : Math.min(inner[k], INNER) * .7 + level[k] * .35;
  const h = f.height = blur(raised, nw, nh, .7);
  for (let j = 1; j < nh - 1; j++) for (let i = 1; i < nw - 1; i++) {
    const k = j * nw + i;
    f.hx[k] = (h[k + 1] - h[k - 1]) / 2; f.hy[k] = (h[k + nw] - h[k - nw]) / 2;
    // Ridges cast their shadow down and to the left, away from the sun.
    if (!f.ridge[k]) {
      let s = 0;
      for (let d = 1; d <= 3 && i + d < nw && j - d >= 0; d++) s = Math.max(s, (raised[(j - d) * nw + i + d] - d * .8) / 1.3);
      f.shadow[k] = clamp(s);
    }
  }
  f.shadow = blur(f.shadow, nw, nh, .6);
  return f;
}

// Smoothed signed distance (tiles, positive inside `mask`) on a grid of F samples a
// tile, covering window cells [ci0, ci0 + cw) x [cj0, cj0 + ch). Held within EDGE of
// the exact distance, so the drawn edge stays within EDGE of the saved one.
function edgeField(mask, nw, ci0, cj0, cw, ch, F) {
  const fw = cw * F, fh = ch * F, n = fw * fh, inside = new Float32Array(n), cap = REACH * F + 1;
  let some = 0, all = 1;
  for (let j = cj0; j < cj0 + ch; j++) for (let i = ci0; i < ci0 + cw; i++) { const m = mask[j * nw + i] > .5; some ||= m; all &&= m; }
  if (!some || all) return inside.fill((all ? 1 : -1) * (cap - .5) / F);
  for (let j = 0; j < fh; j++) { const row = (cj0 + Math.floor(j / F)) * nw + ci0; for (let i = 0; i < fw; i++) inside[j * fw + i] = mask[row + Math.floor(i / F)]; }
  const din = chamfer(new Float32Array(n), inside, true, fw, fh, cap), dout = chamfer(new Float32Array(n), inside, false, fw, fh, cap), exact = new Float32Array(n);
  for (let k = 0; k < n; k++) exact[k] = inside[k] > .5 ? (din[k] - .5) / F : -(dout[k] - .5) / F;
  const soft = blur(exact, fw, fh, SOFT * F);
  for (let k = 0; k < n; k++) soft[k] = Math.min(exact[k] + EDGE, Math.max(exact[k] - EDGE, soft[k]));
  return soft;
}

// Colours `dw` by `dh` RGBA pixels whose top-left corner sits at tile (x0, y0),
// S pixels to a tile. Chunks use half resolution; the overview uses 4 px a tile.
// With `classify`, each pixel's red channel instead records what is drawn there:
// 0 dry ground, 1 water or loose sand, 2 ridge.
export function renderGround(data, dw, dh, world, x0, y0, S, classify = false) {
  tables();
  const pal = paletteFor(world), N = FINE, B = BROAD;
  const ox = Math.floor(x0) - MARGIN, oy = Math.floor(y0) - MARGIN;
  const nw = Math.ceil(x0 + dw / S) - ox + MARGIN + 1, nh = Math.ceil(y0 + dh / S) - oy + MARGIN + 1;
  const f = surfaceWindow(world, ox, oy, nw, nh, pal);
  // Edge fields cover the painted area plus the blur's reach, F samples a tile.
  const F = S >= 8 ? 4 : 1, ci0 = MARGIN - 4, cj0 = MARGIN - 4, cw = nw - ci0 * 2, ch = nh - cj0 * 2, fw = cw * F;
  const fox = ox + ci0, foy = oy + cj0;
  const sL = edgeField(f.liquid, nw, ci0, cj0, cw, ch, F), sS = edgeField(f.sand, nw, ci0, cj0, cw, ch, F);
  const sR = pal.ridges ? edgeField(f.ridge, nw, ci0, cj0, cw, ch, F) : null;
  // Ground and sand colours on a finer lattice, so their drifts have no tile grid.
  const Q = S >= 12 ? 4 : 1, qx0 = Math.floor(x0) - 1, qy0 = Math.floor(y0) - 1;
  const qw = (Math.ceil(x0 + dw / S) + 1 - qx0) * Q + 2, qh = (Math.ceil(y0 + dh / S) + 1 - qy0) * Q + 2;
  const gr = new Float32Array(qw * qh), gg = new Float32Array(qw * qh), gb = new Float32Array(qw * qh), sv = new Float32Array(qw * qh), tmp = [0, 0, 0];
  if (!classify) for (let j = 0; j < qh; j++) for (let i = 0; i < qw; i++) {
    const x = qx0 + i / Q, y = qy0 + j / Q, q = j * qw + i;
    pal.ground(x, y, tmp); gr[q] = tmp[0]; gg[q] = tmp[1]; gb[q] = tmp[2];
    sv[q] = .95 + valueNoise(x / 4, y / 4, 61) * .08;
  }
  const { liquid, lake, level, depth, height, hx, hy, shadow } = f;
  const sandSea = !!pal.sandSea, alpine = pal.ridges === 'alpine', mesa = pal.ridges === 'mesa';
  const gx0 = Math.round(x0 * S), gy0 = Math.round(y0 * S);
  const lakes = !!world.waterKinds;
  // Dune crests depend only on the column and band, so each is computed once.
  const bandLo = Math.floor(y0 / 3) - 1, bands = Math.floor((y0 + dh / S) / 3) + 3 - bandLo, crests = sandSea ? new Float32Array(dw * bands) : null;
  if (crests) for (let i = 0; i < dw; i++) { const u = x0 + (i + .5) / S; for (let b = 0; b < bands; b++) crests[i * bands + b] = (bandLo + b) * 3 + Math.sin(u * .22 + (bandLo + b) * .9) * .62; }
  const water = [0, 0, 0], dry = [0, 0, 0], ground = [0, 0, 0], ridgeColor = [0, 0, 0];
  for (let j = 0; j < dh; j++) {
    const v = y0 + (j + .5) / S, gy = v - .5 - oy, iy = Math.floor(gy), fy = gy - iy;
    const ey = (v - foy) * F - .5, iey = Math.floor(ey), tey = ey - iey;
    const qyf = (v - qy0) * Q, qiy = Math.floor(qyf), qfy = qyf - qiy, row = ((gy0 + j) & 255) << 8;
    for (let i = 0; i < dw; i++) {
      const u = x0 + (i + .5) / S, gx = u - .5 - ox, ix = Math.floor(gx), fx = gx - ix;
      const k = iy * nw + ix, w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const ex = (u - fox) * F - .5, iex = Math.floor(ex), tex = ex - iex;
      const e = iey * fw + iex, e00 = (1 - tex) * (1 - tey), e10 = tex * (1 - tey), e01 = (1 - tex) * tey, e11 = tex * tey;
      const col = (gx0 + i) & 255, noise = N[row | col], broad = B[row | col];
      // Signed distance to the coastline in tiles, positive over water or loose sand.
      const dL = bil4(sL, e, fw, e00, e10, e01, e11), aL = clamp(dL * S + .5);
      const dR = sR ? bil4(sR, e, fw, e00, e10, e01, e11) : -1, aG = sR ? clamp(dR * S + .5) : 0;
      if (classify) { data[(j * dw + i) * 4] = dL >= 0 ? 1 : dR >= 0 ? 2 : 0; continue; }
      let wetSide = 0;
      if (lakes && dL > -.4) { const L = bil4(liquid, k, nw, w00, w10, w01, w11); wetSide = L > .001 ? clamp(bil4(lake, k, nw, w00, w10, w01, w11) / L) : 0; }
      if (aL > 0) {
        const D = clamp((bil4(depth, k, nw, w00, w10, w01, w11) - .5) / (DEPTH - .5));
        if (sandSea) {
          // Loose sand: crests every three tiles, dark slip faces below them.
          const b0 = Math.floor(v / 3); let d = 3;
          const wander = broad * .45;
          for (let b = b0 - 1; b <= b0 + 1; b++) { const dd = v - crests[i * bands + b - bandLo] - wander; if (dd >= 0 && dd < d) d = dd; }
          const slip = d < .55 ? (1 - d / .55) * (.24 + broad * .1) : 0, top = d < .07 ? .5 * (1 - d / .07) : 0, rise = d > 2.1 ? (d - 2.1) / .9 * .1 : 0;
          lerp3(water, pal.sea, pal.slip, slip); lerp3(water, water, pal.crest, top + rise);
          const lip = 1 - step(0, .16, dL); for (let c = 0; c < 3; c++) water[c] *= 1 - lip * .14;
        } else lerp3(water, pal.shallow, pal.deep, ease(D));
        if (wetSide > 0) { lerp3(dry, pal.lakeShallow, pal.lakeDeep, ease(D)); lerp3(water, water, dry, wetSide); }
        const real = sandSea ? wetSide : 1;
        if (real > 0) {
          // Shallow light near the shore, then a thin foam line along it.
          const near = (1 - step(0, .6, dL)) * .1 * real, foam = (1 - step(.03, .12, dL)) * pal.foamStrength * real;
          for (let c = 0; c < 3; c++) water[c] += (255 - water[c]) * near + broad * 4 * real;
          lerp3(water, water, pal.foam, foam);
        }
      }
      if (aL < 1) {
        if (aG < 1) {
          const qxf = (u - qx0) * Q, qix = Math.floor(qxf), qfx = qxf - qix, q = qiy * qw + qix;
          const a = (1 - qfx) * (1 - qfy), b = qfx * (1 - qfy), c = (1 - qfx) * qfy, d = qfx * qfy;
          ground[0] = gr[q] * a + gr[q + 1] * b + gr[q + qw] * c + gr[q + qw + 1] * d;
          ground[1] = gg[q] * a + gg[q + 1] * b + gg[q + qw] * c + gg[q + qw + 1] * d;
          ground[2] = gb[q] * a + gb[q + 1] * b + gb[q + qw] * c + gb[q + qw + 1] * d;
          const sandShade = sv[q] * a + sv[q + 1] * b + sv[q + qw] * c + sv[q + qw + 1] * d;
          // Sand meets ground along a gently wandering line, never a tile edge.
          const t = step(-.07, .07, bil4(sS, e, fw, e00, e10, e01, e11) + broad * .12);
          for (let c = 0; c < 3; c++) dry[c] = ground[c] + (pal.sandBase[c] * sandShade - ground[c]) * t;
          const wet = 1 - step(0, .32, -dL), soak = wet * pal.wetStrength * (sandSea ? wetSide : 1), lip = sandSea ? wet * .18 * (1 - wetSide) : 0;
          lerp3(dry, dry, pal.wet, soak);
          const dark = (1 - lip) * (sR ? 1 - .32 * bil4(shadow, k, nw, w00, w10, w01, w11) : 1) * (1 - .18 * step(-.6, 0, dR));
          for (let c = 0; c < 3; c++) dry[c] *= dark;
        }
        if (aG > 0) {
          const lv = bil4(level, k, nw, w00, w10, w01, w11);
          if (alpine) {
            // Rough rock: the ridge's broad slope plus crags, lit from the sun.
            const left = row | ((col + 255) & 255), right = row | ((col + 1) & 255), up = (((gy0 + j + 255) & 255) << 8) | col, down = (((gy0 + j + 1) & 255) << 8) | col;
            const gxr = bil4(hx, k, nw, w00, w10, w01, w11) + (B[right] - B[left]) * S * .7 + (N[right] - N[left]) * S * .012;
            const gyr = bil4(hy, k, nw, w00, w10, w01, w11) + (B[down] - B[up]) * S * .7 + (N[down] - N[up]) * S * .012;
            const lit = Math.max(0, (-gxr * SUN[0] - gyr * SUN[1] + SUN[2]) / Math.sqrt(gxr * gxr + gyr * gyr + 1) / SUN[2]);
            const h = bil4(height, k, nw, w00, w10, w01, w11) + broad * .5 + Math.min(dR, .6) - .6;
            ramp3(ridgeColor, pal.rock, clamp((h - .3) / 3));
            lerp3(ridgeColor, ridgeColor, pal.snow, step(3, 3.5, h + broad * .8) * step(2.4, 2.9, lv) * .7);
            const shade = (.5 + .4 * Math.min(lit, 1.35)) * (1 + noise * .04);
            for (let c = 0; c < 3; c++) ridgeColor[c] *= shade;
          } else {
            // Flat mesa tops inside a dark, layered cliff collar; faces toward the sun glow.
            const gxe = ((sR[e + 1] - sR[e]) * (1 - tey) + (sR[e + fw + 1] - sR[e + fw]) * tey) * F;
            const gye = ((sR[e + fw] - sR[e]) * (1 - tex) + (sR[e + fw + 1] - sR[e + 1]) * tex) * F;
            const facing = clamp((-(gxe * SUN[0] + gye * SUN[1]) / (Math.sqrt(gxe * gxe + gye * gye) || 1) / SUN_FLAT + 1) / 2);
            const top = step(.75, 1.05, dR + broad * .1);
            ramp3(ground, pal.mesa, clamp((lv - 1) / 2));
            for (let c = 0; c < 3; c++) ground[c] *= .96 + broad * .08;
            lerp3(ridgeColor, pal.cliff, pal.cliffLit, facing);
            if ((dR * 5 + broad * .8 + 8) % 1 < .3) for (let c = 0; c < 3; c++) ridgeColor[c] *= 1.12;
            lerp3(ridgeColor, ridgeColor, ground, top);
            const rim = step(.7, .9, dR) * (1 - step(.95, 1.2, dR)) * facing * .55;
            lerp3(ridgeColor, ridgeColor, pal.lip, rim);
          }
          if (aG >= 1) { dry[0] = ridgeColor[0]; dry[1] = ridgeColor[1]; dry[2] = ridgeColor[2]; }
          else lerp3(dry, dry, ridgeColor, aG);
        }
      }
      const p = (j * dw + i) * 4;
      const r = aL >= 1 ? water[0] : aL <= 0 ? dry[0] : dry[0] + (water[0] - dry[0]) * aL;
      const g = aL >= 1 ? water[1] : aL <= 0 ? dry[1] : dry[1] + (water[1] - dry[1]) * aL;
      const b = aL >= 1 ? water[2] : aL <= 0 ? dry[2] : dry[2] + (water[2] - dry[2]) * aL;
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
    }
  }
}

// What the painter draws over a tile area: one code per sample, S samples a tile
// (0 dry ground, 1 water or loose sand, 2 ridge). Used to check the drawn edges.
export function paintedSurfaces(world, x0, y0, tiles, S = 8) {
  const data = new Uint8ClampedArray(tiles * S * tiles * S * 4), out = new Uint8Array(tiles * S * tiles * S);
  renderGround(data, tiles * S, tiles * S, world, x0, y0, S, true);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
  return out;
}

// A low, faceted boulder lit from the sun, with its own contact shadow.
export function drawBoulder(c, x, y, T, colors) {
  let seed = Math.imul(x + 911, 374761393) ^ Math.imul(y + 53, 668265263);
  const rand = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822519); seed ^= seed >>> 13; return (seed >>> 0) / 4294967296; };
  const cx = (x + .5 + (rand() - .5) * .1) * T, cy = (y + .52 + (rand() - .5) * .1) * T, sides = 7, points = [];
  for (let i = 0; i < sides; i++) { const a = (i + rand() * .5) / sides * Math.PI * 2, r = (.34 + rand() * .1) * T; points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * .9]); }
  const path = (dx = 0, dy = 0) => { c.beginPath(); points.forEach(([px, py], i) => i ? c.lineTo(px + dx, py + dy) : c.moveTo(px + dx, py + dy)); c.closePath(); };
  c.fillStyle = '#0000003d'; path(-.1 * T, .12 * T); c.fill();
  const peak = [cx + .05 * T, cy - .07 * T];
  for (let i = 0; i < sides; i++) {
    const a = points[i], b = points[(i + 1) % sides], mid = Math.atan2((a[1] + b[1]) / 2 - cy, (a[0] + b[0]) / 2 - cx);
    const lit = (Math.cos(mid - -Math.PI / 4) + 1) / 2;
    c.fillStyle = lit > .7 ? colors.light : lit > .35 ? colors.base : colors.dark;
    c.beginPath(); c.moveTo(...peak); c.lineTo(...a); c.lineTo(...b); c.closePath(); c.fill();
  }
  c.strokeStyle = colors.rim + '88'; c.lineWidth = 1.5; c.lineJoin = 'round'; c.beginPath();
  points.forEach(([px, py], i) => { const lit = Math.atan2(py - cy, px - cx); if (lit > -Math.PI * .75 && lit < Math.PI * .2) c.lineTo(px, py); else c.moveTo(px, py); });
  c.stroke();
}

// Raw terrain kinds that should keep Caldera's grass tufts back from a side.
const BARE = new Set([0, 1]);
function edgesOf(world, x, y) {
  const at = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= world.width || ny >= world.height ? 0 : world.terrain[ny * world.width + nx]; };
  return (BARE.has(at(-1, 0)) ? 1 : 0) | (BARE.has(at(1, 0)) ? 2 : 0) | (BARE.has(at(0, -1)) ? 4 : 0) | (BARE.has(at(0, 1)) ? 8 : 0);
}

let scratch, scratchImage;
// One detailed 16 x 16 tile chunk: the smooth surface at half resolution, then the
// hand-drawn details, rocks, flooring and trees at full resolution on top.
export function paintTerrainChunk(world, cx, cy, T) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16 * T;
  const c = canvas.getContext('2d'), S = T / 2, size = 16 * S + 2;
  if (scratch?.width !== size) { scratch = document.createElement('canvas'); scratch.width = scratch.height = size; scratchImage = scratch.getContext('2d').createImageData(size, size); }
  // A one-pixel margin keeps the upscaled surface continuous across chunk borders.
  renderGround(scratchImage.data, size, size, world, cx * 16 - 1 / S, cy * 16 - 1 / S, S);
  scratch.getContext('2d').putImageData(scratchImage, 0, 0);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(scratch, 1, 1, size - 2, size - 2, 0, 0, 16 * T, 16 * T);
  c.translate(-cx * 16 * T, -cy * 16 * T);
  const pal = paletteFor(world);
  for (let y = cy * 16; y < (cy + 1) * 16; y++) for (let x = cx * 16; x < (cx + 1) * 16; x++) {
    const kind = tileAt(world, x, y), px = x * T, py = y * T;
    if (kind === 4) {
      c.fillStyle = CALDERA.floor; c.fillRect(px, py, T, T); c.strokeStyle = '#b6c5ae'; c.lineWidth = 2; c.strokeRect(px + 3, py + 3, T - 6, T - 6);
      // Decks and piers keep a pale edge where they meet open water.
      c.strokeStyle = CALDERA.shore; c.lineWidth = 3;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!tileAt(world, x + dx, y + dy)) {
        c.beginPath();
        if (dx) { const xx = px + (dx > 0 ? T - 1 : 1); c.moveTo(xx, py); c.lineTo(xx, py + T); }
        else { const yy = py + (dy > 0 ? T - 1 : 1); c.moveTo(px, yy); c.lineTo(px + T, yy); }
        c.stroke();
      }
      continue;
    }
    if (mountainAt(world, x, y)) continue;
    if (pal.detail === 'vesper') drawVesperDetail(c, world, x, y, T, kind);
    else if (pal.detail === 'sirocco') drawSiroccoDetail(c, world, x, y, T, kind);
    else if (kind === 2) drawCalderaTufts(c, x, y, T, edgesOf(world, x, y));
    else if (kind === 0 && Math.abs(Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) % 3 === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].every(([dx, dy]) => !tileAt(world, x + dx, y + dy))) {
      c.strokeStyle = CALDERA.ripple; c.lineWidth = 1; c.beginPath();
      c.moveTo(px + 9, py + 25); c.quadraticCurveTo(px + 16, py + 21, px + 23, py + 25); c.stroke();
    }
    if (kind === 3) drawBoulder(c, x, y, T, pal.boulder);
  }
  // Trees are drawn after the ground, with a one-tile margin so canopies cross chunks.
  if (pal.detail === 'caldera') {
    for (let y = cy * 16 - 1; y <= (cy + 1) * 16; y++) for (let x = cx * 16 - 1; x <= (cx + 1) * 16; x++) {
      if (tileAt(world, x, y) !== 2 || Math.hypot(x - 24, y - 18) <= 5) continue;
      const tree = treeAt(x, y); if (tree) drawCalderaTree(c, tree, T, x * 977 + y);
    }
  }
  return canvas;
}

const OVERVIEW = 4;
function overviewOverlay(c, world, x, y, pal) {
  const kind = tileAt(world, x, y), S = OVERVIEW;
  if (kind === 4) { c.fillStyle = CALDERA.floor; c.fillRect(x * S, y * S, S, S); return; }
  if (kind === 3 && !mountainAt(world, x, y)) { c.fillStyle = pal.boulder.base; c.fillRect(x * S + .5, y * S + .5, S - 1, S - 1); return; }
  // Far views keep the groves, as one soft dab per tree.
  if (pal.detail === 'caldera' && kind === 2) { const tree = treeAt(x, y); if (tree) { c.fillStyle = '#34488f'; c.beginPath(); c.arc(tree.x * S, tree.y * S, tree.r * S, 0, Math.PI * 2); c.fill(); } }
}
// The far-zoom overview and minimap image, 4 px a tile. With no `cells` it paints
// the whole map; otherwise only those cells, for flooring that came or went.
export function paintOverview(c, world, cells = null) {
  const pal = paletteFor(world), S = OVERVIEW;
  if (!cells) {
    const image = c.createImageData(world.width * S, world.height * S);
    renderGround(image.data, image.width, image.height, world, 0, 0, S);
    c.putImageData(image, 0, 0);
    for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) overviewOverlay(c, world, x, y, pal);
    return;
  }
  const image = c.createImageData(S, S);
  for (const index of cells) {
    const x = index % world.width, y = Math.floor(index / world.width);
    renderGround(image.data, S, S, world, x, y, S); c.putImageData(image, x * S, y * S);
  }
  for (const index of cells) overviewOverlay(c, world, index % world.width, Math.floor(index / world.width), pal);
}
