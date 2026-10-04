import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { guardStep } from '../public/guard.js';
import { createCombat } from '../public/combat.js';

const field = () => ({ ...createWorld(), terrain: Array(48 * 36).fill(2), cores: [], artillery: [] });
const robot = () => ({ id: 'robot', x: 20.5, y: 10.5, health: 100, life: 'active', guarding: true, shield: 0, turret: Math.PI / 2, angle: Math.PI / 2, aim: Math.PI / 2 });
it('guards in place, selects laser at distance and fuel nearby with boundary hysteresis', () => {
  const p = robot(), state: any = {}, world = field(), e = { id: 1, x: 28.5, y: 10.5, hp: 60 };
  expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('LASER');
  e.x = 25.2; expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('LASER');
  e.x = 24.9; expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('FLAME');
  e.x = 25.2; expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('FLAME');
  e.x = 25.6; expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('LASER');
  expect([p.x, p.y]).toEqual([20.5, 10.5]);
});
it('obstacles and turret alignment prevent shots, and control release or death stops guarding', () => {
  const p = robot(), state: any = {}, world = field(), e = { id: 1, x: 28.5, y: 10.5, hp: 60 };
  world.terrain[10 * 48 + 24] = 3;
  expect(guardStep(p, state, [e], world, [], .1)).toBeNull();
  world.terrain[10 * 48 + 24] = 2; p.turret = -Math.PI / 2; state.search = 0;
  expect(guardStep(p, state, [e], world, [], .1)).toBeNull();
  for (let i = 0; i < 4; i++) guardStep(p, state, [e], world, [], .1);
  expect(guardStep(p, state, [e], world, [], .1)?.weapon).toBe('LASER');
  p.guarding = false; expect(guardStep(p, state, [e], world, [], .1)).toBeNull(); expect(state.targetId).toBeNull();
  p.guarding = true; p.life = 'disabled'; expect(guardStep(p, state, [e], world, [], .1)).toBeNull();
});
it('guard fire uses ordinary damage and cooldowns and emits no new shots after handoff', () => {
  const world = field(), combat = createCombat(world); combat.start([]);
  const e = combat.snapshot().enemies[0], p = { ...robot(), x: e.x + 8, y: e.y, turret: -Math.PI / 2, angle: -Math.PI / 2 };
  combat.tick(.1, [], [p]);
  const first = combat.snapshot().shots.find(s => s.owner === p.id);
  expect(first?.weapon).toBe('LASER'); expect(combat.snapshot().enemies.some(e => e.hp < 60)).toBe(true);
  expect(combat.shoot(p, e.x, e.y, 'LASER', [])).toContain('reloading');
  p.guarding = false; for (let i = 0; i < 6; i++) combat.tick(.1, [], [p]);
  expect(combat.snapshot().shots.filter(s => s.owner === p.id)).toHaveLength(1);
});
