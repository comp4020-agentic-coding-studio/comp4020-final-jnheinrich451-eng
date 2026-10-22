import { airSize, isHelipad } from './helicopter.js';
import { quote } from './logistics.js';
import { dockRecords, nearbyShipyard, yardBuildError } from './shipyard.js';
import { dockRects, hullCells, recallShipError } from './ship.js';
import { airfields, airRecords, parkedRecord, liveAircraft, deliveryError } from './air-traffic.js';

export const SERVICE_KINDS = { dock: ['gunship', 'submarine', 'transport', 'carrier'], airbase: ['bomber', 'attack-jet', 'helicopter'] };
export const serviceName = kind => ({gunship:'Coastal gunship',submarine:'Missile submarine',transport:'Armored transport',carrier:'Aircraft carrier',bomber:'Bomber',helicopter:'Helicopter','attack-jet':'Attack jet'})[kind];
export const serviceVersion = vehicle => vehicle ? vehicle.purchase?.id || vehicle.id : null;
// Only the net amount actually paid is carried into the next exchange. Missing
// legacy receipts, free craft and purchases in the other pool earn no credit.
export function serviceQuote(kind, previous) {
  const cost = quote(['bomber','attack-jet'].includes(kind) ? 'aircraft' : kind === 'gunship' ? 'ship' : kind, true);
  const receipt = previous?.purchase;
  const paid = !previous?.destroyed && previous?.state !== 'destroyed' && receipt?.pool === 'groundSupplies' && Number.isFinite(receipt.paid) ? Math.max(0, receipt.paid) : 0;
  const credit = Math.min(cost, Math.floor(paid * .8 + 1e-8));
  return { cost, credit, due: cost - credit, pool: 'groundSupplies' };
}
export function serviceState(world, type, id) {
  const facility = type === 'dock' ? dockRecords(world).find(y=>y.id===id) : airfields(world).find(b=>b.id===id);
  const record = type === 'dock' ? world.ships.find(s=>(s.yardId||s.id)===id) : parkedRecord(world,facility);
  return { facility, record, vehicle: type === 'dock' ? record : record?.aircraft };
}
export function serviceError(world, type, id, owner, kind, people=[]) {
  if (!SERVICE_KINDS[type]?.includes(kind)) return 'Choose a supported vehicle.';
  const {facility,vehicle} = serviceState(world,type,id);
  if (!facility || facility.owner !== owner) return 'Choose your own completed dock or airbase.';
  if (vehicle && vehicle.owner !== owner) return 'A teammate owns this vehicle.';
  if (type === 'airbase') return deliveryError(world,facility,kind);
  if (vehicle) {
    if (!vehicle.destroyed) {
    if (vehicle.assemblyRemaining > 0) return 'Wait for vehicle assembly to finish.';
    if (Math.abs(vehicle.speed||0) > .05) return 'Stop the vessel before exchanging it.';
    const error = recallShipError(world,vehicle,people,true); if (error) return error;
    } else if(vehicle.occupant || vehicle.cargo) return 'Clear the lost vessel crew and cargo before replacing it.';
    // A live aircraft may be stored on this record even when parked elsewhere.
    if (airRecords(world).some(b=>liveAircraft(b.aircraft)&&(b.id===vehicle.id||b.aircraft.baseId===vehicle.id))) return 'Recover or retire the carrier aircraft before exchanging its ship.';
  }
  return yardBuildError(world,facility,owner,kind,vehicle ? {...vehicle,destroyed:true} : null,people);
}
export function serviceDockAt(world, point) {
  return dockRecords(world).find(y=>dockRects(y).some(r=>hullCells(r).some(c=>c.x===Math.floor(point.x)&&c.y===Math.floor(point.y))));
}
export function nearbyService(world, person) {
  if (!person || person.body !== 'robot' || person.life !== 'active') return null;
  const yard=nearbyShipyard(world,person)?.yard;
  if(yard)return {type:'dock',id:yard.id};
  // Ruins and repairs must retain their local interaction panel.
  const base=(world.airbases||[]).find(b=>b.owner===person.id&&(!world.logistics.jobs[b.id]||world.logistics.jobs[b.id].kind==='repair')&&person.x>=b.x&&person.x<b.x+airSize(b).width&&person.y>=b.y&&person.y<b.y+airSize(b).height);
  return base ? {type:'airbase',id:base.id} : null;
}
