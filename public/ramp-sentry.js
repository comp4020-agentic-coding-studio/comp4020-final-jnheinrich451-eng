import { operational } from './vehicle.js';
import { surfaced } from './submarine-depth.js';
import { turnTurret, angleDelta, SENTRY_TURRET } from './turret.js';
import { raycast } from './raycast.js';
import { canDamageEnemy } from './enemy-profiles.js';

export const RAMP_SENTRY = Object.freeze({ range: 10, reload: .3 });
export const newRampGun = ship => ({ id: ship.id, owner: ship.owner, angle: ship.angle, remaining: 0, destroyed: false });
// Saved on the hull: folding never resets damage, bearing or the reload timer.
export function rampSentryStep(world, ship, enemies, buildings, dt, shoot) {
  const gun = ship.rampGun ||= newRampGun(ship);
  let changed = gun.remaining > 0;
  gun.remaining = Math.max(0, gun.remaining - dt);
  if (!ship.ramp || !operational(ship) || !surfaced(ship) || gun.destroyed) return changed;
  const point = ship.ramp;
  const target = enemies.filter(e => e.hp > 0 && canDamageEnemy(e, 'APCR') && Math.hypot(e.x-point.x,e.y-point.y) < RAMP_SENTRY.range)
    .sort((a,b) => Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))
    .find(e => { const d=Math.hypot(e.x-point.x,e.y-point.y);return !raycast(world,buildings,point,(e.x-point.x)/(d||1),(e.y-point.y)/(d||1),Math.max(0,d-.4)).blocked; });
  if (!target) return changed;
  const aim = Math.atan2(target.y-point.y,target.x-point.x)+Math.PI/2;
  gun.angle = turnTurret(gun.angle,aim,dt,SENTRY_TURRET.speed);
  if (!gun.remaining && Math.abs(angleDelta(gun.angle,aim)) <= SENTRY_TURRET.tolerance) {
    if (!shoot({ id:'ramp:'+ship.id, ...point, turret:gun.angle, mount:'sentry' },target.x,target.y,'APCR',buildings)) gun.remaining = RAMP_SENTRY.reload;
  }
  return true;
}
