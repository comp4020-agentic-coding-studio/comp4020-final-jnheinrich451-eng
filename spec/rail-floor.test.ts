import { expect, it } from 'vitest';
import { CORE } from '../public/core.js';
import { createWorld, clearSpawn, canStand, tileAt } from '../public/world.js';
import { railError, carriageError, railSegment, moveCarriage, tickCarriage } from '../public/rail.js';

it('accepts the pictured five-tile NS run across the landing-pad edge', () => {
  const world = { ...createWorld(), rails: railSegment(25, 16, 'NS'), artillery: [] };
  expect(railError(world, [], 25, 16, 'NS', 5)).toBeNull();
  expect(carriageError(world, [], [], 25, 17, 'NS')).toBeNull();
  expect(carriageError(world, [], [{ x: 24.5, y: 18.5 }], 25, 17, 'NS')).toContain('unit');
});

it('uses unfolded flooring over rocks for construction and carriage travel while keeping machinery solid', () => {
  const core = { x: 29, y: 13, elapsed: Number(CORE.duration) };
  const world = { ...createWorld(), cores: [core], rails: railSegment(34, 14, 'EW'), artillery: [] as any[] };
  expect(world.terrain[14 * world.width + 33]).toBe(3); expect(tileAt(world, 33, 14)).toBe(4);
  expect(railError(world, [], 34, 14, 'EW')).toBeNull();
  expect(carriageError(world, [], [], 34, 14, 'EW')).toBeNull();
  const gun = { id: 'g', x: 34, y: 14, shape: 'EW', angle: 0, aim: 0, brace: 0, reload: 0, move: null as any };
  world.artillery.push(gun);
  expect(moveCarriage(gun, -1, world, [], [])).toBeNull(); tickCarriage(gun, 1.2);
  expect(gun.x).toBe(33);
  expect(railError(world, [], 32, 14, 'EW', 5)).toContain('machinery');
  expect(railError(world, [], 31, 13, 'J', 1)).toContain('machinery');
  expect(railError(world, [{ x: 34, y: 14 }], 34, 14, 'EW')).toContain('facility');
  core.elapsed = 2;
  expect(railError(world, [], 34, 14, 'EW')).toContain('deployment');
  expect(carriageError(world, [], [], 34, 14, 'EW', null, true)).toContain('deployment');
});

it('finds clear arrival ground when the landing pad contains a parked or moving cannon', () => {
  const world = { ...createWorld(), artillery: [] as any[] };
  expect(clearSpawn(world, [])).toEqual(world.spawn);
  world.artillery.push({ x: 24, y: 18, move: { fromX: 24, fromY: 17, bounds: { minX: 22, maxX: 26, minY: 15, maxY: 20 } } });
  const point = clearSpawn(world, [])!;
  expect(point).not.toEqual(world.spawn); expect(canStand(world, [], point.x, point.y)).toBe(true);
  expect(clearSpawn({ ...world, terrain: Array(48 * 36).fill(0) }, [])).toBeNull();
});
