import { expect, it } from 'vitest';
import { drawCargoRing, locatorPoints, ringColor, spineLights } from '../public/unit-hud.js';
import { calderaColor, meadow, treeAt } from '../public/caldera-art.js';
import { terrainColor } from '../public/terrain-rules.js';

it('repeats health in the ring colour and spine lights, never hiding the last light early', () => {
  expect(ringColor(1)).toBe('#7fe0b0'); expect(ringColor(.5)).toBe('#f0c44c'); expect(ringColor(.25)).toBe('#ff5e57');
  expect(spineLights(1)).toBe(5); expect(spineLights(.5)).toBe(3); expect(spineLights(.01)).toBe(1); expect(spineLights(0)).toBe(0);
});

it('runs locator chevrons toward the target and stops short of it', () => {
  const far = locatorPoints({ x: 0, y: 0 }, { x: 1000, y: 0 });
  expect(far).toHaveLength(6); expect(far[0]).toMatchObject({ x: 62, y: 0 });
  expect(far.every(point => point.angle === 0)).toBe(true);
  expect(locatorPoints({ x: 0, y: 0 }, { x: 0, y: 150 }).at(-1)!.y).toBeLessThan(150 - 16);
  expect(locatorPoints({ x: 0, y: 0 }, { x: 40, y: 0 })).toEqual([]);
});

it('paints Caldera blue from fixed tile positions, leaving the other planets alone', () => {
  // Same tile, same look: nothing random, so two players and a reload always agree.
  expect(meadow(120.5, 44.25)).toBe(meadow(120.5, 44.25));
  expect(calderaColor(120, 44, 2)).toBe(calderaColor(120, 44, 2));
  expect(treeAt(77, 91)).toEqual(treeAt(77, 91));
  const [red, , blue] = [1, 3, 5].map(i => parseInt(calderaColor(120, 44, 2).slice(i, i + 2), 16));
  expect(blue).toBeGreaterThan(red + 40);
  const shades = new Set(Array.from({ length: 40 }, (_, i) => calderaColor(i * 7, i * 3, 2)));
  expect(shades.size).toBeGreaterThan(10);
  const terrain = new Array(4).fill(2), world = { width: 2, height: 2, terrain };
  expect(terrainColor(world, 1, 1, 2)).toBe(calderaColor(1, 1, 2));
  expect(terrainColor({ ...world, template: 'vesper-v1' }, 1, 1, 2)).toBe('#718c70');
  expect(terrainColor({ ...world, template: 'sirocco-v1' }, 1, 1, 2)).toBe('#d1b489');
});

it('fills the recycler ring with its load, and never past full', () => {
  const arcs: number[][] = [];
  const c = new Proxy({}, { get: (_t, name: string) => name === 'arc' ? (...args: number[]) => arcs.push(args) : () => {}, set: () => true });
  drawCargoRing(c, 0, 30, 1); expect(arcs).toHaveLength(1);
  arcs.length = 0; drawCargoRing(c, .5, 30, 1); expect(arcs[1][4] - arcs[1][3]).toBeCloseTo(Math.PI);
  arcs.length = 0; drawCargoRing(c, 3, 30, 1); expect(arcs[1][4] - arcs[1][3]).toBeCloseTo(Math.PI * 2);
});
