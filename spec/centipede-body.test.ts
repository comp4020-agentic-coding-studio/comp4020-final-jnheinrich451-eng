import { expect, it } from 'vitest';
import { CENTIPEDE, initializeCentipedeBody, advanceCentipedeBody, enemyDistance, enemyOccupants } from '../public/centipede.js';
import { canDamageEnemy, newGroundEnemy } from '../public/enemy-profiles.js';
import { raycast } from '../public/raycast.js';
import { landSiegeMembers, landTarget, landVisible } from '../public/land-ai.js';
import { canStand } from '../public/world.js';
import { createEnemyNavigator } from '../public/enemy-navigation.js';

const world = (): any => ({ width: 48, height: 40, terrain: Array(48 * 40).fill(2), sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [] });
function giant(x = 20.5, y = 20.5): any {
  const e = { ...newGroundEnemy('centipede', 1, { x, y }), angle: Math.PI / 2 };
  initializeCentipedeBody(e, [{ x, y }, { x: x - CENTIPEDE.length, y }]); return e;
}
const facility = (id: string, x: number, y = 20.5): any => ({ id, x, y,
  facility: { id, kind: 'factory', x, y, w: 2, h: 2, hp: { health: 300, armor: 2 } } });

it('uses one identity and HP pool with eight hittable body positions and heavy-weapon protection', () => {
  const e = giant();
  expect(e.hp).toBe(2400); expect(e.body).toHaveLength(8);
  expect(e.body.at(-1)).toMatchObject({ x: 15.25, y: 20.5 });
  expect(enemyDistance(e, { x: 15.25, y: 20.5 })).toBe(0);
  expect(enemyDistance(e, { x: 15.25, y: 21.5 })).toBeCloseTo(.58);
  expect(enemyDistance({ kind: 'hunter', x: 15.25, y: 20.5 }, { x: 15.25, y: 21.5 })).toBe(1);
  for (const weapon of ['HE', 'MAGNETIC', 'MAC']) expect(canDamageEnemy(e, weapon)).toBe(true);
  for (const weapon of ['APCR', 'AA35', 'LASER', 'INCENDIARY', 'TOXIC', 'FLAME']) expect(canDamageEnemy(e, weapon)).toBe(false);
  const occupants = enemyOccupants([e]); expect(occupants).toHaveLength(8);
  expect(occupants.every((p: any) => p.id === e.id && p.hp === 2400 && !p.body)).toBe(true);
  const hunter = newGroundEnemy('hunter', 2, { x: 1, y: 1 }); expect(enemyOccupants([hunter])[0]).toBe(hunter);
});

it('hits the tail with direct rays and keeps closer cover and ordinary hit radii unchanged', () => {
  const w = world(), e = giant(), from = { x: 15.25, y: 14.5 };
  const tail = raycast(w, [], from, 0, 1, 12, [e]);
  expect(tail.enemy).toBe(e); expect(tail.distance).toBeCloseTo(6 - CENTIPEDE.radius);
  expect(raycast(w, [], { x: 25.5, y: 20.5 }, -1, 0, 20, [e]).enemy).toBe(e);
  w.terrain[18 * w.width + 15] = 3;
  const blocked = raycast(w, [], from, 0, 1, 12, [e]); expect(blocked.enemy).toBeNull(); expect(blocked.blocked).toBe(true);
  const hunter = newGroundEnemy('hunter', 2, { x: 30.5, y: 20.5 });
  expect(raycast(w, [], { x: 30.5, y: 15.5 }, 0, 1, 12, [hunter]).distance).toBeCloseTo(5 - .38);
});

it('follows actual right-angle travel around terrain without cutting the body through the corner', () => {
  const w = world(), e = giant();
  // Wall west of the upward leg. The head rounds its southeast corner.
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) w.terrain[y * w.width + x] = 3;
  const clear = (x: number, y: number) => canStand(w, [], x, y, null, CENTIPEDE.radius);
  for (let i = 0; i < 60; i++) {
    const previous = { x: e.x, y: e.y }; e.y -= .05; e.angle = 0;
    expect(advanceCentipedeBody(e, previous, clear)).toBe(true);
  }
  expect(e.body.some((p: any) => p.x < 20 && p.y >= 20)).toBe(true);
  expect(e.body.some((p: any) => p.y < 20 && p.x >= 20)).toBe(true);
  expect(e.body.every((p: any) => clear(p.x, p.y))).toBe(true);
  expect(e.bodyTrail.length).toBeLessThanOrEqual(4);
  expect(e.body.every((p: any) => !(p.x < 20 && p.y < 20))).toBe(true);
});

