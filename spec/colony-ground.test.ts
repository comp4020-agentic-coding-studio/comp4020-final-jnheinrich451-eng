import { describe, expect, it } from 'vitest';
import { colonyAction, colonyPlacementError, createColony, tickColony } from '../public/colonization.js';
import { GROUND, createGround, decodeGround, encodeGround, groundAt, groundConditioned, groundLevels, groundPlacementError, groundSummary, tickGround } from '../public/colony-ground.js';
import { regionAction, regionView } from '../public/colony-regions.js';
import { industryPlacementError } from '../public/colony-industry.js';
import { settlementPlacementError } from '../public/colony-settlement.js';

const actor = { id: 'gardener', x: 36.5, y: 31.5 };
const message = 'Grow a crop nearby to condition this ground first.';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const planets = ['morrow-v1', 'nacre-v1', 'aurelia-v1', 'caldera-v1'];
const land = (state: any, x: number, y: number) => [1, 2, 4].includes(state.world.terrain[y * state.world.width + x]);
/** Condition a square so a test can build there without growing anything first. */
function condition(state: any, cx: number, cy: number, reach: number) {
  const levels = Uint8Array.from(groundLevels(state));
  for (let y = cy - reach; y <= cy + reach; y++) for (let x = cx - reach; x <= cx + reach; x++) levels[y * state.world.width + x] = GROUND.levels;
  state.ground.cells = encodeGround(levels);
}
/** A bed just inside the start disc whose near ring (36,38) and far ring (36,40) lie outside it. */
function edgeGarden(template = 'caldera-v1') {
  const state = createColony(template);
  colonyAction(state, actor, 'build-bed', { x: 36, y: 36 });
  return state;
}

describe('ground encoding', () => {
  it('round-trips run-length text, including empty and garbled input', () => {
    const levels = Uint8Array.from([0, 0, 0, 8, 8, 8, 8, 3, 0, 8]);
    expect(encodeGround(levels)).toBe('0:3 8:4 3:1 0:1 8:1');
    expect(decodeGround(encodeGround(levels), levels.length)).toEqual(levels);
    expect(encodeGround([])).toBe('');
    expect(decodeGround('', 4)).toEqual(new Uint8Array(4));
    expect(decodeGround('0:2 8:1', 6)).toEqual(Uint8Array.from([0, 0, 8, 0, 0, 0]));
    expect(decodeGround('8:99', 3)).toEqual(Uint8Array.from([8, 8, 8]));
    expect(decodeGround('x:y 8:two 7:1 :: 300:1', 4)).toEqual(Uint8Array.from([7, 8, 0, 0]));
    for (const junk of [undefined, null, 42, {}, 'junk']) expect(decodeGround(junk as any, 2)).toEqual(new Uint8Array(2));
    expect(decodeGround('8:1', NaN as any)).toEqual(new Uint8Array(0));
    const first = decodeGround('0:1 8:1', 2);
    expect(decodeGround('0:1 8:1', 2)).toBe(first);
  });
});

