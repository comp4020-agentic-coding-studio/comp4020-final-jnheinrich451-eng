// Robot life pace: a worker may sit on a seat, charge at a post or brew at a kettle.
// Resting is a per-person state held by the colony runtime, never part of the
// colony save, and it grants nothing: it is a reason to linger, not a chore.
import { settlementCells, settlementItems } from './colony-settlement.js';
import { STRUGGLE, fishArticle, fishGenome, simulateStruggle, validStruggle } from './colony-fish.js';

export const REST = Object.freeze({
  reach: 1.6,
  kinds: Object.freeze({ bench: 'sit', 'parking-seat': 'sit', 'charging-post': 'charge', kettle: 'brew' }),
});
export const REST_LABELS = Object.freeze({ sit: 'Sit', charge: 'Charge', brew: 'Brew', fish: 'Fish' });
export const FISHING = Object.freeze({
  // stock: how many fish the warehouse keeps for the companion; a catch beyond it is released.
  reach: 1.6, biteMin: 4, biteMax: 9, window: 3, journal: 60, stock: 99, records: 200,
  // The first stage's four species. New catches are alien combinations from colony-fish.js;
  // these names remain so older journals still read correctly.
  species: Object.freeze([
    Object.freeze({ id: 'silverfin', name: 'Silverfin', weight: 10, min: 14, max: 32 }),
    Object.freeze({ id: 'pebble-carp', name: 'Pebble carp', weight: 6, min: 20, max: 48 }),
    Object.freeze({ id: 'moonscale', name: 'Moonscale', weight: 3, min: 18, max: 40 }),
    Object.freeze({ id: 'lantern-eel', name: 'Lantern eel', weight: 1, min: 40, max: 90 }),
  ]),
});
// A small deterministic hash so bites and catches replay identically on a restart and in tests.
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = (seed, salt) => (hash(`${seed}:${salt}`) % 10007) / 10007;
const water = (world, x, y) => x >= 0 && y >= 0 && x < world.width && y < world.height && world.terrain[y * world.width + x] === 0;
/** The nearest water tile or pond cell within reach, as a cast point, or null. @param {any} state */
export function nearestWater(state, x, y, reach = FISHING.reach) {
  if (![x, y].every(Number.isFinite) || !state?.world?.terrain) return null;
  let best = null, bestDistance = Infinity;
  const consider = (cx, cy) => { const d = Math.max(Math.abs(cx + .5 - x), Math.abs(cy + .5 - y)); if (d <= reach && d < bestDistance) { best = { x: cx + .5, y: cy + .5 }; bestDistance = d; } };
  for (let ty = Math.floor(y - reach); ty <= Math.floor(y + reach); ty++) for (let tx = Math.floor(x - reach); tx <= Math.floor(x + reach); tx++) if (water(state.world, tx, ty)) consider(tx, ty);
  for (const item of settlementItems(state, { readyOnly: true })) if (item.kind === 'pond') for (const cell of settlementCells(item)) consider(cell.x, cell.y);
  return best;
}
const fishingInit = state => state.fishing ||= { casts: 0, catches: [], treats: 0, record: {} };
function cast(state, person, spot) {
  const fishing = fishingInit(state), time = state.time || 0;
  fishing.casts++;
  const wait = FISHING.biteMin + unit(person.id, `wait:${fishing.casts}`) * (FISHING.biteMax - FISHING.biteMin);
  person.activity = { kind: 'fish', itemId: null, since: time, from: person.activity?.from || { x: person.x, y: person.y, angle: person.angle || 0 }, spot: { x: spot.x, y: spot.y }, biteAt: time + wait, bite: false, biteUntil: 0, cast: fishing.casts };
  person.angle = Math.atan2(spot.y - person.y, spot.x - person.x) + Math.PI / 2;
}
function pick(seed) {
  const total = FISHING.species.reduce((sum, s) => sum + s.weight, 0);
  let roll = unit(seed, 'species') * total;
  for (const species of FISHING.species) { roll -= species.weight; if (roll <= 0) return species; }
  return FISHING.species[0];
}
/** Bites arrive and expire on active room time; a missed bite recasts. @param {any} state @param {any} person */
export function tickActivity(state, person, dt) {
  const activity = person?.activity;
  if (!activity || activity.kind !== 'fish' || !Number.isFinite(dt) || dt <= 0) return;
  const time = state.time || 0;
  if (activity.fight) { if (time > activity.fight.since + STRUGGLE.limit + 5) cast(state, person, activity.spot); return; }
  // A bite that would already have expired (a long frozen gap) counts as missed, so a resumed room never shows a stale bite.
  if (!activity.bite && time > activity.biteAt + FISHING.window) cast(state, person, activity.spot);
  else if (!activity.bite && time >= activity.biteAt) { activity.bite = true; activity.biteUntil = time + FISHING.window; }
  else if (activity.bite && time > activity.biteUntil) cast(state, person, activity.spot);
}
export const fishingSummary = state => ({ catches: state?.fishing?.catches?.length || 0, treats: state?.fishing?.treats || 0, record: state?.fishing?.record || {} });
/** The display name of a journal entry, old species ids included. @param {any} entry */
export const catchName = entry => entry?.name || FISHING.species.find(s => s.id === entry?.species)?.name || entry?.species || 'Fish';
/** The seed of the fish a cast hooks: the angler and the expedition's cast count. @param {any} person */
const fishSeed = person => `${person.id}:${person.activity.cast}`;
const MESSAGES = Object.freeze({ sit: 'Taking a seat.', charge: 'Charging. Move to unplug.', brew: 'Brewing a cup.' });
const reject = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

