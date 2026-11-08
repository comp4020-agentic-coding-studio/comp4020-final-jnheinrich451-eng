// Peaceful expedition rules. This module deliberately imports no combat systems.
// Coordinates are tiles. A bed's integer x/y identifies its central tile.
import { colonyPlanetById } from './colony-planets.js';
import { AMBIENCE, LIGHTING_PRESETS, WEATHER_PRESETS, defaultEnvironment, decorationItems,
  decorationCells, decorationAt, cinemaPosition, tickCinema } from './colony-ambience.js';
import { INDUSTRY, industryItems, industryAt, machineCells, industryPlacementError,
  isIndustryAction, industryAction, tickIndustry } from './colony-industry.js';
import { CROPS, cropById, bedReady } from './colony-crops.js';
import { industryStored } from './colony-industry.js';
import { settlementDefinition, settlementItems, settlementCells, settlementAt, settlementPlacementError,
  isSettlementAction, settlementAction, tickSettlement } from './colony-settlement.js';
import { tickIrrigation } from './colony-machinery.js';
import { createGround, groundPlacementError, tickGround } from './colony-ground.js';
import { isPetAction, petAction } from './colony-pet.js';
import { unloadCrates, collectCrate, cratePlacementError, tickCollectors } from './colony-crates.js';
export { CROPS, cropById, bedReady } from './colony-crops.js';

export const COLONY = Object.freeze({
  width: 72, height: 56, surveyRadius: 14,
  bedCost: 6, sprinklerCost: 12, sprinklerRadius: 5,
  waterDuration: 90, bedLimit: 16, sprinklerLimit: 8,
  // A parcel earns 8 materials per crop and 12 per provision (two crops still make the
  // original 16-material sample box). The 14 s trip leaves room for the launch and landing.
  storageCapacity: 99, shipmentDuration: 14, shipmentReward: 16, cropReward: 8, provisionReward: 12,
  robotSpeed: 3.5, robotRadius: .24,
});

const planets = { 'caldera-v1': 'Caldera', 'vesper-v1': 'Vesper', 'sirocco-v1': 'Sirocco' };
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

// The new civilian districts have separate geography, not recolored military
// shorelines. Their starter clearing remains continuous and comfortably usable.
// 0 water, 1 shore/mineral soil, 2 vegetated ground, 3 impassable rock.
function civilianTerrain(template, width, height) {
  const terrain = Array(width * height).fill(0);
  const oval = (x, y, cx, cy, rx, ry) => Math.hypot((x - cx) / rx, (y - cy) / ry);
  const ponds = template === 'morrow-v1'
    ? [[18, 16, 4.8, 3.1], [16, 21, 3.4, 2.8], [21, 41, 4.7, 3.2], [54, 15, 5.2, 3.8], [57, 21, 3.1, 3.1], [51, 42, 3.8, 2.8]]
    : template === 'nacre-v1'
      ? [[17, 18, 5.2, 5.8], [16, 37, 5.9, 5.1], [54, 19, 5.8, 3.8], [56, 34, 6.8, 5.2], [29, 10, 5.2, 2.6]]
      : [[16, 29, 4.1, 7.3], [55, 16, 5.7, 3.2], [54, 39, 5.1, 4.0], [26, 10, 4.7, 2.7]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x + .5, py = y + .5, dx = px - 36, dy = py - 28;
    const angle = Math.atan2(dy, dx), distance = Math.hypot(dx, dy);
    let edge, interior;
    if (template === 'morrow-v1') {
      edge = oval(px, py, 36, 28, 31, 23);
      interior = 1 + .055 * Math.sin(angle * 3 + .6) + .035 * Math.cos(angle * 7);
    } else if (template === 'nacre-v1') {
      edge = oval(px, py, 37, 28, 29, 22);
      interior = 1 + .11 * Math.sin(angle * 5 - .7) + .04 * Math.cos(angle * 9);
    } else {
      edge = oval(px, py, 35, 28, 32, 22);
      interior = 1 + .035 * Math.sin(angle * 4) + .04 * Math.cos(angle * 6 + .4);
    }
    let kind = edge < interior ? (edge > interior - (template === 'nacre-v1' ? .16 : .09) ? 1 : 2) : 0;
    if (kind && template === 'aurelia-v1') {
      // Broad walkable terrace bands, rather than new height/collision rules.
      const terrace = (py + Math.sin(px * .12) * 3.2 + Math.cos(px * .04) * 2.5) % 8.5;
      if (terrace < 1.6) kind = 1;
    }
    for (const [cx, cy, rx, ry] of ponds) {
      const pond = oval(px, py, cx, cy, rx, ry);
      if (pond < 1) kind = 0;
      else if (kind && pond < 1.23) kind = 1;
    }
    if (kind && distance > 16.5) {
      const salt = template === 'morrow-v1' ? 11 : template === 'nacre-v1' ? 31 : 59;
      if ((x * 29 + y * 43 + salt) % (template === 'aurelia-v1' ? 71 : 137) === 0) kind = 3;
    }
    // Keep the original hub, shuttle and starter build sites usable. This
    // override is generated once for new worlds; saved terrain is never rebuilt.
    if (distance <= 12.25) kind = 2;
    terrain[y * width + x] = kind;
  }
  return terrain;
}

