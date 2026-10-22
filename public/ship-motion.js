// Lightweight helm dynamics in tiles/second. No world scale is assumed for knots.
export const THROTTLES = Object.freeze(['Reverse', 'Stop', '1/4', '1/2', '3/4', 'Full']);
export const throttleLabel = value => THROTTLES[(value || 0) + 1] || 'Stop';
export const throttleDemand = value => value < 0 ? -1 : value / 4;
export const shipStopped = ship => Math.abs(ship.speed || 0) <= .05 && Math.abs(ship.turnRate || 0) <= .015 && !(ship.throttle || 0);
export function stopShip(ship) {
  const changed = !!(ship.speed || ship.driveSpeed || ship.rudder || ship.turnRate || ship.throttle);
  Object.assign(ship, { speed:0, driveSpeed:0, rudder:0, turnRate:0, throttle:0 });
  return changed;
}
const approach = (value, target, amount) => value + Math.max(-amount, Math.min(amount, target - value));
export function driveShip(ship, steer, demand, seconds, profile, clear) {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const dt = Math.min(seconds, .15), steps = Math.ceil(dt / .025), step = dt / steps;
  const before = [ship.x, ship.y, ship.angle, ship.driveSpeed || 0, ship.rudder || 0, ship.turnRate || 0];
  const heavy = ship.kind === 'carrier';
  const acceleration = heavy ? .3 : .65, braking = heavy ? .6 : 1.1, rudderRate = heavy ? .8 : 1.5;
  let speed = ship.driveSpeed || 0, rudder = ship.rudder || 0, travelled = 0;
  for (let i = 0; i < steps; i++) {
    rudder = approach(rudder, Math.max(-1, Math.min(1, steer)), rudderRate * step);
    let target = demand * (demand < 0 ? profile.reverse : profile.speed);
    if (speed * target < 0) target = 0; // Brake through zero before reversing.
    speed = approach(speed, target, (Math.abs(target) < Math.abs(speed) ? braking : acceleration) * step);
    // Harbour assistance permits slow pivoting; full-speed turns are broader.
    const turn = rudder * profile.turnSpeed * (.45 + .55 * Math.min(1, Math.abs(speed) / (profile.speed * .35))) / (1 + .6 * Math.abs(speed) / profile.speed);
    const angle = ship.angle + turn * step;
    ship.turnRate = 0;
    if (turn && clear(ship.x, ship.y, angle)) { ship.angle = Math.atan2(Math.sin(angle), Math.cos(angle)); ship.turnRate = turn; }
    const x = ship.x + Math.sin(ship.angle) * speed * step, y = ship.y - Math.cos(ship.angle) * speed * step;
    if (speed) {
      if (clear(x, y, ship.angle)) { travelled += Math.hypot(x - ship.x, y - ship.y); ship.x = x; ship.y = y; }
      else { speed = 0; break; }
    }
  }
  ship.driveSpeed = speed; ship.rudder = rudder; ship.speed = travelled / dt;
  return [ship.x, ship.y, ship.angle, speed, rudder, ship.turnRate].some((n, i) => n !== before[i]);
}
