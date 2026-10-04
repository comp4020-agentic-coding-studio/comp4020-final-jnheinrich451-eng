import { expect, it } from 'vitest';
import { createWorld } from '../public/world.js';
import { createCombat, blastDamage, HE, APCR } from '../public/combat.js';
import { angleDelta, SENTRY_TURRET } from '../public/turret.js';

it('validates fire, imposes cooldowns, and resolves shell damage only against hostiles', () => {
  const world = createWorld(), combat = createCombat(world);
  const friendly = { id: 'scout', ...world.spawn };
  expect(combat.shoot(friendly, NaN, 0)).toBeTruthy();
  expect(combat.shoot(friendly, 0, 0)).toBeTruthy();
  expect(combat.start([])).toBeNull();
  expect(combat.start([])).toContain('already');
  const enemy = combat.snapshot().enemies[0];
  const shooter = { id: 'scout', x: enemy.x, y: enemy.y + 2 };
  expect(combat.shoot(shooter, enemy.x, enemy.y)).toBeNull();
  expect(combat.shoot(shooter, enemy.x, enemy.y)).toContain('reloading');
  for (let i = 0; i < 3; i++) combat.tick(.1, []);
  expect(combat.snapshot().enemies.some(e => e.id === enemy.id)).toBe(false);
  expect(combat.snapshot().impacts[0].hits.some((h: { id: number; killed: boolean }) => h.id === enemy.id && h.killed)).toBe(true);
  expect(combat.snapshot().health).toBe(100);
  expect(friendly).toEqual({ id: 'scout', ...world.spawn });
  for (let i = 0; i < 5; i++) combat.tick(.1, []);
  const target = combat.snapshot().enemies[0];
  expect(combat.shoot(shooter, target.x, target.y)).toBeNull();
  for (let i = 0; i < 8; i++) combat.tick(.1, []);
  expect(combat.snapshot().kills).toBeGreaterThanOrEqual(1);
});

it('HE has a lethal center, radial falloff and one damage application per blast', () => {
  expect(blastDamage(.4)).toBeGreaterThanOrEqual(60);
  expect(blastDamage(1.5)).toBeLessThan(60);
  expect(blastDamage(HE.radius)).toBe(12);
  expect(blastDamage(HE.radius + .01)).toBe(0);
  const combat = createCombat(createWorld()); combat.start([]);
  const enemy = combat.snapshot().enemies[0];
  // A near-miss creates blast damage without touching the body.
  const source = { id: 'scout', x: enemy.x + 1.4, y: enemy.y + 1 };
  combat.shoot(source, enemy.x + 1.4, enemy.y);
  for (let i = 0; i < 2; i++) combat.tick(.1, []);
  const after = combat.snapshot(), survivor = after.enemies.find(e => e.id === enemy.id)!;
  expect(survivor.hp).toBeGreaterThan(0); expect(survivor.hp).toBeLessThan(60);
  expect(after.impacts).toHaveLength(1);
  for (let i = 0; i < 5; i++) combat.tick(.1, []);
  expect(combat.snapshot().enemies.find(e => e.id === enemy.id)?.hp).toBe(survivor.hp);
  expect(combat.snapshot().marks.some(m => m.kind === 'crater')).toBe(true);
});

it('craters are cosmetic and bounded; expired effects do not accumulate', () => {
  const world = createWorld(), originalTerrain = [...world.terrain], combat = createCombat(world);
  for (let i = 0; i < 100; i++) {
    expect(combat.shoot({ id: 'scout', ...world.spawn }, world.spawn.x + 1, world.spawn.y)).toBeNull();
    for (let j = 0; j < 7; j++) combat.tick(.1, []);
  }
  expect(combat.snapshot().marks).toHaveLength(48);
  expect(world.terrain).toEqual(originalTerrain);
  for (let i = 0; i < 20; i++) combat.tick(.1, []);
  expect(combat.snapshot().shots).toHaveLength(0);
  expect(combat.snapshot().impacts).toHaveLength(0);
  expect(combat.snapshot().shells).toHaveLength(0);
});

it('sentries defend autonomously; abandoned drills can fail and restart', () => {
  const world = createWorld(), combat = createCombat(world);
  const buildings = [{ id: 'sentry', x: 24, y: 12 }];
  combat.start(buildings);
  combat.tick(.1, buildings);
  expect(combat.snapshot().shots.every(s => s.weapon === 'APCR')).toBe(true);
  for (let i = 0; i < 500 && combat.snapshot().status === 'active'; i++) combat.tick(.1, buildings);
  expect(combat.snapshot().status).toBe('cleared');
  expect(combat.snapshot().kills).toBe(3);
  expect(combat.snapshot().marks.some(m => m.kind === 'crater')).toBe(false);
  expect(buildings).toEqual([{ id: 'sentry', x: 24, y: 12 }]);
  expect(combat.start([])).toBeNull();
  for (let i = 0; i < 1000 && combat.snapshot().status === 'active'; i++) combat.tick(.1, []);
  expect(combat.snapshot().status).toBe('failed');
  expect(combat.snapshot().health).toBe(0);
  expect(combat.start([])).toBeNull();
  expect(combat.snapshot().health).toBe(100);
});

