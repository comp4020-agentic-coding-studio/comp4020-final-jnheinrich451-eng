import { describe, expect, it } from 'vitest';
import { createColony, colonyAction } from '../public/colonization.js';
import { cropById } from '../public/colony-crops.js';
import { IRRIGATION, sprinklerMotion, tickIrrigation } from '../public/colony-machinery.js';
import { industryItems, industryMotion, industryPlacementError, industryStatus, industryWorking, machinePorts, tickIndustry } from '../public/colony-industry.js';
import { drawIndustryBeltCargo, drawIndustryMotion } from '../public/colony-industry-art.js';

const actor = { id: 'mechanic', players: [] };
const seal = (state: any, machine: any) => { for (const port of Object.values(machinePorts(machine)) as any[]) state.industry.belts.push({ id: `seal-${state.nextId++}`, kind: 'belt', x: port.x, y: port.y, dir: machine.dir, revision: 0, enabled: false, cost: 1, item: null, progress: 0 }); };
const garden = (): any => createColony('morrow-v1');
const withBed = (crop: string | null = 'cloudmelon', water = 0): any => {
  const state = garden();
  state.beds = [{ id: 'bed-1', x: 30, y: 30, crop, water, growth: 0, harvests: 0, revision: 0 }];
  state.sprinklers = [{ id: 'sprinkler-a', x: 33, y: 30 }];
  return state;
};
function grow(state: any, seconds: number) {
  const steps = Math.ceil(seconds / .25), interval = seconds / steps;
  for (let n = 0; n < steps; n++) {
    state.time += interval;
    const wet = tickIrrigation(state, interval);
    for (const bed of state.beds) {
      const crop = cropById(bed.crop);
      if (crop) bed.growth = Math.min(crop.growTime, bed.growth + (wet.get(bed.id) || 0));
    }
  }
}
function build(state: any, kind: string, x: number, y: number, dir = 1): any {
  const result = colonyAction(state, actor, 'build-industry', { kind, x, y, dir });
  return industryItems(state).find(m => m.id === result.targetId);
}
function command(state: any, machine: any, action: string, data = {}) {
  return colonyAction(state, actor, action, { machineId: machine.id, revision: machine.revision, ...data });
}

describe('Morrow watering tasks', () => {
  it('leaves idle sprinklers still around empty, ripe and already wet beds', () => {
    for (const mode of ['empty', 'ripe', 'wet']) {
      const state = withBed(mode === 'empty' ? null : 'cloudmelon', mode === 'wet' ? 80 : 0);
      if (mode === 'ripe') state.beds[0].growth = 150;
      grow(state, 2);
      expect(state.sprinklers[0].irrigation).toBeUndefined();
      expect(sprinklerMotion(state, state.sprinklers[0], state.time + 100)).toMatchObject({ active: false, phase: 0 });
    }
  });

  it('assigns overlapping irrigation once and supplies dry crops without a growth gap', () => {
    const state = withBed();
    state.sprinklers.unshift({ id: 'sprinkler-b', x: 30, y: 33 });
    const wet = tickIrrigation(state, .1);
    expect(wet.get('bed-1')).toBeCloseTo(.1);
    expect(state.beds[0].water).toBeCloseTo(IRRIGATION.flowPerSecond * .1 - .1);
    expect(state.sprinklers.filter((s: any) => s.irrigation?.remaining > 0)).toHaveLength(1);
    expect(state.sprinklers.find((s: any) => s.id === 'sprinkler-a').irrigation.bedIds).toEqual(['bed-1']);
  });

  it('finishes a bounded service burst, holds its angle, and starts another when needed', () => {
    const state = withBed(); grow(state, IRRIGATION.serviceSeconds);
    const sprinkler = state.sprinklers[0], angle = sprinkler.irrigation.phase;
    expect(sprinkler.irrigation.remaining).toBeCloseTo(0);
    expect(state.beds[0].water).toBeGreaterThan(85);
    grow(state, 20);
    expect(sprinkler.irrigation.phase).toBe(angle);
    expect(sprinklerMotion(state, sprinkler, state.time + 10).phase).toBe(angle);
    state.beds[0].water = IRRIGATION.threshold;
    grow(state, .25);
    expect(sprinklerMotion(state, sprinkler).active).toBe(true);
    expect(sprinkler.irrigation.phase).toBeGreaterThan(angle);
  });

  it('grows a full slow crop with automatic service cycles and then becomes still', () => {
    const state = withBed(); grow(state, 150);
    expect(state.beds[0].growth).toBeCloseTo(150, 7);
    grow(state, .25);
    const phase = state.sprinklers[0].irrigation.phase;
    expect(sprinklerMotion(state, state.sprinklers[0]).active).toBe(false);
    grow(state, 200);
    expect(state.sprinklers[0].irrigation.phase).toBe(phase);
    expect(state.beds[0].growth).toBe(150);
  });

  it('restores a partial service after serialization and does no offline or paused work', () => {
    const state = withBed(); grow(state, .5);
    const saved = structuredClone(state), before = structuredClone(saved);
    tickIrrigation(saved, 0); tickIrrigation(saved, -1); tickIrrigation(saved, NaN);
    sprinklerMotion(saved, saved.sprinklers[0], saved.time + 100);
    expect(saved).toEqual(before);
    grow(state, 12); grow(saved, 12);
    expect(saved).toEqual(state);
  });

  it('preserves legacy continuous irrigation without adding task fields', () => {
    for (const template of ['caldera-v1', 'nacre-v1', 'aurelia-v1']) {
      const state = withBed(); state.template = template;
      const wet = tickIrrigation(state, 10);
      expect(wet.get('bed-1')).toBe(10); expect(state.beds[0].water).toBe(90);
      expect(state.sprinklers[0].irrigation).toBeUndefined();
      expect(sprinklerMotion(state, state.sprinklers[0], 2)).toMatchObject({ active: true, phase: 1.4 });
    }
  });
});

