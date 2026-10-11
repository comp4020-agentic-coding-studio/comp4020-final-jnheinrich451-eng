import { expect, it } from 'vitest';
import { LASER, tickLasers } from '../public/laser-tower.js';
import { makeSite, damageSites, seedConquest } from '../public/conquest.js';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { SPEED } from '../public/world.js';
import { TANK } from '../public/tank.js';

function setup() {
  const site: any = makeSite('laser', 'lance', 40, 40); site.guardsRemaining = 0;
  const world: any = { ...createWorld(), width: 128, height: 96, terrain: Array(128 * 96).fill(2), sites: [site], tanks: [], cores: [], ships: [], artillery: [], airbases: [] };
  const robot: any = { id: 'p', x: 41.5, y: 34.5, body: 'robot', life: 'active', health: 100, shield: 0 };
  const events: any[] = [];
  const step = (seconds: number, people = [robot], buildings: any[] = []) => {
    for (let i = 0; i < Math.round(seconds * 20); i++) tickLasers(world, buildings, people, .05, (e: any) => events.push(e));
  };
  return { site, world, robot, step, events };
}

it('holds a warning bearing, hits a stationary target for two seconds, then cools for five', () => {
  const { site, robot, step, events } = setup(); step(.05);
  expect(site.laser.phase).toBe('charging'); expect(robot.health).toBe(100);
  step(1); expect(site.laser.phase).toBe('firing'); expect(robot.health).toBe(100);
  step(2); expect(robot.health).toBeCloseTo(100 - 2 * LASER.robotDps); expect(site.laser.phase).toBe('cooling');
  expect(events.filter(e => e.event === 'enemy.weapon.hit')).toHaveLength(1);
  const hp = robot.health; step(5); expect(robot.health).toBe(hp); expect(site.laser.phase).toBe('watching');
});

it('rotates slowly and damages the actual beam, allowing lateral escape', () => {
  const { site, robot, step } = setup(); step(1.05);
  robot.x += 5; step(.1);
  expect(site.laser.angle).toBeGreaterThan(0); expect(site.laser.angle).toBeLessThanOrEqual(LASER.speed * .1);
  expect(robot.health).toBe(100); expect(site.laser.beam.x).not.toBeCloseTo(robot.x);
});

it('acquires close contacts only, retains visible distant contacts, and forgets behind cover', () => {
  const { site, world, robot, step } = setup(); robot.y = 20; step(1);
  expect(site.laser.targetId).toBeNull(); robot.y = 34.5; step(.05);
  robot.y = 5; step(.05); expect(site.laser.targetId).toBe('p');
  for (let x = 40; x < 49; x++) world.terrain[30 * 128 + x] = 3; step(.5);
  expect(site.laser.last.y).toBe(5); robot.x += 5; step(.5); expect(site.laser.last.x).toBe(41.5);
  step(1.1); expect(site.laser.targetId).toBeNull(); expect(robot.health).toBe(100);
  for (let x = 40; x < 49; x++) world.terrain[30 * 128 + x] = 2; robot.x = 41.5; robot.y = 34.5;
  step(.05, [robot], [{ x: 41, y: 37 }]); expect(site.laser.targetId).toBeNull();
});

it('hits a tank once without hurting its crew; protected and non-ground bodies are excluded', () => {
  const { world, robot, step, site } = setup();
  world.tanks.push({ id: 't', occupant: 'p', x: robot.x, y: robot.y, health: 200, elapsed: 99 });
  step(1.05);
  step(.05); expect(world.tanks[0].health).toBeCloseTo(200 - .05 * LASER.tankDps); expect(robot.health).toBe(100);
  world.tanks.length = 0; delete site.laser;
  for (const body of ['orbital', 'rover', 'ship', 'aircraft']) step(1, [{ ...robot, body }]);
  step(1, [{ ...robot, shield: 1 }]); step(1, [{ ...robot, deploying: true }]);
  expect(site.laser.targetId).toBeNull(); expect(robot.health).toBe(100);
});

