import { describe, expect, it } from 'vitest';
import { createPlanet } from '../public/planet-templates.js';
import { EDGE, paintedSurfaces, renderGround } from '../public/ground-art.js';

type World = { width: number; height: number; terrain: number[]; mountains?: number[]; template?: string };
const planets: [string, World][] = [
  ['Caldera', createPlanet('caldera-v1')], ['Vesper', createPlanet('vesper-v1')], ['Sirocco', createPlanet('sirocco-v1')],
];
// What the saved tiles say is at a tile: 0 dry ground, 1 water or loose sand, 2 ridge.
const saved = (w: World, x: number, y: number) => x < 0 || y < 0 || x >= w.width || y >= w.height ? 1
  : w.mountains?.[y * w.width + x] ? 2 : w.terrain[y * w.width + x] === 0 ? 1 : 0;
// Distance from a point to the nearest tile holding `code`, searched two tiles out.
function reach(w: World, px: number, py: number, code: number) {
  let best = Infinity;
  for (let y = Math.floor(py) - 2; y <= Math.floor(py) + 2; y++) for (let x = Math.floor(px) - 2; x <= Math.floor(px) + 2; x++) {
    if (saved(w, x, y) !== code) continue;
    best = Math.min(best, Math.hypot(Math.max(x - px, 0, px - x - 1), Math.max(y - py, 0, py - y - 1)));
  }
  return best;
}
// The busiest 24-tile squares: the most tiles beside a different surface.
function edgeRegions(w: World, count = 3) {
  const scored: [number, number, number][] = [];
  for (let y = 0; y + 24 <= w.height; y += 24) for (let x = 0; x + 24 <= w.width; x += 24) {
    let edges = 0;
    for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) if (saved(w, x + i, y + j) !== saved(w, x + i + 1, y + j) || saved(w, x + i, y + j) !== saved(w, x + i, y + j + 1)) edges++;
    scored.push([edges, x, y]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, count).map(([, x, y]) => ({ x, y }));
}

describe('smoothed terrain edges', () => {
  it.each(planets)('%s keeps every drawn coast and ridge within EDGE of its saved edge', (_name, world) => {
    const S = 8, tiles = 24;
    for (const { x, y } of edgeRegions(world)) {
      const drawn = paintedSurfaces(world, x, y, tiles, S);
      let moved = 0, worst = 0;
      for (let j = 0; j < tiles * S; j++) for (let i = 0; i < tiles * S; i++) {
        const px = x + (i + .5) / S, py = y + (j + .5) / S, code = drawn[j * tiles * S + i];
        if (code === saved(world, Math.floor(px), Math.floor(py))) continue;
        moved++; worst = Math.max(worst, reach(world, px, py, code));
      }
      // Corners really are rounded, and never by more than EDGE (plus the
      // distance grid's quarter-tile spacing error).
      expect(moved).toBeGreaterThan(0);
      expect(worst).toBeLessThanOrEqual(EDGE + .05);
    }
  });

  it.each(planets)('%s shows every tile centre as its own saved surface', (_name, world) => {
    const S = 8, tiles = 24;
    for (const { x, y } of edgeRegions(world)) {
      const drawn = paintedSurfaces(world, x, y, tiles, S);
      // The four samples around each tile centre.
      for (let ty = 0; ty < tiles; ty++) for (let tx = 0; tx < tiles; tx++) for (const [dx, dy] of [[3, 3], [4, 3], [3, 4], [4, 4]]) {
        expect(drawn[(ty * S + dy) * tiles * S + tx * S + dx]).toBe(saved(world, x + tx, y + ty));
      }
    }
  });

  it('keeps a straight coast exactly on the tile boundary and a one-tile island visible', () => {
    const width = 40, height = 40, terrain = Array(width * height).fill(2);
    for (let y = 0; y < height; y++) for (let x = 20; x < width; x++) terrain[y * width + x] = 0;
    terrain[10 * width + 30] = 2;
    const world = { width, height, terrain }, S = 8, drawn = paintedSurfaces(world, 8, 4, 32, S);
    for (let j = 0; j < 32 * S; j += 9) {
      const row = drawn.slice(j * 32 * S, (j + 1) * 32 * S), first = row.indexOf(1);
      expect(first).toBe((20 - 8) * S);
    }
    // The island's own centre is still dry ground.
    expect(drawn[((10 - 4) * S + 4) * 32 * S + (30 - 8) * S + 4]).toBe(0);
  });
});

describe('terrain overview', () => {
  it.each(planets)('%s repaints a single cell exactly as the whole map painted it', (_name, world) => {
    const S = 4, { x, y } = edgeRegions(world, 1)[0], tiles = 24;
    const whole = new Uint8ClampedArray(tiles * S * tiles * S * 4), cell = new Uint8ClampedArray(S * S * 4);
    renderGround(whole, tiles * S, tiles * S, world, x, y, S);
    for (const [cx, cy] of [[3, 4], [11, 12], [20, 7]]) {
      renderGround(cell, S, S, world, x + cx, y + cy, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) for (let c = 0; c < 3; c++) {
        expect(Math.abs(cell[(j * S + i) * 4 + c] - whole[((cy * S + j) * tiles * S + cx * S + i) * 4 + c])).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reads the saved tiles without changing them', () => {
    const world = createPlanet('vesper-v1'), before = JSON.stringify(world), data = new Uint8ClampedArray(32 * 32 * 4);
    renderGround(data, 32, 32, world, 100, 100, 4);
    expect(JSON.stringify(world)).toBe(before);
  });
});
