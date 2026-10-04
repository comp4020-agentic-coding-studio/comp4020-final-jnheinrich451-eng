import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { joinedShape, railPorts } from '../public/track.js';
import { railSegment, railError, driveCarriage, tickCarriage, gunPosition, carriageError } from '../public/rail.js';
import { artilleryBlocks, railCorridor, compactTurnHits } from '../public/footprints.js';

const vectors: Record<string, number[]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
function setup(shape = 'J') {
  const world = { ...createWorld(), terrain: Array(48 * 36).fill(2), rails: [{ x: 12, y: 12, shape, owner: 'a' }], artillery: [] as any[] };
  for (const port of railPorts({ shape })) { const [dx, dy] = vectors[port]; for (let i = 1; i <= 5; i++) world.rails.push({ x: 12 + dx * i, y: 12 + dy * i, shape: dx ? 'EW' : 'NS', owner: 'a' }); }
  const gun = { id: 'g', x: 12, y: 12, shape: 'EW', heading: 1, angle: 1.23, aim: 1.23, brace: 0, reload: 0, move: null as any, operator: null, lease: 0 };
  world.artillery.push(gun); return { world, gun };
}
it.each(['CNE', 'CSE', 'CSW', 'CNW', 'J'])('routes every connected edge of compact %s in both directions', shape => {
  for (const port of railPorts({ shape })) {
    const { world, gun } = setup(shape), [dx, dy] = vectors[port];
    expect(driveCarriage(gun, dx, dy, world, [], [])).toBeNull();
    expect([gun.x, gun.y]).toEqual([12 + dx, 12 + dy]);
    tickCarriage(gun, 1.2); expect(gun.angle).toBeCloseTo(1.23);
    expect(driveCarriage(gun, -dx, -dy, world, [], [])).toBeNull(); tickCarriage(gun, 1.2);
    expect([gun.x, gun.y]).toEqual([12, 12]);
  }
});
it('joins straights, preserves exits and ownership, and reserves only one permanent corner tile', () => {
  const { world, gun } = setup(); world.artillery = []; world.rails = [{ x: 12, y: 12, shape: 'EW', owner: 'a' }];
  expect(joinedShape(world.rails[0], 'NS')).toBe('J'); expect(joinedShape({ shape: 'CNE' }, 'EW')).toBe('J');
  expect(railError(world, [], 12, 12, 'NS', 1, 'b')).toContain('owner');
  expect(railError(world, [], 12, 12, 'NS', 1, 'a')).toBeNull();
  world.artillery = [gun]; expect(railError(world, [], 12, 12, 'NS', 1, 'a')).toContain('clear');
  world.artillery = []; world.rails = [];
  expect(railSegment(12, 12, 'CNE', 5)).toHaveLength(1);
  world.terrain[10 * 48 + 10] = 3;
  expect(railError(world, [], 12, 12, 'CNE', 1)).toBeNull();
  world.rails.push({ x: 12, y: 12, shape: 'CNE', owner: 'a' });
  expect(railCorridor(world, 12, 12)).toBe(true); expect(railCorridor(world, 11, 12)).toBe(false);
});
it('requires reciprocal neighboring ports and blocks missing branches without leaving the tile', () => {
  const { world, gun } = setup('CNE');
  expect(driveCarriage(gun, -1, 0, world, [], [])).toContain('connected');
  world.rails.find(r => r.x === 12 && r.y === 11)!.shape = 'EW';
  expect(driveCarriage(gun, 0, -1, world, [], [])).toContain('connected');
  expect([gun.x, gun.y, gun.move]).toEqual([12, 12, null]);
  world.rails.find(r => r.x === 12 && r.y === 11)!.shape = 'CSW';
  expect(driveCarriage(gun, 0, -1, world, [], [])).toBeNull(); // Adjacent compact turns connect.
});
it('reserves swept turning clearance, preserves aim and resumes interpolation after serialization', () => {
  const { world, gun } = setup();
  expect(driveCarriage(gun, 0, -1, world, [{ x: 10, y: 10 }], [])).toContain('facility');
  expect(driveCarriage(gun, 0, -1, world, [], [{ x: 10.5, y: 10.5 }])).toContain('unit');
  world.artillery.push({ id: 'other', x: 9, y: 9 });
  expect(driveCarriage(gun, 0, -1, world, [], [])).toContain('carriage'); world.artillery.pop();
  expect(driveCarriage(gun, 0, -1, world, [], [])).toBeNull();
  expect(artilleryBlocks(world, 10, 10)).toBe(true);
  tickCarriage(gun, .6); const saved = JSON.parse(JSON.stringify(gun));
  expect(gunPosition(saved).chassis).toBeCloseTo(Math.PI / 4); expect(saved.angle).toBeCloseTo(1.23);
  expect(driveCarriage(gun, 1, 0, world, [], [])).toBeNull(); expect(gun.x).toBe(12);
  tickCarriage(saved, .6); expect(saved.move).toBeNull(); expect(gunPosition(saved).chassis).toBeCloseTo(Math.PI / 2);
});
it('rejects deployment on disconnected supporting corners', () => {
  const { world } = setup(); world.artillery = [];
  expect(carriageError(world, [], [], 11, 12, 'EW')).toBeNull();
  world.rails.find(r => r.x === 12 && r.y === 12)!.shape = 'CNE';
  expect(carriageError(world, [], [], 11, 12, 'EW')).toContain('connected');
});

