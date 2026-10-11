import { expect, it } from 'vitest';
import { ALERT, seedConquest, tickSites } from '../public/conquest.js';
import { createWorld, canStand, placementError } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { corePlacementError } from '../public/core.js';
import { tankPlacementError } from '../public/tank.js';
import { missilePlacementError } from '../public/missile.js';
import { railError } from '../public/rail.js';
import { raycast } from '../public/raycast.js';

function setup() {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), tanks: [], cores: [], rails: [], artillery: [], airbases: [], ships: [] };
  world.sites = seedConquest(world, [], []);
  return { world, site: world.sites[0], combat: createCombat(world) };
}
function advance(combat: any, seconds: number, people: any[] = []) { for (let i = 0; i < seconds * 10; i++) combat.tick(.1, [], people, people); }

it('blocks movement, rays and every ground footprint without changing terrain; ruins become buildable', () => {
  const { world, site } = setup(), { x, y } = site, terrain = [...world.terrain];
  expect(canStand(world, [], x + 1.5, y + 1.5)).toBe(false);
  expect(placementError(world, [], [], x, y)).toContain('station');
  expect(corePlacementError(world, [], [], x, y, 'p')).toContain('station');
  expect(tankPlacementError(world, [], [], x, y, 'p')).toContain('station');
  expect(missilePlacementError(world, [], [], x, y, 'p')).toContain('station');
  expect(railError(world, [], x, y, 'EW', 1)).toContain('station');
  expect(raycast(world, [], { x: x - 2, y: y + .5 }, 1, 0, 8).distance).toBe(2);
  site.state = 'conquered'; site.hp = 0;
  expect(canStand(world, [], x + 1.5, y + 1.5)).toBe(true);
  expect(placementError(world, [], [], x, y)).toBeNull();
  expect(world.terrain).toEqual(terrain);
});

it('does not overlay existing bases, saved people or enemies and leaves a packed map unchanged', () => {
  const { world, site } = setup(); world.sites = [];
  const occupied = [{ id: 'old', x: site.x, y: site.y }];
  expect(seedConquest(world, occupied, [site])[0]).not.toMatchObject({ x: site.x, y: site.y });
  const terrain = Array(world.width * world.height).fill(0); world.terrain = terrain;
  expect(seedConquest(world, [], [])).toEqual([]); expect(world.terrain).toBe(terrain);
});

it('keeps guards shared, caps prolonged alarms, cancels calls when quiet and respects blocked arrival points', () => {
  const { world, site } = setup(), enemies: any[] = [], people = [{ id: 'scout', x: site.x - 6, y: site.y, body: 'robot', life: 'active' }];
  let serial = 0;
  for (let now = 100; now < 180000; now += 100) tickSites(world.sites, world, [], [...people, ...people], enemies, now, () => ++serial);
  expect(enemies).toHaveLength(ALERT.max); expect(site.guardsRemaining).toBe(0);
  enemies.pop(); site.nextCall = 0;
  tickSites(world.sites, world, [], people, enemies, 181000, () => ++serial);
  expect(site.pending).not.toBeNull();
  tickSites(world.sites, world, [], [], enemies, 190000, () => ++serial);
  expect(site.pending).toBeNull(); expect(site.alarm).toBe(false);
  expect(enemies).toHaveLength(ALERT.max - 1);
  site.nextCall = 0;
  tickSites(world.sites, world, [], people, enemies, 191000, () => ++serial, () => true);
  expect(site.pending).toBeNull();
});