/** The activity a ready furnishing offers, or null. @param {any} item */
export const restKind = item => item && item.status === 'ready' ? REST.kinds[item.kind] || null : null;
/** @param {any} state */
export const restItems = state => settlementItems(state, { readyOnly: true }).filter(item => REST.kinds[item.kind]);
const bounds = item => {
  const cells = settlementCells(item);
  return { minX: Math.min(...cells.map(c => c.x)), maxX: Math.max(...cells.map(c => c.x)), minY: Math.min(...cells.map(c => c.y)), maxY: Math.max(...cells.map(c => c.y)) };
};
// A bench faces away from its backrest, which turns with the bench (dir 0 faces south).
const BENCH_FACING = Object.freeze([Math.PI, Math.PI * 1.5, 0, Math.PI / 2]);
/** Where the worker rests: on a seat facing out from its backrest, or one tile in front of a post or kettle facing north. @param {any} item */
export function restSpot(item) {
  const { minX, maxX, minY, maxY } = bounds(item), cx = (minX + maxX + 1) / 2;
  if (REST.kinds[item.kind] === 'sit') return { x: cx, y: (minY + maxY + 1) / 2, angle: item.kind === 'bench' ? BENCH_FACING[item.dir || 0] ?? Math.PI : Math.PI };
  return { x: cx, y: maxY + 1.5, angle: 0 };
}
const distance = (item, x, y) => Math.min(...settlementCells(item).map(c => Math.max(Math.abs(c.x + .5 - x), Math.abs(c.y + .5 - y))));
/** The closest usable furnishing within reach of a point, or null. @param {any} state @param {number} x @param {number} y @param {number} [reach] */
export function nearestRest(state, x, y, reach = REST.reach) {
  if (![x, y].every(Number.isFinite)) return null;
  let best = null, bestDistance = Infinity;
  for (const item of restItems(state)) {
    const d = distance(item, x, y);
    if (d <= reach && d < bestDistance) { best = item; bestDistance = d; }
  }
  return best;
}
export const isRestAction = action => ['rest', 'stand', 'fish', 'reel', 'land'].includes(action);
/** What other players see: the activity without the private return position. @param {any} person */
export const activityView = person => person?.activity ? { kind: person.activity.kind, itemId: person.activity.itemId, since: person.activity.since, ...(person.activity.kind === 'fish' ? { spot: person.activity.spot, bite: !!person.activity.bite, fight: person.activity.fight ? { since: person.activity.fight.since, seed: person.activity.fight.seed } : null } : {}) } : null;

/** Rest or stand. Mutates the person only; the runtime commits it. `canStand(x, y)` is the
 * runtime's collision check for the home district.
 * @param {any} state @param {any} person @param {string} action @param {any} [data] @param {(x: number, y: number) => boolean} [canStand] */