it('persists exact body history and never grows a missing trail through blocked terrain', () => {
  const w = world(), e = giant(), saved = JSON.parse(JSON.stringify(e));
  for (let i = 0; i < 100; i++) for (const target of [e, saved]) {
    const before = { x: target.x, y: target.y }; target.x += .05;
    expect(advanceCentipedeBody(target, before)).toBe(true);
  }
  expect(saved).toEqual(e); expect(e.bodyTrail.length).toBeLessThanOrEqual(3);
  const legacy: any = newGroundEnemy('centipede', 3, { x: 10.5, y: 10.5 });
  w.terrain[10 * w.width + 9] = 3;
  initializeCentipedeBody(legacy, [{ x: 5.25, y: 10.5 }], (x, y) => canStand(w, [], x, y, null, CENTIPEDE.radius));
  expect(legacy.body.every((p: any) => p.x === 10.5 && p.y === 10.5)).toBe(true);
  const snapshot = structuredClone(legacy), previous = { x: legacy.x, y: legacy.y }; legacy.x = 9.9;
  expect(advanceCentipedeBody(legacy, previous, (x, y) => canStand(w, [], x, y, null, CENTIPEDE.radius))).toBe(false);
  expect(legacy).toEqual(snapshot);
});

it('always prefers visible infrastructure and retains it over a tempting player, without altering the ordinary siege quota', () => {
  const e = giant(), f = facility('factory', 40), player = { id: 'pilot', x: 21.5, y: 20.5 };
  expect(landTarget(e, [player, f], 0)?.id).toBe(f.id);
  e.targetId = f.id;
  expect(landTarget(e, [player, f], 100)?.id).toBe(f.id);
  expect(landTarget({ ...e, nextSense: 0 }, [player, f], 500, target => target.id !== f.id)?.id).toBe(player.id);
  const protectedCore = facility('protected', 23); protectedCore.facility.protected = true;
  expect(landTarget({ ...e, targetId: null, nextSense: 0 }, [protectedCore, player], 0)?.id).toBe(player.id);
  const heavy = Array.from({ length: 8 }, (_, id) => ({ id: id + 10, hp: 180, kind: 'breaker', x: 1, y: 1 }));
  expect(landSiegeMembers([...heavy, e]).size).toBe(2);
});

it('does not track through walls and respects failed targets before selecting another facility', () => {
  const w = world(), e = giant(), f = facility('blocked', 30), other = facility('other', 20.5, 30);
  w.terrain[20 * w.width + 24] = 3;
  expect(landTarget(e, [f, other], 0, target => landVisible(w, [], e, target))?.id).toBe(other.id);
  const failed = { ...e, nextSense: 0, failedTarget: { id: other.id, until: 3000 } };
  expect(landTarget(failed, [f, other], 100, target => landVisible(w, [], e, target))).toBeUndefined();
  expect(landTarget({ ...failed, nextSense: 0 }, [f, other], 3100, target => landVisible(w, [], e, target))?.id).toBe(other.id);
});

it('caches navigation clearance by body radius without widening ordinary units', () => {
  const w = world(); w.terrain.fill(3);
  for (let x = 2; x < 10; x++) w.terrain[10 * w.width + x] = 2;
  const nav = createEnemyNavigator(w); nav.begin([], () => false, 0);
  const from = { x: 2.5, y: 10.5 }, to = [{ x: 9.5, y: 10.5 }];
  expect(nav.route('small', from, to).status).toBe('found');
  expect(nav.route('giant', from, to, true, CENTIPEDE.radius).status).toBe('found');
  expect(nav.route('too-wide', from, to, true, .6).status).toBe('blocked');
});