it('rejects robot and non-HE structure damage, saves partial damage and permanently completes exactly once', () => {
  const { world, site, combat } = setup();
  const source = { id: 'tank', x: site.x - 3, y: site.y + 1.5 };
  for (const weapon of ['LASER', 'FLAME', 'APCR', 'MAGNETIC']) {
    expect(combat.shoot(source, site.x + 1.5, site.y + 1.5, weapon)).toBeNull(); advance(combat, 2);
  }
  expect(site.hp).toBe(ALERT.hp);
  expect(combat.shoot(source, site.x + 1.5, site.y + 1.5, 'HE')).toBeNull(); advance(combat, 1);
  expect(site.hp).toBe(ALERT.hp - 75);
  const partialSave = combat.checkpoint(), survivorId = ++partialSave.serial;
  // Incoming guards now investigate the shell impacts and may die in later blasts.
  // Keep one defender outside that fight to verify conquest does not delete survivors.
  partialSave.enemies.push({ id: survivorId, siteId: site.id, hp: 60, x: site.x + 30, y: site.y + 30,
    homeX: site.x + 30, homeY: site.y + 30, angle: 0, path: [], reroute: 0, behavior: 'guarding' });
  const restoredWorld = structuredClone(world), restored = createCombat(restoredWorld, partialSave);
  expect(restoredWorld.sites[0].hp).toBe(site.hp);
  for (let i = 0; i < 5; i++) { expect(restored.shoot(source, site.x + 1.5, site.y + 1.5, 'HE')).toBeNull(); advance(restored, 1); }
  const completed = restored.snapshot().sites[0];
  expect(completed.state).toBe('conquered'); expect(completed.hp).toBe(0);
  expect(restored.snapshot().enemies.some((e: any) => e.id === survivorId && e.hp === 60)).toBe(true);
  const conquestTime = completed.conqueredAt;
  restored.shoot(source, site.x + 1.5, site.y + 1.5, 'HE'); advance(restored, 15);
  expect(restored.snapshot().sites[0].conqueredAt).toBe(conquestTime);
  const checkpoint = restored.checkpoint(), reloaded = createCombat(structuredClone(world), checkpoint);
  expect(reloaded.checkpoint()).toEqual(checkpoint);
  reloaded.start([]); advance(reloaded, 1);
  expect(reloaded.snapshot().sites[0].state).toBe('conquered');
});

it('resolves off-camera heavy shells, missiles and bomber bombs against the station', () => {
  for (const kind of ['heavy', 'missile', 'bomber']) {
    const { combat, site } = setup(); const x = site.x + 1.5, y = site.y + 1.5;
    if (kind === 'heavy') expect(combat.lob({ id: 'rail', x: x - 20, y }, x, y)).toBeNull();
    else if (kind === 'missile') expect(combat.barrage({ id: 'battery', x: x - 40, y, ammo: 'HE' }, { x, y }, false)).toBeNull();
    else expect(combat.bombRun({ id: 'plane', x, y: y + 6 * 1.8, speed: 6, angle: 0, state: 'flying', runs: 2, releaseRemaining: 0 })).toBeNull();
    advance(combat, 15); expect(site.hp).toBeLessThan(ALERT.hp);
  }
});

it('keeps site defenders out of drill completion and does not reset accepted strikes when starting a drill', () => {
  const { combat, site } = setup();
  combat.lob({ id: 'gun', x: site.x - 15, y: site.y }, site.x, site.y);
  combat.start([]); expect(combat.snapshot().salvos).toHaveLength(1);
  advance(combat, 5); expect(site.hp).toBeLessThan(ALERT.hp);
  const saved = combat.checkpoint(); saved.enemies = saved.enemies.filter((e: any) => e.siteId);
  const replay = createCombat(setup().world, saved); advance(replay, 1);
  expect(replay.snapshot().status).toBe('cleared');
  expect(replay.snapshot().enemies.length).toBeGreaterThan(0);
});

it('returns a distant defender home without healing it or damaging the unrelated drill beacon', () => {
  const { world, site, combat } = setup(), saved = combat.checkpoint();
  saved.enemies = [{ id: 50, siteId: site.id, homeX: site.x - 5, homeY: site.y,
    x: site.x - 28, y: site.y, hp: 17, angle: 0, path: [], reroute: 0, targetId: 'robot' }];
  const replay = createCombat(world, saved);
  const robot = { id: 'robot', x: site.x - 29, y: site.y, body: 'robot', life: 'active', health: 100, shield: 0 };
  advance(replay, 2, [robot]);
  const defender = replay.snapshot().enemies[0];
  expect(defender.targetId).toBeNull(); expect(defender.x).toBeGreaterThan(site.x - 28);
  expect(defender.hp).toBe(17); expect(replay.snapshot().health).toBe(100); expect(robot.health).toBe(100);
});
