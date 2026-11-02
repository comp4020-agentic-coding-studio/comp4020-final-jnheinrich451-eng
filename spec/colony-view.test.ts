import { expect, it } from 'vitest';
import { COLONY_DEPTH, COLONY_HEIGHT, colonyWorldToScreen, colonyScreenToWorld, colonyScreenDelta, colonyVisibleBounds } from '../public/colony-view.js';

it('keeps cardinal movement aligned and shows raised objects above their ground contact', () => {
  const camera = { x: 36, y: 28, tile: 45 };
  expect(colonyWorldToScreen({ x: 36, y: 28 }, camera, 1600, 1000)).toEqual({ x: 800, y: 500 });
  expect(colonyWorldToScreen({ x: 37, y: 28 }, camera, 1600, 1000)).toEqual({ x: 845, y: 500 });
  const north = colonyWorldToScreen({ x: 36, y: 27 }, camera, 1600, 1000);
  expect(north.x).toBe(800); expect(north.y).toBeCloseTo(500 - 45 * COLONY_DEPTH);
  const roof = colonyWorldToScreen({ x: 36, y: 28, z: 2 }, camera, 1600, 1000);
  expect(roof.x).toBe(800); expect(roof.y).toBeCloseTo(500 - 90 * COLONY_HEIGHT);
});

it('picks the same saved tile across phone and desktop zoom and camera offsets', () => {
  for (const [width, height] of [[390, 844], [1600, 1000]]) for (const tile of [14, 29, 45, 78]) {
    const camera = { x: 34.7, y: 30.2, tile };
    for (const point of [{ x: 32.5, y: 31.5 }, { x: 44.2, y: 19.8 }, { x: .2, y: .7 }]) {
      const screen = colonyWorldToScreen(point, camera, width, height);
      const picked = colonyScreenToWorld(screen.x, screen.y, camera, width, height);
      expect(picked.x).toBeCloseTo(point.x); expect(picked.y).toBeCloseTo(point.y);
      expect(Math.floor(picked.x)).toBe(Math.floor(point.x)); expect(Math.floor(picked.y)).toBe(Math.floor(point.y));
    }
  }
});

it('keeps a dragged world point under the cursor and includes viewport edge tiles', () => {
  const camera = { x: 35, y: 29, tile: 29 }, width = 390, height = 844;
  const point = colonyScreenToWorld(130, 290, camera, width, height);
  const delta = colonyScreenDelta(81, -62, camera);
  const next = { ...camera, x: camera.x - delta.x, y: camera.y - delta.y };
  const moved = colonyWorldToScreen(point, next, width, height);
  expect(moved.x).toBeCloseTo(211); expect(moved.y).toBeCloseTo(228);
  const bounds = colonyVisibleBounds(next, width, height);
  for (const [x, y] of [[0, 0], [width, height]]) {
    const corner = colonyScreenToWorld(x, y, next, width, height);
    expect(corner.x).toBeGreaterThan(bounds.left); expect(corner.x).toBeLessThan(bounds.right);
    expect(corner.y).toBeGreaterThan(bounds.top); expect(corner.y).toBeLessThan(bounds.bottom);
  }
});
