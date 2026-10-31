import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { initializeCentipedeBody } from '../public/centipede.js';
import { freshLogistics } from '../public/logistics.js';
import { MAC } from '../public/weapons.js';

it('restores a MAC projectile inside the long body without spending another penetration or repeating damage', () => {
  const world: any = { width: 96, height: 64, terrain: Array(96 * 64).fill(2), spawn: { x: 10.5, y: 10.5 },
    sites: [], cores: [], tanks: [], ships: [], artillery: [], airbases: [], logistics: freshLogistics() };
  const giant: any = { ...newGroundEnemy('centipede', 1, { x: 30.5, y: 24.5 }), frenzyRecoveryUntil: 1e9 };
  initializeCentipedeBody(giant, [{ x: 25.25, y: 24.5 }]);
  const saved = createCombat(world).checkpoint(); saved.serial = 100;
  saved.enemies = [giant, ...[37.5, 44.5, 52.5].map((x, i) => ({
    ...newGroundEnemy('bulwark', i + 2, { x, y: 24.5 }), hp: 2000, maxHp: 2000, frenzyRecoveryUntil: 1e9 }))];
  const combat = createCombat(world, saved);
  expect(combat.macFire({ id: 'mac', kind: 'mac', x: 20, y: 24, angle: Math.PI / 2 })).toBeNull();
  for (let i = 0; i < 300 && !combat.snapshot().salvos.some(s => s.hitIds?.includes(giant.id)); i++) combat.tick(.01, []);
  const traveling = combat.snapshot().salvos[0];
  expect(traveling.hitIds).toEqual([giant.id]);
  expect(traveling.x).toBeGreaterThan(25.25); expect(traveling.x).toBeLessThan(giant.x);
  expect(combat.snapshot().enemies[0].hp).toBe(2400 - MAC.damage);
  const checkpoint = structuredClone(combat.checkpoint());
  const restored = createCombat(structuredClone(world), checkpoint);
  for (let i = 0; i < 20; i++) { combat.tick(.05, []); restored.tick(.05, []); }
  const expected = [2400 - MAC.damage, 2000 - MAC.damage, 2000 - MAC.damage, 2000];
  expect(combat.snapshot().enemies.map(e => e.hp)).toEqual(expected);
  expect(restored.snapshot().enemies.map(e => e.hp)).toEqual(expected);
  expect(restored.snapshot().salvos).toHaveLength(0);
  expect(restored.snapshot().enemies[0].body).toEqual(combat.snapshot().enemies[0].body);
});
