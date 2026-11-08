// Bounded, deterministic settlement logistics. No combat or wall-clock state.
import { decorationItems, decorationCells, decorationAt } from './colony-ambience.js';
import { CROPS, cropById, bedReady } from './colony-crops.js';
import { settlementItems, settlementSolidCells, settlementAt } from './colony-settlement.js';
import { groundPlacementError } from './colony-ground.js';

export const INDUSTRY = Object.freeze({
  kinds: Object.freeze({
    // Hidden kinds stay valid in saves and for the server, but the catalogue no longer offers them
    // (author direction, 8 November 2026: machines pass cargo by touch, a warehouse drone fetches crates).
    belt: Object.freeze({ name: 'Conveyor', cost: 1, limit: 96, size: 1, hidden: true }),
    outlet: Object.freeze({ name: 'Harvest outlet', cost: 6, limit: 8, size: 1 }),
    processor: Object.freeze({ name: 'Food processor', cost: 16, limit: 4, size: 2 }),
    generator: Object.freeze({ name: 'Bio-generator', cost: 12, limit: 4, size: 2 }),
    collector: Object.freeze({ name: 'Crate collector', cost: 10, limit: 2, size: 2, hidden: true }),
    warehouse: Object.freeze({ name: 'Warehouse', cost: 14, limit: 1, size: 3 }),
  }),
  // The warehouse drone flies to any crate in the district and back at this speed; short hops still take a moment.
  droneSpeed: 4, droneMinSeconds: .4,
  // A collector reaches crates within seven tiles of its centre and spends one unit of power per crate.
  collectorReach: 7, collectorSeconds: 2.5, collectorEnergy: 1,
  beltSeconds: .6, inputCapacity: 12, outputCapacity: 8, fuelCapacity: 8,
  storageCapacity: 99, energyCapacity: 120, provisionReward: 24,
  // A new expedition's power reserve starts charged, once, so the first chain runs
  // before any fuel is loaded by hand (author correction, 8 November 2026).
  starterEnergy: 48,
});
export const INDUSTRY_RECIPES = Object.freeze([
  Object.freeze({ id: 'sundrop', name: 'Sundrop provisions', input: 2, provisions: 2, biomass: 1, seconds: 12 }),
  Object.freeze({ id: 'moonberry', name: 'Moonberry provisions', input: 2, provisions: 3, biomass: 1, seconds: 18 }),
  Object.freeze({ id: 'cloudmelon', name: 'Cloudmelon provisions', input: 1, provisions: 2, biomass: 2, seconds: 24 }),
]);
export const INDUSTRY_ITEMS = Object.freeze([
  { id: 'sundrop', name: 'Sundrop' }, { id: 'moonberry', name: 'Moonberry' },
  { id: 'cloudmelon', name: 'Cloudmelon' }, { id: 'provisions', name: 'Provisions' }, { id: 'biomass', name: 'Biomass' },
].map(Object.freeze));
const raw = item => INDUSTRY_RECIPES.some(recipe => recipe.id === item);
const known = item => INDUSTRY_ITEMS.some(value => value.id === item);
const total = inventory => Object.values(inventory || {}).reduce((sum, count) => sum + Number(count || 0), 0);
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const vector = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const validDirection = dir => Number.isInteger(dir) && dir >= 0 && dir <= 3;
const init = state => state.industry ||= { version: 1, machines: [], belts: [], storage: { provisions: 0, biomass: 0 }, energy: INDUSTRY.starterEnergy, starter: true };
// An industry save from before the starter reserve receives it once; the flag makes the grant idempotent.
const grantStarter = industry => { if (industry.starter === undefined) { industry.starter = true; industry.energy = Math.min(INDUSTRY.energyCapacity, (industry.energy || 0) + INDUSTRY.starterEnergy); } };
const key = (x, y) => `${x}:${y}`;
const land = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height && [1, 2, 4].includes(world.terrain[y * world.width + x]);
const hubCell = (state, x, y) => x >= state.hub.x - 1 && x < state.hub.x + 1 && y >= state.hub.y - 1 && y < state.hub.y + 1;
const padCell = (state, x, y) => Math.abs(x - state.pad.x) <= 1 && Math.abs(y - state.pad.y) <= 1;
const bedCell = (bed, x, y) => Math.abs(x - bed.x) <= 1 && Math.abs(y - bed.y) <= 1;
const recipeFor = id => INDUSTRY_RECIPES.find(recipe => recipe.id === id);
const TAU = Math.PI * 2;
const motionRate = kind => kind === 'processor' ? 2.3 / TAU : kind === 'generator' ? .24 : 1 / INDUSTRY.beltSeconds;
const advanceMotion = (machine, seconds) => {
  const oldPhase = machine.motionPhase ?? (machine.kind === 'processor'
    ? Math.max(0, (machine.job?.elapsed || 0) - seconds) * motionRate(machine.kind)
    : machine.kind === 'belt' ? Math.max(0, machine.progress - seconds / INDUSTRY.beltSeconds) : 0);
  if (seconds > 0) machine.motionPhase = (oldPhase + seconds * motionRate(machine.kind)) % 1;
};