it('APCR damages only the directly hit enemy and has an independent server cooldown', () => {
  const combat = createCombat(createWorld()); combat.start([]);
  const target = combat.snapshot().enemies[0], source = { id: 'scout', x: target.x, y: target.y + 2 };
  expect(combat.shoot(source, target.x, target.y, 'INVALID')).toContain('Unknown');
  expect(combat.shoot(source, target.x, target.y, 'APCR')).toBeNull();
  expect(combat.shoot(source, target.x, target.y, 'APCR')).toContain('reloading');
  expect(combat.shoot(source, source.x + 5, source.y, 'HE')).toBeNull();
  combat.tick(.1, []);
  const after = combat.snapshot();
  expect(after.enemies.find(e => e.id === target.id)?.hp).toBe(60 - APCR.damage);
  expect(after.enemies.filter(e => e.id !== target.id).every(e => e.hp === 60)).toBe(true);
  expect(after.impacts[0].weapon).toBe('APCR'); expect(after.impacts[0].radius).toBe(0);
  expect(after.marks).toHaveLength(0);
});

it('APCR misses and rock hits create no HE blast or crater', () => {
  const combat = createCombat(createWorld());
  combat.shoot({ id: 'scout', x: 32.5, y: 13.5 }, 36.5, 13.5, 'APCR'); combat.tick(.1, []);
  expect(combat.snapshot().impacts[0].surface).toBe(3);
  expect(combat.snapshot().impacts[0].hits).toHaveLength(0);
  expect(combat.snapshot().marks).toHaveLength(0);
  for (let i = 0; i < 10; i++) combat.tick(.1, []);
  combat.shoot({ id: 'scout', x: 24.5, y: 18.5 }, 28.5, 18.5, 'APCR');
  for (let i = 0; i < 10; i++) combat.tick(.1, []);
  expect(combat.snapshot().shells).toHaveLength(0);
  expect(combat.snapshot().impacts).toHaveLength(0);
  expect(combat.snapshot().marks).toHaveLength(0);
});

it('sentries traverse before firing, retain valid targets, and discard dismantled mount state', () => {
  const combat = createCombat(createWorld()), buildings = [{ id: 'tracking', x: 24, y: 17 }];
  combat.tick(.1, buildings);
  const idle = combat.snapshot().sentries.tracking;
  expect(idle.angle).toBe(SENTRY_TURRET.restAngle);
  expect(idle.targetId).toBeNull();
  combat.start(buildings); combat.tick(.1, buildings);
  let previous = combat.snapshot();
  expect(previous.sentries.tracking.targetId).not.toBeNull();
  expect(Math.abs(angleDelta(previous.sentries.tracking.angle, previous.sentries.tracking.aim))).toBeGreaterThan(SENTRY_TURRET.tolerance);
  expect(previous.shots).toHaveLength(0);
  const seen = new Set<number>();
  for (let i = 0; i < 150 && previous.status === 'active'; i++) {
    combat.tick(.1, buildings);
    const state = combat.snapshot(), mount = state.sentries.tracking;
    expect(Math.abs(angleDelta(previous.sentries.tracking.angle, mount.angle))).toBeLessThanOrEqual(SENTRY_TURRET.speed * .1 + 1e-8);
    const oldTarget = previous.enemies.find(e => e.id === previous.sentries.tracking.targetId);
    if (oldTarget && Math.hypot(oldTarget.x - 24.5, oldTarget.y - 17.5) < 6.8 && mount.targetId !== null) {
      expect(mount.targetId).toBe(oldTarget.id);
    }
    for (const shot of state.shots) if (!seen.has(shot.id)) {
      seen.add(shot.id);
      expect(shot.weapon).toBe('APCR');
      expect(Math.abs(angleDelta(shot.angle, mount.angle))).toBeLessThan(1e-8);
      expect(Math.abs(angleDelta(shot.angle, mount.aim))).toBeLessThanOrEqual(SENTRY_TURRET.tolerance);
    }
    previous = state;
  }
  expect(seen.size).toBeGreaterThan(0);
  expect(previous.status).toBe('cleared');
  expect(previous.sentries.tracking.targetId).toBeNull();
  const stopped = previous.sentries.tracking.angle;
  combat.tick(.1, buildings); expect(combat.snapshot().sentries.tracking.angle).toBe(stopped);
  combat.tick(.1, []); expect(combat.snapshot().sentries).toEqual({});
  // Captured snapshots must not change when a later tick rotates the mount.
  expect(idle.angle).toBe(SENTRY_TURRET.restAngle);
});
