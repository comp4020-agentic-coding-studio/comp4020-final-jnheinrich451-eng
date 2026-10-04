import { FLAME, LASER, loadout } from './weapons.js';
import { turnTurret, angleDelta } from './turret.js';
import { raycast } from './raycast.js';

export const GUARD = Object.freeze({ searchInterval: .5, flameEnter: 4.5, tolerance: Math.PI / 90 });
export function guardStep(robot, state, enemies, world, buildings, dt) {
  if (!robot.guarding || robot.life !== 'active' || robot.health <= 0 || robot.deploying) { state.targetId = null; state.weapon = null; state.search = 0; return null; }
  const distance = e => Math.hypot(e.x - robot.x, e.y - robot.y);
  const visible = e => {
    const d = distance(e);
    return e.hp > 0 && d <= LASER.range && d > .2 && raycast(world, buildings, robot, (e.x - robot.x) / d, (e.y - robot.y) / d, d + .01, enemies).enemy?.id === e.id;
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
  state.weapon = d <= (same && state.weapon === 'LASER' ? GUARD.flameEnter : FLAME.range) ? 'FLAME' : 'LASER';
  state.targetId = target.id;
  robot.aim = Math.atan2(target.y - robot.y, target.x - robot.x) + Math.PI / 2;
  robot.turret = turnTurret(robot.turret, robot.aim, dt, loadout('robot').turnSpeed);
  if (robot.angle !== robot.turret) { robot.angle = robot.turret; robot.dirty = true; }
  if (Math.abs(angleDelta(robot.turret, robot.aim)) > GUARD.tolerance) return null;
  // Recheck the actual muzzle bearing, including a new blocker or nearer enemy.
  const hit = raycast(world, buildings, robot, Math.sin(robot.turret), -Math.cos(robot.turret), state.weapon === 'FLAME' ? FLAME.range : LASER.range, enemies);
  return hit.enemy?.id === target.id ? { target, weapon: state.weapon } : null;
}
