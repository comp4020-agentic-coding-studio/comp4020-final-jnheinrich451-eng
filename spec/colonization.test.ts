import { describe, expect, it } from 'vitest';
import { COLONY, CROPS, bedReady, colonyAction, colonyBuildCost, colonyCanStand, colonyPlacementError,
  colonyStored, createColony, stepColonyRobot, tickColony } from '../public/colonization.js';

const actor = { id: 'gardener', x: 36.5, y: 31.5 };
const other = { id: 'teammate', x: 40.5, y: 31.5 };
const templates = ['caldera-v1', 'vesper-v1', 'sirocco-v1'];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function garden(template = 'caldera-v1') {
  const state = createColony(template);
  colonyAction(state, actor, 'build-bed', { x: 31, y: 28 });
  return state;
}
function grow(state: any, crop = 'sundrop', index = 0) {
  const bed = state.beds[index];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop });
  colonyAction(state, actor, 'water', { bedId: bed.id });
  tickColony(state, 45);
  return bed;
}

it('creates independent peaceful surveyed districts for all three planet identities', () => {
  const terrain = new Set<string>();
  for (const template of templates) {
    const state = createColony(template), original = copy(state);
    expect(state).toEqual(createColony(template));
    expect(state.mode).toBe('colonization'); expect(state.template).toBe(template);
    expect(state.world.terrain).toHaveLength(COLONY.width * COLONY.height);
    expect(new Set(state.world.terrain)).toEqual(new Set([0, 1, 2, 3].filter(t => template !== 'sirocco-v1' || t !== 2)));
    expect(colonyCanStand(state, state.world.spawn.x, state.world.spawn.y)).toBe(true);
    expect(colonyPlacementError(state, 'bed', 31, 28)).toBeNull();
    expect(colonyPlacementError(state, 'sprinkler', 33, 28)).toBeNull();
    expect(state).not.toHaveProperty('combat'); expect(state).not.toHaveProperty('enemies');
    expect(state).not.toHaveProperty('supplies'); expect(state).not.toHaveProperty('groundSupplies');
    terrain.add(JSON.stringify(state.world.terrain));
    state.world.terrain[0] = 2; state.materials = 0;
    expect(createColony(template)).toEqual(original);
  }
  expect(terrain.size).toBe(3);
  expect(() => createColony('unknown')).toThrow('available planet');
});

it('pays once for validated footprints and shares installed equipment with teammates', () => {
  const state = garden(), bed = state.beds[0];
  expect(bed).toMatchObject({ id: 'bed-1', x: 31, y: 28, crop: null });
  expect(state.materials).toBe(40);
  colonyAction(state, other, 'build-sprinkler', { x: 33, y: 28 });
  expect(state.materials).toBe(40 - COLONY.sprinklerCost);
  expect(state.sprinklers[0].id).toBe('sprinkler-2');
  colonyAction(state, other, 'plant', { bedId: bed.id, crop: 'moonberry' });
  expect(bed.crop).toBe('moonberry');
});

it('keeps a free first bed available after spending the starter kit on sprinklers', () => {
  const state = createColony();
  for (const [x, y] of [[29, 24], [34, 24], [39, 24]]) colonyAction(state, actor, 'build-sprinkler', { x, y });
  expect(state.materials).toBe(4); expect(colonyBuildCost(state, 'bed')).toBe(0);
  expect(colonyPlacementError(state, 'bed', 31, 28)).toBeNull();
  colonyAction(state, actor, 'build-bed', { x: 31, y: 28 });
  expect(state.materials).toBe(4); expect(colonyBuildCost(state, 'bed')).toBe(COLONY.bedCost);
  const bed = grow(state); colonyAction(state, actor, 'harvest', { bedId: bed.id });
  colonyAction(state, actor, 'ship'); tickColony(state, COLONY.shipmentDuration);
  expect(state.materials).toBeGreaterThan(COLONY.bedCost);
});

