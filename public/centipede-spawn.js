import { newGroundEnemy } from './enemy-profiles.js';
import { CENTIPEDE, initializeCentipedeBody, isCentipede } from './centipede.js';
import { islandAt } from './island-pressure.js';
import { canStand } from './world.js';

export const CENTIPEDE_SPAWN = Object.freeze({ first: 60000, replacement: 180000,
  warning: 10000, broodWarning: 2000, broodInterval: 20000, broodCap: 4,
  globalCap: 2, islandCap: 1, activeRange: 36, pulse: 1000, retry: 5000 });
const broodRoster = Object.freeze(['hunter', 'breaker', 'hunter', 'bulwark', 'twin-lens', 'hunter', 'heavy-lens']);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const living = e => e.hp > 0;
const lens = e => ['twin-lens', 'heavy-lens'].includes(e.kind);
const rootAlive = root => root?.kind === 'modifier' && root.state === 'hostile' && root.hp > 0;
const rootCenter = root => ({ x: root.x + 1.5, y: root.y + 1.5 });
const bodyPoints = e => [{ x: e.x, y: e.y }, ...(Array.isArray(e.body) ? e.body.slice(0, 8) : [])];
const bodyDistance = (e, point) => Math.min(...bodyPoints(e).map(p => distance(p, point)));

// These records participate in every other producer's capacity check. A warning
// reserves one slot per future entity, never one slot per decorative body part.
export function centipedeReservations(director) {
  return (director?.centipedes?.pending || []).flatMap(p => p.points.map(point =>
    ({ ...point, pressureIsland: p.pressureIsland, motherId: p.motherId, rootId: p.rootId })));
}
export function centipedeSpawnView(director) {
  return { warnings: structuredClone(director?.centipedes?.pending || []) };
}

function positionClear(world, buildings, contacts, enemies, pending, point, blocked, radius = .25) {
  return canStand(world, buildings, point.x, point.y, null, radius) && !blocked(point.x, point.y) &&
    contacts.every(p => distance(p, point) >= 4) &&
    enemies.every(e => !living(e) || bodyDistance(e, point) >= 1.1) &&
    pending.every(p => distance(p, point) >= 1.1);
}

function giantPlan(world, buildings, contacts, enemies, pending, root, blocked) {
  const center = rootCenter(root), island = islandAt(world, center.x, center.y);
  // Twenty short, cardinal corridors only. No world scan and no appearance
  // through a wall: all sampled head-to-tail points must fit actual terrain.
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) for (const offset of [0, 2, -2, 4, -4]) {
    const head = { x: center.x + dx * 9 - dy * offset, y: center.y + dy * 9 + dx * offset };
    const trail = Array.from({ length: Math.ceil(CENTIPEDE.length / .25) + 1 }, (_, i) => {
      const step = Math.min(CENTIPEDE.length, i * .25);
      return { x: head.x - dx * step, y: head.y - dy * step };
    });
    if (trail.every(p => islandAt(world, p.x, p.y) === island &&
      positionClear(world, buildings, contacts, enemies, pending, p, blocked, CENTIPEDE.radius))) {
      return { points: [{ ...head, kind: 'centipede' }], trail, angle: Math.atan2(dx, -dy) };
    }
  }
  return null;
}
function broodPlan(world, buildings, contacts, enemies, pending, mother, kinds, blocked) {
  const points = [], island = mother.pressureIsland || islandAt(world, mother.x, mother.y);
  // Hatch beside the body. The warning records these fixed cells even if the
  // mother moves away during incubation; resolution rechecks every cell.
  const body = bodyPoints(mother), origin = body[Math.floor(body.length / 2)] || mother;
  for (let i = 0; i < 16 && points.length < kinds.length; i++) {
    const angle = i * Math.PI / 4, radius = i < 8 ? 2.5 : 4;
    const point = { x: Math.floor(origin.x + Math.cos(angle) * radius) + .5,
      y: Math.floor(origin.y + Math.sin(angle) * radius) + .5, kind: kinds[points.length] };
    if (islandAt(world, point.x, point.y) !== island ||
      !positionClear(world, buildings, contacts, enemies, pending.concat(points), point, blocked)) continue;
    points.push(point);
  }
  return points;
}