/** A small, deterministic surveyed district, independent of military maps. */
export function createColony(template = 'caldera-v1') {
  const civilian = colonyPlanetById(template);
  if (!civilian && !Object.hasOwn(planets, template)) reject('Choose an available planet.', 400);
  const { width, height } = COLONY, terrain = civilian ? civilianTerrain(template, width, height) : Array(width * height).fill(0);
  const variant = template === 'vesper-v1' ? 1 : template === 'sirocco-v1' ? 2 : 0;
  // Preserve the original expedition templates exactly for old saves/clients.
  if (!civilian) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (x - 36) / 31, dy = (y - 28) / 23, angle = Math.atan2(dy, dx);
    const edge = 1 + .055 * Math.sin(angle * 5 + variant);
    const distance = Math.hypot(dx, dy), i = y * width + x;
    if (distance < edge) terrain[i] = distance > edge - .14 || variant === 2 ? 1 : 2;
    if (terrain[i] && Math.hypot(x - 36, y - 28) > 17 && (x * 17 + y * 29 + variant * 11) % 101 === 0) terrain[i] = 3;
    // A little eastern pond gives each district a recognizable, calm landmark.
    if (Math.hypot((x - 55) / 4.5, (y - 16) / 3.7) < 1) terrain[i] = 0;
    // Every template admits the same complete starter garden and walking room.
    if (Math.hypot(x + .5 - 36, y + .5 - 28) <= 16) terrain[i] = variant === 2 ? 1 : 2;
  }
  const state = {
    version: 1, mode: 'colonization', template, time: 0, revision: 0, nextId: 1,
    world: { version: 1, id: `colony-${template}`, template, name: civilian?.name || planets[template],
      district: civilian?.district || 'Firstlight Meadow', width, height, terrain, spawn: { x: 36.5, y: 31.5 } },
    hub: { x: 36, y: 28 }, pad: { x: 43, y: 28 },
    /** @type {Array<{id:string,x:number,y:number,crop:string|null,growth:number,water:number,harvests:number,revision:number}>} */
    beds: [],
    /** @type {Array<{id:string,x:number,y:number}>} */
    sprinklers: [],
    /** @type {Record<string,number>} */
    storage: { sundrop: 0, moonberry: 0, cloudmelon: 0 },
    materials: 40,
    /** @type {null | {id:string,remaining:number,duration:number,cargo:Record<string,number>,reward:number}} */
    shipment: null,
    shipments: 0,
    /** @type {string[]} */
    discovered: [],
    milestones: { firstPlant: false, firstHarvest: false, firstShipment: false },
    decorations: { pennant: false },
  };
  // Ground is the last field: the starting clearing and every footprint begin conditioned.
  return { ...state, ground: createGround(state) };
}

