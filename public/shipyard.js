import { SHIP, shipSite, shipKind, dockComplete, canSail, hull, rectanglesOverlap } from './ship.js';

export const SHIPYARD = Object.freeze({ max: 8, perOwner: 4, buildTime: 12, wrecks: 24 });
// Old saves and isolated domain fixtures still carry their dock on the hull.
export function dockRecords(world) {
  const yards = world.logistics?.shipyards || [];
  return [...yards, ...(world.ships || []).filter(s => !yards.some(y => y.id === (s.yardId || s.id)))];
}
export function yardFromShip(s) {
  return { id: s.yardId || s.id, owner: s.owner, dock: { ...s.dock }, dockStyle: s.dockStyle,
    berthX: s.berthX, berthY: s.berthY, angle: s.dock.angle, siteX: s.siteX, siteY: s.siteY,
    elapsed: s.dockReady ? SHIP.duration : s.elapsed, dockReady: dockComplete(s), dockDestroyed: !!s.dockDestroyed };
}
export function linkYard(ship, yard) {
  Object.assign(ship, { yardId: yard.id, dock: yard.dock, dockStyle: yard.dockStyle,
    berthX: yard.berthX, berthY: yard.berthY, siteX: yard.siteX, siteY: yard.siteY,
    dockReady: dockComplete(yard), dockDestroyed: !!yard.dockDestroyed });
}
export function syncShipyards(world) {
  for (const ship of world.ships || []) {
    const yard = world.logistics?.shipyards?.find(y => y.id === (ship.yardId || ship.id));
    if (yard) linkYard(ship, yard);
  }
}
export function shipyardSite(world, buildings, occupants, x, y, owner) {
  const yards = dockRecords(world);
  if (yards.length >= SHIPYARD.max || yards.filter(y => y.owner === owner).length >= SHIPYARD.perOwner)
    return { error: 'Shipyard limit: four per scout, eight per campaign.', ship: null };
  return shipSite(world, buildings, occupants, x, y, owner, 'gunship', 'unfolding', null, true);
}
export function yardBuildError(world, yard, owner, kind, previous = null, people = []) {
  if (!yard || yard.owner !== owner) return 'Choose your own shipyard.';
  if (!['gunship', 'submarine', 'transport'].includes(kind)) return 'Choose a supported vessel.';
  if (yard.dockDestroyed) return 'Repair this shipyard in Logistics (L) first.';
  if (!dockComplete(yard) || world.logistics?.jobs?.[yard.id]) return 'Wait for the shipyard to finish assembly or repairs.';
  if ((world.ships || []).some(s => s.id !== previous?.id && (s.yardId || s.id) === yard.id)) return 'This shipyard already supports a vessel. Retire it before changing type.';
  if ((world.ships || []).some(s => s.id !== previous?.id && s.owner === owner && shipKind(s) === kind)) return 'One vessel of each type per scout. Manage or replace the existing vessel.';
  if (!previous && world.ships.length >= SHIP.max) return 'Fleet limit: four vessels per campaign.';
  if (previous && (!previous.destroyed || previous.replacement > .001)) return 'Wait for the lost vessel replacement countdown.';
  const next = { ...yard, id: previous?.id || 'preview', x: yard.berthX, y: yard.berthY, angle: yard.dock.angle };
  if (!canSail(world, next, next.x, next.y, next.angle, true)) return 'Clear the shipyard water berth.';
  if (people.some(p => p.body !== 'aircraft' && p.life !== 'disabled' && (p.hp === undefined || p.hp > 0) && rectanglesOverlap(hull(next, true), { x: p.x, y: p.y, w: .8, h: .8, angle: 0 }))) return 'A unit blocks the shipyard berth.';
  return null;
}
export function rememberWreck(world, ship) {
  if (!ship.destroyed || ship.wreckRecorded) return false;
  const wrecks = world.logistics.wrecks ||= [];
  wrecks.push({ id: ship.id + ':' + (ship.hurt || 0), kind: shipKind(ship), x: ship.x, y: ship.y, angle: ship.angle });
  if (wrecks.length > SHIPYARD.wrecks) wrecks.splice(0, wrecks.length - SHIPYARD.wrecks);
  ship.wreckRecorded = true;
  return true;
}
