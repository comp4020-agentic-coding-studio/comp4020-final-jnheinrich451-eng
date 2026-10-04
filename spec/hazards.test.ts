import { expect, it } from 'vitest';
import { createWorld, findPath } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { contactField, makeField, fireBlocked, heatSpeed, lureRoute, fieldCapacityError, insideField } from '../public/hazards.js';

const world = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2) });
const flight = { duration: .01, verticalSpeed: 1, gravity: 12, elevation: 75 };
const launch = (combat: ReturnType<typeof createCombat>, weapon: string, x: number, y: number) => {
  expect(combat.lob({ id: 'gun', x: x - 8, y }, x, y, flight, weapon)).toBeNull(); combat.tick(.01, []);
};

it('incendiary impact kills immediately, chars remains and expires on simulation time without damaging a robot', () => {
  const combat = createCombat(world()); combat.start([]);
  const enemy = combat.snapshot().enemies[0];
  launch(combat, 'INCENDIARY', enemy.x, enemy.y);
  expect(combat.snapshot().enemies.some(e => e.id === enemy.id)).toBe(false);
  expect(combat.snapshot().marks.find(m => m.id === enemy.id)?.charred).toBe(true);
  expect(combat.snapshot().fields[0].remaining).toBe(18);
  const robot = { id: 'friend', x: enemy.x, y: enemy.y, life: 'active', health: 100, shield: 10 };
  for (let i = 0; i < 179; i++) combat.tick(.1, [], [robot]);
  expect(combat.snapshot().fields).toHaveLength(1); expect(robot.health).toBe(100);
  combat.tick(.11, [], [robot]); expect(combat.snapshot().fields).toHaveLength(0);
  expect(combat.snapshot().marks.some(m => m.kind === 'crater')).toBe(false);
});

it('monsters wait when fire blocks the objective and resume approaching after expiry', () => {
  const combat = createCombat(world()); combat.start([]); launch(combat, 'INCENDIARY', 24.5, 15.5);
  const field = combat.snapshot().fields[0], positions = combat.snapshot().enemies.map(e => [e.x, e.y]);
  for (let i = 0; i < 170; i++) {
    combat.tick(.1, []);
    for (const e of combat.snapshot().enemies) expect(insideField(field, e.x, e.y)).toBe(false);
  }
  expect(combat.snapshot().enemies.map(e => [e.x, e.y])).toEqual(positions); expect(combat.snapshot().kills).toBe(0);
  for (let i = 0; i < 130; i++) combat.tick(.1, []);
  expect(combat.snapshot().health).toBeLessThan(100);
});

it('one gas charge kills only one simultaneous entrant and overlapping clouds charge once; fire has priority', () => {
  const a = { ...makeField(1, 'GAS', 10, 10, 0), capacity: 1 }, b = makeField(2, 'GAS', 10, 10, 0);
  const enemy = () => ({ x: 10, y: 10, hp: 60 });
  const first = enemy(); expect(contactField([a, b], first)?.id).toBe(1); first.hp = 0;
  expect(contactField([a, b], first)).toBeNull(); expect(b.capacity).toBe(6);
  expect(contactField([a, b], enemy())?.id).toBe(2); expect(b.capacity).toBe(5);
  expect(contactField([a], enemy())).toBeNull();
  expect(contactField([b, makeField(3, 'INCENDIARY', 10, 10, 0)], enemy())?.weapon).toBe('INCENDIARY');
  expect(b.capacity).toBe(5);
});

it('gas attracts monsters, retains unused charges between drills and disappears after six kills', () => {
  const combat = createCombat(world()); launch(combat, 'GAS', 30.5, 12.5);
  combat.tick(120, []); expect(combat.snapshot().fields[0].capacity).toBe(6);
  expect(combat.start([])).toBeNull(); let lured = false;
  for (let i = 0; i < 200 && combat.snapshot().status === 'active'; i++) {
    combat.tick(.1, []); lured ||= combat.snapshot().enemies.some(e => e.behavior === 'lured');
  }
  expect(lured).toBe(true); expect(combat.snapshot().kills).toBe(3); expect(combat.snapshot().health).toBe(100);
  expect(combat.snapshot().fields[0].capacity).toBe(3);
  combat.start([]); for (let i = 0; i < 200 && combat.snapshot().status === 'active'; i++) combat.tick(.1, []);
  expect(combat.snapshot().kills).toBe(3); expect(combat.snapshot().fields).toHaveLength(0);
});

it('lures never require crossing fire and outer heat slows without lethal contact', () => {
  const w = world(), fire = makeField(1, 'INCENDIARY', 24.5, 15.5, 0), gas = makeField(2, 'GAS', 24.5, 18.5, 0);
  const enemy = { x: 24.5, y: 10.5, hp: 60 }, blocked = fireBlocked([fire]);
  const lure = lureRoute(w, [], enemy, [fire, gas], blocked);
  expect(lure).toBeNull(); // Cloud center lies in the unsafe region.
  const route = findPath(w, [], enemy, { x: 24.5, y: 23.5 }, blocked)!;
  expect(route.length).toBeGreaterThan(13); expect(route.every(p => !blocked(p.x, p.y))).toBe(true);
  expect(heatSpeed([fire], { x: 28.1, y: 15.5 })).toBe(.55);
  expect(contactField([fire], { x: 28.1, y: 15.5, hp: 60 })).toBeNull();
});

it('caps fields including incoming shells and freezes ammunition at launch without clearing it on a new drill', () => {
  const combat = createCombat(world());
  expect(combat.lob({ id: 'gun', x: 10, y: 12 }, 20, 12, null, 'INVALID')).toBeTruthy();
  for (let i = 0; i < 8; i++) expect(combat.lob({ id: 'gun', x: 10, y: 12 }, 20, 12, null, 'GAS')).toBeNull();
  expect(fieldCapacityError([], combat.snapshot().salvos, 'GAS')).toContain('limit');
  combat.start([]); expect(combat.snapshot().salvos).toHaveLength(8);
  combat.tick(2, []); expect(combat.snapshot().fields).toHaveLength(8);
  expect(combat.lob({ id: 'gun', x: 10, y: 12 }, 20, 12, null, 'GAS')).toContain('limit');
  expect(combat.lob({ id: 'gun', x: 10, y: 12 }, 20, 12, null, 'HE')).toBeNull();
  const fires = Array.from({ length: 4 }, (_, i) => makeField(20 + i, 'INCENDIARY', 10, 10, 0));
  expect(fieldCapacityError([...combat.snapshot().fields, ...fires], [], 'INCENDIARY')).toContain('limit');
});