const hubCell = (state, x, y) => x >= state.hub.x - 1 && x < state.hub.x + 1 && y >= state.hub.y - 1 && y < state.hub.y + 1;
const padCell = (state, x, y) => Math.abs(x - state.pad.x) <= 1 && Math.abs(y - state.pad.y) <= 1;
const bedCell = (bed, x, y) => Math.abs(x - bed.x) <= 1 && Math.abs(y - bed.y) <= 1;
const land = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height && [1, 2, 4].includes(world.terrain[y * world.width + x]);

/** The ship always supplies the first bed, even after spending the starter kit. @param {any} state */
export const colonyBuildCost = (state, kind) => kind === 'bed' ? state.beds.length === 0 ? 0 : COLONY.bedCost
  : kind === 'sprinkler' ? COLONY.sprinklerCost : settlementDefinition(kind)?.cost ?? INDUSTRY.kinds[kind]?.cost ?? 0;

const routeCaches = new WeakMap();
function reachableGround(state, added = []) {
  const { width, height } = state.world, visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const blocks = new Set([...decorationItems(state).flatMap(item => decorationCells(item.kind, item.x, item.y)), ...industryItems(state).filter(item => item.kind !== 'belt').flatMap(item => machineCells(item.kind, item.x, item.y)), ...settlementItems(state).filter(item => settlementDefinition(item.kind)?.solid).flatMap(item => settlementCells(item)), ...added].map(cell => cell.y * width + cell.x));
  const sx = Math.floor(state.world.spawn.x), sy = Math.floor(state.world.spawn.y);
  const canVisit = (x, y) => land(state.world, x, y) && !hubCell(state, x, y) && !blocks.has(y * width + x);
  if (!canVisit(sx, sy)) return { count: 0, visited };
  let read = 0, count = 1; queue[0] = sy * width + sx; visited[queue[0]] = 1;
  while (read < count) {
    const index = queue[read++], x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (canVisit(nx, ny) && !visited[next]) { visited[next] = 1; queue[count++] = next; }
    }
  }
  return { count, visited };
}
function blocksRoute(state, kind, x, y) {
  // The world is immutable. Cache repeated placement previews, invalidating
  // when any solid decoration changes. Moving workers are checked separately.
  const signature = `${state.world.version}:` + [...decorationItems(state), ...industryItems(state).filter(item => item.kind !== 'belt'), ...settlementItems(state)].map(d => `${d.kind}:${d.x}:${d.y}:${d.dir || 0}`).join('|');
  let cached = routeCaches.get(state.world);
  if (!cached || cached.signature !== signature) {
    cached = { signature, baseline: reachableGround(state), sites: new Map() }; routeCaches.set(state.world, cached);
  }
  const key = `${kind}:${x}:${y}`;
  if (!cached.sites.has(key)) {
    if (cached.sites.size >= 64) cached.sites.clear();
    const cells = decorationCells(kind, x, y);
    const covered = cells.reduce((sum, cell) => sum + cached.baseline.visited[cell.y * state.world.width + cell.x], 0);
    cached.sites.set(key, reachableGround(state, cells).count < cached.baseline.count - covered);
  }
  return cached.sites.get(key);
}