describe('actual industrial work', () => {
  it('runs processor blades only while energy is spent, holding phase across a stall and completed jobs', () => {
    const state = garden(), machine = build(state, 'processor', 30, 30); seal(state, machine);
    state.storage.sundrop = 2;
    command(state, machine, 'industry-load', { item: 'sundrop', amount: 2 });
    state.industry.energy = 2;
    expect(industryStatus(state, machine)).toBe('Ready');
    expect(industryWorking(state, machine)).toBe(false);
    tickIndustry(state, 2);
    const stopped = industryMotion(state, machine, 100);
    expect(stopped.active).toBe(false);
    tickIndustry(state, 5); expect(industryMotion(state, machine, 200)).toEqual(stopped);
    state.industry.energy = 10; tickIndustry(state, 10);
    expect(machine.output).toEqual({ provisions: 2, biomass: 1 });
    expect(machine.job).toBeNull();
    const completed = industryMotion(state, machine, 300);
    expect(completed.active).toBe(false);
    expect(completed.phase).not.toBe(stopped.phase);
    tickIndustry(state, 50); expect(industryMotion(state, machine, 500)).toEqual(completed);
  });

  it('stops a generator at full reserve and resumes from its held phase', () => {
    const state = garden(), machine = build(state, 'generator', 30, 30);
    state.storage.sundrop = 1;
    command(state, machine, 'industry-load', { item: 'sundrop' });
    state.industry.energy = 119;
    tickIndustry(state, 2);
    const phase = machine.motionPhase;
    expect(state.industry.energy).toBeCloseTo(120);
    expect(machine.fuelEnergy).toBeCloseTo(23);
    tickIndustry(state, 100); expect(machine.motionPhase).toBe(phase);
    expect(industryMotion(state, machine, 500).active).toBe(false);
    state.industry.energy = 110; tickIndustry(state, .5);
    expect(machine.motionPhase).not.toBe(phase);
    expect(machine.motionPhase).toBeGreaterThanOrEqual(0); expect(machine.motionPhase).toBeLessThan(1);
  });

  it('moves treads with cargo and holds a blocked belt without losing its item', () => {
    const state = garden(), belt = build(state, 'belt', 30, 30);
    state.storage.sundrop = 1;
    expect(industryMotion(state, belt, 100)).toEqual({ active: false, phase: 0 });
    command(state, belt, 'industry-load', { item: 'sundrop' });
    tickIndustry(state, .25);
    expect(industryMotion(state, belt).active).toBe(true);
    expect(belt.motionPhase).toBeCloseTo(.25 / .6);
    tickIndustry(state, 1);
    expect(belt.item).toBe('sundrop'); expect(belt.progress).toBe(1);
    const phase = belt.motionPhase;
    tickIndustry(state, 100);
    expect(belt.motionPhase).toBe(phase); expect(industryMotion(state, belt, 500).active).toBe(false);
    command(state, belt, 'industry-unload');
    expect(state.storage.sundrop).toBe(1); expect(industryMotion(state, belt, 1000).phase).toBe(phase);
  });

  it('starts the harvest stroke only after an accepted harvest and preserves it through pause/reload', () => {
    const state = garden(); colonyAction(state, actor, 'build-bed', { x: 31, y: 32 });
    const bed = state.beds[0], machine = build(state, 'outlet', 33, 32); state.industry.energy = 0; seal(state, machine); // starter reserve spent
    bed.crop = 'sundrop'; bed.growth = 45;
    tickIndustry(state, 1); expect(machine.harvestMotion).toBeUndefined();
    state.industry.energy = 2; tickIndustry(state, .1);
    expect(bed.harvests).toBe(1); expect(machine.output.sundrop).toBe(2);
    expect(industryWorking(state, machine)).toBe(true);
    tickIndustry(state, .4);
    const phase = industryMotion(state, machine).phase;
    command(state, machine, 'industry-toggle');
    tickIndustry(state, 4); expect(industryMotion(state, machine, 100).phase).toBe(phase);
    const saved = JSON.parse(JSON.stringify(state));
    command(state, machine, 'industry-toggle');
    const restored = saved.industry.machines[0]; command(saved, restored, 'industry-toggle');
    tickIndustry(state, 2); tickIndustry(saved, 2);
    expect(saved.industry).toEqual(state.industry);
    expect(industryMotion(state, machine).active).toBe(false);
    expect(machine.output.sundrop).toBe(2); expect(bed.harvests).toBe(1);
  });

  it('blocks industry on reserved delivery footprints as well as ready furnishings', () => {
    const state = garden();
    state.settlement = { items: [{ id: 'lamp-1', kind: 'path-lamp', x: 30, y: 30, dir: 0, status: 'queued' }] };
    expect(industryPlacementError(state, 'belt', 30, 30)).toContain('equipment');
    state.settlement.items[0].status = 'ready';
    expect(industryPlacementError(state, 'processor', 30, 30)).toContain('equipment');
  });
});

