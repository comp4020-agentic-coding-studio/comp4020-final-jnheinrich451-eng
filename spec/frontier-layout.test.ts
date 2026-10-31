import { expect, it } from 'vitest';
import { createPlanet } from '../public/planet-templates.js';
import { prepareLandingZones, seedFrontierCities, FRONTIER_LAYOUT } from '../public/frontier-layout.js';
import { corePlacementError } from '../public/core.js';
import { settlements } from '../public/settlement.js';

it.each(['caldera-v1', 'vesper-v1'])('reserves four legal landing areas on a fresh %s without flattening water or mountains', template => {
  const original: any = createPlanet(template), before = structuredClone(original), world: any = prepareLandingZones(original);
  expect(original).toEqual(before); expect(world).toEqual(prepareLandingZones(original));
  expect(world.frontierLayout).toEqual({ version: 1 });
  expect(world.landingZones).toHaveLength(4); expect(new Set(world.landingZones.map((z: any) => z.id)).size).toBe(4);
  expect(prepareLandingZones(world)).toBe(world);
  expect(world.mountains).toEqual(original.mountains); expect(world.waterKinds).toEqual(original.waterKinds);
  for (const zone of world.landingZones) {
    expect(corePlacementError(world, [], [], zone.x, zone.y, 'pilot')).toBeNull();
    for (let y = zone.y - zone.radius; y <= zone.y + zone.radius + 2; y++) for (let x = zone.x - zone.radius; x <= zone.x + zone.radius + 2; x++) {
      if (Math.hypot(x - zone.x - 1, y - zone.y - 1) > zone.radius) continue;
      expect([1, 2]).toContain(world.terrain[y * world.width + x]); expect(world.mountains?.[y * world.width + x] || 0).toBe(0);
    }
  }
  for (let i = 0; i < world.terrain.length; i++) if (world.terrain[i] !== original.terrain[i]) {
    expect([original.terrain[i], world.terrain[i]]).toEqual([3, 2]);
    expect(world.landingZones.some((z: any) => Math.hypot(i % world.width - z.x - 1, Math.floor(i / world.width) - z.y - 1) <= z.radius)).toBe(true);
  }
});

it.each(['caldera-v1', 'vesper-v1'])('seeds dense, repeatable separated objectives beyond the four %s reserves', template => {
  const world: any = prepareLandingZones(createPlanet(template)), before = JSON.stringify(world), positions = new Set();
  for (const seed of ['0', '1', '2', '3']) {
    const plan = seedFrontierCities(world, [], [], seed);
    expect(plan).toEqual(seedFrontierCities(world, [], [], seed));
    expect(plan.manifest.groups.length).toBeGreaterThanOrEqual(template === 'caldera-v1' ? 40 : 30);
    expect(plan.manifest.groups.length).toBeLessThanOrEqual(FRONTIER_LAYOUT.groups);
    expect(plan.sites.length).toBeGreaterThanOrEqual(100);
    expect(new Set(plan.sites.map(s => s.id)).size).toBe(plan.sites.length);
    expect(new Set(plan.sites.map(s => s.kind))).toEqual(new Set(['alert', 'mortar', 'modifier', 'laser', 'anti-air', 'contaminator']));
    positions.add(JSON.stringify(plan.sites.map(s => [s.x, s.y])));
    for (const group of settlements(plan.sites)) {
      expect(group.state).toBe('hostile'); expect(group.members.length).toBeGreaterThanOrEqual(3); expect(group.members.length).toBeLessThanOrEqual(5);
      expect(group.members.every(Boolean)).toBe(true);
      expect(group.members.reduce((n: number, s: any) => n + s.guardsRemaining, 0)).toBe(4);
      expect(group.members[0].guardRoster).toEqual(['hunter', 'breaker', 'hunter', 'bulwark']);
      for (const other of plan.manifest.groups) if (other.id !== group.id)
        expect(Math.hypot(group.x - other.x, group.y - other.y)).toBeGreaterThanOrEqual(FRONTIER_LAYOUT.groupSpacing);
    }
    for (const site of plan.sites) {
      for (const z of world.landingZones) expect(Math.hypot(site.x + 1.5 - z.x - 1.5, site.y + 1.5 - z.y - 1.5)).toBeGreaterThanOrEqual(z.radius + FRONTIER_LAYOUT.zoneBuffer);
      for (let y = site.y - 2; y < site.y + 5; y++) for (let x = site.x - 2; x < site.x + 5; x++) {
        expect([1, 2]).toContain(world.terrain[y * world.width + x]); expect(world.mountains?.[y * world.width + x] || 0).toBe(0);
      }
      for (const other of plan.sites) if (other.id !== site.id) {
        expect(site.x + 3 <= other.x || other.x + 3 <= site.x || site.y + 3 <= other.y || other.y + 3 <= site.y).toBe(true);
        expect(Math.hypot(site.x - other.x, site.y - other.y)).toBeGreaterThanOrEqual(FRONTIER_LAYOUT.siteSpacing);
      }
    }
    expect(new Set(plan.manifest.groups.map(g => g.region)).size).toBeGreaterThanOrEqual(4);
  }
  expect(positions.size).toBe(4); expect(JSON.stringify(world)).toBe(before);
});

it('preserves existing objectives, construction and completed memberships rather than moving them for density', () => {
  const world: any = prepareLandingZones(createPlanet()), first = seedFrontierCities(world, [], [], 'protected');
  world.sites = first.sites.slice(0, 3).map(s => ({ ...s, hp: 0, state: 'conquered' }));
  const block = first.sites[6], buildings = [{ id: 'player-building', x: block.x, y: block.y }];
  world.logistics = { floors: [first.sites[9].y * world.width + first.sites[9].x] };
  const before = JSON.stringify(world), next = seedFrontierCities(world, buildings, [], 'protected');
  expect(JSON.stringify(world)).toBe(before);
  expect(new Set(world.sites.concat(next.sites).map((s: any) => s.id)).size).toBe(world.sites.length + next.sites.length);
  for (const site of next.sites) {
    expect(Math.hypot(site.x + 1.5 - block.x, site.y + 1.5 - block.y)).toBeGreaterThanOrEqual(32);
    for (const old of world.sites) expect(Math.hypot(site.x - old.x, site.y - old.y)).toBeGreaterThanOrEqual(FRONTIER_LAYOUT.siteSpacing);
    for (let y = site.y - 2; y < site.y + 5; y++) for (let x = site.x - 2; x < site.x + 5; x++) expect(world.logistics.floors).not.toContain(y * world.width + x);
  }
});