/** @param {any} state */
export function colonyPlacementError(state, kind, x, y) {
  if (state.regionId && state.regionId !== 'home') return 'Return to your home district to build.';
  if (settlementDefinition(kind)) return settlementPlacementError(state, kind, x, y);
  if (Object.hasOwn(INDUSTRY.kinds, kind)) return industryPlacementError(state, kind, x, y);
  if (!['bed', 'sprinkler', 'campfire', 'cinema'].includes(kind)) return 'Choose a garden bed, sprinkler or camp item.';
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 'Choose a whole tile inside the surveyed garden.';
  if (kind === 'bed' && state.beds.length >= COLONY.bedLimit) return `This expedition has room for ${COLONY.bedLimit} beds.`;
  if (kind === 'sprinkler' && state.sprinklers.length >= COLONY.sprinklerLimit) return `This expedition has room for ${COLONY.sprinklerLimit} sprinklers.`;
  const decorative = kind === 'campfire' || kind === 'cinema';
  if (decorative && decorationItems(state).filter(item => item.kind === kind).length >= (kind === 'campfire' ? AMBIENCE.fireLimit : AMBIENCE.cinemaLimit)) return kind === 'campfire' ? 'This camp has room for four fires.' : 'This expedition already has an outdoor cinema.';
  const radius = kind === 'bed' ? 1 : 0;
  const cells = decorative ? decorationCells(kind, x, y) : Array.from({ length: (radius * 2 + 1) ** 2 }, (_, i) => ({ x: x - radius + i % (radius * 2 + 1), y: y - radius + Math.floor(i / (radius * 2 + 1)) }));
  for (const { x: tx, y: ty } of cells) {
    // Camp items keep the survey radius; beds and sprinklers are bounded by conditioned ground instead.
    if (decorative && Math.hypot(tx + .5 - state.hub.x, ty + .5 - state.hub.y) > COLONY.surveyRadius) return 'Keep the whole footprint inside the surveyed garden.';
    if (!land(state.world, tx, ty)) return 'Choose clear, firm ground for the whole footprint.';
    if (hubCell(state, tx, ty) || padCell(state, tx, ty) || state.beds.some(b => bedCell(b, tx, ty)) || state.sprinklers.some(s => s.x === tx && s.y === ty) || decorationAt(state, tx, ty) || industryAt(state, tx, ty) || settlementAt(state, tx, ty)) return 'Leave room around the hub, shuttle pad and existing garden equipment.';
    if (decorative && Math.abs(tx + .5 - state.world.spawn.x) < 1.5 && Math.abs(ty + .5 - state.world.spawn.y) < 1.5) return 'Leave the arrival area clear.';
    if (decorative && (state.players || []).some(p => Math.abs(p.x - (tx + .5)) < .5 + COLONY.robotRadius && Math.abs(p.y - (ty + .5)) < .5 + COLONY.robotRadius)) return 'Move the worker clear of this camp site.';
  }
  if (decorative && blocksRoute(state, kind, x, y)) return 'Keep a walking route open around the camp.';
  const crateError = cratePlacementError(state, cells);
  if (crateError) return crateError;
  const groundError = groundPlacementError(state, cells);
  if (groundError) return groundError;
  const cost = colonyBuildCost(state, kind);
  return state.materials < cost ? `You need ${cost} materials. Send a sample box to request more.` : null;
}

/** Quantity held in shared produce storage. @param {any} state */
export const colonyStored = state => CROPS.reduce((sum, crop) => sum + (state.storage[crop.id] || 0), 0);

/**
 * Every operation is a remote instruction to the ship's garden assistant.
 * The runtime authenticates actor, saves the mutation and deduplicates requests.
 * @param {any} state
 * @param {{id:string,isHost?:boolean,players?:Array<{x:number,y:number}>}} actor
 * @param {string} action
 * @param {any} data
 */
