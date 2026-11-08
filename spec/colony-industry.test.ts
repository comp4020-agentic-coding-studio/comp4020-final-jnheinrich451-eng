import { describe, expect, it } from 'vitest';
import { COLONY, colonyAction, colonyCanStand, colonyPlacementError, createColony, tickColony, CROPS } from '../public/colonization.js';
import { INDUSTRY, INDUSTRY_RECIPES, industryAt, industryItems, industryPlacementError, industryStatus, industryStored, loadChoice, machinePorts, nextIndustryDirection, tickIndustry } from '../public/colony-industry.js';
import { cropById } from '../public/colony-crops.js';

const actor = { id: 'industry-worker', players: [] };
const garden = (): any => createColony('morrow-v1');
const build = (state: any, kind: string, x: number, y: number, dir = 1): any => {
  const result = colonyAction(state, actor, 'build-industry', { kind, x, y, dir });
  return industryItems(state).find(machine => machine.id === result.targetId);
};
const command = (state: any, machine: any, action: string, data = {}) => colonyAction(state, actor, action, { machineId: machine.id, revision: machine.revision, ...data });
const load = (state: any, machine: any, item: string, amount = 1) => command(state, machine, 'industry-load', { item, amount });
const advance = (state: any, seconds: number) => tickIndustry(state, seconds, CROPS);
// Paused belts on every port keep cargo waiting inside a machine; a free OUT side would hand it to the reserve.
const seal = (state: any, machine: any) => { for (const port of Object.values(machinePorts(machine)) as any[]) state.industry.belts.push({ id: `seal-${state.nextId++}`, kind: 'belt', x: port.x, y: port.y, dir: machine.dir, revision: 0, enabled: false, cost: 1, item: null, progress: 0 }); };

it('leaves existing saves and previews untouched and initializes only an affordable valid build', () => {
  const state = garden(), before = structuredClone(state);
  expect(industryItems(state)).toEqual([]); expect(industryStored(state, 'biomass')).toBe(0);
  expect(industryPlacementError(state, 'processor', 30, 30)).toBeNull();
  expect(state).toEqual(before);
  for (const kind of ['bad', 'constructor', '__proto__']) expect(() => build(state, kind, 30, 30)).toThrow('Choose an industrial');
  // The arrival tile may be built over: the runtime walks an arriving worker to clear ground.
  expect(industryPlacementError(state, 'processor', 36, 31)).toBeNull();
  expect(state).toEqual(before);
  const processor = build(state, 'processor', 30, 30);
  expect(state.industry).toMatchObject({ version: 1, energy: INDUSTRY.starterEnergy, starter: true, storage: { provisions: 0, biomass: 0 } });
  expect(state.materials).toBe(24); expect(processor).toMatchObject({ kind: 'processor', input: {}, output: {}, job: null, cost: 16 });
});

it('affords a free first bed, generator, processor, outlet and six conveyors from the starter kit', () => {
  const state = garden(); colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  build(state, 'outlet', 33, 32); build(state, 'processor', 40, 32); build(state, 'generator', 40, 34, 2); // all inside the conditioned starting clearing
  for (let x = 34; x < 40; x++) build(state, 'belt', x, 32);
  expect(state.materials).toBe(0); expect(industryItems(state)).toHaveLength(9);
  expect(() => build(state, 'belt', 39, 34)).toThrow('1 materials');
});

