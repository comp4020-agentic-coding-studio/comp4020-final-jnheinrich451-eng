import { fieldLandingPoint, fieldLandingError } from './helicopter-landing.js';
import { shipStopped } from './ship-motion.js';
import { HELI, isHelipad, isHelicopter, airSize, compatibleAirfield, heliParking } from './helicopter.js';
import { carrierFields, carrierReady, isCarrier, aircraftHolders, deckRoleTaken } from './carrier.js';
// Called through: carrier.js may still be loading in the module cycle.
export const airRecords=world=>aircraftHolders(world);
// Each carrier exposes two deck fields (spots), each with its own runway.
export const airfields=world=>[...(world.airbases||[]),...(world.ships||[]).filter(isCarrier).flatMap(carrierFields)];
// Aircraft records retain their save identity. baseId is a movable destination.
export const liveAircraft = p => !!p && !['destroyed','vacant'].includes(p.state);
export const operationalAirbase = (world,b) => !!b && !b.destroyed && !world.logistics?.jobs?.[b.id] && (!b.carrier||carrierReady(b.carrier));
export const fleetCount = (world,kind='bomber') => airRecords(world).filter(b=>liveAircraft(b.aircraft)&&isHelicopter(b.aircraft)===isHelicopter({kind})).length;
export const fleetCapacity = (world,kind='bomber') => airfields(world).filter(b=>operationalAirbase(world,b)&&compatibleAirfield(b,{kind})).length;
export const reservesRunway = p => liveAircraft(p) && (p.mission?.kind==='transport'&&p.mission.action==='return'&&p.mission.phase==='moving' || !p.fieldLanding&&(['parked','delivering','takeoff','landing'].includes(p.state)||p.mission?.phase==='return'));
export function runwayAvailable(world,base,plane){
 return operationalAirbase(world,base) && (!plane||compatibleAirfield(base,plane)) && (!base.carrier||shipStopped(base.carrier)&&!(plane&&deckRoleTaken(world,base.carrier,plane))) && !airRecords(world).some(b=>b.aircraft.id!==plane?.id && b.aircraft.baseId===base.id && reservesRunway(b.aircraft));
}
export const parkedRecord = (world,base) => base && airRecords(world).find(b=>!b.aircraft.fieldLanding && b.aircraft.baseId===base.id && ['parked','delivering'].includes(b.aircraft.state));
export function flightBase(world,record){
 if(!record)return undefined;
 const destination=airfields(world).find(b=>b.id===record.aircraft.baseId)||record;
 if(destination===record)return record;
 record.wrecks ||= [];
 return {...destination,aircraft:record.aircraft,wrecks:record.wrecks};
}
export function freeAirbase(world,p,preferredId){
 const free=airfields(world).filter(b=>runwayAvailable(world,b,p));
 return free.find(b=>b.id===preferredId)||free.sort((a,b)=>Math.hypot(a.x+(isHelipad(a)?1.5:2)-p.x,a.y+(isHelipad(a)?1.5:7.5)-p.y)-Math.hypot(b.x+(isHelipad(b)?1.5:2)-p.x,b.y+(isHelipad(b)?1.5:7.5)-p.y))[0];
}
export function reserveLanding(world,p,id){
 const base=id?airfields(world).find(b=>b.id===id):freeAirbase(world,p,p.baseId);
 if(!runwayAvailable(world,base,p))return 'Choose a completed, free friendly runway.';
 p.baseId=base.id;return null;
}
export function deliveryError(world,base,kind=isHelipad(base)?'helicopter':'bomber'){
 if(!compatibleAirfield(base,{kind}))return 'Helicopters need a helipad; fixed-wing aircraft need a runway.';
 if(!operationalAirbase(world,base))return 'Use a completed intact airbase or deploy a new one.';
 if(base.carrier&&!shipStopped(base.carrier))return 'Stop the carrier before requesting aircraft.';
 const parked=parkedRecord(world,base)?.aircraft;
 if(base.carrier&&deckRoleTaken(world,base.carrier,{id:parked?.id,kind}))return 'This carrier already has its '+(kind==='attack-jet'?'attack jet':'bomber or aerial gunship')+'. A deck takes one of each role.';
 if(parked){
  if(parked.owner!==base.owner)return 'A visiting aircraft occupies this runway.';
  if(parked.occupant||isHelicopter(parked)&&parked.rearm>0||parked.state!=='parked')return 'Land, finish rearming and disembark before exchanging aircraft.';
 }else{
  if(!runwayAvailable(world,base))return 'This runway is reserved for an arriving aircraft.';
  if(fleetCount(world,kind)>=fleetCapacity(world,kind))return 'Fleet capacity reached. Aircraft in flight still count; deploy an empty airbase for another slot.';
 }
 return null;
}

