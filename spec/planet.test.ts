import { expect, it } from 'vitest';
import { createWorld, findPath, tileAt } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { expandPlanet, remapFloors } from '../public/planet-world.js';
import { longitude, latitude, projectPoint, surfacePoint } from '../public/planet.js';
import { airbaseError } from '../public/aircraft.js';
import { shipyardSite } from '../public/shipyard.js';

it('extends the existing field without moving any tile or saved coordinates', () => {
  const old: any = expandWorld(createWorld()); old.terrain[34 * old.width + 47] = 4;
  old.sites = [{ id: 'saved', x: 80, y: 28, state: 'conquered' }];
  const before = structuredClone(old), world = expandPlanet(old);
  expect([world.width, world.height, world.version]).toEqual([512, 384, 3]);
  expect(world.terrain).toHaveLength(512 * 384);
  for (let y = 0; y < old.height; y++) expect(world.terrain.slice(y * world.width, y * world.width + old.width)).toEqual(old.terrain.slice(y * old.width, (y + 1) * old.width));
  expect(old).toEqual(before); expect(world.sites).toEqual(before.sites);
  expect(expandPlanet(world)).toBe(world); expect(expandPlanet(old).terrain).toEqual(world.terrain);
  expect(findPath(world, [], world.spawn, { x: 72, y: 24 })!.length).toBeGreaterThan(48);
  expect(remapFloors([0, 127, 128, 95 * 128 + 127], 128, 512)).toEqual([0, 127, 512, 95 * 512 + 127]);
});

it('provides usable new airfield plains, shores and open ocean without raising caps', () => {
  const world: any = { ...expandPlanet(expandWorld(createWorld())), airbases: [], ships: [], cores: [], tanks: [], rails: [], artillery: [], sites: [] };
  for (const p of [[220, 90], [86, 260], [365, 245]]) expect(airbaseError(world, [], [], p[0], p[1], 'pilot')).toBeNull();
  expect(tileAt(world, 240, 200)).toBe(0);
  let dock = null;
  for (let y = 25; y < 165 && !dock; y++) for (let x = 140; x < 310 && !dock; x++) {
    if (tileAt(world, x, y) !== 0) continue;
    const result = shipyardSite(world, [], [], x, y, 'pilot'); if (!result.error) dock = result.ship;
  }
  expect(dock).not.toBeNull();
});

it('round trips globe picking across hemispheres and rejects clicks beyond the limb', () => {
  for (const center of [[24, 18], [225, 94], [370, 250], [500, 370]]) {
    const lon = longitude(center[0], 512), lat = latitude(center[1], 384);
    for (const offset of [[0, 0], [10, 5], [-10, -5]]) {
      const x = center[0] + offset[0], y = center[1] + offset[1];
      const projected = projectPoint(x, y, 512, 384, lon, lat);
      expect(projected.z).toBeGreaterThan(0);
      const point = surfacePoint(projected.x, projected.y, 512, 384, lon, lat)!;
      expect(point.x).toBeCloseTo(x, 7); expect(point.y).toBeCloseTo(y, 7);
    }
  }
  expect(surfacePoint(1.1, 0, 512, 384, 0, 0)).toBeNull();
  expect(projectPoint(0, 192, 512, 384, 0, 0).z).toBeLessThan(0);
});
