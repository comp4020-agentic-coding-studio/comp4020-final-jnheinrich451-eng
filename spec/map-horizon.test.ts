import { describe, expect, it } from 'vitest';
import { HORIZON_INSET, HORIZON_TILES, drawHorizon, fogAt, horizonSea, horizonVisible } from '../public/map-horizon.js';
import { createPlanet } from '../public/planet-templates.js';
import { CALDERA } from '../public/caldera-art.js';

const T = 48, W = 512, H = 384;
const planets: [string, { width: number; height: number; terrain: number[]; template?: string }][] = [
  ['Caldera', createPlanet('caldera-v1')], ['Vesper', createPlanet('vesper-v1')], ['Sirocco', createPlanet('sirocco-v1')],
];

describe('map edge weather', () => {
  it.each(planets)('%s has open water all the way round its rim', (_name, world) => {
    // The whole idea rests on this: nothing has to continue past the edge except the sea.
    for (let x = 0; x < world.width; x++) { expect(world.terrain[x]).toBe(0); expect(world.terrain[(world.height - 1) * world.width + x]).toBe(0); }
    for (let y = 0; y < world.height; y++) { expect(world.terrain[y * world.width]).toBe(0); expect(world.terrain[y * world.width + world.width - 1]).toBe(0); }
  });

  it.each(planets)('%s keeps its land readable', (_name, world) => {
    let worst = 0;
    for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) if (world.terrain[y * world.width + x]) worst = Math.max(worst, fogAt(x + .5, y + .5, world.width, world.height));
    expect(worst).toBeLessThanOrEqual(.2);
  });

  it('leaves the map clear inland and is solid where its image ends', () => {
    for (let x = HORIZON_INSET; x <= W - HORIZON_INSET; x += 7) for (let y = HORIZON_INSET; y <= H - HORIZON_INSET; y += 7) expect(fogAt(x, y, W, H)).toBe(0);
    for (let x = -HORIZON_TILES; x <= W + HORIZON_TILES; x += 5) { expect(fogAt(x, -HORIZON_TILES, W, H)).toBe(1); expect(fogAt(x, H + HORIZON_TILES, W, H)).toBe(1); }
    for (let y = -HORIZON_TILES; y <= H + HORIZON_TILES; y += 5) { expect(fogAt(-HORIZON_TILES, y, W, H)).toBe(1); expect(fogAt(W + HORIZON_TILES, y, W, H)).toBe(1); }
  });

  it('thickens smoothly, with no line anywhere and a front that wanders', () => {
    const fronts = new Set<number>();
    for (let y = -HORIZON_TILES; y < H + HORIZON_TILES; y += 3) {
      let front;
      for (let x = -HORIZON_TILES; x < W / 2; x++) {
        const here = fogAt(x, y, W, H), next = fogAt(x + 1, y, W, H);
        expect(Math.abs(here - next)).toBeLessThan(.1);
        if (front === undefined && here < .5) front = x;
      }
      if (y > 40 && y < H - 40 && front !== undefined) fronts.add(front);
    }
    expect(Math.max(...fronts) - Math.min(...fronts)).toBeGreaterThan(12);
  });

  it('continues each planet\'s own surface colour', () => {
    expect(horizonSea({ template: undefined })).toBe(CALDERA.deep);
    expect(horizonSea({ template: 'sirocco-v1', width: W, height: H })).toBe('#b9763e');
    expect(horizonSea({ template: 'vesper-v1', width: W, height: H })).toBe('#234c61');
  });

  it('costs nothing while the view stays inland', () => {
    const world = { width: W, height: H }, calls: string[] = [];
    const c = new Proxy({}, { get: (_t, name: string) => () => calls.push(name), set: () => true });
    const inland = { x0: 100 * T, y0: 100 * T, x1: 150 * T, y1: 130 * T };
    expect(horizonVisible(inland, world, T)).toBe(false);
    drawHorizon(c, world, T, inland);
    expect(calls).toEqual([]);
    expect(horizonVisible({ ...inland, x0: 7 * T }, world, T)).toBe(true);
    expect(horizonVisible({ ...inland, y1: (H - 7) * T }, world, T)).toBe(true);
  });
});