function drawTrace(draw: (context: any) => void) {
  const calls: any[] = [];
  const context = new Proxy({}, {
    get: (_target, name) => (...args: any[]) => calls.push([name, ...args]),
    set: (_target, name, value) => { calls.push([name, value]); return true; },
  });
  draw(context); return calls;
}

it('renders identical idle mechanisms at different frame times and moves actual working treads and arms', () => {
  const state = garden(), belt = build(state, 'belt', 30, 30);
  const drawBelt = (time: number) => drawTrace(c => drawIndustryBeltCargo(c, state, belt, 3, time, false));
  expect(drawBelt(0)).toEqual(drawBelt(10));
  state.storage.sundrop = 1; command(state, belt, 'industry-load', { item: 'sundrop' }); tickIndustry(state, .1);
  expect(drawBelt(0)).not.toEqual(drawBelt(.15));
  tickIndustry(state, 2); expect(drawBelt(4)).toEqual(drawBelt(10));
  const outlet: any = { kind: 'outlet', x: 33, y: 32, dir: 1, enabled: true, output: {}, harvestMotion: { elapsed: .1, duration: 1.2, crop: 'sundrop' } };
  const drawArm = (time: number) => drawTrace(c => drawIndustryMotion(c, state, outlet, time, false));
  expect(drawArm(0)).not.toEqual(drawArm(.2));
  outlet.harvestMotion.elapsed = 1.2; expect(drawArm(1)).toEqual(drawArm(9));
});
