import { expect, it } from 'vitest';
import { createCombat } from '../public/combat.js';
import { createPlanetConquest, planetConquestStatus } from '../public/planet-conquest.js';
import { makeSite } from '../public/conquest.js';
import { makeAquaticHive, AQUATIC } from '../public/aquatic-hive.js';
import { newGroundEnemy } from '../public/enemy-profiles.js';
import { freshLife } from '../public/survival.js';

const world = (): any => ({ width: 200, height: 100, terrain: Array(20000).fill(2), spawn: { x: 40.5, y: 40.5 },
  sites: [], cores: [], tanks: [], ships: [], airbases: [], artillery: [], rails: [] });
const player = (): any => ({ id: 'pilot', x: 40.5, y: 40.5, body: 'robot', ...freshLife(), health: 10000, shield: 0 });
function advance(combat: any, seconds: number, people: any[] = []) {
  for (let i = 0; i < seconds * 10; i++) combat.tick(.1, [], people);
}
function finalBattle() {
  const w = world(), p = player();
  w.sites = [{ ...makeSite('modifier', 'last-root', 60, 40), hp: 1, guardsRemaining: 0 }];
  const saved = createCombat(w, null, null, 'final-battle').checkpoint();
  saved.enemies = [{ ...newGroundEnemy('hunter', 1, { x: 100.5, y: 40.5 }), siteId: 'last-root', homeX: 100.5, homeY: 40.5, hp: 23 }];
  saved.director.sleeping = [{ ...newGroundEnemy('hunter', 2, { x: 160.5, y: 80.5 }), siteId: 'last-root', homeX: 160.5, homeY: 80.5, hp: 17 }];
  saved.serial = 2;
  saved.sites[0].pending = { kind: 'pressure', at: 5000, points: [{ x: 55.5, y: 41.5, kind: 'hunter' }] };
  saved.frenzy = { id: 'pending-raid', source: 'natural', medium: 'ground', origin: { x: p.x, y: p.y }, phase: 'warning', until: 8000,
    members: [], points: [{ x: 30.5, y: 40.5, kind: 'hunter' }], orders: {}, nextPulse: 0, outcome: null };
  saved.director.lastEvent = 'pending-raid'; saved.director.nextRaid = 0;
  return { w, p, combat: createCombat(w, saved) };
}

it('requires a nonempty complete roster, including missing compound and standalone members', () => {
  expect(planetConquestStatus(createPlanetConquest([]), [])).toMatchObject({ state: 'contested', total: 0 });
  const a: any = { ...makeSite('modifier', 'a', 20, 20), state: 'conquered', hp: 0,
    settlement: { id: 'town', requiredIds: ['a', 'b'] }, encounter: { id: 'district', requiredIds: ['a', 'c'] } };
  const state = createPlanetConquest([a]);
  expect(planetConquestStatus(state, [a])).toMatchObject({ state: 'contested', total: 3, cleared: 1 });
  const members = [a, { ...a, id: 'b' }, { ...a, id: 'c' }];
  expect(planetConquestStatus(state, members).state).toBe('conquered');
  expect(planetConquestStatus(state, members.slice(0, 2)).state).toBe('contested');

  const w = world(); w.sites = [makeSite('modifier', 'independent-a', 20, 20), makeSite('modifier', 'independent-b', 50, 50)];
  const saved = createCombat(w).checkpoint(); saved.sites = [{ ...saved.sites[0], state: 'conquered', hp: 0 }];
  const restored = createCombat(world(), saved);
  expect(restored.snapshot().conquest).toEqual({ state: 'contested', total: 2, cleared: 1, survivors: 0 });
  expect(restored.checkpoint().planetConquest.requiredIds).toEqual(['independent-a', 'independent-b']);
});

it('final HE conquest cancels unborn arrivals, rejects every manual enemy spawn and keeps survivors across restart', () => {
  const { w, p, combat } = finalBattle();
  expect(combat.shoot({ id: p.id, x: 57, y: 41.5 }, 61.5, 41.5, 'HE')).toBeNull();
  advance(combat, 1, [p]);
  expect(combat.snapshot().conquest).toEqual({ state: 'conquered', total: 1, cleared: 1, survivors: 2 });
  const saved = combat.checkpoint();
  expect(saved.sites[0].pending).toBeNull();
  expect(saved.frenzy).toMatchObject({ phase: 'complete', outcome: 'planet_conquered', points: [] });
  expect(saved.director.deferred).toBe('planet_conquered');
  expect(combat.snapshot().encounters!.nextRaid).toBeNull();
  expect(combat.start([])).toContain('Planet conquered');
  expect(combat.startFrenzy(p, [], [p])).toContain('Planet conquered');
  expect(combat.contact({})).toContain('Planet conquered');
  expect(combat.drainEvents().filter((e: any) => e.event === 'planet.conquered')).toHaveLength(1);

  const resumed = createCombat(structuredClone(w), saved, null, 'ignored-new-seed');
  expect(resumed.snapshot().conquest).toEqual(combat.snapshot().conquest);
  const elapsed = saved.director.elapsed, sequence = saved.director.sequence;
  advance(resumed, 360, [p]);
  expect(resumed.snapshot().enemies.map((e: any) => [e.id, e.hp]).sort()).toEqual([[1, 23], [2, 17]]);
  expect(resumed.checkpoint().director).toMatchObject({ elapsed, sequence });
  expect(resumed.drainEvents().filter((e: any) => e.event === 'planet.conquered')).toHaveLength(0);
  expect(resumed.snapshot().conquest.survivors).toBe(2);
});

