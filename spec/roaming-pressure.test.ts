import { expect, it, vi } from 'vitest';
import { createPlanet } from '../public/planet-templates.js';
import { islandAt } from '../public/island-pressure.js';
import { planRoaming, roamingPointClear } from '../public/roaming-pressure.js';
import { canStand } from '../public/world.js';

const focus = () => ({ id: 'pilot', targetId: 'pilot', x: 60.5, y: 60.5, ground: true, medium: 'ground' });
function field(): any {
  return { width: 140, height: 140, terrain: Array(140 * 140).fill(2), waterKinds: Array(140 * 140).fill(0),
    sites: [{ id: 'remote-city', kind: 'modifier', x: 110, y: 110, hp: 500, state: 'hostile' }],
    tanks: [], ships: [], cores: [], airbases: [], artillery: [], logistics: { facilities: [], recyclers: [] } };
}
const firstPoint = { x: 87.5, y: 60.5 };

it.each(['caldera-v1', 'vesper-v1'])('plans repeatable sparse natural-land approaches on %s without changing terrain or participants', template => {
  const world: any = createPlanet(template), p = { ...focus(), ...(template === 'caldera-v1' ? { x: 220.5, y: 90.5 } : { x: 72.5, y: 80.5 }) };
  const source = { id: 'living-city', kind: 'modifier', x: template === 'caldera-v1' ? 260 : 110, y: template === 'caldera-v1' ? 100 : 60, hp: 500, state: 'hostile' };
  world.sites = [source];
  const before = JSON.stringify({ world, p, source }), plan = planRoaming(world, [], [p], [], p, source, .13)!;
  expect(plan).not.toBeNull(); expect(plan.points.length).toBeGreaterThanOrEqual(1); expect(plan.points.length).toBeLessThanOrEqual(2);
  expect(plan).toEqual(planRoaming(world, [], [p], [], p, source, .13));
  expect(Math.hypot(plan.origin.x - p.x, plan.origin.y - p.y)).toBeGreaterThanOrEqual(22 - 1e-8);
  expect(Math.hypot(plan.origin.x - p.x, plan.origin.y - p.y)).toBeLessThanOrEqual(26 + 1e-8);
  const ring = Array.from({ length: 16 }, (_, i) => ({ x: Math.floor(plan.origin.x + Math.cos(i * Math.PI / 8) * 5) + .5,
    y: Math.floor(plan.origin.y + Math.sin(i * Math.PI / 8) * 5) + .5 }));
  for (const point of plan.points) {
    expect(point).toMatchObject({ kind: 'hunter', siteId: source.id }); expect(ring).toContainEqual({ x: point.x, y: point.y });
    expect(canStand(world, [], point.x, point.y)).toBe(true);
    expect(islandAt(world, point.x, point.y)).toBe(islandAt(world, p.x, p.y));
    expect(roamingPointClear(world, [], [p], [], point, plan.focus, source)).toBe(true);
  }
  expect(JSON.stringify({ world, p, source })).toBe(before);
  p.x += 3; expect(plan.focus.x).not.toBe(p.x); // The investigation keeps the old location.
});

it('reserves all teammate positions including aircraft, and cancels a warning when someone approaches', () => {
  const world = field(), p = focus(), source = world.sites[0], first = planRoaming(world, [], [p], [], p, source, 0)!;
  const aircraft = { id: 'wingmate', x: first.points[0].x, y: first.points[0].y, medium: 'air', ground: false };
  expect(roamingPointClear(world, [], [p, aircraft], [], first.points[0], first.focus, source)).toBe(false);
  const revised = planRoaming(world, [], [p, aircraft], [], p, source, 0)!;
  expect(revised).not.toBeNull();
  for (const point of revised.points) for (const player of [p, aircraft]) expect(Math.hypot(point.x - player.x, point.y - player.y)).toBeGreaterThanOrEqual(12);
  expect(planRoaming(world, [], [aircraft], [], aircraft, source, 0)).toBeNull();
});

it('keeps recovery assets, vehicles, machinery, fire and living enemies clear at warning and arrival time', () => {
  const world = field(), p = focus(), source = world.sites[0];
  const clear = (buildings: any[] = [], enemies: any[] = [], blocked = () => false) =>
    roamingPointClear(world, buildings, [p], enemies, firstPoint, p, source, blocked);
  expect(clear()).toBe(true);
  world.cores.push({ id: 'core', x: 95, y: 59, elapsed: 100, health: 500 }); expect(clear()).toBe(false); world.cores = [];
  world.logistics.facilities.push({ id: 'outpost', kind: 'outpost', x: 95, y: 59, hp: 250, remaining: 0 }); expect(clear()).toBe(false); world.logistics.facilities = [];
  world.tanks.push({ id: 'tank', x: 90.5, y: 60.5, elapsed: 100, hp: 300 }); expect(clear()).toBe(false); world.tanks = [];
  world.logistics.recyclers.push({ id: 'truck', x: 90.5, y: 60.5, hp: 160 }); expect(clear()).toBe(false); world.logistics.recyclers = [];
  expect(clear([{ x: 90, y: 60 }])).toBe(false);
  expect(clear([], [{ x: 88.5, y: 60.5, hp: 12 }])).toBe(false);
  expect(clear([], [{ x: 88.5, y: 60.5, hp: 0 }])).toBe(true);
  expect(clear([], [], () => true)).toBe(false);
  // New machinery or fire across the approach also invalidates an existing warning.
  expect(clear([{ x: 75, y: 60 }])).toBe(false);
  expect(clear([], [], ((x: number) => x === 75) as any)).toBe(false);
});

