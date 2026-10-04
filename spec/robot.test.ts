import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat, blastDamage } from '../public/combat.js';
import { raycast } from '../public/raycast.js';
import { HE, LASER, FLAME, loadout, relativeMovement } from '../public/weapons.js';

const field = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), cores: [] });

it('separates body loadouts, blast profiles and aim-relative movement', () => {
  expect(loadout('robot').primary).toBe('FLAME'); expect(loadout('rover').primary).toBe('HE');
  expect(loadout('robot').turnSpeed).toBeGreaterThan(loadout('rover').turnSpeed);
  expect(relativeMovement(Math.PI / 2, 0, 1).right).toBeCloseTo(1);
  expect(relativeMovement(Math.PI / 2, 0, 1).forward).toBeCloseTo(0);
  expect(relativeMovement(Math.PI / 2, -1, 0).forward).toBeCloseTo(-1);
  expect(blastDamage(3)).toBe(0);
  expect(blastDamage(3, { ...HE, radius: 4.2 })).toBeGreaterThan(0);
});

it('rays stop at the nearest enemy, exact wall edge, friendly structure or world edge', () => {
  const world = field(), origin = { x: 10.5, y: 10.5 };
  const near = { id: 1, x: 13, y: 10.5, hp: 60 }, far = { id: 2, x: 15, y: 10.5, hp: 60 };
  expect(raycast(world, [], origin, 1, 0, 32, [far, near]).enemy?.id).toBe(1);
  expect(raycast(world, [], origin, 1, 0, 1, [near]).distance).toBe(1);
  world.terrain[10 * world.width + 12] = 3;
  expect(raycast(world, [], origin, 1, 0, 32, [near])).toMatchObject({ x: 12, enemy: null, blocked: true });
  world.terrain[10 * world.width + 12] = 2;
  const building = { id: 'friendly', x: 12, y: 10 };
  expect(raycast(world, [building], origin, 1, 0, 32, [near]).x).toBe(12);
  expect(building).toEqual({ id: 'friendly', x: 12, y: 10 });
  expect(raycast(world, [], origin, -1, 0, 32).x).toBe(0);
  world.terrain[10 * world.width + 11] = 3;
  expect(raycast(world, [], origin, Math.SQRT1_2, Math.SQRT1_2, 32).distance).toBeCloseTo(Math.SQRT1_2);
});

it('laser damage is immediate, burns once over simulation time, then reacquires its target', () => {
  const combat = createCombat(field()); combat.start([]);
  const enemy = combat.snapshot().enemies[0], source = { id: 'robot', x: enemy.x, y: enemy.y + 2, turret: 0 };
  expect(combat.shoot(source, enemy.x, enemy.y, 'LASER')).toBeNull();
  let state = combat.snapshot(), survivor = state.enemies.find(e => e.id === enemy.id)!;
  expect(survivor.hp).toBe(60 - LASER.damage); expect(survivor.behavior).toBe('fleeing');
  expect(state.shells).toHaveLength(0); expect(state.shots[0].endY).toBeCloseTo(enemy.y + .38);
  expect(state.marks.some(m => m.kind === 'crater')).toBe(false);
  combat.tick(.1, []);
  expect(combat.snapshot().enemies.find(e => e.id === enemy.id)!.y).toBeLessThan(enemy.y);
  for (let i = 0; i < 24; i++) combat.tick(.1, []);
  survivor = combat.snapshot().enemies.find(e => e.id === enemy.id)!;
  expect(survivor.hp).toBeCloseTo(60 - LASER.damage - LASER.burnDps * LASER.burnDuration / 1000);
  expect(survivor.behavior).toBe('attacking');
  combat.tick(.2, []); expect(combat.snapshot().enemies.find(e => e.id === enemy.id)!.hp).toBeCloseTo(survivor.hp);
});

it('re-ignition refreshes one burn and direct kills are counted only once', () => {
  const combat = createCombat(field()); combat.start([]);
  let enemy = combat.snapshot().enemies[0];
  const shoot = () => combat.shoot({ id: 'robot', x: enemy.x, y: enemy.y + 2, turret: 0 }, enemy.x, enemy.y, 'LASER');
  shoot(); combat.tick(.3, []); enemy = combat.snapshot().enemies.find(e => e.id === enemy.id)!;
  shoot(); const refreshed = combat.snapshot().enemies.find(e => e.id === enemy.id)!;
  expect(refreshed.burnUntil).toBe(300 + LASER.burnDuration);
  combat.tick(.3, []); enemy = combat.snapshot().enemies.find(e => e.id === enemy.id)!;
  expect(enemy.hp).toBeCloseTo(60 - 2 * LASER.damage - .6 * LASER.burnDps);
  shoot(); combat.tick(.1, []); expect(combat.snapshot().kills).toBe(1);
  for (let i = 0; i < 30; i++) combat.tick(.1, []);
  expect(combat.snapshot().kills).toBe(1);
  expect(combat.snapshot().marks.filter(m => m.id === enemy.id)).toHaveLength(1);
});

it('fuel travels along its original bearing, kills on contact and stops at obstacles', () => {
  const combat = createCombat(field()); combat.start([]);
  const enemy = combat.snapshot().enemies[0], source = { id: 'robot', x: enemy.x, y: enemy.y + 3, turret: 0 };
  combat.shoot(source, enemy.x, enemy.y, 'FLAME'); source.turret = Math.PI / 2;
  expect(combat.snapshot().enemies[0].hp).toBe(60);
  combat.tick(.1, []); expect(combat.snapshot().jets[0].y).toBeCloseTo(source.y - FLAME.speed * .1);
  expect(combat.snapshot().jets[0].x).toBe(source.x);
  for (let i = 0; i < 3; i++) combat.tick(.1, []);
  expect(combat.snapshot().enemies.some(e => e.id === enemy.id)).toBe(false);
  expect(combat.snapshot().marks.find(m => m.id === enemy.id)).toMatchObject({ kind: 'remains', charred: true });
  const blockedWorld = field(), blocked = createCombat(blockedWorld); blocked.start([]);
  const target = blocked.snapshot().enemies[0];
  blockedWorld.terrain[(Math.floor(target.y) + 1) * blockedWorld.width + Math.floor(target.x)] = 3;
  blocked.shoot({ id: 'robot', x: target.x, y: target.y + 3, turret: 0 }, target.x, target.y, 'FLAME');
  blocked.tick(.3, []);
  expect(blocked.snapshot().jets).toHaveLength(0); expect(blocked.snapshot().enemies.every(e => e.hp === 60)).toBe(true);
});

it('bounds fuel entities and expires them without accumulating ground fire', () => {
  const combat = createCombat(field());
  for (let i = 0; i < 100; i++) combat.shoot({ id: String(i), x: 20, y: 20, turret: 0 }, 20, 15, 'FLAME');
  expect(combat.snapshot().jets).toHaveLength(96);
  for (let i = 0; i < 20; i++) combat.tick(.1, []);
  expect(combat.snapshot().jets).toHaveLength(0); expect(combat.snapshot().shots).toHaveLength(0); expect(combat.snapshot().marks).toHaveLength(0);
});
