import { carrierField, carrierReady, isCarrier } from './carrier.js';
export const airRecords=world=>[...(world.airbases||[]),...(world.ships||[]).filter(s=>s.aircraft)];
export const airfields=world=>[...(world.airbases||[]),...(world.ships||[]).filter(isCarrier).map(carrierField)];
// Aircraft records retain their save identity. baseId is a movable destination.
export const liveAircraft = p => !!p && !['destroyed','vacant'].includes(p.state);
export const operationalAirbase = (world,b) => !!b && !b.destroyed && !world.logistics?.jobs?.[b.id] && (!b.carrier||carrierReady(b.carrier));
export const fleetCount = world => airRecords(world).filter(b=>liveAircraft(b.aircraft)).length;
export const fleetCapacity = world => airfields(world).filter(b=>operationalAirbase(world,b)).length;
export const reservesRunway = p => liveAircraft(p) && (['parked','delivering','takeoff','landing'].includes(p.state) || p.mission?.phase==='return');
export function runwayAvailable(world,base,plane){
 return operationalAirbase(world,base) && (!base.carrier||Math.abs(base.carrier.speed||0)<=.05) && !airRecords(world).some(b=>b.aircraft.id!==plane?.id && b.aircraft.baseId===base.id && reservesRunway(b.aircraft));
}
export const parkedRecord = (world,base) => base && airRecords(world).find(b=>b.aircraft.baseId===base.id && ['parked','delivering'].includes(b.aircraft.state));
export function flightBase(world,record){
 if(!record)return undefined;
 const destination=airfields(world).find(b=>b.id===record.aircraft.baseId)||record;
 if(destination===record)return record;
 record.wrecks ||= [];
 return {...destination,aircraft:record.aircraft,wrecks:record.wrecks};
}
export function freeAirbase(world,p,preferredId){
 const free=airfields(world).filter(b=>runwayAvailable(world,b,p));
 return free.find(b=>b.id===preferredId)||free.sort((a,b)=>Math.hypot(a.x+2-p.x,a.y+7.5-p.y)-Math.hypot(b.x+2-p.x,b.y+7.5-p.y))[0];
}
export function reserveLanding(world,p,id){
 const base=id?airfields(world).find(b=>b.id===id):freeAirbase(world,p,p.baseId);
 if(!runwayAvailable(world,base,p))return 'Choose a completed, free friendly runway.';
 p.baseId=base.id;return null;
}
export function deliveryError(world,base){
 if(!operationalAirbase(world,base))return 'Rebuild or finish the airbase before requesting aircraft.';
 if(base.carrier&&Math.abs(base.carrier.speed||0)>.05)return 'Stop the carrier before requesting aircraft.';
 const parked=parkedRecord(world,base)?.aircraft;
 if(parked){
  if(parked.owner!==base.owner)return 'A visiting aircraft occupies this runway.';
  if(parked.occupant||parked.rearm>0||parked.state!=='parked')return 'Land, finish rearming and disembark before exchanging aircraft.';
 }else{
  if(!runwayAvailable(world,base))return 'This runway is reserved for an arriving aircraft.';
  if(fleetCount(world)>=fleetCapacity(world))return 'Fleet capacity reached. Aircraft in flight still count; deploy an empty airbase for another slot.';
 }
 return null;
}

// Catalogue delivery creates aircraft only. Explicit exchanges stay at the base.
export function newAircraftError(world, base, owner) {
 if (!base || base.owner !== owner) return 'Choose one of your airbases or carriers on the map.';
 if (parkedRecord(world, base)) return 'Runway occupied. Manage this aircraft at the airbase; deployment never replaces it.';
 return deliveryError(world, base);
}
export function deliveryBaseAt(world, point) {
 return airfields(world).find(b => b.carrier
  ? Math.hypot(point.x + .5 - b.carrier.x, point.y + .5 - b.carrier.y) <= 3
  : point.x >= b.x && point.x < b.x + 6 && point.y >= b.y && point.y < b.y + 10);
}
