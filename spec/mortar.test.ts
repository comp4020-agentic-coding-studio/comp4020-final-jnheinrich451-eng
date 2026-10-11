import { expect, it } from 'vitest';
import { MORTAR, tickMortars, acidDamage } from '../public/mortar.js';
import { seedConquest, tickSites, ALERT } from '../public/conquest.js';
import { createWorld, canStand } from '../public/world.js';
import { createCombat } from '../public/combat.js';

function setup() {
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), tanks: [], ships: [], cores: [], rails: [], artillery: [], airbases: [], sites: [] };
  world.sites = seedConquest(world, [], [], 'mortar');
  const site = world.sites[0], robot: any = { id: 'p', x: site.x + 1.5, y: site.y - 6.5, body: 'robot', life: 'active', health: 100, shield: 0 };
  site.guardsRemaining = 0;
  let now = 0, serial = 0; const shells: any[] = [], events: any[] = [];
  const step = (seconds: number, people = [robot]) => { for (let i = 0; i < seconds * 10; i++) { now += 100; tickMortars(world, people, shells, now, .1, () => ++serial, (e: any) => events.push(e)); } };
  return { world, site, robot, shells, events, step };
}

it('warns at a fixed point before launch, allows dodging, and limits firing cadence', () => {
  const { site, robot, shells, events, step } = setup(); step(.1);
  expect(site.mortar.charge).toMatchObject({ x: robot.x, y: robot.y });
  const point = { x: robot.x, y: robot.y }; robot.x += 5; step(.8);
  expect(shells).toHaveLength(1); expect(shells[0]).toMatchObject(point);
  step(3); expect(robot.health).toBe(100); expect(events.filter(e => e.event === 'enemy.weapon.launched')).toHaveLength(1);
  step(4); const launches = events.filter(e => e.event === 'enemy.weapon.launched'); expect(launches).toHaveLength(2);
});

it('applies one blast per robot or tank, with no separate direct-hit bonus or crew double hit', () => {
  const { world, site, robot, shells, step } = setup();
  world.tanks.push({ id: 'tank', x: robot.x, y: robot.y, health: 200, elapsed: 99, occupant: robot.id });
  const friend = { ...robot, id: 'friend' };
  step(3.1, [robot, friend]); expect(shells[0].impacted).toBe(true);
  expect(world.tanks[0].health).toBe(160); expect(friend.health).toBe(60); expect(robot.health).toBe(100);
  site.state = 'conquered'; step(1, [robot, friend]);
  expect(world.tanks[0].health).toBe(160); expect(friend.health).toBe(60);
  expect(acidDamage(MORTAR.radius)).toBe(12); expect(acidDamage(MORTAR.radius + .01)).toBe(0);
});

it('respects minimum/maximum range, protected bodies, slow traverse and target retention', () => {
  const { site, robot, step, shells } = setup();
  const origin = { x: site.x + 1.5, y: site.y + 1.5 };
  for (const p of [{ ...robot, shield: 1 }, { ...robot, deploying: true }, { ...robot, body: 'orbital' }, { ...robot, body: 'aircraft' }, { ...robot, body: 'ship' }, { ...robot, y: origin.y - 2 }, { ...robot, y: origin.y - 23 }]) step(1, [p]);
  expect(shells).toEqual([]); expect(site.mortar.charge).toBeNull();
  robot.x = origin.x + 12; robot.y = origin.y; step(.1);
  expect(site.mortar.angle).toBeCloseTo(MORTAR.speed * .1); expect(site.mortar.charge).toBeNull();
  const closer = { ...robot, id: 'closer', x: origin.x + 6 };
  step(1, [closer, robot]); expect(site.mortar.targetId).toBe(robot.id);
});

it('rechecks protection on impact, ignores ships/facilities and never attacks incoming tank pods', () => {
  const { world, robot, step } = setup(); step(1); robot.shield = 1;
  world.tanks.push({ id: 'pod', x: robot.x, y: robot.y, health: 200, elapsed: 0 });
  world.ships.push({ id: 'boat', x: robot.x, y: robot.y, health: 300, elapsed: 99 });
  step(3); expect(robot.health).toBe(100); expect(world.tanks[0].health).toBe(200); expect(world.ships[0].health).toBe(300);
});