it('accepted player artillery still arrives after conquest and can clear sleeping survivors', () => {
  const { w, p, combat } = finalBattle();
  expect(combat.lob({ id: 'rail-gun', x: 20.5, y: 80.5 }, 160.5, 80.5)).toBeNull();
  expect(combat.shoot({ id: p.id, x: 57, y: 41.5 }, 61.5, 41.5, 'HE')).toBeNull();
  advance(combat, 1, [p]);
  expect(combat.snapshot().conquest.state).toBe('conquered');
  expect(combat.snapshot().salvos).toHaveLength(1);
  const resumed = createCombat(structuredClone(w), combat.checkpoint());
  advance(resumed, 20, [p]);
  expect(resumed.snapshot().salvos).toHaveLength(0);
  expect(resumed.snapshot().enemies.some((e: any) => e.id === 2)).toBe(false);
  expect(resumed.snapshot().conquest).toMatchObject({ state: 'conquered', survivors: 1 });
});

it('preserves surviving drill units when a running drill fails after conquest, but retains ordinary pre-conquest cleanup', () => {
  for (const complete of [false, true]) {
    const w = world(); w.sites = [makeSite('modifier', 'objective', 60, 40)];
    const saved = createCombat(w).checkpoint();
    saved.status = 'active'; saved.health = 0; saved.serial = 9;
    saved.enemies = [newGroundEnemy('hunter', 9, { x: 80.5, y: 40.5 })];
    if (complete) { saved.sites[0].state = 'conquered'; saved.sites[0].hp = 0; }
    const resumed = createCombat(w, saved); resumed.tick(0, []);
    expect(resumed.snapshot().status).toBe('failed');
    expect(resumed.snapshot().enemies).toHaveLength(complete ? 1 : 0);
    if (complete) {
      expect(resumed.snapshot().enemies[0]).toMatchObject({ id: 9, hp: 60 });
      expect(resumed.snapshot().conquest).toMatchObject({ state: 'conquered', survivors: 1 });
      const again = createCombat(structuredClone(w), resumed.checkpoint()); again.tick(.1, []);
      expect(again.snapshot().enemies[0]).toMatchObject({ id: 9, hp: 60 });
    }
  }
});

it('adopts legacy objectives, stops aquatic production, and resolves an already fired hostile shot after victory', () => {
  const w = world(); w.terrain.fill(0);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 60; x++) w.terrain[y * 200 + x] = 2;
  w.sites = [makeAquaticHive('last-hive', 61, 40)];
  const saved: any = createCombat(w, null, null, 'aquatic-finale').checkpoint(); delete saved.planetConquest;
  saved.sites[0].state = 'conquered'; saved.sites[0].hp = 0; saved.sites[0].conqueredAt = 0;
  saved.sites[0].aquatic.nextSpawn = 0; saved.director.nextRaid = 0;
  const p = { ...player(), x: 58.5, y: 41.5, health: 100 };
  saved.acidShells = [{ id: 7, weapon: 'BILE', sourceId: 'lost-spitter', fromX: 63, fromY: 41.5, x: p.x, y: p.y,
    at: 0, landAt: 1000, impacted: false }]; saved.serial = 7;
  const combat = createCombat(w, saved);
  expect(combat.snapshot().conquest).toMatchObject({ state: 'conquered', total: 1, survivors: 0 });
  advance(combat, 2, [p]);
  expect(p.health).toBe(100 - AQUATIC.damage);
  advance(combat, 60, [p]);
  expect(combat.snapshot().enemies).toHaveLength(0);
  expect(combat.checkpoint().planetConquest.requiredIds).toEqual(['last-hive']);
  expect(combat.drainEvents().filter((e: any) => e.event === 'planet.conquered')).toHaveLength(1);
});