describe('food processing', () => {
  for (const recipe of INDUSTRY_RECIPES) it(`converts exactly one ${recipe.id} batch using its stated active energy`, () => {
    const state = garden(), machine = build(state, 'processor', 30, 30); seal(state, machine);
    state.storage[recipe.id] = recipe.input; state.industry.energy = 0;
    load(state, machine, recipe.id, recipe.input);
    advance(state, 30); expect(machine.input[recipe.id]).toBe(recipe.input); expect(machine.job).toBeNull();
    state.industry.energy = recipe.seconds;
    advance(state, recipe.seconds / 2);
    expect(machine.job.elapsed).toBeCloseTo(recipe.seconds / 2); expect(machine.output).toEqual({});
    advance(state, recipe.seconds / 2);
    expect(machine.job).toBeNull(); expect(machine.output).toEqual({ provisions: recipe.provisions, biomass: recipe.biomass });
    expect(state.industry.energy).toBeCloseTo(0); expect(machine.input[recipe.id]).toBe(0);
    advance(state, 30); expect(machine.output.provisions).toBe(recipe.provisions);
  });
  it('retains unprocessed crops when an output is full, and resumes after unloading', () => {
    const state = garden(), machine = build(state, 'processor', 30, 30); seal(state, machine);
    state.industry.energy = 120; state.storage.sundrop = 4; load(state, machine, 'sundrop', 4);
    machine.output = { provisions: 8, biomass: 1 };
    advance(state, 30);
    expect(machine.input.sundrop).toBe(4); expect(machine.job).toBeNull(); expect(industryStatus(state, machine)).toBe('Output full');
    command(state, machine, 'industry-unload');
    expect(state.industry.storage).toEqual({ provisions: 8, biomass: 1 }); expect(state.storage.sundrop).toBe(4);
    load(state, machine, 'sundrop', 2); advance(state, 12); expect(machine.output.provisions).toBe(2);
  });
  it('recovers an interrupted batch exactly once, without refunding spent power', () => {
    const state = garden(), machine = build(state, 'processor', 30, 30);
    state.storage.sundrop = 2; state.industry.energy = 20; load(state, machine, 'sundrop', 2); advance(state, 4);
    const revision = machine.revision;
    command(state, machine, 'industry-unload');
    expect(state.storage.sundrop).toBe(2); expect(state.industry.energy).toBeCloseTo(16); expect(machine.job).toBeNull();
    expect(() => colonyAction(state, actor, 'industry-unload', { machineId: machine.id, revision })).toThrow('changed');
    command(state, machine, 'industry-remove'); expect(state.materials).toBe(40); expect(state.storage.sundrop).toBe(2);
  });
});

describe('one job per machine', () => {
  it('starts every expedition with a charged reserve exactly once and cooks whichever crop it holds most of', () => {
    const state = garden(), processor = build(state, 'processor', 30, 30); seal(state, processor);
    expect(state.industry.energy).toBe(INDUSTRY.starterEnergy);
    // A save from before the starter reserve receives it once on its next tick, never again.
    const old = structuredClone(state); delete old.industry.starter; old.industry.energy = 100;
    advance(old, .1); expect(old.industry.energy).toBeCloseTo(INDUSTRY.energyCapacity); expect(old.industry.starter).toBe(true);
    old.industry.energy = 10; advance(old, .1); expect(old.industry.energy).toBeCloseTo(10);
    // No recipe to choose: the processor cooks the crop with the most stock, then the rest.
    expect(() => command(state, processor, 'industry-recipe', { recipe: 'moonberry' })).toThrow('Unknown');
    state.storage.sundrop = 5; state.storage.moonberry = 7; state.industry.storage.biomass = 2;
    expect(loadChoice(state, processor)).toEqual({ item: 'moonberry', amount: 4 });
    load(state, processor, 'sundrop', 2); load(state, processor, 'moonberry', 3);
    advance(state, .1); expect(processor.job.crop).toBe('moonberry');
    advance(state, 18); expect(processor.job.crop).toBe('sundrop'); expect(processor.input).toEqual({ sundrop: 0, moonberry: 1 });
    advance(state, 12); expect(processor.job).toBeNull(); expect(industryStatus(state, processor)).toBe('Needs crops');
    expect(processor.output).toEqual({ provisions: 5, biomass: 2 });
    const generator = build(state, 'generator', 34, 30);
    expect(loadChoice(state, generator)).toEqual({ item: 'biomass', amount: 2 });
    state.industry.storage.biomass = 0; expect(loadChoice(state, generator)).toEqual({ item: 'moonberry', amount: 4 });
    state.storage.moonberry = 0; state.storage.sundrop = 0; expect(loadChoice(state, generator)).toBeNull();
  });
});