/** @param {any} state */
export const industryItems = state => [...(state.industry?.machines || []), ...(state.industry?.belts || [])];
/** Footprints use a top-left tile, including for two-tile machines. */
export function machineCells(kind, x, y) {
  const size = INDUSTRY.kinds[kind]?.size || 1;
  return Array.from({ length: size * size }, (_, i) => ({ x: x + i % size, y: y + Math.floor(i / size) }));
}
/** @param {any} state */
export const industryAt = (state, x, y) => industryItems(state).find(item => machineCells(item.kind, item.x, item.y).some(cell => cell.x === x && cell.y === y)) || null;
/** Ports are the adjacent belt cells, not cells inside the machine. @param {any} machine */
export function machinePorts(machine) {
  const dir = machine.dir ?? 1, [dx, dy] = vector[dir];
  if (machine.kind === 'collector' || machine.kind === 'warehouse') return {};
  if (machine.kind === 'outlet' || machine.kind === 'belt') return { output: { x: machine.x + dx, y: machine.y + dy } };
  const rotate = (x, y) => {
    for (let n = 0; n < (dir + 3) % 4; n++) [x, y] = [1 - y, x];
    return { x: machine.x + x, y: machine.y + y };
  };
  return { input: rotate(-1, 0), ...(machine.kind === 'processor' ? { output: rotate(2, 0), byproduct: rotate(1, 2) } : {}) };
}
/** @param {any} state */
export const industryStored = (state, item) => Number((raw(item) ? state.storage?.[item] : state.industry?.storage?.[item]) || 0);

