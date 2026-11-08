// The civilian worlds' settlement kit. All costs, placements, deliveries and projects
/// are decided by the colony runtime. No browser clock and no combat-save state.
import { groundPlacementError } from './colony-ground.js';
import { colonyPlanetById } from './colony-planets.js';
export const SETTLEMENT = Object.freeze({ radius: 18, itemLimit: 144, queueLimit: 4, deliverySeconds: 8, assemblySeconds: 6 });
const definition = (id, name, category, cost, width, height, solid, description) => Object.freeze({ id, name, category, cost, width, height, solid, description, variants: ['ivory', 'sage', 'violet'] });
export const SETTLEMENT_CATALOGUE = Object.freeze([
  definition('stepping-stones', 'Stepping stones', 'Paths', 1, 1, 1, false, 'A gentle trail through the meadow.'),
  definition('ivory-paving', 'Ivory paving', 'Paths', 1, 1, 1, false, 'Pale modular paving with warm metal edges.'),
  definition('timber-deck', 'Timber decking', 'Paths', 2, 1, 1, false, 'A warm wooden surface on a civilian frame.'),
  definition('garden-border', 'Garden border', 'Garden', 1, 1, 1, false, 'Low stones and moss for a planted edge.'),
  definition('low-fence', 'Meadow fence', 'Garden', 2, 1, 1, true, 'A white frame with timber rails.'),
  definition('path-lamp', 'Path lamp', 'Lights', 2, 1, 1, true, 'A low amber guide light.'),
  definition('petal-lamp', 'Petal lamp', 'Lights', 3, 1, 1, true, 'A flower-shaped shade around a warm light.'),
  definition('hanging-lights', 'Hanging lights', 'Lights', 4, 2, 1, true, 'A short string of lights between two posts.'),
  definition('bench', 'Garden bench', 'Living', 3, 2, 1, true, 'Timber seating supported by white metal. Walk up and press E to sit.'),
  definition('parking-seat', 'Robot rest pad', 'Living', 2, 1, 1, false, 'A comfortable marked place to park and watch the garden. E to rest.'),
  definition('charging-post', 'Charging post', 'Living', 4, 1, 1, true, 'A white post with a cable hook for a slow charge and a quiet moment. E to plug in.'),
  definition('kettle', 'Brew kettle', 'Living', 3, 1, 1, true, 'A small stand with a kettle and two cups. E to brew.'),
  definition('worktable', 'Field worktable', 'Furniture', 4, 2, 1, true, 'A place for the expedition’s specimens and tools.'),
  definition('wayfinder', 'Trail sign', 'Furniture', 2, 1, 1, true, 'A botanical signpost for your own routes.'),
  definition('pennant', 'Expedition pennant', 'Furniture', 2, 1, 1, true, 'A quiet flag in the colony’s colours.'),
  definition('flower-planter', 'Meadow planter', 'Garden', 3, 1, 1, true, 'Native flowers in a white nursery box.'),
  definition('reed-planter', 'Reed planter', 'Garden', 3, 1, 1, true, 'Upright freshwater reeds and pale seed heads.'),
  definition('specimen-case', 'Specimen case', 'Garden', 4, 1, 1, true, 'A small glass display for a favourite botanical specimen.'),
  definition('trellis', 'Flower trellis', 'Garden', 4, 2, 1, true, 'Climbing flowers across a light frame.'),
  definition('pergola', 'Meadow pergola', 'Shelters', 8, 3, 2, true, 'An open timber canopy with white structural fittings.'),
  definition('cabin', 'Lakeside cabin', 'Shelters', 16, 3, 3, true, 'A warm timber retreat with Frontier glass and white framing.'),
  definition('wind-sculpture', 'Wind sculpture', 'Furniture', 5, 1, 1, true, 'A sculptural fan of pale metal leaves.'),
  definition('pond', 'Garden pond', 'Garden', 8, 2, 2, true, 'A contained pond with reeds and stepping-stone edges.'),
  definition('observation-deck', 'Observation deck', 'Shelters', 8, 3, 2, false, 'A broad timber platform for a quiet moment.'),
]);
export const SETTLEMENT_STARTER = Object.freeze({ 'stepping-stones': 6, 'path-lamp': 2, bench: 1, 'flower-planter': 2 });
export const SETTLEMENT_PROJECTS = Object.freeze([
  Object.freeze({ id: 'lit-route', name: 'A path home', description: 'Place three path pieces and one lamp.', reward: 8 }),
  Object.freeze({ id: 'gathering-corner', name: 'Somewhere to gather', description: 'Place two seats and a shelter or campfire.', reward: 12 }),
  Object.freeze({ id: 'planted-display', name: 'A little of Morrow', names: { 'nacre-v1': 'A little of Nacre', 'aurelia-v1': 'A little of Aurelia' }, description: 'Arrange three botanical furnishings of at least two kinds.', reward: 10 }),
  Object.freeze({ id: 'landing-welcome', name: 'Welcome to the meadow', names: { 'nacre-v1': 'Welcome to the lagoon', 'aurelia-v1': 'Welcome to the terraces' }, description: 'Complete a sample shipment and place a sign or pennant with a lamp.', reward: 12 }),
]);
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const key = (x, y) => `${x}:${y}`;
export const settlementDefinition = id => SETTLEMENT_CATALOGUE.find(item => item.id === id) || null;
export const settlementAvailable = state => !!colonyPlanetById(state?.template) && (!state.regionId || state.regionId === 'home') && (!state.world?.regionId || state.world.regionId === 'home');
export const settlementItems = (state, options = {}) => (state?.settlement?.items || []).filter(item => !options.readyOnly || item.status === 'ready');
export const settlementStored = (state, kind) => Number(state?.settlement ? state.settlement.stored[kind] || 0 : SETTLEMENT_STARTER[kind] || 0);
export const settlementBuildCost = (state, kind) => settlementStored(state, kind) > 0 ? 0 : settlementDefinition(kind)?.cost || 0;
export function settlementSize(kind, dir = 0) {
  const spec = settlementDefinition(kind);
  if (!spec) return { width: 1, height: 1 };
  return dir % 2 ? { width: spec.height, height: spec.width } : { width: spec.width, height: spec.height };
}
/** @param {any} itemOrKind @param {number} [x] @param {number} [y] */
export function settlementCells(itemOrKind, x = undefined, y = undefined, dir = 0) {
  const item = typeof itemOrKind === 'string' ? { kind: itemOrKind, x, y, dir } : itemOrKind;
  const size = settlementSize(item.kind, item.dir || 0);
  return Array.from({ length: size.width * size.height }, (_, i) => ({ x: item.x + i % size.width, y: item.y + Math.floor(i / size.width) }));
}
export const settlementAt = (state, x, y, options = {}) => settlementItems(state).find(item => (!options.solidOnly || settlementDefinition(item.kind)?.solid) && settlementCells(item).some(cell => cell.x === x && cell.y === y)) || null;
export const settlementSolidCells = state => settlementItems(state).filter(item => settlementDefinition(item.kind)?.solid).flatMap(item => settlementCells(item));
const init = state => state.settlement ||= { version: 1, revision: 0, items: [], stored: { ...SETTLEMENT_STARTER }, deliveries: [], completed: [], undo: null };
/** Internal reward helper, never a player command. Discoveries may grant home
 * furnishings while the worker is in another region. Validation precedes init.
 * @param {any} state */
