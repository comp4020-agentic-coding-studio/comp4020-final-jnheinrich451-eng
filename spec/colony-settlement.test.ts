import { describe, expect, it } from 'vitest';
import { createColony } from '../public/colonization.js';
import { SETTLEMENT, SETTLEMENT_CATALOGUE, SETTLEMENT_STARTER, grantSettlementFurnishing, settlementAction, settlementAt, settlementBuildCost, settlementCells, settlementItems, settlementPlacementError, settlementProjectStatus, settlementStored, tickSettlement } from '../public/colony-settlement.js';
import { settlementDeliveryPose } from '../public/colony-settlement-art.js';

const actor: { id: string, players: Array<{x:number,y:number}> } = { id: 'iris', players: [] };
const guest: typeof actor = { id: 'moss', players: [] };
const garden = (): any => createColony('morrow-v1');
const command = (state: any, action: string, data: any, person = actor) => settlementAction(state, person, action, data);
const build = (state: any, kind: string, x: number, y: number, dir = 0) => {
  const result = command(state, 'build-furnishing', { kind, x, y, dir });
  return settlementItems(state).find((item: any) => item.id === result.targetId);
};
const ready = (state: any, kind: string, x: number, y: number, dir = 0) => { const item = build(state, kind, x, y, dir); tickSettlement(state, 8); return item; };

it('offers a usable original catalogue and starter kit without modifying an old save in previews', () => {
  const state = garden(), before = structuredClone(state);
  expect(SETTLEMENT_CATALOGUE).toHaveLength(24);
  expect(new Set(SETTLEMENT_CATALOGUE.map(x => x.id)).size).toBe(24);
  expect(settlementStored(state, 'stepping-stones')).toBe(6);
  expect(settlementBuildCost(state, 'bench')).toBe(0);
  expect(settlementPlacementError(state, 'bench', 30, 30)).toBeNull();
  expect(settlementProjectStatus(state).every(p => !p.claimed && !p.ready)).toBe(true);
  expect(state).toEqual(before);
  for (const kind of ['unknown', '__proto__', 'constructor']) {
    expect(() => build(state, kind, 30, 30)).toThrow('available furnishing');
    expect(state).toEqual(before);
  }
});

it('opens on every civilian world at home and leaves legacy expeditions unchanged', () => {
  for (const template of ['nacre-v1', 'aurelia-v1']) {
    const state: any = createColony(template);
    expect(build(state, 'bench', 30, 30).kind).toBe('bench');
    expect(settlementProjectStatus(state).find(p => p.id === 'planted-display')!.name).toBe(template === 'nacre-v1' ? 'A little of Nacre' : 'A little of Aurelia');
  }
  expect(settlementProjectStatus(garden()).find(p => p.id === 'planted-display')!.name).toBe('A little of Morrow');
  const legacy: any = createColony('caldera-v1'), before = structuredClone(legacy);
  expect(() => build(legacy, 'bench', 30, 30)).toThrow('Morrow, Nacre and Aurelia');
  expect(() => grantSettlementFurnishing(legacy, 'bench')).toThrow('furnishing');
  expect(legacy).toEqual(before);
  const state = garden(); state.regionId = 'woodland';
  expect(() => build(state, 'bench', 30, 30)).toThrow('home district');
});

it('grants bounded discovered furnishings to home storage without a public grant command', () => {
  const state = garden(), before = structuredClone(state);
  for (const amount of [0, -1, 1.5, 17, Number.NaN, Number.MAX_SAFE_INTEGER]) {
    expect(() => grantSettlementFurnishing(state, 'reed-planter', amount)).toThrow();
    expect(state).toEqual(before);
  }
  expect(() => grantSettlementFurnishing(state, '__proto__')).toThrow('furnishing');
  expect(state).toEqual(before);
  state.regionId = 'woodland';
  expect(grantSettlementFurnishing(state, 'reed-planter')).toEqual({ kind: 'reed-planter', amount: 1, stored: 1 });
  expect(settlementStored(state, 'bench')).toBe(1);
  state.regionId = 'home';
  const item = build(state, 'wayfinder', 30, 30);
  const revision = state.settlement.revision;
  grantSettlementFurnishing(state, 'flower-planter', 2);
  expect(settlementStored(state, 'flower-planter')).toBe(4);
  expect(() => command(state, 'settlement-undo', { revision })).toThrow('edit of yours');
  expect(settlementItems(state)[0].id).toBe(item.id);
  const afterGrant = structuredClone(state);
  expect(() => command(state, 'grant-furnishing', { kind: 'bench' })).toThrow('available settlement action');
  expect(state).toEqual(afterGrant);
  state.settlement.stored.bench = SETTLEMENT.itemLimit;
  const full = structuredClone(state);
  expect(() => grantSettlementFurnishing(state, 'bench')).toThrow('store cannot');
  expect(state).toEqual(full);
});

