import { islandAt, islandContacts, islandMultiplier } from './island-pressure.js';

export const PRESSURE = Object.freeze({ cap: 24, creditCap: 2, refill: 2, refillMs: 12000,
  strengthRange: 36, scarceSlots: 3, turnMs: 2000,
  producers: Object.freeze(['raid', 'city', 'roaming', 'city', 'aquatic', 'city']) });

export function pressureContext(world, point) {
  return point.medium === 'sea' ? 'sea' : islandAt(world, point.x, point.y) || 'sea';
}
function physicalContacts(contacts) {
  const seen = new Set();
  return contacts.filter(p => {
    if (p.id == null || seen.has(p.id) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    seen.add(p.id); return true;
  }).map(p => p.medium === undefined ? { ...p, medium: 'ground' } : p);
}
function contexts(world, contacts) {
  const physical = physicalContacts(contacts), groups = islandContacts(world, physical);
  const sea = physical.filter(p => pressureContext(world, p) === 'sea');
  if (sea.length) groups.push({ id: 'sea', contacts: sea, multiplier: islandMultiplier(sea.length) });
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}
function localStrength(world, group) {
  if (group.id === 'sea') return 1;
  const nearby = (world.sites || []).filter(s => s.kind !== 'aquatic-hive' &&
    islandAt(world, s.x + 1.5, s.y + 1.5) === group.id &&
    group.contacts.some(p => Math.hypot(p.x - s.x - 1.5, p.y - s.y - 1.5) <= PRESSURE.strengthRange));
  return nearby.length ? nearby.filter(s => s.state === 'hostile' && !(s.hp <= 0)).length / nearby.length : 1;
}

// Only active simulation time advances pressure. No RNG is drawn here, and the
// shared credit cap prevents a pause or full enemy pool from building a backlog.
export function updatePressure(d, world, contacts, enemies, now, dt, reserved = 0) {
  if (d.pressure?.version !== 1) d.pressure = { version: 1, islands: {}, cursor: 0, turn: 0 };
  const pressure = d.pressure, groups = contexts(world, contacts), active = new Set(groups.map(g => g.id));
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) * 1000 : 0;
  const full = enemies.filter(e => e.hp > 0).length + Math.max(0, reserved) >= PRESSURE.cap;
  // The producer turn is an unscaled two-second clock, independent of how many
  // teammates share an island. It freezes when nobody is physically present.
  if (groups.length) {
    const total = pressure.turn + elapsed, turns = Math.floor(total / PRESSURE.turnMs);
    pressure.cursor = (pressure.cursor + turns) % PRESSURE.producers.length;
    pressure.turn = total % PRESSURE.turnMs;
  }
  for (const [id, state] of Object.entries(pressure.islands)) if (!active.has(id)) {
    state.active = 0; state.multiplier = 0; state.credit = 0; state.nextRoam = null;
  }
  for (const group of groups) {
    const state = pressure.islands[group.id] ||= { clock: 0, credit: PRESSURE.creditCap,
      nextRoam: null, focusCursor: 0, active: 0, multiplier: 0, strength: 1 };
    state.active = group.contacts.length; state.multiplier = group.multiplier; state.strength = localStrength(world, group);
    state.clock += elapsed * state.multiplier;
    // A cleared town has no city producer left. Its shared credit must still
    // refill for the much slower roaming arrivals from surviving distant sites.
    if (!full) state.credit = Math.min(PRESSURE.creditCap,
      state.credit + elapsed / PRESSURE.refillMs * PRESSURE.refill * state.multiplier * (state.strength || 1));
  }
  return pressure;
}

const recordContext = (world, point) => point.pressureIsland || pressureContext(world, point);

// Quotas restrict new admissions only. Existing enemies retain their position,
// health and assignments even when teammates move between geographic contexts.
export function pressureAllowance(d, world, contacts, enemies, pendingRecords, point, producer, globalFree) {
  const groups = contexts(world, contacts), id = recordContext(world, point), index = groups.findIndex(g => g.id === id);
  if (index < 0) return 0;
  const live = enemies.filter(e => e.hp > 0);
  const free = Math.max(0, Math.min(Math.floor(globalFree), PRESSURE.cap - live.length - pendingRecords.length));
  if (!Number.isFinite(free) || !free) return 0;
  const quota = Math.floor(PRESSURE.cap / groups.length) + (index < PRESSURE.cap % groups.length ? 1 : 0);
  const used = live.filter(e => recordContext(world, e) === id).length + pendingRecords.filter(p => recordContext(world, p) === id).length;
  const available = Math.max(0, Math.min(free, quota - used)), cursor = d.pressure?.cursor || 0;
  if (available <= PRESSURE.scarceSlots && PRESSURE.producers[cursor % PRESSURE.producers.length] !== producer) return 0;
  return available;
}
