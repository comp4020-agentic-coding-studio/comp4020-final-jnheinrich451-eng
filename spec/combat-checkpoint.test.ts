import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';

it('restores a partial missile barrage without refilling gas, duplicating impacts or healing enemies', () => {
  const world = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2) };
  const original = createCombat(world); original.start([]);
  expect(original.barrage({ id: 'battery', x: 64, y: 24, ammo: 'GAS', reload: 0 }, { x: 24.5, y: 18.5 }, false)).toBeNull();
  for (let i = 0; i < 200 && !original.snapshot().fields[0]?.sectors.length; i++) original.tick(.1, []);
  const saved = original.checkpoint();
  expect(saved.fields).toHaveLength(1); expect(saved.fields[0].sectors.length).toBeGreaterThan(0);
  expect(saved.fields[0].pending).toBeGreaterThan(0);
  const restored = createCombat(world, JSON.parse(JSON.stringify(saved)));
  expect(restored.checkpoint()).toEqual(saved);
  for (let i = 0; i < 100; i++) { original.tick(.1, []); restored.tick(.1, []); }
  expect(restored.checkpoint()).toEqual(original.checkpoint());
  expect(restored.snapshot().barrages).toHaveLength(0);
});
