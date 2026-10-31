import { expect, it, vi } from 'vitest';
import { ALERT, makeSite, queuePressure, tickSites } from '../public/conquest.js';
import { planRoaming } from '../public/roaming-pressure.js';
import { islandAt } from '../public/island-pressure.js';
import { createCombat } from '../public/combat.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';

function setup() {
  const source: any = { ...makeSite('modifier', 'living-city', 110, 110), guardsRemaining: 0 };
  const world: any = { width: 140, height: 140, terrain: Array(140 * 140).fill(2), spawn: { x: 60.5, y: 60.5 },
    sites: [source], tanks: [], ships: [], cores: [], airbases: [], artillery: [] };
  const player: any = { id: 'pilot', x: 60.5, y: 60.5, ground: true, medium: 'ground', body: 'robot', life: 'active', shield: 0, health: 100 };
  const enemies: any[] = [], director: any = { sleeping: [] }, island = islandAt(world, player.x, player.y);
  let serial = 100;
  const plan = () => planRoaming(world, [], [player], enemies.concat(director.sleeping), player, source, 0)!;
  const queue = (prepared = plan()) => queuePressure(source, world, [], [player], enemies.concat(director.sleeping),
    ['hunter', 'hunter'], 100, () => false, { ...prepared, kind: 'roaming', pressureIsland: island });
  const tick = (now = 100 + ALERT.warning, people = [player], blocked = () => false, reserved = 0, admission = () => Infinity) =>
    tickSites(world.sites, world, [], people, enemies, now, () => ++serial, blocked, reserved, director, admission);
  return { world, source, player, enemies, director, island, plan, queue, tick };
}
function roamingEnemy(id: number, island: string | null, siteId: string) {
  return { ...newGroundEnemy('hunter', id, { x: 12.5 + id * 2, y: 15.5 }), pressureKind: 'roaming', pressureIsland: island, siteId };
}

it('saves a warned roaming order and creates a finite investigation with a leash covering its old focus', () => {
  const h = setup(), plan = h.plan(), fixed = { ...plan.focus };
  expect(h.queue(plan)).toBe(true); expect(h.source.awake).toBe(true);
  expect(h.source.pending).toMatchObject({ kind: 'roaming', origin: plan.origin, focus: fixed, pressureIsland: h.island, at: 100 + ALERT.warning });
  plan.focus.x += 50; plan.points[0].x += 50; // Caller mutation must not rewrite accepted warnings.
  expect(h.source.pending.focus).toEqual(fixed); expect(h.source.pending.points[0].x).not.toBe(plan.points[0].x);
  const saved = createCombat(h.world, null, null, 'roaming-save').checkpoint();
  const restoredWorld = structuredClone(h.world), restored = createCombat(restoredWorld, structuredClone(saved));
  expect(restored.checkpoint().sites[0].pending).toEqual(h.source.pending);
  const pending = structuredClone(h.source.pending); h.world.sites = restoredWorld.sites;
  h.tick(100 + ALERT.warning - 1); expect(h.enemies).toEqual([]);
  h.player.y += 3; h.tick();
  expect(h.enemies).toHaveLength(pending.points.length); expect(h.world.sites[0].pending).toBeNull();
  expect(h.world.sites[0].guardsRemaining).toBe(0);
  for (const enemy of h.enemies) {
    expect(enemy).toMatchObject({ kind: 'hunter', siteId: h.source.id, pressureKind: 'roaming', pressureIsland: h.island,
      behavior: 'investigating', investigation: { ...fixed, until: 100 + ALERT.warning + 30000 } });
    expect(enemy.targetId).toBeUndefined(); expect(enemy.investigation.y).not.toBe(h.player.y);
    expect(Math.hypot(enemy.x - enemy.rally.x, enemy.y - enemy.rally.y)).toBeLessThan(ALERT.pursuit);
    expect(Math.hypot(fixed.x - enemy.rally.x, fixed.y - enemy.rally.y)).toBeLessThan(ALERT.pursuit);
  }
});

it('revalidates the twelve-tile teammate buffer when a player moves toward a warning', () => {
  const h = setup(); expect(h.queue()).toBe(true);
  h.player.x = h.source.pending.points[0].x - 8;
  h.tick(); expect(h.enemies).toEqual([]); expect(h.source.pending).toBeNull();
});

it.each(['destroyed source', 'new fire', 'new wall'])('cancels unsafe roaming arrivals after %s', change => {
  const h = setup(); expect(h.queue()).toBe(true);
  if (change === 'destroyed source') { h.source.hp = 0; h.source.state = 'conquered'; }
  if (change === 'new wall') {
    h.world.mountains = Array(h.world.terrain.length).fill(0);
    for (let y = 0; y < h.world.height; y++) h.world.mountains[y * h.world.width + 75] = 2;
  }
  h.tick(undefined, undefined, () => change === 'new fire');
  expect(h.enemies).toEqual([]); expect(h.source.pending).toBeNull();
});