describe('initial ground', () => {
  it('conditions the start disc and the starter sites deterministically on every planet', () => {
    for (const template of planets) {
      const state = createColony(template);
      expect(Object.keys(state).at(-1)).toBe('ground');
      expect(state).toEqual(createColony(template));
      expect(state.ground).toMatchObject({ version: 1, revision: 0, elapsed: 0, steps: 0 });
      expect(typeof state.ground.cells).toBe('string');
      for (let y = 0; y < state.world.height; y++) for (let x = 0; x < state.world.width; x++) {
        const inDisc = Math.hypot(x + .5 - state.hub.x, y + .5 - state.hub.y) <= GROUND.startRadius;
        expect(groundAt(state, x, y), `${template} ${x},${y}`).toBe(inDisc && land(state, x, y) ? GROUND.levels : 0);
      }
      for (const [x, y] of [[32, 31], [32, 27], [36, 34]]) expect(colonyPlacementError(state, 'bed', x, y), `${template} bed ${x},${y}`).toBeNull();
      expect(groundAt(state, -1, 0)).toBe(0); expect(groundAt(state, state.world.width, 0)).toBe(0);
      expect(groundConditioned(state, 36, 28)).toBe(true);
    }
  });

  it('counts conditioned, frontier and land tiles', () => {
    const state = createColony('caldera-v1'), summary = groundSummary(state);
    expect(summary.land).toBe(state.world.terrain.filter((kind: number) => [1, 2, 4].includes(kind)).length);
    expect(summary.conditioned).toBe(groundLevels(state).filter((level: number) => level === GROUND.levels).length);
    expect(summary.conditioned).toBeGreaterThan(300); expect(summary.frontier).toBe(0);
    const levels = Uint8Array.from(groundLevels(state)); levels[40 * state.world.width + 36] = 3; state.ground.cells = encodeGround(levels);
    expect(groundSummary(state)).toEqual({ ...summary, frontier: 1 });
    const wild: any = copy(state); delete wild.ground;
    expect(groundSummary(wild)).toEqual({ conditioned: 0, land: summary.land, frontier: 0 });
    expect(groundPlacementError(wild, [{ x: 36, y: 31 }])).toBe(message);
  });

  it('recreates ground for an old save so an outlying bed keeps its footprint and ring', () => {
    const state = createColony('morrow-v1') as any;
    delete state.ground;
    state.beds.push({ id: 'bed-old', x: 48, y: 28, crop: null, growth: 0, water: 0, harvests: 0, revision: 0 });
    const before = copy(state), ground = createGround(state);
    expect(state).toEqual(before);
    state.ground = ground;
    for (let y = 26; y <= 30; y++) for (let x = 46; x <= 50; x++) expect(groundAt(state, x, y), `${x},${y}`).toBe(GROUND.levels);
    expect(groundAt(state, 51, 28)).toBe(0); expect(groundAt(state, 48, 31)).toBe(0);
    expect(colonyPlacementError(state, 'sprinkler', 50, 28)).toBeNull();
    expect(colonyPlacementError(state, 'sprinkler', 51, 28)).toBe(message);
  });
});

describe('ground placement', () => {
  it('refuses a bed on wild ground and admits the same bed once its ground is conditioned', () => {
    const state = createColony('caldera-v1');
    expect(colonyPlacementError(state, 'bed', 48, 28)).toBe(message);
    expect(() => colonyAction(state, actor, 'build-bed', { x: 48, y: 28 })).toThrow(message);
    expect(state.beds).toHaveLength(0);
    condition(state, 48, 28, 1);
    expect(colonyPlacementError(state, 'bed', 48, 28)).toBeNull();
    expect(colonyPlacementError(state, 'bed', 49, 28)).toBe(message);
    colonyAction(state, actor, 'build-bed', { x: 48, y: 28 });
    expect(state.beds[0]).toMatchObject({ x: 48, y: 28 });
  });

  it('keeps message precedence: firm ground, occupancy and the camp survey radius before ground, then materials', () => {
    const state = createColony('caldera-v1');
    expect(colonyPlacementError(state, 'bed', 0, 0)).toContain('firm ground');
    expect(colonyPlacementError(state, 'bed', 36, 28)).toContain('Leave room');
    expect(colonyPlacementError(state, 'campfire', 51, 28)).toContain('surveyed garden');
    state.materials = 0;
    expect(colonyPlacementError(state, 'sprinkler', 36, 40)).toBe(message);
    expect(colonyPlacementError(state, 'sprinkler', 36, 33)).toContain('materials');
  });

  it('refuses a sprinkler, campfire, processor, belt and bench on wild ground with the same message', () => {
    const state = createColony('morrow-v1');
    state.materials = 100;
    expect(colonyPlacementError(state, 'sprinkler', 36, 40)).toBe(message);
    expect(colonyPlacementError(state, 'campfire', 36, 40)).toBe(message);
    expect(colonyPlacementError(state, 'processor', 36, 40)).toBe(message);
    expect(colonyPlacementError(state, 'belt', 36, 40)).toBe(message);
    expect(colonyPlacementError(state, 'bench', 36, 40)).toBe(message);
    const orders: Array<[string, Record<string, unknown>]> = [['build-sprinkler', {}], ['build-campfire', {}], ['build-industry', { kind: 'processor' }], ['build-industry', { kind: 'belt' }], ['build-furnishing', { kind: 'bench' }]];
    for (const [action, data] of orders) expect(() => colonyAction(state, actor, action, { ...data, x: 36, y: 40 })).toThrow(message);
    expect(colonyPlacementError(state, 'sprinkler', 36, 34)).toBeNull();
    expect(colonyPlacementError(state, 'campfire', 36, 34)).toBeNull();
    expect(colonyPlacementError(state, 'processor', 30, 32)).toBeNull();
    expect(colonyPlacementError(state, 'belt', 30, 34)).toBeNull();
    expect(colonyPlacementError(state, 'bench', 33, 35)).toBeNull();
  });
});