it('rejects invalid or unaffordable placement before charging or reserving an id', () => {
  const state = garden();
  for (const [x, y] of [[31, 28], [32, 28], [36, 28], [43, 28], [0, 0], [51, 28], [-1, 28], [31.5, 28], [NaN, 28], [Infinity, 28]]) {
    const before = copy(state);
    expect(() => colonyAction(state, actor, 'build-bed', { x, y })).toThrow();
    expect(state).toEqual(before);
  }
  state.materials = COLONY.bedCost - 1;
  const before = copy(state);
  expect(() => colonyAction(state, actor, 'build-bed', { x: 31, y: 32 })).toThrow('materials');
  expect(state).toEqual(before);
});

it('checks every footprint tile, including terrain and the surveyed boundary', () => {
  const state = createColony();
  expect(colonyPlacementError(state, 'bed', 22, 28)).toContain('whole footprint');
  state.world.terrain[27 * state.world.width + 30] = 0;
  expect(colonyPlacementError(state, 'bed', 31, 28)).toContain('firm ground');
  expect(colonyPlacementError(state, 'sprinkler', 31, 28)).toBeNull();
  expect(colonyPlacementError(state, 'factory', 31, 28)).toContain('garden bed');
});

it('bounds the active gardening objects independently of existing military limits', () => {
  const state = createColony(); state.materials = 10000;
  for (let y = 16; y <= 40 && state.beds.length < COLONY.bedLimit; y += 3)
    for (let x = 24; x <= 48 && state.beds.length < COLONY.bedLimit; x += 3)
      if (!colonyPlacementError(state, 'bed', x, y)) colonyAction(state, actor, 'build-bed', { x, y });
  expect(state.beds).toHaveLength(COLONY.bedLimit);
  expect(colonyPlacementError(state, 'bed', 30, 30)).toContain(`${COLONY.bedLimit} beds`);
  for (let y = 16; y <= 40 && state.sprinklers.length < COLONY.sprinklerLimit; y++)
    for (let x = 24; x <= 48 && state.sprinklers.length < COLONY.sprinklerLimit; x++)
      if (!colonyPlacementError(state, 'sprinkler', x, y)) colonyAction(state, actor, 'build-sprinkler', { x, y });
  expect(state.sprinklers).toHaveLength(COLONY.sprinklerLimit);
  expect(colonyPlacementError(state, 'sprinkler', 30, 30)).toContain(`${COLONY.sprinklerLimit} sprinklers`);
});

it('keeps dry crops alive and awards no progress before watering', () => {
  const state = garden(), bed = state.beds[0];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' });
  tickColony(state, 1000);
  expect(bed.crop).toBe('sundrop'); expect(bed.growth).toBe(0);
  colonyAction(state, actor, 'water', { bedId: bed.id });
  tickColony(state, 44); expect(bedReady(bed)).toBe(false);
  tickColony(state, 1); expect(bedReady(bed)).toBe(true);
  tickColony(state, 10000); expect(bedReady(bed)).toBe(true);
  expect(bed.crop).toBe('sundrop'); expect(bed.water).toBe(0);
});

it('counts only the wet part of a tick and resumes a slow crop without resetting it', () => {
  const state = garden(), bed = state.beds[0];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'cloudmelon' });
  colonyAction(state, actor, 'water', { bedId: bed.id });
  tickColony(state, 200);
  expect(bed.growth).toBe(COLONY.waterDuration); expect(bed.water).toBe(0);
  colonyAction(state, other, 'water', { bedId: bed.id });
  tickColony(state, 60);
  expect(bed.growth).toBe(150); expect(bedReady(bed)).toBe(true);
  expect(bed.water).toBe(30);
});

it('preserves progress across serialization and ignores invalid elapsed durations', () => {
  const state = garden(), bed = grow(state);
  const saved = copy(state);
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) expect(tickColony(state, dt)).toBe(false);
  expect(state).toEqual(saved);
  const restored = copy(saved);
  expect(restored.time).toBe(45); expect(restored.beds[0]).toEqual(bed);
  expect(restored.beds[0].water).toBe(45);
  // Reload alone never converts elapsed wall time into active growth or income.
  expect(restored.materials).toBe(saved.materials);
});