it('reserves a validated site and stock once, then assembles on the authoritative delivery clock', () => {
  const state = garden(), item = build(state, 'bench', 30, 30);
  expect(state.materials).toBe(40);
  expect(settlementStored(state, 'bench')).toBe(0);
  expect(item).toMatchObject({ x: 30, y: 30, status: 'delivery', revision: 0 });
  expect(settlementAt(state, 31, 30, { solidOnly: true }).id).toBe(item.id);
  expect(() => build(state, 'path-lamp', 31, 30)).toThrow('Leave room');
  const before = structuredClone(state);
  tickSettlement(state, 0); tickSettlement(state, -1); tickSettlement(state, Number.NaN);
  expect(state).toEqual(before);
  tickSettlement(state, 5.9); expect(item.status).toBe('delivery');
  const pose = settlementDeliveryPose(state, state.time);
  expect(pose?.crateVisible).toBe(true); expect(pose?.crateZ).toBeLessThan(.2);
  tickSettlement(state, .1); expect(item.status).toBe('ready');
  expect(() => command(state, 'furnishing-move', { itemId: item.id, revision: item.revision, x: 32, y: 30 })).toThrow('depart');
  tickSettlement(state, 2); expect(state.settlement.deliveries).toEqual([]);
  expect(state.materials).toBe(40);
});

it('continues one serialized queue after reload without charging or assembling twice', () => {
  const state = garden();
  build(state, 'wayfinder', 29, 30); build(state, 'flower-planter', 31, 30);
  expect(state.materials).toBe(38);
  tickSettlement(state, 3);
  const restored = JSON.parse(JSON.stringify(state));
  tickSettlement(restored, 5);
  expect(restored.settlement.items[0].status).toBe('ready');
  expect(restored.settlement.items[1].status).toBe('delivery');
  expect(restored.settlement.deliveries).toHaveLength(1);
  expect(restored.settlement.deliveries[0].elapsed).toBe(0);
  tickSettlement(restored, 8);
  expect(restored.settlement.items.every((item: any) => item.status === 'ready')).toBe(true);
  expect(restored.settlement.deliveries).toEqual([]);
  expect(restored.materials).toBe(38);
  tickSettlement(restored, 100); expect(restored.materials).toBe(38);
});

it('bounds the flight queue and rejects an unaffordable order without initializing a save', () => {
  const empty = garden(); empty.materials = 0;
  const before = structuredClone(empty);
  expect(() => build(empty, 'cabin', 29, 26)).toThrow('16 materials');
  expect(empty).toEqual(before);
  const state = garden();
  for (let i = 0; i < SETTLEMENT.queueLimit; i++) build(state, 'stepping-stones', 28 + i, 30);
  const full = structuredClone(state);
  expect(() => build(state, 'stepping-stones', 32, 30)).toThrow('four deliveries');
  expect(state).toEqual(full);
});

it('checks rotated footprints, workers, water, arrival, industry, garden and route safety', () => {
  const state = garden();
  expect(settlementCells('bench', 30, 30, 1)).toEqual([{ x: 30, y: 30 }, { x: 30, y: 31 }]);
  expect(settlementPlacementError(state, 'cabin', 35, 30)).toMatch(/arrival/);
  expect(settlementPlacementError(state, 'bench', 0, 0)).toMatch(/18-tile/);
  state.players = [{ x: 30.5, y: 30.5 }];
  expect(settlementPlacementError(state, 'bench', 30, 30)).toMatch(/worker/);
  expect(settlementPlacementError(state, 'stepping-stones', 30, 30)).toBeNull();
  state.players = [];
  state.beds.push({ x: 30, y: 30 });
  expect(settlementPlacementError(state, 'bench', 29, 30)).toMatch(/Leave room/);
  state.beds = [];
  state.industry = { machines: [{ kind: 'processor', x: 30, y: 30 }], belts: [] };
  expect(settlementPlacementError(state, 'bench', 29, 30)).toMatch(/Leave room/);
  // A narrow protected route cannot be cut by a solid furnishing.
  state.industry = undefined;
  state.world.terrain.fill(0);
  for(let x=27;x<=45;x++)state.world.terrain[32*state.world.width+x]=2;
  state.world.spawn={x:36.5,y:32.5};
  expect(settlementPlacementError(state, 'path-lamp', 31, 32)).toMatch(/walking route/);
  expect(settlementPlacementError(state, 'stepping-stones', 31, 32)).toBeNull();
});