/** The next clockwise direction a machine may take; an outlet skips directions that point at its bed. @param {any} state @param {any} machine */
export function nextIndustryDirection(state, machine) {
  const bed = machine.kind === 'outlet' ? state.beds.find(b => b.id === machine.bedId) : null;
  for (let step = 1; step <= 4; step++) {
    const dir = (machine.dir + step) % 4;
    if (!bed) return dir;
    const port = machinePorts({ ...machine, dir }).output;
    if (!bedCell(bed, port.x, port.y)) return dir;
  }
  return machine.dir;
}
function outletBed(state, x, y, bedId) {
  return state.beds.find(bed => (!bedId || bed.id === bedId) && ((Math.abs(bed.x - x) === 2 && Math.abs(bed.y - y) <= 1) || (Math.abs(bed.y - y) === 2 && Math.abs(bed.x - x) <= 1)));
}
const routeCache = new WeakMap();
function reachable(state, added = []) {
  const { width, height } = state.world, blocked = new Set([
    ...decorationItems(state).flatMap(item => decorationCells(item.kind, item.x, item.y)),
    ...settlementSolidCells(state),
    ...(state.industry?.machines || []).flatMap(item => machineCells(item.kind, item.x, item.y)), ...added,
  ].map(cell => key(cell.x, cell.y)));
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const visitable = (x, y) => land(state.world, x, y) && !hubCell(state, x, y) && !blocked.has(key(x, y));
  // The walk starts at the arrival tile, or at the nearest open tile when construction
  // covers it, the same search the runtime uses to seat an arriving worker.
  let sx = Math.floor(state.world.spawn.x), sy = Math.floor(state.world.spawn.y);
  if (!visitable(sx, sy)) {
    let found = false;
    for (let radius = 1; radius <= 8 && !found; radius++) for (let dy = -radius; dy <= radius && !found; dy++) for (let dx = -radius; dx <= radius && !found; dx++) {
      if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
      if (visitable(sx + dx, sy + dy)) { sx += dx; sy += dy; found = true; }
    }
    if (!found) return { visited, count: 0 };
  }
  let read = 0, count = 1; queue[0] = sy * width + sx; visited[queue[0]] = 1;
  while (read < count) {
    const index = queue[read++], x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of vector) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (visitable(nx, ny) && !visited[next]) { visited[next] = 1; queue[count++] = next; }
    }
  }
  return { visited, count };
}
function blocksRoute(state, cells) {
  const signature = JSON.stringify([state.world.version, decorationItems(state).map(d => [d.kind, d.x, d.y]), settlementItems(state).map(d => [d.kind, d.x, d.y, d.dir]), (state.industry?.machines || []).map(d => [d.kind, d.x, d.y])]);
  let cached = routeCache.get(state.world);
  if (!cached || signature !== cached.signature) { cached = { signature, baseline: reachable(state), sites: new Map() }; routeCache.set(state.world, cached); }
  const site = cells.map(c => key(c.x, c.y)).join('|');
  if (!cached.sites.has(site)) {
    if (cached.sites.size > 64) cached.sites.clear();
    const covered = cells.reduce((sum, c) => sum + (cached.baseline.visited[c.y * state.world.width + c.x] || 0), 0);
    cached.sites.set(site, reachable(state, cells).count < cached.baseline.count - covered);
  }
  return cached.sites.get(site);
}
/** Preview is read-only; old expeditions remain unchanged until a valid build. @param {any} state @param {any} bedId */
export function industryPlacementError(state, kind, x, y, dir = 1, bedId = undefined) {
  if (state.world?.regionId && state.world.regionId !== 'home') return 'Build industry in the home district.';
  const spec = Object.hasOwn(INDUSTRY.kinds, kind) ? INDUSTRY.kinds[kind] : null;
  if (!spec) return 'Choose an industrial machine or conveyor.';
  if (!Number.isInteger(x) || !Number.isInteger(y) || !validDirection(dir)) return 'Choose a whole tile and one of four directions.';
  if (industryItems(state).filter(item => item.kind === kind).length >= spec.limit) return `This expedition has room for ${spec.limit} ${spec.name.toLowerCase()} units.`;
  const cells = machineCells(kind, x, y);
  for (const cell of cells) {
    if (Math.hypot(cell.x + .5 - state.hub.x, cell.y + .5 - state.hub.y) > 14) return 'Keep the whole footprint inside the surveyed garden.';
    if (!land(state.world, cell.x, cell.y)) return 'Choose clear, firm ground for the whole footprint.';
    if ((state.crates || []).some(crate => crate.x === cell.x && crate.y === cell.y)) return 'Collect the crate first.';
    if (hubCell(state, cell.x, cell.y) || padCell(state, cell.x, cell.y) || state.beds.some(bed => bedCell(bed, cell.x, cell.y)) || state.sprinklers.some(s => s.x === cell.x && s.y === cell.y) || decorationAt(state, cell.x, cell.y) || settlementAt(state, cell.x, cell.y) || industryAt(state, cell.x, cell.y)) return 'Leave room around existing beds, equipment and buildings.';
    if ((state.players || []).some(p => Math.abs(p.x - cell.x - .5) < .74 && Math.abs(p.y - cell.y - .5) < .74)) return 'Move the worker clear of this site.';
  }
  if (kind === 'outlet') {
    const bed = outletBed(state, x, y, bedId);
    if (!bed) return 'Place a harvest outlet beside the edge of a garden bed.';
    if (state.industry?.machines.some(machine => machine.kind === 'outlet' && machine.bedId === bed.id)) return 'This bed already has a harvest outlet.';
    const port = machinePorts({ kind, x, y, dir }).output;
    if (bedCell(bed, port.x, port.y)) return 'Point the outlet away from its garden bed.';
  }
  if (kind !== 'belt' && blocksRoute(state, cells)) return 'Keep a walking route open around the settlement.';
  const groundError = groundPlacementError(state, cells);
  if (groundError) return groundError;
  return state.materials < spec.cost ? `You need ${spec.cost} materials.` : null;
}