export function grantSettlementFurnishing(state, kind, amount = 1) {
  if (!colonyPlanetById(state?.template) || !settlementDefinition(kind)) fail('Choose a furnishing reward for this expedition.', 400);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 16) fail('Choose between one and sixteen furnishing rewards.', 400);
  const stored = settlementStored(state, kind);
  if (!Number.isSafeInteger(stored) || stored < 0 || stored + amount > SETTLEMENT.itemLimit) fail('The furnishing store cannot accept that reward.');
  const settlement = init(state);
  settlement.stored[kind] = stored + amount;
  settlement.revision++;
  settlement.undo = null;
  return { kind, amount, stored: settlement.stored[kind] };
}
const land = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height && [1, 2, 4].includes(world.terrain[y * world.width + x]);
const hubAt = (state, x, y) => x >= state.hub.x - 1 && x < state.hub.x + 1 && y >= state.hub.y - 1 && y < state.hub.y + 1;
const padAt = (state, x, y) => Math.abs(x - state.pad.x) <= 1 && Math.abs(y - state.pad.y) <= 1;
const bedAt = (bed, x, y) => Math.abs(x - bed.x) <= 1 && Math.abs(y - bed.y) <= 1;
const campCells = item => item.kind === 'cinema' ? [{ x: item.x - 1, y: item.y }, { x: item.x, y: item.y }, { x: item.x + 1, y: item.y }] : [{ x: item.x, y: item.y }];
const machineCells = item => { const size = item.kind === 'warehouse' ? 3 : ['processor', 'generator', 'collector'].includes(item.kind) ? 2 : 1; return Array.from({ length: size * size }, (_, i) => ({ x: item.x + i % size, y: item.y + Math.floor(i / size) })); };
function otherCells(state) {
  return [...(state.decorations?.items || []).flatMap(campCells), ...(state.industry?.machines || []).flatMap(machineCells), ...(state.industry?.belts || []).flatMap(machineCells)];
}
function reachable(state, items, added = []) {
  const { world } = state, { width, height } = world;
  const blocked = new Set([...(state.decorations?.items || []).flatMap(campCells), ...(state.industry?.machines || []).flatMap(machineCells), ...items.filter(item => settlementDefinition(item.kind)?.solid).flatMap(item => settlementCells(item)), ...added].map(cell => key(cell.x, cell.y)));
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  const allowed = (x, y) => land(world, x, y) && !hubAt(state, x, y) && !blocked.has(key(x, y));
  const sx = Math.floor(world.spawn.x), sy = Math.floor(world.spawn.y);
  if (!allowed(sx, sy)) return { count: 0, seen };
  let read = 0, count = 1; queue[0] = sy * width + sx; seen[queue[0]] = 1;
  while (read < count) {
    const index = queue[read++], x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx;
      if (allowed(nx, ny) && !seen[next]) { seen[next] = 1; queue[count++] = next; }
    }
  }
  return { count, seen };
}
const routeCache = new WeakMap();
function wouldBlockRoute(state, items, cells) {
  // Pointer previews repeat at animation frequency. Reuse the same baseline
  // until an actual footprint changes; worker overlap is checked separately.
  const signature = JSON.stringify([state.world.version, state.world.spawn,
    (state.decorations?.items || []).map(item => [item.kind, item.x, item.y]),
    (state.industry?.machines || []).map(item => [item.kind, item.x, item.y]),
    items.filter(item => settlementDefinition(item.kind)?.solid).map(item => [item.kind, item.x, item.y, item.dir])]);
  let cached = routeCache.get(state.world);
  if (!cached || cached.signature !== signature) {
    cached = { signature, baseline: reachable(state, items), sites: new Map() };
    routeCache.set(state.world, cached);
  }
  const site = cells.map(cell => key(cell.x, cell.y)).join('|');
  if (!cached.sites.has(site)) {
    if (cached.sites.size >= 64) cached.sites.clear();
    const covered = cells.reduce((n, cell) => n + cached.baseline.seen[cell.y * state.world.width + cell.x], 0);
    cached.sites.set(site, reachable(state, items, cells).count < cached.baseline.count - covered);
  }
  return cached.sites.get(site);
}
/** Pure preview. Home terrain is preserved; furnishing space extends to 18 tiles. @param {any} state */
export function settlementPlacementError(state, kind, x, y, dir = 0, ignoreId = null, options = {}) {
  if (!settlementAvailable(state)) return 'Furnishing kits open in the home district of a Morrow, Nacre or Aurelia expedition.';
  const spec = settlementDefinition(kind);
  if (!spec) return 'Choose an available furnishing.';
  if (![x, y].every(Number.isInteger) || !Number.isInteger(dir) || dir < 0 || dir > 3) return 'Choose a whole tile and one of four directions.';
  const items = settlementItems(state).filter(item => item.id !== ignoreId);
  if (items.length >= SETTLEMENT.itemLimit) return 'Store a furnishing before adding another; this district holds 144.';
  const cells = settlementCells(kind, x, y, dir), occupied = new Set([...otherCells(state), ...items.flatMap(item => settlementCells(item))].map(cell => key(cell.x, cell.y)));
  for (const cell of cells) {
    if (Math.hypot(cell.x + .5 - state.hub.x, cell.y + .5 - state.hub.y) > SETTLEMENT.radius) return 'Keep the whole furnishing inside the 18-tile settlement area.';
    if (!land(state.world, cell.x, cell.y)) return 'Choose firm ground for the whole furnishing.';
    if ((state.crates || []).some(crate => crate.x === cell.x && crate.y === cell.y)) return 'Collect the crate first.';
    if (hubAt(state, cell.x, cell.y) || padAt(state, cell.x, cell.y) || state.beds.some(bed => bedAt(bed, cell.x, cell.y)) || state.sprinklers.some(s => s.x === cell.x && s.y === cell.y) || occupied.has(key(cell.x, cell.y))) return 'Leave room around the garden, equipment and other furnishings.';
    if (spec.solid && Math.abs(cell.x + .5 - state.world.spawn.x) < 1.5 && Math.abs(cell.y + .5 - state.world.spawn.y) < 1.5) return 'Keep the arrival area open.';
    if (spec.solid && (state.players || []).some(p => (!p.regionId || p.regionId === 'home') && Math.abs(p.x - cell.x - .5) < .74 && Math.abs(p.y - cell.y - .5) < .74)) return 'Move the worker clear of this site.';
  }
  if (spec.solid && wouldBlockRoute(state, items, cells)) return 'Keep a walking route open around the settlement.';
  const groundError = options.ignoreGround ? null : groundPlacementError(state, cells);
  if (groundError) return groundError;
  if (!ignoreId && !options.ignoreCost && state.materials < settlementBuildCost(state, kind)) return `You need ${spec.cost} materials for this furnishing.`;
  return null;
}
const categoryCount = (items, category) => items.filter(item => settlementDefinition(item.kind)?.category === category).length;
export function settlementProjectStatus(state) {
  const items = settlementItems(state, { readyOnly: true });
  const plants = items.filter(item => ['flower-planter', 'reed-planter', 'specimen-case', 'trellis'].includes(item.kind));
  const seats = items.filter(item => ['bench', 'parking-seat'].includes(item.kind)).length;
  const shelter = categoryCount(items, 'Shelters') > 0 || (state.decorations?.items || []).some(item => item.kind === 'campfire');
  const checks = {
    'lit-route': { current: Math.min(3, categoryCount(items, 'Paths')) + Math.min(1, categoryCount(items, 'Lights')), total: 4 },
    'gathering-corner': { current: Math.min(2, seats) + Number(shelter), total: 3 },
    'planted-display': { current: Math.min(3, plants.length) + Math.min(2, new Set(plants.map(item => item.kind)).size), total: 5 },
    'landing-welcome': { current: Number((state.shipments || 0) > 0) + Number(items.some(item => ['wayfinder', 'pennant'].includes(item.kind))) + Number(categoryCount(items, 'Lights') > 0), total: 3 },
  };
  return SETTLEMENT_PROJECTS.map(({ names, ...project }) => ({ ...project, name: names?.[state.template] || project.name, ...checks[project.id], ready: checks[project.id].current >= checks[project.id].total, claimed: (state.settlement?.completed || []).includes(project.id) }));
}
export const isSettlementAction = action => ['build-furnishing', 'furnishing-move', 'furnishing-rotate', 'furnishing-store', 'furnishing-retrieve', 'settlement-undo', 'claim-settlement-project'].includes(action);
function currentItem(state, data) {
  const item = settlementItems(state).find(value => value.id === data.itemId);
  if (!item) fail('Choose a furnishing that is still here.');
  if (!Number.isSafeInteger(data.revision) || data.revision !== item.revision) fail('That furnishing changed. Inspect it again.');
  if (item.status !== 'ready') fail('Wait for the shuttle to finish this delivery.');
  if (state.settlement.deliveries.some(delivery => delivery.itemId === item.id)) fail('Let the shuttle depart before rearranging this furnishing.');
  return item;
}
function recordEdit(state, actor, before, after, stockDelta = 0, materialDelta = 0) {
  const settlement = state.settlement;
  settlement.revision++;
  settlement.undo = { actorId: actor.id, revision: settlement.revision, before: before ? structuredClone(before) : null, afterId: after?.id || null, kind: (before || after).kind, stockDelta, materialDelta };
}
/** Runtime authenticates and transactionally stores accepted actions. @param {any} state @param {any} actor @param {any} data @returns {{message:string,targetId?:string}} */
export function settlementAction(state, actor, action, data = {}) {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim()) fail('Join the expedition before arranging its settlement.', 403);
  if (!colonyPlanetById(state?.template)) fail('Furnishing kits are for Morrow, Nacre and Aurelia expeditions.');
  if (!settlementAvailable(state) || actor.regionId && actor.regionId !== 'home') fail('Return to the home district to arrange the settlement.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Use a valid furnishing command.', 400);
  const previewState = { ...state, players: actor.players || state.players || [] };
  if (action === 'build-furnishing' || action === 'furnishing-retrieve') {
    const dir = data.dir ?? 0, variant = data.variant ?? 'ivory', spec = settlementDefinition(data.kind);
    if (!spec || !spec.variants.includes(variant)) fail('Choose an available furnishing and colour.', 400);
    const error = settlementPlacementError(previewState, data.kind, data.x, data.y, dir); if (error) fail(error);
    if ((state.settlement?.deliveries || []).length >= SETTLEMENT.queueLimit) fail('The shuttle has four deliveries queued. Let one finish first.');
    const stock = settlementStored(state, data.kind), cost = stock > 0 ? 0 : spec.cost;
    if (action === 'furnishing-retrieve' && stock < 1) fail('There is no stored copy of this furnishing.');
    const settlement = init(state), item = { id: `furnishing-${state.nextId++}`, kind: spec.id, x: data.x, y: data.y, dir, variant, status: 'delivery', revision: 0, owner: actor.id };
    if (stock > 0) settlement.stored[spec.id] = stock - 1;
    state.materials -= cost;
    settlement.items.push(item);
    settlement.deliveries.push({ id: `delivery-${item.id}`, itemId: item.id, elapsed: 0, duration: SETTLEMENT.deliverySeconds, assembled: false });
    recordEdit(state, actor, null, item, stock > 0 ? -1 : 0, -cost);
    return { message: `${spec.name} reserved. MYCORRHIZAL is sending a construction parcel.`, targetId: item.id };
  }
  if (action === 'furnishing-move' || action === 'furnishing-rotate') {
    const item = currentItem(state, data), before = structuredClone(item);
    const dir = action === 'furnishing-rotate' ? (item.dir + 1) % 4 : data.dir ?? item.dir;
    const x = action === 'furnishing-rotate' ? item.x : data.x, y = action === 'furnishing-rotate' ? item.y : data.y;
    const error = settlementPlacementError(previewState, item.kind, x, y, dir, item.id); if (error) fail(error);
    Object.assign(item, { x, y, dir, revision: item.revision + 1 }); recordEdit(state, actor, before, item);
    return { message: 'Furnishing rearranged.', targetId: item.id };
  }
  if (action === 'furnishing-store') {
    const item = currentItem(state, data), before = structuredClone(item), settlement = state.settlement;
    // A departing delivery still owns its flight record, so finish that brief
    // departure before moving the destination out of the scene.
    if (settlement.deliveries.some(delivery => delivery.itemId === item.id)) fail('Let the shuttle depart before storing this furnishing.');
    settlement.items = settlement.items.filter(value => value.id !== item.id);
    settlement.stored[item.kind] = (settlement.stored[item.kind] || 0) + 1;
    recordEdit(state, actor, before, null, 1);
    return { message: 'Furnishing safely stored. Place it again for no material cost.', targetId: item.id };
  }
  if (action === 'settlement-undo') {
    const settlement = state.settlement, undo = settlement?.undo;
    if (!undo || undo.actorId !== actor.id || undo.revision !== settlement.revision || data.revision !== settlement.revision) fail('There is no unchanged edit of yours to undo.');
    if (undo.before) {
      const previous = undo.before;
      // The old site was conditioned a moment ago and may have lost a level since; an undo restores, it never builds new.
      const error = settlementPlacementError(previewState, previous.kind, previous.x, previous.y, previous.dir, undo.afterId, { ignoreCost: true, ignoreGround: true });
      if (error) fail(`Cannot restore that placement: ${error}`);
    }
    if ((settlement.stored[undo.kind] || 0) - undo.stockDelta < 0 || state.materials - undo.materialDelta < 0) fail('Those materials or stored pieces are no longer available.');
    settlement.items = settlement.items.filter(item => item.id !== undo.afterId);
    settlement.deliveries = settlement.deliveries.filter(delivery => delivery.itemId !== undo.afterId);
    if (undo.before) settlement.items.push({ ...structuredClone(undo.before), revision: undo.before.revision + 2 });
    settlement.stored[undo.kind] = (settlement.stored[undo.kind] || 0) - undo.stockDelta;
    state.materials -= undo.materialDelta;
    settlement.revision++; settlement.undo = null;
    return { message: 'Your last furnishing edit was undone.', targetId: undo.before?.id || undo.afterId };
  }
  if (action === 'claim-settlement-project') {
    const project = settlementProjectStatus(state).find(value => value.id === data.projectId);
    if (!project) fail('Choose an available settlement project.', 400);
    if (project.claimed) fail('This project reward has already arrived.');
    if (!project.ready) fail('Finish the displayed project steps first.');
    const settlement = init(state); settlement.completed.push(project.id); state.materials += project.reward;
    settlement.revision++; settlement.undo = null;
    return { message: `${project.name} complete. ${project.reward} materials added for your next idea.`, targetId: project.id };
  }
  fail('Choose an available settlement action.', 400);
}
/** Advances only active room time; serialize this state to resume a flight. @param {any} state */
export function tickSettlement(state, dt) {
  if (!state.settlement || !Number.isFinite(dt) || dt <= 0) return;
  const settlement = state.settlement;
  let remaining = dt;
  while (remaining > 1e-8 && settlement.deliveries.length) {
    const delivery = settlement.deliveries[0], work = Math.min(remaining, delivery.duration - delivery.elapsed);
    delivery.elapsed += work; remaining -= work;
    const item = settlement.items.find(value => value.id === delivery.itemId);
    if (!delivery.assembled && delivery.elapsed >= SETTLEMENT.assemblySeconds - 1e-8) {
      delivery.assembled = true;
      if (item) { item.status = 'ready'; item.revision++; }
      settlement.revision++; settlement.undo = null;
    }
    if (delivery.elapsed >= delivery.duration - 1e-8) settlement.deliveries.shift();
    else break;
  }
}
