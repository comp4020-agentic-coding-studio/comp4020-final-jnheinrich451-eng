import { expect, it } from 'vitest';
import { SCANNER, tickSensor, sensorContacts, sweptPulse, detectionFor } from '../public/sensors.js';
import { ALERT, tickSites } from '../public/conquest.js';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';

function setup() {
  const site: any = { id: 'crown', x: 30, y: 30, state: 'hostile', hp: 420, maxHp: 420, guardsRemaining: 3, nextCall: 0, alarmUntil: 0 };
  const world: any = { ...createWorld(), width: 80, height: 80, terrain: Array(6400).fill(2), sites: [site], tanks: [], ships: [], airbases: [], cores: [], artillery: [] };
  const player: any = { id: 'p', body: 'robot', life: 'active', shield: 0, health: 100, x: 31.5, y: 23.5 };
  const scan = (now: number, players = [player], buildings: any[] = []) => tickSensor(site, world, buildings, sensorContacts(world, players), now);
  const lock = () => { for (let t = 0; t <= 3000; t += 100) scan(t); expect(site.sensor.mode).toBe('tracking'); };
  return { site, world, player, scan, lock };
}

it('sweeps fast crossings and pulse resets; acquisition stays deterministic and stops radial search', () => {
  expect(sweptPulse({ x: -15, y: 0 }, { x: 15, y: 0 }, { x: 0, y: 0 }, 5, 6)).toBe(true);
  expect(sweptPulse({ x: -15, y: 10 }, { x: 15, y: 10 }, { x: 0, y: 0 }, 5, 6)).toBe(false);
  const { site, player, scan } = setup();
  const other = { ...player, id: 'z', x: 39.5, y: 31.5 };
  for (let t = 0; t <= 3000; t += 100) scan(t, [other, player]);
  expect(site.sensor.targetId).toBe('p'); expect(site.sensor.marks).toHaveLength(1);
  for (let t = 3100; t < 8000; t += 100) scan(t, [other, player]);
  expect(site.sensor.marks.map((m: any) => m.id)).toEqual(['p']);
  const reset = setup(); reset.scan(0, []); reset.scan(2900, []); reset.scan(3100, [{ ...player, y: 31.4 }]);
  expect(reset.site.sensor.marks).toHaveLength(1);
});

it('cover blocks the beam, leaves a fixed last-known point, and expires without omniscient following', () => {
  const { site, world, player, scan, lock } = setup(); lock();
  world.terrain[27 * world.width + 31] = 3;
  const saved = { ...site.sensor.marks[0] }; player.x = 32;
  scan(3100); expect(site.sensor.mode).toBe('lost'); expect(site.sensor.marks[0]).toEqual(saved);
  for (let t = 3200; t <= 11000; t += 100) scan(t);
  expect(site.sensor.mode).toBe('search'); expect(detectionFor([site], player.id, 11000)).toBeNull();
  // Biological circular search passes cover, but the focused beam cannot refresh it.
  for (let t = 11100; t <= 14000; t += 100) scan(t);
  expect(site.sensor.mode).toBe('lost'); expect(site.sensor.marks).toHaveLength(1);
});

it('solid buildings block tracking and finite rotation cannot snap to a sideways target', () => {
  const { site, player, scan, lock } = setup(); lock();
  scan(3100, [player], [{ x: 31, y: 27 }]); expect(site.sensor.mode).toBe('lost');
  scan(3200); expect(site.sensor.mode).toBe('tracking');
  player.x = 39.5; player.y = 31.5; scan(3300);
  expect(site.sensor.mode).toBe('lost'); expect(Math.abs(site.sensor.angle)).toBeLessThanOrEqual(SCANNER.speed * .1);
});

it('keeps marks through observed boarding, excludes orbital/protected contacts and preserves submerged escape', () => {
  const { site, world, player, scan, lock } = setup(); lock();
  world.tanks.push({ id: 'tank', occupant: player.id, x: player.x, y: player.y }); player.body = 'rover'; scan(3100);
  expect(site.sensor.marks).toHaveLength(1); expect(site.sensor.marks[0].targetId).toBe('vehicle:tank');
  world.tanks = []; player.body = 'robot'; scan(3200); expect(site.sensor.marks[0].targetId).toBe(player.id);
  expect(sensorContacts(world, [{ ...player, body: 'orbital' }, { ...player, deploying: true }, { ...player, shield: 5 }])).toEqual([]);
  world.ships.push({ id: 'sub', kind: 'submarine', occupant: player.id, x: player.x, y: player.y, depth: 'diving' });
  scan(3300); expect(site.sensor.mode).toBe('tracking'); expect(site.sensor.marks[0].ground).toBe(false);
  world.ships[0].depth = 'submerged'; scan(3400); expect(site.sensor.mode).toBe('lost');
  scan(11400); expect(site.sensor.marks).toHaveLength(0);
});

