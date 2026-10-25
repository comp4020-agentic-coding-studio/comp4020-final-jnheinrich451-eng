// Unlimited ammunition; bounded server cadence and accepted ground impacts.
export const JET = Object.freeze({ ammo: 90, range: 10, flight: .22, cooldown: 120,
  radius: .65, lethalRadius: .15, damage: 28, edgeDamage: 6, craterSize: .8, maxRounds: 16 });
export const JET_GUN = Object.freeze({range:10,flight:.04,cooldown:150,count:3,radius:.4,lethalRadius:.12,damage:8,edgeDamage:2,craterSize:.55});
export function jetBurstPoints(p){const a=strafePoint(p);return [-1,0,1].map(i=>({x:a.x+Math.cos(p.angle)*i*.22+Math.sin(p.angle)*i*.32,y:a.y+Math.sin(p.angle)*i*.22-Math.cos(p.angle)*i*.32}));}
export const isAttackJet = p => p?.kind === 'attack-jet';
export const aircraftName = p => p?.kind==='air-gunship' ? 'Aerial gunship' : p?.kind==='helicopter' ? 'Helicopter' : isAttackJet(p) ? 'Attack jet' : 'Bomber';
export const strafePoint = p => ({ x: p.x + Math.sin(p.angle) * JET.range, y: p.y - Math.cos(p.angle) * JET.range });
export function strafeError(world, p) {
  if (!isAttackJet(p)) return 'Board an attack jet to use the autocannon.';
  if (p.state !== 'flying') return 'Take off before firing the autocannon.';
  if (p.edgeTurn) return 'Finish the boundary turn before firing.';
  const point = strafePoint(p);
  if (point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) return 'Keep the impact inside the map.';
  return null;
}
