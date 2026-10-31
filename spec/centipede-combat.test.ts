import { expect, it } from 'vitest';
import { createWorld, placementError } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { freshLogistics, facilityTargets } from '../public/logistics.js';
import { freshLife } from '../public/survival.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { initializeCentipedeBody, enemyOccupants } from '../public/centipede.js';
import { RAIL_HE, HE, MAGNETIC, MAC } from '../public/weapons.js';

function fixture(frozen = true) {
  const world: any = { ...createWorld(), width: 64, height: 64, terrain: Array(64 * 64).fill(2),
    sites: [], cores: [], tanks: [], ships: [], artillery: [], airbases: [], logistics: freshLogistics() };
  const giant: any = { ...newGroundEnemy('centipede', 1, { x: 24.5, y: 24.5 }),
    angle: Math.PI / 2, eventSpawn: true, ...(frozen ? { frenzyRecoveryUntil: 1e9 } : {}) };
  initializeCentipedeBody(giant, [{ x: 19.25, y: 24.5 }]);
  const saved = createCombat(world).checkpoint(); saved.serial = 100; saved.enemies = [giant];
  return { world, giant, saved, combat: createCombat(world, saved) };
}
const advance = (combat: any, seconds: number, buildings: any[] = [], robots: any[] = []) => {
  for (let i = 0; i < Math.round(seconds * 10); i++) combat.tick(.1, buildings, robots);
};

it('damages the distant tail with one HE blast and never multiplies damage by body segments', () => {
  const { combat } = fixture();
  expect(combat.lob({ id: 'gun', x: 9.25, y: 24.5 }, 19.25, 24.5,
    { duration: .01, verticalSpeed: 1, gravity: 12, elevation: 75 })).toBeNull();
  combat.tick(.02, []);
  expect(combat.snapshot().enemies[0].hp).toBe(2400 - RAIL_HE.damage);
  expect(combat.snapshot().impacts[0].hits).toHaveLength(1);
});

it('stops a tank HE shell on the tail even when the head is outside its blast', () => {
  const { combat } = fixture();
  expect(combat.shoot({ id: 'gun', x: 19.25, y: 21 }, 19.25, 24.5, 'HE')).toBeNull();
  advance(combat, .5);
  expect(combat.snapshot().enemies[0].hp).toBe(2400 - HE.damage);
});

it('intercepts magnetic fire at the tail and preserves the shared HP after restart', () => {
  const { world, saved } = fixture();
  saved.shells = [{ id: 90, owner: 'gun', weapon: 'MAGNETIC', x: 19.25, y: 19,
    dx: 0, dy: 1, speed: MAGNETIC.speed, remaining: 12 }];
  const combat = createCombat(world, saved); combat.tick(.1, []);
  expect(combat.snapshot().enemies[0].hp).toBe(2400 - MAGNETIC.damage);
  expect(combat.snapshot().shells).toHaveLength(0);
  const restored = createCombat(world, combat.checkpoint()); restored.tick(.1, []);
  expect(restored.snapshot().enemies[0].hp).toBe(2400 - MAGNETIC.damage);
  expect(restored.snapshot().enemies[0].body).toEqual(combat.snapshot().enemies[0].body);
});

it('counts the entire giant once against MAC penetration, then hits two enemies behind it', () => {
  const { world, saved } = fixture();
  saved.enemies.push(...[32.5, 40.5, 48.5].map((x, i) => ({ ...newGroundEnemy('bulwark', i + 2, { x, y: 24.5 }),
    hp: 2000, maxHp: 2000, frenzyRecoveryUntil: 1e9 })));
  const combat = createCombat(world, saved);
  expect(combat.macFire({ id: 'mac', kind: 'mac', x: 8, y: 24, angle: Math.PI / 2 })).toBeNull();
  advance(combat, 3.5);
  expect(combat.snapshot().enemies.map((e: any) => e.hp)).toEqual([2400 - MAC.damage, 2000 - MAC.damage, 2000 - MAC.damage, 2000]);
});

it('strikes a facility instead of a closer robot and restores its committed windup exactly once', () => {
  const { world, giant, saved } = fixture(false);
  const buildings = [{ id: 'defense', x: 26, y: 24, weapon: 'APCR' }];
  const robot = { id: 'bait', x: 24.5, y: 25.2, ...freshLife() };
  const combat = createCombat(world, saved); combat.tick(.1, buildings, [robot]);
  const warning = combat.snapshot().enemies.find((e: any) => e.id === giant.id).attack;
  expect(warning).toMatchObject({ targetId: 'sentry:defense', windup: 2200 });
  const restored = createCombat(world, combat.checkpoint());
  advance(restored, 2.3, buildings, [robot]);
  expect(world.logistics.durability['sentry:defense'].health).toBe(20);
  expect(robot.health).toBe(100);
  restored.tick(.1, buildings, [robot]);
  expect(world.logistics.durability['sentry:defense'].health).toBe(20);
});

it('keeps the starting core protected and blocks deployment over the tail', () => {
  const { world, giant } = fixture();
  world.cores = [{ id: 'home', x: 30, y: 24, elapsed: 20, starting: true }];
  world.logistics.startingCoreId = 'home';
  expect(facilityTargets(world).every((f: any) => f.id !== 'core:home')).toBe(true);
  expect(placementError(world, [], enemyOccupants([giant]), 19, 24)).toBeTruthy();
  expect(placementError(world, [], enemyOccupants([giant]), 19, 20)).toBeNull();
});

it('leaves one long salvage corpse and does not duplicate salvage after a saved death', () => {
  const { world, saved } = fixture(); saved.enemies[0].hp = 100;
  const combat = createCombat(world, saved);
  combat.lob({ id: 'gun', x: 9.25, y: 24.5 }, 19.25, 24.5,
    { duration: .01, verticalSpeed: 1, gravity: 12, elevation: 75 });
  combat.tick(.02, []);
  expect(combat.snapshot().enemies).toHaveLength(0);
  expect(world.logistics.crates).toHaveLength(1);
  expect(world.logistics.crates[0]).toMatchObject({ enemyKind: 'centipede', amount: 80 });
  expect(world.logistics.crates[0].body).toHaveLength(8);
  createCombat(world, combat.checkpoint()).tick(.1, []);
  expect(world.logistics.crates[0].amount).toBe(80);
});

it.each(['APCR', 'LASER', 'FLAME'])('retains heavy armor protection against %s at the tail', weapon => {
  const { combat } = fixture();
  expect(combat.shoot({ id: 'gun', x: 19.25, y: 21, body: 'robot' }, 19.25, 24.5, weapon)).toBeNull();
  advance(combat, .5);
  expect(combat.snapshot().enemies[0].hp).toBe(2400);
});
