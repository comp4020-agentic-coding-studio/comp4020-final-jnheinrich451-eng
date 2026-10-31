import { expect, it } from 'vitest';
import { islandAt } from '../public/island-pressure.js';
import { PRESSURE, pressureAllowance, pressureContext, updatePressure } from '../public/pressure-budget.js';

const makeWorld = (): any => ({ width: 200, height: 80,
  terrain: Array.from({ length: 200 * 80 }, (_, i) => i % 200 === 99 ? 0 : 2), sites: [] });
const contact = (id: string, x = 30, y = 30, medium?: string) => ({ id, x, y, medium });
const enemy = (id: string, x = 30, y = 30) => ({ id, x, y, hp: 10 });
const stateFor = (d: any, world: any, x = 30, y = 30) => d.pressure.islands[islandAt(world, x, y)!];

it('scales active clocks and exact replenishment by distinct island players, capped at four', () => {
  const world = makeWorld();
  for (const [count, multiplier] of [[1, 1], [2, 1.7], [3, 2.4], [4, 3.1], [6, 3.1]]) {
    const d: any = { rng: 123 }, players = Array.from({ length: count }, (_, i) => contact(String(i)));
    updatePressure(d, world, players.concat(players[0]), [], 0, 0, 0);
    const state = stateFor(d, world);
    expect(state.credit).toBe(2); expect(state.nextRoam).toBeNull(); expect(state.multiplier).toBe(multiplier);
    state.credit = 0;
    updatePressure(d, world, players, [], 1000, 1, 0);
    expect(state.clock).toBe(1000 * multiplier); expect(state.credit).toBeCloseTo(multiplier / 6, 12);
    expect(state.active).toBe(count); expect(d.rng).toBe(123);
  }
});

it('attenuates refill by nearby surviving required structures without amplifying two compounds', () => {
  const world = makeWorld(), d: any = {};
  world.sites = [
    { id: 'first-city', x: 30, y: 30, kind: 'alert', hp: 100, state: 'hostile' },
    { id: 'second-city', x: 40, y: 30, kind: 'mortar', hp: 0, state: 'conquered' },
    { id: 'remote', x: 75, y: 60, kind: 'alert', hp: 100, state: 'hostile' },
    { id: 'hive', x: 30, y: 35, kind: 'aquatic-hive', hp: 100, state: 'hostile' },
  ];
  const before = structuredClone(world), players = [contact('pilot')];
  updatePressure(d, world, players, [], 0, 0, 0); stateFor(d, world).credit = 0;
  updatePressure(d, world, players, [], 12000, 12, 0);
  expect(stateFor(d, world).strength).toBe(.5); expect(stateFor(d, world).credit).toBe(1);
  expect(Object.keys(d.pressure.islands)).toHaveLength(1); expect(world).toEqual(before);
});

it('does not accrue credit while globally full or absent, and never catches up from wall time', () => {
  const world = makeWorld(), d: any = {}, players = [contact('pilot')];
  updatePressure(d, world, players, [], 0, 0, 0); const state = stateFor(d, world); state.credit = .25;
  updatePressure(d, world, players, Array.from({ length: 22 }, (_, i) => enemy(String(i))), 3600000, 12, 2);
  expect(state.credit).toBe(.25); expect(state.clock).toBe(12000);
  state.nextRoam = 15000;
  updatePressure(d, world, [], [], 7200000, 120, 0);
  expect(state.credit).toBe(0); expect(state.clock).toBe(12000); expect(state.active).toBe(0); expect(state.nextRoam).toBeNull();
  updatePressure(d, world, players, [], 9000000, 1, 0);
  expect(state.credit).toBeCloseTo(1 / 6, 12); expect(state.clock).toBe(13000);
  updatePressure(d, world, players, [], 10000000, 120, 0);
  expect(state.credit).toBe(PRESSURE.creditCap);
});

it('refills cleared-town credit for sparse roaming while keeping its city strength zero', () => {
  const world = makeWorld(), d: any = {}, players = [contact('pilot')];
  world.sites = [
    { id: 'cleared-town', x: 30, y: 30, kind: 'alert', hp: 0, state: 'conquered' },
    { id: 'distant-source', x: 80, y: 60, kind: 'modifier', hp: 100, state: 'hostile' },
  ];
  updatePressure(d, world, players, [], 0, 0, 0); const state = stateFor(d, world); state.credit = 0;
  updatePressure(d, world, players, [], 12000, 12, 0);
  expect(state.strength).toBe(0); expect(state.credit).toBe(2);
});

