import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { MISSILE, missileAim, missilePlacementError, missileTargetError, missileFireError, targetBox, makeBarrage, tickBattery, batteryPose, batteryState, batteryTarget, batteryAligned } from '../public/missile.js';
import { gunCells, artilleryBlocks } from '../public/footprints.js';
import { railError } from '../public/rail.js';
import { createCombat } from '../public/combat.js';
const field = (width = 128, height = 96) => ({ ...createWorld(), width, height, terrain: Array(width * height).fill(2), artillery: [] as any[], rails: [] as any[] });
const battery = (): any => ({ id: 'battery', owner: 'a', kind: 'missile', x: 60, y: 20, reload: 0, rotated: false, target: { x: 90, y: 50 }, operator: null as string | null, lease: 0, deploy: 1 });

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
  expect(missileTargetError(gun, world, { x: 122, y: 50 }, true)).toBeNull();
  expect(missileTargetError(gun, world, { x: 70, y: 22 })).toContain('15 and 200');
  expect(missileTargetError(gun, world, { x: NaN, y: 50 })).toContain('Choose');
  expect(missileTargetError({ ...gun, x: 0, y: 0 }, world, { x: 95, y: 20 })).toBeNull();
});

it('reaches 200 tiles at one missile speed, so a longer shot takes longer to land', () => {
  const world = field(512, 384), gun = { ...battery(), x: 8, y: 180 }, center = { x: 10, y: 182 };
  const far = (aim: any) => Math.max(...[aim.x - 6, aim.x + 6].flatMap(x => [aim.y - 9, aim.y + 9].map(y => Math.hypot(x - center.x, y - center.y))));
  const within = { x: center.x + 150, y: center.y };
  expect(missileAim(gun, world, within)).toEqual(within);
  const clamped = missileAim(gun, world, { x: 500, y: center.y });
  expect(far(clamped)).toBeCloseTo(200);expect(clamped.y).toBeCloseTo(center.y);
  expect(missileTargetError(gun, world, clamped)).toBeNull();
  const flight = (range: number) => makeBarrage(gun, { x: center.x + range, y: center.y }, false, 1).missiles[0].flight;
  expect(flight(50)).toBeCloseTo(8);expect(flight(100)).toBeCloseTo(10);expect(flight(200)).toBeCloseTo(14);
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
  const world = field(); let combat = createCombat(world); const saved = JSON.stringify(world);
  combat.barrage(battery(), { x: 24.5, y: 18.5 }, false);
  // Put a stationary defender at a committed impact. This checks HE damage,
  // not whether a particular crawler speed happens to cross the barrage.
  const checkpoint=combat.checkpoint(),point=checkpoint.barrages[0].missiles[0];
  checkpoint.enemies=[{id:++checkpoint.serial,x:point.x,y:point.y,hp:60,angle:0,path:[],reroute:20000}];
  combat=createCombat(world,checkpoint);
  for (let i = 0; i < 130; i++) combat.tick(.1, []);
  expect(combat.snapshot().kills).toBe(1); expect(JSON.stringify(world)).toBe(saved);
});

it('deploys when operated, turns toward the aim, fires at its actual pose and stows when idle', () => {
  const world = field(), gun = battery();delete gun.deploy;
  // A battery with no saved pose starts stowed; a known target sets its bearing.
  expect(batteryState(gun, world)).toMatchObject({ deploy: 0, angle: batteryPose(gun, world, gun.target).angle });
  Object.assign(gun, { operator: 'a', lease: 99, angle: 0, elevation: MISSILE.minElevation });
  expect(missileFireError(gun, world)).toContain('deploying');
  tickBattery(gun, MISSILE.deploy / 2, world);expect(gun.deploy).toBeCloseTo(.5);expect(gun.angle).toBe(0);
  tickBattery(gun, MISSILE.deploy / 2, world);expect(gun.deploy).toBe(1);
  // Turning starts once raised, at 60 deg/s and 15 deg/s of elevation.
  const goal = batteryPose(gun, world, gun.target), before = Math.abs(goal.angle - gun.angle), lift = goal.elevation - gun.elevation;
  tickBattery(gun, .5, world);expect(Math.abs(goal.angle - gun.angle)).toBeCloseTo(Math.max(0, before - MISSILE.turnSpeed * .5));
  expect(goal.elevation - gun.elevation).toBeCloseTo(Math.max(0, lift - MISSILE.elevationSpeed * .5));
  // Firing now strikes where the launcher points, not under the cursor.
  const actual = batteryTarget(gun, world);expect(batteryAligned(gun, world)).toBe(false);
  expect(Math.hypot(actual.x - missileAim(gun, world, gun.target, false).x, actual.y - missileAim(gun, world, gun.target, false).y)).toBeGreaterThan(1);
  const volley = makeBarrage(gun, actual, false, 7), center = { x: gun.x + 2, y: gun.y + 2 };
  expect(Math.hypot(volley.missiles[0].originX - center.x, volley.missiles[0].originY - center.y)).toBeGreaterThan(.3);
  for (let i = 0; i < 80; i++) tickBattery(gun, .1, world);
  expect(batteryAligned(gun, world)).toBe(true);
  const saved = JSON.parse(JSON.stringify(gun));expect(batteryState(saved, world)).toMatchObject({ angle: gun.angle, elevation: gun.elevation, deploy: 1 });
  // Released: stays raised for the quiet period or while its volley flies, then stows.
  gun.operator = null;tickBattery(gun, MISSILE.stow - .1, world);expect(gun.deploy).toBe(1);
  tickBattery(gun, 1, world, true);expect(gun.deploy).toBe(1);
  tickBattery(gun, MISSILE.stow, world);tickBattery(gun, MISSILE.deploy / 2, world);expect(gun.deploy).toBeCloseTo(.5);
  for (let i = 0; i < 40; i++) tickBattery(gun, .1, world);expect(gun.deploy).toBe(0);
});

it('turns an old-format battery onto a distant aim clamped to range, then fires there', () => {
  const world = field(512, 384), gun: any = { id: 'old', owner: 'a', kind: 'missile', x: 8, y: 74, ammo: 'HE', rotated: false, reload: 0, target: { x: 300, y: 15 }, operator: 'a', lease: 99 };
  const clamped = missileAim(gun, world, gun.target, false), center = { x: gun.x + 2, y: gun.y + 2 };
  expect(Math.hypot(gun.target.x - center.x, gun.target.y - center.y)).toBeGreaterThan(MISSILE.range);
  expect(Math.hypot(clamped.x - center.x, clamped.y - center.y)).toBeLessThanOrEqual(MISSILE.range);
  expect(missileFireError(gun, world)).toContain('deploying');
  Object.assign(gun, { angle: 0, elevation: MISSILE.minElevation });
  for (let i = 0; i < 120; i++) tickBattery(gun, .1, world);
  expect(batteryAligned(gun, world)).toBe(true);
  const actual = batteryTarget(gun, world);
  expect(Math.hypot(actual.x - clamped.x, actual.y - clamped.y)).toBeLessThan(.01);
  expect(missileFireError(gun, world)).toBeNull();
});