it('requires a real living same-island source, and never adds roaming pressure beside a hostile facility', () => {
  const world = field(), p = focus(), source = world.sites[0];
  const plan = (s = source) => planRoaming(world, [], [p], [], p, s, 0);
  expect(plan()).not.toBeNull(); expect(plan({ ...source, id: 'invented' })).toBeNull();
  source.state = 'conquered'; expect(plan()).toBeNull(); source.state = 'hostile';
  source.hp = 0; expect(plan()).toBeNull(); source.hp = 500;
  source.kind = 'aquatic-hive'; expect(plan()).toBeNull(); source.kind = 'modifier';
  world.sites.push({ id: 'nearby', kind: 'alert', x: 80, y: 60, hp: 100, state: 'hostile' }); expect(plan()).toBeNull();
  world.sites.pop();
  // Fresh immutable geography: a one-tile ocean channel is a separate island.
  const divided = field();
  for (let y = 0; y < divided.height; y++) { divided.terrain[y * divided.width + 90] = 0; divided.waterKinds[y * divided.width + 90] = 1; }
  expect(planRoaming(divided, [], [p], [], p, divided.sites[0], 0)).toBeNull();
  expect(planRoaming(world, [], [p], [], p, source, Number.NaN)).toBeNull();
});

it('rejects unbridged rivers and mountain walls even when both ends belong to the same continent', () => {
  const world = field(), p = focus(), source = world.sites[0];
  for (let y = 0; y < world.height; y++) { world.terrain[y * world.width + 75] = 0; world.waterKinds[y * world.width + 75] = 2; }
  expect(islandAt(world, firstPoint.x, firstPoint.y)).toBe(islandAt(world, p.x, p.y));
  expect(roamingPointClear(world, [], [p], [], firstPoint, p, source)).toBe(false);
  const alternative = planRoaming(world, [], [p], [], p, source, 0)!;
  expect(alternative).not.toBeNull(); expect(alternative.points.every(point => point.x < 75)).toBe(true);
  world.bridges = [{ x: 75, y: 60 }];
  expect(roamingPointClear(world, [], [p], [], firstPoint, p, source)).toBe(true);
  // Bridge decking itself is never a natural arrival point.
  expect(roamingPointClear(world, [], [p], [], { x: 75.5, y: 60.5 }, p, source)).toBe(false);
  const ridge = field(); ridge.mountains = Array(ridge.terrain.length).fill(0);
  for (let y = 0; y < ridge.height; y++) ridge.mountains[y * ridge.width + 75] = 2;
  expect(roamingPointClear(ridge, [], [p], [], firstPoint, p, ridge.sites[0])).toBe(false);
});

it('can investigate an occupied ground vehicle without allowing blocked terrain at the focus', () => {
  const world = field(), p = focus(), source = world.sites[0];
  world.tanks.push({ id: 'occupied', occupant: p.id, x: p.x, y: p.y, elapsed: 100, hp: 300 });
  expect(canStand(world, [], p.x, p.y)).toBe(false);
  expect(roamingPointClear(world, [], [p], [], firstPoint, p, source)).toBe(true);
  world.mountains = Array(world.terrain.length).fill(0); world.mountains[60 * world.width + 60] = 3;
  expect(roamingPointClear(world, [], [p], [], firstPoint, p, source)).toBe(false);
});

it('defers impossible approaches with a fixed candidate and corridor budget', () => {
  const world = field(), p = focus(), source = world.sites[0], allBlocked = vi.fn(() => true);
  expect(planRoaming(world, [], [p], [], p, source, 0, allBlocked)).toBeNull();
  expect(allBlocked.mock.calls.length).toBeLessThanOrEqual(16 * 16);
  // A mountain ring traps the focus. Nearby arrivals are open but cannot reach it.
  world.mountains = Array(world.terrain.length).fill(0);
  for (let y = 45; y <= 75; y++) for (let x = 45; x <= 75; x++) {
    const radius = Math.hypot(x + .5 - p.x, y + .5 - p.y);
    if (radius >= 8 && radius <= 11) world.mountains[y * world.width + x] = 2;
  }
  const probe = vi.fn(() => false);
  expect(planRoaming(world, [], [p], [], p, source, 0, probe)).toBeNull();
  expect(probe.mock.calls.length).toBeLessThanOrEqual(16 * 16 * 44);
});