it('aircraft/surface contacts can be marked without waking melee reinforcements', () => {
  const { site, world, player } = setup(); player.body = 'aircraft';
  const enemies: any[] = []; let serial = 0;
  for (let now = 0; now <= 20000; now += 100) tickSites([site], world, [], [player], enemies, now, () => ++serial);
  expect(site.sensor.mode).toBe('tracking'); expect(site.sensor.marks[0].ground).toBe(false);
  expect(enemies).toEqual([]); expect(site.pending).toBeUndefined();
});

it('save/reload preserves lock and pending arrivals with no offline catch-up; destruction stops refresh/calls', () => {
  const { world, site, player } = setup(); const combat = createCombat(world);
  for (let i = 0; i < 22; i++) combat.tick(.1, [], [player]);
  expect(site.pending).toBeTruthy(); expect(site.sensor.marks).toHaveLength(1);
  const saved = combat.checkpoint(), restoredWorld = structuredClone(world), restored = createCombat(restoredWorld, saved);
  expect(restored.checkpoint()).toEqual(saved);
  for (let i = 0; i < 10; i++) { combat.tick(.1, [], [player]); restored.tick(.1, [], [structuredClone(player)]); }
  expect(restored.checkpoint()).toEqual(combat.checkpoint());
  const ruin = restoredWorld.sites[0]; ruin.state = 'conquered'; ruin.hp = 0;
  const until = ruin.sensor.marks[0].until; restored.tick(.1, [], [player]);
  expect(ruin.pending).toBeNull(); expect(ruin.sensor.mode).toBe('silent'); expect(ruin.sensor.marks[0].until).toBe(until);
  for (let i = 0; i < 90; i++) restored.tick(.1, [], []);
  expect(ruin.sensor.marks).toEqual([]); expect(ruin.pending).toBeNull();
});

it('defenders investigate the report outside local sensing, then give up a distant escaped target', () => {
  const { world, site, player } = setup(); site.guardsRemaining = 0; site.nextCall = 1e9;
  const saved = createCombat(world).checkpoint();
  saved.enemies = [{ id: 1, siteId: site.id, homeX: 37, homeY: 36, x: 37, y: 36, hp: 17, angle: 0, path: [], reroute: 0 }];
  const combat = createCombat(world, saved);
  for (let i = 0; i < 60; i++) combat.tick(.1, [], [player]);
  const chasing = combat.snapshot().enemies[0]; expect(chasing.targetId).toBe(player.id);
  expect(Math.hypot(chasing.x - player.x, chasing.y - player.y)).toBeLessThan(Math.hypot(37 - player.x, 36 - player.y));
  player.x = 70; player.y = 70;
  for (let i = 0; i < 200; i++) combat.tick(.1, [], [player]);
  const returned = combat.snapshot().enemies[0]; expect(returned.targetId).toBeNull(); expect(returned.hp).toBe(17);
  expect(Math.hypot(returned.x - 37, returned.y - 36)).toBeLessThan(2);
});

it('reserves global population for simultaneous sites and cancels unsafe warned arrivals', () => {
  const { world, site, player } = setup(); const second = { ...site, id: 'second', x: 50 };
  world.sites.push(second); const enemies: any[] = Array.from({ length: ALERT.globalMax - 4 }, (_, i) => ({ id: i, hp: 60, x: 5, y: 5 }));
  let serial = 100; const people = [player, { ...player, id: 'b', x: 51.5 }];
  tickSites(world.sites, world, [], people, enemies, 0, () => ++serial);
  expect(world.sites.reduce((n: number, s: any) => n + s.pending.points.length, enemies.length)).toBe(ALERT.globalMax);
  const unsafe = site.pending.points[0]; world.tanks.push({ id: 'parked', ...unsafe });
  tickSites(world.sites, world, [], people, enemies, ALERT.warning, () => ++serial);
  expect(enemies.length).toBeLessThanOrEqual(ALERT.globalMax);
  expect(enemies.some(e => e.x === unsafe.x && e.y === unsafe.y)).toBe(false);
});

it('records transitions and safe arrival outcomes, not sensing ticks or private player fields', () => {
  const { world, player } = setup(); player.token = 'private-credential';
  const combat = createCombat(world, null, () => ({}));
  for (let i = 0; i < 60; i++) combat.tick(.1, [], [player]);
  const events = combat.drainEvents();
  expect(events).toContainEqual(expect.objectContaining({ event: 'sensor.changed', cause: 'tracking', targetId: player.id }));
  expect(events).toContainEqual(expect.objectContaining({ event: 'reinforcement.changed', count: 3 }));
  expect(events.length).toBeLessThan(10);
  expect(JSON.stringify([combat.checkpoint(), combat.snapshot(), events])).not.toContain('private-credential');
});
