import { expect, it } from 'vitest';
import { createWorld, placementError, canStand, findPath } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { createCombat } from '../public/combat.js';

it('starts on reachable ground and keeps water and rocks impassable', () => {
  const world = createWorld();
  expect(canStand(world, [], world.spawn.x, world.spawn.y)).toBe(true);
  expect(canStand(world, [], .5, .5)).toBe(false);
  expect(canStand(world, [], 33.5, 13.5)).toBe(false);
  expect(findPath(world, [], world.spawn, { x: 28, y: 18 })?.length).toBeGreaterThan(0);
  expect(findPath(world, [], world.spawn, { x: 7, y: 8 })).toBeNull();
});

it('protects the landing area, water, occupied tiles, and nearby players', () => {
  const world = createWorld();
  expect(placementError(world, [], [], 24, 18)).toContain('landing');
  expect(placementError(world, [], [], 0, 0)).toContain('water');
  expect(placementError(world, [{ x: 28, y: 18 }], [], 28, 18)).toContain('occupied');
  expect(placementError(world, [], [{ x: 28.5, y: 18.5 }], 28, 18)).toContain('scout');
  expect(placementError(world, [], [], 28, 18)).toBeNull();
  expect(placementError(world, [], [], 1.5, 18)).not.toBeNull();
});

it('extends saved terrain without changing old coordinates and connects the new mainland', () => {
  const old = createWorld(); old.terrain[10 * 48 + 20] = 4;
  const original = structuredClone(old), expanded = expandWorld(old);
  expect([expanded.width, expanded.height, expanded.version]).toEqual([128, 96, 2]);
  for (let y = 0; y < old.height; y++) for (let x = 0; x < old.width; x++) expect(expanded.terrain[y * expanded.width + x]).toBe(old.terrain[y * old.width + x]);
  expect(old).toEqual(original); expect(expandWorld(expanded)).toBe(expanded); expect(expanded.spawn).toEqual(old.spawn);
  expect(findPath(expanded, [], expanded.spawn, { x: 72, y: 24 })?.length).toBeGreaterThan(48);
  const combat = createCombat(expanded); expect(combat.start([], 'unknown')).toBeTruthy(); expect(combat.start([], 'east')).toBeNull();
  expect(combat.snapshot().objective.id).toBe('east'); expect(combat.snapshot().enemies).toHaveLength(3);
  expect(combat.snapshot().enemies.every(e => e.x > 48)).toBe(true);
});
