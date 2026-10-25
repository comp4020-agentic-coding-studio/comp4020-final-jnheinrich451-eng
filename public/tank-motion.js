import { angleDelta, turnTurret } from './turret.js';

// Tiles and seconds. W/S drives along the hull; A/D turns its nose.
export const TANK_DRIVE = Object.freeze({ speed: 3, reverse: 1.6, acceleration: 3,
  braking: 6, turnSpeed: Math.PI * .8, turnSlowdown: 1.15, step: .025, maxDt: .15 });

export const driveTank=(body,input,seconds,clear,profile=TANK_DRIVE)=>driveGround(body,input,seconds,clear,profile,false);
// Path followers provide world-space directions, never manual steering commands.
export const driveGroundRoute=(body,input,seconds,clear,profile=TANK_DRIVE)=>driveGround(body,input,seconds,clear,profile,true);
function driveGround(body, input, seconds, clear, profile, worldDirection) {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const dt = Math.min(seconds, profile.maxDt), steps = Math.ceil(dt / profile.step), step = dt / steps;
  const before = { x: body.x, y: body.y, angle: body.angle, speed: body.driveSpeed || 0 };
  const length = Math.hypot(input.x, input.y), demand = Math.min(1, worldDirection ? length : Math.abs(input.y));
  if (!length && !before.speed) { body.vx = 0; body.vy = 0; return false; }
  const desired = length ? Math.atan2(input.x, -input.y) : body.angle;
  // Choose once per update so a reversing turn does not flip gears mid-step.
  const reverse = worldDirection ? length > 0 && Math.abs(angleDelta(body.angle, desired)) > Math.PI * 2 / 3 : input.y > 0;
  const heading = desired + (reverse ? Math.PI : 0);
  let speed = before.speed;
  for (let i = 0; i < steps; i++) {
    const turnRate=profile.turnSpeed / (1 + Math.abs(speed) / profile.speed * profile.turnSlowdown);
    if(worldDirection){if(length)body.angle=turnTurret(body.angle,heading,step,turnRate);}
    else {const angle=body.angle+Math.max(-1,Math.min(1,input.x))*turnRate*step;body.angle=Math.atan2(Math.sin(angle),Math.cos(angle));}
    const alignment = worldDirection ? Math.max(0, Math.cos(angleDelta(body.angle, heading))) : 1;
    let target = demand * alignment * (reverse ? -profile.reverse : profile.speed);
    // Brake through zero before changing travel direction.
    if (speed * target < 0) target = 0;
    const rate = Math.abs(target) < Math.abs(speed) ? profile.braking : profile.acceleration;
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
