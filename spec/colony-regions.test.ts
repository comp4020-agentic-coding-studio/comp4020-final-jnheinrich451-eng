import { describe, expect, it } from 'vitest';
import { createColony, colonyAction, colonyCanStand, tickColony } from '../public/colonization.js';
import { REGION_SCAN_RADIUS, regionAction, regionWorld, regionView, regionDiscoveries, regionsFor, explorationSummary } from '../public/colony-regions.js';
import { SETTLEMENT_CATALOGUE } from '../public/colony-settlement.js';

const WORLDS = ['morrow-v1', 'nacre-v1', 'aurelia-v1'];
const garden = (template = 'morrow-v1'): any => createColony(template);
const pilot = (): any => ({ id: 'surveyor', regionId: 'home', x: 36.5, y: 31.5, angle: 0 });
const travel = (state: any, person: any, destination: string) => regionAction(state, person, 'travel-region', { regionId: person.regionId, destination });

function reachable(world: any) {
  const key = (x: number, y: number) => y * world.width + x;
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < world.width && y < world.height && [1, 2, 4].includes(world.terrain[key(x, y)]);
  const queue = [[Math.floor(world.spawn.x), Math.floor(world.spawn.y)]], seen = new Set([key(...queue[0] as [number, number])]);
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = queue[i][0] + dx, y = queue[i][1] + dy, k = key(x, y);
    if (land(x, y) && !seen.has(k)) { seen.add(k); queue.push([x, y]); }
  }
  return (x: number, y: number) => seen.has(key(Math.floor(x), Math.floor(y)));
}

it('keeps inspection and invalid travel read-only and each world to its own routes', () => {
  const state = garden(), person = pilot(), before = structuredClone(state);
  expect(explorationSummary(state)).toEqual({ version: 1, revision: 0, discoveries: [], visited: ['home'] });
  expect(regionView(state).exploration).not.toHaveProperty('worlds');
  expect(regionWorld(state, 'home')).toBe(state.world);
  for (const destination of ['home', 'constructor', '__proto__', '', null]) expect(() => travel(state, person, destination as any)).toThrow();
  expect(() => regionAction(state, person, 'travel-region', { regionId: 'lake-basin', destination: 'blossom-grove' })).toThrow('location changed');
  expect(state).toEqual(before);
  const other: any = createColony('nacre-v1'), unchanged = structuredClone(other);
  expect(() => travel(other, person, 'blossom-grove')).toThrow('Nacre survey'); expect(other).toEqual(unchanged);
  const legacy: any = createColony('caldera-v1'), kept = structuredClone(legacy);
  expect(explorationSummary(legacy)).toBeUndefined();
  expect(() => travel(legacy, person, 'blossom-grove')).toThrow('Survey routes'); expect(legacy).toEqual(kept);
});

it('gives every civilian world two regions of three discoveries, each gifting a real furnishing', () => {
  const ids = new Set();
  for (const template of WORLDS) {
    const regions = regionsFor(template);
    expect(regions[0].id).toBe('home'); expect(regions).toHaveLength(3);
    for (const region of regions.slice(1)) {
      expect(regionDiscoveries(region.id)).toHaveLength(3);
      for (const point of regionDiscoveries(region.id)) {
        expect(ids.has(point.id)).toBe(false); ids.add(point.id);
        expect(SETTLEMENT_CATALOGUE.find(item => item.id === point.furnishing)?.name, point.id).toBe(point.giftName);
      }
    }
  }
  expect(regionsFor('caldera-v1')).toEqual([]); expect(regionsFor('__proto__')).toEqual([]);
});

