import { FLAME, LASER, loadout } from './weapons.js';
import { turnTurret, angleDelta } from './turret.js';
import { raycast } from './raycast.js';
import { canDamageEnemy } from './enemy-profiles.js';
import { isAirEnemy, isGroundEnemy } from './target-domain.js';
import { airRaycast } from './aa-vehicle.js';

export const GUARD = Object.freeze({ searchInterval: .5, flameEnter: 7, tolerance: Math.PI / 90 });
export function guardStep(robot, state, enemies, world, buildings, dt) {
  if (!robot.guarding || robot.life !== 'active' || robot.health <= 0 || robot.deploying) { state.targetId = null; state.weapon = null; state.search = 0; return null; }
  const distance = e => Math.hypot(e.x - robot.x, e.y - robot.y);
  const visible = e => {
    const d = distance(e);
    if(e.hp<=0||!canDamageEnemy(e,'LASER')||d>LASER.range||d<=.2)return false;
    const hit=isAirEnemy(e)?airRaycast(world,robot,(e.x-robot.x)/d,(e.y-robot.y)/d,d+.01,enemies):raycast(world,buildings,robot,(e.x-robot.x)/d,(e.y-robot.y)/d,d+.01,enemies.filter(isGroundEnemy));
    return hit.enemy?.id===e.id;
  };
  let target = enemies.find(e => e.id === state.targetId);
  if (target && !visible(target)) target = null;
  state.search = Math.max(0, (state.search || 0) - dt);
  if (!state.search) {
    const nearest = enemies.filter(e => e.hp > 0 && distance(e) <= LASER.range).sort((a, b) => distance(a) - distance(b)).find(visible);
    if (!target || (nearest && distance(nearest) <= FLAME.range && distance(target) > FLAME.range)) target = nearest;
    state.search = GUARD.searchInterval;
  }
  if (!target) { state.targetId = null; state.weapon = null; return null; }
  const d = distance(target), same = state.targetId === target.id;
  state.weapon = !isAirEnemy(target)&&d <= (same && state.weapon === 'LASER' ? GUARD.flameEnter : FLAME.range) ? 'FLAME' : 'LASER';
  state.targetId = target.id;
  robot.aim = Math.atan2(target.y - robot.y, target.x - robot.x) + Math.PI / 2;
  robot.turret = turnTurret(robot.turret, robot.aim, dt, loadout('robot').turnSpeed);
  if (robot.angle !== robot.turret) { robot.angle = robot.turret; robot.dirty = true; }
  if (Math.abs(angleDelta(robot.turret, robot.aim)) > GUARD.tolerance) return null;
  // Recheck the actual muzzle bearing, including a new blocker or nearer enemy.
  const hit = isAirEnemy(target)?airRaycast(world,robot,Math.sin(robot.turret),-Math.cos(robot.turret),LASER.range,enemies):raycast(world, buildings, robot, Math.sin(robot.turret), -Math.cos(robot.turret), state.weapon === 'FLAME' ? FLAME.range : LASER.range, enemies.filter(isGroundEnemy));
  return hit.enemy?.id === target.id ? { target, weapon: state.weapon } : null;
}