it('hands cargo from a free OUT side to the shared reserve and rotates an outlet past its bed', () => {
  const state = garden(); colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  const bed = state.beds[0], outlet = build(state, 'outlet', 33, 32, 2);
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'moonberry' }); bed.growth = 150;
  advance(state, .5);
  expect(bed.harvests).toBe(1); expect(outlet.output.moonberry || 0).toBe(0); expect(state.storage.moonberry).toBe(cropById('moonberry')!.yield);
  // Clockwise from South would point West into the bed: Rotate skips to North.
  expect(nextIndustryDirection(state, outlet)).toBe(0);
  command(state, outlet, 'industry-rotate', { dir: nextIndustryDirection(state, outlet) }); expect(outlet.dir).toBe(0);
  expect(nextIndustryDirection(state, outlet)).toBe(1);
  expect(() => command(state, outlet, 'industry-rotate', { dir: 3 })).toThrow('away from its garden bed');
  // A processor with nothing on its OUT sides sends provisions and biomass to the reserve too.
  const processor = build(state, 'processor', 40, 32); state.industry.energy = 30; state.storage.sundrop = 2; load(state, processor, 'sundrop', 2);
  advance(state, 13); expect(processor.output).toEqual({ provisions: 0, biomass: 0 }); expect(state.industry.storage).toEqual({ provisions: 2, biomass: 1 });
  // Something on the OUT side keeps priority: a paused belt holds the cargo inside.
  seal(state, processor); state.storage.sundrop = 2; load(state, processor, 'sundrop', 2); advance(state, 13);
  expect(processor.output).toEqual({ provisions: 2, biomass: 1 });
});

describe('fuel and recovery', () => {
  it('starts from raw crops, stores partly consumed fuel and stops burning when the reserve fills', () => {
    const state = garden(), generator = build(state, 'generator', 30, 30);
    state.storage.moonberry = 2; load(state, generator, 'moonberry', 2);
    state.industry.energy = 119;
    advance(state, 10);
    expect(state.industry.energy).toBeCloseTo(120); expect(generator.fuelEnergy).toBeCloseTo(23); expect(generator.input.moonberry).toBe(1);
    advance(state, 200); expect(generator.fuelEnergy).toBeCloseTo(23); expect(generator.input.moonberry).toBe(1);
    command(state, generator, 'industry-unload');
    expect(state.storage.moonberry).toBe(1); expect(generator.fuelEnergy).toBeCloseTo(23);
    command(state, generator, 'industry-remove');
    expect(state.industry.energy).toBeCloseTo(143); expect(state.materials).toBe(40);
    expect(() => command(state, generator, 'industry-remove')).toThrow('no longer');
  });
  it('uses one biomass for 60 energy and can restart a starved processor', () => {
    const state = garden(), processor = build(state, 'processor', 30, 30), generator = build(state, 'generator', 34, 30); seal(state, processor);
    state.storage.sundrop = 2; state.industry.storage.biomass = 1;
    load(state, processor, 'sundrop', 2); load(state, generator, 'biomass'); advance(state, 30);
    expect(processor.output).toEqual({ provisions: 2, biomass: 1 });
    expect(state.industry.energy).toBeCloseTo(INDUSTRY.starterEnergy + 60 - 12); expect(generator.fuelEnergy).toBeCloseTo(0); expect(generator.input.biomass).toBe(0);
  });
  it('rejects recovery atomically when cargo will not fit, including in-progress inputs', () => {
    const state = garden(), processor = build(state, 'processor', 30, 30);
    state.storage.sundrop = 2; state.industry.energy = 4; load(state, processor, 'sundrop', 2); advance(state, 1);
    state.storage.cloudmelon = 99; const before = structuredClone(state);
    expect(() => command(state, processor, 'industry-remove')).toThrow('Shared storage is full');
    expect(state).toEqual(before);
    state.storage.cloudmelon = 97; command(state, processor, 'industry-remove'); expect(state.storage.sundrop).toBe(2);
  });
  it('conserves all fuel potential through repeated partial burns, unloading and dismantling', () => {
    const state = garden(); state.materials = 200; state.storage.sundrop = 12;
    const first = build(state, 'generator', 30, 30); state.industry.storage.biomass = 6;
    const potential = () => state.industry.energy + state.storage.sundrop * 24 + state.industry.storage.biomass * 60
      + state.industry.machines.reduce((sum: number, machine: any) => sum + machine.fuelEnergy + (machine.input.sundrop || 0) * 24 + (machine.input.biomass || 0) * 60, 0);
    const expected = potential(); let generator = first;
    for (let n = 0; n < 20; n++) {
      const fuel = n % 2 ? 'sundrop' : 'biomass';
      if (industryStored(state, fuel)) load(state, generator, fuel);
      advance(state, .17 + n * .13); expect(potential()).toBeCloseTo(expected, 8);
      command(state, generator, 'industry-unload'); expect(potential()).toBeCloseTo(expected, 8);
      command(state, generator, 'industry-remove'); expect(potential()).toBeCloseTo(expected, 8);
      generator = build(state, 'generator', 30, 30);
    }
  });
});