function canStore(state, cargo) {
  const rawCount = total(state.storage) + Object.entries(cargo).filter(([item]) => raw(item)).reduce((sum, [, n]) => sum + n, 0);
  const processed = total(state.industry?.storage) + Object.entries(cargo).filter(([item]) => !raw(item)).reduce((sum, [, n]) => sum + n, 0);
  return rawCount <= INDUSTRY.storageCapacity && processed <= INDUSTRY.storageCapacity;
}
function store(state, item, amount) {
  const inventory = raw(item) ? state.storage : init(state).storage;
  inventory[item] = (inventory[item] || 0) + amount;
}
function recoverable(machine) {
  const cargo = {};
  const add = (item, amount) => { cargo[item] = (cargo[item] || 0) + amount; };
  if (machine.kind === 'belt') { if (machine.item) add(machine.item, 1); }
  else {
    for (const inventory of [machine.input, machine.output]) for (const [item, amount] of Object.entries(inventory)) add(item, amount);
    if (machine.job) add(machine.job.crop, recipeFor(machine.job.crop).input);
  }
  return cargo;
}
function accepts(machine, item) {
  if (machine.kind === 'processor') return raw(item) && total(machine.input) < INDUSTRY.inputCapacity;
  if (machine.kind === 'generator') return (raw(item) || item === 'biomass') && total(machine.input) < INDUSTRY.fuelCapacity;
  return machine.kind === 'belt' && !machine.item;
}

