// World-space angles: zero faces north. Hull rotation never contributes.
export const TURRET_SPEED = Math.PI; // 180 degrees per simulation second.
export const SENTRY_TURRET = Object.freeze({ speed: Math.PI * 1.5, tolerance: Math.PI / 90, restAngle: Math.PI / 5 });
export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
export function turnTurret(current, target, seconds, speed = TURRET_SPEED) {
  const limit = Math.max(0, speed) * Math.max(0, seconds);
  const delta = angleDelta(current, target);
  const next = current + Math.max(-limit, Math.min(limit, delta));
  return Math.atan2(Math.sin(next), Math.cos(next));
}
