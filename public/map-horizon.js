import { terrainColor } from './terrain-rules.js';

// The edge of the map, drawn as weather. Every planet's rim is open sea or loose sand,
// so the surface carries on past it and fades out. This is only a picture: the saved
// map is still closed and the same size, and nothing here touches collision or saves.
export const HORIZON_TILES = 72;
export const HORIZON_CHUNKS = Math.ceil(HORIZON_TILES / 16);
// Fog never reaches further inside the rim than this, so inland views skip it entirely.
export const HORIZON_INSET = 8;

const CORNER = 12, DRIFT = 22, PIXEL = 2;
const HAZE = Object.freeze({ 'sirocco-v1': [150, 104, 70], 'vesper-v1': [12, 25, 34] });
const hazeFor = world => HAZE[world.template] || [6, 12, 20];
export const horizonSea = world => terrainColor(world, -1, -1, 0);

const soft = t => t * t * (3 - 2 * t), clamp = value => Math.max(0, Math.min(1, value));
const grain = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = soft(x - xi), fy = soft(y - yi);
  const a = grain(xi, yi), b = grain(xi + 1, yi), c = grain(xi, yi + 1), d = grain(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const cloudAt = (x, y) => noise(x / 34, y / 34) * .55 + noise(x / 13, y / 13) * .3 + noise(x / 6, y / 6) * .15;

// Opacity at a tile position. Distance from the softly rounded rim sets it and cloud
// shifts it, so the bank has no straight front; the last factor keeps it off the coast.
export function fogAt(x, y, width, height) {
  const qx = Math.abs(x - width / 2) - width / 2 + CORNER, qy = Math.abs(y - height / 2) - height / 2 + CORNER;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CORNER;
  const front = (outside + HORIZON_INSET + (cloudAt(x, y) - .5) * DRIFT * 2) / (HORIZON_TILES + HORIZON_INSET - DRIFT);
  return soft(clamp(front)) * clamp((outside + HORIZON_INSET) / HORIZON_INSET);
}

let cache;
function horizonFor(world) {
  const key = (world.template || 'caldera') + world.width + 'x' + world.height;
  if (cache?.key === key) return cache;
  const margin = HORIZON_TILES, haze = hazeFor(world);
  const mask = document.createElement('canvas'); mask.width = Math.ceil((world.width + margin * 2) / PIXEL); mask.height = Math.ceil((world.height + margin * 2) / PIXEL);
  const g = mask.getContext('2d'), image = g.createImageData(mask.width, mask.height);
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const i = (y * mask.width + x) * 4;
    image.data[i] = haze[0]; image.data[i + 1] = haze[1]; image.data[i + 2] = haze[2];
    image.data[i + 3] = fogAt(x * PIXEL - margin, y * PIXEL - margin, world.width, world.height) * 255;
  }
  g.putImageData(image, 0, 0);
  cache = { key, mask, solid: `rgb(${haze.join(',')})` };
  return cache;
}

// True while any of the view can show fog. `view` is in world pixels.
export const horizonVisible = (view, world, T) => view.x0 < HORIZON_INSET * T || view.y0 < HORIZON_INSET * T || view.x1 > (world.width - HORIZON_INSET) * T || view.y1 > (world.height - HORIZON_INSET) * T;

// Runs straight after the terrain and under everything else, so units and warnings
// stay on top. One stretched image plus up to four fills, and nothing at all inland.
export function drawHorizon(c, world, T, view) {
  if (!horizonVisible(view, world, T)) return;
  const { mask, solid } = horizonFor(world), reach = HORIZON_TILES * T, w = world.width * T, h = world.height * T;
  const smooth = c.imageSmoothingEnabled; c.imageSmoothingEnabled = true;
  c.drawImage(mask, -reach, -reach, w + reach * 2, h + reach * 2); c.imageSmoothingEnabled = smooth;
  const left = -reach, top = -reach, right = w + reach, bottom = h + reach;
  c.fillStyle = solid;
  if (view.y0 < top) c.fillRect(view.x0, view.y0, view.x1 - view.x0, top - view.y0);
  if (view.y1 > bottom) c.fillRect(view.x0, bottom, view.x1 - view.x0, view.y1 - bottom);
  if (view.x0 < left) c.fillRect(view.x0, top, left - view.x0, bottom - top);
  if (view.x1 > right) c.fillRect(right, top, view.x1 - right, bottom - top);
}