export function restAction(state, person, action, data = {}, canStand = () => true) {
  if (!person || typeof person.id !== 'string' || !person.id.trim()) reject('Join the expedition before resting.', 403);
  if ((person.regionId || 'home') !== 'home') reject('Return to the home district to rest.');
  if (action === 'stand') {
    if (!person.activity) return { ok: true, message: 'Already standing.' };
    standUp(person, canStand);
    return { ok: true, message: 'Back to the garden.' };
  }
  if (action === 'fish') {
    if (![person.x, person.y].every(Number.isFinite)) reject('Walk to the water first.');
    const spot = nearestWater(state, person.x, person.y);
    if (!spot) reject('Walk to the lake shore or a pond to fish.');
    if (person.activity?.kind === 'fish') return { ok: true, message: 'Already fishing.' };
    cast(state, person, spot);
    return { ok: true, message: 'Line cast. Wait for a bite, then press E.' };
  }
  if (action === 'reel') {
    // E on a bite hooks the fish and starts the fight; the angler then holds to reel.
    const activity = person.activity;
    if (activity?.kind !== 'fish') reject('Cast a line first.');
    if (activity.fight) return { ok: true, message: 'Hold to reel and keep the fish in the ring.', fight: activity.fight };
    if (!activity.bite) reject('Nothing on the line yet.');
    activity.bite = false; activity.fight = { since: state.time || 0, seed: fishSeed(person) };
    return { ok: true, message: 'Hooked! Hold to reel and keep the fish in the ring.', fight: activity.fight };
  }
  if (action === 'land') {
    // The server replays the angler's recorded holds through the same fight the browser
    // played. A recording longer than the room's own clock allows is a lost fish.
    const activity = person.activity, fight = activity?.fight;
    if (activity?.kind !== 'fish' || !fight) reject('No fish on the line.');
    if (!validStruggle(data.toggles, data.until)) reject('That reel was not recorded properly.', 400);
    const genome = fishGenome(fight.seed, state.template), fishing = fishingInit(state);
    const played = data.until <= (state.time || 0) - fight.since + STRUGGLE.grace ? simulateStruggle(fight.seed, genome.difficulty, data.toggles, data.until) : null;
    cast(state, person, activity.spot);
    if (played?.done !== 'landed') return { ok: true, landed: false, message: `The ${genome.name} slipped away. The line is back in the water.` };
    const fish = { species: genome.name, name: genome.name, seed: genome.seed, planet: genome.planet, length: genome.length, rarity: genome.rarity, at: state.time || 0, by: person.id };
    fishing.catches.push(fish);
    if (fishing.catches.length > FISHING.journal) fishing.catches.splice(0, fishing.catches.length - FISHING.journal);
    if (fishing.record[genome.name] !== undefined || Object.keys(fishing.record).length < FISHING.records) fishing.record[genome.name] = Math.max(fishing.record[genome.name] || 0, genome.length);
    const kept = fishing.treats < FISHING.stock;
    if (kept) fishing.treats++;
    return { ok: true, landed: true, kept, fish, message: kept ? `You caught ${fishArticle(genome.name)} ${genome.name}! Sent to the warehouse.` : `You caught ${fishArticle(genome.name)} ${genome.name}! The warehouse is full, so it swims free.` };
  }
  if (action !== 'rest') reject('Choose rest or stand.', 400);
  if (!data || typeof data.itemId !== 'string') reject('Choose a seat, charging post or kettle.', 400);
  const item = settlementItems(state).find(entry => entry.id === data.itemId), kind = restKind(item);
  if (!kind) reject('That furnishing is not ready to use.', 404);
  if (person.activity?.itemId === item.id) return { ok: true, message: MESSAGES[kind], targetId: item.id };
  if (![person.x, person.y].every(Number.isFinite) || distance(item, person.x, person.y) > REST.reach) reject('Walk up to it first.');
  const spot = restSpot(item);
  if (kind !== 'sit' && !canStand(spot.x, spot.y)) reject('Clear the space in front of it first.');
  const from = person.activity?.from || { x: person.x, y: person.y, angle: person.angle || 0 };
  person.activity = { kind, itemId: item.id, since: state.time || 0, from };
  person.x = spot.x; person.y = spot.y; person.angle = spot.angle;
  return { ok: true, message: MESSAGES[kind], targetId: item.id };
}

/** Ends an activity. The worker returns to where it came from when that is still clear,
 * otherwise to the nearest clear tile, so standing up from a solid seat never leaves a
 * worker inside it. @param {any} person @param {(x: number, y: number) => boolean} [canStand] */
export function standUp(person, canStand = () => true) {
  const activity = person.activity;
  if (!activity) return false;
  person.activity = null;
  const from = activity.from;
  if (from && [from.x, from.y].every(Number.isFinite) && canStand(from.x, from.y)) { person.x = from.x; person.y = from.y; person.angle = from.angle || 0; return true; }
  if (canStand(person.x, person.y)) return true;
  for (let radius = 1; radius <= 3; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
    const x = Math.floor(person.x) + dx + .5, y = Math.floor(person.y) + dy + .5;
    if (canStand(x, y)) { person.x = x; person.y = y; return true; }
  }
  return true;
}
/** True while the furnishing behind an activity still exists and is ready. @param {any} state @param {any} person */
export const restValid = (state, person) => !!person?.activity && (person.activity.kind === 'fish' || !!restKind(settlementItems(state).find(item => item.id === person.activity.itemId)));
