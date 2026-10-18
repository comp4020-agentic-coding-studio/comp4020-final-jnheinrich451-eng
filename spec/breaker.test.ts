import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat } from '../public/combat.js';
import { freshLife } from '../public/survival.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { landTarget } from '../public/land-ai.js';
import { freshLogistics } from '../public/logistics.js';

function field(kind = 'breaker') {
  const world = { ...createWorld(), terrain: Array(48 * 36).fill(2), logistics: freshLogistics() };
  const saved = createCombat(world).checkpoint(); saved.serial = 1;
  saved.enemies = [{ ...newGroundEnemy(kind, 1, { x: 20.5, y: 18.5 }), eventSpawn: true }];
  return { world, combat: createCombat(world, saved) };
}
const robot = () => ({ id: 'runner', x: 20.5, y: 19.1, ...freshLife() });

it('persists a heavy locked strike through restart, hits once, and lets a moving robot dodge', () => {
  const { world, combat } = field(), p = robot(); combat.tick(.1, [], [p]);
  expect(combat.snapshot().enemies[0]).toMatchObject({ kind: 'breaker', hp: 180, maxHp: 180, attack: { windup: 1400, radius: 1, x: p.x, y: p.y } });
  const saved = combat.checkpoint(), restored = createCombat(world, structuredClone(saved));
  for (let i = 0; i < 13; i++) restored.tick(.1, [], [p]); expect(p.health).toBe(100);
  restored.tick(.11, [], [p]); expect(p.health).toBe(50); expect(p.hurt).toBe(1);
  restored.tick(.1, [], [p]); expect(p.hurt).toBe(1);
  const dodged = createCombat(world, structuredClone(saved)), runner = robot(); runner.x += 3;
  for (let i = 0; i < 15; i++) dodged.tick(.1, [], [runner]); expect(runner.health).toBe(100);
});

it('moves more slowly than hunters and prefers damageable infrastructure without granting hunters penetration', () => {
  const breaker = field(), hunter = field('hunter'), p = { ...robot(), x: 26.5 };
  for (let i = 0; i < 10; i++) { breaker.combat.tick(.1, [], [p]); hunter.combat.tick(.1, [], [p]); }
  expect(breaker.combat.snapshot().enemies[0].x).toBeLessThan(hunter.combat.snapshot().enemies[0].x);
  const unit = { ...newGroundEnemy('breaker', 1, { x: 10, y: 10 }) };
  const facility = { id: 'armor3', x: 15, y: 10, facility: { x: 15, y: 10, w: 2, h: 2, hp: { armor: 3 } } };
  const person = { id: 'robot', x: 11, y: 10 };
  expect(landTarget(unit, [facility, person], 0)?.id).toBe('armor3');
  expect(landTarget({ ...unit, kind: 'hunter' }, [facility, person], 0)?.id).toBe('robot');
  expect(landTarget({ ...unit, kind: 'hunter' }, [facility], 0)).toBeUndefined();
});

it.each(['INCENDIARY', 'GAS'])('preserves lethal %s contact against a full-health breaker and charges gas once', weapon => {
  const { combat } = field(), e = combat.snapshot().enemies[0];
  expect(combat.lob({ id: 'gun', x: e.x - 8, y: e.y }, e.x, e.y, { duration: .01, verticalSpeed: 1, gravity: 12, elevation: 75 }, weapon)).toBeNull();
  combat.tick(.01, []); expect(combat.snapshot().enemies).toHaveLength(0);
  expect(combat.snapshot().kills).toBe(1);
  if (weapon === 'GAS') expect(combat.snapshot().fields[0].capacity).toBe(5);
});
