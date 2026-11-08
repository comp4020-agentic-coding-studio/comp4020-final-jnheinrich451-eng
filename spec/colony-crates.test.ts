import { describe, expect, it } from 'vitest';
import { COLONY, CROPS, colonyAction, colonyPlacementError, createColony, tickColony } from '../public/colonization.js';
import { INDUSTRY, industryItems, industryStatus } from '../public/colony-industry.js';
import { CRATES, carrier, collectCrate, crateItems, dronePose, nearestCrate, unloadCrates } from '../public/colony-crates.js';
import { regionAction, regionView } from '../public/colony-regions.js';

const actor = { id: 'worker', x: 36.5, y: 31.5, players: [] as any[] };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function garden(): any { const state: any = createColony('morrow-v1'); state.players = []; return state; }
function shipped(state: any) {
  colonyAction(state, actor, 'build-bed', { x: 32, y: 31 });
  const bed = state.beds[0];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop', revision: bed.revision });
  colonyAction(state, actor, 'water', { bedId: bed.id, revision: bed.revision });
  bed.growth = CROPS[0].growTime;
  colonyAction(state, actor, 'harvest', { bedId: bed.id, revision: bed.revision });
  colonyAction(state, actor, 'ship');
  return bed;
}
const beside = (crate: any) => ({ id: 'beside', x: crate.x + .5, y: crate.y + 1.4 });