export function colonyAction(state, actor, action, data = {}) {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim()) reject('Join the expedition before tending its garden.', 403);
  if (!data || typeof data !== 'object' || Array.isArray(data)) reject('Use a valid garden command.', 400);
  if (isSettlementAction(action)) {
    const result = settlementAction(state, actor, action, data);
    state.revision++;
    return result;
  }
  if (isPetAction(action)) {
    const result = petAction(state, actor, action, data);
    state.revision++;
    return result;
  }
  if (isIndustryAction(action)) {
    const result = industryAction(state, actor, action, data);
    state.revision++;
    return result;
  }
  let message, targetId;
  if (action === 'set-environment') {
    if (!actor.isHost) reject('Only the expedition host can change the shared atmosphere.', 403);
    if (data.lighting !== undefined && !LIGHTING_PRESETS.includes(data.lighting)) reject('Choose an available light setting.', 400);
    if (data.weather !== undefined && !WEATHER_PRESETS.includes(data.weather)) reject('Choose an available weather setting.', 400);
    if (data.lighting === undefined && data.weather === undefined) reject('Choose a shared atmosphere setting.', 400);
    state.environment = { ...defaultEnvironment(state), ...state.environment,
      ...(data.lighting !== undefined ? { lighting: data.lighting } : {}),
      ...(data.weather !== undefined ? { weather: data.weather } : {}) };
    message = 'Shared atmosphere updated for everyone.';
  } else if (action === 'build-campfire' || action === 'build-cinema') {
    const kind = action === 'build-campfire' ? 'campfire' : 'cinema';
    const error = colonyPlacementError({ ...state, players: actor.players || [] }, kind, data.x, data.y);
    if (error) reject(error);
    targetId = `${kind}-${state.nextId++}`;
    state.decorations ||= { pennant: false }; state.decorations.items ||= [];
    state.decorations.items.push({ id: targetId, kind, x: data.x, y: data.y, lit: true, revision: 0, builtAt: state.time });
    if (kind === 'cinema') state.cinema = { revision: 0, playing: false, position: 0, startedAt: state.time };
    message = kind === 'campfire' ? 'A warm place to gather.' : 'Outdoor cinema ready. Choose Play in Camp.';
  } else if (action === 'toggle-campfire' || action === 'remove-decoration') {
    const item = decorationItems(state).find(value => value.id === data.decorationId);
    if (!item) reject('That camp item is no longer available.', 404);
    if (!Number.isInteger(data.revision) || data.revision !== item.revision) reject('This camp item changed. Please try again.');
    targetId = item.id;
    if (action === 'remove-decoration') {
      state.decorations.items = decorationItems(state).filter(value => value.id !== item.id);
      if (item.kind === 'cinema') state.cinema = null;
      message = 'Camp item packed away.';
    } else {
      if (item.kind !== 'campfire') reject('Choose a campfire.', 400);
      item.lit = !item.lit; item.revision++;
      message = item.lit ? 'The campfire is lit.' : 'The campfire is out.';
    }
  } else if (['cinema-play', 'cinema-pause', 'cinema-restart'].includes(action)) {
    if (!decorationItems(state).some(item => item.kind === 'cinema') || !state.cinema) reject('Place an outdoor screen first.');
    if (!Number.isInteger(data.revision) || data.revision !== state.cinema.revision) reject('The movie controls changed. Please try again.');
    const position = cinemaPosition(state);
    state.cinema = { revision: state.cinema.revision + 1, playing: action !== 'cinema-pause',
      position: action === 'cinema-restart' || (action === 'cinema-play' && position >= AMBIENCE.movieDuration) ? 0 : position,
      startedAt: state.time };
    message = action === 'cinema-pause' ? 'Movie paused for everyone.' : 'Movie playing for everyone.';
  } else if (action === 'build-bed' || action === 'build-sprinkler') {
    const kind = action === 'build-bed' ? 'bed' : 'sprinkler';
    const error = colonyPlacementError(state, kind, data.x, data.y);
    if (error) reject(error);
    const cost = colonyBuildCost(state, kind);
    targetId = `${kind}-${state.nextId++}`;
    if (kind === 'bed') {
      state.beds.push({ id: targetId, x: data.x, y: data.y, crop: null, growth: 0, water: 0, harvests: 0, revision: 0, builtAt: state.time });
      state.materials -= cost; message = 'Your new bed is ready for seeds.';
    } else {
      state.sprinklers.push({ id: targetId, x: data.x, y: data.y, builtAt: state.time });
      state.materials -= COLONY.sprinklerCost; message = 'Sprinkler installed. Nearby beds will stay watered.';
    }
  } else if (['plant', 'water', 'harvest', 'clear'].includes(action)) {
    if (typeof data.bedId !== 'string') reject('Choose a garden bed.', 400);
    const bed = state.beds.find(b => b.id === data.bedId);
    if (!bed) reject('That garden bed is no longer available.', 404);
    // Optional per-bed revisions protect stale clients without blocking work on
    // other beds. Ordinary growth does not advance this interaction revision.
    if (data.revision !== undefined && (!Number.isInteger(data.revision) || data.revision !== bed.revision)) reject('This bed changed. Please try again.');
    targetId = bed.id;
    if (action === 'plant') {
      const crop = cropById(data.crop);
      if (!crop) reject('Choose a seed from the library.', 400);
      if (bed.crop) reject('Harvest this bed before planting another crop.');
      bed.crop = crop.id; bed.growth = 0; bed.harvests = 0;
      state.milestones.firstPlant = true; message = `${crop.name} planted. A little water will help it grow.`;
    } else if (action === 'water') {
      bed.water = COLONY.waterDuration; message = 'Fresh water for your garden.';
    } else if (action === 'clear') {
      if (!bed.crop) reject('This bed is already ready for new seeds.');
      bed.crop = null; bed.growth = 0; bed.harvests = 0;
      message = 'Bed prepared. Choose another seed from the library.';
    } else {
      const crop = cropById(bed.crop);
      if (!crop || !bedReady(bed)) reject('This crop is still growing. It will wait for you when ripe.');
      if (colonyStored(state) + crop.yield > COLONY.storageCapacity) reject('Produce storage is full. Send a shipment before harvesting; your crop will wait.');
      state.storage[crop.id] += crop.yield;
      if (!state.discovered.includes(crop.id)) state.discovered.push(crop.id);
      state.milestones.firstHarvest = true;
      bed.harvests++; bed.growth = 0;
      if (!crop.regrows) bed.crop = null;
      message = `Picked ${crop.yield} ${crop.name}${crop.regrows ? '. The shrub will grow another harvest.' : '. Time for new seeds!'}`;
    }
    bed.revision++;
  } else if (action === 'ship') {
    if (state.shipment) reject('Your shuttle is already carrying a parcel.');
    const cargo = parcel(state, data);
    targetId = `shipment-${state.nextId++}`;
    let reward = 0, count = 0;
    for (const [item, amount] of Object.entries(cargo)) {
      if (item === 'provisions') state.industry.storage.provisions -= amount; else state.storage[item] -= amount;
      reward += amount * (item === 'provisions' ? COLONY.provisionReward : COLONY.cropReward); count += amount;
    }
    state.shipment = { id: targetId, remaining: COLONY.shipmentDuration, duration: COLONY.shipmentDuration, cargo, reward };
    message = `Parcel launched with ${count} ${count === 1 ? 'item' : 'items'}. The shuttle will return with ${reward} materials.`;
  } else if (action === 'collect-crate') {
    if (typeof data.crateId !== 'string') reject('Choose a crate to collect.', 400);
    targetId = data.crateId;
    message = collectCrate(state, actor, data.crateId).message;
  } else reject('Unknown garden command.', 400);
  state.revision++;
  return { ok: true, message, targetId };
}