it('saves windup and flight, cancels unfired attacks on conquest, and lands accepted shells once', () => {
  const { world, site, robot } = setup(); const combat = createCombat(world); combat.tick(.1, [], [robot]);
  expect(site.mortar.charge).toBeTruthy();
  const restored = createCombat(structuredClone(world), combat.checkpoint());
  for (let i = 0; i < 10; i++) restored.tick(.1, [], [robot]);
  expect(restored.snapshot().acidShells).toHaveLength(1);
  const saved = restored.checkpoint(); saved.sites[0].state = 'conquered'; saved.sites[0].hp = 0;
  const deadWorld = structuredClone(world), resume = createCombat(deadWorld, saved);
  for (let i = 0; i < 30; i++) resume.tick(.1, [], [robot]);
  expect(robot.health).toBe(60); expect(resume.snapshot().acidShells).toHaveLength(0);
  const again = createCombat(structuredClone(world), resume.checkpoint());
  for (let i = 0; i < 40; i++) again.tick(.1, [], [robot]); expect(robot.health).toBe(60);
  const windupSave = combat.checkpoint(); windupSave.sites[0].state = 'conquered';
  const canceled = createCombat(structuredClone(world), windupSave);
  for (let i = 0; i < 40; i++) canceled.tick(.1, [], [robot]);
  expect(canceled.snapshot().acidShells).toHaveLength(0);
});

it('adds only two guards once, never gains a scanner or reinforcement waves, and shares the enemy cap', () => {
  const { world, site, robot } = setup(); site.guardsRemaining = MORTAR.guards;
  const enemies: any[] = []; let serial = 0;
  for (let now = 0; now <= 60000; now += 100) tickSites(world.sites, world, [], [robot, robot], enemies, now, () => ++serial);
  expect(enemies).toHaveLength(2); expect(site.sensor).toBeUndefined();
  enemies.length = 0; site.alarmUntil = 180000;
  for (let now = 60100; now <= 120000; now += 100) tickSites(world.sites, world, [], [robot], enemies, now, () => ++serial);
  expect(enemies).toEqual([]); expect(site.pending).toBeNull();
  site.guardsRemaining = 2; enemies.push(...Array.from({ length: ALERT.globalMax }, (_, id) => ({ id, hp: 60, x: 1, y: 1 })));
  tickSites(world.sites, world, [], [robot], enemies, 130000, () => ++serial); expect(site.pending).toBeNull();
});

it('preserves other objectives and equipment when choosing a site; HE conquest stays permanent', () => {
  const { world, site } = setup(); world.sites = seedConquest(world, [], []);
  const alert = world.sites[0], buildings = [{ x: site.x, y: site.y }], oldTerrain = [...world.terrain];
  const outpost = seedConquest(world, buildings, [], 'mortar')[0];
  expect(Math.hypot(outpost.x - alert.x, outpost.y - alert.y)).toBeGreaterThanOrEqual(30);
  expect(Math.hypot(outpost.x - site.x, outpost.y - site.y)).toBeGreaterThan(22);
  expect(world.terrain).toEqual(oldTerrain);
  world.sites = [site]; site.hp = 75; const combat = createCombat(world);
  expect(combat.shoot({ id: 'tank', x: site.x - 3, y: site.y + 1.5 }, site.x + 1.5, site.y + 1.5, 'HE')).toBeNull();
  for (let i = 0; i < 10; i++) combat.tick(.1, []);
  expect(site.state).toBe('conquered'); expect(canStand(world, [], site.x + 1.5, site.y + 1.5)).toBe(true);
  expect(createCombat(structuredClone(world), combat.checkpoint()).snapshot().sites[0].state).toBe('conquered');
});

it('bounds airborne shells across outposts even when several windups finish together', () => {
  const { world, site, robot, shells, step } = setup();
  world.sites = Array.from({ length: 12 }, (_, id) => ({ ...site, id: 'mortar-' + id, mortar: { angle: 0, nextShot: 0, charge: { x: robot.x, y: robot.y, at: 0, fireAt: 100 } } }));
  step(.1); expect(shells).toHaveLength(MORTAR.maxShells);
});
