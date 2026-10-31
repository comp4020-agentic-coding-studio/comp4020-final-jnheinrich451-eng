import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { freshLogistics } from '../public/logistics.js';
import { newAerialEnemy } from '../public/aerial-enemy.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { aaSentryAim, aaSentryStep, AA_SENTRY } from '../public/aa-sentry.js';

function world(): any {
  return { width: 96, height: 80, terrain: Array(96 * 80).fill(2), mountains: Array(96 * 80).fill(0),
    spawn: { x: 10, y: 10 }, sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [], logistics: freshLogistics() };
}
const sentry = (): any => ({ id: 'aa-sentry', kind: 'aa-sentry', weapon: 'AA35', x: 20, y: 20, owner: 'p1' });
const flyer = (id = 1, x = 35.5, y = 20.5, hp = 4000): any => ({ ...newAerialEnemy(id, { x, y }), hp, maxHp: hp,
  attack: { kind: 'skimmer', x, y, at: 0, fireAt: 1e9, targetId: 'fixed-air-fixture' } });
const ground = (id = 2, x = 25.5, y = 20.5): any => ({ ...newGroundEnemy('hunter', id, { x, y }), hp: 600, maxHp: 600, frenzyRecoveryUntil: 1e9 });
function fixture(enemies = [flyer()]) {
  const w = world(), b = sentry(), saved = createCombat(w).checkpoint();
  saved.enemies = enemies; saved.serial = 100;
  saved.sentryMounts = [[b.id, { angle: Math.PI / 2, aim: Math.PI / 2, targetId: null }]];
  return { w, b, c: createCombat(w, saved) };
}
const hp = (c: any, id: number) => c.snapshot().enemies.find((e: any) => e.id === id)?.hp || 0;
const rounds = (c: any) => c.snapshot().shots.filter((s: any) => s.mount === 'aa-35mm');
function advance(c: any, buildings: any[], seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) c.tick(.1, buildings);
}

it('ignores all ground enemies instead of falling back to APCR or accepting manual AA fire', () => {
  const { w, b, c } = fixture([ground()]); advance(c, [b], 3);
  expect(rounds(c)).toEqual([]); expect(hp(c, 2)).toBe(600);
  expect(c.snapshot().sentries[b.id].targetId).toBeNull();
  expect(aaSentryAim(w, b, ground())).toBeNull();
  expect(c.shoot({ id: b.id, x: 20.5, y: 20.5, mount: 'aa-sentry', turret: Math.PI / 2 }, 25.5, 20.5, 'AA35', [b]))
    .toBe('Board a ready AA vehicle to use the twin 35 mm guns.');
});