describe('conveyors and ports', () => {
  it('rotates all ports around the two-tile footprint and preserves loaded cargo', () => {
    const state = garden(), processor = build(state, 'processor', 30, 30), belt = build(state, 'belt', 29, 30);
    expect(machinePorts(processor)).toEqual({ input: { x: 29, y: 30 }, output: { x: 32, y: 30 }, byproduct: { x: 31, y: 32 } });
    command(state, processor, 'industry-rotate', { dir: 2 });
    expect(machinePorts(processor)).toEqual({ input: { x: 31, y: 29 }, output: { x: 31, y: 32 }, byproduct: { x: 29, y: 31 } });
    state.storage.sundrop = 1; load(state, belt, 'sundrop'); advance(state, 1);
    expect(belt.item).toBe('sundrop'); expect(belt.progress).toBe(1);
    command(state, processor, 'industry-rotate', { dir: 1 }); advance(state, .1);
    expect(belt.item).toBeNull(); expect(processor.input.sundrop).toBe(1);
    command(state, processor, 'industry-rotate', { dir: 0 });
    expect(machinePorts(processor)).toEqual({ input: { x: 30, y: 32 }, output: { x: 30, y: 29 }, byproduct: { x: 32, y: 30 } });
  });
  it('moves a single item through a corner with travel time and no multi-cell teleport', () => {
    const state = garden(), a = build(state, 'belt', 30, 30), b = build(state, 'belt', 31, 30, 2), c = build(state, 'belt', 31, 31);
    state.storage.sundrop = 1; load(state, a, 'sundrop');
    advance(state, .5); expect(a.item).toBe('sundrop'); expect(b.item).toBeNull();
    advance(state, .1); expect(a.item).toBeNull(); expect(b.item).toBe('sundrop'); expect(b.progress).toBe(0); expect(c.item).toBeNull();
    advance(state, .6); expect(b.item).toBeNull(); expect(c.item).toBe('sundrop');
    advance(state, 100); expect(c.item).toBe('sundrop'); expect(c.progress).toBe(1); expect(industryStored(state, 'sundrop')).toBe(0);
    command(state, c, 'industry-remove'); expect(state.storage.sundrop).toBe(1);
  });
  it('blocks full chains safely and sends only one cargo per free destination', () => {
    const state = garden(), a = build(state, 'belt', 30, 30), b = build(state, 'belt', 31, 30), c = build(state, 'belt', 32, 30);
    state.storage.sundrop = 3; for (const belt of [a, b, c]) load(state, belt, 'sundrop');
    advance(state, 20); expect([a, b, c].map(belt => belt.item)).toEqual(['sundrop', 'sundrop', 'sundrop']);
    command(state, c, 'industry-unload'); advance(state, .1);
    expect([a, b, c].map(belt => belt.item)).toEqual(['sundrop', null, 'sundrop']);
    expect(state.storage.sundrop).toBe(1);
  });
  it('respects input port orientation and machine capacity', () => {
    const state = garden(), processor = build(state, 'processor', 30, 30), belt = build(state, 'belt', 29, 30, 0);
    state.industry.energy = 0; state.storage.sundrop = 13; load(state, processor, 'sundrop', 12); load(state, belt, 'sundrop');
    advance(state, 1); expect(belt.item).toBe('sundrop');
    command(state, belt, 'industry-rotate', { dir: 1 }); advance(state, 1); expect(belt.item).toBe('sundrop');
    command(state, processor, 'industry-unload'); advance(state, .1); expect(belt.item).toBeNull(); expect(processor.input.sundrop).toBe(1);
  });
  it('delivers provisions to the orbital post, waits for storage space and exports once', () => {
    const state = garden(), belt = build(state, 'belt', 43, 30, 0);
    state.industry.storage.provisions = 1; load(state, belt, 'provisions');
    state.industry.storage.biomass = 99; advance(state, 1); expect(belt.item).toBe('provisions');
    state.industry.storage.biomass = 98; advance(state, .1);
    expect(belt.item).toBeNull(); expect(state.industry.storage.provisions).toBe(1);
    state.industry.storage.provisions = 2;
    colonyAction(state, actor, 'ship-provisions', {}); expect(state.shipment.cargo).toEqual({ provisions: 2 });
    expect(() => colonyAction(state, actor, 'ship-provisions', {})).toThrow('already');
    tickColony(state, 8); expect(state.crates).toHaveLength(6); expect(state.materials + state.crates.reduce((total: number, crate: any) => total + crate.materials, 0)).toBe(63); expect(state.shipments).toBe(1);
  });
});

