import { findPath } from './world.js';
import { ARTILLERY_SHELLS } from './weapons.js';
import { enemyProfile } from './enemy-profiles.js';
import { isAirEnemy } from './target-domain.js';

export const FIELD_LIMIT = 12, TYPE_LIMIT = 9, ENEMY_RADIUS = .38;
// Fuel pools: where a fuel packet ends on land without hitting an enemy it leaves a
// small burning pool (author, 9 November 2026). One per tile (a new packet renews it),
// at most 12 per shooter and 48 in the world, separate from the artillery field caps.
// Hunters and Breakers that touch one burn and flee as from the laser; Bulwarks slow.
export const FUEL_POOL = Object.freeze({ radius: .45, duration: 4000, perOwner: 12, max: 48 });
export function placePool(pools, pool) {
  const same = pools.find(p => Math.floor(p.x) === Math.floor(pool.x) && Math.floor(p.y) === Math.floor(pool.y));
  if (same) { Object.assign(same, { until: pool.until, owner: pool.owner, heavy: same.heavy || pool.heavy }); return pools; }
  let next = [...pools, pool];
  const oldest = list => list.reduce((a, b) => (b.at < a.at ? b : a));
  const mine = next.filter(p => p.owner === pool.owner);
  if (mine.length > FUEL_POOL.perOwner) { const drop = oldest(mine); next = next.filter(p => p !== drop); }
  if (next.length > FUEL_POOL.max) { const drop = oldest(next); next = next.filter(p => p !== drop); }
  return next;
}
export const poolContact = (pools, enemy, now) => enemy.hp <= 0 || isAirEnemy(enemy) ? null
  : pools.find(p => p.until > now && Math.hypot(p.x - enemy.x, p.y - enemy.y) <= FUEL_POOL.radius + ENEMY_RADIUS) || null;