it('waters only nearby beds and yields identical growth for long and short irrigation ticks', () => {
  const state = createColony();
  for (const x of [30, 25]) {
    colonyAction(state, actor, 'build-bed', { x, y: 33 });
    colonyAction(state, actor, 'plant', { bedId: state.beds.at(-1)!.id, crop: 'cloudmelon' });
  }
  colonyAction(state, actor, 'build-sprinkler', { x: 35, y: 33 });
  const split = copy(state);
  tickColony(state, 151);
  for (let i = 0; i < 151; i++) tickColony(split, 1);
  expect(state.beds).toEqual(split.beds);
  expect(bedReady(state.beds[0])).toBe(true);
  expect(state.beds[0].water).toBe(COLONY.waterDuration);
  expect(state.beds[1].growth).toBe(0); expect(state.beds[1].water).toBe(0);
});

it('allows a teammate to harvest exactly once and renews the free seed cycle', () => {
  const state = garden(), bed = grow(state), beforeMaterials = state.materials;
  colonyAction(state, other, 'harvest', { bedId: bed.id });
  expect(state.storage.sundrop).toBe(2); expect(bed.crop).toBeNull();
  expect(state.discovered).toEqual(['sundrop']); expect(state.milestones.firstHarvest).toBe(true);
  expect(() => colonyAction(state, actor, 'harvest', { bedId: bed.id })).toThrow('still growing');
  expect(state.storage.sundrop).toBe(2);
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' });
  expect(state.materials).toBe(beforeMaterials);
  expect(bed.crop).toBe('sundrop'); expect(bed.growth).toBe(0);
});

it('regrows berries without consuming seeds or duplicating a ripe harvest', () => {
  const state = garden(), bed = grow(state, 'moonberry');
  tickColony(state, 45);
  colonyAction(state, actor, 'harvest', { bedId: bed.id });
  expect(state.storage.moonberry).toBe(3); expect(bed.crop).toBe('moonberry'); expect(bed.growth).toBe(0);
  expect(() => colonyAction(state, other, 'harvest', { bedId: bed.id })).toThrow();
  colonyAction(state, other, 'water', { bedId: bed.id }); tickColony(state, 90);
  colonyAction(state, other, 'harvest', { bedId: bed.id });
  expect(state.storage.moonberry).toBe(6); expect(bed.harvests).toBe(2);
  expect(state.discovered).toEqual(['moonberry']);
});

it('replaces a regrowing crop without locking a bed or refunding building materials', () => {
  const state = garden(), bed = grow(state, 'moonberry');
  const materials = state.materials, water = bed.water;
  colonyAction(state, other, 'clear', { bedId: bed.id, revision: bed.revision });
  expect(bed.crop).toBeNull(); expect(bed.growth).toBe(0); expect(bed.water).toBe(water);
  expect(state.materials).toBe(materials); expect(colonyStored(state)).toBe(0);
  expect(() => colonyAction(state, actor, 'clear', { bedId: bed.id })).toThrow('already ready');
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'cloudmelon' });
  expect(bed.crop).toBe('cloudmelon');
});

it('retains ripe crops intact when shared storage cannot hold the full yield', () => {
  const state = garden(), bed = grow(state);
  state.storage.cloudmelon = COLONY.storageCapacity - 1;
  const before = copy(state);
  expect(() => colonyAction(state, actor, 'harvest', { bedId: bed.id })).toThrow('storage is full');
  expect(state).toEqual(before); expect(bedReady(bed)).toBe(true);
  colonyAction(state, actor, 'ship', { crop: 'cloudmelon' });
  colonyAction(state, actor, 'harvest', { bedId: bed.id });
  expect(colonyStored(state)).toBe(COLONY.storageCapacity - 1);
});

it('reserves a shipment once and completes its reward once across a mid-flight reload', () => {
  const state = garden(), bed = grow(state);
  colonyAction(state, actor, 'harvest', { bedId: bed.id });
  const beforeMaterials = state.materials;
  colonyAction(state, actor, 'ship');
  expect(state.storage.sundrop).toBe(0); expect(state.shipment?.cargo).toEqual({ sundrop: 2 });
  expect(state.materials).toBe(beforeMaterials); expect(state.shipments).toBe(0);
  const sent = copy(state);
  expect(() => colonyAction(state, other, 'ship')).toThrow('already carrying');
  expect(state).toEqual(sent);
  tickColony(state, 3); const restored = copy(state);
  tickColony(restored, 5);
  expect(restored.shipment).toBeNull(); expect(restored.shipments).toBe(1);
  expect(restored.materials).toBe(beforeMaterials + COLONY.shipmentReward);
  expect(restored.decorations.pennant).toBe(true); expect(restored.milestones.firstShipment).toBe(true);
  const delivered = copy(restored); tickColony(restored, 1000);
  expect(restored.materials).toBe(delivered.materials); expect(restored.shipments).toBe(1);
});

