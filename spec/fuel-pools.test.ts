import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { FUEL_POOL, placePool, poolContact, heatSpeed } from '../public/hazards.js';
import { freshLogistics } from '../public/logistics.js';

// Fuel pools (author, 9 November 2026): where a fuel packet ends on land without
// hitting an enemy it leaves a small burning pool, renewed rather than stacked, capped
// per shooter and in the world, separate from the artillery field caps.
const world = (): any => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), cores: [], artillery: [], logistics: freshLogistics() });
const robot = (x = 10.2, y = 10.5) => ({ id: 'robot', x, y, turret: Math.PI / 2, life: 'active', body: 'robot' });
const fly = (combat: any, seconds = 1) => { for (let i = 0; i < seconds * 10; i++) combat.tick(.1, []); };

it('leaves a pool where a packet runs out on land, and none on water', () => {
  const w = world(), c = createCombat(w), p = robot();
  expect(c.shoot(p, 30, p.y, 'FLAME')).toBeNull(); fly(c);
  const [pool] = c.snapshot().pools;
  expect(pool).toMatchObject({ x: 17.5, y: 10.5, owner: 'robot', heavy: false });
  expect(pool.until - pool.at).toBe(FUEL_POOL.duration);
  const wet = world(); for (let x = 15; x < 20; x++) wet.terrain[10 * 48 + x] = 0;
  const d = createCombat(wet); d.shoot(robot(), 30, 10.5, 'FLAME'); fly(d);
  expect(d.snapshot().pools).toEqual([]);
});

it('splashes a pool just short of a rock, and burns out after four seconds', () => {
  const w = world(); w.terrain[10 * 48 + 14] = 3;
  const c = createCombat(w); c.shoot(robot(), 30, 10.5, 'FLAME'); fly(c);
  expect(c.snapshot().pools.map((p: any) => [p.x, p.y])).toEqual([[13.5, 10.5]]);
  fly(c, 4.2); expect(c.snapshot().pools).toEqual([]);
});

it('renews a burning tile instead of stacking, and caps pools per shooter and in the world', () => {
  let pools: any[] = [];
  pools = placePool(pools, { id: 1, x: 5.5, y: 5.5, at: 0, until: 4000, owner: 'a' });
  pools = placePool(pools, { id: 2, x: 5.2, y: 5.8, at: 900, until: 4900, owner: 'a' });
  expect(pools).toHaveLength(1); expect(pools[0]).toMatchObject({ id: 1, until: 4900 });
  for (let i = 0; i < 14; i++) pools = placePool(pools, { id: 10 + i, x: 10.5 + i, y: 5.5, at: 1000 + i, until: 5000 + i, owner: 'a' });
  expect(pools.filter(p => p.owner === 'a')).toHaveLength(FUEL_POOL.perOwner);
  expect(pools.some(p => p.id === 1)).toBe(false);
  for (let i = 0; i < 60; i++) pools = placePool(pools, { id: 100 + i, x: 1.5 + i % 40, y: 20.5 + Math.floor(i / 40), at: 2000 + i, until: 6000 + i, owner: 'b' + i });
  expect(pools).toHaveLength(FUEL_POOL.max);
});

it('sets a hunter burning and fleeing, slows a bulwark without harm, and saves with the campaign', () => {
  const w = world(), base = createCombat(w).checkpoint(); base.serial = 1;
  const pool = { id: 50, x: 20.5, y: 18.5, at: 0, until: 4000, owner: 'robot', heavy: false };
  base.pools = [pool];
  base.enemies = [{ ...newGroundEnemy('hunter', 1, { x: 20.5, y: 18.5 }), eventSpawn: true }, { ...newGroundEnemy('bulwark', 2, { x: 20.6, y: 18.6 }), eventSpawn: true }];
  const c = createCombat(w, base);
  expect(c.snapshot().pools).toHaveLength(1);
  c.tick(.1, []);
  const [hunter, bulwark] = c.snapshot().enemies;
  expect(hunter.behavior).toBe('fleeing'); expect(hunter.burnUntil).toBeGreaterThan(c.snapshot().time);
  expect(bulwark.hp).toBe(450); expect(bulwark.behavior).not.toBe('fleeing');
  expect(heatSpeed([], bulwark, [pool], c.snapshot().time)).toBe(.5);
  expect(heatSpeed([], bulwark, [pool], 5000)).toBe(1);
  expect(poolContact([pool], { ...bulwark, x: 30.5 }, 0)).toBeNull();
  const restored = createCombat(w, c.checkpoint());
  expect(restored.snapshot().pools).toEqual(c.snapshot().pools);
});
