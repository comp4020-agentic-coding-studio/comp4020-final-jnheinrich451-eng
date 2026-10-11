import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { expandWorld } from '../public/expansion.js';
import { seedConquest, tickSites } from '../public/conquest.js';
import { seedSettlement } from '../public/settlement.js';
import { createCombat } from '../public/combat.js';
import { CONTAMINATOR, concealed, fogRadius } from '../public/contaminator.js';

function setup() {
  const world: any = { ...expandWorld(createWorld()), sites: [] };
  for (const kind of ['alert', 'mortar', 'modifier']) world.sites.push(...seedConquest(world, [], [], kind));
  world.sites.push(...seedSettlement(world, [], []));
  const sites: any[] = seedConquest(world, [], [], 'contaminator');
  return { world, sites, site: sites[0] };
}

it('adds an emitter to real Caldera without altering terrain or previous conquests', () => {
  const { world, site } = setup(); expect(site).toMatchObject({ kind: 'contaminator', hp: 600 });
  const before = structuredClone(world); world.sites[0].state = 'conquered';
  expect(seedConquest(world, [], [], 'contaminator')).toHaveLength(1);
  expect(world.terrain).toEqual(before.terrain);
  expect(seedConquest({ ...world, terrain: world.terrain.map(() => 0) }, [], [], 'contaminator')).toEqual([]);
  const protectedSite = seedConquest(world, [{ x: site.x, y: site.y }], [], 'contaminator');
  expect(protectedSite.every(s => Math.hypot(s.x + 1.5 - site.x, s.y + 1.5 - site.y) >= 32)).toBe(true);
});

it('conceals overlapping clouds independently and clears only with saved simulation time', () => {
  const { site } = setup(), center = { x: site.x + 1.5, y: site.y + 1.5 };
  expect(concealed([site], center, 0)).toBe(true);
  expect(concealed([site], { x: center.x + 16.01, y: center.y }, 0)).toBe(false);
  const conquered = { ...site, state: 'conquered', conqueredAt: 1000 };
  expect(fogRadius(conquered, 5000)).toBe(8);
  expect(fogRadius(conquered, 9000)).toBe(0);
  expect(concealed([conquered, { ...site, x: site.x + 4 }], center, 9000)).toBe(true);
  expect(concealed([{ ...site, kind: 'modifier' }], center, 0)).toBe(false);
});

it('has initial defenders only and never becomes a scanner or reinforcement caller', () => {
  const { world, site, sites } = setup(); world.sites = sites;
  const enemies: any[] = []; let serial = 0;
  for (let now = 0; now < 60000; now += 100) {
    site.alarmUntil = now + 1000;
    tickSites(sites, world, [], [{ id: 'p', body: 'robot', life: 'active', x: site.x - 6, y: site.y }], enemies, now, () => ++serial);
  }
  expect(enemies).toHaveLength(CONTAMINATOR.guards); expect(site).not.toHaveProperty('sensor');
});

it('publishes the final clearing tick even after the last hostile site is destroyed', () => {
  const { world, site } = setup(); world.sites = [{ ...site, state: 'conquered', conqueredAt: 0 }];
  const combat = createCombat(world);
  expect(combat.tick(8.1, [])).toBe(true);
  expect(fogRadius(combat.snapshot().sites[0], combat.snapshot().time)).toBe(0);
  expect(combat.tick(.1, [])).toBe(false);
});

it('takes HE damage, preserves partial HP and resumes clearing after checkpoint restoration', () => {
  const { world, site, sites } = setup(); world.sites = sites;
  site.guardsRemaining = 0; site.nextCall = 1e9;
  const terrain = [...world.terrain], source = { id: 'p', x: site.x - 5, y: site.y + 1.5 };
  const combat = createCombat(world);
  combat.shoot(source, site.x + 1.5, site.y + 1.5, 'LASER'); combat.tick(.4, []); expect(site.hp).toBe(600);
  combat.shoot(source, site.x + 1.5, site.y + 1.5, 'HE'); for (let i = 0; i < 10; i++) combat.tick(.1, []);
  expect(site.hp).toBe(525);
  const resumedWorld: any = structuredClone(world), resumed = createCombat(resumedWorld, combat.checkpoint());
  for (let shot = 0; shot < 7; shot++) {
    resumed.shoot(source, site.x + 1.5, site.y + 1.5, 'HE'); for (let i = 0; i < 10; i++) resumed.tick(.1, []);
  }
  const dead = resumedWorld.sites[0]; expect(dead.state).toBe('conquered');
  expect(canStand(resumedWorld, [], site.x + 1.5, site.y + 1.5)).toBe(true);
  const checkpoint = resumed.checkpoint(), reloaded = createCombat(structuredClone(world), checkpoint);
  expect(fogRadius(reloaded.snapshot().sites[0], reloaded.snapshot().time)).toBe(fogRadius(dead, checkpoint.now));
  for (let i = 0; i < 85; i++) reloaded.tick(.1, []);
  expect(fogRadius(reloaded.snapshot().sites[0], reloaded.snapshot().time)).toBe(0);
  expect(resumedWorld.terrain).toEqual(terrain);
});