export const isIndustryAction = action => ['build-industry', 'industry-load', 'industry-unload', 'industry-remove', 'industry-rotate', 'industry-toggle', 'ship-provisions'].includes(action);
/** All validation precedes mutation. Runtime copies and durably commits the result. @param {any} state @param {any} actor @param {any} data */
export function industryAction(state, actor, action, data) {
  let message, targetId;
  if (action === 'build-industry') {
    const dir = data.dir ?? 1;
    const error = industryPlacementError({ ...state, players: actor.players || [] }, data.kind, data.x, data.y, dir, data.bedId);
    if (error) reject(error);
    const industry = init(state), spec = INDUSTRY.kinds[data.kind];
    targetId = `${data.kind}-${state.nextId++}`;
    // builtAt drives the shared print animation only; the machine works at once.
    const base = { id: targetId, kind: data.kind, x: data.x, y: data.y, dir, revision: 0, enabled: true, cost: spec.cost, builtAt: state.time || 0 };
    if (data.kind === 'belt') industry.belts.push({ ...base, item: null, progress: 0 });
    else industry.machines.push({ ...base, input: {}, output: {}, job: null, fuelEnergy: 0, ...(data.kind === 'outlet' ? { bedId: outletBed(state, data.x, data.y, data.bedId).id } : data.kind === 'collector' || data.kind === 'warehouse' ? { task: null } : {}) });
    state.materials -= spec.cost; message = `${spec.name} installed.`;
  } else if (action === 'ship-provisions') {
    if (state.shipment) reject('Your shuttle is already carrying a shipment.');
    if (industryStored(state, 'provisions') < 2) reject('Collect two provisions for an orbital delivery.');
    targetId = `shipment-${state.nextId++}`; state.industry.storage.provisions -= 2;
    state.shipment = { id: targetId, remaining: 8, duration: 8, cargo: { provisions: 2 }, reward: INDUSTRY.provisionReward };
    message = 'Provisions sent. Your shuttle will return with 24 materials.';
  } else {
    const machine = industryItems(state).find(item => item.id === data.machineId);
    if (!machine) reject('That machine is no longer available.', 404);
    if (!Number.isInteger(data.revision) || data.revision !== machine.revision) reject('This machine changed. Please try again.');
    targetId = machine.id;
    if (action === 'industry-load') {
      const amount = data.amount ?? 1;
      if (!known(data.item) || !Number.isInteger(amount) || amount < 1 || amount > 99) reject('Choose a valid item and quantity.', 400);
      if (industryStored(state, data.item) < amount) reject('The shared reserve does not contain that much cargo.');
      if (!accepts(machine, data.item)) reject('This machine cannot accept that cargo, or its input is full.');
      const capacity = machine.kind === 'belt' ? 1 : machine.kind === 'generator' ? INDUSTRY.fuelCapacity : INDUSTRY.inputCapacity;
      if ((machine.kind === 'belt' ? 0 : total(machine.input)) + amount > capacity) reject('There is not enough room in this machine.');
      store(state, data.item, -amount);
      if (machine.kind === 'belt') { machine.item = data.item; machine.progress = 0; }
      else machine.input[data.item] = (machine.input[data.item] || 0) + amount;
      message = 'Cargo loaded.';
    } else if (action === 'industry-unload' || action === 'industry-remove') {
      const cargo = recoverable(machine);
      if (!canStore(state, cargo)) reject('Shared storage is full. Make room before recovering this machine and its cargo.');
      for (const [item, amount] of Object.entries(cargo)) store(state, item, amount);
      if (action === 'industry-remove') {
        state.industry.energy += machine.fuelEnergy || 0;
        state.materials += machine.cost;
        state.industry.machines = state.industry.machines.filter(item => item.id !== machine.id);
        state.industry.belts = state.industry.belts.filter(item => item.id !== machine.id);
        message = 'Machine recovered. Layout materials and cargo returned.';
      } else {
        if (machine.kind === 'belt') { machine.item = null; machine.progress = 0; }
        else { machine.input = {}; machine.output = {}; machine.job = null; }
        message = 'Cargo recovered to shared storage.';
      }
    } else if (action === 'industry-rotate') {
      if (!validDirection(data.dir)) reject('Choose one of four directions.', 400);
      if (machine.kind === 'outlet') {
        const bed = state.beds.find(b => b.id === machine.bedId), port = machinePorts({ ...machine, dir: data.dir }).output;
        if (bed && bedCell(bed, port.x, port.y)) reject('Point the outlet away from its garden bed.');
      }
      machine.dir = data.dir; message = 'Machine direction updated.';
    } else if (action === 'industry-toggle') { machine.enabled = !machine.enabled; message = machine.enabled ? 'Machine enabled.' : 'Machine paused.';
    } else reject('Unknown industry command.', 400);
    machine.revision++;
  }
  return { ok: true, message, targetId };
}

function outputRoom(machine, recipe) {
  return (machine.output.provisions || 0) + recipe.provisions <= INDUSTRY.outputCapacity && (machine.output.biomass || 0) + recipe.biomass <= INDUSTRY.outputCapacity;
}
function fuelItem(machine) { return ['biomass', 'sundrop', 'moonberry', 'cloudmelon'].find(item => machine.input[item] > 0); }
/** A processor cooks whatever crop it holds: the crop with the most stock that fills a recipe, ties in recipe order. */
function processorBatches(machine) {
  return INDUSTRY_RECIPES.filter(recipe => (machine.input[recipe.id] || 0) >= recipe.input)
    .sort((a, b) => (machine.input[b.id] || 0) - (machine.input[a.id] || 0) || INDUSTRY_RECIPES.indexOf(a) - INDUSTRY_RECIPES.indexOf(b));
}
const nextBatch = machine => processorBatches(machine).find(recipe => outputRoom(machine, recipe)) || null;
/** What one Load press would put in, with no choice to make: biomass before crops for a generator, the crop
 * with the most stock for a processor, up to four at a time. @param {any} state @param {any} machine */