// Catalogue delivery creates aircraft only. Explicit exchanges stay at the base.
export function newAircraftError(world, base, owner, kind=isHelipad(base)?'helicopter':'bomber') {
 if (!base || base.owner !== owner) return 'Choose one of your airbases or carriers on the map.';
 if (parkedRecord(world, base)) return 'Runway occupied. Manage this aircraft at the airbase; deployment never replaces it.';
 return deliveryError(world, base, kind);
}
// Clicking a carrier selects the deck spot that can accept this aircraft kind.
export function deliveryBaseAt(world, point, kind) {
 const hits=airfields(world).filter(b=>!b.destroyed).filter(b => b.carrier
  ? Math.hypot(point.x + .5 - b.carrier.x, point.y + .5 - b.carrier.y) <= 3
  : point.x >= b.x && point.x < b.x + airSize(b).width && point.y >= b.y && point.y < b.y + airSize(b).height);
 return hits.find(b=>!b.carrier||!parkedRecord(world,b)&&!(kind&&deckRoleTaken(world,b.carrier,{kind})))||hits[0];
}

// Shared landing feedback: proximity alone does not make a destroyed/busy pad usable.
export function helicopterLanding(world,p,buildings=world.buildings||[],people=world.players||[]){
 const pads=airfields(world).filter(isHelipad).sort((a,b)=>Math.hypot(p.x-heliParking(a).x,p.y-heliParking(a).y)-Math.hypot(p.x-heliParking(b).x,p.y-heliParking(b).y));
 const base=pads[0],near=base&&Math.hypot(p.x-heliParking(base).x,p.y-heliParking(base).y)<1.2;
 if(!isHelicopter(p))return {base:null,error:'Use a runway for this aircraft.'};
 if(p.sling)return {base:null,error:'Set down the carried vehicle before landing.'};
 if(p.state==='landing')return {base,error:'Landing / wait for PARKED, then E to disembark.'};
 if(p.state!=='flying')return {base,error:'Finish taking off before requesting a landing.'};
 if(near&&base.destroyed)return {base,error:'Helipad destroyed. Use another intact helipad or have a teammate deploy a new one.'};
 if(near&&world.logistics?.jobs?.[base.id])return {base,error:'Helipad under construction. Wait for assembly to finish.'};
 if(near&&!runwayAvailable(world,base,p))return {base,error:'Helipad occupied or reserved. Use another free helipad.'};
 const point=fieldLandingPoint(p);
 if(!near){
  const error=p.speed>=.8?'Release WASD and let the helicopter stop before landing.':p.mission&&p.mission.kind!=='transport'&&!['complete','lost','return'].includes(p.mission.phase)?'Finish or recall the automatic flight before landing.':fieldLandingError(world,p,point,buildings,people);
  return {base:null,point,field:true,error};
 }
 if(p.speed>=.8)return {base,error:'Release WASD and let the helicopter stop over the helipad.'};
 if(p.mission&&p.mission.kind!=='transport'&&!['complete','lost','return'].includes(p.mission.phase))return {base,error:'Finish or recall the automatic flight before landing.'};
 return {base,error:null};
}
export function requestHelicopterLanding(world,p,buildings=world.buildings||[],people=world.players||[]){
 const result=helicopterLanding(world,p,buildings,people);if(result.error)return result.error;
 if(result.field)p.fieldLanding=result.point;else{delete p.fieldLanding;p.baseId=result.base.id;}
 delete p.landingError;Object.assign(p,{state:'landing',remaining:HELI.transition,speed:0,vx:0,vy:0});
 return null;
}