it.each(['pressure', 'roaming'])('cancels a pending %s call when its island has no eligible player', kind => {
  const h = setup();
  if (kind === 'roaming') expect(h.queue()).toBe(true);
  else expect(queuePressure(h.source, h.world, [], [h.player], [], ['hunter'], 100)).toBe(true);
  // Cancellation is immediate, even before the warning deadline or site wake check.
  h.source.awake = false; h.tick(101, []);
  expect(h.source.pending).toBeNull(); expect(h.enemies).toEqual([]);
});

it('keeps an island occupied by a physical aircraft, while shielded and orbital bodies do not reserve it', () => {
  const h = setup(); expect(h.queue()).toBe(true);
  h.world.airbases.push({ id: 'base', x: 10, y: 90, aircraft: { id: 'plane', occupant: 'pilot', x: 60.5, y: 60.5, state: 'flying' } });
  h.tick(101, [{ ...h.player, body: 'aircraft' }]); expect(h.source.pending).not.toBeNull();
  h.tick(102, [{ ...h.player, body: 'aircraft', shield: 2 }]); expect(h.source.pending).toBeNull();
  h.world.airbases = []; expect(h.queue()).toBe(true);
  h.tick(103, [{ ...h.player, body: 'orbital' }]); expect(h.source.pending).toBeNull();
});

it('caps roaming at six per island including sleeping units and other accepted warnings', () => {
  const h = setup();
  h.enemies.push(...[1, 2].map(id => roamingEnemy(id, h.island, h.source.id)));
  h.director.sleeping.push(...[3, 4].map(id => roamingEnemy(id, h.island, h.source.id)));
  const other: any = { ...makeSite('modifier', 'other-city', 30, 110), guardsRemaining: 0 };
  other.pending = { kind: 'roaming', pressureIsland: h.island, points: [{ x: 30.5, y: 105.5, kind: 'hunter' }], at: 100000 };
  h.world.sites.push(other);
  expect(h.queue()).toBe(true); h.tick();
  expect(h.enemies).toHaveLength(3);
  expect(h.enemies.length + h.director.sleeping.length + other.pending.points.length).toBe(6);
  expect(h.source.pending).toBeNull();
});

it('admits roaming beside a full city garrison while preserving the shared active-enemy cap', () => {
  const h = setup();
  for (let id = 1; id <= 6; id++) h.enemies.push({ ...newGroundEnemy('hunter', id, { x: id * 2 + 10, y: 20 }), siteId: h.source.id });
  expect(h.queue()).toBe(true); h.tick();
  expect(h.enemies.filter(e => e.pressureKind === 'roaming')).toHaveLength(2);
  const full = setup();
  for (let id = 1; id <= ALERT.globalMax - 1; id++) full.enemies.push(newGroundEnemy('hunter', id, { x: 10 + id, y: 20 }));
  expect(full.queue()).toBe(true); full.tick();
  expect(full.enemies).toHaveLength(ALERT.globalMax); expect(full.source.pending).toBeNull();
  const reserved = setup(); expect(reserved.queue()).toBe(true); reserved.tick(undefined, undefined, undefined, ALERT.globalMax);
  expect(reserved.enemies).toEqual([]);
});

it('uses admission only for fresh finite guards and excludes roaming from city compound capacity', () => {
  const h = setup(); h.source.guardsRemaining = 3; h.source.guardRoster = ['hunter', 'breaker', 'bulwark'];
  h.player.x = 104.5; h.player.y = 110.5;
  h.enemies.push(...[1, 2, 3, 4, 5, 6].map(id => roamingEnemy(id, h.island, h.source.id)));
  const denied = vi.fn(() => 0); h.tick(100, undefined, undefined, undefined, denied);
  expect(denied).toHaveBeenCalledWith(h.source, 'city'); expect(h.source.pending).toBeNull(); expect(h.source.guardsRemaining).toBe(3);
  const one = vi.fn(() => 1); h.tick(2200, undefined, undefined, undefined, one);
  expect(h.source.pending).toMatchObject({ kind: 'guards', pressureIsland: h.island }); expect(h.source.pending.points).toHaveLength(1);
  const laterDenied = vi.fn(() => 0); h.tick(2200 + ALERT.warning, undefined, undefined, undefined, laterDenied);
  expect(laterDenied).not.toHaveBeenCalled(); expect(h.source.guardsRemaining).toBe(2); expect(h.source.guardRoster).toEqual(['breaker', 'bulwark']);
  expect(h.enemies.filter(e => e.pressureKind !== 'roaming')).toHaveLength(1);
});