describe('rearrangement and recovery', () => {
  it('moves and rotates without repaying and rejects a stale concurrent edit', () => {
    const state= garden(), item=ready(state,'bench',30,30), oldRevision=item.revision;
    command(state,'furnishing-move',{itemId:item.id,revision:item.revision,x:29,y:29});
    expect(state.materials).toBe(40); expect(item.x).toBe(29);
    const before=structuredClone(state);
    expect(()=>command(state,'furnishing-store',{itemId:item.id,revision:oldRevision},guest)).toThrow('changed');
    expect(state).toEqual(before);
    command(state,'furnishing-rotate',{itemId:item.id,revision:item.revision});
    expect(item.dir).toBe(1);expect(settlementAt(state,29,30).id).toBe(item.id);
  });
  it('stores and retrieves one copy without duplicating it or charging material', () => {
    const state=garden(),item=ready(state,'bench',30,30);
    command(state,'furnishing-store',{itemId:item.id,revision:item.revision});
    expect(settlementStored(state,'bench')).toBe(1);expect(settlementItems(state)).toHaveLength(0);
    command(state,'furnishing-retrieve',{kind:'bench',x:29,y:30});
    expect(settlementStored(state,'bench')).toBe(0);expect(settlementItems(state)).toHaveLength(1);expect(state.materials).toBe(40);
    const before=structuredClone(state);
    expect(()=>command(state,'furnishing-retrieve',{kind:'bench',x:31,y:30})).toThrow('no stored copy');
    expect(state).toEqual(before);
  });
  it('undoes only the latest unchanged edit by its actor and refunds its own cost/stock', () => {
    const state=garden(); build(state,'wayfinder',30,30);
    const revision=state.settlement.revision;
    expect(state.materials).toBe(38);
    expect(()=>command(state,'settlement-undo',{revision},guest)).toThrow('edit of yours');
    command(state,'settlement-undo',{revision});
    expect(state.materials).toBe(40);expect(settlementItems(state)).toEqual([]);expect(state.settlement.deliveries).toEqual([]);
    expect(()=>command(state,'settlement-undo',{revision})).toThrow('edit of yours');
    build(state,'bench',30,30);const beforeGuest=state.settlement.revision;
    command(state,'build-furnishing',{kind:'path-lamp',x:32,y:30},guest);
    expect(()=>command(state,'settlement-undo',{revision:beforeGuest})).toThrow('edit of yours');
    command(state,'settlement-undo',{revision:state.settlement.revision},guest);
    expect(settlementStored(state,'path-lamp')).toBe(SETTLEMENT_STARTER['path-lamp']);
    expect(settlementItems(state)).toHaveLength(1);
  });
  it('rejects restoring a solid furnishing over a worker and allows retry after they leave', () => {
    const state=garden(),item=ready(state,'bench',30,30);
    command(state,'furnishing-move',{itemId:item.id,revision:item.revision,x:28,y:30});
    const revision=state.settlement.revision,before=structuredClone(state);
    expect(()=>command(state,'settlement-undo',{revision},{id:actor.id,players:[{x:30.5,y:30.5}]})).toThrow('worker');
    expect(state).toEqual(before);
    command(state,'settlement-undo',{revision});expect(settlementAt(state,30,30).id).toBe(item.id);
  });
});

it('counts completed deliveries toward projects and claims each reward once', () => {
  const state=garden();
  for(let i=0;i<3;i++)build(state,'stepping-stones',29+i,30);
  build(state,'path-lamp',32,30);
  expect(settlementProjectStatus(state).find(p=>p.id==='lit-route')?.ready).toBe(false);
  tickSettlement(state,32);
  expect(settlementProjectStatus(state).find(p=>p.id==='lit-route')).toMatchObject({ready:true,claimed:false,current:4,total:4});
  command(state,'claim-settlement-project',{projectId:'lit-route'});
  expect(state.materials).toBe(48);
  const before=structuredClone(state);
  expect(()=>command(state,'claim-settlement-project',{projectId:'lit-route'},guest)).toThrow('already');
  expect(state).toEqual(before);
  expect(()=>command(state,'settlement-undo',{revision:state.settlement.revision})).toThrow('edit of yours');
});
