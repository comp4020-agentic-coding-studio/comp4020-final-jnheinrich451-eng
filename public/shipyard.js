import { operational, hullHealth, VEHICLE, SHIP_REPAIR_DELAY } from './vehicle.js';
import { SHIP, shipSite, shipKind, dockComplete, canSail, hull, rectanglesOverlap, dockRects, hullCells, mooredDock } from './ship.js';

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
  if (world.ships.filter(s=>!s.destroyed&&s.id!==previous?.id).length >= SHIP.max) return 'Fleet limit: four vessels per campaign.';
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

export const DOCK_REPAIR = Object.freeze({ rate: 10, perHp: .2, delay: SHIP_REPAIR_DELAY });
export function tickDockRepair(world, ship, dt) {
  const oldDelay=ship.repairDelay||0,wasRepairing=!!ship.repairing;
  ship.repairDelay=Math.max(0,oldDelay-dt);ship.repairing=false;
  if(!operational(ship)||ship.assemblyRemaining>0||ship.repairDelay>0||Math.abs(ship.speed||0)>.05||hullHealth(ship)>=VEHICLE.ship)return wasRepairing||oldDelay>0;
  const dock=mooredDock(world,ship),yard=dockRecords(world).find(y=>y.dock===dock);
  if(!yard||world.logistics?.jobs?.[yard.id])return wasRepairing||oldDelay>0;
  const restored=Math.min(VEHICLE.ship-hullHealth(ship),DOCK_REPAIR.rate*dt,world.logistics.supplies/DOCK_REPAIR.perHp);
  if(!(restored>0))return wasRepairing||oldDelay>0;
  ship.health=Math.min(VEHICLE.ship,hullHealth(ship)+restored);
  world.logistics.supplies=Math.max(0,world.logistics.supplies-restored*DOCK_REPAIR.perHp);
  ship.repairing=true;ship.repairTime=(ship.repairTime||0)+dt;
  return true;
}
export function nearbyShipyard(world, person) {
  if(!person||person.body!=='robot'||person.life==='disabled')return null;
  const choices=dockRecords(world).filter(y=>y.owner===person.id&&dockComplete(y)).map(y=>{
    const points=[y.dock,...dockRects(y).flatMap(hullCells).map(p=>({x:p.x+.5,y:p.y+.5}))];
    const point=points.sort((a,b)=>Math.hypot(a.x-person.x,a.y-person.y)-Math.hypot(b.x-person.x,b.y-person.y))[0];
    return {yard:y,...point,distance:Math.hypot(point.x-person.x,point.y-person.y)};
  }).filter(p=>p.distance<=1.4).sort((a,b)=>a.distance-b.distance);
  return choices[0]||null;
}

// Assignment reserves production; a visiting friendly vessel may still use the berth.
export function dockBoardingShip(world,yard) {
  if(!yard)return null;
  return (world.ships||[]).filter(s=>operational(s)&&mooredDock(world,s)===yard.dock)
    .sort((a,b)=>Number(!!a.occupant)-Number(!!b.occupant))[0]||null;
}