it('alternates eight air-only rounds per second through 100 ms ticks, sparing ground bodies along the same line', () => {
  const { b, c } = fixture([flyer(), ground()]), observed = new Map<number, any>();
  for (let i = 0; i < 10; i++) { c.tick(.1, [b]); for (const s of rounds(c)) observed.set(s.id, s); }
  const shots = [...observed.values()];
  expect(shots).toHaveLength(8);
  expect(shots.map(s => s.barrel)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  expect(shots.map(s => s.at)).toEqual([100, 225, 350, 475, 600, 725, 850, 975]);
  expect(shots.every(s => s.domain === 'air' && s.owner === b.id)).toBe(true);
  advance(c, [], .5);
  expect(hp(c, 1)).toBe(3840); expect(hp(c, 2)).toBe(600);
});

it('sees over low cover but never acquires a flyer behind a mountain ridge', () => {
  for (const mountain of [false, true]) {
    const { w, b, c } = fixture();
    for (let y = 0; y < w.height; y++) {
      w.terrain[y * w.width + 24] = 3;
      if (mountain) w.mountains[y * w.width + 24] = 2;
    }
    advance(c, [b], 1);
    expect(rounds(c).length > 0).toBe(!mountain);
    expect(hp(c, 1) < 4000).toBe(!mountain);
  }
});

it('leads moving air targets and waits for real traverse alignment within its range', () => {
  const w = world(), b = sentry(), e = { ...flyer(), vx: 2 }, mount: any = { angle: 0, aim: 0, targetId: null };
  const aim = aaSentryAim(w, b, e)!;
  expect(aim.domain).toBe('air'); expect(aim.x).toBeGreaterThan(e.x);
  expect(aaSentryAim(w, b, flyer(1, b.x + .5 + AA_SENTRY.range + .01))).toBeNull();
  expect(aaSentryStep(w, b, mount, [e], .1)).toBeNull();
  expect(mount.angle).toBeCloseTo(AA_SENTRY.speed * .1);
  for (let i = 0; i < 5; i++) aaSentryStep(w, b, mount, [e], .1);
  expect(aaSentryStep(w, b, mount, [e], .1)).toMatchObject({ targetId: 1, domain: 'air' });
});

it('does not fire during construction and starts fresh after completion without an accumulated burst', () => {
  const { w, b, c } = fixture(); w.logistics.jobs[b.id] = { remaining: 60, duration: 60, kind: 'aa-sentry' };
  advance(c, [b], 2); expect(rounds(c)).toEqual([]);
  delete w.logistics.jobs[b.id]; c.tick(.1, [b]);
  expect(rounds(c)).toHaveLength(1); expect(rounds(c)[0].at).toBe(2100);
});

it.each(['removed', 'destroyed', 'durability'])('stops new shots when %s but lets already released rounds hit once', loss => {
  const { w, b, c } = fixture(); c.tick(.1, [b]);
  expect(c.checkpoint().shells).toHaveLength(1);
  if (loss === 'destroyed') b.destroyed = true;
  if (loss === 'durability') w.logistics.durability['sentry:' + b.id].health = 0;
  advance(c, loss === 'removed' ? [] : [b], .8);
  expect(rounds(c)).toHaveLength(1); expect(hp(c, 1)).toBe(3980);
  expect(c.checkpoint().shells).toHaveLength(0);
});

it('preserves the barrel, reload and released shell through restart without restoring catch-up intent', () => {
  const { w, b, c } = fixture(); c.tick(.1, [b]);
  const saved = c.checkpoint(), before = saved.sentryMounts[0][1];
  expect(before).toMatchObject({ nextBarrel: 1, nextShot: 225 });
  const resumed = createCombat(structuredClone(w), JSON.parse(JSON.stringify(saved)));
  resumed.tick(.1, [b]); expect(rounds(resumed)).toEqual([]);
  expect(hp(resumed, 1)).toBe(4000);
  resumed.tick(.1, [b]);
  expect(rounds(resumed)).toHaveLength(1); expect(rounds(resumed)[0]).toMatchObject({ barrel: 1, at: 225, domain: 'air' });
  const secondSave = resumed.checkpoint(), restored = createCombat(structuredClone(w), secondSave);
  advance(restored, [], .6);
  expect(hp(restored, 1)).toBe(3960); expect(restored.checkpoint().shells).toHaveLength(0);
});

it('bounds catch-up after a long stall and respects the shared projectile capacity', () => {
  const stalled = fixture(); stalled.c.tick(.1, [stalled.b]); stalled.c.tick(5, [stalled.b]);
  expect(rounds(stalled.c)).toHaveLength(1); expect(rounds(stalled.c)[0].at).toBe(5100);
  const { w, b, c } = fixture(), saved = c.checkpoint();
  saved.shells = Array.from({ length: 64 }, (_, i) => ({ id: 1000 + i, weapon: 'AA35', domain: 'air',
    owner: 'other', x: 80, y: 70, dx: 0, dy: -1, speed: 0, remaining: 10, at: 0 }));
  const full = createCombat(w, saved); full.tick(.1, [b]);
  expect(rounds(full)).toEqual([]); expect(full.checkpoint().shells).toHaveLength(64);
  expect(full.snapshot().sentries[b.id].nextBarrel).toBeUndefined();
});

it('keeps ordinary APCR sentries ground-only and emits attributed automatic AA activity', () => {
  const { w, b, c } = fixture(), saved = c.checkpoint();
  const ordinary = { id: 'apcr', x: 30, y: 20, owner: 'p2' };
  const active = createCombat(w, saved, () => ({ roomId: 'coop-room' }));
  advance(active, [b, ordinary], 5.2);
  const events = active.drainEvents();
  expect(events.some((e: any) => e.event === 'defense.activity' && e.sourceId === b.id && e.weapon === 'AA35' && e.cause === 'aa_sentry_targeting')).toBe(true);
  expect(active.snapshot().shots.some((s: any) => s.owner === ordinary.id)).toBe(false);
});
