import { angleDelta, turnTurret } from './turret.js';

// Tiles and seconds. World-direction controls, with slower automatic reversing.
export const TANK_DRIVE = Object.freeze({ speed: 3, reverse: 1.6, acceleration: 3,
  braking: 6, turnSpeed: Math.PI * .8, turnSlowdown: 1.15, step: .025, maxDt: .15 });

export function driveTank(body, input, seconds, clear) {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const dt = Math.min(seconds, TANK_DRIVE.maxDt), steps = Math.ceil(dt / TANK_DRIVE.step), step = dt / steps;
  const before = { x: body.x, y: body.y, angle: body.angle, speed: body.driveSpeed || 0 };
  const length = Math.hypot(input.x, input.y), demand = Math.min(1, length);
  if (!length && !before.speed) { body.vx = 0; body.vy = 0; return false; }
  const desired = length ? Math.atan2(input.x, -input.y) : body.angle;
  // Choose once per update so a reversing turn does not flip gears mid-step.
  const reverse = length > 0 && Math.abs(angleDelta(body.angle, desired)) > Math.PI * 2 / 3;
  const heading = desired + (reverse ? Math.PI : 0);
  let speed = before.speed;
  for (let i = 0; i < steps; i++) {
    if (length) body.angle = turnTurret(body.angle, heading, step,
      TANK_DRIVE.turnSpeed / (1 + Math.abs(speed) / TANK_DRIVE.speed * TANK_DRIVE.turnSlowdown));
    const alignment = Math.max(0, Math.cos(angleDelta(body.angle, heading)));
    let target = demand * alignment * (reverse ? -TANK_DRIVE.reverse : TANK_DRIVE.speed);
    // Brake through zero before changing travel direction.
    if (speed * target < 0) target = 0;
    const rate = Math.abs(target) < Math.abs(speed) ? TANK_DRIVE.braking : TANK_DRIVE.acceleration;
    speed += Math.max(-rate * step, Math.min(rate * step, target - speed));
    const x = body.x + Math.sin(body.angle) * speed * step;
    const y = body.y - Math.cos(body.angle) * speed * step;
    if (x !== body.x || y !== body.y) {
      if (clear(x, y)) { body.x = x; body.y = y; }
      else { speed = 0; break; }
    }
  }
  body.driveSpeed = speed;
  body.vx = (body.x - before.x) / dt; body.vy = (body.y - before.y) / dt;
  return body.x !== before.x || body.y !== before.y || body.angle !== before.angle || speed !== before.speed;
}