it('ships every crop variety and never consumes insufficient or unknown sample choices', () => {
  for (const crop of CROPS) {
    const state = createColony(); state.storage[crop.id] = 3;
    colonyAction(state, actor, 'ship', { crop: crop.id });
    expect(state.storage[crop.id]).toBe(1);
    expect(state.shipment?.cargo).toEqual({ [crop.id]: 2 });
  }
  const state = createColony(); state.storage.moonberry = 2;
  colonyAction(state, actor, 'ship'); expect(state.shipment?.cargo).toEqual({ moonberry: 2 });
  const empty = createColony(), before = copy(empty);
  expect(() => colonyAction(empty, actor, 'ship')).toThrow('two matching crops');
  expect(() => colonyAction(empty, actor, 'ship', { crop: 'prototype' })).toThrow();
  expect(empty).toEqual(before);
});

it('rejects malformed, stale and impossible commands without partial mutations', () => {
  const state = garden(), bed = state.beds[0];
  const cases: Array<[any, string, any]> = [
    [{ id: '' }, 'water', { bedId: bed.id }],
    [null, 'water', { bedId: bed.id }],
    [actor, 'plant', { bedId: bed.id, crop: '__proto__' }],
    [actor, 'water', { bedId: 'missing' }],
    [actor, 'water', { bedId: bed.id, revision: -1 }],
    [actor, 'water', { bedId: bed.id, revision: '0' }],
    [actor, 'water', null], [actor, 'water', []],
    [actor, 'fire', {}], [actor, 'build-bed', { x: '31', y: 32 }],
  ];
  for (const [who, action, data] of cases) {
    const before = copy(state);
    expect(() => colonyAction(state, who, action, data)).toThrow();
    expect(state).toEqual(before);
  }
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop', revision: 0 });
  expect(() => colonyAction(state, other, 'water', { bedId: bed.id, revision: 0 })).toThrow('changed');
  expect(() => colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'moonberry' })).toThrow('Harvest');
});

describe('peaceful robot movement', () => {
  it('walks over beds, small sprinklers and the pad but respects land and the solid hub', () => {
    const state = garden();
    colonyAction(state, actor, 'build-sprinkler', { x: 33, y: 28 });
    for (const [x, y] of [[31.5, 28.5], [33.5, 28.5], [43.5, 28.5]]) expect(colonyCanStand(state, x, y)).toBe(true);
    for (const [x, y] of [[36, 28], [0, 0], [NaN, 28], [55.5, 16.5]]) expect(colonyCanStand(state, x, y)).toBe(false);
  });

  it('normalizes diagonal input and substeps a long movement beside the hub', () => {
    const state = createColony(), robot = { ...state.world.spawn, angle: 0 };
    const start = copy(robot);
    expect(stepColonyRobot(state, robot, 1, 1, .1)).toBe(true);
    expect(Math.hypot(robot.x - start.x, robot.y - start.y)).toBeCloseTo(COLONY.robotSpeed * .1);
    const blocked = { x: 33.5, y: 27.5, angle: 0 };
    stepColonyRobot(state, blocked, 1, 0, 1);
    expect(blocked.x).toBeLessThan(35); expect(colonyCanStand(state, blocked.x, blocked.y)).toBe(true);
    const before = copy(robot);
    for (const [dx, dy, dt] of [[NaN, 0, .1], [1, 0, Infinity], [1, 0, -1], [1, 0, 2], [0, 0, .1]]) expect(stepColonyRobot(state, robot, dx, dy, dt)).toBe(false);
    expect(robot).toEqual(before);
  });
});