export function loadChoice(state, machine) {
  if (machine.kind !== 'generator' && machine.kind !== 'processor') return null;
  const crops = INDUSTRY_RECIPES.map(recipe => recipe.id).filter(id => industryStored(state, id) > 0).sort((a, b) => industryStored(state, b) - industryStored(state, a));
  const item = machine.kind === 'generator' && industryStored(state, 'biomass') > 0 ? 'biomass' : crops[0];
  if (!item) return null;
  const room = (machine.kind === 'generator' ? INDUSTRY.fuelCapacity : INDUSTRY.inputCapacity) - total(machine.input);
  const amount = Math.min(4, room, industryStored(state, item));
  return amount >= 1 ? { item, amount } : null;
}
function outletCrop(state, machine, crops) {
  const bed = state.beds.find(b => b.id === machine.bedId), crop = crops.find(c => c.id === bed?.crop);
  return { bed, crop };
}
/** Read-only state label, also safe on a pre-industry save. @param {any} state @param {any} machine */
export function industryStatus(state, machine) {
  if (!machine) return 'Select a machine';
  if (!machine.enabled) return 'Paused';
  if (machine.kind === 'belt') return !machine.item ? 'Empty' : machine.progress >= 1 ? 'Waiting for space' : 'Transporting';
  if (machine.kind === 'generator') return state.industry.energy >= INDUSTRY.energyCapacity - 1e-8 ? 'Reserve full' : machine.fuelEnergy > 0 || fuelItem(machine) ? 'Generating' : 'Needs fuel';
  if (machine.kind === 'collector') return machine.task ? 'Collecting' : !reachableCrates(state, machine).length ? 'Waiting for crates' : state.industry.energy < INDUSTRY.collectorEnergy ? 'Needs power' : 'Collecting';
  if (machine.kind === 'warehouse') return machine.task ? machine.task.phase === 'back' ? 'Drone returning' : 'Drone fetching' : reachableCrates(state, machine).length ? 'Sending drone' : 'Open';
  if (machine.kind === 'outlet') {
    if (machine.harvestMotion?.elapsed < machine.harvestMotion?.duration) return 'Harvesting';
    const bed = state.beds.find(b => b.id === machine.bedId);
    if (!bed?.crop) return 'Plant the attached bed';
    if (total(machine.output) + cropById(bed.crop).yield > INDUSTRY.outputCapacity) return 'Output full';
    if (state.industry.energy < 2) return 'Needs power';
    return bedReady(bed) ? 'Harvesting' : 'Waiting for crop';
  }
  if (!machine.job && !processorBatches(machine).length) return 'Needs crops';
  if (!machine.job && !nextBatch(machine)) return 'Output full';
  if (state.industry.energy <= 1e-8) return 'Needs power';
  return machine.job ? 'Processing' : 'Ready';
}
/** @param {any} state @param {any} machine */
export function industryWorking(state, machine) {
  if (!machine || !machine.enabled) return false;
  if (machine.kind === 'outlet') return !!machine.harvestMotion && machine.harvestMotion.elapsed < machine.harvestMotion.duration;
  return ['Transporting', 'Generating', 'Processing', 'Collecting', 'Drone fetching', 'Drone returning'].includes(industryStatus(state, machine));
}

/** Crates a collector may take: within reach and claimed by no collector, nearest first. @param {any} state @param {any} machine */
export function reachableCrates(state, machine) {
  const half = (INDUSTRY.kinds[machine.kind]?.size || 2) / 2, cx = machine.x + half, cy = machine.y + half, reach = machine.kind === 'warehouse' ? Infinity : INDUSTRY.collectorReach;
  const claimed = new Set(industryItems(state).map(item => item.task?.crateId).filter(Boolean));
  return (state.crates || [])
    .filter(crate => !claimed.has(crate.id) && Math.max(Math.abs(crate.x + .5 - cx), Math.abs(crate.y + .5 - cy)) <= reach)
    .sort((a, b) => Math.hypot(a.x + .5 - cx, a.y + .5 - cy) - Math.hypot(b.x + .5 - cx, b.y + .5 - cy));
}

/** Normalized mechanical phase, advanced by actual work and frozen while idle.
 * Snapshot interpolation never changes production. @param {any} state @param {any} machine
 */