describe('material crates', () => {
  it('lands a shuttle reward as crates beside the pad, in a fixed order, without crediting materials', () => {
    const state = garden(); shipped(state);
    const materials = state.materials, time = state.time;
    tickColony(state, COLONY.shipmentDuration + 1);
    expect(state.shipment).toBeNull(); expect(state.materials).toBe(materials);
    const crates = crateItems(state);
    expect(crates.reduce((sum: number, crate: any) => sum + crate.materials, 0)).toBe(COLONY.shipmentReward);
    expect(crates.every((crate: any) => crate.materials === CRATES.materials)).toBe(true);
    for (const crate of crates) {
      expect(Math.max(Math.abs(crate.x - state.pad.x), Math.abs(crate.y - state.pad.y))).toBeGreaterThanOrEqual(CRATES.ringMin);
      expect(Math.abs(crate.x - state.pad.x) <= 1 && Math.abs(crate.y - state.pad.y) <= 1).toBe(false);
      expect(crate.placedAt).toBeGreaterThanOrEqual(time);
    }
    const again = garden(); shipped(again); tickColony(again, COLONY.shipmentDuration + 1);
    expect(crateItems(again).map((c: any) => [c.x, c.y])).toEqual(crates.map((c: any) => [c.x, c.y]));
    expect(copy(state).crates).toEqual(state.crates);
  });

  it('never loses a reward: a full landing area or the crate limit credits materials directly', () => {
    const state = garden();
    for (let i = 0; i < CRATES.limit; i++) state.crates = [...(state.crates || []), { id: `seed-${i}`, x: 1 + i, y: 1, materials: 1, placedAt: 0 }];
    const materials = state.materials;
    expect(unloadCrates(state, 11)).toBe(0);
    expect(state.materials).toBe(materials + 11); expect(crateItems(state)).toHaveLength(CRATES.limit);
    const small = garden(); unloadCrates(small, 6);
    expect(crateItems(small).map((c: any) => c.materials)).toEqual([4, 2]);
    expect(unloadCrates(small, 0)).toBe(0);
  });

  it('collects only within reach from the home district, once, and reports the amount', () => {
    const state = garden(); shipped(state); tickColony(state, COLONY.shipmentDuration + 1);
    const crate = crateItems(state)[0], before = copy(state);
    expect(() => colonyAction(state, { id: 'far', x: 10.5, y: 10.5 } as any, 'collect-crate', { crateId: crate.id })).toThrow('Walk up to the crate');
    expect(() => colonyAction(state, { id: 'nowhere' }, 'collect-crate', { crateId: crate.id })).toThrow('Walk up to the crate');
    expect(() => colonyAction(state, { ...beside(crate), regionId: 'blossom-grove' } as any, 'collect-crate', { crateId: crate.id })).toThrow('home district');
    expect(() => colonyAction(state, beside(crate), 'collect-crate', { crateId: 7 })).toThrow('Choose a crate');
    expect(state).toEqual(before);
    const result = colonyAction(state, beside(crate), 'collect-crate', { crateId: crate.id });
    expect(result.message).toBe('Collected 4 materials.'); expect(state.materials).toBe(before.materials + 4);
    expect(crateItems(state)).toHaveLength(3);
    expect(() => collectCrate(state, beside(crate), crate.id)).toThrow('already been collected');
    expect((nearestCrate as any)(state, crate.x + .5, crate.y + .5, .5)).toBeNull();
    expect((nearestCrate as any)(state, state.pad.x + .5, state.pad.y + .5, 3)?.id).toBe(crateItems(state)[0].id);
  });

  it('blocks every construction kind on a crate tile until it is collected, and never blocks walking', () => {
    const state = garden(); shipped(state); tickColony(state, COLONY.shipmentDuration + 1);
    const crate = crateItems(state).find((c: any) => Math.abs(c.x - state.pad.x) > 1 || Math.abs(c.y - state.pad.y) > 1)!;
    expect(colonyPlacementError(state, 'sprinkler', crate.x, crate.y)).toBe('Collect the crate first.');
    expect(colonyPlacementError(state, 'belt', crate.x, crate.y)).toBe('Collect the crate first.');
    expect(colonyPlacementError(state, 'stepping-stones', crate.x, crate.y)).toBe('Collect the crate first.');
    expect(() => colonyAction(state, actor, 'build-sprinkler', { x: crate.x, y: crate.y })).toThrow('Collect the crate first.');
    colonyAction(state, beside(crate), 'collect-crate', { crateId: crate.id });
    expect(colonyPlacementError(state, 'sprinkler', crate.x, crate.y)).toBeNull();
  });

  it('collectors need power, spend one unit per crate, take 2.5 s each, share crates and yield to hand collection', () => {
    const state = garden(); shipped(state); tickColony(state, COLONY.shipmentDuration + 1);
    const built = colonyAction(state, actor, 'build-industry', { kind: 'collector', x: 40, y: 32, dir: 1 });
    const collector = industryItems(state).find(m => m.id === built.targetId); state.industry.energy = 0; // starter reserve spent
    expect(collector).toMatchObject({ kind: 'collector', task: null, cost: 10 });
    expect(industryStatus(state, collector)).toBe('Needs power');
    const materials = state.materials; tickColony(state, 5);
    expect(state.materials).toBe(materials); expect(crateItems(state)).toHaveLength(4);
    state.industry.energy = 2;
    tickColony(state, 1);
    expect(industryStatus(state, collector)).toBe('Collecting'); expect(collector.task).toMatchObject({ elapsed: 1, duration: INDUSTRY.collectorSeconds });
    expect(state.industry.energy).toBe(1);
    const claimed = crateItems(state).find((c: any) => c.id === collector.task.crateId)!;
    // A worker takes the claimed crate by hand: the collector's task ends and the energy stays spent.
    colonyAction(state, beside(claimed), 'collect-crate', { crateId: claimed.id });
    expect(collector.task).toBeNull(); expect(state.materials).toBe(materials + 4);
    tickColony(state, 2.4); expect(collector.task?.elapsed).toBeCloseTo(2.4); expect(state.materials).toBe(materials + 4);
    tickColony(state, .2); expect(collector.task).toBeNull(); expect(state.materials).toBe(materials + 8);
    expect(state.industry.energy).toBe(0); expect(industryStatus(state, collector)).toBe('Needs power');
    // Two collectors never claim the same crate.
    const second = colonyAction(state, actor, 'build-industry', { kind: 'collector', x: 40, y: 24, dir: 1 });
    const other = industryItems(state).find(m => m.id === second.targetId);
    state.industry.energy = 10; tickColony(state, .5);
    expect(collector.task.crateId).not.toBe(other.task.crateId);
    tickColony(state, 3);
    expect(crateItems(state)).toHaveLength(0); expect(state.materials).toBe(materials + 16 - 10);
    expect(industryStatus(state, collector)).toBe('Waiting for crates');
    colonyAction(state, actor, 'industry-remove', { machineId: other.id, revision: other.revision });
    expect(industryItems(state)).toHaveLength(1); expect(state.materials).toBe(materials + 16);
  });

  it('sends the warehouse drone to every crate in the district, free of power, and credits on its return', () => {
    const state = garden(); shipped(state); tickColony(state, COLONY.shipmentDuration + 1);
    const kinds: any = INDUSTRY.kinds; expect(kinds.belt.hidden && kinds.collector.hidden && !kinds.warehouse.hidden).toBe(true);
    const built = colonyAction(state, actor, 'build-industry', { kind: 'warehouse', x: 40, y: 33, dir: 1 });
    const warehouse = industryItems(state).find(m => m.id === built.targetId);
    expect(warehouse).toMatchObject({ kind: 'warehouse', task: null, cost: 14 });
    expect(colonyPlacementError(state, 'sprinkler', 42, 35)).not.toBeNull(); // the 3 x 3 footprint is solid
    const materials = state.materials, crates = crateItems(state), energy = state.industry.energy = 0;
    expect(industryStatus(state, warehouse)).toBe('Sending drone');
    tickColony(state, .1);
    // The drone takes the nearest crate first, from the warehouse centre.
    const first = crateItems(state).find((c: any) => c.id === warehouse.task.crateId)!;
    expect(first).toBe([...crates].sort((a: any, b: any) => Math.hypot(a.x + .5 - 41.5, a.y + .5 - 34.5) - Math.hypot(b.x + .5 - 41.5, b.y + .5 - 34.5))[0]);
    expect(warehouse.task).toMatchObject({ phase: 'out', from: { x: 41.5, y: 34.5 }, to: { x: first.x + .5, y: first.y + .5 } });
    expect(industryStatus(state, warehouse)).toBe('Drone fetching'); expect(state.industry.energy).toBe(energy);
    const pose = dronePose(state, warehouse); expect(pose).toMatchObject({ carrying: false, phase: 'out' }); expect(pose!.z).toBeGreaterThan(1);
    const out = warehouse.task.duration; expect(out).toBeGreaterThanOrEqual(INDUSTRY.droneMinSeconds);
    tickColony(state, out);
    expect(warehouse.task).toMatchObject({ phase: 'back', crateId: first.id }); expect(industryStatus(state, warehouse)).toBe('Drone returning');
    // A carried crate is out of reach of hands and the prompt.
    expect(carrier(state, first.id)?.id).toBe(warehouse.id);
    expect(() => colonyAction(state, beside(first), 'collect-crate', { crateId: first.id })).toThrow('drone is already carrying');
    expect(nearestCrate(state, first.x + .5, first.y + .5, 1)?.id).not.toBe(first.id);
    expect(dronePose(state, warehouse)!.carrying).toBe(true);
    tickColony(state, warehouse.task.duration);
    expect(state.materials).toBe(materials + first.materials); expect(crateItems(state)).toHaveLength(crates.length - 1);
    // Taking a crate by hand while the drone flies out turns it around empty, and a paused warehouse keeps its drone home.
    tickColony(state, .1); const target = crateItems(state).find((c: any) => c.id === warehouse.task.crateId)!;
    colonyAction(state, beside(target), 'collect-crate', { crateId: target.id });
    expect(warehouse.task).toMatchObject({ phase: 'back', crateId: null });
    tickColony(state, 5); expect(warehouse.task?.crateId ?? null).not.toBe(target.id);
    colonyAction(state, actor, 'industry-toggle', { machineId: warehouse.id, revision: warehouse.revision });
    const frozen = copy([crateItems(state), warehouse.task, state.materials]);
    tickColony(state, 5); expect(copy([crateItems(state), warehouse.task, state.materials])).toEqual(frozen);
    colonyAction(state, actor, 'industry-toggle', { machineId: warehouse.id, revision: warehouse.revision });
    tickColony(state, 30); expect(crateItems(state)).toHaveLength(0); expect(state.materials).toBe(materials + 16);
    expect(industryStatus(state, warehouse)).toBe('Open');
    colonyAction(state, actor, 'industry-remove', { machineId: warehouse.id, revision: warehouse.revision });
    expect(state.materials).toBe(materials + 16 + 14);
  });

  it('keeps crates off remote district views and survives a JSON round trip mid-task', () => {
    const state = garden(); shipped(state); tickColony(state, COLONY.shipmentDuration + 1);
    colonyAction(state, actor, 'build-industry', { kind: 'collector', x: 40, y: 32, dir: 1 });
    state.industry.energy = 5; tickColony(state, 1);
    const restored = copy(state); tickColony(restored, 2); tickColony(state, 2);
    expect(restored.materials).toBe(state.materials); expect(restored.crates).toEqual(state.crates);
    expect(regionView(state, 'home').crates).toEqual(state.crates);
    regionAction(state, { id: 'surveyor', regionId: 'home', x: 36.5, y: 31.5, angle: 0 }, 'travel-region', { destination: 'blossom-grove' });
    expect(regionView(state, 'blossom-grove').crates).toEqual([]);
  });
});
