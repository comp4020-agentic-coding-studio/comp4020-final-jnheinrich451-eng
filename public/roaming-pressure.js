import { airRecords } from './air-traffic.js';
import { islandAt } from './island-pressure.js';
import { canStand, tileAt } from './world.js';

export const ROAMING = Object.freeze({ candidates: 16, minRadius: 22, maxRadius: 26,
  ringRadius: 5, maxHunters: 2, contactClearance: 12, recoveryClearance: 10, hostileClearance: 24 });
const position = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const alive = p => p && !p.destroyed && !(p.hp <= 0) && !(p.health <= 0);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rectangleDistance = (p, x, y, width, height = width) =>
  Math.hypot(Math.max(x - p.x, 0, p.x - x - width), Math.max(y - p.y, 0, p.y - y - height));

function context(world, focus, source) {
  if (!position(focus) || focus.ground === false || focus.medium && focus.medium !== 'ground') return null;
  // A caller cannot manufacture a source, revive a conquered ruin or transfer
  // population from a different island. Resolve the current authoritative site.
  const site = source?.id && (world.sites || []).find(s => s.id === source.id);
  if (!site || site.state !== 'hostile' || !(site.hp > 0) || site.kind === 'aquatic-hive') return null;
  const island = islandAt(world, focus.x, focus.y);
  if (!island || islandAt(world, site.x + 1.5, site.y + 1.5) !== island) return null;
  if ((world.sites || []).some(s => s.state === 'hostile' && s.hp > 0 &&
    rectangleDistance(focus, s.x, s.y, 3) < ROAMING.hostileClearance)) return null;
  return { island, site };
}

function corridorClear(world, buildings, point, focus, blocked) {
  const length = distance(point, focus);
  // Never let malformed saved orders turn this local test into a world scan.
  if (length > ROAMING.maxRadius + ROAMING.ringRadius + 1) return false;
  const steps = Math.max(1, Math.ceil(length / .75));
  const focusTank = (world.tanks || []).find(t => alive(t) && t.occupant && distance(t, focus) < 1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, x = point.x + (focus.x - point.x) * t, y = point.y + (focus.y - point.y) * t;
    // The last two tiles may lead into the occupied tank being investigated.
    // Keep all terrain, fire and other machinery checks, including at its center.
    const ignoreTank = focusTank && length * (1 - t) <= 2 ? focusTank.id : null;
    if (blocked(Math.floor(x), Math.floor(y)) || !canStand(world, buildings, x, y, ignoreTank)) return false;
  }
  return true;
}

function pointClear(world, buildings, contacts, enemies, point, focus, island, blocked) {
  if (!position(point) || islandAt(world, point.x, point.y) !== island) return false;
  const terrain = world.terrain[Math.floor(point.y) * world.width + Math.floor(point.x)];
  if (![1, 2].includes(terrain) || ![1, 2].includes(tileAt(world, point.x, point.y)) ||
    blocked(Math.floor(point.x), Math.floor(point.y)) || !canStand(world, buildings, point.x, point.y)) return false;
  // Contacts already contain physical occupied-vehicle positions. Airborne
  // teammates still reserve their arrival clearance; they never become focus.
  if (contacts.some(p => position(p) && distance(p, point) < ROAMING.contactClearance)) return false;
  if (enemies.some(e => e.hp > 0 && distance(e, point) < 1.5)) return false;
  if ((world.cores || []).some(c => alive(c) && rectangleDistance(point, c.x, c.y, 3) < ROAMING.recoveryClearance)) return false;
  if ((world.logistics?.facilities || []).some(f => alive(f) && rectangleDistance(point, f.x, f.y,
    ['factory', 'outpost'].includes(f.kind) ? 2 : 3) < (f.kind === 'outpost' ? ROAMING.recoveryClearance : 4))) return false;
  if (buildings.some(b => alive(b) && rectangleDistance(point, b.x, b.y, 1) < 4)) return false;
  const vehicles = [...(world.tanks || []), ...(world.ships || []), ...(world.logistics?.recyclers || []),
    ...(world.artillery || []), ...airRecords(world).map(b => b.aircraft).filter(p => p && !['vacant', 'destroyed'].includes(p.state))];
  if (vehicles.some(v => alive(v) && position(v) && distance(v, point) < 4)) return false;
  return corridorClear(world, buildings, point, focus, blocked);
}

// Reuse after the warning, with fresh contacts, enemies and hazard callback.
// The focus stays the saved location: no live player lookup or hidden following.
export function roamingPointClear(world, buildings, contacts, enemies, point, focus, source, blocked = () => false) {
  const current = context(world, focus, source);
  return !!current && pointClear(world, buildings, contacts, enemies, point, focus, current.island, blocked);
}

export function planRoaming(world, buildings, contacts, enemies, focus, source, angle, blocked = () => false) {
  if (!Number.isFinite(angle)) return null;
  const current = context(world, focus, source);
  if (!current) return null;
  for (let candidate = 0; candidate < ROAMING.candidates; candidate++) {
    const heading = angle + candidate * Math.PI / 8;
    const radius = ROAMING.minRadius + candidate % 3 * (ROAMING.maxRadius - ROAMING.minRadius) / 2;
    const origin = { x: focus.x + Math.cos(heading) * radius, y: focus.y + Math.sin(heading) * radius }, points = [];
    // Exactly the existing conquest arrival ring, so its later revalidation
    // finds these points without introducing another spawn representation.
    for (let i = 0; i < 16 && points.length < ROAMING.maxHunters; i++) {
      const a = i * Math.PI / 8;
      const point = { x: Math.floor(origin.x + Math.cos(a) * ROAMING.ringRadius) + .5,
        y: Math.floor(origin.y + Math.sin(a) * ROAMING.ringRadius) + .5, kind: 'hunter', siteId: current.site.id };
      if (points.some(p => distance(p, point) < 1.5) || !pointClear(world, buildings, contacts, enemies, point, focus, current.island, blocked)) continue;
      points.push(point);
    }
    if (points.length) return { origin, points, focus: { x: focus.x, y: focus.y } };
  }
  return null;
}
