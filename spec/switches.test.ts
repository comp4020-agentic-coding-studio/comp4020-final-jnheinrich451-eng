import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { curveEnds, curveBounds } from '../public/track.js';
import { railSegment, moveCarriage, tickCarriage } from '../public/rail.js';
import { switchLocked, switchConnectionError } from '../public/switches.js';

function setup(shape = 'NE') {
  const curve = { x: 12, y: 12, shape }, [a, b] = curveEnds(curve);
  const all = [...railSegment(a.x, a.y, a.shape, 9), ...railSegment(b.x, b.y, b.shape, 5), curve];
  const world = { ...createWorld(), terrain: Array(48 * 36).fill(2), rails: [...new Map(all.map(r => [r.x + ':' + r.y, r])).values()], switches: [{ x: 12, y: 12, route: 'curve' }], artillery: [] as any[] };
  const gun = { id: 'g', x: a.x, y: a.y, shape: a.shape, heading: a.dx || a.dy, angle: 1.2, aim: 1.2, elevation: 75, reload: 0, brace: 0, move: null as any, operator: null, lease: 0 };
  world.artillery.push(gun); return { world, curve, a, b, gun };
}

it.each(['NE', 'SE', 'SW', 'NW'])('selects straight or curve for %s, gates reverse legs and preserves independent aim', shape => {
  const { world, curve, a, b, gun } = setup(shape);
  expect(switchConnectionError(world, curve, 'curve')).toBeNull(); expect(switchConnectionError(world, curve, 'straight')).toBeNull();
  const angle = gun.angle;
  expect(moveCarriage(gun, 1, world, [], [])).toBeNull(); expect(gun.move.curve.shape).toBe(shape); expect(switchLocked(world, curve)).toBe(true);
  const saved = JSON.parse(JSON.stringify(gun)); expect(switchLocked({ ...world, artillery: [saved] }, curve)).toBe(true);
  tickCarriage(gun, gun.move.duration); expect([gun.x, gun.y]).toEqual([b.x, b.y]); expect(gun.angle).toBeCloseTo(angle);
  expect(moveCarriage(gun, -1, world, [], [])).toBeNull(); tickCarriage(gun, gun.move.duration);
  world.switches[0].route = 'straight';
  expect(moveCarriage(gun, 1, world, [], [])).toBeNull(); expect(gun.move.curve).toBeUndefined();
  tickCarriage(gun, 1.2); expect([gun.x, gun.y]).toEqual([a.x + a.dx, a.y + a.dy]);
  world.switches[0].route = 'curve'; expect(moveCarriage(gun, -1, world, [], [])).toContain('Select straight');
  Object.assign(gun, { x: b.x, y: b.y, shape: b.shape, heading: b.dx || b.dy }); world.switches[0].route = 'straight';
  expect(moveCarriage(gun, -1, world, [], [])).toContain('curved route');
});

it('locks for an entire body or saved reservation, unlocks only after clearance, and validates missing exits', () => {
  const { world, curve, a, gun } = setup(), bounds = curveBounds(curve);
  Object.assign(gun, { x: bounds.minX - 1, y: bounds.minY }); expect(switchLocked(world, curve)).toBe(true);
  gun.x--; expect(switchLocked(world, curve)).toBe(false);
  gun.move = { fromX: bounds.minX, fromY: bounds.minY, elapsed: .3 }; expect(switchLocked(world, curve)).toBe(true);
  gun.move = null;
  world.rails = world.rails.filter(r => r.x !== a.x + a.dx * 2 || r.y !== a.y + a.dy * 2);
  expect(switchConnectionError(world, curve, 'straight')).toContain('support');
  expect(switchConnectionError(world, curve, 'curve')).toBeNull();
  expect(switchConnectionError(world, curve, 'bad')).toContain('Choose');
});
