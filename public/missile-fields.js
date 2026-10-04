export const MISSILE_FIRE_DURATION = 18, MISSILE_GAS_CAPACITY = 18;

// One reservation and one gas charge pool per volley, never twelve clouds.
export function makeBarrageField(barrage, now) {
  /** @type {Array<{x:number,y:number,radius:number,at:number,remaining:number}>} */
  const sectors = [];
  return { id: barrage.id, weapon: barrage.weapon, x: barrage.box.x + barrage.box.width / 2,
    y: barrage.box.y + barrage.box.height / 2, box: { ...barrage.box }, sectors, pending: barrage.missiles.length, at: now,
    remaining: 0, duration: MISSILE_FIRE_DURATION,
    capacity: barrage.weapon === 'GAS' ? (barrage.gasCapacity??MISSILE_GAS_CAPACITY) : 0, initialCapacity: barrage.gasCapacity??MISSILE_GAS_CAPACITY };
}
export function landBarrageSector(field, missile, now) {
  field.pending = Math.max(0, field.pending - 1);
  // An exhausted gas volley keeps its reservation, but cannot refill on impact.
  if (field.weapon === 'GAS' && field.capacity <= 0) return;
  field.sectors.push({ x: missile.x, y: missile.y, radius: missile.craterSize * .45, at: now, remaining: MISSILE_FIRE_DURATION });
  if (field.weapon === 'INCENDIARY') field.remaining = MISSILE_FIRE_DURATION;
}
export function tickField(field, dt) {
  if (field.weapon !== 'INCENDIARY') return false;
  if (!field.sectors) { field.remaining = Math.max(0, field.remaining - dt); return field.remaining === 0; }
  for (const s of field.sectors) s.remaining = Math.max(0, s.remaining - dt);
  const before = field.sectors.length;
  field.sectors = field.sectors.filter(s => s.remaining > 0);
  field.remaining = Math.max(0, ...field.sectors.map(s => s.remaining));
  return before !== field.sectors.length;
}
export const keepField = f => (f.pending || 0) > 0 || (f.weapon === 'INCENDIARY' ? f.remaining > 0 : f.capacity > 0);