describe('ground conditioning', () => {
  it('conditions the near ring after 40 s and the far ring after 80 s of a live watered crop', () => {
    const state = edgeGarden(), bed = state.beds[0];
    expect(groundAt(state, 36, 38)).toBe(0); expect(groundAt(state, 36, 40)).toBe(0);
    colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' });
    colonyAction(state, actor, 'water', { bedId: bed.id });
    tickColony(state, 35);
    expect(groundAt(state, 36, 38)).toBe(7); expect(groundAt(state, 36, 40)).toBe(4);
    tickColony(state, 5);
    expect(groundAt(state, 36, 38)).toBe(GROUND.levels); expect(groundAt(state, 36, 40)).toBe(4);
    expect(groundAt(state, 32, 40)).toBe(4); expect(groundAt(state, 31, 40)).toBe(0);
    tickColony(state, 40);
    expect(groundAt(state, 36, 40)).toBe(GROUND.levels); expect(groundAt(state, 40, 40)).toBe(GROUND.levels);
    expect(groundAt(state, 36, 41)).toBe(0);
    expect(state.ground).toMatchObject({ steps: 16, elapsed: 0 });
    expect(groundSummary(state).frontier).toBe(0);
  });

  it('does nothing for a dry crop, an empty bed or water on a rock', () => {
    const state = edgeGarden(), bed = state.beds[0];
    tickColony(state, 80);
    expect(groundAt(state, 36, 38)).toBe(0); expect(state.ground.revision).toBe(0);
    colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' });
    tickColony(state, 80);
    expect(groundAt(state, 36, 38)).toBe(0); expect(state.ground.revision).toBe(0); expect(state.ground.steps).toBe(32);
    state.world.terrain[40 * state.world.width + 36] = 3;
    colonyAction(state, actor, 'water', { bedId: bed.id });
    tickColony(state, 80);
    expect(groundAt(state, 36, 38)).toBe(GROUND.levels); expect(groundAt(state, 36, 40)).toBe(0); expect(groundAt(state, 37, 40)).toBe(GROUND.levels);
  });

  it('keeps conditioning while ripe and unharvested, then reverts the unheld far ring after harvest', () => {
    const state = edgeGarden(), bed = state.beds[0];
    colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'sundrop' });
    colonyAction(state, actor, 'water', { bedId: bed.id });
    tickColony(state, 90);
    expect(bed.water).toBe(0); expect(bed.growth).toBe(45);
    tickColony(state, 200);
    expect(groundAt(state, 36, 40)).toBe(GROUND.levels);
    colonyAction(state, actor, 'harvest', { bedId: bed.id });
    expect(bed.crop).toBeNull();
    for (let level = 7; level >= 0; level--) {
      tickColony(state, 30);
      expect(groundAt(state, 36, 40), `after ${(8 - level) * 30} s`).toBe(level);
      expect(groundAt(state, 36, 38)).toBe(GROUND.levels); expect(groundAt(state, 36, 28)).toBe(GROUND.levels);
    }
    expect(groundAt(state, 36, 40)).toBe(0);
    expect(groundAt(state, 36, 37)).toBe(GROUND.levels); expect(groundAt(state, 38, 38)).toBe(GROUND.levels);
  });

  it('takes the same ground steps whether time arrives in one tick or many, and round-trips through JSON', () => {
    const whole = edgeGarden(), split = copy(whole);
    for (const state of [whole, split]) {
      colonyAction(state, actor, 'plant', { bedId: state.beds[0].id, crop: 'cloudmelon' });
      colonyAction(state, actor, 'water', { bedId: state.beds[0].id });
    }
    tickColony(whole, 40);
    for (let i = 0; i < 8; i++) tickColony(split, 5);
    expect(split.ground).toEqual(whole.ground);
    expect(whole.ground.revision).toBe(8);
    const direct = copy(whole), stepped = copy(whole);
    expect(tickGround(direct, 40)).toBe(true);
    for (let i = 0; i < 8; i++) tickGround(stepped, 5);
    expect(stepped.ground).toEqual(direct.ground);
    expect(tickGround(copy(whole), 4.9)).toBe(false);
    expect(tickGround({ ...copy(whole), ground: undefined }, 40)).toBe(false);
    const restored = copy(whole);
    expect(restored.ground).toEqual(whole.ground);
    expect(groundLevels(restored)).toEqual(groundLevels(whole));
  });

  it('never adds ground to a remote region view', () => {
    const state = createColony('morrow-v1'), person = { id: 'surveyor', regionId: 'home', x: 36.5, y: 31.5, angle: 0 };
    expect(regionView(state, 'home').ground).toEqual(state.ground);
    regionAction(state, person, 'travel-region', { destination: 'blossom-grove' });
    const remote = regionView(state, 'blossom-grove');
    expect(remote.ground).toBeUndefined();
    expect(JSON.parse(JSON.stringify(remote))).not.toHaveProperty('ground');
    expect(groundAt(remote, 18, 18)).toBe(0);
  });
});