describe('connected geography', () => {
  for (const template of WORLDS) for (const spec of regionsFor(template).filter(region => region.id !== 'home')) it(`${spec.name} is deterministic, connected and persistently distinct`, () => {
    const state = garden(template), person = pilot(), originalHome = structuredClone(state.world);
    colonyAction(state, person, 'build-bed', { x: 31, y: 32 });
    const originalBed = structuredClone(state.beds[0]);
    travel(state, person, spec.id);
    const world = regionWorld(state, spec.id)!;
    expect(world.regionId).toBe(spec.id); expect(world.width).toBe(56); expect(world.height).toBe(44);
    expect(colonyCanStand(regionView(state, spec.id), person.x, person.y)).toBe(true);
    const canReach = reachable(world);
    for (const point of regionDiscoveries(spec.id)) {
      expect(canReach(point.x, point.y), point.name).toBe(true);
      expect(colonyCanStand(regionView(state, spec.id), point.x, point.y), point.name).toBe(true);
    }
    expect(world.template).toBe(template); expect(world.district).toBe(spec.name);
    const replica = garden(template); travel(replica, pilot(), spec.id);
    expect(regionWorld(replica, spec.id)).toEqual(world);
    const restored = JSON.parse(JSON.stringify(state));
    travel(restored, person, 'home'); travel(restored, person, spec.id);
    expect(regionWorld(restored, spec.id)).toEqual(world);
    expect(restored.world).toEqual(originalHome); expect(restored.beds[0]).toEqual(originalBed);
    expect(restored.exploration.visited).toEqual(['home', spec.id]);
  });
});

it('awards each nearby discovery once across participants, return visits and saved reload', () => {
  let state = garden(); const person = pilot(); travel(state, person, 'blossom-grove');
  const point = regionDiscoveries('blossom-grove')[0];
  const action = { regionId: 'blossom-grove', discoveryId: point.id };
  const initial = state.materials;
  expect(() => regionAction(state, person, 'discover-region', action)).toThrow('closer');
  expect(() => regionAction(state, person, 'discover-region', { ...action, discoveryId: 'morrow-silverfin' })).toThrow('this region');
  person.x = point.x + REGION_SCAN_RADIUS + .01; person.y = point.y;
  expect(() => regionAction(state, person, 'discover-region', action)).toThrow('closer');
  person.x = point.x; person.y = point.y;
  expect(regionAction(state, person, 'discover-region', action).reward).toBe(3);
  expect(state.settlement.stored[point.furnishing]).toBe(1);
  const friend = { ...person, id: 'friend' };
  expect(regionAction(state, friend, 'discover-region', action).reward).toBeUndefined();
  state = JSON.parse(JSON.stringify(state));
  expect(regionAction(state, person, 'discover-region', action).reward).toBeUndefined();
  expect(state.materials).toBe(initial + 3); expect(state.exploration.discoveries).toEqual([point.id]);
  expect(state.settlement.stored[point.furnishing]).toBe(1);
});

it('keeps remote views free of home objects and advances home production independently', () => {
  const state = garden(), person = pilot();
  const bed = colonyAction(state, person, 'build-bed', { x: 31, y: 32 });
  colonyAction(state, person, 'plant', { bedId: bed.targetId, crop: 'sundrop' });
  colonyAction(state, person, 'water', { bedId: bed.targetId });
  state.settlement = { items: [{ id: 'decor' }], deliveries: [{ id: 'delivery' }] };
  state.decorations.items = [{ id: 'fire', kind: 'campfire', x: 30, y: 30 }];
  travel(state, person, 'lake-basin');
  const remote = regionView(state, 'lake-basin');
  expect(remote.beds).toEqual([]); expect(remote.sprinklers).toEqual([]);
  expect(remote.settlement).toBeUndefined(); expect(remote.industry).toBeUndefined(); expect(remote.cinema).toBeUndefined();
  expect(remote.decorations.items).toEqual([]); expect(remote.exploration).not.toHaveProperty('worlds');
  expect(remote.materials).toBe(state.materials); expect(remote.regionDiscoveries).toHaveLength(3);
  // Home remains the authoritative simulation. Viewing a region never replaces it.
  delete state.settlement;
  tickColony(state, 3);
  expect(state.beds[0].growth).toBeGreaterThan(2.9);
  expect(person.regionId).toBe('lake-basin');
  expect(regionView(state, 'home').beds[0].id).toBe(bed.targetId);
});