/** What can ride the shuttle: every crop and the industry's provisions. */
export const SHIPPABLE = Object.freeze([...CROPS.map(crop => crop.id), 'provisions']);
/**
 * The parcel a ship order asks for. No cargo means everything in the reserve; `cargo`
 * names an amount per item (0 to all stored); an old client's `crop` sends two of it.
 * @param {any} state @param {any} data
 */
export function parcel(state, data = {}) {
  /** @type {Record<string, number>} */
  const cargo = {};
  if (data.cargo !== undefined) {
    if (!data.cargo || typeof data.cargo !== 'object' || Array.isArray(data.cargo)) reject('Choose what to send.', 400);
    for (const [item, amount] of Object.entries(data.cargo)) {
      if (!SHIPPABLE.includes(item) || !Number.isInteger(amount) || amount < 0) reject('Choose a valid amount of each cargo.', 400);
      if (amount > industryStored(state, item)) reject('The reserve does not hold that much. Please try again.');
      if (amount) cargo[item] = amount;
    }
  } else if (data.crop !== undefined) {
    const crop = cropById(data.crop);
    if (!crop || state.storage[crop.id] < 2) reject('Harvest two matching crops for a sample box.');
    cargo[crop.id] = 2;
  } else for (const item of SHIPPABLE) { const stored = industryStored(state, item); if (stored > 0) cargo[item] = stored; }
  if (!Object.keys(cargo).length) reject(data.cargo === undefined ? 'Harvest some crops or make provisions to fill a parcel.' : 'Choose at least one item to send.');
  return cargo;
}