export function industryMotion(state, machine, time = state.time || 0, reduced = false) {
  const active = industryWorking(state, machine);
  let lead = active && !reduced ? Math.min(.3, Math.max(0, time - (state.time || 0))) : 0;
  if (machine.kind === 'outlet' || machine.kind === 'collector' || machine.kind === 'warehouse') {
    const task = machine.kind === 'outlet' ? machine.harvestMotion : machine.task;
    if (task) lead = Math.min(lead, task.duration - task.elapsed);
    return { active, phase: reduced || !task ? 0 : Math.min(1, (task.elapsed + lead) / task.duration) };
  }
  if (machine.kind === 'belt') lead = Math.min(lead, Math.max(0, 1 - (machine.progress || 0)) * INDUSTRY.beltSeconds);
  if (machine.kind === 'processor' && machine.job) lead = Math.min(lead, Math.max(0, machine.job.seconds - machine.job.elapsed), state.industry.energy);
  if (machine.kind === 'generator') lead = Math.min(lead, Math.max(0, INDUSTRY.energyCapacity - state.industry.energy) / 2);
  const fallback = machine.kind === 'processor' ? (machine.job?.elapsed || 0) * motionRate(machine.kind)
    : machine.kind === 'belt' ? machine.progress || 0 : 0;
  return { active, phase: reduced ? 0 : ((machine.motionPhase ?? fallback) + lead * motionRate(machine.kind)) % 1 };
}

// A bounded route index is built once per simulation call, not once per item.
function transportIndex(state) {
  const belts = new Map(state.industry.belts.map(b => [key(b.x, b.y), b])), inputs = new Map();
  for (const machine of state.industry.machines) {
    const port = machinePorts(machine).input;
    if (port) {
      const portKey = key(port.x, port.y);
      if (!inputs.has(portKey)) inputs.set(portKey, []);
      inputs.get(portKey).push(machine);
    }
  }
  return { belts, inputs };
}
/** A machine on the port cell whose IN port lies on the source machine accepts cargo without a belt. */
function directReceiver(state, source, port, item) {
  const sourceCells = machineCells(source.kind, source.x, source.y);
  return state.industry.machines.find(machine => machine !== source && machine.enabled
    && machineCells(machine.kind, machine.x, machine.y).some(cell => cell.x === port.x && cell.y === port.y)
    && (() => { const input = machinePorts(machine).input; return !!input && sourceCells.some(cell => cell.x === input.x && cell.y === input.y); })()
    && accepts(machine, item)) || null;
}
function moveCargo(state, dt, index) {
  const belts = state.industry.belts;
  const occupied = new Set(belts.filter(b => b.item).map(b => b.id));
  for (const belt of belts) {
    if (!belt.enabled || !belt.item || !occupied.has(belt.id)) continue;
    const previousProgress = belt.progress;
    belt.progress = Math.min(1, belt.progress + dt / INDUSTRY.beltSeconds);
    advanceMotion(belt, (belt.progress - previousProgress) * INDUSTRY.beltSeconds);
    if (belt.progress < 1 - 1e-8) continue;
    const [dx, dy] = vector[belt.dir], nx = belt.x + dx, ny = belt.y + dy;
    const next = index.belts.get(key(nx, ny)), machine = (index.inputs.get(key(belt.x, belt.y)) || []).find(m => machineCells(m.kind, m.x, m.y).some(c => c.x === nx && c.y === ny));
    let delivered = false;
    if (next && next.enabled && !occupied.has(next.id) && !next.item) {
      next.item = belt.item; next.progress = 0; delivered = true;
    } else if (machine && machineCells(machine.kind, machine.x, machine.y).some(c => c.x === nx && c.y === ny) && accepts(machine, belt.item)) {
      machine.input[belt.item] = (machine.input[belt.item] || 0) + 1; delivered = true;
    } else if (padCell(state, nx, ny) && canStore(state, { [belt.item]: 1 })) {
      store(state, belt.item, 1); delivered = true;
    }
    if (delivered) { belt.item = null; belt.progress = 0; }
  }
  for (const machine of state.industry.machines) {
    if (!machine.enabled) continue;
    const ports = machinePorts(machine);
    for (const type of ['output', 'byproduct']) {
      const port = ports[type]; if (!port) continue;
      const item = machine.kind === 'processor' ? type === 'byproduct' ? 'biomass' : 'provisions' : Object.keys(machine.output).find(id => machine.output[id] > 0);
      if (!item || !machine.output[item]) continue;
      const belt = index.belts.get(key(port.x, port.y));
      if (belt) {
        if (!belt.enabled || belt.item) continue;
        machine.output[item]--; belt.item = item; belt.progress = 0; continue;
      }
      // No conveyor: a machine standing on the port cell whose own IN port sits on this
      // machine takes the cargo directly, so an outlet can feed a processor beside it.
      const receiver = directReceiver(state, machine, port, item);
      if (receiver) { machine.output[item]--; receiver.input[item] = (receiver.input[item] || 0) + 1; continue; }
      if (!industryAt(state, port.x, port.y) && canStore(state, { [item]: 1 })) { machine.output[item]--; store(state, item, 1); }
    }
  }
}

