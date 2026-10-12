// Survey instruments drawn in screen space over the natural terrain: edge
// graticule labels, a scale bar and cursor telemetry. Presentation only.
const INK = '#a9dcff', HALO = 'rgba(4,10,14,.78)';

// Tiles visible on screen for a camera centred at camera.x/y (world pixels).
export function visibleTiles(camera, width, height, T) {
  const left = (camera.x - width / 2 / camera.zoom) / T, top = (camera.y - height / 2 / camera.zoom) / T;
  return { left, top, right: left + width / camera.zoom / T, bottom: top + height / camera.zoom / T };
}

// Label spacing in tiles: the smallest power of two that keeps labels >= minPixels apart.
export function graticuleStep(zoom, T, minPixels = 70) {
  let step = 4;
  while (step * T * zoom < minPixels && step < 64) step *= 2;
  return step;
}

// A round scale-bar length (tiles) between minPx and maxPx on screen.
export function scaleBarTiles(zoom, T, minPx = 56, maxPx = 150) {
  const lengths = [1, 2, 4, 8, 16, 32, 64];
  return lengths.find(tiles => tiles * T * zoom >= minPx && tiles * T * zoom <= maxPx)
    ?? lengths.filter(tiles => tiles * T * zoom <= maxPx).at(-1) ?? 1;
}

// Compass bearing (0 = north, clockwise) and range in tiles from origin to target.
export function bearingRange(origin, target) {
  const dx = target.x - origin.x, dy = target.y - origin.y;
  return { bearing: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, range: Math.hypot(dx, dy) };
}

const pad = (n, size) => String(Math.max(0, Math.floor(n))).padStart(size, '0');

// "X 088 · Y 060 · BRG 042° · RNG 12.4 t" (origin optional, e.g. while in orbit).
export function telemetry(cursor, origin) {
  const position = `X ${pad(cursor.x, 3)} · Y ${pad(cursor.y, 3)}`;
  if (!origin) return position;
  const { bearing, range } = bearingRange(origin, cursor);
  return `${position} · BRG ${pad(Math.round(bearing) % 360, 3)}° · RNG ${range.toFixed(1)} t`;
}

function label(ctx, text, x, y, align = 'center') {
  ctx.textAlign = align; ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
}

// Edge labels every `step` tiles plus short ticks, inset below the header.
export function drawGraticule(ctx, { camera, width, height, T, world, top = 84, left = 8 }) {
  const view = visibleTiles(camera, width, height, T), step = graticuleStep(camera.zoom, T);
  const toScreenX = x => width / 2 + (x * T - camera.x) * camera.zoom, toScreenY = y => height / 2 + (y * T - camera.y) * camera.zoom;
  ctx.save();
  ctx.font = '500 10px "IBM Plex Mono", Consolas, monospace'; ctx.lineWidth = 3; ctx.strokeStyle = HALO; ctx.fillStyle = INK; ctx.textBaseline = 'middle';
  for (let x = Math.ceil(Math.max(0, view.left) / step) * step; x <= Math.min(world.width, view.right); x += step) {
    const sx = toScreenX(x); if (sx < 40 || sx > width - 40) continue;
    label(ctx, pad(x, 3), sx, top + 8);
    ctx.fillRect(sx - .5, top - 2, 1, 5);
  }
  for (let y = Math.ceil(Math.max(0, view.top) / step) * step; y <= Math.min(world.height, view.bottom); y += step) {
    const sy = toScreenY(y); if (sy < top + 26 || sy > height - 60) continue;
    label(ctx, pad(y, 3), left + 4, sy, 'left');
  }
  ctx.restore();
}

export function drawScaleBar(ctx, { camera, T, x, y }) {
  const tiles = scaleBarTiles(camera.zoom, T), length = tiles * T * camera.zoom;
  ctx.save();
  ctx.strokeStyle = HALO; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + length, y); ctx.lineTo(x + length, y - 5); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.25; ctx.stroke();
  ctx.font = '500 10px "IBM Plex Mono", Consolas, monospace'; ctx.lineWidth = 3; ctx.strokeStyle = HALO; ctx.fillStyle = INK; ctx.textBaseline = 'bottom';
  label(ctx, `${tiles} t`, x + length + 8, y + 4, 'left');
  ctx.restore();
}
