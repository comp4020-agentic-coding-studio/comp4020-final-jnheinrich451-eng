import { expect, it } from 'vitest';
import { createWorld, canStand, findPath } from '../public/world.js';
import { seedConquest, tickSites, ALERT } from '../public/conquest.js';
import { createCombat } from '../public/combat.js';
import { MODIFIER, conversionStrength, convertedCells } from '../public/modifier.js';
import { reportSectorAttack } from '../public/sector-defense.js';

function setup() {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), sites: [], tanks: [], cores: [], rails: [], artillery: [], airbases: [], ships: [] };
  world.sites = seedConquest(world, [], [], 'modifier');
  return { world, site: world.sites[0] };
}

it('chooses safe ground without moving equipment, previous objectives or changing terrain', () => {
  const { world, site } = setup(), terrain = [...world.terrain];
  world.sites = seedConquest(world, [], []); world.sites.push(...seedConquest(world, [], [], 'mortar'));
  const next = seedConquest(world, [], [], 'modifier')[0]; expect(next.kind).toBe('modifier');
  expect(world.sites.every((s: any) => Math.hypot(s.x - next.x, s.y - next.y) >= 30)).toBe(true);
  const protectedSite = seedConquest({ ...world, sites: [] }, [{ x: site.x, y: site.y }], [], 'modifier')[0];
  expect(Math.hypot(site.x - protectedSite.x, site.y - protectedSite.y)).toBeGreaterThan(22);
  expect(world.terrain).toEqual(terrain);
  expect(seedConquest({ ...world, terrain: Array(128 * 96).fill(0) }, [], [], 'modifier')).toEqual([]);
  expect(seedConquest(world, [], [], 'unknown')).toEqual([]);
});

it('keeps conversion bounded, deterministic and cosmetic, excluding water, rocks and flooring', () => {
  const { world, site } = setup(); const x = site.x - 4, y = site.y;
  world.terrain[y * world.width + x] = 0; world.terrain[y * world.width + x + 1] = 3; world.terrain[y * world.width + x + 2] = 4;
  const terrain = [...world.terrain], start = { x: site.x - 6, y: site.y + 4 }, end = { x: site.x + 6, y: site.y + 4 };
  const before = findPath(world, [], start, end), cells = convertedCells(world, site);
  expect(cells.length).toBeGreaterThan(100); expect(cells.length).toBeLessThan(400);
  expect(cells.every(c => [1, 2].includes(world.terrain[c.y * world.width + c.x]))).toBe(true);
  expect(convertedCells(world, site)).toEqual(cells); expect(world.terrain).toEqual(terrain);
  expect(findPath(world, [], start, end)).toEqual(before);
});

it('has three initial guards, never gets a scanner or reinforcement waves, and obeys the global cap', () => {
  const { world, site } = setup(), enemies: any[] = []; let serial = 0;
  const people = [{ id: 'p', body: 'robot', life: 'active', shield: 0, health: 100, x: site.x - 6, y: site.y }];
  for (let now = 0; now < 60000; now += 100) { reportSectorAttack(world.sites, enemies, site.x, site.y, now); tickSites(world.sites, world, [], people, enemies, now, () => ++serial); }
  expect(enemies).toHaveLength(MODIFIER.guards); expect(site.sensor).toBeUndefined();
  enemies.length = 0;
  for (let now = 60000; now < 90000; now += 100) { reportSectorAttack(world.sites, enemies, site.x, site.y, now); tickSites(world.sites, world, [], people, enemies, now, () => ++serial); }
  expect(enemies).toEqual([]); expect(site.pending).toBeNull();
  site.guardsRemaining = 3; enemies.push(...Array.from({ length: ALERT.globalMax }, (_, id) => ({ id, hp: 60, x: 1, y: 1 })));
  tickSites(world.sites, world, [], people, enemies, 91000, () => ++serial); expect(site.pending).toBeNull();
});

it('accepts HE conquest, preserves partial damage and restores appearance without changing the saved terrain', () => {
  const { world, site } = setup(); site.guardsRemaining = 0;
  const terrain = [...world.terrain], combat = createCombat(world), source = { id: 'p', x: site.x - 5, y: site.y + 1.5 };
  combat.shoot(source, site.x + 1.5, site.y + 1.5, 'LASER'); combat.tick(.4, []); expect(site.hp).toBe(MODIFIER.hp);
  combat.shoot(source, site.x + 1.5, site.y + 1.5, 'HE'); for (let i = 0; i < 10; i++) combat.tick(.1, []);
  expect(site.hp).toBe(MODIFIER.hp - 75);
  const restoredWorld = structuredClone(world), restored = createCombat(restoredWorld, combat.checkpoint()), restoredSite = restoredWorld.sites[0];
  for (let i = 0; i < 6; i++) { restored.shoot(source, site.x + 1.5, site.y + 1.5, 'HE'); for (let j = 0; j < 10; j++) restored.tick(.1, []); }
  expect(restoredSite).toMatchObject({ hp: 0, state: 'conquered' });
  expect(canStand(restoredWorld, [], site.x + 1.5, site.y + 1.5)).toBe(true);
  expect(conversionStrength(restoredSite, restoredSite.conqueredAt)).toBe(1);
  expect(conversionStrength(restoredSite, restoredSite.conqueredAt + MODIFIER.recovery / 2)).toBe(.5);
  expect(conversionStrength(restoredSite, restoredSite.conqueredAt, true)).toBe(0);
  for (let j = 0; j < 65; j++) restored.tick(.1, []);
  expect(conversionStrength(restoredSite, restored.snapshot().time)).toBe(0);
  const resumedWorld = structuredClone(restoredWorld), resumed = createCombat(resumedWorld, restored.checkpoint());
  expect(conversionStrength(resumedWorld.sites[0], resumed.snapshot().time)).toBe(0);
  expect(resumedWorld.terrain).toEqual(terrain); expect(resumedWorld.sites[0].conqueredAt).toBe(restoredSite.conqueredAt);
});