it.each(['robot', 'tank'])('lets a moving %s evade sideways in open ground, near and far', kind => {
  for (const range of [7, 30]) {
    const { world, site, robot, step } = setup();
    robot.y = site.y + 1.5 - range;
    const body = kind === 'tank' ? { id: 't', occupant: robot.id, x: robot.x, y: robot.y, health: 200, elapsed: 99 } : robot;
    if (kind === 'tank') world.tanks.push(body);
    // Simulate an already acquired contact walking out to the retained range.
    site.laser = { angle: 0, phase: 'watching', remaining: 0, targetId: kind === 'tank' ? 'vehicle:t' : robot.id, lost: 0, beam: null, hitIds: [] };
    step(.05); expect(site.laser.phase).toBe('charging');
    const warning = site.laser.angle, hp = body.health, speed = kind === 'tank' ? TANK.speed : SPEED;
    for (let i = 0; i < 60; i++) {
      body.x += speed * .05;
      const before = site.laser.angle, firing = site.laser.phase === 'firing';
      step(.05);
      if (firing) expect(Math.abs(site.laser.angle - before)).toBeLessThanOrEqual(LASER.trackingSpeed * .05 + 1e-8);
      if (site.laser.phase === 'charging') expect(site.laser.angle).toBe(warning);
    }
    expect(body.health).toBe(hp); expect(site.laser.targetId).not.toBeNull();
  }
});

it('keeps the saved bearing and timers while discarding obsolete endpoint state', () => {
  const { world, site, robot, step } = setup(); step(1.4);
  site.laser.chase = { x: robot.x + 2, y: robot.y + 2 };
  const saved = structuredClone(world), angle = site.laser.angle, remaining = site.laser.remaining;
  tickLasers(saved, [], [robot], .05);
  expect(saved.sites[0].laser.chase).toBeUndefined();
  expect(saved.sites[0].laser.angle).toBe(angle);
  expect(saved.sites[0].laser.remaining).toBeCloseTo(remaining - .05);
});

it('projects a missed beam to full range, blocks at cover, and can hit a radial runner', () => {
  const { world, site, robot, step } = setup(); step(1.05);
  robot.x += 5; step(.05);
  expect(Math.hypot(site.laser.beam.x - 41.5, site.laser.beam.y - 41.5)).toBeCloseTo(LASER.range);
  expect(robot.health).toBe(100);
  world.terrain[37 * 128 + 41] = 3; step(.05);
  expect(site.laser.beam.y).toBeCloseTo(38); expect(robot.health).toBe(100);
  world.terrain[37 * 128 + 41] = 2;
  robot.x = 41.5; robot.y -= SPEED * .05; step(.05);
  expect(robot.health).toBeLessThan(100);
});

it('persists an in-progress burst and permanently stops damage when HE conquers the tower', () => {
  const { world, robot, site } = setup(), combat = createCombat(world);
  for (let i = 0; i < 26; i++) combat.tick(.05, [], [robot]);
  expect(site.laser.phase).toBe('firing');
  const checkpoint = structuredClone(combat.checkpoint()), restored = createCombat(structuredClone(world), checkpoint);
  expect(restored.snapshot().sites[0].laser).toEqual(site.laser);
  const sites = checkpoint.sites;
  damageSites(sites, 41.5, 41.5, {}, checkpoint.now, () => 600);
  expect(sites[0].laser.beam).toBeNull();
  const dead = createCombat(structuredClone(world), checkpoint), hp = robot.health;
  for (let i = 0; i < 200; i++) dead.tick(.05, [], [robot]);
  expect(robot.health).toBe(hp); expect(dead.snapshot().sites[0].state).toBe('conquered');
});

it('places away from fog and player construction, and leaves a crowded save untouched', () => {
  const { world } = setup(); world.sites = [makeSite('contaminator', 'fog', 80, 48)];
  const result = seedConquest(world, [], [], 'laser'); expect(result).toHaveLength(1);
  expect(Math.hypot(result[0].x - 80, result[0].y - 48)).toBeGreaterThanOrEqual(27);
  world.terrain.fill(3); const before = JSON.stringify(world);
  expect(seedConquest(world, [], [], 'laser')).toEqual([]); expect(JSON.stringify(world)).toBe(before);
});