/** Advance bounded local inventories using only active room time. @param {any} state @param {ReadonlyArray<any>} crops */
export function tickIndustry(state, dt, crops = CROPS) {
  if (!state.industry || !Number.isFinite(dt) || dt <= 0) return;
  const industry = state.industry, index = transportIndex(state);
  grantStarter(industry);
  // Runtime normally supplies <= .25 s. Substeps also make offline-free test
  // advancement and delayed frames conserve cargo and retain belt travel time.
  const steps = Math.ceil(dt / .1), interval = dt / steps;
  for (let step = 0; step < steps; step++) {
    for (const machine of industry.machines) {
      if (machine.kind !== 'generator' || !machine.enabled || industry.energy >= INDUSTRY.energyCapacity - 1e-8) continue;
      let budget = Math.min(2 * interval, INDUSTRY.energyCapacity - industry.energy);
      while (budget > 1e-8) {
        if (machine.fuelEnergy < 1e-8) {
          const item = fuelItem(machine); if (!item) break;
          machine.input[item]--; machine.fuelEnergy = item === 'biomass' ? 60 : 24;
        }
        const generated = Math.min(budget, machine.fuelEnergy);
        machine.fuelEnergy -= generated; industry.energy += generated; budget -= generated;
        advanceMotion(machine, generated / 2);
      }
    }
    for (const machine of industry.machines) {
      if (!machine.enabled) continue;
      if (machine.kind === 'processor') {
        const recipe = machine.job ? null : nextBatch(machine);
        if (recipe && industry.energy > 1e-8) {
          machine.input[recipe.id] -= recipe.input; machine.job = { crop: recipe.id, elapsed: 0, seconds: recipe.seconds };
        }
        if (machine.job) {
          const job = machine.job, worked = Math.min(interval, industry.energy, job.seconds - job.elapsed);
          job.elapsed += worked; industry.energy = Math.max(0, industry.energy - worked);
          advanceMotion(machine, worked);
          if (job.elapsed >= job.seconds - 1e-8) {
            const done = recipeFor(job.crop);
            machine.output.provisions = (machine.output.provisions || 0) + done.provisions;
            machine.output.biomass = (machine.output.biomass || 0) + done.biomass;
            machine.job = null;
          }
        }
      } else if (machine.kind === 'outlet') {
        if (machine.harvestMotion && machine.harvestMotion.elapsed < machine.harvestMotion.duration) {
          machine.harvestMotion.elapsed = Math.min(machine.harvestMotion.duration, machine.harvestMotion.elapsed + interval);
        }
        const { bed, crop } = outletCrop(state, machine, crops);
        if (crop && bed.growth >= crop.growTime - 1e-8 && total(machine.output) + crop.yield <= INDUSTRY.outputCapacity && industry.energy >= 2) {
          industry.energy -= 2; machine.output[crop.id] = (machine.output[crop.id] || 0) + crop.yield;
          bed.growth = 0; bed.harvests++; bed.revision++;
          machine.harvestMotion = { elapsed: 0, duration: 1.2, crop: crop.id };
          if (!state.discovered.includes(crop.id)) state.discovered.push(crop.id);
          state.milestones.firstHarvest = true;
          // Free seed replants the same crop. Water retains existing rules.
        }
      }
    }
    moveCargo(state, interval, index);
  }
}