it('auto-harvests and replants only with power and local space, invalidating stale manual harvests', () => {
  const state = garden(); colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  const bed = state.beds[0], outlet = build(state, 'outlet', 33, 32); state.industry.energy = 0; seal(state, outlet);
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'cloudmelon' }); bed.growth = 150;
  advance(state, 1); expect(bed.growth).toBe(150);
  state.industry.energy = 6; outlet.output.cloudmelon = 5; advance(state, 1); expect(bed.growth).toBe(150); expect(state.industry.energy).toBe(6);
  expect(industryStatus(state, outlet)).toBe('Output full');
  command(state, outlet, 'industry-unload'); const revision = bed.revision; advance(state, .1);
  expect(outlet.output.cloudmelon).toBe(5); expect(bed.crop).toBe('cloudmelon'); expect(bed.growth).toBe(0); expect(state.industry.energy).toBe(4);
  expect(() => colonyAction(state, actor, 'harvest', { bedId: bed.id, revision })).toThrow('changed');
  expect(state.milestones.firstHarvest).toBe(true); expect(state.discovered).toContain('cloudmelon');
});

it('retains partial jobs, belt motion and fuel through serialization, with no offline work', () => {
  const state = garden(), processor = build(state, 'processor', 30, 30), generator = build(state, 'generator', 34, 30), belt = build(state, 'belt', 29, 30);
  state.storage.sundrop = 4; load(state, processor, 'sundrop', 2); load(state, generator, 'sundrop'); load(state, belt, 'sundrop');
  advance(state, 4.25); const saved = JSON.parse(JSON.stringify(state));
  expect(saved).toEqual(state);
  advance(state, 10); advance(saved, 10);
  expect(saved.industry).toEqual(state.industry); expect(saved.storage).toEqual(state.storage);
});

