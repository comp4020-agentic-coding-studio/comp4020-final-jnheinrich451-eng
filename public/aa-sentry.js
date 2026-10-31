import { AA35 } from './weapons.js';
import { isAirEnemy } from './target-domain.js';
import { flightLineClear } from './terrain-rules.js';
import { angleDelta, turnTurret, SENTRY_TURRET } from './turret.js';

export const AA_SENTRY = Object.freeze({ range: AA35.range, search: .25,
  speed: SENTRY_TURRET.speed, tolerance: .06 });
export const isAASentry = building => building?.kind === 'aa-sentry';
export const aaSentryReady = (world, building) => isAASentry(building) && !building.destroyed &&
  !(building.health <= 0) && !world.logistics?.jobs?.[building.id] &&
  !(world.logistics?.durability?.['sentry:' + building.id]?.health <= 0);

const center = building => ({ x: building.x + .5, y: building.y + .5 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function visible(world, origin, enemy) {
  const range = distance(origin, enemy);
  return enemy.hp > 0 && isAirEnemy(enemy) && range >= .2 && range <= AA_SENTRY.range &&
    flightLineClear(world, origin, enemy, .15);
}

// Two fixed lead iterations. A ground target can never produce an aim solution,
// even if it occupies the cursor/last target position of an airborne contact.
export function aaSentryAim(world, building, enemy) {
  const origin = center(building);
  if (!aaSentryReady(world, building) || !enemy || !visible(world, origin, enemy)) return null;
  let time = distance(origin, enemy) / AA35.speed, x = enemy.x, y = enemy.y;
  for (let i = 0; i < 2; i++) {
    x = enemy.x + (enemy.vx || 0) * time; y = enemy.y + (enemy.vy || 0) * time;
    time = Math.min(.65, Math.hypot(x - origin.x, y - origin.y) / AA35.speed);
  }
  if (x < 0 || y < 0 || x >= world.width || y >= world.height ||
    !flightLineClear(world, origin, { x, y }, .15)) { x = enemy.x; y = enemy.y; }
  return { x, y, targetId: enemy.id, domain: 'air' };
}

// The caller persists this small mount record. Only bounded air sensing and
// traverse happen here; firing and shared projectile admission remain in combat.
export function aaSentryStep(world, building, mount, enemies, dt) {
  mount.search = Math.max(0, (mount.search || 0) - dt);
  if (!aaSentryReady(world, building)) { mount.targetId = null; mount.aim = mount.angle; return null; }
  const origin = center(building);
  let target = enemies.find(enemy => enemy.id === mount.targetId && visible(world, origin, enemy));
  if (!target && !mount.search) {
    let range = Infinity;
    for (const enemy of enemies) {
      const next = distance(origin, enemy);
      if (next < range && visible(world, origin, enemy)) { target = enemy; range = next; }
    }
    mount.search = AA_SENTRY.search;
  }
  mount.targetId = target?.id ?? null;
  const solution = target && aaSentryAim(world, building, target);
  mount.aim = solution ? Math.atan2(solution.x - origin.x, origin.y - solution.y) : mount.angle;
  mount.angle = turnTurret(mount.angle, mount.aim, dt, AA_SENTRY.speed);
  return solution && Math.abs(angleDelta(mount.angle, mount.aim)) <= AA_SENTRY.tolerance ? solution : null;
}
