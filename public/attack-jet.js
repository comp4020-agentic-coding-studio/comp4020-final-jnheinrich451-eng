// Forward ground attack: fixed accepted impacts, small HE bursts, finite ammunition.
export const JET = Object.freeze({ ammo: 90, range: 10, flight: .22, cooldown: 120,
  radius: .65, lethalRadius: .15, damage: 28, edgeDamage: 6, craterSize: .8, maxRounds: 16 });
export const isAttackJet = p => p?.kind === 'attack-jet';
export const aircraftName = p => p?.kind==='helicopter' ? 'Helicopter' : isAttackJet(p) ? 'Attack jet' : 'Bomber';
export const strafePoint = p => ({ x: p.x + Math.sin(p.angle) * JET.range, y: p.y - Math.cos(p.angle) * JET.range });
export function strafeError(world, p) {
  if (!isAttackJet(p)) return 'Board an attack jet to use the autocannon.';
  if (p.state !== 'flying') return 'Take off before firing the autocannon.';
  if (!(p.rounds > 0)) return 'Autocannon empty. Return to your airbase to rearm.';
  if (p.edgeTurn) return 'Finish the boundary turn before firing.';
  const point = strafePoint(p);
  if (point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) return 'Keep the impact inside the map.';
  return null;
}