// All clocks are saved simulation time. The caller supplies the existing island
// admission function and capacity including centipedeReservations(director).
/** @param {any} options */
export function tickCentipedeSpawns({ world, buildings, contacts, enemies, sleeping = [], director, now, dt,
  conquered = false, capacity, admit, nextId, events = [], blocked = () => false, reservations = null }) {
  if (!director) return false;
  const state = director.centipedes ||= { version: 1, roots: {}, cooldowns: {}, pending: [], serial: 0, cursor: 0, nextPulse: 0 };
  state.cooldowns ||= {};
  const all = () => enemies.concat(sleeping).filter(living);
  const pending = () => reservations ? reservations() : (world.sites || []).flatMap(s => s.pending?.points || []).concat(centipedeReservations(director));
  const source = id => (world.sites || []).find(s => s.id === id);
  const rootIsland = root => islandAt(world, root.x + 1.5, root.y + 1.5);
  const active = (island, point) => director.pressure?.islands?.[island]?.active > 0 && contacts.some(p =>
    p.medium !== 'sea' && islandAt(world, p.x, p.y) === island && distance(p, point) <= CENTIPEDE_SPAWN.activeRange);
  const giantCount = island => all().filter(e => isCentipede(e) && (!island ||
    (e.pressureIsland || islandAt(world, e.x, e.y)) === island)).length +
    state.pending.filter(p => p.kind === 'centipede' && (!island || p.pressureIsland === island)).length;
  const childCount = id => all().filter(e => e.broodMotherId === id).length +
    state.pending.filter(p => p.kind === 'brood' && p.motherId === id).reduce((n, p) => n + p.points.length, 0);
  const event = (name, p, extra = {}) => events.push({ event: name, kind: 'system', sourceId: p.rootId,
    targetId: p.motherId, cause: p.kind, count: p.points.length, ...extra });
  let changed = false;

  for (const mother of all().filter(isCentipede)) {
    if (conquered || !rootAlive(source(mother.rootId || mother.siteId))) {
      if (!mother.broodDisabled) { mother.broodDisabled = true; changed = true; }
    }
  }
  // Release each due reservation once before rechecking admission. Do not count
  // its own slot twice, and never turn an invalid warning into another location.
  for (const p of [...state.pending]) {
    const root = source(p.rootId), mother = p.kind === 'brood' && all().find(e => e.id === p.motherId && isCentipede(e));
    const validSource = !conquered && rootAlive(root) && (!mother && p.kind === 'centipede' || mother && !mother.broodDisabled);
    if (validSource && active(p.pressureIsland, p.kind === 'brood' ? mother : rootCenter(root)) && now < p.at) continue;
    state.pending.splice(state.pending.indexOf(p), 1); changed = true;
    if (!validSource || !active(p.pressureIsland, p.kind === 'brood' ? mother : rootCenter(root))) { event('centipede.arrival.cancelled', p); continue; }
    let born = 0;
    for (const point of p.points) {
      // Admission and island credit were paid at warning time. A change in the
      // producer turn must not randomly revoke this already reserved slot.
      if (capacity() <= 0) continue;
      if (p.kind === 'centipede' && (giantCount() >= CENTIPEDE_SPAWN.globalCap || giantCount(p.pressureIsland) >= CENTIPEDE_SPAWN.islandCap)) continue;
      if (p.kind === 'brood' && childCount(p.motherId) >= CENTIPEDE_SPAWN.broodCap) continue;
      if (lens(point) && all().filter(lens).length + pending().filter(lens).length >= 4) continue;
      const space = p.kind === 'centipede' ? p.trail : [point];
      if (!space?.length || !space.every(q => islandAt(world, q.x, q.y) === p.pressureIsland &&
        positionClear(world, buildings, contacts, all(), pending(), q, blocked, p.kind === 'centipede' ? CENTIPEDE.radius : .25))) continue;
      const enemy = { ...newGroundEnemy(point.kind, nextId(), point), siteId: p.rootId, rootId: p.rootId,
        pressureIsland: p.pressureIsland, pressureKind: 'brood', emergedAt: now,
        homeX: point.x, homeY: point.y, rally: { x: point.x, y: point.y }, behavior: 'guarding' };
      if (p.kind === 'centipede') {
        enemy.angle = p.angle; enemy.nextBrood = now + CENTIPEDE_SPAWN.broodInterval; enemy.broodWave = 0;
        initializeCentipedeBody(enemy, p.trail, (x, y) => canStand(world, buildings, x, y, null, CENTIPEDE.radius));
        state.roots[p.rootId].giantId = enemy.id;
      } else enemy.broodMotherId = p.motherId;
      enemies.push(enemy); born++;
    }
    event(born ? 'centipede.arrival' : 'centipede.arrival.cancelled', p, { count: born });
  }
  if (conquered) return changed;

  const elapsed = Math.max(0, Number.isFinite(dt) ? dt * 1000 : 0);
  const roots = (world.sites || []).filter(rootAlive);
  for (const [id, record] of Object.entries(state.roots)) {
    if (record.giantId != null && !all().some(e => e.id === record.giantId && isCentipede(e))) {
      record.giantId = null; record.cooldown = CENTIPEDE_SPAWN.replacement; record.activeMs = CENTIPEDE_SPAWN.first; changed = true;
      const island = record.island || (source(id) && rootIsland(source(id)));
      if (island) state.cooldowns[island] = CENTIPEDE_SPAWN.replacement;
    }
  }
  for (const [island, remaining] of Object.entries(state.cooldowns)) if (director.pressure?.islands?.[island]?.active > 0) {
    state.cooldowns[island] = Math.max(0, remaining - elapsed);
  }
  for (const root of roots) {
    const record = state.roots[root.id] ||= { activeMs: 0, cooldown: 0, giantId: null, retryAt: 0, island: rootIsland(root) };
    if (active(rootIsland(root), rootCenter(root))) {
      record.activeMs = Math.min(CENTIPEDE_SPAWN.first, record.activeMs + elapsed);
      record.cooldown = Math.max(0, record.cooldown - elapsed);
    }
  }
  // Keep a mother that was inactive from collecting a queue of missed broods.
  for (const mother of all().filter(isCentipede)) if (!active(mother.pressureIsland || islandAt(world, mother.x, mother.y), mother)) {
    mother.nextBrood = now + CENTIPEDE_SPAWN.broodInterval;
  }
  if (now < state.nextPulse) return changed;
  state.nextPulse = now + CENTIPEDE_SPAWN.pulse;

  if (roots.length) for (let i = 0; i < roots.length; i++) {
    const root = roots[(state.cursor + i) % roots.length], record = state.roots[root.id], island = rootIsland(root), center = rootCenter(root);
    if (record.giantId != null || record.cooldown > 0 || state.cooldowns[island] > 0 || record.activeMs < CENTIPEDE_SPAWN.first || now < record.retryAt ||
      state.pending.some(p => p.rootId === root.id && p.kind === 'centipede') || !active(island, center) ||
      giantCount() >= CENTIPEDE_SPAWN.globalCap || giantCount(island) >= CENTIPEDE_SPAWN.islandCap) continue;
    const credit = director.pressure.islands[island];
    if (credit.credit < 1 || capacity() < 1 || admit({ ...center, pressureIsland: island }, 'city') < 1) continue;
    const plan = giantPlan(world, buildings, contacts, all(), pending(), root, blocked);
    record.retryAt = now + CENTIPEDE_SPAWN.retry;
    if (!plan) continue;
    const warning = { id: 'centipede-arrival-' + ++state.serial, kind: 'centipede', rootId: root.id,
      pressureIsland: island, ...plan, x: plan.points[0].x, y: plan.points[0].y,
      at: now + CENTIPEDE_SPAWN.warning, windup: CENTIPEDE_SPAWN.warning };
    state.pending.push(warning); credit.credit = Math.max(0, credit.credit - 1);
    event('centipede.warning', warning); state.cursor = (state.cursor + i + 1) % roots.length; changed = true; break;
  }
  for (const mother of enemies.filter(e => living(e) && isCentipede(e))) {
    const root = source(mother.rootId || mother.siteId), island = mother.pressureIsland || islandAt(world, mother.x, mother.y);
    if (mother.broodDisabled || !rootAlive(root) || !active(island, mother) || now < (mother.nextBrood ?? now + CENTIPEDE_SPAWN.broodInterval) ||
      state.pending.some(p => p.motherId === mother.id)) continue;
    // Exactly one bounded batch attempt per interval, even after a large tick.
    mother.nextBrood = now + CENTIPEDE_SPAWN.broodInterval;
    const credit = director.pressure.islands[island];
    const allowance = Math.min(2, CENTIPEDE_SPAWN.broodCap - childCount(mother.id), Math.floor(credit.credit), capacity(),
      admit({ x: mother.x, y: mother.y, pressureIsland: island }, 'city'));
    if (allowance <= 0) continue;
    const kinds = ['hunter', broodRoster[(mother.broodWave || 0) % broodRoster.length]].slice(0, allowance);
    if (all().filter(lens).length + pending().filter(lens).length >= 4) for (let i = 0; i < kinds.length; i++) if (lens({ kind: kinds[i] })) kinds[i] = 'hunter';
    const points = broodPlan(world, buildings, contacts, all(), pending(), mother, kinds, blocked);
    if (!points.length) continue;
    const warning = { id: 'centipede-arrival-' + ++state.serial, kind: 'brood', rootId: root.id, motherId: mother.id,
      pressureIsland: island, x: mother.x, y: mother.y, points, at: now + CENTIPEDE_SPAWN.broodWarning, windup: CENTIPEDE_SPAWN.broodWarning };
    state.pending.push(warning); credit.credit = Math.max(0, credit.credit - points.length);
    mother.broodWave = (mother.broodWave || 0) + 1;
    event('centipede.warning', warning); changed = true;
  }
  return changed;
}