describe('ground rules the stage record promises', () => {
  it('gains at most one level per step however many live crops reach a tile', () => {
    const state = edgeGarden();
    condition(state, 33, 36, 1);
    colonyAction(state, actor, 'build-bed', { x: 33, y: 36 });
    for (const bed of state.beds) { colonyAction(state, actor, 'plant', { bedId: bed.id, crop: 'cloudmelon' }); colonyAction(state, actor, 'water', { bedId: bed.id }); }
    expect(groundAt(state, 34, 38)).toBe(0);
    tickColony(state, 5);
    expect(groundAt(state, 34, 38)).toBe(1);
    tickColony(state, 35);
    expect(groundAt(state, 34, 38)).toBe(GROUND.levels);
  });

  it('never conditions water, at creation or beside a live crop', () => {
    const template = createColony('caldera-v1');
    template.world.terrain[28 * template.world.width + 30] = 0;
    const state = createColony('caldera-v1'); state.world.terrain = template.world.terrain; state.ground = createGround(state);
    expect(groundAt(state, 30, 28)).toBe(0); expect(groundAt(state, 31, 28)).toBe(GROUND.levels);
    const garden = edgeGarden(), bed = garden.beds[0];
    garden.world.terrain[40 * garden.world.width + 36] = 0;
    colonyAction(garden, actor, 'plant', { bedId: bed.id, crop: 'cloudmelon' }); colonyAction(garden, actor, 'water', { bedId: bed.id });
    tickColony(garden, 80);
    expect(groundAt(garden, 36, 40)).toBe(0); expect(groundAt(garden, 35, 40)).toBe(GROUND.levels);
  });

  it('keeps the starting clearing and everything built through ten minutes of neglect', () => {
    const state = createColony('morrow-v1');
    state.materials = 200;
    condition(state, 36, 38, 6);
    colonyAction(state, actor, 'build-bed', { x: 36, y: 36 });
    colonyAction(state, actor, 'build-sprinkler', { x: 40, y: 36 });
    colonyAction(state, actor, 'build-campfire', { x: 32, y: 36 });
    const built = copy({ beds: state.beds, sprinklers: state.sprinklers, decorations: state.decorations });
    expect(groundAt(state, 36, 42)).toBe(GROUND.levels);
    tickColony(state, 600);
    expect(groundAt(state, 28, 28)).toBe(GROUND.levels); expect(groundAt(state, 36, 19)).toBe(GROUND.levels);
    expect(groundAt(state, 36, 38)).toBe(GROUND.levels); expect(groundAt(state, 41, 37)).toBe(GROUND.levels); expect(groundAt(state, 31, 37)).toBe(GROUND.levels);
    expect(groundAt(state, 36, 41)).toBe(0); expect(groundAt(state, 36, 42)).toBe(0);
    expect({ beds: state.beds, sprinklers: state.sprinklers, decorations: state.decorations }).toEqual(built);
  });

  it('migrates an old save around every construction kind, not only beds', () => {
    const state = createColony('morrow-v1') as any;
    delete state.ground;
    state.sprinklers.push({ id: 'sprinkler-old', x: 48, y: 20 });
    state.industry = { version: 1, machines: [{ id: 'machine-old', kind: 'processor', x: 24, y: 20, dir: 1, revision: 0, enabled: true, cost: 16, input: {}, output: {}, job: null }], belts: [{ id: 'belt-old', kind: 'belt', x: 24, y: 36, dir: 1, revision: 0, enabled: true, cost: 1, item: null, progress: 0 }], storage: { provisions: 0, biomass: 0 }, energy: 0 };
    state.settlement = { version: 1, revision: 0, items: [{ id: 'bench-old', kind: 'bench', x: 48, y: 36, dir: 0, variant: 'ivory', status: 'ready', revision: 1, owner: 'iris' }], stored: {}, deliveries: [], completed: [], undo: null };
    state.decorations.items = [{ id: 'fire-old', kind: 'campfire', x: 36, y: 10, lit: true, revision: 0 }];
    state.ground = createGround(state);
    const ring = (cx: number, cy: number, w = 1, h = 1) => {
      for (let y = cy - 1; y <= cy + h; y++) for (let x = cx - 1; x <= cx + w; x++) if (land(state, x, y)) expect(groundAt(state, x, y), `${x},${y}`).toBe(GROUND.levels);
      for (const [x, y] of [[cx - 2, cy], [cx + w + 1, cy], [cx, cy - 2], [cx, cy + h + 1]]) if (land(state, x, y)) expect(groundAt(state, x, y), `${x},${y}`).toBe(0);
    };
    ring(48, 20); ring(24, 20, 2, 2); ring(24, 36); ring(48, 36, 2, 1); ring(36, 10);
  });

  it('checks ground before cost for machines and furnishings too', () => {
    const state = createColony('morrow-v1');
    state.materials = 0;
    expect(industryPlacementError(state, 'processor', 36, 40, 1)).toBe(message);
    expect(industryPlacementError(state, 'processor', 30, 30, 1)).toContain('materials');
    expect(settlementPlacementError(state, 'wind-sculpture', 36, 40)).toBe(message);
    expect(settlementPlacementError(state, 'wind-sculpture', 30, 30)).toContain('materials');
  });

  it('lets a furnishing edit be undone after its old site lost a level', () => {
    const state: any = createColony('morrow-v1'), owner = { ...actor, players: [] };
    state.materials = 100;
    condition(state, 36, 38, 1);
    colonyAction(state, owner, 'build-furnishing', { kind: 'bench', x: 36, y: 38, dir: 0, variant: 'ivory' });
    tickColony(state, 10);
    const item = state.settlement.items[0];
    expect(item.status).toBe('ready');
    colonyAction(state, owner, 'furnishing-move', { itemId: item.id, revision: item.revision, x: 30, y: 30, dir: 0 });
    tickColony(state, 30);
    expect(groundAt(state, 36, 38)).toBe(GROUND.levels - 1);
    expect(settlementPlacementError(state, 'bench', 36, 38, 0, item.id)).toBe(message);
    colonyAction(state, owner, 'settlement-undo', { revision: state.settlement.revision });
    expect(state.settlement.items[0]).toMatchObject({ id: item.id, x: 36, y: 38 });
  });

  it('heals hand-edited counters instead of stalling or throwing', () => {
    const state: any = edgeGarden();
    colonyAction(state, actor, 'plant', { bedId: state.beds[0].id, crop: 'cloudmelon' }); colonyAction(state, actor, 'water', { bedId: state.beds[0].id });
    state.ground.elapsed = Number.NaN; state.ground.steps = 'later'; state.ground.revision = -4;
    expect(tickGround(state, 5)).toBe(true);
    expect(state.ground).toMatchObject({ elapsed: 0, steps: 1, revision: 1 });
    expect(tickGround({ ...state, ground: true }, 5)).toBe(false);
    expect(groundLevels(state)).not.toBe(groundLevels(state));
    const levels = groundLevels(state); levels[0] = 7;
    expect(groundAt(state, 0, 0)).toBe(0);
  });
});
