import { expect, it } from 'vitest';
import { missileAim, missileTargetError, targetBox, makeBarrage } from '../public/missile.js';
import { submarineAim, submarineTargetError, submarineBox } from '../public/submarine.js';
import { createCombat } from '../public/combat.js';
import { createWorld } from '../public/world.js';

it('clamps both launchers along the cursor bearing with every rotated corner within range', () => {
  const world = { width: 400, height: 400 }, gun = { x: 98, y: 98 }, sub = { x: 100, y: 100 };
  for (const rotated of [false, true]) for (const target of [{ x: 390, y: 100 }, { x: 300, y: 320 }, { x: -200, y: 100 }]) {
    for (const [aim, error, box, origin, range] of [[missileAim, missileTargetError, targetBox, gun, 100], [submarineAim, submarineTargetError, submarineBox, sub, 80]] as const) {
      const actual = aim(origin, world, target, rotated)!;
      expect(error(origin, world, target, rotated)).toBeNull();
      expect((actual.x - 100) * (target.y - 100) - (actual.y - 100) * (target.x - 100)).toBeCloseTo(0);
      const b = box(actual, rotated);
      expect(b.x).toBeGreaterThanOrEqual(-1e-8); expect(b.y).toBeGreaterThanOrEqual(-1e-8);
      const far = Math.max(...[b.x, b.x + b.width].flatMap(x => [b.y, b.y + b.height].map(y => Math.hypot(x - 100, y - 100))));
      expect(far).toBeLessThanOrEqual(range + 1e-8);
      if (target.x >= 100) expect(far).toBeCloseTo(range);
    }
  }
});

it('keeps near-range exclusions and invalid inputs, and commits exactly the preview rectangle', () => {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2) };
  const gun = { id: 'battery', x: 8, y: 74, ammo: 'HE' }, target = { x: 120, y: 20 };
  expect(missileTargetError(gun, world, { x: 12, y: 76 })).toBeTruthy();
  expect(missileTargetError(gun, world, { x: Infinity, y: 20 })).toBeTruthy();
  const actual = missileAim(gun, world, target, true)!, box = targetBox(actual, true), combat = createCombat(world);
  expect(combat.barrage(gun, target, true)).toBeNull();
  expect(combat.snapshot().barrages[0].box).toEqual(box);
  const barrage = makeBarrage(gun, actual, true, 1);
  expect(barrage.missiles.every(m => m.x >= box.x && m.x <= box.x + box.width && m.y >= box.y && m.y <= box.y + box.height)).toBe(true);
});

it('uses the resolved footprint for every warhead and submarine hazard reservation', () => {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2) };
  for (const ammo of ['HE', 'INCENDIARY', 'GAS']) {
    const gun = { id: 'b', x: 8, y: 74, ammo }, target = { x: 120, y: 20 }, combat = createCombat(world);
    expect(combat.barrage(gun, target, false)).toBeNull();
    const box = targetBox(missileAim(gun, world, target)!);
    expect(combat.snapshot().barrages[0].box).toEqual(box);
    if (ammo !== 'HE') expect(combat.snapshot().fields[0].box).toEqual(box);
    const sub = { id: 'sub', kind: 'submarine', x: 5, y: 50, angle: 0, health: 300, elapsed: 99, reload: 0, ammo, depth: 'surfaced' };
    const sea = createCombat(world), distant = { x: 127, y: 50 };
    expect(sea.submarineStrike(sub, distant, true)).toBeNull();
    const subBox = submarineBox(submarineAim(sub, world, distant, true)!, true);
    expect(sea.snapshot().barrages[0].box).toEqual(subBox);
    if (ammo !== 'HE') expect(sea.snapshot().fields[0].box).toEqual(subBox);
  }
});
