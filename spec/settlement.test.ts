import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { ALERT, seedConquest, tickSites } from '../public/conquest.js';
import { seedSettlement, settlements } from '../public/settlement.js';
import { createCombat } from '../public/combat.js';
import { reportSectorAttack } from '../public/sector-defense.js';

function setup() {
  const world: any = { ...expandWorld(createWorld()), sites: [] };
  for (const kind of ['alert', 'mortar', 'modifier']) world.sites.push(...seedConquest(world, [], [], kind));
  return world;
}

it('adds a complete compound to real Caldera without altering previous sites or terrain', () => {
  const world = setup(), original = structuredClone(world), added = seedSettlement(world, [], []);
  expect(added.map(s => s.kind)).toEqual(['alert', 'mortar', 'modifier']);
  expect(new Set(added.map(s => s.id)).size).toBe(3);
  expect(world).toEqual(original);
  world.sites.push(...added);
  expect(seedSettlement(world, [], [])).toEqual([]);
  expect(settlements(world.sites)[0]).toMatchObject({ cleared: 0, state: 'hostile' });
  expect(seedSettlement({ ...original, terrain: original.terrain.map(() => 0) }, [], [])).toEqual([]);
  const occupied = seedSettlement(original, [{ x: added[0].x, y: added[0].y }], []);
  expect(occupied.every(s => Math.hypot(s.x - added[0].x, s.y - added[0].y) >= 24)).toBe(true);
});

it('requires every named objective, retains partial progress and never counts a missing structure as conquered', () => {
  const world = setup(); world.sites.push(...seedSettlement(world, [], []));
  const group = settlements(world.sites)[0];
  for (const s of world.sites) { s.guardsRemaining = 0; s.nextCall = 1e9; }
  const combat = createCombat(world);
  for (let i = 0; i < group.members.length; i++) {
    const site = group.members[i]!;
    // A clear firing approach on each existing footprint's side.
    world.terrain.fill(2);
    const source = { id: 'tester', x: site.x - 5, y: site.y + 1.5 };
    for (let shot = 0; shot < Math.ceil(site.maxHp / 75); shot++) {
      combat.shoot(source, site.x + 1.5, site.y + 1.5, 'HE');
      for (let tick = 0; tick < 10; tick++) combat.tick(.1, []);
    }
    expect(settlements(world.sites)[0]).toMatchObject({ cleared: i + 1, state: i === 2 ? 'conquered' : 'hostile' });
    const restored: any = structuredClone(world); createCombat(restored, combat.checkpoint());
    expect(settlements(restored.sites)[0].cleared).toBe(i + 1);
  }
  const missing = world.sites.filter((s: any) => s.id !== group.requiredIds[0]);
  expect(settlements(missing)[0]).toMatchObject({ cleared: 2, state: 'hostile' });
});

it('shares bounded defence but only the crown calls reinforcements, under the existing global population cap', () => {
  const world = setup(); world.sites = seedSettlement(world, [], []);
  world.terrain.fill(2);
  const enemies: any[] = []; let serial = 0;
  const crown = world.sites[0], mortar = world.sites[1];
  const people = [{ id: 'p', body: 'robot', life: 'active', shield: 0, health: 100, x: crown.x - 6, y: crown.y }];
  for (let now = 0; now < 120000; now += 100) {
    reportSectorAttack(world.sites, enemies, mortar.x, mortar.y, now);
    tickSites(world.sites, world, [], people, enemies, now, () => ++serial);
    expect(enemies.length).toBeLessThanOrEqual(ALERT.globalMax);
  }
  expect(enemies.filter(e => e.siteId === crown.id).length).toBeGreaterThan(ALERT.guards);
  expect(enemies.filter(e => e.siteId === mortar.id).length).toBe(2);
  expect(world.sites.slice(1).every((s: any) => !s.sensor)).toBe(true);
  const alive = enemies.length;
  for (const s of world.sites) { s.state = 'conquered'; s.hp = 0; }
  tickSites(world.sites, world, [], people, enemies, 121000, () => ++serial);
  expect(enemies).toHaveLength(alive); expect(world.sites.every((s: any) => !s.pending)).toBe(true);
});