// Gas wears down the units it does not kill on contact (Breakers, Bulwarks). A cloud
// spends one of its kills only when such a unit dies of the gas inside it.
export function gasExposure(fields, enemy) {
  if (enemy.hp <= 0 || isAirEnemy(enemy) || !enemyProfile(enemy).gasDps) return null;
  return fields.find(f => f.weapon === 'GAS' && f.capacity > 0 && insideField(f, enemy.x, enemy.y)) || null;
}
export const FIELD_AREA_LIMIT = 512, TYPE_AREA_LIMIT = 256;
export const rectangleDistance = (r, x, y) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.width), Math.max(r.y - y, 0, y - r.y - r.height));
export const activeSectors = field => (field.sectors || []).filter(s => field.weapon === 'INCENDIARY' ? s.remaining > 0 : field.capacity > 0);
export function insideField(field, x, y, margin = ENEMY_RADIUS) {
  if (!field.sectors) return Math.hypot(x - field.x, y - field.y) <= field.radius + margin;
  // Sector boundaries are exact for damage. Extra margin is only heat/avoidance.
  const padding = Math.max(0, margin - ENEMY_RADIUS);
  return rectangleDistance(field.box, x, y) <= padding && field.sectors.some(s => (field.weapon === 'INCENDIARY' ? s.remaining > 0 : field.capacity > 0) && Math.hypot(s.x - x, s.y - y) <= s.radius + padding);
}
// Bomber strips reserve the sum of all sector areas, conservatively counting
// overlap twice, without charging for empty corners of a diagonal bounding box.
export const fieldArea = f => f.reservedArea ?? (f.box ? f.box.width * f.box.height : Math.PI * (f.radius ?? ARTILLERY_SHELLS[f.weapon].radius) ** 2);
export function fieldCapacityError(fields, salvos, weapon, area = Math.PI * (ARTILLERY_SHELLS[weapon]?.radius || 0) ** 2) {
  if (weapon === 'HE') return null;
  const reserved = [...fields, ...salvos.filter(s => ['INCENDIARY','GAS'].includes(s.weapon))];
  if (reserved.length >= FIELD_LIMIT || reserved.filter(f => f.weapon === weapon).length >= TYPE_LIMIT) return 'Field limit reached (12 total, 9 of one type), including shells in flight. Let fire expire or gas be consumed.';
  if (reserved.reduce((sum, f) => sum + fieldArea(f), 0) + area > FIELD_AREA_LIMIT || reserved.filter(f => f.weapon === weapon).reduce((sum, f) => sum + fieldArea(f), 0) + area > TYPE_AREA_LIMIT) return 'Hazard area limit reached. Let fire expire or gas be consumed; HE remains available.';
  return null;
}
/** @returns {{id:number,weapon:string,x:number,y:number,radius:number,at:number,remaining?:number,duration?:number,capacity?:number,initialCapacity?:number}} */
export function makeField(id, weapon, x, y, now) {
  const p = ARTILLERY_SHELLS[weapon];
  return { id, weapon, x, y, radius: p.radius, at: now,
    ...(weapon === 'INCENDIARY' ? { remaining: p.duration, duration: p.duration } : { capacity: p.capacity, initialCapacity: p.capacity }) };
}
// Stable field order; fire takes priority and one death spends one cloud charge.
export function contactField(fields, enemy) {
  if (enemy.hp <= 0 || isAirEnemy(enemy) || enemyProfile(enemy).hazardImmune) return null;
  const fire = fields.find(f => f.weapon === 'INCENDIARY' && f.remaining > 0 && insideField(f, enemy.x, enemy.y));
  if (fire) return fire;
  if (enemyProfile(enemy).gasDps) return null;
  const gas = fields.find(f => f.weapon === 'GAS' && f.capacity > 0 && insideField(f, enemy.x, enemy.y));
  if (gas) gas.capacity--;
  return gas || null;
}
export const fireBlocked = fields => (x, y) => fields.some(f => f.weapon === 'INCENDIARY' && f.remaining > 0 && insideField(f, x, y, ENEMY_RADIUS + .72));
export function heatSpeed(fields, enemy, pools = [], now = 0) {
  if (isAirEnemy(enemy)) return 1;
  const slow = enemyProfile(enemy).fireSlow;
  if (slow) return fields.some(f => f.weapon === 'INCENDIARY' && f.remaining > 0 && insideField(f, enemy.x, enemy.y, ENEMY_RADIUS + ARTILLERY_SHELLS.INCENDIARY.heatBand)) || poolContact(pools, enemy, now) ? slow : 1;
  if (enemyProfile(enemy).hazardImmune) return 1;
  return fields.some(f => f.weapon === 'INCENDIARY' && f.remaining > 0 && insideField(f, enemy.x, enemy.y, ENEMY_RADIUS + ARTILLERY_SHELLS.INCENDIARY.heatBand)) ? ARTILLERY_SHELLS.INCENDIARY.slow : 1;
}
export function lureRoute(world, buildings, enemy, fields, blocked, route = findPath) {
  if (isAirEnemy(enemy) || enemyProfile(enemy).hazardImmune) return null;
  const clouds = fields.filter(f => f.weapon === 'GAS' && f.capacity > 0).flatMap(f => {
    if (!f.sectors) return [{ id: f.id, x: f.x, y: f.y }];
    return activeSectors(f).map(s => {
      const dx = enemy.x - s.x, dy = enemy.y - s.y, distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(distance, Math.max(0, s.radius - 1));
      // A tile center safely inside the circle, not a waypoint on its boundary.
      const x = Math.max(Math.ceil(f.box.x + .15 - .5) + .5, Math.min(Math.floor(f.box.x + f.box.width - .15 - .5) + .5, Math.floor(s.x + dx / distance * reach) + .5));
      const y = Math.max(Math.ceil(f.box.y + .15 - .5) + .5, Math.min(Math.floor(f.box.y + f.box.height - .15 - .5) + .5, Math.floor(s.y + dy / distance * reach) + .5));
      return { id: f.id, x, y };
    });
  }).filter(p => Math.hypot(p.x - enemy.x, p.y - enemy.y) <= ARTILLERY_SHELLS.GAS.lureRange)
    .sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y) || a.id - b.id);
  for (const cloud of clouds) {
    const path = route(world, buildings, enemy, cloud, blocked);
    if (path) return { id: cloud.id, path };
  }
  return null;
}
