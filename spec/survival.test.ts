import { expect, it } from 'vitest';
import { createWorld, canStand } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { freshLife, hurtRobot, recoveryPoint, beginRecovery, tickLife, SURVIVAL } from '../public/survival.js';

const field = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), cores: [{ id: 'friend', owner: 'other', x: 29, y: 13, elapsed: 4.5 }] });
const robot = (x = 24.5, y = 11) => ({ id: 'robot', x, y, ...freshLife(), path: [], inputUntil: 100, vx: 1, vy: 0 });

it('telegraphs robot strikes, applies one hit, and lets the target dodge the locked area', () => {
  const world = field(), combat = createCombat(world); combat.start([]);
  const enemy = combat.snapshot().enemies[0], p = robot(enemy.x, enemy.y + .6);
  combat.tick(.1, [], [p]);
  expect(combat.snapshot().enemies[0].attack?.targetId).toBe(p.id); expect(p.health).toBe(100);
  for (let i = 0; i < 6; i++) combat.tick(.1, [], [p]);
  expect(p.health).toBe(100);
  combat.tick(.1, [], [p]); expect(p.health).toBe(75); expect(p.hurt).toBe(1);
  combat.tick(.1, [], [p]); expect(p.health).toBe(75);
  const dodged = createCombat(world); dodged.start([]); const runner = robot(enemy.x, enemy.y + .6);
  dodged.tick(.1, [], [runner]); runner.x += 3;
  for (let i = 0; i < 8; i++) dodged.tick(.1, [], [runner]);
  expect(runner.health).toBe(100);
});

it('burn panic cancels a pending strike, while walls and spawn shields prevent damage', () => {
  const world = field(), combat = createCombat(world); combat.start([]);
  const enemy = combat.snapshot().enemies[0], p = robot(enemy.x, enemy.y + .6);
  combat.tick(.1, [], [p]);
  combat.shoot({ id: 'rescuer', x: enemy.x, y: enemy.y + 2, turret: 0 }, enemy.x, enemy.y, 'LASER');
  for (let i = 0; i < 8; i++) combat.tick(.1, [], [p]);
  expect(p.health).toBe(100); expect(combat.snapshot().enemies[0].attack).toBeNull();
  const shielded = robot(); shielded.shield = 2; expect(hurtRobot(shielded, 100)).toBe(false);
  const blockedWorld = field(), blocked = createCombat(blockedWorld); blocked.start([]);
  const e = blocked.snapshot().enemies[0], behind = robot(e.x + 1, e.y);
  blocked.tick(.1, [], [behind]);
  blockedWorld.terrain[Math.floor(e.y) * blockedWorld.width + Math.floor(e.x + 1)] = 3;
  for (let i = 0; i < 8; i++) blocked.tick(.1, [], [behind]);
  expect(behind.health).toBe(100);
});

it('disables a body once and clears motion without modifying its identity or base', () => {
  const p = robot();
  for (let i = 0; i < 4; i++) expect(hurtRobot(p, 25)).toBe(true);
  expect(p).toMatchObject({ id: 'robot', health: 0, life: 'disabled', recovery: 3, inputUntil: 0, vx: 0, vy: 0, path: [], hurt: 4 });
  expect(hurtRobot(p, 25)).toBe(false); expect(p.hurt).toBe(4);
});

it('recovers at a shared core, validates space and makes retried requests idempotent', () => {
  const world = field(), p = robot(); hurtRobot(p, 100);
  expect(beginRecovery(p, world, [], [], 'friend')).toContain('preparing');
  tickLife(p, 3, world, [], []);
  expect(beginRecovery(p, world, [], [], 'missing')).toContain('completed');
  expect(beginRecovery(p, world, [], [], 'friend')).toBeNull();
  const x = p.x, y = p.y;
  tickLife(p, .5, world, [], [p]);
  expect(beginRecovery(p, world, [], [], 'friend')).toBeNull();
  expect(p.recovery).toBeCloseTo(1.3); expect(p.x).toBe(x); expect(p.y).toBe(y);
  tickLife(p, 1.3, world, [], [p]);
  expect(p).toMatchObject({ health: 100, life: 'active', shield: 2 });
  expect(canStand(world, [], p.x, p.y)).toBe(true);
  expect(Math.hypot(p.x - 30.5, p.y - 14.5)).toBeLessThanOrEqual(SURVIVAL.radius);
  expect(world.cores).toHaveLength(1); expect(world.cores[0].owner).toBe('other');
  expect(beginRecovery(p, world, [], [], 'friend')).toContain('already');
});

it('excludes occupied sites, revalidates arrival and leaves a blocked replacement recoverable', () => {
  const world = field(), p = robot(); hurtRobot(p, 100); p.recovery = 0;
  const point = recoveryPoint(world, [], world.cores[0], [], p.id)!;
  expect(recoveryPoint(world, [], world.cores[0], [{ id: 'incoming', ...point, life: 'arriving' }], p.id)).not.toEqual(point);
  expect(beginRecovery(p, world, [], [], 'friend')).toBeNull();
  // All ground in the circle is now occupied; arrival must not force an overlap.
  const occupied = Array.from({ length: 48 * 36 }, (_, i) => ({ id: String(i), x: i % 48 + .5, y: Math.floor(i / 48) + .5 }));
  tickLife(p, 2, world, [], occupied);
  expect(p.life).toBe('disabled'); expect(p.health).toBe(0);
  expect(beginRecovery(p, world, [], occupied, 'friend')).toContain('No clear');
  expect(beginRecovery(p, world, [], [], 'friend')).toBeNull();
});