it('reproduces the saved south turn without blocking or displacing Scout 02 beside the track', () => {
  const { world, gun } = setup();
  world.rails = world.rails.map(r => ({ ...r, x: r.x + 13, y: r.y + 1 }));
  Object.assign(gun, { x: 25, y: 13 });
  const scout = { name: 'Scout 02', x: 27.827, y: 16.5 };
  expect(canStand(world, [], scout.x, scout.y)).toBe(true);
  expect(driveCarriage(gun, 0, 1, world, [], [scout])).toBeNull();
  expect([gun.x, gun.y]).toEqual([25, 14]);
  for (let i = 0; i < 12; i++) { expect(canStand(world, [], scout.x, scout.y)).toBe(true); tickCarriage(gun, .1); }
});

it('blocks an actual swept-corner collision outside both endpoint footprints and names the unit', () => {
  const { world, gun } = setup();
  const scout = { name: 'Scout 02', x: 14.6, y: 13 };
  expect(carriageError({ ...world, artillery: [] }, [], [scout], 12, 12, 'EW', null, true)).toBeNull();
  expect(carriageError({ ...world, artillery: [] }, [], [scout], 12, 13, 'NS', null, true)).toBeNull();
  expect(driveCarriage(gun, 0, 1, world, [], [scout])).toContain('Scout 02 blocks the turn');
  expect(gun.move).toBeNull();
  expect(driveCarriage(gun, 0, 1, world, [], [])).toBeNull();
  expect(canStand(world, [], scout.x, scout.y)).toBe(false);
  const restored = JSON.parse(JSON.stringify(gun)); expect(compactTurnHits(restored, scout.x, scout.y)).toBe(true);
});

it.each([[1, 0], [-1, 0], [0, 1], [0, -1]])('checks rotating bodies consistently for travel %s,%s', (dx, dy) => {
  const { world, gun } = setup(); gun.shape = dx ? 'NS' : 'EW';
  expect(driveCarriage(gun, dx, dy, world, [], [])).toBeNull();
  // At half-turn the square reaches 2.12 tiles on either world axis.
  const x = 12.5 + dx * .5 + (dx ? 0 : 2.1), y = 12.5 + dy * .5 + (dy ? 0 : 2.1);
  expect(compactTurnHits(gun, x, y)).toBe(true);
  expect(compactTurnHits(gun, 15.4, 15.4)).toBe(false);
});