/**
 * Advances only the active simulation duration supplied by the room. There is
 * no wall-clock lookup and therefore no offline growth or decay.
 * @param {any} state
 */
export function tickColony(state, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return false;
  state.time += dt;
  tickCinema(state);
  const steps = state.industry || state.template === 'morrow-v1' ? Math.ceil(dt / .25) : 1, interval = dt / steps;
  for (let step = 0; step < steps; step++) {
    const wetTimes = tickIrrigation(state, interval);
    for (const bed of state.beds) {
      const wetTime = wetTimes.get(bed.id) || 0;
      const crop = cropById(bed.crop);
      if (crop) bed.growth = Math.min(crop.growTime, bed.growth + wetTime);
    }
    tickIndustry(state, interval, CROPS);
  }
  tickSettlement(state, dt);
  tickGround(state, dt);
  tickCollectors(state, dt);
  if (state.shipment) {
    state.shipment.remaining = Math.max(0, state.shipment.remaining - dt);
    if (state.shipment.remaining === 0) {
      // The reward lands as crates beside the pad; whatever cannot land is credited at once.
      unloadCrates(state, state.shipment.reward);
      state.shipments++;
      state.milestones.firstShipment = true;
      state.decorations.pennant = true;
      state.shipment = null;
    }
  }
  return true;
}

/** Garden overlays/sprinklers are walkable; hub and camp props are solid. @param {any} state */
export function colonyCanStand(state, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const r = COLONY.robotRadius;
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
    const machine = industryAt(state, tx, ty);
    if (!land(state.world, tx, ty) || hubCell(state, tx, ty) || decorationAt(state, tx, ty) || settlementAt(state, tx, ty, { solidOnly: true }) || (machine && machine.kind !== 'belt')) return false;
  }
  return true;
}

/** @param {any} state @param {any} robot */
export function stepColonyRobot(state, robot, dx, dy, dt) {
  if (![dx, dy, dt, robot?.x, robot?.y].every(Number.isFinite) || dt <= 0 || dt > 1) return false;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  dx /= Math.max(1, length); dy /= Math.max(1, length);
  let changed = false;
  // Substeps keep a delayed tick from crossing a solid hub or a narrow shore.
  const steps = Math.ceil(COLONY.robotSpeed * dt / .15), interval = dt / steps;
  for (let i = 0; i < steps; i++) {
    const x = robot.x + dx * COLONY.robotSpeed * interval;
    if (colonyCanStand(state, x, robot.y)) { changed ||= x !== robot.x; robot.x = x; }
    const y = robot.y + dy * COLONY.robotSpeed * interval;
    if (colonyCanStand(state, robot.x, y)) { changed ||= y !== robot.y; robot.y = y; }
  }
  if (changed) robot.angle = Math.atan2(dy, dx) + Math.PI / 2;
  return changed;
}