it('makes belts walkable and machines solid, protects workers and existing equipment in either build order', () => {
  const state = garden(), processor = build(state, 'processor', 30, 30), belt = build(state, 'belt', 29, 30);
  expect(colonyCanStand(state, 30.5, 30.5)).toBe(false); expect(colonyCanStand(state, 29.5, 30.5)).toBe(true);
  expect(industryAt(state, 31, 31)?.id).toBe(processor.id); expect(industryAt(state, 29, 30)?.id).toBe(belt.id);
  expect(colonyPlacementError(state, 'bed', 32, 31)).toContain('equipment');
  expect(industryPlacementError({ ...state, players: [{ x: 33.5, y: 30.5 }] }, 'generator', 33, 30)).toContain('worker');
  expect(industryPlacementError(state, 'belt', 43, 28)).toContain('equipment');
  colonyAction(state, actor, 'build-bed', { x: 40, y: 32 });
  expect(industryPlacementError(state, 'processor', 39, 32)).toContain('equipment');
});

it('refuses solid placement that seals a walking corridor', () => {
  const state = garden();
  state.world.terrain.fill(0);
  for (let x = 25; x < 45; x++) state.world.terrain[31 * state.world.width + x] = 2;
  for (let x = 25; x < 45; x++) state.world.terrain[32 * state.world.width + x] = 2;
  state.world.version++;
  expect(industryPlacementError(state, 'processor', 30, 31)).toContain('walking route');
  expect(industryPlacementError(state, 'belt', 30, 31)).toBeNull();
});

it('leaves free manual growing and raw exports available after a power failure', () => {
  const state = garden(); build(state, 'generator', 30, 30); state.industry.energy = 0; // the starter reserve is spent
  colonyAction(state, actor, 'build-bed', { x: 40, y: 32 }); const bed = state.beds[0];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' }); colonyAction(state, actor, 'water', { bedId: bed.id }); tickColony(state, 45);
  colonyAction(state, actor, 'harvest', { bedId: bed.id }); colonyAction(state, actor, 'ship', { crop: 'sundrop' }); tickColony(state, COLONY.shipmentDuration);
  expect(state.industry.energy).toBe(0); expect(state.materials + state.crates.reduce((total: number, crate: any) => total + crate.materials, 0)).toBe(44); expect(state.shipments).toBe(1);
});

it('lets an outlet feed a processor directly when the processor IN port sits on the outlet', () => {
  const state = garden(); colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
  const bed = state.beds[0];
  colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' }); colonyAction(state, actor, 'water', { bedId: bed.id });
  const outlet = build(state, 'outlet', 33, 32, 1), processor = build(state, 'processor', 34, 32, 1);
  expect((machinePorts(processor) as any).input).toEqual({ x: 33, y: 32 });
  state.industry.energy = 10; bed.growth = CROPS[0].growTime;
  advance(state, .5);
  expect(bed.harvests).toBe(1); expect(outlet.output).toEqual({ sundrop: 0 });
  // The two sundrops went straight in; with power to spare the processor has already begun the batch.
  expect((processor.input.sundrop || 0) + (processor.job?.crop === 'sundrop' ? 2 : 0)).toBe(CROPS[0].yield);
  expect(industryStatus(state, outlet)).not.toBe('Output full');
  // A paused or full receiver keeps the cargo waiting in the outlet instead of discarding it.
  colonyAction(state, actor, 'industry-toggle', { machineId: processor.id, revision: processor.revision });
  bed.growth = CROPS[0].growTime; advance(state, .5);
  expect(outlet.output.sundrop).toBe(CROPS[0].yield); expect(processor.input.sundrop || 0).toBe(0);
});
