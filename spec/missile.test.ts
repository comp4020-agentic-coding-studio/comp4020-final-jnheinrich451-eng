import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { MISSILE, missilePlacementError, missileTargetError, missileFireError, targetBox, makeBarrage, tickBattery } from '../public/missile.js';
import { gunCells, artilleryBlocks } from '../public/footprints.js';
import { railError } from '../public/rail.js';
import { createCombat } from '../public/combat.js';
const field = () => ({ ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), artillery: [] as any[], rails: [] as any[] });
const battery = () => ({ id: 'battery', owner: 'a', kind: 'missile', x: 60, y: 20, reload: 0, rotated: false, target: { x: 90, y: 50 }, operator: null as string | null, lease: 0 });

it('reserves exactly 4x4, including the far edge, and rejects rails, units, rocks and duplicate batteries', () => {
  const world = field(), gun = battery();
  expect(missilePlacementError(world, [], [], 60, 20, 'a')).toBeNull();
  expect(missilePlacementError(world, [], [{ x: 63.5, y: 23.5 }], 60, 20, 'a')).toContain('unit');
  world.terrain[23 * 128 + 63] = 0; expect(missilePlacementError(world, [], [], 60, 20, 'a')).toContain('Ocean'); world.terrain[23 * 128 + 63] = 2;
  world.terrain[23 * 128 + 63] = 3; expect(missilePlacementError(world, [], [], 60, 20, 'a')).toContain('land'); world.terrain[23 * 128 + 63] = 2;
  world.rails.push({ x: 63, y: 23, shape: 'EW' }); expect(missilePlacementError(world, [], [], 60, 20, 'a')).toContain('Rails'); world.rails = [];
  world.artillery.push(gun); expect(gunCells(gun)).toHaveLength(16); expect(artilleryBlocks(world, 63, 23)).toBe(true); expect(artilleryBlocks(world, 64, 23)).toBe(false);
  expect(canStand(world, [], 63.5, 23.5)).toBe(false); expect(railError(world, [], 63, 23, 'J', 1)).toContain('battery');
  expect(missilePlacementError(world, [], [], 70, 20, 'a')).toContain('One missile');
});

it('validates the entire 12x18 target rectangle, including rotated corners and near-range exclusion', () => {
  const world = field(), gun = battery();
  expect(targetBox(gun.target)).toEqual({ x: 84, y: 41, width: 12, height: 18 });
  expect(targetBox(gun.target, true)).toEqual({ x: 81, y: 44, width: 18, height: 12 });
  expect(missileTargetError(gun, world, gun.target)).toBeNull();
  expect(missileTargetError(gun, world, { x: 122, y: 50 }, true)).toContain('inside');
  expect(missileTargetError(gun, world, { x: 70, y: 22 })).toContain('15 and 100');
  expect(missileTargetError(gun, world, { x: NaN, y: 50 })).toContain('Choose');
  expect(missileTargetError({ ...gun, x: 0, y: 0 }, world, { x: 95, y: 20 })).toContain('15 and 100');
});

it('commits twelve repeatable distributed impact assignments with a 2.75s launch sequence', () => {
  const gun = battery(), a = makeBarrage(gun, gun.target, false, 42), b = makeBarrage(gun, gun.target, true, 42);
  expect(a).toEqual(makeBarrage(gun, gun.target, false, 42)); expect(a.missiles).toHaveLength(12);
  expect(a.missiles[11].launch).toBe(2.75);
  expect(new Set(a.missiles.map(m => `${Math.floor((m.x - a.box.x) / 4)}:${Math.floor((m.y - a.box.y) / 4.5)}`)).size).toBe(12);
  const offsets = a.missiles.map((m, i) => ({ x: m.x - (a.box.x + (i % 3 + .5) * 4), y: m.y - (a.box.y + (Math.floor(i / 3) + .5) * 4.5) }));
  for (const axis of ['x', 'y'] as const) {
    expect(offsets.some(p => p[axis] < -.2)).toBe(true); expect(offsets.some(p => p[axis] > .2)).toBe(true);
    expect(offsets.every(p => Math.abs(p[axis]) <= 1.1)).toBe(true);
  }
  for (const m of a.missiles) { expect(m.craterSize).toBeGreaterThanOrEqual(7.2); expect(m.craterSize).toBeLessThanOrEqual(8.8); }
  for (let i = 0; i < 12; i++) { expect(b.missiles[i].x - gun.target.x).toBeCloseTo(a.missiles[i].y - gun.target.y); expect(b.missiles[i].y - gun.target.y).toBeCloseTo(a.missiles[i].x - gun.target.x); }
});

it('reserves whole volleys separately from artillery, resolves each impact once and keeps them across drills', () => {
  const world = field(), gun = battery(), combat = createCombat(world);
  expect(combat.barrage(gun, gun.target, false)).toBeNull(); expect(combat.barrage(gun, gun.target, true)).toBeNull();
  expect(combat.barrage(gun, gun.target, false)).toContain('Two');
  expect(combat.snapshot().salvos).toHaveLength(0); expect(combat.snapshot().barrages).toHaveLength(2);
  combat.start([]); expect(combat.snapshot().barrages).toHaveLength(2);
  const seen = new Set();
  for (let i = 0; i < 120; i++) { combat.tick(.1, []); for (const impact of combat.snapshot().impacts) seen.add(impact.id); }
  expect(seen.size).toBe(24); expect(combat.snapshot().barrages).toHaveLength(0); expect(combat.snapshot().marks.filter(m => m.kind === 'crater')).toHaveLength(24);
  expect(combat.snapshot().marks.filter(m => m.kind === 'crater').every(m => m.size >= 7.2 && m.size <= 8.8)).toBe(true);
  expect(createCombat(world).snapshot().barrages).toHaveLength(0);
});

it('starts 15s reload after the staggered launch and preserves spent time without an operator', () => {
  const gun = battery(), world = field(); gun.reload = MISSILE.reload + 2.75;
  expect(missileFireError(gun, world)).toContain('reloading'); tickBattery(gun, 2.75); expect(gun.reload).toBe(15);
  const saved = JSON.parse(JSON.stringify(gun)); tickBattery(saved, 15); expect(missileFireError(saved, world)).toBeNull();
  expect(missileFireError(saved, world, saved.target, false, [{}, {}])).toContain('Two');
});

it('applies HE damage to monsters while preserving friendly construction and terrain', () => {
  const world = field(), combat = createCombat(world), saved = JSON.stringify(world);
  combat.barrage(battery(), { x: 24.5, y: 18.5 }, false);
  for (let i = 0; i < 30; i++) combat.tick(.1, []);
  combat.start([]);
  for (let i = 0; i < 130; i++) combat.tick(.1, []);
  expect(combat.snapshot().kills).toBeGreaterThan(0); expect(JSON.stringify(world)).toBe(saved);
});
