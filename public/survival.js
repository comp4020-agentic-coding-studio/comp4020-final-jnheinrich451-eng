import { canStand } from './world.js';
import { CORE, coreExit } from './core.js';

export const SURVIVAL = Object.freeze({ health: 100, damage: 25, aggro: 6, reach: 1.15, strikeRadius: .85, windup: 650, cooldown: 1400, recovery: 3, arrival: 1.8, shield: 2, radius: 6 });
export const freshLife = () => ({ health: SURVIVAL.health, life: 'active', recovery: 0, shield: 0, reviveCore: null, hurt: 0, lostVehicle: null });
export function lifeRecord(p) {
  return Object.fromEntries(Object.keys(freshLife()).map(key => [key, p[key]]));
}
export function hurtRobot(p, amount) {
  if (p.life !== 'active' || p.shield > 0 || p.health <= 0) return false;
  p.health = Math.max(0, p.health - amount); p.hurt++; p.lifeDirty = true;
  if (!p.health) { p.life = 'disabled'; p.recovery = SURVIVAL.recovery; p.inputUntil = 0; p.path = []; p.vx = 0; p.vy = 0; }
  return true;
}
function clearRecoveryPoint(world, buildings, core, point, occupants, playerId) {
  return core && core.elapsed >= CORE.duration && Math.hypot(point.x - core.x - 1.5, point.y - core.y - 1.5) <= SURVIVAL.radius
    && canStand(world, buildings, point.x, point.y)
    && !occupants.some(o => o.id !== playerId && o.life !== 'disabled' && (o.hp === undefined || o.hp > 0) && Math.hypot(o.x - point.x, o.y - point.y) < 1.5);
}
export function recoveryPoint(world, buildings, core, occupants, playerId) {
  if (!core || core.elapsed < CORE.duration) return null;
  const center = { x: core.x + 1.5, y: core.y + 1.5 }, exit = coreExit(core), choices = [];
  for (let y = Math.floor(center.y - SURVIVAL.radius); y <= center.y + SURVIVAL.radius; y++) {
    for (let x = Math.floor(center.x - SURVIVAL.radius); x <= center.x + SURVIVAL.radius; x++) {
      const p = { x: x + .5, y: y + .5 };
      if (!clearRecoveryPoint(world, buildings, core, p, occupants, playerId)) continue;
      choices.push(p);
    }
  }
  choices.sort((a, b) => Math.hypot(a.x - exit.x, a.y - exit.y) - Math.hypot(b.x - exit.x, b.y - exit.y));
  return choices[0] || null;
}
export function beginRecovery(p, world, buildings, occupants, coreId) {
  // Retried requests cannot relocate or duplicate an incoming replacement.
  if (p.life === 'arriving' && p.reviveCore === coreId) return null;
  if (p.life !== 'disabled') return 'Your robot is already active or arriving.';
  if (p.recovery > .001) return 'Replacement is still preparing.';
  const core = world.cores?.find(c => c.id === coreId);
  if (!core || core.elapsed < CORE.duration) return 'Choose a completed friendly core.';
  const point = recoveryPoint(world, buildings, core, occupants, p.id);
  if (!point) return 'No clear landing point near this core. Choose another core or wait for space.';
  Object.assign(p, point, { lostVehicle:null, life: 'arriving', recovery: SURVIVAL.arrival, reviveCore: core.id, inputUntil: 0, path: [], vx: 0, vy: 0, dirty: true, lifeDirty: true });
  return null;
}
export function tickLife(p, dt, world, buildings, occupants) {
  let changed = false;
  if (p.shield > 0) { p.shield = Math.max(0, p.shield - dt); changed = true; }
  if (p.recovery > 0) { p.recovery = Math.max(0, p.recovery - dt); changed = true; }
  if (p.life === 'arriving' && p.recovery <= .001) {
    const core = world.cores?.find(c => c.id === p.reviveCore);
    if (clearRecoveryPoint(world, buildings, core, p, occupants, p.id)) Object.assign(p, { health: SURVIVAL.health, life: 'active', shield: SURVIVAL.shield, recovery: 0, angle: Math.PI / 2, aim: Math.PI / 2, turret: Math.PI / 2, dirty: true });
    else { p.life = 'disabled'; p.recovery = 0; }
    changed = true;
  }
  if (changed) p.lifeDirty = true;
  return changed;
}