it('shares the cap fairly across occupied landmasses and counts reserved source contexts', () => {
  const world = makeWorld(), d: any = {}, players = [contact('left'), contact('right', 130)];
  const left = islandAt(world, 30, 30)!, right = islandAt(world, 130, 30)!;
  const enemies = Array.from({ length: 10 }, (_, i) => enemy(String(i)));
  const pending = [{ x: 130, y: 30, pressureIsland: left }];
  const before = structuredClone(enemies);
  expect(pressureAllowance(d, world, players, enemies, pending, { x: 30, y: 30 }, 'raid', 13)).toBe(1);
  expect(pressureAllowance(d, world, players, enemies, pending, { x: 130, y: 30 }, 'city', 13)).toBe(12);
  expect(pressureAllowance(d, world, [players[0]], enemies, pending, { x: 130, y: 30 }, 'city', 13)).toBe(0);
  expect(pressureAllowance(d, world, players, enemies, pending, { x: 30, y: 30, pressureIsland: right }, 'city', 13)).toBe(12);
  // A second player in an existing context never creates a second quota.
  expect(pressureAllowance(d, world, players.concat(contact('left-two')), enemies, pending, { x: 130, y: 30 }, 'city', 13)).toBe(12);
  expect(enemies).toEqual(before);
});

it('rotates producers for a scarce island slot even when another island has spare capacity', () => {
  const world = makeWorld(), d: any = { pressure: { cursor: 4 } }, players = [contact('left'), contact('right', 130)];
  const enemies = Array.from({ length: 10 }, (_, i) => enemy(String(i))), pending = [{ x: 30, y: 30 }], point = { x: 30, y: 30 };
  expect(pressureAllowance(d, world, players, enemies, pending, point, 'city', 13)).toBe(0);
  expect(pressureAllowance(d, world, players, enemies, pending, point, 'aquatic', 13)).toBe(1);
  expect(pressureAllowance(d, world, players, enemies, pending, { x: 130, y: 30 }, 'city', 13)).toBe(12);
});

it('shares a separate sea bucket with surface ships and aircraft over ocean', () => {
  const world = makeWorld(), d: any = {};
  const players = [contact('land'), contact('ship', 30, 30, 'sea'), contact('plane', 99, 30, 'air')];
  expect(pressureContext(world, players[0])).toBe(islandAt(world, 30, 30));
  expect(pressureContext(world, players[1])).toBe('sea'); expect(pressureContext(world, players[2])).toBe('sea');
  updatePressure(d, world, players, [], 0, 0, 0);
  expect(d.pressure.islands.sea.multiplier).toBe(1.7);
  expect(pressureAllowance(d, world, players, [], [], { x: 99, y: 30 }, 'aquatic', 24)).toBe(12);
});

it('allocates integer context shares whose sum stays within the shared cap', () => {
  const world: any = { width: 9, height: 1, terrain: [2, 0, 2, 0, 2, 0, 2, 0, 2], sites: [] }, d: any = {};
  const players = [0, 2, 4, 6, 8].map((x, i) => contact(String(i), x, 0));
  const quotas = players.map(p => pressureAllowance(d, world, players, [], [], p, 'city', 24));
  expect(quotas).toEqual([5, 5, 5, 5, 4]);
  expect(quotas.reduce((sum, n) => sum + n, 0)).toBe(24);
});

it('rotates scarce admissions every two active seconds, starting with the raid producer', () => {
  const world = makeWorld(), d: any = {}, players = [contact('pilot')], point = { x: 30, y: 30 };
  const enemies = Array.from({ length: 21 }, (_, i) => enemy(String(i)));
  updatePressure(d, world, players, enemies, 0, 0, 0);
  for (let turn = 0; turn < PRESSURE.producers.length; turn++) {
    for (const producer of ['raid', 'city', 'roaming', 'aquatic']) {
      expect(pressureAllowance(d, world, players, enemies, [], point, producer, 3)).toBe(PRESSURE.producers[turn] === producer ? 3 : 0);
    }
    updatePressure(d, world, players, enemies, (turn + 1) * 2000, 2, 0);
  }
  expect(d.pressure.cursor).toBe(0);
  expect(pressureAllowance(d, world, players, enemies, [], point, 'city', 4)).toBe(0); // Actual free slots still win.
  expect(pressureAllowance(d, world, players, [], [], point, 'city', 24)).toBe(24);
});

it('never overbooks global capacity or shrinks existing enemies when a new island becomes occupied', () => {
  const world = makeWorld(), d: any = {}, players = [contact('left'), contact('right', 130)];
  const enemies = Array.from({ length: 23 }, (_, i) => enemy(String(i)));
  const before = structuredClone(enemies), right = { x: 130, y: 30 };
  expect(pressureAllowance(d, world, players, enemies, [], right, 'raid', 24)).toBe(1);
  expect(pressureAllowance(d, world, players, enemies, [{ ...right }], right, 'raid', 24)).toBe(0);
  expect(pressureAllowance(d, world, players, enemies, [], { x: 30, y: 30 }, 'raid', 24)).toBe(0);
  expect(enemies).toEqual(before);
});
